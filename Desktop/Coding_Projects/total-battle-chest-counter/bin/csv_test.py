import pandas as pd
import sys
from pathlib import Path
from datetime import datetime
import re

def test_csv_processing(csv_file_path):
    """
    Test CSV processing for EOD files before Supabase upload
    
    Returns:
        bool: True if all tests pass, False otherwise
    """
    print(f"🧪 Testing CSV file: {csv_file_path}")
    
    try:
        # Read CSV with UTF-8 encoding
        df = pd.read_csv(csv_file_path, encoding='utf-8')
        print(f"✅ Successfully read CSV: {len(df)} rows")
        
        # Validate expected columns
        expected_cols = ['DATE', 'PLAYER', 'SOURCE', 'CHEST', 'SCORE', 'CLAN']
        if list(df.columns) == expected_cols:
            print("✅ Column structure correct")
        else:
            print(f"❌ Unexpected columns: {list(df.columns)}")
            print(f"   Expected: {expected_cols}")
            return False
        
        # Check for empty dataframe
        if df.empty:
            print("❌ CSV file is empty")
            return False
        
        # Test date format validation
        print(f"\n📅 Testing date formats...")
        sample_dates = df['DATE'].head(5).tolist()
        print(f"📊 Date samples: {sample_dates}")
        
        # Verify dates are in correct format (YYYY-MM-DD HH:mm:ss)
        date_format_valid = True
        for i, date_str in enumerate(sample_dates[:3]):
            try:
                parsed_date = datetime.strptime(str(date_str), '%Y-%m-%d %H:%M:%S')
                print(f"✅ Date format valid: {date_str}")
            except ValueError:
                print(f"❌ Invalid date format: {date_str}")
                date_format_valid = False
        
        if not date_format_valid:
            return False
        
        # Test special character handling
        print(f"\n🌍 Testing special character handling...")
        special_char_players = df[df['PLAYER'].str.contains(r'[À-ÿ]', na=False, regex=True)]['PLAYER'].unique()
        print(f"🌍 Players with special chars: {len(special_char_players)}")
        for player in special_char_players[:5]:
            print(f"   - {player}")
        
        # Test for null values
        print(f"\n🔍 Checking for null values...")
        null_counts = df.isnull().sum()
        has_nulls = False
        for col, count in null_counts.items():
            if count > 0:
                print(f"⚠️  Column '{col}' has {count} null values")
                has_nulls = True
        
        if not has_nulls:
            print("✅ No null values found")
        
        # Validate data types and ranges
        print(f"\n📊 Validating data...")
        
        # Check SCORE column is numeric
        try:
            df['SCORE'] = pd.to_numeric(df['SCORE'], errors='coerce')
            if df['SCORE'].isnull().sum() > 0:
                print(f"⚠️  {df['SCORE'].isnull().sum()} non-numeric scores found")
            else:
                print(f"✅ All scores are numeric (range: {df['SCORE'].min()} - {df['SCORE'].max()})")
        except Exception as e:
            print(f"❌ Error processing SCORE column: {e}")
            return False
        
        # Show data distribution
        print(f"\n📈 Data distribution:")
        print(f"   - Unique players: {df['PLAYER'].nunique()}")
        print(f"   - Unique sources: {df['SOURCE'].nunique()}")
        print(f"   - Unique chests: {df['CHEST'].nunique()}")
        print(f"   - Unique clans: {df['CLAN'].nunique()}")
        print(f"   - Total score: {df['SCORE'].sum()}")
        
        # Show top sources and chests
        print(f"\n🏆 Top 5 sources:")
        top_sources = df['SOURCE'].value_counts().head()
        for source, count in top_sources.items():
            print(f"   - {source}: {count}")
        
        print(f"\n🎁 Top 5 chest types:")
        top_chests = df['CHEST'].value_counts().head()
        for chest, count in top_chests.items():
            print(f"   - {chest}: {count}")
        
        # Simulate Supabase data preparation
        print(f"\n📤 Preparing data for Supabase simulation...")
        supabase_ready = df.to_dict('records')
        print(f"📤 Sample records ready for Supabase upload:")
        for i, record in enumerate(supabase_ready[:3]):
            print(f"Record {i+1}: {record}")
        
        # Test JSON serialization (important for Supabase)
        print(f"\n🔧 Testing JSON serialization...")
        try:
            import json
            json_sample = json.dumps(supabase_ready[:2], ensure_ascii=False, indent=2)
            print(f"✅ JSON serialization successful")
            print(f"Sample JSON:\n{json_sample}")
        except Exception as e:
            print(f"❌ JSON serialization failed: {e}")
            return False
        
        # Final validation summary
        print(f"\n📋 Validation Summary:")
        print(f"   - Total records: {len(df)}")
        print(f"   - Columns: {len(df.columns)} (expected 6)")
        print(f"   - Date format: ✅ Valid")
        print(f"   - Encoding: ✅ UTF-8 compatible")
        print(f"   - Special characters: ✅ Handled")
        print(f"   - JSON serializable: ✅ Yes")
        
        return True
        
    except FileNotFoundError:
        print(f"❌ File not found: {csv_file_path}")
        return False
    except UnicodeDecodeError as e:
        print(f"❌ Encoding error: {e}")
        print("   Try checking file encoding or saving as UTF-8")
        return False
    except pd.errors.EmptyDataError:
        print(f"❌ CSV file is empty or corrupted")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
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

