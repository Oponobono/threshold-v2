class Validator {
  static validateStructural(cards) {
    if (!Array.isArray(cards)) throw new Error('El resultado no es un array');
    return cards.map(c => {
      if (!c.type) c.type = 'flashcard';
      if (!c.data) c.data = {};
      return c;
    });
  }

  static validatePedagogical(cards) {
    // Evaluar reglas como 'no circularidad', 'calidad del hint'
    return cards; // Passthru temporal
  }

  static validate(cards) {
    const structurallyValid = this.validateStructural(cards);
    return this.validatePedagogical(structurallyValid);
  }
}

module.exports = Validator;
