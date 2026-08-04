const { db } = require('../../db');
const { v4: uuidv4 } = require('uuid');

/**
 * FlashcardDeckRepository
 * Persiste un FlashcardDeckAggregate en SQLite usando una transacción real
 * (BEGIN → INSERT deck → INSERT cards × N → COMMIT / ROLLBACK).
 */
class FlashcardDeckRepository {

  static async saveAggregate(aggregate) {
    return new Promise((resolve, reject) => {
      const deckId = aggregate.id || uuidv4();

      db.serialize(() => {
        db.run('BEGIN TRANSACTION', (beginErr) => {
          if (beginErr) return reject(beginErr);
        });

        let failed = false;

        // 1. Insertar el deck
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

        // 2. Insertar cada card (serializado dentro de la transacción abierta)
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

        // 3. COMMIT — solo si ninguna instrucción anterior falló
        db.run('COMMIT', (commitErr) => {
          if (commitErr) {
            db.run('ROLLBACK', () => reject(commitErr));
          } else if (!failed) {
            console.log(`[FlashcardDeckRepository] ✅ Transacción completada: deck ${deckId} con ${aggregate.cards.length} cards`);
            resolve({ ...aggregate, id: deckId });
          }
        });
      });
    });
  }
}

module.exports = FlashcardDeckRepository;
