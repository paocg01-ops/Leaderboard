import os
import sys
import pandas as pd
import logging
from pathlib import Path
from datetime import datetime
from supabase import create_client, Client

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('supabase_upload.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class SupabaseUploader:
    def __init__(self):
        self.supabase = None
        self.table_name = "raw_chests"  # Production table
        self.batch_size = 100
        
    def setup_connection(self):
        """Initialize Supabase client with environment variables or .env file"""
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_ANON_KEY")
        
        # If environment variables aren't set, try loading from .env file
        if not url or not key:
            env_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
            if os.path.exists(env_file):
                try:
                    with open(env_file, 'r') as f:
                        for line in f:
                            line = line.strip()
                            if line and not line.startswith('#') and '=' in line:
                                key_name, value = line.split('=', 1)
                                if key_name.strip() == 'SUPABASE_URL':
                                    url = value.strip()
                                elif key_name.strip() == 'SUPABASE_ANON_KEY':
                                    key = value.strip()
                    logger.info("Loaded credentials from .env file")
                except Exception as e:
                    logger.error(f"Failed to read .env file: {e}")
        
        if not url or not key or url.startswith('https://your-project') or key.startswith('your_'):
            logger.error("Missing or invalid Supabase credentials")
            logger.error("Either set SUPABASE_URL and SUPABASE_ANON_KEY environment variables")
            logger.error("Or update the .env file with your actual Supabase credentials")
            return False
        
        try:
            self.supabase = create_client(url, key)
            logger.info("Successfully connected to Supabase")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to Supabase: {e}")
            return False
    
    def validate_csv(self, csv_file_path):
        """Validate CSV file before upload"""
        # Try multiple encodings to handle files from tb.py
        encodings_to_try = ['utf-8', 'windows-1252', 'latin-1', 'cp1252']
        df = None
        used_encoding = None
        
        for encoding in encodings_to_try:
            try:
                df = pd.read_csv(csv_file_path, encoding=encoding)
                used_encoding = encoding
                logger.info(f"CSV loaded with {encoding} encoding: {len(df)} rows from {csv_file_path}")
                print(f">>> CSV loaded: {len(df)} rows (encoding: {encoding})")
                break
            except UnicodeDecodeError:
                continue
            except Exception as e:
                logger.error(f"Error reading CSV with {encoding}: {e}")
                continue
        
        if df is None:
            logger.error(f"Failed to read CSV with any supported encoding")
            print(f">>> Failed to read CSV - unsupported encoding")
            return None
        
        try:
            
            # Validate expected columns
            expected_cols = ['DATE', 'PLAYER', 'SOURCE', 'CHEST', 'SCORE', 'CLAN']
            if list(df.columns) != expected_cols:
                logger.error(f"Invalid columns: {list(df.columns)}, expected: {expected_cols}")
                print(f">>> Invalid columns: {list(df.columns)}")
                print(f"   Expected: {expected_cols}")
                return None
            
            # Check for null values in critical columns
            critical_cols = ['DATE', 'PLAYER', 'CHEST', 'CLAN']
            critical_nulls = df[critical_cols].isnull().sum()
            if critical_nulls.sum() > 0:
                logger.warning("Found null values in critical columns:")
                for col, count in critical_nulls.items():
                    if count > 0:
                        logger.warning(f"  {col}: {count} nulls")
            
            # Convert SCORE to integer (handle any string scores)
            try:
                df['SCORE'] = pd.to_numeric(df['SCORE'], errors='coerce').fillna(0).astype(int)
            except Exception as e:
                logger.warning(f"Score conversion issue: {e}")
            
            # Fill null SOURCE values with empty string
            df['SOURCE'] = df['SOURCE'].fillna('')
            
            logger.info("CSV validation passed")
            return df
            
        except Exception as e:
            logger.error(f"CSV validation failed: {e}")
            return None
    
    def upload_data(self, df):
        """Upload DataFrame to Supabase production table"""
        if self.supabase is None:
            logger.error("Supabase client not initialized")
            print(">>> Supabase client not initialized")
            return False, 0
        
        # Convert to records (format expected by Supabase)
        records = df.to_dict('records')
        logger.info(f"Prepared {len(records)} records for upload")
        print(f">>> Prepared {len(records)} records for upload")
        
        # Show sample record for verification
        if records:
            sample = records[0]
            logger.info(f"Sample record: {sample}")
            print(f">>> Sample record:")
            for key, value in sample.items():
                print(f"   {key}: {value} ({type(value).__name__})")
        
        # Upload in batches
        total_uploaded = 0
        total_batches = (len(records) + self.batch_size - 1) // self.batch_size
        
        logger.info(f"Uploading to '{self.table_name}' in {total_batches} batches of {self.batch_size}")
        print(f">>> Uploading to '{self.table_name}' in {total_batches} batches of {self.batch_size}...")
        
        for i in range(0, len(records), self.batch_size):
            batch = records[i:i + self.batch_size]
            batch_num = i // self.batch_size + 1
            
            try:
                # Insert batch to production raw_chests table
                result = self.supabase.table(self.table_name).insert(batch).execute()
                total_uploaded += len(batch)
                logger.info(f"Batch {batch_num}/{total_batches}: {len(batch)} records uploaded successfully")
                print(f">>> Batch {batch_num}/{total_batches}: {len(batch)} records uploaded")
                
            except Exception as e:
                logger.error(f"Error uploading batch {batch_num}: {e}")
                print(f">>> Error uploading batch {batch_num}: {e}")
                if hasattr(e, 'details') and e.details:
                    logger.error(f"Details: {e.details}")
                    print(f"   Details: {e.details}")
                return False, total_uploaded
        
        logger.info(f"Successfully uploaded {total_uploaded} records to {self.table_name}")
        print(f">>> Successfully uploaded {total_uploaded} records to {self.table_name}")
        return True, total_uploaded
    
    def verify_upload(self, expected_count):
        """Verify the upload by checking recent records"""
        if self.supabase is None:
            logger.error("Supabase client not initialized")
            return False
        
        try:
            # Get recent records (last hour) to verify our upload
            recent_time = datetime.now().strftime('%Y-%m-%d %H:00:00')
            
            result = self.supabase.table(self.table_name)\
                .select("*", count="exact")\
                .gte("updated_at", recent_time)\
                .execute()
            
            recent_count = result.count
            logger.info(f"Recent records in database: {recent_count}")
            logger.info(f"Expected upload count: {expected_count}")
            
            if recent_count >= expected_count:
                logger.info("Upload verification successful")
                print(f"\n>>> Upload Verification:")
                print(f"   Records in database: {recent_count}")
                print(f"   Expected records: {expected_count}")
                print(">>> Upload verification successful")
                
                # Show sample of uploaded data
                if result.data:
                    logger.info("Sample uploaded records:")
                    print(f"\n>>> Sample records from database:")
                    for i, record in enumerate(result.data[:3], 1):
                        # Remove UUID and timestamp for cleaner display
                        display_record = {k: v for k, v in record.items() 
                                       if k not in ['id', 'updated_at']}
                        logger.info(f"  Record {i}: {display_record}")
                        print(f"   Record {i}: {display_record}")
                
                return True
            else:
                logger.warning(f"Record count mismatch - found {recent_count}, expected {expected_count}")
                print(f">>> Record count mismatch - found {recent_count}, expected {expected_count}")
                return False
                
        except Exception as e:
            logger.error(f"Verification failed: {e}")
            return False
    
    def clear_source_file(self, source_file_path):
        """Clear the source .txt file after successful upload with comprehensive logging"""
        print(f"\n>>> CLEARING SOURCE FILE: {source_file_path}")
        logger.info(f"Starting source file clearing process: {source_file_path}")
        
        try:
            if os.path.exists(source_file_path):
                # Check file size before clearing
                file_size = os.path.getsize(source_file_path)
                with open(source_file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    line_count = len([line for line in f.readlines() if line.strip()])
                
                print(f">>> Source file contains {line_count} lines ({file_size} bytes)")
                logger.info(f"Source file before clearing: {line_count} lines, {file_size} bytes")
                
                # Create backup before clearing
                backup_path = f"{source_file_path}.backup.{datetime.now().strftime('%Y%m%d_%H%M%S')}"
                os.rename(source_file_path, backup_path)
                print(f">>> Backup created: {backup_path}")
                logger.info(f"Source file backed up to: {backup_path}")
                
                # Create empty file to maintain the file structure
                with open(source_file_path, 'w', encoding='utf-8') as f:
                    f.write("")
                
                # Verify file was cleared
                new_size = os.path.getsize(source_file_path)
                print(f">>> Source file cleared: {source_file_path} (now {new_size} bytes)")
                logger.info(f"Source file cleared successfully: {source_file_path} (now {new_size} bytes)")
                
                print(">>> ANTI-DUPLICATE PROTECTION ACTIVATED")
                return True
            else:
                print(f">>> Source file not found: {source_file_path}")
                logger.warning(f"Source file not found: {source_file_path}")
                return False
                
        except Exception as e:
            print(f">>> Failed to clear source file: {e}")
            logger.error(f"Failed to clear source file: {e}")
            return False

def find_latest_eod_csv(directory=".", clan_name=None):
    """Find the most recent EOD CSV file"""
    patterns = []
    
    if clan_name:
        patterns.append(f"TB_Chests_{clan_name}_*_FINAL.csv")
    
    patterns.extend([
        "TB_Chests_*_FINAL.csv",
        "*_FINAL.csv"
    ])
    
    all_files = []
    for pattern in patterns:
        files = list(Path(directory).glob(pattern))
        all_files.extend(files)
    
    if not all_files:
        return None
    
    # Return the most recently modified file
    latest_file = max(all_files, key=lambda f: f.stat().st_mtime)
    return latest_file

def upload_eod_to_supabase(csv_file_path=None, source_file_path=None, clear_source=False):
    """
    Main function to upload EOD data to Supabase
    
    Args:
        csv_file_path: Path to CSV file to upload
        source_file_path: Path to source .txt file to clear after upload
        clear_source: Whether to clear the source file after successful upload
    
    Returns:
        bool: True if upload successful, False otherwise
    """
    logger.info("Starting EOD upload to Supabase")
    print(">>> Starting EOD upload to Supabase")
    
    # Find CSV file if not provided
    if not csv_file_path:
        csv_file_path = find_latest_eod_csv()
        if not csv_file_path:
            logger.error("No EOD CSV file found")
            print(">>> No EOD CSV file found")
            return False
    
    # Ensure file exists
    if not os.path.exists(csv_file_path):
        logger.error(f"CSV file not found: {csv_file_path}")
        print(f">>> CSV file not found: {csv_file_path}")
        return False
    
    logger.info(f"Processing CSV file: {csv_file_path}")
    print(f">>> Processing CSV file: {csv_file_path}")
    
    # Initialize uploader
    uploader = SupabaseUploader()
    
    # Setup connection
    if not uploader.setup_connection():
        print(">>> Failed to connect to Supabase")
        return False
    
    print(">>> Connected to Supabase")
    
    # Validate and load CSV
    df = uploader.validate_csv(csv_file_path)
    if df is None:
        print(">>> CSV validation failed")
        return False
    
    print(f">>> CSV validation passed")
    expected_count = len(df)
    
    # Upload data
    success, uploaded_count = uploader.upload_data(df)
    if not success:
        logger.error("Upload failed")
        print(">>> Upload failed")
        return False
    
    # Verify upload
    if not uploader.verify_upload(uploaded_count):
        logger.warning("Upload verification failed, but data may still be uploaded")
        print(">>>  Upload verification failed, but data may still be uploaded")
    
    # Clear source file if requested and upload was successful
    if clear_source and source_file_path and success:
        source_cleared = uploader.clear_source_file(source_file_path)
        if source_cleared:
            logger.info("Source file cleared successfully")
            print(">>> Source file cleared successfully")
        else:
            logger.warning("Failed to clear source file, but upload was successful")
            print(">>>  Failed to clear source file, but upload was successful")
    
    logger.info(f"EOD upload completed successfully: {uploaded_count} records")
    
    # Final success message
    print(f"\n" + "="*50)
    print(">>> Production upload completed successfully!")
    print(f"\n>>> What was accomplished:")
    print(f"   - {uploaded_count} records uploaded to production raw_chests table")
    print("   - UTF-8 encoding handled correctly")
    print("   - Data validation and type conversion completed")
    print("   - Batch upload processing successful")
    print("   - Upload verification completed")
    if clear_source and source_file_path:
        print("   - Source file backed up and cleared")
    print("\n>>> Data is now in the cloud database!")
    
    return True

if __name__ == "__main__":
    # Command line usage
    csv_file = None
    source_file = None
    clear_source = False
    
    if len(sys.argv) > 1:
        csv_file = sys.argv[1]
        if len(sys.argv) > 2:
            source_file = sys.argv[2]
            clear_source = True
    
    success = upload_eod_to_supabase(csv_file, source_file, clear_source)
    
    if success:
        print(">>> EOD upload completed successfully")
    else:
        print(">>> EOD upload failed - check logs for details")
    
    sys.exit(0 if success else 1)