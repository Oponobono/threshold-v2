// Script to test profile update functionality
const { db, initializeDb } = require('./db');

// Initialize DB and test
(async () => {
  try {
    // Initialize the database
    await initializeDb();
    
    console.log('\n=== Testing Profile Update ===\n');
    
    // Get all users
    db.all('SELECT id, email, username, share_pin FROM users LIMIT 5', [], (err, users) => {
      if (err) {
        console.error('Error fetching users:', err);
        process.exit(1);
      }
      
      console.log('Existing users:');
      console.log(users);
      
      if (users.length === 0) {
        console.log('No users found. Creating test user...');
        process.exit(0);
      }
      
      const testUserId = users[0].id;
      const testUsername = `testuser_${Date.now()}`;
      
      console.log(`\nTesting update with userId: ${testUserId}`);
      console.log(`New username: ${testUsername}`);
      
      // Test 1: Update with valid data
      const updatePayload = {
        name: 'Test',
        lastname: 'User',
        username: testUsername,
        major: 'Computer Science'
      };
      
      console.log('\nPayload:', updatePayload);
      
      const values = [];
      const updates = [];
      
      Object.entries(updatePayload).forEach(([key, value]) => {
        if (value !== undefined) {
          updates.push(`${key} = ?`);
          values.push(value);
        }
      });
      
      values.push(testUserId);
      const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
      
      console.log('Query:', query);
      console.log('Values:', values);
      
      db.run(query, values, function(err) {
        if (err) {
          console.error('❌ Error updating profile:', err.message);
          console.error('Error code:', err.code);
        } else {
          console.log(`✓ Updated ${this.changes} rows`);
          
          // Fetch updated user
          db.get('SELECT id, email, username, share_pin FROM users WHERE id = ?', [testUserId], (getErr, user) => {
            if (getErr) {
              console.error('Error fetching user:', getErr);
            } else {
              console.log('\nUpdated user:', user);
            }
            process.exit(0);
          });
        }
      });
    });
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
