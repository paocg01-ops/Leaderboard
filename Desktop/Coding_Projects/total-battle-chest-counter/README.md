# 🎮 Total Battle Chest Counter

An automated chest tracking system for Total Battle game with cloud database integration. Capture chests from screen, process EOD reports, and upload to Supabase - all in one streamlined workflow!

## ✨ Features

- **🖱️ Auto-Calibration**: Click corners to set capture area and mouse position
- **📸 Smart OCR**: Capture chest data from game screen with error correction
- **🔄 Session Management**: Remember settings, track progress across multiple rounds
- **📊 EOD Processing**: Generate CSV reports with scoring and validation
- **☁️ Cloud Integration**: Automatic upload to Supabase database
- **🌍 UTF-8 Support**: Handle special characters in player names
- **🎯 One-Command Workflow**: From screen capture to cloud database

## 📋 Prerequisites

### System Requirements
- **Windows 10/11** (tested)
- **Python 3.7+**
- **Internet connection** (for Supabase)

### Game Setup
- **Total Battle** game running in browser or app
- **Gifts screen** accessible for chest opening
- **Screen capture area** visible and consistent

## 🚀 Installation

### 1. Install Python Dependencies
```bash
pip install pandas opencv-python pytesseract pillow pyautogui pyperclip pygetwindow supabase
```

