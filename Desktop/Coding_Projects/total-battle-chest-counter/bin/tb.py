#!/usr/bin/env python3
"""
Total Battle Chest Counter - Automated Chest Tracking System
=============================================================

This system provides end-to-end automation for tracking chest collections in Total Battle:

WORKFLOW:
1. Screen Capture: Uses OCR to read chest data from game screen
2. Data Processing: Validates players, chests, sources with error correction  
3. EOD Reports: Generates scored CSV reports with point calculations
4. Cloud Upload: Automatically uploads to Supabase database
5. File Management: Archives data and clears source files

KEY FEATURES:
- Session Management: Remember settings across multiple capture rounds
- Smart OCR: Handles text variations, encoding issues, special formats
- Auto-Calibration: Click-and-set screen coordinates and mouse positions
- Integrated Workflow: Single command from capture to cloud database
- UTF-8 Support: International characters in player names
- Error Recovery: OCR corrections, validation warnings, retry logic

MAIN COMPONENTS:
- TBConfig: Configuration file parsing and path management
- TBScreen: Screen capture and OCR processing with image preprocessing  
- TBPlayer: Player name validation with fuzzy matching and aliases
- TBChest: Chest name validation with OCR error corrections
- TBSource: Source validation with special format handling (e.g. Tartaros)
- TBScore: Point calculation based on chest sources
- TBSession: Session state management for streamlined workflow
- TBCalibration: Interactive screen coordinate and mouse position setup
- TBCapture: Main capture workflow with session management
- TBProcess: EOD processing with scoring and report generation

USAGE:
- Calibration: python tb.py --config clan.cfg --calibrate
- Capture: python tb.py --config clan.cfg --capture  
- EOD Only: python tb.py --config clan.cfg --process --eod
- Full Workflow: python tb.py --config clan.cfg --capture (recommended)

The system is designed for minimal user interaction while maintaining full control
and visibility over the data processing pipeline.
"""

import os
import argparse
import shutil
import glob
import pyperclip as clipboard
from datetime import datetime
from datetime import timedelta
from difflib import SequenceMatcher as SM
import time
import cv2
import numpy
import pytesseract
from PIL import ImageGrab
import pyautogui, sys
import pygetwindow

# Import supabase uploader (with error handling for missing dependency)
try:
    from supabase_uploader import upload_eod_to_supabase
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False

# TBConfig ------------------------------------------------------------------------------------------------------
class TBConfig(object):
    """ This class parses configuration parameters from the configuration file """
# ------------------------------------------------------------------------------------------------------
    def __init__(self, config_file, clickWait):
        
        self.config_file = config_file
        config_kvp = {}

        try:

            with open(config_file) as cfp:
                for cl, config_line in enumerate(cfp):
                
                    kvp_string = config_line.strip()
                    if len(kvp_string) == 0 or kvp_string.find("#") > -1: # ignore empty lines and comments in config file
                        continue
                
                    kvp = kvp_string.split("=")
                    config_kvp[kvp[0].strip()] = kvp[1].strip()
        except:
            print("### FATAL ERROR: Unable to open or read the configuration file: {}").format(config_file)
            exit()
        else:
            self.datafile        = config_kvp.get('data','')
            self.working_dir     = config_kvp.get("working", '')
            self.archive_dir     = config_kvp.get("archive", '')
            self.final_dir       = config_kvp.get("final", '')
            self.player_file     = config_kvp.get('players', '')
            self.clan            = config_kvp.get('clan', '')
            self.quality_file    = config_kvp.get('quality', '')
            self.score_file      = config_kvp.get('score', '')
            self.fix_ocr_file    = config_kvp.get('fix_ocr', '')
            self.x1              = config_kvp.get('x1', '')
            self.y1              = config_kvp.get('y1', '')
            self.x2              = config_kvp.get('x2', '')
            self.y2              = config_kvp.get('y2', '')
            self.mx              = config_kvp.get('mx', '')
            self.my              = config_kvp.get('my', '')
            self.clickWait       = config_kvp.get('clickWait', clickWait)

        if not self.datafile:
            print("### No data file repository defined. Cannot proceed!")
            exit()
# TBConfig------------------------------------------------------------------------------------------------------

# TBScreen ------------------------------------------------------------------------------------------------------
class TBScreen(object):
    """ This class takes the screen capture and runs the OCR processing, and contains image processing functions """
# ------------------------------------------------------------------------------------------------------
#   def init__(self):
 
# ------------------------------------------------------------------------------------------------------
    def get_screenshot(self, x, y, dx, dy):
        image = ImageGrab.grab(bbox=(int(x), int(y), int(dx), int(dy)))
        return image
# ------------------------------------------------------------------------------------------------------
    def get_grayscale(self,img):
        return cv2.cvtColor( img, cv2.COLOR_RGB2GRAY)
# ------------------------------------------------------------------------------------------------------
    def remove_noise(self,img):
        return cv2.medianBlur(img, 5)
# ------------------------------------------------------------------------------------------------------
    def thresholding(self,img):
        return cv2.threshold( img, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]
# ------------------------------------------------------------------------------------------------------
    def ocr_core(self,img):
        text = pytesseract.image_to_string(img, lang='eng', config='--psm 12 --oem 1')
        return text
# TBScreen ------------------------------------------------------------------------------------------------------

# TBFixOCR ------------------------------------------------------------------------------------------------------
class TBFixOCR(object):
    """ This class will attempt to fix known 2-line OCR capture issues. 
        The format in the config file should be:
        CorrectValue, IncorrectFirstine, IncorrectSecondLine
    """
# ------------------------------------------------------------------------------------------------------
    def __init__(self, fix_ocr_file):

        self.fixed = {}
        self.fix_ocr = {}


        if fix_ocr_file:
            with open(fix_ocr_file) as fp:
                for cmt, fix_line in enumerate(fp):
                    fix_string = fix_line.strip( " \n")
                    if fix_string == "":
                        continue
                    kvp = fix_string.split(",")

                    self.fixed[kvp[1].lower()] = kvp[0]
                    self.fix_ocr[kvp[1].lower()] = kvp[2]
        else:
            print("### No OCR Fix configration file")

# -------------------------------------------------------------------------------
    def fix(self, line1, line2):
        # Define unwanted lines
        unwanted_lines = {"fPantaime. iaamaria lel","oe", "=", "|",", ee, ee","tae,","i? Bits","~a","es ae","MB:","Sp ee rg","ASS See",")","aE, — a","pS Se,","Fen","pai","pai","Fnealas: fuese Cid to","i","re",". won","ees oa","ee ade","De we","PR! Pa","aT ee es","ae ea","Contains Siheee","Pare ee tee","Paar ee es","Pn ee ee","omeeine olen Fite","~","-nnenine Maamne Pital.","are ee teh","nee eae", "——_", "——", "|", "-", "a", "_", ".", "__", "—","a oe","ie","fir! Be","ee re","ete ae 2 ae","tS See T","(ee","==","ee","See","7S","PR,","eee","Ae","aie","L","5","LL, Ya Ge","> a oe","°","ri","Le Ye oe","| = Soe","in neeine Cihees","a ee","Re Me ey A","a neeine Canned Bi","a ns","eo neeine oles Fite","i enine Anca Neh","in nenine Maen Fital.","“nnenins. Bhosnix Fdathar","*","yee ee eee", "7 ee ee ee", "Oantsainc. lreathevnad Slack", "fontaine. DBhantann lean Clee", "fPantaime. Craetrn| bk ieee", "Pantaine. Civanm Taank", "Pantainc. lism Fiean", "Pantaime.", "tenn, Pienaar, Gee", "yee ee eee", "orarntainc. falda", "yee ee eee","fPantaime. Munaat C1 een eee hee.","fPantaime. Dateifiasl Mea wwe tle","Oantsainc,. Cand","Fee ee ee eee ee"}

        # Debugging: Print the lines being checked
        print(f"Checking lines for unwanted patterns: '{line1}' and '{line2}'")

        # Ignore lines if they match unwanted patterns
        if line1.strip() in unwanted_lines or line2.strip() in unwanted_lines:
            print(f"Skipping unwanted line(s): '{line1}' or '{line2}'")
            return ""

        # Proceed with normal fix logic
        if self.fix_ocr.get(line1.lower()) is None:
            print(f"No fix found for: '{line1}' and '{line2}'")
            return ""
        elif self.fix_ocr[line1.lower()] == line2:
            print(f"Fix applied: Correcting '{line1}' and '{line2}' to '{self.fixed.get(line1.lower())}'")
            return self.fixed.get(line1.lower())
        else:
            return ""
