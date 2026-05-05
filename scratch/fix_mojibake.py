#!/usr/bin/env python3
"""
Fix mojibake in locale JSON files.
Problem: Files are UTF-8-BOM. The content has UTF-8 bytes misread as Latin-1
         and re-encoded as UTF-8 (double-encoding).
Fix:     Read as utf-8-sig (strips BOM) → encode as Latin-1 → decode as UTF-8
         → write back as plain UTF-8 (no BOM).
"""

import os
import glob

LOCALE_DIR = r"c:\Users\cris7\OneDrive\Desktop\Threshold\mobile\src\locales"

files = glob.glob(os.path.join(LOCALE_DIR, "**", "*.json"), recursive=True)
fixed_count = 0
skipped_count = 0

for filepath in sorted(files):
    # utf-8-sig automatically strips the BOM if present
    with open(filepath, "r", encoding="utf-8-sig") as f:
        content = f.read()

    try:
        # Reverse the double-encoding: latin-1 bytes → utf-8 string
        fixed = content.encode("latin-1").decode("utf-8")

        if fixed == content:
            print(f"  [OK - no changes] {os.path.relpath(filepath, LOCALE_DIR)}")
            skipped_count += 1
        else:
            # Write back as plain UTF-8, no BOM, Unix line endings
            with open(filepath, "w", encoding="utf-8", newline="\n") as f:
                f.write(fixed)
            print(f"  [FIXED] {os.path.relpath(filepath, LOCALE_DIR)}")
            fixed_count += 1

    except (UnicodeDecodeError, UnicodeEncodeError) as e:
        # Content is not double-encoded, but still strip BOM and normalize line endings
        with open(filepath, "w", encoding="utf-8", newline="\n") as f:
            f.write(content)
        print(f"  [BOM stripped] {os.path.relpath(filepath, LOCALE_DIR)}")
        fixed_count += 1

print(f"\nDone: {fixed_count} files fixed, {skipped_count} files unchanged/skipped.")
