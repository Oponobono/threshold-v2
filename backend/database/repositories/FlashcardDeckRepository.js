const { db, pool, isProduction } = require('../../database/connection');
const { v4: uuidv4 } = require('uuid');

/**
 * FlashcardDeckRepository
 * Persiste un FlashcardDeckAggregate. 
 * Implementa una transacción SQL real tanto para SQLite (local) como PostgreSQL (Render).
 */
class FlashcardDeckRepository {

  static async saveAggregate(aggregate) {
    const deckId = aggregate.id || uuidv4();

    if (isProduction && pool) {
      // ── TRANSACCIÓN POSTGRESQL (Render) ──
      // Usamos pool.connect() para garantizar que BEGIN, INSERTs y COMMIT
      // se ejecuten sobre exactamente la misma conexión.
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // 1. Insertar deck
        await client.query(
          `INSERT INTO flashcard_decks (id, subject_id, user_id, title, description, sync_version)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [deckId, aggregate.subjectId, aggregate.userId, aggregate.title, aggregate.description, aggregate.syncVersion]
        );

        // 2. Insertar cards secuencialmente
        for (const card of aggregate.cards) {
          const itemType = card.type || 'flashcard';
          const content = card.data || {};
          const front = itemType === 'flashcard' ? (content.front || '') : '';
          const back = itemType === 'flashcard' ? (content.back || '') : '';
          const cardId = uuidv4();
          const contentStr = JSON.stringify(content);
          const hint = card.hint || null;
          const explanation = card.explanation || null;

          await client.query(
            `INSERT INTO flashcards (id, deck_id, user_id, front, back, item_type, content_json, hint, explanation, status, sync_version)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'new', $10)`,
            [cardId, deckId, aggregate.userId, front, back, itemType, contentStr, hint, explanation, aggregate.syncVersion]
          );
        }

        // 3. COMMIT
        await client.query('COMMIT');
        console.log(`[FlashcardDeckRepository] ✅ Transacción Postgres completada: deck ${deckId} con ${aggregate.cards.length} cards`);
        return { ...aggregate, id: deckId };
        
      } catch (err) {
        await client.query('ROLLBACK');
        console.error('[FlashcardDeckRepository] ❌ Error en transacción Postgres:', err.message);
        throw err;
      } finally {
        client.release();
      }
      
    } else {
      // ── TRANSACCIÓN SQLITE (Local) ──
      // db.serialize() garantiza la ejecución secuencial en sqlite3
      return new Promise((resolve, reject) => {
        db.serialize(() => {
          db.run('BEGIN TRANSACTION', (beginErr) => {
            if (beginErr) return reject(beginErr);
          });

          let failed = false;

          // 1. Insertar deck
          db.run(
            `INSERT INTO flashcard_decks (id, subject_id, user_id, title, description, sync_version)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [deckId, aggregate.subjectId, aggregate.userId, aggregate.title, aggregate.description, aggregate.syncVersion],
            function (deckErr) {
              if (deckErr) {
                failed = true;
                console.error('[FlashcardDeckRepository] ❌ Error insertando deck:', deckErr.message);
                db.run('ROLLBACK', () => reject(deckErr));
              }
            }
          );

          // 2. Insertar cards
          for (const card of aggregate.cards) {
            const itemType = card.type || 'flashcard';
            const content = card.data || {};
            const front = itemType === 'flashcard' ? (content.front || '') : '';
            const back = itemType === 'flashcard' ? (content.back || '') : '';
            const cardId = uuidv4();
            const contentStr = JSON.stringify(content);
            const hint = card.hint || null;
            const explanation = card.explanation || null;

            db.run(
              `INSERT INTO flashcards (id, deck_id, user_id, front, back, item_type, content_json, hint, explanation, status, sync_version)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?)`,
              [cardId, deckId, aggregate.userId, front, back, itemType, contentStr, hint, explanation, aggregate.syncVersion],
              function (cardErr) {
                if (cardErr && !failed) {
                  failed = true;
                  console.error('[FlashcardDeckRepository] ❌ Error insertando card:', cardErr.message);
                  db.run('ROLLBACK', () => reject(cardErr));
                }
              }
            );
          }

          // 3. COMMIT
          db.run('COMMIT', (commitErr) => {
            if (commitErr) {
              db.run('ROLLBACK', () => reject(commitErr));
            } else if (!failed) {
              console.log(`[FlashcardDeckRepository] ✅ Transacción SQLite completada: deck ${deckId} con ${aggregate.cards.length} cards`);
              resolve({ ...aggregate, id: deckId });
            }
          });
        });
      });
    }
  }
}

module.exports = FlashcardDeckRepository;
