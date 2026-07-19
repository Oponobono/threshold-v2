const fs = require('fs');

const path = 'c:\\Users\\cris7\\OneDrive\\Desktop\\Threshold\\mobile\\src\\components\\dashboard\\CourseHeroCard.tsx';
let content = fs.readFileSync(path, 'utf8');

// Replace momentum tooltip logic
content = content.replace(
  /onPress=\{\(\) => setTooltipText\(t\('dashboard\.heroTooltips\.momentum'\)\)\}/g,
  `onPress={() => {\n                    const level = vm.momentum >= 90 ? 'excellent' : vm.momentum >= 50 ? 'good' : 'poor';\n                    setTooltipText(t(\`dashboard.heroTooltips.momentum.\${level}\`));\n                  }}`
);

// Replace knowledge tooltip logic
content = content.replace(
  /onPress=\{\(\) => setTooltipText\(t\('dashboard\.heroTooltips\.knowledge'\)\)\}/g,
  `onPress={() => {\n                const level = vm.knowledge!.score >= 90 ? 'excellent' : vm.knowledge!.score >= 70 ? 'good' : vm.knowledge!.score >= 50 ? 'fair' : 'poor';\n                setTooltipText(t(\`dashboard.heroTooltips.knowledge.\${level}\`));\n              }}`
);

// Replace globalHealth tooltip logic
content = content.replace(
  /onPress=\{\(\) => setTooltipText\(t\('dashboard\.heroTooltips\.globalHealth'\)\)\}/g,
  `onPress={() => {\n            const level = vm.health >= 90 ? 'excellent' : vm.health >= 70 ? 'good' : vm.health >= 50 ? 'fair' : 'poor';\n            setTooltipText(t(\`dashboard.heroTooltips.globalHealth.\${level}\`));\n          }}`
);

fs.writeFileSync(path, content, 'utf8');
console.log('Updated CourseHeroCard.tsx tooltip logic');