# TBFixOCR ------------------------------------------------------------------------------------------------------

# TBPlayer ------------------------------------------------------------------------------------------------------
class TBPlayer(object):
    """ This class parses PLAYER configuration parameters and validates player names captured by the OCR """
# ------------------------------------------------------------------------------------------------------
    def __init__(self, player_file):

        self.player_file = player_file
        self.player_set = set()
        self.player_kvp = {}
        self.player_set_changed = False
        self.new_players = []
        self.auto_accept = False

        if player_file:
            with open(player_file) as pfp:
                for cmt, player_line in enumerate(pfp):
                    kvp_string = player_line.strip()
                    kvp = kvp_string.split(",")

                    self.player_set.add(kvp[0])
                    self.player_kvp[kvp[0].lower()] = kvp[0]

                    for player_alias in kvp[1:]:
                        self.player_kvp[player_alias.lower()] = kvp[0]

# -------------------------------------------------------------------------------
    def show_new_players_summary(self):
        if len(self.new_players) > 0:
            print("\n### New Players Added This Session:")
            for player in self.new_players:
                print("  - {}".format(player))
            print("### Total new players: {}".format(len(self.new_players)))
        else:
            print("\n### No new players were added this session.")

# -------------------------------------------------------------------------------
    def save(self):

        if self.player_set_changed and self.player_file:

            while True:
                save = input("\n### Player information has been updated during processing. Do you want to save it to the same file (<Enter>/n) ? ")
                if len(save) == 0 or save == "y" or save == "n":
                    break

            if len(save) == 0 or save == "y":
                with open( self.player_file,'w') as pfp:

                    sorted_players = sorted(self.player_set)
                    for player in sorted_players:
                        player_line = player

                        for alias in self.player_kvp:
                            if player == self.player_kvp[alias]:
                                player_line += "," + alias

                        player_line += "\n"

                        pfp.writelines(player_line)

                print("Updated player information has been saved to {}".format(self.player_file))

# -------------------------------------------------------------------------------
    def validate(self, player, line):
        
        # assume success...
        success = True

        if player in self.player_set: # avoid the error when the record contains only a player name but one that is correct
            print("Record is malformed but consists of a correct player name {} so processing can continue.".format(player))

        else:
            splitter = ""

            # check all since the OCR sometimes gets it wrong
            if player.find(":") > -1 or player.find(";") > -1 or player.find(".") > -1 or player.find(",") > -1:
                if player.find(":") > -1:
                    splitter = ":"
                elif player.find(";") > -1:
                    splitter = ";"
                elif player.find(".") > -1:
                    splitter = "."
                elif player.find(",") > -1:
                    splitter = ","

            if splitter == "": # none of the above chars were found in the string

                if not player.lower().startswith("fr") and not player.startswith("ro") and not player.startswith("om"):

                    print("*** ERROR: Malformed record '{}' at line {} - it should have the format 'From : PlayerName'".format(player, line))
                    success = False

                elif player.lower().find("fr ") > -1 or player.lower().find("ro ") > -1 or player.find("om ") > -1:
                    splitter = " "
                else:
                    print("*** ERROR: Malformed record '{}' at line {} - it should have the format 'From : PlayerName'".format(player, line))
                    success = False

            split_player = player.split(splitter, 1)
            player = split_player[1].strip()

        # handle OCR issues with player names
        if player.endswith('.'):
            player = player.replace('.','')

        # player name not in players file or malformed by OCR
        if player not in self.player_set:

            # attempt a fuzzy match
            best_score = 0
            best_string = ""

            for tmp_player in self.player_set:
                        
                tmp_score = SM(None, player, tmp_player).ratio()
                if tmp_score > best_score:
                    best_string = tmp_player
                    best_score = tmp_score

            if best_score > 0.75:
                print("Player {} mapped to {} triggered by FUZZY MATCH: {}".format(player, best_string, best_score))
                player = best_string # set player to the best matched string

            else:
                # look in alias map
                tmp_player = self.player_kvp.get(player.lower())

                if tmp_player == None: # alias for this player is not defined
                    print("*** ERROR: Unknown player name '{}' at line {} - this should be added to the players file".format(player, line))

                    if self.auto_accept:
                        player_name = ""
                        save_alias = "y"
                        print("Auto-accepting new player: '{}'".format(player))
                    else:
                        player_name = input("\nEnter the correct name for the player (hit <Enter>) if '{}' is correct or '-' to stop processing): ".format(player)).strip()
                        
                    if player_name == "-":
                        success = False
                    else:
                        player_alias = player

                        if len(player_name) > 0:
                            player = player_name
 
                        if player not in self.player_set:
                            self.player_set_changed = True
                            self.player_set.add(player)
                            self.new_players.append(player)

                        if player_alias not in self.player_kvp:
                            if not self.auto_accept:
                                save_alias = "y"

                                if player_alias != player: # only ask if the alias is different from the player name
                                    while True:
                                        save_alias = input("Is '{}' a good alias to save for {} (<Enter>/n, '-' to exit) ? ".format(player_alias, player)).strip()
                                        if save_alias == "n" or save_alias == "-" or len(save_alias) == 0:
                                            break
                            else:
                                save_alias = ""

                            if len(save_alias) == 0 or save_alias == "y":
                                self.player_kvp[player_alias.lower()] = player
                                self.player_set_changed = True
                            elif save_alias == "-":
                                success = False

                else:
                    print("Player {} mapped to {} triggered by PLAYER ALIAS: {}".format(player, tmp_player, player.lower()))
                    player = tmp_player # set player to the correct string

        return success, player
# TBPlayer ------------------------------------------------------------------------------------------------------

# TBChest ------------------------------------------------------------------------------------------------------
class TBChest(object):
    """ This class parses CHEST configuration parameters and validates chest names captured by the OCR """
# ------------------------------------------------------------------------------------------------------
    def __init__(self, quality_file):

        self.quality_kvp = {}

        if quality_file:
            with open(quality_file) as qfp:
                for cmt, quality_line in enumerate(qfp):
                    kvp_string = quality_line.rstrip('\n')
                    kvp = kvp_string.split(",")
                    for player_alias in kvp[1:]:
                        self.quality_kvp[player_alias] = kvp[0]

# ------------------------------------------------------------------------------------------------------
    def validate(self, chest):

        # fix lowercase issue that happens too often
        chest = chest.replace("orc ", "Orc ")
        #remove , which should never be in a chest name
        chest = chest.replace(",", "")
        #remove . which should never be in a chest name
        chest = chest.replace(".", "")
        #remove ; which should never be in a chest name
        chest = chest.replace(";", "")

        # add some processing to fix bad OCR scanning of chest names
        match = False
        for quality_line in self.quality_kvp:
            if chest.find(quality_line) > -1:
                if chest != self.quality_kvp[quality_line]:
                    print("Chest name match: {} = {} triggered by {}".format(chest,self.quality_kvp[quality_line],quality_line))

                chest = self.quality_kvp[quality_line]
                match = True
                break

        if not match:
            # More stuff to fix bad OCR captures
            if chest.startswith("lven"):
                chest = "E" + chest
            elif chest.startswith("ven"):
                chest = "El" + chest
            elif chest.startswith("ursed"):
                chest = "C" + chest
            elif chest.startswith("rsed"):
                chest = "Cu" + chest

            if chest.lower().endswith("ch"):
                chest += "est"
            elif chest.lower().endswith("che"):
                chest += "st"
            elif chest.lower().endswith("ches"):
                chest += "t"

            # fix lowercase issue that sometimes happen
            chest = chest.replace("chest", "Chest")

        return chest
# TBChest ------------------------------------------------------------------------------------------------------

# TBSource ------------------------------------------------------------------------------------------------------
class TBSource(object):
    """ This class validates chest SOURCE information captured by the OCR """
