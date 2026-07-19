const fs = require('fs');
const path = 'c:\\Users\\cris7\\OneDrive\\Desktop\\Threshold\\mobile\\src\\styles\\CourseHeroCard.styles.ts';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  /width: HERO_CARD_WIDTH,\r?\n\s*backgroundColor: theme\.colors\.card,/,
  "width: HERO_CARD_WIDTH,\n    minHeight: 280,\n    justifyContent: 'space-between',\n    backgroundColor: theme.colors.card,"
);

fs.writeFileSync(path, content, 'utf8');
console.log('Added minHeight and justifyContent to card style');
