class DeckPlan {
  constructor({ mode, count, concepts = [] }) {
    this.mode = mode;
    this.count = count;
    this.concepts = concepts;
  }
}

module.exports = DeckPlan;
