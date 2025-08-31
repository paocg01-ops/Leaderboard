# 🔧 Troubleshooting Guide

## Common Issues and Solutions

### 🖥️ Screen Capture Issues

**Problem**: OCR not reading text correctly
- **Solution**: Re-calibrate capture area to include only text, no graphics
- **Command**: `python bin/tb.py --config config/YourClan.cfg --calibrate`
- **Tips**: Ensure consistent screen brightness and zoom level

**Problem**: "No gifts" detected when chests are visible
- **Solution**: Capture area might be too small or positioned incorrectly
- **Fix**: Recalibrate and ensure the entire chest text area is included

### 👥 Player Issues

**Problem**: "Unknown player name" errors
- **Solution**: Add player to `config/players.yourclan.csv`
- **Format**: `ActualName,alias1,alias2,alias3`
- **Auto-fix**: Use auto-accept mode to automatically add players

**Problem**: Players with special characters not recognized
- **Solution**: System handles UTF-8 automatically, but check encoding
- **Example**: "aghaté tyché" should work correctly

### 📊 Scoring Issues

**Problem**: "No score for X" warnings
- **Solution**: Add missing sources to `config/scores.csv`
- **Format**: `Source Name,Points`
- **Example**: `Level 20 Citadel,15`

**Problem**: Tartaros Crypts showing as "Tartaros Crypt" with no level
- **Status**: ✅ Fixed! System now converts "Tartaros Crypt level 20" to "Level 20 Tartaros Crypt"
- **Action**: Update scores.csv with entries like `Level 20 Tartaros Crypt,25`

### 🏗️ OCR Errors

**Problem**: Chest names read incorrectly (e.g., "ead Chest" instead of "Wooden Chest")
- **Solution**: Add to `config/data_quality.csv`
- **Format**: `Correct Name,OCR Error 1,OCR Error 2`
- **Example**: `Wooden Chest,ead Chest,ooden Chest`

**Problem**: Source names truncated or misread
- **Solution**: Check if pattern is consistent, add to data_quality.csv
- **Auto-fix**: System has built-in fixes for common truncations (e.g., "Cr" → "Crypt")

### ☁️ Supabase Upload Issues

**Problem**: "Invalid API key" error
- **Solution**: Check environment variables are set correctly
- **Commands**:
  ```cmd
  set SUPABASE_URL=https://your-project.supabase.co
  set SUPABASE_ANON_KEY=your_key_here
  ```

**Problem**: "Row level security policy" error
- **Solution**: Add INSERT policy in Supabase SQL editor:
  ```sql
  CREATE POLICY "anon can insert raw_chests" 
  ON "public"."raw_chests" 
  FOR INSERT TO anon WITH CHECK (true);
  ```

**Problem**: "UPDATE requires WHERE clause" error
- **Solution**: Drop problematic triggers:
  ```sql
  DROP TRIGGER IF EXISTS update_raw_chests_on_insert ON raw_chests;
  ```

### 📁 File and Path Issues

**Problem**: "File not found" errors
- **Solution**: Check config file paths are relative to project root
- **Correct**: `data/YourClan.txt`
- **Wrong**: `../data/YourClan.txt` (when running from project root)

**Problem**: Permission denied errors
- **Solution**: Run as administrator or check folder permissions
- **Alternative**: Choose different directory with write access

### 🔧 Installation Issues

**Problem**: "ModuleNotFoundError" for packages
- **Solution**: Install missing packages:
  ```bash
  pip install pandas opencv-python pytesseract pillow pyautogui pyperclip pygetwindow supabase
  ```

**Problem**: Tesseract not found
- **Solution**: Install Tesseract OCR from https://github.com/UB-Mannheim/tesseract/wiki
- **Path issue**: Update `pytesseract.pytesseract.tesseract_cmd` in code if needed

### 🎮 Game-Specific Issues

**Problem**: Auto-clicking not working
- **Solution**: Re-calibrate mouse position using calibration mode
- **Check**: Game window must be active and visible
- **Timing**: Adjust clickWait parameter in config (default 300ms)

**Problem**: Game screen changes after calibration
- **Solution**: Keep game window size and position consistent
- **Tip**: Use fullscreen or fixed window size for best results

## 🚨 Emergency Recovery

### If Source File Gets Corrupted
1. Check `archive/` folder for backups
2. Source files are automatically backed up before clearing
3. Look for `YourClan.txt.backup.YYYYMMDD_HHMMSS` files

### If Upload Fails but Data is Valuable
1. Data is saved in `final/` folder as CSV
2. Can manually upload using: `python bin/supabase_uploader.py final/filename.csv`
3. Source file is only cleared AFTER successful upload

### Reset Everything
1. Delete contents of `data/`, `working/`, `final/` folders
2. Re-run calibration: `python bin/tb.py --config config/YourClan.cfg --calibrate`
3. Update configuration files as needed

## 📞 Getting Help

### Debug Information to Collect
1. **Error message** (full text)
2. **Command used** (exact command line)
3. **Config file** (sanitized, no personal info)
4. **Screenshot** of game screen if OCR-related
5. **Python version**: `python --version`
6. **OS version**: Windows 10/11

### Log Files
- **OCR Debug**: `TBCalibration_Screenshot.png` (created during calibration)
- **Raw Capture**: Check `working/` folder for debug files
- **Supabase Logs**: `supabase_upload.log`

### Test Commands
```bash
# Test CSV validation
python csv_test.py final/your_file.csv

# Test Supabase connection  
python bin/supabase_test.py --cleanup

# Test specific file upload
python bin/supabase_uploader.py final/your_file.csv
```

Remember: The system is designed to be resilient. Most issues can be resolved by recalibration or updating configuration files. Data is preserved at each step, so recovery is usually possible.