#!/usr/bin/env python3
"""
Test script to verify file clearing functionality works
"""
import os
import sys
sys.path.append('bin')

from supabase_uploader import SupabaseUploader

def test_file_clearing():
    print("=== TESTING FILE CLEARING FUNCTIONALITY ===")
    
    # Test file paths
    test_source = "data/Strike_for_Cake_TEST.txt"
    
    if not os.path.exists(test_source):
        print(f"ERROR: Test source file not found: {test_source}")
        return False
    
    # Check initial file state
    print(f"\n1. Initial file check:")
    with open(test_source, 'r', encoding='utf-8', errors='ignore') as f:
        initial_lines = len([line for line in f.readlines() if line.strip()])
    initial_size = os.path.getsize(test_source)
    print(f"   File: {test_source}")
    print(f"   Lines: {initial_lines}")
    print(f"   Size: {initial_size} bytes")
    
    # Test the clearing function
    print(f"\n2. Testing clear_source_file function:")
    uploader = SupabaseUploader()
    success = uploader.clear_source_file(test_source)
    
    if success:
        print(f"\n3. Post-clearing verification:")
        if os.path.exists(test_source):
            final_size = os.path.getsize(test_source)
            with open(test_source, 'r', encoding='utf-8', errors='ignore') as f:
                final_lines = len([line for line in f.readlines() if line.strip()])
            
            print(f"   File exists: YES")
            print(f"   Final size: {final_size} bytes")
            print(f"   Final lines: {final_lines}")
            
            if final_size == 0 and final_lines == 0:
                print("\n✅ SUCCESS: File clearing works correctly!")
                
                # Check if backup was created
                backup_files = [f for f in os.listdir(os.path.dirname(test_source)) 
                               if f.startswith(os.path.basename(test_source) + ".backup.")]
                if backup_files:
                    print(f"✅ SUCCESS: Backup created: {backup_files[-1]}")
                    
                    # Check backup content
                    backup_path = os.path.join(os.path.dirname(test_source), backup_files[-1])
                    with open(backup_path, 'r', encoding='utf-8', errors='ignore') as f:
                        backup_lines = len([line for line in f.readlines() if line.strip()])
                    print(f"✅ SUCCESS: Backup contains original {backup_lines} lines")
                    
                return True
            else:
                print(f"❌ FAILURE: File not properly cleared!")
                return False
        else:
            print(f"❌ FAILURE: File was deleted instead of cleared!")
            return False
    else:
        print(f"❌ FAILURE: clear_source_file returned False")
        return False

if __name__ == "__main__":
    success = test_file_clearing()
    if success:
        print("\n🎉 FILE CLEARING TEST PASSED!")
        print("The clearing mechanism is working correctly.")
    else:
        print("\n💥 FILE CLEARING TEST FAILED!")
        print("There is an issue with the clearing mechanism.")