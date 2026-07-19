const fs = require('fs');

const path = 'c:\\Users\\cris7\\OneDrive\\Desktop\\Threshold\\mobile\\src\\presentation\\heroes\\GlobalHeroPresenter.ts';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  /\.slice\(0, 3\);/,
  '.slice(0, 2);'
);

fs.writeFileSync(path, content, 'utf8');
console.log('Updated slice to 2 in GlobalHeroPresenter.ts');