# ------------------------------------------------------------------------------------------------------    
    def validate(self, source, line):
        
        success = True

        # Error checking in case of crappy OCR - support both English and Spanish
        english_variants = ["Source", "source", "ource", "urce", "rce", "ce"]
        spanish_variants = ["Fuente", "fuente", "uente", "ente", "nte", "te"]
        
        valid_start = False
        for variant in english_variants + spanish_variants:
            if source.startswith(variant):
                valid_start = True
                break
        
        if not valid_start:
            print("*** ERROR: Malformed record '{}' at line {} - it should have the format 'Source : Bank/Crypt/Chest/...' or 'Fuente: Banco/Cripta/Cofre/...'".format(source, line))
            return False, source

        # check all since the OCR sometimes gets it wrong
        if source.find(":") > -1 or source.find(";") > -1 or source.find(".") > -1 or source.find(",") > -1:
            if source.find(":") > -1:
                splitter = ":"
            elif source.find(";") > -1:
                splitter = ";"
            elif source.find(".") > -1:
                splitter = "."
            elif source.find(",") > -1:
                splitter = ","
        else:
            # extra checks to work around kinks in the OCR software and allow automated processing
            if source.find("Source ") or source.find("ource ") or source.find("urce ") or source.find("rce ") or source.find("ce "):
                splitter = " "
            else:
                print("*** ERROR: Malformed record '{}' at line {} - it should have the format 'Source : Bank/Crypt/Chest'".format(source, line))
                return False, source

        split_source = source.split(splitter, 1)
        source = split_source[1].strip()

        # SPANISH TO ENGLISH TRANSLATION: Handle game in Spanish language
        spanish_translations = {
            "ciudadela de nivel": "level citadel",
            "ciudadela": "citadel", 
            "cripta de nivel": "level crypt",
            "cripta": "crypt",
            "banco": "bank",
            "cofre": "chest",
            "tesoro": "treasure",
            "élfica": "elven",
            "maldita": "cursed",
            "nivel": "level"
        }
        
        source_lower = source.lower()
        for spanish_term, english_term in spanish_translations.items():
            if spanish_term in source_lower:
                source = source_lower.replace(spanish_term, english_term)
                print(f"### Spanish translation applied: {source}")
                break

        # add some processing to fix bad OCR scanning of chest names

        # SPECIAL CASE: Tartaros Crypt Format Conversion
        # Problem: Tartaros events display as "Tartaros Crypt level 20" instead of "Level 20 Crypt"
        # Solution: Convert to standard format so scoring works with existing scores.csv entries
        # "Tartaros Crypt level 20" -> "Level 20 Tartaros Crypt"
        if source.lower().startswith("tartaros crypt level"):
            parts = source.split()
            if len(parts) >= 4 and parts[0].lower() == "tartaros" and parts[1].lower() == "crypt" and parts[2].lower() == "level":
                level_num = parts[3]
                source = f"Level {level_num} Tartaros Crypt"
                print(f"### Converted Tartaros format: {source}")

        pos1 = source.find(" Cr")
        pos2 = source.find(" cr")
        if pos2 > -1 or pos1 > -1:
            if pos2 > -1:
                pos1 = pos2
            source = source[:pos1] + " Crypt"

        # Crypt
        if source.endswith("Cr"):
            source += "ypt"
        elif source.endswith("Cry"):
            source += "pt"
        else:
            if source.endswith("Cryp"):
                source += "t"
        # Chest
        if source.endswith("Ch"):
            source += "est"
        elif source.endswith("Che"):
            source += "st"
        elif source.endswith("Ches"):
            source += "t"

        # Clan wealth
        if source.endswith("wea"):
            source += "lth"
        elif source.endswith("weal"):
            source += "th"
        elif source.endswith("wealt"):
            source += "h"

        # Monster
        if source.endswith("Mons"):
            source += "ter"
        elif source.endswith("Monst"):
            source += "er"
        elif source.endswith("Monste"):
            source += "r"

        # Citadel
        if source.endswith("Ci"):
            source += "tadel"
        elif source.endswith("Cit"):
            source += "adel"
        elif source.endswith("Cita"):
            source += "del"
        elif source.endswith("Citad"):
            source += "el"
        elif source.endswith("Citade"):
            source += "l"

        # Authority Rush tournament
        if source.endswith("tourna"):
            source += "ment"
        elif source.endswith("tournam"):
            source += "ent"
        elif source.endswith("tourname"):
            source += "nt"
        elif source.endswith("tournamen"):
            source += "t"

        # Bank                    
        if source.endswith("Ba"):
            source += "nk"
        elif source.endswith("Ban"):
            source += "k"

        source = source.replace("crypt", "Crypt")
        source = source.replace("chest", "Chest")
        source = source.replace("citadel", "Citadel")
        source = source.replace("monster", "Monster")
            
        return True, source
# TBSource ------------------------------------------------------------------------------------------------------

# TBScore ------------------------------------------------------------------------------------------------------
class TBScore(object):
    """ This class contains and calculates chest scores """
# ------------------------------------------------------------------------------------------------------    
    def __init__(self, score_file):

        self.convert_chest_to_source = {"bank","ban","ba","clash for the throne tournament"}

        self.score_kvp = {}
        self.no_score = set()

        if score_file:
            with open(score_file) as sfp:
                for cmt, score_line in enumerate(sfp):
                    kvp_string = score_line.strip()
                    kvp = kvp_string.split(",")
                    self.score_kvp[kvp[0].lower()] = kvp[1]
# ------------------------------------------------------------------------------------------------------
    def calculate(self, source, chest, player, line):
        
        if source.lower() in self.convert_chest_to_source:
            switch_chest_and_source = True
            tmp_source = source.lower()
            source = chest
            if tmp_source.find("throne") > -1:
                chest = "Clash for the Throne tournament"
            else:
                chest = 'Bank'

        score = "0"

        if chest == "Cursed Citadel Chest":
            split_source = source.split(" ")
            citadel_level = split_source[1]
            source = "Level " + citadel_level + " cursed Citadel"

        temp_score = self.score_kvp.get(source.lower())
                    
        if temp_score != None:                    
            score = temp_score
        else:
            print("*** Warning at line {}: No score for {}, {}, {}".format( line, player, source, chest ))
            self.no_score.add(source)

        return score
# ------------------------------------------------------------------------------------------------------
    def print_no_scores(self):
        if len(self.no_score) > 0:
            print("\n*** Warning: The following chest types have no score assigned:")
            for chest in self.no_score:
                print(chest)
# TBScore ------------------------------------------------------------------------------------------------------

# TBSession ------------------------------------------------------------------------------------------------------
class TBSession(object):
    """ 
    Session State Management for Streamlined Capture Workflow
    
    Handles:
    - Auto-accept preference memory across multiple capture rounds
    - Session-wide chest counting and progress tracking  
    - Session lifecycle management (active/complete states)
    
    This enables the "magic" single-command workflow where settings are
    remembered throughout the session, eliminating repetitive prompts.
    """
# ------------------------------------------------------------------------------------------------------
    def __init__(self):
        # Auto-accept settings for new players
        self.auto_accept_set = False        # Has user been prompted yet?
        self.auto_accept_choice = False     # User's y/n choice
        self.remember_auto_accept = False   # Should we remember for session?
        
        # Session progress tracking
        self.total_session_chests = 0       # Total chests across all rounds
        self.session_active = True          # Is session still running?
        
    def set_auto_accept(self, choice, remember=False):
        """Set auto-accept preference for the session"""
        self.auto_accept_choice = choice
        self.auto_accept_set = True
        self.remember_auto_accept = remember
        
    def should_prompt_auto_accept(self):
        """Check if we should prompt for auto-accept setting"""
        return not (self.auto_accept_set and self.remember_auto_accept)
        
    def add_captured_chests(self, count):
        """Track total chests captured in this session"""
        self.total_session_chests += count
        
    def get_session_summary(self):
        """Get summary of session activity"""
        return f"Total chests collected this session: {self.total_session_chests}"
# TBSession ------------------------------------------------------------------------------------------------------

# TBCalibration ------------------------------------------------------------------------------------------------------
class TBCalibration(object):
    """ This class handles the setup of the parameters needed to capture the correct screen image and where to click the mouse """
# ------------------------------------------------------------------------------------------------------    
    def __init__(self, config):
        self.screen = TBScreen()
        self.config = config
        self.config_file = config.config_file

