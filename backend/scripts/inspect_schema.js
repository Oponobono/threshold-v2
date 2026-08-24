const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.resolve(__dirname, '..', 'database.sqlite'));

db.serialize(() => {
  db.all('PRAGMA table_info(group_memberships)', (e, r) => {
    console.log('group_memberships cols:', r ? r.map(c => c.name) : e);
  });
  db.all('PRAGMA table_info(flashcard_decks)', (e, r) => {
    console.log('flashcard_decks cols:', r ? r.map(c => c.name) : e);
  });
  db.all('PRAGMA table_info(groups)', (e, r) => {
    console.log('groups cols:', r ? r.map(c => c.name) : e);
  });
  db.all(
    'SELECT gm.id, gm.group_pin_id, gm.role FROM group_memberships gm WHERE gm.user_id = ?',
    ['cd960c6e-63e6-4c72-9a4f-20b06d667a19'],
    (e, r) => { console.log('memberships (no filter):', e || JSON.stringify(r)); db.close(); }
  );
});
