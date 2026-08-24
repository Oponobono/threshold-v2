const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '..', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.get('SELECT id, email, username FROM users WHERE email = ?', ['oponobono@gmail.com'], (err, user) => {
    if (err) { console.error(err); return; }
    console.log('User:', JSON.stringify(user));
    if (!user) { db.close(); return; }

    db.all(
      `SELECT gm.id, gm.group_pin_id, gm.role, g.name as group_name
       FROM group_memberships gm
       JOIN groups g ON gm.group_pin_id = g.pin_id
       WHERE gm.user_id = ? AND (gm.deleted_at IS NULL OR gm.deleted_at = '')`,
      [user.id],
      (err2, memberships) => {
        if (err2) console.error(err2);
        console.log('\nGroup memberships:', JSON.stringify(memberships, null, 2));

        db.all(
          'SELECT id, name, subject_id, card_count FROM flashcard_decks WHERE user_id = ? LIMIT 10',
          [user.id],
          (err3, decks) => {
            if (err3) console.error(err3);
            console.log('\nFlashcard decks:', JSON.stringify(decks, null, 2));

            db.all(
              'SELECT id, name FROM subjects WHERE user_id = ? LIMIT 10',
              [user.id],
              (err4, subjects) => {
                if (err4) console.error(err4);
                console.log('\nSubjects:', JSON.stringify(subjects, null, 2));

                if (memberships && memberships.length > 0) {
                  const pinId = memberships[0].group_pin_id;
                  db.all(
                    `SELECT gm2.user_id, u.username, u.display_name FROM group_memberships gm2
                     JOIN users u ON gm2.user_id = u.id
                     WHERE gm2.group_pin_id = ? AND (gm2.deleted_at IS NULL OR gm2.deleted_at = '')`,
                    [pinId],
                    (err5, members) => {
                      if (err5) console.error(err5);
                      console.log(`\nAll members of group ${pinId}:`, JSON.stringify(members, null, 2));
                      db.close();
                    }
                  );
                } else {
                  db.close();
                }
              }
            );
          }
        );
      }
    );
  });
});
