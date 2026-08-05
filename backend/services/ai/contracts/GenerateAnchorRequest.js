/**
 * GenerateAnchorRequest
 * Contrato de entrada a AnchorCapability.
 */
class GenerateAnchorRequest {
  constructor({ deckId, userId, conceptA, conceptB, reason, provider = 'groq' }) {
    this.deckId = deckId;
    this.userId = userId;
    this.conceptA = conceptA;
    this.conceptB = conceptB;
    this.reason = reason || 'Similitud teórica';
    this.provider = provider;
  }

  isValid() {
    return !!this.deckId && !!this.userId && !!this.conceptA && !!this.conceptB;
  }
}

module.exports = GenerateAnchorRequest;
