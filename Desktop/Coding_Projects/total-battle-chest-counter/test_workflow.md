# 🚀 **Streamlined Capture Workflow Test Guide**

## **New Single-Command Workflow**

### **Command:**
```cmd
cd C:\Users\paoco\Desktop\Coding_Projects\total-battle-chest-counter
python bin\tb.py --config config\Strike_for_Cake.cfg --capture
```

## **Expected Flow:**

### **Step 1: Initial Setup**
```
### Starting capture session ###
Auto-accept all new players without confirmation? (y/n, default=n): y
Remember this choice for this session? (y/n): y
### Choice remembered: Auto-accept enabled for this session
Enter the total number of chests you want to collect ('-' to exit): 12
```

### **Step 2: First Round Capture**
```
Taking a screenshot...
[captures 12 chests with auto-clicking]

### Round Complete ###
### Total chests collected this session: 12 ###
Continue capturing more chests? (y/n): y
```

### **Step 3: Additional Rounds (No More Auto-Accept Prompts)**
```
### Total chests collected this session: 12 ###
Enter the total number of chests you want to collect ('-' to exit): 8
### Using remembered setting: Auto-accept enabled for new players

Taking a screenshot...
[captures 8 more chests]

### Round Complete ###  
### Total chests collected this session: 20 ###
Continue capturing more chests? (y/n): n
```

### **Step 4: Integrated EOD Processing**
```
Create EOD report now? (y/n): y

### Starting EOD Processing ###
Processed 20 records from 60 source lines

### End of Day processing for 2025-08-28 10:30:45
### Saved processed data file: final/TB_Chests_Strike_for_Cake_2025-08-28_10.30.45_FINAL.csv

### EOD Processing Complete ###
### Generated CSV file: final/TB_Chests_Strike_for_Cake_2025-08-28_10.30.45_FINAL.csv
Upload this EOD report to Supabase? (y/n): y
```

### **Step 5: Supabase Upload**
```
🚀 Starting EOD upload to Supabase
📁 CSV loaded: 20 rows (encoding: windows-1252)
✅ Connected to Supabase
📦 Prepared 20 records for upload
📤 Uploading to 'raw_chests' in 1 batches of 100...
✅ Batch 1/1: 20 records uploaded
🎉 Successfully uploaded 20 records to raw_chests
✅ Upload verification successful
✅ Source file cleared successfully

### Session Complete ###
### Total chests collected this session: 20 ###
### Capture session completed successfully ###
```

## **Key Improvements:**

✅ **Session Memory**: Auto-accept choice remembered throughout session
✅ **Continuous Capture**: Multiple rounds without restarting script  
✅ **Session Tracking**: Shows total chests collected across all rounds
✅ **Integrated EOD**: Seamless transition from capture to processing
✅ **Complete Automation**: One command from start to Supabase upload
✅ **User-Friendly**: Clear prompts and session summaries

## **Benefits:**

- **Single Command**: `--capture` handles everything start to finish
- **No Repetitive Prompts**: Settings remembered during session
- **Flexible Rounds**: Capture different amounts in each round
- **Session Awareness**: Always shows total progress
- **Seamless Integration**: Smooth transition to EOD and upload
- **Complete Automation**: From screen capture to cloud database

## **Usage Scenarios:**

### **Quick Session (20 chests total)**
```cmd
python bin\tb.py --config config\Strike_for_Cake.cfg --capture
# One round of 20 chests → EOD → Upload → Done
```

### **Extended Session (multiple rounds)**  
```cmd
python bin\tb.py --config config\Strike_for_Cake.cfg --capture
# Round 1: 12 chests → Continue? Yes
# Round 2: 8 chests → Continue? Yes  
# Round 3: 15 chests → Continue? No → EOD → Upload → Done
```

This creates the ultimate streamlined workflow from capture to cloud database!