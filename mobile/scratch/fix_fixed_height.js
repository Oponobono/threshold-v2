const fs = require('fs');

// ─── 1. Add HERO_CARD_HEIGHT constant + apply height to card style ────────────
const stylesPath = 'c:\\Users\\cris7\\OneDrive\\Desktop\\Threshold\\mobile\\src\\styles\\CourseHeroCard.styles.ts';
let stylesContent = fs.readFileSync(stylesPath, 'utf8');

// Export the height constant right after HERO_CARD_WIDTH
stylesContent = stylesContent.replace(
  /export const HERO_CARD_WIDTH = SCREEN_WIDTH - 52;/,
  `export const HERO_CARD_WIDTH = SCREEN_WIDTH - 52;\nexport const HERO_CARD_HEIGHT = 368;`
);

// Apply fixed height to card style
stylesContent = stylesContent.replace(
  /card: \{\r?\n\s*width: HERO_CARD_WIDTH,/,
  `card: {\n    width: HERO_CARD_WIDTH,\n    height: HERO_CARD_HEIGHT,\n    overflow: 'hidden',`
);

fs.writeFileSync(stylesPath, stylesContent, 'utf8');
console.log('1. Added HERO_CARD_HEIGHT to styles');

// ─── 2. Import HERO_CARD_HEIGHT in CourseHeroCard.tsx ────────────────────────
const cardPath = 'c:\\Users\\cris7\\OneDrive\\Desktop\\Threshold\\mobile\\src\\components\\dashboard\\CourseHeroCard.tsx';
let cardContent = fs.readFileSync(cardPath, 'utf8');

// The card already imports from CourseHeroCard.styles via cHCardStyles and HERO_CARD_WIDTH
// Check import line and add HERO_CARD_HEIGHT if missing
if (!cardContent.includes('HERO_CARD_HEIGHT')) {
  cardContent = cardContent.replace(
    /import \{ cHCardStyles, HERO_CARD_WIDTH \}/,
    `import { cHCardStyles, HERO_CARD_WIDTH, HERO_CARD_HEIGHT }`
  );
  console.log('2. Added HERO_CARD_HEIGHT import');
} else {
  console.log('2. HERO_CARD_HEIGHT already imported');
}

// ─── 3. Remove the recommendation section from AllSubjectsHeroCard ───────────
// This section inflates the panel. Remove it entirely.
cardContent = cardContent.replace(
  /\{\/\* Recommendation - Acción principal \*\/\}\r?\n\s*\{vm\.recommendation \? \([\s\S]*?\) : <View style=\{\{ height: 76 \}\} \/>\}/,
  ''
);

console.log('3. Removed recommendation section from AllSubjectsHeroCard');

fs.writeFileSync(cardPath, cardContent, 'utf8');
console.log('Done.');
