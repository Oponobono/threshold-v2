const fs = require('fs');
const path = 'c:\\Users\\cris7\\OneDrive\\Desktop\\Threshold\\mobile\\app\\(tabs)\\index.tsx';
let content = fs.readFileSync(path, 'utf8');

// Remove the opening tag
content = content.replace(/\{\/\* Animated wrapper: content below the carousel shifts smoothly when card height changes \*\/\}\r?\n\s*<Reanimated\.View layout=\{LinearTransition\.springify\(\)\.damping\(18\)\.stiffness\(180\)\}>/, '');

// Remove the closing tag
content = content.replace(/<\/View>\r?\n\s*<\/Reanimated\.View>\r?\n\s*<\/View>\r?\n\s*\{\/\* 5\. STUDY TOOLS \*\/\}/, '</View>\n        </View>\n        {/* 5. STUDY TOOLS */}');

fs.writeFileSync(path, content, 'utf8');
console.log('Removed Reanimated layout wrapper.');
