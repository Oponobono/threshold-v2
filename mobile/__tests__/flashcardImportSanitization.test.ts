describe('JSON Sanitization', () => {
  const sanitizeJSON = (obj: any): any => {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(sanitizeJSON);
    
    const clean: any = {};
    for (const key in obj) {
      if (
        Object.prototype.hasOwnProperty.call(obj, key) &&
        key !== '__proto__' &&
        key !== 'constructor' &&
        key !== 'prototype'
      ) {
        clean[key] = sanitizeJSON(obj[key]);
      }
    }
    return clean;
  };

  it('debería mantener las propiedades válidas sin alteraciones', () => {
    const validData = {
      title: 'Math Deck',
      cards: [{ front: '1+1', back: '2' }]
    };
    const sanitized = sanitizeJSON(validData);
    expect(sanitized).toEqual(validData);
  });

  it('debería eliminar claves de prototype pollution como __proto__', () => {
    const maliciousData = JSON.parse('{"title":"Hacked","__proto__":{"isAdmin":true}}');
    const sanitized = sanitizeJSON(maliciousData);
    
    expect(sanitized.title).toBe('Hacked');
    expect(sanitized.__proto__).not.toEqual({ isAdmin: true });
    // the __proto__ of a pure object should be just Object.prototype
  });

  it('debería eliminar claves de constructor', () => {
    const maliciousData = {
      constructor: { name: 'Function' },
      safeData: 'Hello'
    };
    const sanitized = sanitizeJSON(maliciousData);
    
    expect(sanitized.safeData).toBe('Hello');
    expect(sanitized.constructor).toBe(Object); // Standard object constructor, not the malicious one
  });
  
  it('debería sanitizar arreglos correctamente preservando el orden', () => {
    const arrayData = [
      { id: 1 },
      JSON.parse('{"id":2, "__proto__":{"polluted":true}}')
    ];
    
    const sanitized = sanitizeJSON(arrayData);
    
    expect(Array.isArray(sanitized)).toBe(true);
    expect(sanitized.length).toBe(2);
    expect(sanitized[0].id).toBe(1);
    expect(sanitized[1].id).toBe(2);
    expect(sanitized[1].__proto__).not.toHaveProperty('polluted');
  });
});
