const FlashcardDeckAggregate = require('../../models/FlashcardDeckAggregate');

class DeckBuilder {
  static build(request, validatedCards, syncVersion) {
    return new FlashcardDeckAggregate({
      title: request.title,
      subjectId: request.subjectId,
      userId: request.userId,
      mode: request.mode,
      cards: validatedCards,
      syncVersion
    });
  }
}

module.exports = DeckBuilder;