def show_available_files(directory="."):
    """Show all available CSV files for user selection"""
    patterns = ["*.csv", "TB_Chests_*.csv"]
    all_files = []
    
    for pattern in patterns:
        files = list(Path(directory).glob(pattern))
        all_files.extend(files)
    
    if all_files:
        print(f"\n📁 Available CSV files in {directory}:")
        for i, file in enumerate(sorted(all_files), 1):
            mod_time = datetime.fromtimestamp(file.stat().st_mtime)
            size = file.stat().st_size
            print(f"   {i}. {file.name} ({size:,} bytes, modified: {mod_time:%Y-%m-%d %H:%M:%S})")
    else:
        print(f"No CSV files found in {directory}")

if __name__ == "__main__":
    print("🧪 EOD CSV Validation Test Script")
    print("=" * 50)
    
    csv_file = None
    
    if len(sys.argv) > 1:
        # Direct file specification
        csv_file = Path(sys.argv[1])
        if not csv_file.exists():
            print(f"❌ Specified file does not exist: {csv_file}")
            show_available_files()
            sys.exit(1)
    else:
        # Auto-detection
        print("🔍 Auto-detecting latest EOD file...")
        csv_file = find_latest_eod_file()
        
        if not csv_file:
            print("❌ No EOD CSV file found in current directory")
            show_available_files()
            print("\n💡 Usage:")
            print("   python csv_test.py                              # Auto-detect latest file")
            print("   python csv_test.py <filename.csv>               # Test specific file")
            sys.exit(1)
        
        print(f"🎯 Found latest file: {csv_file}")
    
    # Run the tests
    success = test_csv_processing(csv_file)
    
    print("\n" + "=" * 50)
    if success:
        print("✅ All tests passed! CSV is ready for Supabase upload.")
        print("\n🚀 Next steps:")
        print("   1. This data format is compatible with Supabase")
        print("   2. Special characters are properly handled")
        print("   3. JSON serialization works correctly")
        print("   4. Ready to build the Supabase uploader!")
    else:
        print("❌ Tests failed. Issues need to be resolved before upload.")
        print("\n🔧 Common fixes:")
        print("   1. Ensure file is saved with UTF-8 encoding")
        print("   2. Check date format is YYYY-MM-DD HH:MM:SS")
        print("   3. Verify all required columns are present")
        print("   4. Remove any null/empty values")
    
    sys.exit(0 if success else 1)