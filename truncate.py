import re

with open('backend/controllers/flashcardsController.js', 'r', encoding='utf-8') as f:
    content = f.read()

auto_idx = content.find('exports.autoUnsnoozeExpired = (req, res) => {')
if auto_idx != -1:
    # Find the end of autoUnsnoozeExpired which is `  );\n};\n`
    end_auto = content.find('  );\n};\n', auto_idx)
    if end_auto != -1:
        # truncate anything after this!
        content = content[:end_auto + 8]
        with open('backend/controllers/flashcardsController.js', 'w', encoding='utf-8') as f:
            f.write(content)
        print("Truncated properly")
