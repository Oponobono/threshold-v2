#!/usr/bin/env python3
"""
Fix remaining soft-hyphen (U+00AD = \xad) corruption in locale files.
The soft hyphen should be 'í' (U+00ED) in most Spanish contexts.
Also fix other known replacement chars.
"""

import os
import glob
import re

LOCALE_DIR = r"c:\Users\cris7\OneDrive\Desktop\Threshold\mobile\src\locales"

# Map of broken → correct for soft-hyphen patterns
# \xad appears where 'í' should be (e.g., "mínima" → "m\xadnima")
REPLACEMENTS = [
    # soft hyphen + following letter combinations that are always 'í' in Spanish
    ('\xadnima', 'ínima'),
    ('\xadnimo', 'ínimo'),
    ('\xados', 'ídos'),
    ('\xada ', 'ía '),
    ('\xada,', 'ía,'),
    ('\xada.', 'ía.'),
    ('\xada"', 'ía"'),
    ('\xadan', 'ían'),
    ('\xadmite', 'ímite'),
    ('\xadn.', 'ín.'),
    ('\xadtulos', 'ítulos'),
    ('\xadtico', 'ítico'),
    ('\xadsticas', 'ísticas'),
    ('\xadstica', 'ística'),
    ('\xadodos', 'íodos'),
    ('\xadodo', 'íodo'),
    ('\xada\n', 'ía\n'),
    ('\xadd ', 'íd '),   # días
    ('\xadas', 'ías'),
    # warning symbols that got corrupted
    ('\xa0\x8f', '⚠️'),   # ⚠️ emoji
    ('\x8f ', '️ '),
    # ℹ️ emoji corruption
    ('ℹ\x8f', 'ℹ️'),
]

files = glob.glob(os.path.join(LOCALE_DIR, "**", "*.json"), recursive=True)
fixed_count = 0

for filepath in sorted(files):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    if '\xad' not in content and '\xa0' not in content:
        continue

    original = content
    for broken, correct in REPLACEMENTS:
        content = content.replace(broken, correct)

    if content != original:
        with open(filepath, "w", encoding="utf-8", newline="\n") as f:
            f.write(content)
        print(f"  [FIXED] {os.path.relpath(filepath, LOCALE_DIR)}")
        fixed_count += 1

print(f"\nDone: {fixed_count} files fixed with soft-hyphen repair.")

# Final check
print("\n--- Final verification ---")
BAD_PATTERNS = ['Ã©', 'Ã¡', 'Ã­', 'Ã³', 'Ãº', 'Ã±', 'Â¿', 'Â¡']
for filepath in sorted(files):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    has_mojibake = any(p in content for p in BAD_PATTERNS)
    has_soft_hyph = '\xad' in content
    rel = os.path.relpath(filepath, LOCALE_DIR)
    if has_mojibake:
        print(f"  [MOJIBAKE REMAINING] {rel}")
    elif has_soft_hyph:
        # Show the offending lines
        for i, line in enumerate(content.splitlines(), 1):
            if '\xad' in line:
                print(f"  [SOFT-HYPH] {rel} line {i}: {repr(line[:100])}")
    else:
        print(f"  [CLEAN] {rel}")
