#!/usr/bin/env python3
"""
Copy only essential project files to a new location.
Excludes: .venv, __pycache__, model checkpoints, generated outputs.
"""

import os
import shutil
from pathlib import Path

def copy_essential_files(source_dir: str, dest_dir: str) -> None:
    """Copy only necessary files from source to destination."""
    
    source = Path(source_dir)
    dest = Path(dest_dir)
    
    # Create destination
    dest.mkdir(parents=True, exist_ok=True)
    
    # Define what to copy
    files_to_copy = [
        "requirements.txt",
        "README.md",
    ]
    
    directories_to_copy = [
        "app",
        "stt",
        "extractor",
        "train",
        "data/labels",
        "data/label_map.json",
    ]
    
    # Copy files
    for file in files_to_copy:
        src_file = source / file
        if src_file.exists():
            dst_file = dest / file
            print(f"✓ Copying {file}")
            shutil.copy2(src_file, dst_file)
        else:
            print(f"⚠ Skipping {file} (not found)")
    
    # Copy directories (excluding cache and checkpoints)
    for directory in directories_to_copy:
        src_dir = source / directory
        dst_dir = dest / directory
        
        if src_dir.exists():
            # Handle single files like label_map.json
            if src_dir.is_file():
                dst_dir.parent.mkdir(parents=True, exist_ok=True)
                print(f"✓ Copying {directory}")
                shutil.copy2(src_dir, dst_dir)
            else:
                # Copy directory
                print(f"✓ Copying {directory}/")
                if dst_dir.exists():
                    shutil.rmtree(dst_dir)
                shutil.copytree(
                    src_dir, 
                    dst_dir,
                    ignore=shutil.ignore_patterns('__pycache__', '*.pyc', '.pytest_cache')
                )
        else:
            print(f"⚠ Skipping {directory} (not found)")
    
    # Copy trained model (excluding checkpoints)
    models_dir = source / "models" / "slot_model"
    if models_dir.exists():
        dst_models = dest / "models" / "slot_model"
        dst_models.mkdir(parents=True, exist_ok=True)
        print(f"✓ Copying models/slot_model/")
        
        for item in models_dir.iterdir():
            # Skip checkpoint directories
            if item.is_dir() and item.name.startswith("checkpoint-"):
                print(f"  ⊘ Skipping {item.name} (checkpoint)")
                continue
            
            if item.is_file():
                shutil.copy2(item, dst_models / item.name)
            elif item.is_dir():
                shutil.copytree(
                    item, 
                    dst_models / item.name,
                    ignore=shutil.ignore_patterns('__pycache__', '*.pyc')
                )
    else:
        print(f"⚠ Skipping models/slot_model/ (not found)")
    
    print(f"\n✅ Done! Essential files copied to: {dest}")
    print(f"\n📋 To use the copied project:")
    print(f"   1. cd {dest}")
    print(f"   2. python -m venv .venv")
    print(f"   3. .venv\\Scripts\\Activate.ps1  (Windows)")
    print(f"   4. pip install -r requirements.txt")
    print(f"   5. python 'app (2).py'")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        dest_dir = sys.argv[1]
    else:
        dest_dir = input("Enter destination directory path: ").strip()
        if not dest_dir:
            dest_dir = "../Ai-OR-Minimal"
    
    source_dir = os.path.dirname(os.path.abspath(__file__))
    
    if os.path.exists(dest_dir):
        response = input(f"Directory {dest_dir} already exists. Overwrite? (y/n): ").strip().lower()
        if response != 'y':
            print("Cancelled.")
            sys.exit(0)
    
    copy_essential_files(source_dir, dest_dir)
