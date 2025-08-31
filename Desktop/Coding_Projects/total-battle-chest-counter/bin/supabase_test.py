import os
import sys
import pandas as pd
from pathlib import Path
from datetime import datetime
from supabase import create_client, Client

def setup_supabase_client():
    """Initialize Supabase client with environment variables"""
    # Load from environment
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_ANON_KEY")
    
    if not url or not key:
        print("❌ Error: Missing Supabase credentials")
        print("\n🔧 Setup required:")
        print("   Set environment variables:")
        print("   SUPABASE_URL=your_supabase_project_url")
        print("   SUPABASE_ANON_KEY=your_supabase_anon_key")
        print("\n💡 You can find these in your Supabase project settings > API")
        sys.exit(1)
    
    return create_client(url, key)

def validate_csv_for_upload(csv_file_path):
    """Validate CSV file before upload (reuse logic from csv_test.py)"""
    try:
        # Read CSV with UTF-8 encoding
        df = pd.read_csv(csv_file_path, encoding='utf-8')
        print(f"📁 CSV loaded: {len(df)} rows")
        
        # Validate expected columns
        expected_cols = ['DATE', 'PLAYER', 'SOURCE', 'CHEST', 'SCORE', 'CLAN']
        if list(df.columns) != expected_cols:
            print(f"❌ Invalid columns: {list(df.columns)}")
            print(f"   Expected: {expected_cols}")
            return None
        
        # Check for null values in critical columns
        critical_nulls = df[['DATE', 'PLAYER', 'CHEST', 'CLAN']].isnull().sum()
        if critical_nulls.sum() > 0:
            print(f"⚠️  Found null values in critical columns:")
            for col, count in critical_nulls.items():
                if count > 0:
                    print(f"   - {col}: {count} nulls")
        
        # Convert SCORE to integer (handle any string scores)
        try:
            df['SCORE'] = pd.to_numeric(df['SCORE'], errors='coerce').fillna(0).astype(int)
        except Exception as e:
            print(f"⚠️  Score conversion issue: {e}")
        
        print(f"✅ CSV validation passed")
        return df
        
    except Exception as e:
        print(f"❌ CSV validation failed: {e}")
        return None

def upload_to_supabase_test(csv_file_path):
    """Upload CSV data to Supabase test table"""
    print(f"🚀 Starting upload process...")
    
    # Validate CSV first
    df = validate_csv_for_upload(csv_file_path)
    if df is None:
        return False, 0
    
    # Convert to records (format expected by Supabase)
    records = df.to_dict('records')
    print(f"📦 Prepared {len(records)} records for upload")
    
    # Show sample record
    if records:
        print(f"📋 Sample record:")
        sample = records[0]
        for key, value in sample.items():
            print(f"   {key}: {value} ({type(value).__name__})")
    
    # Create Supabase client
    try:
        supabase = setup_supabase_client()
        print(f"✅ Connected to Supabase")
    except Exception as e:
        print(f"❌ Failed to connect to Supabase: {e}")
        return False, 0
    
    # Upload in batches
    batch_size = 100
    total_uploaded = 0
    total_batches = (len(records) + batch_size - 1) // batch_size
    
    print(f"📤 Uploading in {total_batches} batches of {batch_size}...")
    
    for i in range(0, len(records), batch_size):
        batch = records[i:i + batch_size]
        batch_num = i // batch_size + 1
        
        try:
            # Insert batch to raw_chests_test table
            result = supabase.table("raw_chests_test").insert(batch).execute()
            total_uploaded += len(batch)
            print(f"✅ Batch {batch_num}/{total_batches}: {len(batch)} records uploaded")
            
        except Exception as e:
            print(f"❌ Error uploading batch {batch_num}: {e}")
            # Show problematic record if possible
            if hasattr(e, 'details') and e.details:
                print(f"   Details: {e.details}")
            return False, total_uploaded
    
    print(f"🎉 Successfully uploaded {total_uploaded} records to raw_chests_test table")
    return True, total_uploaded

def verify_upload(expected_count):
    """Verify the upload by counting records in the test table"""
    try:
        supabase = setup_supabase_client()
        
        # Count records in test table
        result = supabase.table("raw_chests_test").select("id", count="exact").execute()
        actual_count = result.count
        
        print(f"\n📊 Upload Verification:")
        print(f"   Records in database: {actual_count}")
        print(f"   Expected records: {expected_count}")
        
        if actual_count >= expected_count:
            print("✅ Upload verification successful")
            
            # Show sample data from database
            sample_result = supabase.table("raw_chests_test").select("*").limit(3).execute()
            if sample_result.data:
                print(f"\n📋 Sample records from database:")
                for i, record in enumerate(sample_result.data, 1):
                    # Remove UUID and timestamp for cleaner display
                    display_record = {k: v for k, v in record.items() if k not in ['id', 'updated_at']}
                    print(f"   Record {i}: {display_record}")
            
            return True
        else:
            print("❌ Record count mismatch")
            return False
            
    except Exception as e:
        print(f"❌ Verification failed: {e}")
        return False

