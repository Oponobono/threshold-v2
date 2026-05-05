#!/usr/bin/env python3
"""
Direct fix for remaining corrupted locale files.
Replace specific corrupted strings with correct Spanish text.
"""

import os

LOCALE_DIR = r"c:\Users\cris7\OneDrive\Desktop\Threshold\mobile\src\locales"

# Files and their specific fixes
FIXES = {
    os.path.join(LOCALE_DIR, "es", "common.json"): [
        ("Texto copiado al portapapeles", "Texto copiado al portapapeles"),
        ("GalerÃ\xada", "Galería"),  # fallback if any remains
    ],
    os.path.join(LOCALE_DIR, "es", "dashboard.json"): [
        ("gustar\xada tomar", "gustaría tomar"),
        ("Extra\xaddo", "Extraído"),
        ("Disfruta tu d\xada", "Disfruta tu día"),
    ],
    os.path.join(LOCALE_DIR, "es", "grades.json"): [
        ("Qu\xadmica", "Química"),
    ],
    os.path.join(LOCALE_DIR, "es", "register.json"): [
        ("nota m\xadnima para aprobar", "nota mínima para aprobar"),
        ("nota m\xafnima para aprobar", "nota mínima para aprobar"),
        # catch any surviving \xad with no following letter
        ("m\xad", "mí"),
    ],
    os.path.join(LOCALE_DIR, "es", "settings.json"): [
        ("per\xadodo", "período"),
        ("per\xafdodo", "período"),
        ("14 d\xadas", "14 días"),
        ("14 d\xafs", "14 días"),
        ("d\xada con", "día con"),
        ("fechas l\xadmite", "fechas límite"),
        ("m\xadn. 4", "mín. 4"),
        ("biometr\xada", "biometría"),
    ],
    os.path.join(LOCALE_DIR, "es", "subjects.json"): [
        ("m\xadnima", "mínima"),
        ("m\xadnimo", "mínimo"),
        ("L\xadmite", "Límite"),
        ("aqu\xad ver", "aquí ver"),
        ("Galer\xada", "Galería"),
        ("galer\xada", "galería"),
        ("Cr\xadtico", "Crítico"),
        ("Estad\xadsticas", "Estadísticas"),
    ],
    os.path.join(LOCALE_DIR, "es", "youtube.json"): [
        ("subt\xadtulos", "subtítulos"),
    ],
    os.path.join(LOCALE_DIR, "en", "settings.json"): [
        # any soft hyphen residues in english file
    ],
}

def fix_file(filepath, replacements):
    if not os.path.exists(filepath):
        print(f"  [NOT FOUND] {filepath}")
        return

    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    original = content
    for broken, correct in replacements:
        content = content.replace(broken, correct)

    # Final fallback: replace any remaining \xad with í
    if "\xad" in content:
        content = content.replace("\xad", "í")
        print(f"  [FALLBACK xad->i] {os.path.relpath(filepath, LOCALE_DIR)}")


    if content != original:
        with open(filepath, "w", encoding="utf-8", newline="\n") as f:
            f.write(content)
        print(f"  [FIXED] {os.path.relpath(filepath, LOCALE_DIR)}")
    else:
        print(f"  [NO CHANGE] {os.path.relpath(filepath, LOCALE_DIR)}")

for filepath, replacements in FIXES.items():
    fix_file(filepath, replacements)

# Final check
print("\n--- Final verification ---")
BAD_PATTERNS = ['Ã©', 'Ã¡', 'Ã­', 'Ã³', 'Ãº', 'Ã±', 'Â¿', 'Â¡', 'Ã‰', 'Ã\x9a', 'Ã\x93']
import glob
files = glob.glob(os.path.join(LOCALE_DIR, "**", "*.json"), recursive=True)
all_clean = True
for f in sorted(files):
    with open(f, "r", encoding="utf-8") as fh:
        content = fh.read()
    has_mojibake = any(p in content for p in BAD_PATTERNS)
    has_soft = "\xad" in content
    rel = os.path.relpath(f, LOCALE_DIR)
    if has_mojibake or has_soft:
        all_clean = False
        print(f"  [ISSUE] {rel}")
        for i, line in enumerate(content.splitlines(), 1):
            if any(p in line for p in BAD_PATTERNS) or "\xad" in line:
                print(f"    line {i}: {repr(line[:100])}")
    else:
        print(f"  [CLEAN] {rel}")

if all_clean:
    print("\n✅ All locale files are clean!")
else:
    print("\n⚠️  Some files still have issues.")