# ------------------------------------------------------------------------------------------------------
    def update_config_file(self, x1, y1, x2, y2, mx=None, my=None):
        """Update the config file with new calibration coordinates"""
        try:
            # Read the current config file
            with open(self.config_file, 'r') as f:
                lines = f.readlines()
            
            # Update the coordinate lines
            updated_lines = []
            for line in lines:
                if line.strip().startswith('x1'):
                    updated_lines.append(f"x1       = {x1}\n")
                elif line.strip().startswith('y1'):
                    updated_lines.append(f"y1       = {y1}\n")
                elif line.strip().startswith('x2'):
                    updated_lines.append(f"x2       = {x2}\n")
                elif line.strip().startswith('y2'):
                    updated_lines.append(f"y2       = {y2}\n")
                elif mx is not None and line.strip().startswith('mx'):
                    updated_lines.append(f"mx       = {mx}\n")
                elif my is not None and line.strip().startswith('my'):
                    updated_lines.append(f"my       = {my}\n")
                else:
                    updated_lines.append(line)
            
            # Write back to the config file
            with open(self.config_file, 'w') as f:
                f.writelines(updated_lines)
            
            print(f"### Config file updated: {self.config_file}")
            return True
        except Exception as e:
            print(f"### Error updating config file: {e}")
            return False

# ------------------------------------------------------------------------------------------------------
    def run(self):
        print( "### SCREEN CAPTURE AND MOUSE CLICK CALIBRATION MODE ###")

        while True:

            choice = ""
            while True:
                choice = input("Calibrate screen capture rectangle (1) or mouse click position (2) (Hit <Enter> to stop calibration) ? ")
                if len(choice) == 0 or choice == "1" or choice == "2" or choice == "-":
                    break

            if len(choice) == 0 or choice == "-": # stop
                break
            elif choice == "1":

                while True:

                    print( "### CALIBRATE CAPTURE RECTANGLE ###")
             
                    pyautogui.moveTo(int(self.config.x1), int(self.config.y1))
                    input("Position the mouse at the UPPER LEFT corner of what you want to capture, then hit <Enter>...")
                    lx, uy = pyautogui.position()
                    print("Your mouse is now at position {}, {}".format(lx, uy))

                    pyautogui.moveTo(int(self.config.x2), int(self.config.y2))
                    input("Position the mouse at the LOWER RIGHT corner of what you want to capture, then hit <Enter>...")
                    rx, ly = pyautogui.position()
                    print("Your mouse is now at position {}, {}".format(rx, ly))

                    x1 = lx
                    y1 = uy
                    x2 = rx
                    y2 = ly

                    print("Taking a calibration screenshot for region ({},{}) ({},{})...".format(x1,y1,x2,y2))
                    image = self.screen.get_screenshot(x1, y1, x2, y2)
                    print("Done!")

                    image.save('TBCalibration_Screenshot.png')

                    print("Some image processing...")
                    image = self.screen.get_grayscale(numpy.array(image))
                    print("Done!")

                    print("Performing OCR analysis...")
                    capture = self.screen.ocr_core(image)
                    print("Done!")

                    print("Captured data in unprocessed format:")
        
                    raw_rows = capture.split("\n")
                    rows = list()
                    # remove empty rows
                    for row in raw_rows:
                        if len(row.strip()) == 0:
                            continue
                        rows.append(row)
                    for row in rows:
                        print(row)
        
                    print("\nScreenshot image saved to TBCalibration_Screenshot.png\n")

                    while True:
                        proceed = input("Are you happy with these coordinates (<Enter>/n) ? ")
                        if proceed == "n" or len(proceed) == 0:
                            break

                    if proceed != "n":
                        break

                print("### LAST USED RECTANGLE COORDINATES: x1={} y1={} x2={} y2={}".format(x1,y1,x2,y2))
                print("### Add this to the capture configuration file:")
                print("x1   = {}".format(x1))
                print("y1   = {}".format(y1))
                print("x2   = {}".format(x2))
                print("y2   = {}".format(y2))
                
                # Ask user if they want to automatically update the config file
                while True:
                    update_config = input("Update config file with these coordinates? (y/n): ").strip().lower()
                    if update_config in ['y', 'n', '']:
                        break
                
                if update_config == 'y' or update_config == '':
                    if self.update_config_file(x1, y1, x2, y2):
                        print("### Configuration file updated successfully!")
                    else:
                        print("### Failed to update configuration file.")

            elif choice == "2": # mouse position calibration for auto clicks

                while True:

                    print( "### CALIBRATE MOUSE CLICK POSITION ###")

                    pyautogui.moveTo(int(self.config.mx), int(self.config.my))
                    input("Position the mouse at the position where you want it to click, then hit <Enter>...")
                    lx, ly = pyautogui.position()
                    print("Your mouse is at position {}, {}".format(lx, ly))

                    mx = lx
                    my = ly

                    click = input("Hit <Enter> to perform a test click, or any other character + <Enter> to skip the click")

                    if len(click) == 0:
                        hwndThis = pygetwindow.getActiveWindow()
                        pyautogui.click(x=int(mx), y=int(my))
                        hwndThis.activate()

                    while True:
                        proceed = input("Are you happy with these mouse click coordinates (<Enter>/n) ? ")
                        if proceed == "n" or len(proceed) == 0:
                            break

                    if proceed != "n":
                        break

                print("### LAST MOUSE CLICK COORDINATES: mx={} my={}".format(mx, my))
                print("### Add this to the capture configuration file to enable clicking:")
                print("mx       = {}".format(mx))
                print("my       = {}".format(my))
                
                # Ask user if they want to automatically update the config file
                while True:
                    update_config = input("Update config file with these coordinates? (y/n): ").strip().lower()
                    if update_config in ['y', 'n', '']:
                        break
                
                if update_config == 'y' or update_config == '':
                    if self.update_config_file(None, None, None, None, mx, my):
                        print("### Configuration file updated successfully!")
                    else:
                        print("### Failed to update configuration file.")
# TBCalibration ------------------------------------------------------------------------------------------------------

# TBCapture ------------------------------------------------------------------------------------------------------
class TBCapture(object):
    """ main class used for capturing chest information from the TB Gift screen """
# ------------------------------------------------------------------------------------------------------
    def __init__(self, config, args):

        self.processing_datetime    = datetime.now().strftime("%Y-%m-%d %H.%M.%S")
        self.debug_mode             = args.verbose
        self.clickWait              = args.clickWait
        self.config                 = config

        self.player_def             = TBPlayer(config.player_file)
        self.auto_accept            = args.auto_accept if hasattr(args, 'auto_accept') else False
        self.player_def.auto_accept = self.auto_accept
        self.chest_def              = TBChest(config.quality_file)
        self.source_def             = TBSource()
        self.screen                 = TBScreen()
        self.fix_ocr_def            = TBFixOCR(config.fix_ocr_file)
        
        # Session management for streamlined workflow
        self.session                = TBSession()

        workfile = config.working_dir + '/TB_Capture_Clean'
        if len(config.clan) > 0:
            workfile += '_' + config.clan
        workfile += '_' + self.processing_datetime
        workfile += '.txt'

        capturefile = config.working_dir + '/TB_Capture_RAW'
        if len(config.clan) > 0:
            capturefile += '_' + config.clan
        capturefile += '_' + self.processing_datetime
        capturefile += '.txt'

        self.wfile = open(workfile, 'w')
        self.sfile = open(config.datafile,'a')
        self.cfile = open(capturefile, 'w')

        self.records = list()
        self.maxClicks   = 0
        self.totalClicks = 0

