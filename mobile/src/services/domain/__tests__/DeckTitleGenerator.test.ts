import { DeckTitleGenerator } from '../DeckTitleGenerator';

describe('DeckTitleGenerator', () => {
  describe('buildTitle', () => {
    it('usa formato "Tema — Fuente" cuando hay topic', () => {
      expect(DeckTitleGenerator.buildTitle({ topic: 'Expo en React', source: 'Programación I' }))
        .toBe('Expo en React — Programación I');
    });

    it('omite el prefijo si no hay topic', () => {
      expect(DeckTitleGenerator.buildTitle({ source: 'Programación I' })).toBe('Programación I');
      expect(DeckTitleGenerator.buildTitle({ topic: null, source: 'Programación I' })).toBe('Programación I');
      expect(DeckTitleGenerator.buildTitle({ topic: '', source: 'Programación I' })).toBe('Programación I');
    });

    it('trata "Zyren" como no-tema (default de motores sin topic real)', () => {
      expect(DeckTitleGenerator.buildTitle({ topic: 'Zyren', source: 'Física II' })).toBe('Física II');
      expect(DeckTitleGenerator.buildTitle({ topic: 'zyren', source: 'Física II' })).toBe('Física II');
    });

    it('es determinista: mismo input, mismo título', () => {
      const input = { topic: 'Integrales', source: 'Cálculo' };
      const a = DeckTitleGenerator.buildTitle(input);
      const b = DeckTitleGenerator.buildTitle({ ...input });
      expect(a).toBe(b);
      expect(a).toBe('Integrales — Cálculo');
    });
  });

  describe('truncateSource', () => {
    it('no trunca cadenas cortas', () => {
      expect(DeckTitleGenerator.truncateSource('Corto')).toBe('Corto');
    });

    it('trunca con elipsis y mantiene longitud <= maxLength', () => {
      const long = 'a'.repeat(100);
      const truncated = DeckTitleGenerator.truncateSource(long, 50);
      expect(truncated.length).toBeLessThanOrEqual(50);
      expect(truncated.endsWith('…')).toBe(true);
    });
  });
});
