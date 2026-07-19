const fs = require('fs');
const path = 'c:\\Users\\cris7\\OneDrive\\Desktop\\Threshold\\mobile\\app\\(tabs)\\index.tsx';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(/import Reanimated,.*?from 'react-native-reanimated';\r?\n/, '');
fs.writeFileSync(path, content, 'utf8');
console.log('Removed Reanimated import');
