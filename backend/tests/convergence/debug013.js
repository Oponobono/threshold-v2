const TestEnvironment = require('./TestEnvironment');
const { v4: uuidv4 } = require('uuid');

(async () => {
  const env = new TestEnvironment();
  await env.start();
  try {
    const groupPinId2 = 'PIN2-' + Math.floor(Math.random() * 9000 + 1000);
    const groupId2 = uuidv4();
    const membershipId2 = uuidv4();
    await new Promise((resolve) => env.backendDb.run(
      `INSERT INTO groups (id, group_pin_id, name, is_public, creator_user_id, sync_version) VALUES (?, ?, 'Shared Group', 1, 'other-user', 1)`,
      [groupId2, groupPinId2], () => resolve()
    ));
    await new Promise((resolve) => env.backendDb.run(`UPDATE sync_version SET version = 2 WHERE id = 1`, [], () => resolve()));
    
    const A = await env.createDevice('A');
    await A.sync();
    console.log('Cursor after initial:', A.lastSyncVersion);
    
    await A.op('group_memberships', 'CREATE', membershipId2, { group_pin_id: groupPinId2, role: 'member' });
    await A.sync();
    console.log('Cursor after delta:', A.lastSyncVersion);
    
    const mems = await new Promise(r => env.backendDb.all('SELECT * FROM group_memberships', (err, rows) => r(rows)));
    console.log('Backend memberships:', mems);
    
    const groups = await new Promise(r => env.backendDb.all('SELECT * FROM groups', (err, rows) => r(rows)));
    console.log('Backend groups:', groups);
    
    const deltaQuery = `
      SELECT g.* FROM groups g
      WHERE g.group_pin_id IN (
        SELECT group_pin_id FROM group_memberships WHERE user_id = ? AND sync_version > ?
      )
    `;
    const res = await new Promise(r => env.backendDb.all(deltaQuery, [env.userId, 2], (err, rows) => r(rows)));
    console.log('Delta query result:', res);
    
  } finally {
    await env.stop();
  }
})();
