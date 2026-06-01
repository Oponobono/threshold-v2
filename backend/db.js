const { db, pool, isProduction } = require('./database/connection');

const initializeDb = async () => {
  if (isProduction) {
    const initializePostgres = require('./database/postgres');
    await initializePostgres(pool);
  } else {
    const initializeSqlite = require('./database/sqlite');
    await initializeSqlite(db);
  }
};

module.exports = { db, initializeDb };


