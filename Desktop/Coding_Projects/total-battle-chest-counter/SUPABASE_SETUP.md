# Supabase Integration Setup

## Overview
The Total Battle Chest Counter now supports automatic upload to Supabase cloud database after EOD processing.

## Prerequisites

### 1. Install Supabase Client
```bash
pip install supabase pandas
```

### 2. Set Environment Variables
You need to set your Supabase project credentials as environment variables.

**Windows (Command Prompt):**
```cmd
set SUPABASE_URL=https://your-project.supabase.co
set SUPABASE_ANON_KEY=your_anon_key_here
```

**Windows (PowerShell):**
```powershell
$env:SUPABASE_URL="https://your-project.supabase.co"
$env:SUPABASE_ANON_KEY="your_anon_key_here"
```

**Linux/Mac:**
```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_ANON_KEY="your_anon_key_here"
```

### 3. Database Table
The production table `raw_chests` should have this schema:
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

## Usage

### Integrated EOD Processing
When you run EOD processing with tb.py, you'll now see a prompt after successful processing:

```bash
python tb.py --config your_config.cfg --process --eod
```

After successful EOD processing, you'll see:
```
### EOD Processing Complete ###
### Generated CSV file: /path/to/TB_Chests_YourClan_20250825_FINAL.csv
Upload this EOD report to Supabase? (y/n): 
```

If you choose 'y':
- Data will be uploaded to the `raw_chests` table
- Source .txt file will be backed up and cleared
- Upload progress will be shown
- Success/failure messages will be displayed

### Standalone Upload
You can also upload CSV files directly:

```bash
# Auto-detect latest EOD CSV
python supabase_uploader.py

# Upload specific file
python supabase_uploader.py TB_Chests_YourClan_20250825_FINAL.csv

# Upload and clear source file
python supabase_uploader.py TB_Chests_YourClan_20250825_FINAL.csv /path/to/source.txt
```

## Features

### ✅ What Gets Uploaded
- All EOD data with proper UTF-8 encoding
- Special characters in player names (like "aghaté tyché")
- Date, Player, Source, Chest, Score, Clan information
- Automatic timestamp tracking

### ✅ Safety Features
- Source file is backed up before clearing
- Upload verification checks
- Batch processing (100 records at a time)
- Comprehensive error logging
- Only clears source file after successful upload

### ✅ Logging
All upload activity is logged to `supabase_upload.log` with:
- Connection status
- Upload progress
- Error details
- Verification results

## Troubleshooting

### Common Issues

**"Supabase uploader not available"**
- Install supabase: `pip install supabase`
- Verify environment variables are set

**"Missing Supabase credentials"**
- Check SUPABASE_URL and SUPABASE_ANON_KEY are set
- Find these in your Supabase project settings > API

**"Upload verification failed"**
- Data may still be uploaded successfully
- Check Supabase dashboard to verify
- Review `supabase_upload.log` for details

**"Failed to clear source file"**
- Upload was successful but file cleanup failed
- Manual cleanup may be needed
- Check file permissions

### Log Files
- `supabase_upload.log` - Detailed upload logs
- Source files backed up as `.backup.YYYYMMDD_HHMMSS`

## Workflow Summary

1. **Run EOD Processing**: `python tb.py --config config.cfg --process --eod`
2. **Processing Completes**: CSV file generated in `/final` directory
3. **Upload Prompt**: Choose to upload to Supabase (y/n)
4. **If Yes**: 
   - Data uploads to `raw_chests` table
   - Source file gets backed up and cleared
   - Upload verification runs
5. **Success**: Data is in the cloud, local files cleaned up

This integration eliminates manual CSV uploads while keeping your local workflow intact.