def cleanup_test_table():
    """Clean all records from the test table"""
    try:
        supabase = setup_supabase_client()
        
        # Count existing records
        count_result = supabase.table("raw_chests_test").select("id", count="exact").execute()
        record_count = count_result.count
        
        if record_count == 0:
            print("✅ Test table is already empty")
            return True
        
        print(f"🧹 Cleaning {record_count} records from test table...")
        
        # Delete all records (Supabase requires a condition, so we use a condition that matches all)
        result = supabase.table("raw_chests_test").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        
        # Verify cleanup
        verify_result = supabase.table("raw_chests_test").select("id", count="exact").execute()
        remaining = verify_result.count
        
        if remaining == 0:
            print("✅ Test table cleaned successfully")
            return True
        else:
            print(f"⚠️  {remaining} records remaining after cleanup")
            return False
            
    except Exception as e:
        print(f"❌ Cleanup failed: {e}")
        return False

def find_latest_eod_file(directory="."):
    """Find the most recent EOD CSV file"""
    patterns = [
        "TB_Chests_*_FINAL.csv",
        "*_FINAL.csv",
        "TB_Chests_*.csv"
    ]
    
    all_files = []
    for pattern in patterns:
        files = list(Path(directory).glob(pattern))
        all_files.extend(files)
    
    if not all_files:
        return None
    
    # Return the most recently modified file
    latest_file = max(all_files, key=lambda f: f.stat().st_mtime)
    return latest_file

def show_help():
    """Display usage instructions"""
    print("🔧 Supabase Test Uploader")
    print("=" * 50)
    print("\n📋 Prerequisites:")
    print("   1. Install supabase client: pip install supabase")
    print("   2. Set environment variables:")
    print("      SUPABASE_URL=your_supabase_project_url")
    print("      SUPABASE_ANON_KEY=your_supabase_anon_key")
    print("\n💡 Usage:")
    print("   python supabase_test.py                    # Auto-detect latest CSV")
    print("   python supabase_test.py file.csv          # Upload specific file") 
    print("   python supabase_test.py --cleanup         # Clean test table")
    print("   python supabase_test.py --help            # Show this help")
    print("\n🎯 Table: raw_chests_test")
    print("   This script uploads to the test table for safe testing")

if __name__ == "__main__":
    print("🚀 Supabase Test Uploader")
    print("=" * 30)
    
    # Handle command line arguments
    if len(sys.argv) > 1:
        if sys.argv[1] == "--cleanup":
            print("🧹 Cleaning test table...")
            success = cleanup_test_table()
            sys.exit(0 if success else 1)
        elif sys.argv[1] == "--help":
            show_help()
            sys.exit(0)
        else:
            # Specific file provided
            csv_file = Path(sys.argv[1])
            if not csv_file.exists():
                print(f"❌ File not found: {csv_file}")
                sys.exit(1)
    else:
        # Auto-detect latest file
        print("🔍 Auto-detecting latest EOD file...")
        csv_file = find_latest_eod_file()
        
        if not csv_file:
            print("❌ No EOD CSV file found")
            print("\n💡 Available options:")
            print("   1. Specify a file: python supabase_test.py your_file.csv")
            print("   2. Place CSV files in current directory")
            print("   3. Run --help for more information")
            sys.exit(1)
        
        print(f"🎯 Found: {csv_file}")
    
    # Get record count from CSV for verification
    try:
        temp_df = pd.read_csv(csv_file, encoding='utf-8')
        expected_count = len(temp_df)
    except Exception as e:
        print(f"❌ Cannot read CSV for count: {e}")
        sys.exit(1)
    
    # Perform the upload
    success, uploaded_count = upload_to_supabase_test(csv_file)
    
    if success:
        # Verify the upload
        verification_passed = verify_upload(uploaded_count)
        
        print("\n" + "=" * 50)
        if verification_passed:
            print("🎉 Test upload completed successfully!")
            print("\n✅ What was tested:")
            print("   - CSV reading with UTF-8 encoding")
            print("   - Data validation and type conversion")
            print("   - Batch upload to Supabase")
            print("   - Record count verification")
            print("   - Special character handling")
            print("\n🚀 Ready to build production uploader!")
        else:
            print("⚠️  Upload completed but verification failed")
            print("   Check Supabase dashboard for data integrity")
    else:
        print("\n❌ Upload failed")
        print("🔧 Troubleshooting:")
        print("   1. Check Supabase credentials")
        print("   2. Verify table permissions")
        print("   3. Check CSV file format")
        print("   4. Review error messages above")
    
    sys.exit(0 if success else 1)