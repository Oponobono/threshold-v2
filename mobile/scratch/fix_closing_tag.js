const fs = require('fs');
const path = 'c:\\Users\\cris7\\OneDrive\\Desktop\\Threshold\\mobile\\app\\(tabs)\\index.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/ \}\)\}\r?\n\s*<\/Reanimated\.View>\r?\n\s*\)\}\r?\n\s*<\/Reanimated\.View>/, ' })}\n                </View>\n              )}\n            </Reanimated.View>');
fs.writeFileSync(path, content, 'utf8');
console.log('Fixed line 886');
