const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'Threshold.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  }
  
  // List all tables
  db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
    console.log('TABLES:', JSON.stringify(tables, null, 2));
    
    // Get first user
    db.get('SELECT id, username, name FROM users LIMIT 1', (err, user) => {
      if (err) console.error('USER ERROR:', err.message);
      console.log('USER:', JSON.stringify(user));
      
      // Get first subject
      db.get('SELECT id, name FROM subjects LIMIT 1', (err, subject) => {
        if (err) console.error('SUBJECT ERROR:', err.message);
        console.log('SUBJECT:', JSON.stringify(subject));
        
        // Get assessments count
        db.get('SELECT COUNT(*) as count FROM assessments', (err, count) => {
          if (err) console.error('COUNT ERROR:', err.message);
          console.log('ASSESSMENTS COUNT:', JSON.stringify(count));
          
          // Get sample assessments
          db.all('SELECT id, name, subject_id FROM assessments LIMIT 3', (err, assessments) => {
            if (err) console.error('ASSESSMENTS ERROR:', err.message);
            console.log('SAMPLE ASSESSMENTS:', JSON.stringify(assessments, null, 2));
            db.close();
            process.exit(0);
          });
        });
      });
    });
  });
});
