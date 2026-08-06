const FlashcardDeckAggregate = require('../../models/FlashcardDeckAggregate');
const FlashcardResponseParser = require('./FlashcardResponseParser');

class DeckBuilder {
  static build(request, validatedCards, syncVersion, generatedTopic) {
    return new FlashcardDeckAggregate({
      title: request.title,
      topic: FlashcardResponseParser.normalizeTopic(request.topic) ?? generatedTopic ?? null,
      subjectId: request.subjectId,
      userId: request.userId,
      mode: request.mode,
      cards: validatedCards,
      syncVersion
    });
  }
}

module.exports = DeckBuilder;
