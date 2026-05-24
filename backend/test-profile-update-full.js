// Script to test profile update with all fields from frontend
const { db, initializeDb } = require('./db');

// Initialize DB and test
(async () => {
  try {
    // Initialize the database
    await initializeDb();
    
    console.log('\n=== Testing Profile Update With All Fields ===\n');
    
    // Get the test user
    db.get('SELECT id, email, username, share_pin FROM users WHERE email = ?', ['user'], (err, user) => {
      if (err) {
        console.error('Error fetching user:', err);
        process.exit(1);
      }
      
      if (!user) {
        console.log('Test user not found');
        process.exit(1);
      }
      
      const testUserId = user.id;
      console.log(`Test user: ${user.email} (ID: ${testUserId})`);
      
      // Simulate the exact payload from frontend
      const frontendPayload = {
        name: 'Juan',
        lastname: 'Pérez',
        username: `newusername_${Date.now()}`,
        university: 'Universidad Nacional',
        major: 'Ingeniería en Sistemas',
        semester: '8',
        study_goal: 'Dominar algoritmos',
        active_grading_version_id: 1,
        approval_threshold: 70,
        // Note: share_pin is NOT included because !profile?.share_pin would be false
        // profile_image would be empty {} in most cases
      };
      
      console.log('\nFrontend Payload:', JSON.stringify(frontendPayload, null, 2));
      
      // Build the query like the controller does
      const values = [];
      const updates = [];
      const fields = ['name', 'lastname', 'username', 'major', 'university', 'semester', 'study_goal', 'share_pin', 'display_name', 'profile_image', 'active_grading_version_id', 'approval_threshold'];
      
      fields.forEach(field => {
        if (frontendPayload[field] !== undefined) {
          updates.push(`${field} = ?`);
          values.push(frontendPayload[field]);
        }
      });
      
      if (updates.length === 0) {
        console.log('No fields to update');
        process.exit(1);
      }
      
      values.push(testUserId);
      const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
      
      console.log('\nGenerated Query:', query);
      console.log('Query Values:', values);
      
      db.run(query, values, function(err) {
        if (err) {
          console.error('❌ Error updating profile:');
          console.error('  Message:', err.message);
          console.error('  Code:', err.code);
          console.error('  Is UNIQUE constraint?', err.message.includes('UNIQUE'));
          process.exit(1);
        } else {
          console.log(`\n✓ Successfully updated ${this.changes} rows`);
          
          // Fetch updated user
          db.get('SELECT * FROM users WHERE id = ?', [testUserId], (getErr, updatedUser) => {
            if (getErr) {
              console.error('Error fetching user:', getErr);
            } else {
              console.log('\nUpdated user fields:');
              console.log('- name:', updatedUser.name);
              console.log('- lastname:', updatedUser.lastname);
              console.log('- username:', updatedUser.username);
              console.log('- university:', updatedUser.university);
              console.log('- major:', updatedUser.major);
              console.log('- semester:', updatedUser.semester);
              console.log('- study_goal:', updatedUser.study_goal);
              console.log('- active_grading_version_id:', updatedUser.active_grading_version_id);
              console.log('- approval_threshold:', updatedUser.approval_threshold);
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
