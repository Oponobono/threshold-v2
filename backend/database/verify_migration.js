const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

async function verify() {
  // Check PK types for key tables
  const tables = ['users', 'subjects', 'assessments', 'flashcard_decks', 'flashcards'];
  for (const table of tables) {
    const info = await new Promise((resolve) => {
      db.all(`PRAGMA table_info(${table})`, (err, rows) => resolve(rows || []));
    });
    const pkCol = info.find(c => c.pk === 1);
    console.log(`${table}: PK=${pkCol?.name} type=${pkCol?.type}`);
  }

  // Sample data
  const user = await new Promise((resolve) => {
    db.get('SELECT id, email, name, lastname FROM users LIMIT 1', (err, row) => resolve(row));
  });
  console.log('\nUser:', JSON.stringify(user));

  const subject = await new Promise((resolve) => {
    db.get('SELECT id, user_id, name FROM subjects LIMIT 1', (err, row) => resolve(row));
  });
  console.log('Subject:', JSON.stringify(subject));

  const assessment = await new Promise((resolve) => {
    db.get('SELECT id, user_id, subject_id, name FROM assessments LIMIT 1', (err, row) => resolve(row));
  });
  console.log('Assessment:', JSON.stringify(assessment));

  const deck = await new Promise((resolve) => {
    db.get('SELECT id, user_id, title FROM flashcard_decks LIMIT 1', (err, row) => resolve(row));
  });
  console.log('Deck:', JSON.stringify(deck));

  const card = await new Promise((resolve) => {
    db.get('SELECT id, deck_id, front, back FROM flashcards LIMIT 1', (err, row) => resolve(row));
  });
  console.log('Flashcard:', JSON.stringify(card));

  db.close();
}
verify();