### 2. Install Tesseract OCR
- Download from: https://github.com/UB-Mannheim/tesseract/wiki
- Install to default location (usually `C:\Program Files\Tesseract-OCR\`)
- Add to PATH or update `pytesseract.pytesseract.tesseract_cmd` if needed

### 3. Supabase Setup (Optional)
If you want cloud database integration:
1. Create account at https://supabase.com
2. Create new project
3. Create table with this schema:
```sql
create table public.raw_chests (
  id uuid not null default gen_random_uuid (),
  "DATE" text null,
  "PLAYER" text null,
  "SOURCE" text null,
  "CHEST" text null,
  "SCORE" integer null,
  "CLAN" text null,
  updated_at timestamp with time zone null default now(),
  constraint raw_chests_pkey primary key (id)
);
```

### 4. Set Environment Variables
```cmd
set SUPABASE_URL=https://your-project.supabase.co
set SUPABASE_ANON_KEY=your_anon_key_here
```

## ⚙️ Configuration

### 1. Create Your Clan Config
Copy and modify `config/Strike_for_Cake.cfg` with your settings:

```ini
# Data file (cleared after successful upload)
data = data/YourClan.txt

# Directory paths
working = working
final = final
archive = archive

# Configuration files
score = config/scores.csv
players = config/players.yourclan.csv
quality = config/data_quality.csv
fix_ocr = config/fix_ocr.csv

# Clan name (used in file names)
clan = YourClanName

# Screen coordinates (set via calibration)
x1 = 1571
y1 = 815
x2 = 2434
y2 = 1585

# Mouse click coordinates (set via calibration)
mx = 2692
my = 952
```

### 2. Setup Configuration Files

**scores.csv** - Point values for each source:
```csv
Bank,10
Level 10 Citadel,5
Level 15 Citadel,10
Level 20 Citadel,15
Level 25 Citadel,20
Level 30 Citadel,25
Level 20 Tartaros Crypt,25
Level 25 Tartaros Crypt,30
```

**players.yourclan.csv** - Player names and aliases:
```csv
PlayerName,alias1,alias2
John,Jon,J
Mary,Marie,M
```

**data_quality.csv** - OCR error corrections:
```csv
Correct Name,OCR Error 1,OCR Error 2
Wooden Chest,ead Chest,ooden Chest
```

## 🎯 Usage

### Quick Start (One Command)
```bash
# Complete workflow: Capture → EOD → Upload
python bin/tb.py --config config/YourClan.cfg --capture
```

### Individual Operations

**Calibration** (first time setup):
```bash
python bin/tb.py --config config/YourClan.cfg --calibrate
```

**Capture Only**:
```bash
python bin/tb.py --config config/YourClan.cfg --capture
```

**EOD Processing Only**:
```bash
python bin/tb.py --config config/YourClan.cfg --process --eod
```

**Manual Supabase Upload**:
```bash
python bin/supabase_uploader.py final/TB_Chests_YourClan_2025-08-28_FINAL.csv
```

## 🔄 Streamlined Workflow

The new integrated workflow handles everything in one session:

```
python bin/tb.py --config config/YourClan.cfg --capture

### Starting capture session ###
Auto-accept all new players? (y/n): y
Remember this choice for this session? (y/n): y

Enter chests to collect: 20
[Captures 20 chests with auto-clicking]

Continue capturing more chests? (y/n): y
### Total chests collected this session: 20 ###

Enter chests to collect: 15
[Captures 15 more chests - no more prompts needed!]

Continue capturing more chests? (y/n): n
Create EOD report now? (y/n): y
[Processes EOD report]

Upload to Supabase? (y/n): y
[Uploads to cloud database and clears source file]

### Session Complete ###
### Total chests collected this session: 35 ###
```

## 📁 Project Structure

```
total-battle-chest-counter/
├── bin/
│   ├── tb.py                    # Main application
│   ├── supabase_uploader.py     # Cloud upload utility
│   ├── supabase_test.py         # Upload testing
│   └── csv_test.py              # CSV validation
├── config/
│   ├── Strike_for_Cake.cfg      # Example config
│   ├── scores.csv               # Point values
│   ├── players.strike_for_cake.csv # Player names
│   ├── data_quality.csv         # OCR corrections
│   └── fix_ocr.csv              # Advanced OCR fixes
├── data/
│   └── YourClan.txt             # Raw capture data (auto-cleared)
├── working/
│   └── [debug files]            # Temporary processing files
├── final/
│   └── [EOD CSV files]          # Processed reports
├── archive/
│   └── [backup files]           # Historical data
├── README.md                    # This file
├── SUPABASE_SETUP.md           # Cloud setup guide
└── test_workflow.md            # Workflow testing guide
```

## 🛠️ Advanced Features

### Session Management
- **Auto-accept memory**: Remember new player handling preference
- **Progress tracking**: Shows total chests across multiple rounds
- **Continuous capture**: Multiple rounds without restarting

### Error Handling
- **OCR corrections**: Automatic fixing of common misreads
- **Encoding detection**: Handles UTF-8, Windows-1252, etc.
- **Special formats**: Tartaros Crypt level parsing
- **Validation warnings**: Alerts for missing scores or unknown players

### Cloud Integration
- **Batch uploads**: 100 records per batch for reliability
- **UTF-8 support**: International character handling
- **Upload verification**: Confirms successful database insertion
- **File management**: Auto-backup and clear source files

## 🔧 Troubleshooting

### OCR Issues
- **Calibrate capture area**: Make sure only text is captured, no graphics
- **Check lighting**: Consistent screen brightness helps OCR accuracy
- **Add to data_quality.csv**: Map common OCR errors to correct values

### Supabase Connection
- **Check credentials**: Verify SUPABASE_URL and SUPABASE_ANON_KEY
- **Table permissions**: Ensure INSERT permissions for anon role
- **Network**: Confirm internet connection

### File Paths
- **Relative paths**: All paths in config are relative to project root
- **Directory creation**: Script will create missing directories
- **Permissions**: Ensure write access to all directories

## 📊 Data Flow

1. **Screen Capture** → Raw OCR text
2. **OCR Processing** → Structured chest data  
3. **Validation** → Player/chest verification
4. **EOD Processing** → Scored CSV reports
5. **Cloud Upload** → Supabase database
6. **File Management** → Archive and cleanup

## 🤝 Contributing

To add new features or fix bugs:
1. All main code is in `bin/tb.py`
2. Configuration files are in `config/`
3. Test with `csv_test.py` and `supabase_test.py`
4. Follow existing code patterns and add comments

## 📝 Notes

- **OCR Accuracy**: Depends on screen consistency and capture area setup
- **Tartaros Events**: Special handling for "Tartaros Crypt level X" format
- **Player Management**: Auto-adds unknown players with confirmation
- **Scoring**: Chest sources need entries in scores.csv for point calculation

## 🎮 Happy Chest Hunting!

This system automates the tedious parts so you can focus on the game. Capture, process, and analyze your chest data with minimal effort!

For questions or issues, check the troubleshooting section or review the configuration files.