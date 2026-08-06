const { v4: uuidv4 } = require('uuid');

class FlashcardDeckAggregate {
  constructor({ title, topic, subjectId, userId, mode, cards, description, syncVersion }) {
    this.id = uuidv4();
    this.title = title;
    this.topic = topic;
    this.subjectId = subjectId;
    this.userId = userId;
    this.mode = mode;
    this.description = description || 'Mazo generado autom�ticamente por Zyren';
    this.syncVersion = syncVersion;
    this.cards = cards.map(c => ({ id: uuidv4(), deckId: this.id, ...c }));
  }
}

module.exports = FlashcardDeckAggregate;