# ---------------------------------------------------------------------------------------------------------------
    def validate_capture(self, capture, count):

        success = True
        player_set_changed = False

        self.records = list()
        rows = list()

        raw_rows = capture.split("\n")

        self.cfile.writelines("--------------- {} --------------------------\n".format(datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
        # ignore rows containing nothing but one of these chars/strings - OCR issues
        ignore_rows = {"fPantaime. iaamaria lel","=","i eg","Conteine Tar.","14","Pn ae ae 7 By","ee ine Aeon Neth","a neeine Marck Cited at","ear es","A.", "oe","tae,","i? Bits","~a","es ae","MB:","Sp ee rg","ASS See",")","aE, — a","pS Se,","Fen","pai","pai","Fnealas: fuese Cid to","i","re",". won","ees oa","ee ade","De we","PR! Pa","aT ee es","ae ea","Contains Siheee","Pare ee tee","Paar ee es","Pn ee ee","omeeine olen Fite","~","-nnenine Maamne Pital.","are ee teh","nee eae", "——_", "——", "|", "-", "a", "_", ".", "__", "—","a oe","ie","fir! Be","ee re","ete ae 2 ae","tS See T","(ee","==","ee","See","7S","PR,","eee","Ae","aie","L","5","LL, Ya Ge","> a oe","°","ri","Le Ye oe","| = Soe","in neeine Cihees","a ee","Re Me ey A","a neeine Canned Bi","a ns","eo neeine oles Fite","i enine Anca Neh","in nenine Maen Fital.","“nnenins. Bhosnix Fdathar","*","yee ee eee", "7 ee ee ee", "Oantsainc. lreathevnad Slack", "fontaine. DBhantann lean Clee", "fPantaime. Craetrn| bk ieee", "Pantaine. Civanm Taank", "Pantainc. lism Fiean", "Pantaime.", "tenn, Pienaar, Gee", "yee ee eee", "orarntainc. falda", "yee ee eee","fPantaime. Munaat C1 een eee hee.","fPantaime. Dateifiasl Mea wwe tle","Oantsainc,. Cand","Fee ee ee eee ee"}

        # remove empty rows
        for row in raw_rows:
            if len(row.strip()) == 0:
                continue
            # Ignore rows that are exact matches in ignore_rows
            elif row.strip() in ignore_rows:
                print(f"[DEBUG CAPTURE] Ignoring unwanted line: '{row}'")
                continue
            # Ignore rows that contain the word 'contains'
            elif "contains" in row.lower():  # case-insensitive match
                print(f"[DEBUG CAPTURE] Ignoring line containing 'contains': '{row}'")
                continue
            rows.append(row)
            self.cfile.writelines(row + "\n")

        self.cfile.flush()

        if len(rows) % 3 > 0:

            fixed = False
            index = 0
            for row in rows:
                if row == ".": # Sometimes a row with just . is captured
                    rows.pop(index)
                    fixed = True
                    print("Fixed OCR capture issue with just '.'")
                elif row == "An": # Ancient problem
                    rows.remove(row)
                    fixed = True
                    print("Fixed OCR capture issue with Ancient Warrior/Bastion chests")
                    break
                elif row == "Bra" and rows[index+1] == "led Chest": # Braided Chest problem
                    rows[index] = "Braided Chest"
                    rows.pop(index+1)
                    fixed = True
                    print("Fixed OCR capture issue with Braided Chest")
    #                break
                elif row == "Ancient Wai" and rows[index+1].lower().find("chest") > 1: # Ancient Warrior's chest problem
                    rows[index] = "Ancient Warrior's Chest"
                    rows.pop(index+1)
                    fixed = True
                    print("Fixed OCR capture issue with Ancient Warrior's Chest")
                elif row == "Cursed" and rows[index+1].lower().endswith("del chest"): # Cursed Citadel Chest problem
                    rows[index] = "Cursed Citadel Chest"
                    rows.pop(index+1)
                    fixed = True
                    print("Fixed OCR capture issue with Cursed Citadel Chest")
                elif row == "e Chest," or row == "e Chest.": # Fire Chest problem
                    rows[index] = "Fire Chest"
                    fixed = True
                    print("Fixed OCR capture issue with Fire Chest")
                else:
                    if index < len(rows) - 1:
                        tmp = self.fix_ocr_def.fix(rows[index], rows[index+1])
                        if index < len(rows) - 1:
                            # Debugging: Log the rows being validated
                            print(f"Validating rows: '{rows[index]}' and '{rows[index+1]}'")
                            
                            tmp = self.fix_ocr_def.fix(rows[index], rows[index+1])
                            if tmp != "":
                                rows[index] = tmp
                                rows.pop(index+1)
                                print(f"Fixed OCR issue: Replaced '{rows[index]}' with '{tmp}'")
                                fixed = True
                            else:
                                print(f"No fix applied for rows: '{rows[index]}' and '{rows[index+1]}'")
                        index += 1

            if not fixed:

                if len(rows) == 1 and rows[0] == "No gifts": # Nothing to capture
                    print( "### No more chests to capture!")
                    return True

                print("*** CAPTURED TEXT:")
                print(capture)
                print("*** CAPTURED ROWS:")
                text = ""
                for row in rows:
                    print(row)
                    text += row + "\n"
                print("*** ERROR: The number of captured non-empty rows is not divisible by 3. ***")
                print("* Processing of this capture segment will stop!")
                print("* The captured rows will be copied to the clipboard so that they can be manually")
                print("* pasted into the document in case there is a way to manually correct this.")
                print("* Also note that the same correction should also be manually pasted into the")
                print("* current archive file, otherwise that change will not be reflected there.")

                self.cfile.writelines("--------------- The above segment might not be present in the archive file due to processing errors\n")
                self.cfile.flush()

                clipboard.copy(text)

                return False
    
        rows.reverse()
        validate_line_count = 0

        while len(rows) > 0:

            line = rows.pop()
            line = line.strip() # remove leading or trailing spaces

            # sometimes there is an erroneous '.' captured at the end of a line
            if line.endswith('.'):
                line = line.strip('.')

            try:
                chest = player = source = ""

                chest = self.chest_def.validate(line)
                validate_line_count += 1
                line = rows.pop()

                player = line.strip()

                # The Great Hunt chests have no player attached
                if chest.find("eat ") > -1 and chest.find("unt") > -1:
                    success = True
                    player = "The Great Hunt"
                else:
                    success, player = self.player_def.validate(player, validate_line_count)
                    validate_line_count += 1
                line = rows.pop()

                source = line.strip()
                success, source = self.source_def.validate(source, validate_line_count)            
                validate_line_count += 1

                if success and (len(chest) > 0 and len(player) > 0 and len(source) > 0):
 
                    if self.debug_mode:
                        print("Processing ({}): {},{},{},{}".format( validate_line_count, player, source, chest, self.clan))

                    self.records.append([chest, player, source])

                    if len(self.records) == count: # we're done
                        break

                else:
                    print("*** ERROR: Falied to parse chest ({}): {}, From: {}, Source: {}".format( validate_line_count, chest, player, source))
                    success = False
                    break
            except:
                print("*** EXCEPTION: Chest ({}): {}, From: {}, Source: {}".format( validate_line_count, chest, player, source))
                success = False
                break

        return success
# ---------------------------------------------------------------------------------------------------------------
    def save_records(self):
    
        index = 0
        rows = list()

        while index < len(self.records):

            chest = self.records[index][0]
            player = "From : " + self.records[index][1]
            source = "Source : " + self.records[index][2]

            print("{}".format(chest))
            print("{}".format(player))
            print("{}".format(source))

            rows.append(chest)
            rows.append(player)
            rows.append(source)

            index += 1

        print("Saving records...")

        for row in rows:
            self.sfile.writelines(row+"\n")
            self.wfile.writelines(row+"\n")

        self.sfile.flush()
        self.wfile.flush()

        print("Done!")

# ---------------------------------------------------------------------------------------------------------------
    def handle_auto_accept_prompt(self):
        """Handle auto-accept prompting with session memory"""
        if not self.session.should_prompt_auto_accept():
            # Use remembered setting
            self.auto_accept = self.session.auto_accept_choice
            self.player_def.auto_accept = self.auto_accept
            if self.auto_accept:
                print("### Using remembered setting: Auto-accept enabled for new players")
            return
        
        # First time or user chose not to remember
        auto_choice = ""
        while True:
            auto_choice = input("Auto-accept all new players without confirmation? (y/n, default=n): ").strip().lower()
            if auto_choice in ["", "y", "n"]:
                break
        
        auto_accept_choice = auto_choice == "y"
        
        # Ask if user wants to remember this choice
        if auto_choice in ["y", "n"]:
            remember_choice = ""
            while True:
                remember_choice = input("Remember this choice for this session? (y/n): ").strip().lower()
                if remember_choice in ["y", "n", ""]:
                    break
            
            remember = remember_choice == "y"
            self.session.set_auto_accept(auto_accept_choice, remember)
            
            if remember:
                print(f"### Choice remembered: Auto-accept {'enabled' if auto_accept_choice else 'disabled'} for this session")
        
        self.auto_accept = auto_accept_choice
        self.player_def.auto_accept = self.auto_accept
        
        if auto_accept_choice:
            print("### Auto-accept mode enabled. New players will be accepted automatically.")

# ---------------------------------------------------------------------------------------------------------------
    def run_eod_processing(self):
        """Run EOD processing as part of the capture workflow"""
        try:
            print("\n### Starting EOD Processing ###")
            
            # Import TBProcess here to avoid circular imports
            processing_args = type('Args', (), {
                'verbose': self.debug_mode,
                'date': None,
                'start_date': '',
                'end_date': '',
                'eod': True,
                'summary': False,
                'citadels': False,
                'skip_empty': False
            })()
            
            # Create TBProcess instance and run EOD
            eod_processor = TBProcess(self.config, processing_args)
            eod_processor.run()
            
            return True
            
        except Exception as e:
            print(f"### Error during EOD processing: {e}")
            return False

# ---------------------------------------------------------------------------------------------------------------
    def run(self):
        """Streamlined capture workflow with session management and integrated EOD processing"""
        
        print("### Starting capture session ###")
        
        # SAFETY CHECK: Check if source data file contains previous data
        if os.path.exists(self.config.datafile):
            try:
                # Try multiple encodings like the Supabase uploader does
                content = None
                encodings_to_try = ['utf-8', 'windows-1252', 'latin-1', 'cp1252']
                
                for encoding in encodings_to_try:
                    try:
                        with open(self.config.datafile, 'r', encoding=encoding) as f:
                            content = f.read().strip()
                        break  # Successfully read with this encoding
                    except UnicodeDecodeError:
                        continue
                
                if content:
                    lines = content.split('\n')
                    line_count = len([line for line in lines if line.strip()])
                    if line_count > 0:
                        print(f"⚠️  DETECTED: Source data file contains {line_count} lines of existing data!")
                        print(f"📁 File: {self.config.datafile}")
                        print("🧹 AUTO-CLEARING to prevent duplicate uploads...")
                        
                        # Automatically clear the file
                        with open(self.config.datafile, 'w', encoding='utf-8') as f:
                            f.write("")
                        print(f"✅ Source file cleared automatically: {self.config.datafile}")
                        print("")
                else:
                    print(f"⚠️  Could not read source file with any supported encoding")
            except Exception as e:
                print(f"⚠️  Could not check source file: {e}")
        
        print("🔄 Starting fresh capture session...")
        
        # Session-based capture loop
        while self.session.session_active:
            
            # Handle auto-accept prompt with session memory
            self.handle_auto_accept_prompt()
            
            # Get number of chests to collect for this round
            value = ""
            while True:
                if self.session.total_session_chests > 0:
                    print(f"\n### {self.session.get_session_summary()} ###")
                
                value = input("Enter the total number of chests you want to collect ('-' to exit): ")
                if value.isdigit() or value == "-":
                    break

            if value == "-":
                break

            maxClicks = int(value)
            roundClicks = 0  # Clicks for this round only

            # Capture loop for this round
            while roundClicks < maxClicks:

                print("Taking a screenshot...")
                image = self.screen.get_screenshot(self.config.x1, self.config.y1, self.config.x2, self.config.y2)
                print("Done!")

                print("Some image processing...")
                image = self.screen.get_grayscale(numpy.array(image))
                print("Done!")

                print("Performing OCR analysis...")
                capture = self.screen.ocr_core(image)
                print("Done!")

                count = 4 # chests on the screen

                # make sure we don't capture more than the specified number of chests
                if roundClicks + count > maxClicks:
                    count = maxClicks - roundClicks

                print("Processing chests from the capture...")
                success = self.validate_capture(capture, count)
                
                if len(self.records) < count and len(self.records) > 0: # did we capture less than the specified number?
                    print( "### Only {} chests were captured".format(len(self.records)))

                print("Done!")

                if success and len(self.records) == 0: # success but nothing was captured so stop
                    print("{} chests collected out of the stipulated {} for this round. Round complete.".format(roundClicks, maxClicks))
                    break

                proceed = ""

                if not success:
                    while True:
                        print("*** \nERROR: The screen capture could not be validated ***")
                        proceed = input("*** ERROR: What do you want to do (1=capture again, 2=save it anyway, 3=stop processing) ? ")
                
                        if proceed == "4":
                            print(capture)

                        if proceed in ["1", "2", "3"]:
                            break

                if proceed == "3":
                    break
                elif proceed == "1":
                    self.cfile.writelines("--- WARNING: The user has asked to redo the capture so watch for duplicates.\n")
                    self.cfile.flush()

                if success or proceed == "2":
                    self.save_records()

                if success:

                    clicks = len(self.records) # dont click more than the number of chests captured by the OCR

                    if roundClicks + clicks > maxClicks:
                        clicks = maxClicks - roundClicks
            
                    print("Opening {} chests...".format(clicks))
                    moveX = [0,3,-6,6,-3,0]
                    hwndThis = pygetwindow.getActiveWindow()

                    for i in range(clicks):
                        pyautogui.click(x=int(self.config.mx)+moveX[i], y=int(self.config.my)) # move the cursor slighty to avoid the game screensaver
                        roundClicks += 1
                        self.totalClicks += 1
                        time.sleep(int(self.clickWait) / 1000.0)
                    hwndThis.activate()
                    print("Done!")
                    time.sleep( 2 * int(self.clickWait) / 1000.0 )
                    
                    # Update session totals
                    self.session.add_captured_chests(clicks)

                if roundClicks >= maxClicks:
                    print("{} chests collected which equals the stipulated number for this round. Round complete.".format(roundClicks))
                    break

            # Round complete - ask if user wants to continue or process EOD
            print(f"\n### Round Complete ###")
            print(f"### {self.session.get_session_summary()} ###")
            
            continue_choice = ""
            while True:
                continue_choice = input("Continue capturing more chests? (y/n): ").strip().lower()
                if continue_choice in ["y", "n", ""]:
                    break
            
            if continue_choice == "n" or continue_choice == "":
                # Ask about EOD processing
                eod_choice = ""
                while True:
                    eod_choice = input("Create EOD report now? (y/n): ").strip().lower()
                    if eod_choice in ["y", "n", ""]:
                        break
                
                if eod_choice == "y" or eod_choice == "":
                    # Run EOD processing
                    success = self.run_eod_processing()
                    if not success:
                        print("### EOD processing completed with warnings - check the output above")
                
                # End session
                self.session.session_active = False
                break

        # Show session summary
        self.player_def.show_new_players_summary()
        self.player_def.save()
        
        print(f"\n### Session Complete ###")
        print(f"### {self.session.get_session_summary()} ###")
        
        if self.totalClicks > 0:
            print("### Capture session completed successfully ###")

# TBProcess ------------------------------------------------------------------------------------------------------
class TBProcess(object):
    """ main class used for generating EOD files and summaries for all chests as well as citadels """
# ------------------------------------------------------------------------------------------------------
    def __init__(self, config, args):

        self.processing_date        = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.processing_date_file   = datetime.now().strftime("%Y-%m-%d_%H.%M.%S")
        self.debug_mode             = args.verbose
        self.config                 = config
        self.skip_empty             = False
        self.eod                    = False
        self.summary                = False
        self.citadels               = False
        self.start_date             = ''
        self.end_date               = ''
        self.score_def              = TBScore(config.score_file)

        if args.skip_empty:
            self.skip_empty = args.skip_empty
        if args.date:
            # If user provides date in old format, append time
            if len(args.date) == 10:  # YYYY-MM-DD format
                self.processing_date = args.date + " 00:00:00"
                self.processing_date_file = args.date + "_00.00.00"
            else:
                self.processing_date = args.date
                # Convert timestamp to filesystem-safe format for filenames
                self.processing_date_file = args.date.replace(":", ".").replace(" ", "_")
        if args.eod:
            self.eod = args.eod
        if args.summary:
            self.summary = args.summary
        if args.citadels:
            self.citadels = args.citadels
        if args.start_date:
            self.start_date = args.start_date
        if args.end_date:
            self.end_date = args.end_date

        self.player_summary = {}
        self.citadel_summary = {}

        if config.player_file:
            with open(config.player_file) as pfp:
                for cmt, player_line in enumerate(pfp):
                    kvp_string = player_line.strip()
                    kvp = kvp_string.split(",")

                    self.player_summary[kvp[0]] = [0, 0]
                    self.citadel_summary[kvp[0]] = [0, 0, 0, 0, 0, 0, 0, 0]

# ------------------------------------------------------------------------------------------------------
    def cycle_duplicate_files( self, filepath, ext ):

        if os.path.isfile( filepath + ext ): # file with the same name already exists, so rename to avoid overwriting
            for i in range( 98, 0, -1 ): # rename older versions adding a number, allow up to 99 versions
                src = filepath + "_" + str(i) + ".old"
                dst = filepath + "_" + str(i+1) + ".old"
                try:
                    os.rename( src, dst )
                except:
                    continue
            src = filepath + ext
            dst = filepath + "_1.old"
            os.rename( src, dst )
# ------------------------------------------------------------------------------------------------------
    def process_file(self, inputfile, processing_date, processing_date_file=None):

        success = True
        
        # Use filesystem-safe date for filename if provided, otherwise use processing_date
        if processing_date_file is None:
            processing_date_file = processing_date
    
        with open(inputfile) as fp:

            file_dir = self.config.final_dir

            ofile = file_dir + '/TB_Chests'
            ofile += '_' + self.config.clan
            ofile += '_' + processing_date_file
            ofile += '_' + "FINAL"

            self.cycle_duplicate_files( ofile, ".csv" )

            ofile += '.csv'

            opf = open(ofile, 'w')
            opf.writelines('DATE,PLAYER,SOURCE,CHEST,SCORE,CLAN\n')

            source_line_count = 0
            parsed_line_count = 0

            while True:

                try:
                    chest = player = source = ""

                    line = fp.readline()
                    if not line:
                        break

                    chest = line.strip()
                    source_line_count += 1

                    line = fp.readline()
                    if not line:
                        break

                    splitter = ":"

                    player = line.strip()
                    split_player = player.split(splitter, 1)
                    player = split_player[1].strip()

                    source_line_count += 1

                    line = fp.readline()
                    if not line:
                        break

                    source = line.strip()
                    split_source = source.split(splitter, 1)
                    source = split_source[1].strip()

                    source_line_count += 1

                    if len(chest) > 0 and len(player) > 0 and len(source) > 0:
                        score = self.score_def.calculate( source, chest, player, source_line_count)

                        parsed_line_count += 1

                        if self.debug_mode:
                            print("Processing ({}/{}): {},{},{},{},{},{}".format( parsed_line_count, source_line_count, processing_date, player, source, chest, score, self.config.clan))

                        opf.writelines(processing_date+','+player+','+source+','+chest+','+score+','+self.config.clan+'\n')
                    else:
                        print("*** ERROR: Falied to parse chest ({}/{}): {}, From: {}, Source: {}".format( parsed_line_count, source_line_count, chest, player, source))
                        success = False
                        break
                except:
                        print("*** EXCEPTION: Chest ({}/{}): {}, From: {}, Source: {}".format( parsed_line_count, source_line_count, chest, player, source))
                        success = False
                        break
               
            opf.close()

        if parsed_line_count != source_line_count / 3:
            print("*** ERROR Mismatch between procseed line count and source line count: {} != {} / 3".format(parsed_line_count,source_line_count))
            success = False

        print("\nProcessed {} records from {} source lines".format(parsed_line_count,source_line_count))

        if success:
            # after a successful end of day run, create a copy of the input file and put it in the archive directory unless it was a batch run which will already be reading those files
            if self.start_date == "" or self.end_date == "": # standard eod run

                archive_file = self.config.archive_dir + '/TB_Chests'
                archive_file += '_' + self.config.clan
                archive_file += "_" + processing_date_file + "_DATA"

                self.cycle_duplicate_files( archive_file, ".archive" )

                archive_file += ".archive"

                # save input file to archive with datestamp added to file name
                shutil.copyfile(self.config.datafile, archive_file)

                print("\n### End of Day processing for {}".format(processing_date))
                print("### Saved archived data file:  {}".format(archive_file))
                print("### Saved processed data file: {}".format(ofile))

            else:
                    print("### Saved processed data file: {}".format(ofile))

        return success
# ------------------------------------------------------------------------------------------------------
    def run_chest_summary(self):
        # generate a player chest summary based on the FINAL files in the /final directory

        date_tag = ""
    
        if self.start_date == "" or self.end_date == "":
            print("\n### Calculating CHEST summary data based on ALL files in the /final directory")

            file_pattern = self.config.final_dir + "/TB_Chests"
            file_pattern += "_" + self.config.clan
            file_pattern += "_*_FINAL.csv"
    
            file_list = glob.glob(file_pattern)
        else:
            print("\n### Calculating CHEST summary data based on files from {} to {} in the /final directory".format(self.start_date, self.end_date))

            date_start = datetime.strptime(self.start_date,"%Y-%m-%d")
            date_end   = datetime.strptime(self.end_date,"%Y-%m-%d")
            file_list  = list()

            if date_start == date_end: # just one day
                date_tag = date_start
            else: # multiple days
               date_tag = self.start_date + "_" + self.end_date

            while True:
                processing_date = date_start.strftime("%Y-%m-%d")

                file_pattern = self.config.final_dir + "/TB_Chests"
                file_pattern += "_" + self.config.clan
                file_pattern += "_" + processing_date + "_FINAL.csv"
    
                file_list.append(file_pattern)

                date_start += timedelta(days=1)
                if date_start > date_end:
                    break

        # zero any values in the player summary structure
        for player in self.player_summary:
            self.player_summary[player] = [0, 0]

        print("### Summary processing has started...\n")
        for file in file_list:
            with open(file) as sp:

                print("Processing {}".format(file))

                while True:

                    line = sp.readline()
                    if not line:
                        break            
                
                    row = line.strip()
                    columns = row.split(",")

                    player = columns[1]
                    score  = columns[4]

                    if player == "PLAYER": # skip the header row
                        continue

                    self.player_summary[player][0] = self.player_summary[player][0] + int(score) # add the score
                    self.player_summary[player][1] = self.player_summary[player][1] + 1 # increase chest number count by 1

        file = self.config.final_dir + "/TB_PlayerSummary"
        file += "_" + self.config.clan
        if date_tag != "":
            file += "_" + date_tag
        file += "_FINAL.csv"
        opf = open(file, 'w')
        opf.writelines("PLAYER,SCORE,COUNT\n")
    
        file2 = self.config.final_dir + "/TB_PlayerSummary_NoScore"
        file2 += "_" + self.config.clan
        if date_tag != "":
            file2 += "_" + date_tag
        file2 += "_FINAL.csv"
        opf2 = open(file2, 'w')
    
        # sort by highest score
        player_summary_sorted = dict(sorted(self.player_summary.items(), key=lambda item: item[1], reverse=True))

        for player in player_summary_sorted:
            opf.writelines("{},{},{}\n".format( player, player_summary_sorted[player][0], player_summary_sorted[player][1]))
            opf2.writelines("{}\n".format(player))

        print("\n### Player summary processing has been completed")
        print("### Destination file: {}".format(file))

# ------------------------------------------------------------------------------------------------------
    def run_citadel_summary(self):
        # generate a player Citadel only summary based on the FINAL files in the /final directory
    
        citadels = ["Level 10 Citadel","Level 15 Citadel","Level 20 Citadel","Level 25 Citadel","Level 30 Citadel"]
        cursed_citadels = ["","","","","","Level 20 Citadel","Level 25 Citadel"]
        date_tag = ""
        
        if self.start_date == "" or self.end_date == "":
            print("### Calculating CITADEL summary data based on ALL files in the /final directory")

            file_pattern = self.config.final_dir + "/TB_Chests"
            file_pattern += "_" + self.config.clan
            file_pattern += "_*_FINAL.csv"
    
            file_list = glob.glob(file_pattern)
        else:
            print("### Calculating CITADEL summary data based on files from {} to {} in the /final directory".format(self.start_date, self.end_date))

            date_start = datetime.strptime(self.start_date,"%Y-%m-%d")
            date_end   = datetime.strptime(self.end_date,"%Y-%m-%d")
            file_list  = list()
            
            if date_start == date_end: # just one day
                date_tag = date_start
            else: # multiple days
               date_tag = self.start_date + "_" + self.end_date

            while True:
                processing_date = date_start.strftime("%Y-%m-%d")

                file_pattern = self.config.final_dir + "/TB_Chests"
                file_pattern += "_" + self.config.clan
                file_pattern += "_" + processing_date + "_FINAL.csv"
    
                file_list.append(file_pattern)

                date_start += timedelta(days=1)
                if date_start > date_end:
                    break

        # zero any values in the player summary structure
        for player in self.citadel_summary:
            self.citadel_summary[player] = [0, 0, 0, 0, 0, 0, 0, 0]

        print("### Summary processing has started...\n")
        for file in file_list:
            with open(file) as sp:

                print("Processing {}".format(file))

                while True:

                    line = sp.readline()
                    if not line:
                        break            
                
                    row = line.strip()
                    columns = row.split(",")

                    player = columns[1]
                    level = columns[2]
                    type = columns[3]

                    if player == "PLAYER": # skip the header row
                        continue

                    if level.find("Citadel") == -1 or type.find("Citadel") == -1: # skip non-Citadels
                        continue

                    if type.find("Cursed") > -1:
                        cursed = True
                        index = cursed_citadels.index(level)
                    else:
                        cursed = False
                        index = citadels.index(level)

                    self.citadel_summary[player][index] = self.citadel_summary[player][index] + 1 # increase this citadel count by 1
                    self.citadel_summary[player][7] = self.citadel_summary[player][7] + 1 # increase total citadel count by 1

        file = self.config.final_dir + "/TB_CitadelSummary"
        file += "_" + self.config.clan
        if date_tag != "":
            file += "_" + date_tag
        file += "_FINAL"
        file += ".csv"

        opf = open(file, 'w')
        opf.writelines("PLAYER,ELVEN_10,ELVEN_15,ELVEN_20,ELVEN_25,ELVEN_30,CURSED_20,CURSED_25,TOTAL\n")
    
        # sort by highest count
        citadel_summary_sorted = dict(sorted(self.citadel_summary.items(), key=lambda item: item[1][7], reverse=True))

        for player in citadel_summary_sorted:
            if self.skip_empty and citadel_summary_sorted[player][7] > 0: # skip lines with 0 count
                opf.writelines("{},{},{},{},{},{},{},{},{}\n".format( player, 
                                                                   citadel_summary_sorted[player][0], 
                                                                   citadel_summary_sorted[player][1],
                                                                   citadel_summary_sorted[player][2],
                                                                   citadel_summary_sorted[player][3],
                                                                   citadel_summary_sorted[player][4],
                                                                   citadel_summary_sorted[player][5],
                                                                   citadel_summary_sorted[player][6],
                                                                   citadel_summary_sorted[player][7]))

        print("\n### Citadel summary processing has been completed")
        print("### Destination file: {}".format(file))

# ------------------------------------------------------------------------------------------------------
    def prompt_supabase_upload(self, csv_file_path):
        """Prompt user to upload EOD data to Supabase after successful processing"""
        
        if not SUPABASE_AVAILABLE:
            print("\n⚠️  Supabase uploader not available")
            print("   Install supabase client: pip install supabase")
            print("   Set environment variables: SUPABASE_URL, SUPABASE_ANON_KEY")
            return
        
        print(f"\n### EOD Processing Complete ###")
        print(f"### Generated CSV file: {csv_file_path}")
        
        # Show source file information
        source_lines = 0
        if os.path.exists(self.config.datafile):
            try:
                with open(self.config.datafile, 'r', encoding='utf-8') as f:
                    source_lines = len([line for line in f.readlines() if line.strip()])
            except:
                pass
        
        print(f"\n>>> Upload Process:")
        print(f"   Upload CSV: {os.path.basename(csv_file_path)}")
        print(f"   Clear source: {os.path.basename(self.config.datafile)} ({source_lines} lines)")
        print(f"   WARNING: Source file will be PERMANENTLY CLEARED after upload!")
        
        while True:
            upload_choice = input("Upload to Supabase and clear source file? (y/n): ").strip().lower()
            if upload_choice in ['y', 'n', '']:
                break
        
        if upload_choice == 'n':
            print("### Supabase upload skipped - source file preserved")
            return
        
        print("### Starting Supabase upload...")
        
        try:
            # Determine source file to clear after successful upload
            source_file_path = self.config.datafile
            
            # Call the uploader (ensure path is properly quoted)
            success = upload_eod_to_supabase(
                csv_file_path=str(csv_file_path),
                source_file_path=source_file_path,
                clear_source=True  # Clear source file after successful upload
            )
            
            if success:
                print("✅ EOD data successfully uploaded to Supabase!")
                print(f"✅ Source file cleared: {source_file_path}")
                print("### Upload complete - data is now in the cloud")
            else:
                print("❌ Supabase upload failed")
                print("   Check supabase_upload.log for details")
                print("   Source file was NOT cleared due to upload failure")
        
        except Exception as e:
            print(f"❌ Supabase upload error: {e}")
            print("   Source file was NOT cleared due to error")

# ------------------------------------------------------------------------------------------------------
    def run(self):

        if self.eod:

             # standard eod
            if self.start_date == "" or self.end_date == "":
                success = self.process_file(self.config.datafile, self.processing_date, self.processing_date_file)

            # re-run EoD for the date range using data files from the /archive directory
            elif self.start_date != "" and self.end_date != "": 
    
                # Batch processing will ignore the input filename and read only form the archive direcotry
                print("*** Info: Processing EOD in batch. Please note that input will always be read from the archive files during batch processing.")

                date_start = datetime.strptime(self.start_date,"%Y-%m-%d")
                date_end   = datetime.strptime(self.end_date,"%Y-%m-%d")

                while True:

                    processing_date = date_start.strftime("%Y-%m-%d")
                    processing_date_file = processing_date  # Batch processing uses old format for filenames

                    archive_file = self.config.archive_dir + '/TB_Chests'
                    archive_file += '_' + self.config.clan
                    archive_file += "_" + processing_date + "_DATA.archive"

                    success = self.process_file(archive_file, processing_date, processing_date_file)

                    if not success:
                        print("*** ERROR: Batch processing of file {} was unsuccessful! Batch processing will terminate.".format(archive_file))
                        break

                    date_start += timedelta(days=1)
                    if date_start > date_end:
                        break

            self.score_def.print_no_scores()

            if not success:
                print("\n************************************************************************")
                print("***** THERE ARE ERRORS IN THE PROCESSING THAT NEED TO BE ADDRESSED *****")
                print("************************************************************************")
            else:
                # EOD processing was successful - prompt for Supabase upload
                # Build the expected CSV file path
                csv_file_path = self.config.final_dir + '/TB_Chests'
                csv_file_path += '_' + self.config.clan
                csv_file_path += '_' + self.processing_date_file
                csv_file_path += '_FINAL.csv'
                
                self.prompt_supabase_upload(csv_file_path)


        if self.summary:
            self.run_chest_summary()

        if self.citadels:
            self.run_citadel_summary()

# TBProcess ------------------------------------------------------------------------------------------------------

# TBChestCounter ------------------------------------------------------------------------------------------------------
parser = argparse.ArgumentParser()

parser.add_argument("--config", help="a separate configuration file that contains relevant processing paramters. these can be overridden by providing arguments", required="True")

parser.add_argument("--verbose", action="store_true", help="turns on more verbose logging to help troubleshoot malforme<d records.")
parser.add_argument("--calibrate", action="store_true", help="enters calibration mode.")
parser.add_argument("--capture", action="store_true", help="runs the chest capture software")
parser.add_argument("--process", action="store_true", help="process captured chest information")

# only used by TBCapture 
parser.add_argument("--clickWait", help="time to wait between auto-clicks", default="300")
parser.add_argument("--auto_accept", action="store_true", help="automatically accept all new players without confirmation")

# only used by TBProcess
parser.add_argument("--date", help="optional processing date, default is current date")
parser.add_argument("--start_date", help="optional processing start date for processing a range of dates")
parser.add_argument("--end_date", help="optional processing end date for processing a range of dates")
parser.add_argument("--eod", action="store_true", help="triggers final or end of day processing of data using the /source, /final, and /archive directories.")
parser.add_argument("--summary", action="store_true", help="only generate a summary from the processed files in the /final directory")
parser.add_argument("--citadels", action="store_true", help="only generate a summary from the processed files in the /final directory")
parser.add_argument("--skip_empty", action="store_true", help="skip players with 0 value in the summary, i.e. don't print a row in the summary file")


args = parser.parse_args()

config = TBConfig(args.config, args.clickWait)

if args.calibrate:
    app1 = TBCalibration(config)
    app1.run()
elif args.capture:
    app2 = TBCapture(config, args)
    app2.run()
elif args.process:
    app3 = TBProcess(config, args)
    app3.run()

# TBChestCounter ------------------------------------------------------------------------------------------------------