const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'mobile', 'app', '(tabs)', 'index.tsx');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Find key line numbers by content matching
const orientCommentLine = lines.findIndex(l => l.includes('ORIENTATION & TODAY FOCUS'));
const ecoCommentLine = lines.findIndex(l => l.includes('ECOSYSTEM'));
const studyToolsLine = lines.findIndex(l => l.includes('5. STUDY TOOLS'));
const createSubjectLine = lines.findIndex(l => l.includes('<CreateSubjectModal'));

console.log('Orientation start:', orientCommentLine + 1);
console.log('Ecosystem start:', ecoCommentLine + 1);
console.log('Study tools start:', studyToolsLine + 1);
console.log('CreateSubject line:', createSubjectLine + 1);

// Orientation section: starts 1 line before its comment (the === block), ends at its closing </View>
const orientStartLine = orientCommentLine - 1;
let orientEndLine = -1;
let viewCloseCount = 0;
for (let i = orientCommentLine; i < ecoCommentLine; i++) {
  if (lines[i].trim() === '</View>') {
    viewCloseCount++;
    if (viewCloseCount === 3) {
      orientEndLine = i;
      break;
    }
  }
}
console.log('Orientation end:', orientEndLine + 1);

// Ecosystem section: starts 1 line before its comment, ends at last </View> before study tools
const ecoStartLine = ecoCommentLine - 1;
let ecoEndLine = -1;
for (let i = ecoCommentLine; i < studyToolsLine; i++) {
  if (lines[i].trim() === '</View>') {
    ecoEndLine = i;
  }
}
console.log('Ecosystem end:', ecoEndLine + 1);

// Split content
const beforeOrient = lines.slice(0, orientStartLine).join('\n');
const orientBlock = lines.slice(orientStartLine, orientEndLine + 1).join('\n');
const ecoBlock = lines.slice(ecoStartLine, ecoEndLine + 1).join('\n');
const afterEco = lines.slice(ecoEndLine + 1).join('\n');

console.log('Blocks:', {
  beforeOrient: beforeOrient.length,
  orientBlock: orientBlock.length,
  ecoBlock: ecoBlock.length,
  afterEco: afterEco.length,
});

// === Extract LO SIGUIENTE grid from orientation ===
const upNextTitle = '<Text style={[styles.sectionTitle, { marginTop: 24 }]}';
const upNextStart = orientBlock.indexOf(upNextTitle);
const gridOpen = orientBlock.indexOf('<View style={styles.grid}>', upNextStart);
const gridClose = orientBlock.indexOf('</View>', gridOpen) + 7;
const upNextGrid = orientBlock.substring(upNextStart, gridClose);

const loSiguiente = [
  '        {/* ====================================================== */}',
  '        {/* LO SIGUIENTE                                          */}',
  '        {/* ====================================================== */}',
  '        <View style={styles.section}>',
  '          ' + upNextGrid.trim(),
  '        </View>',
].join('\n');

// === Extract ESTADO DEL APRENDIZAJE (KnowledgeHealth + DailyReview) ===
const khStart = orientBlock.indexOf('<KnowledgeHealthCard');
const khClose = orientBlock.indexOf('/>', khStart) + 2;
const khBlock = orientBlock.substring(khStart, khClose);

const drStart = orientBlock.indexOf('<DailyReviewCard');
const drEnd = orientBlock.indexOf('/>', drStart) + 2;
const drBlock = orientBlock.substring(drStart, drEnd);

const estado = [
  '        {/* ====================================================== */}',
  '        {/* ESTADO DEL APRENDIZAJE                                 */}',
  '        {/* ====================================================== */}',
  '        <View style={styles.section}>',
  '          ' + khBlock.trim(),
  '          <View style={{ marginTop: 20 }}>',
  '            ' + drBlock.trim(),
  '          </View>',
  '        </View>',
].join('\n');

// === Update ecosystem header ===
const ecoUpdated = ecoBlock.replace(
  '{/* ECOSYSTEM                                              */}',
  '{/* CURSOS Y MATERIAS                                    */}'
);

// === Assemble ===
const newContent = beforeOrient + '\n' + ecoUpdated + '\n\n' + loSiguiente + '\n\n' + estado + '\n' + afterEco;

console.log('\nSize check:');
console.log('Original:', content.length);
console.log('New:', newContent.length);
console.log('Diff:', newContent.length - content.length);

// Verify boundaries before writing
const beforeMatch = content.startsWith(beforeOrient);
const afterMatch = content.endsWith(afterEco);
console.log('Before match:', beforeMatch);
console.log('After match:', afterMatch);

if (beforeMatch && afterMatch) {
  fs.writeFileSync(filePath, newContent, 'utf8');
  console.log('✓ File written successfully');
  console.log('Original size:', content.length);
  console.log('New size:', newContent.length);
} else {
  console.log('✗ Aborted - boundary mismatch');
}
