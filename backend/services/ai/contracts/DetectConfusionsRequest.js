/**
 * DetectConfusionsRequest
 * Contrato de entrada a ConfusionDetectionCapability.
 */
class DetectConfusionsRequest {
  constructor({ deckId, userId }) {
    this.deckId = deckId;
    this.userId = userId;
  }

  isValid() {
    return !!this.deckId && !!this.userId;
  }
}

module.exports = DetectConfusionsRequest;
