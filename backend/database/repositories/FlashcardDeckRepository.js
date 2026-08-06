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
          `INSERT INTO flashcard_decks (id, subject_id, user_id, title, topic, description, sync_version)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [deckId, aggregate.subjectId, aggregate.userId, aggregate.title, aggregate.topic, aggregate.description, aggregate.syncVersion]
        );

        // 2. Insertar cards secuencialmente
        for (const card of aggregate.cards) {
          const itemType = card.type || 'flashcard';
          const content = card.data || {};
          const front = itemType === 'flashcard' ? (content.front || '') : '';
          const back = itemType === 'flashcard' ? (content.back || '') : '';
          // IMPORTANTE: preservar el id de la card del aggregate (idempotencia del
          // Sync Protocol). Si aquí se generara un uuid nuevo, la respuesta al
          // cliente tendría ids ≠ ids de la BD → el delta sync crearía duplicados.
          const cardId = card.id || uuidv4();
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
            `INSERT INTO flashcard_decks (id, subject_id, user_id, title, topic, description, sync_version)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [deckId, aggregate.subjectId, aggregate.userId, aggregate.title, aggregate.topic, aggregate.description, aggregate.syncVersion],
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
            // IMPORTANTE: preservar el id de la card del aggregate (idempotencia del
            // Sync Protocol). Si aquí se generara un uuid nuevo, la respuesta al
            // cliente tendría ids ≠ ids de la BD → el delta sync crearía duplicados.
            const cardId = card.id || uuidv4();
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

  /**
   * addAnchorCard
   * Persiste un AnchorCardAggregate como una sola fila en la tabla flashcards.
   * Incluye user_id y sync_version correctos para que el Delta Sync la detecte.
   *
   * Regla 8: el Repository no conoce el LLM ni el InferenceRouter.
   * @param {import('../../services/ai/models/AnchorCardAggregate')} aggregate
   */
  static async addAnchorCard(aggregate) {
    const contentStr = JSON.stringify({ front: aggregate.front, back: aggregate.back });

    if (isProduction && pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `INSERT INTO flashcards
             (id, deck_id, user_id, front, back, item_type, content_json,
              hint, explanation, status, is_atomic, sync_version)
           VALUES ($1, $2, $3, $4, $5, 'flashcard', $6, $7, $8, 'new', 1, $9)`,
          [
            aggregate.id,
            aggregate.deckId,
            aggregate.userId,
            aggregate.front,
            aggregate.back,
            contentStr,
            aggregate.hint,
            aggregate.explanation,
            aggregate.syncVersion,
          ]
        );
        await client.query('COMMIT');
        console.log(`[FlashcardDeckRepository] ✅ Ancla cognitiva persistida (Postgres): ${aggregate.id}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error('[FlashcardDeckRepository] ❌ Error persistiendo ancla (Postgres):', err.message);
        throw err;
      } finally {
        client.release();
      }
    } else {
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO flashcards
             (id, deck_id, user_id, front, back, item_type, content_json,
              hint, explanation, status, is_atomic, sync_version)
           VALUES (?, ?, ?, ?, ?, 'flashcard', ?, ?, ?, 'new', 1, ?)`,
          [
            aggregate.id,
            aggregate.deckId,
            aggregate.userId,
            aggregate.front,
            aggregate.back,
            contentStr,
            aggregate.hint,
            aggregate.explanation,
            aggregate.syncVersion,
          ],
          function (err) {
            if (err) {
              console.error('[FlashcardDeckRepository] ❌ Error persistiendo ancla (SQLite):', err.message);
              return reject(err);
            }
            console.log(`[FlashcardDeckRepository] ✅ Ancla cognitiva persistida (SQLite): ${aggregate.id}`);
            resolve();
          }
        );
      });
    }
  }
}

module.exports = FlashcardDeckRepository;
