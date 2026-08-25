const fs = require('fs');
let file = 'jest.setup.js';
if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    if (!content.includes('react-native-get-random-values')) {
        content += "\n// Mock react-native-get-random-values for SessionIdentity in node env\njest.mock('react-native-get-random-values', () => {});\n";
        fs.writeFileSync(file, content);
        console.log("Mock added to jest.setup.js");
    }
}
