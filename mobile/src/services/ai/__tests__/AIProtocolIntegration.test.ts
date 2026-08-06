import { extractDirectives } from '../core/ResponseInterpreter';
import { aiInteractionCoordinator } from '../AIInteractionCoordinator';
import { AIResponse } from '../providers/AIProvider';

// ─── Mock FlashcardDomainService (the single persistence gate) ────────────────

const mockSaveGeneratedDeck = jest.fn().mockResolvedValue({ id: 'test-deck-id', title: 'Test Deck' });

jest.mock('../../domain/FlashcardDomainService', () => ({
  flashcardDomainService: { saveGeneratedDeck: (...args: any[]) => mockSaveGeneratedDeck(...args) },
  FlashcardDomainService: class {},
}));

// ─── FlashcardCapability mock (avoids LLM call inside the handler) ────────────

jest.mock('../capabilities/FlashcardCapability', () => ({
  flashcardCapability: {
    generate: jest.fn().mockResolvedValue([
      { front: 'What is mitosis?', back: 'Cell division producing two identical cells.' },
      { front: 'What is meiosis?', back: 'Cell division producing four gametes.' },
    ]),
  },
}));


// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAIResponse(rawContent: string): AIResponse {
  const { cleanContent, directives } = extractDirectives(rawContent);
  return {
    content: cleanContent,
    provider: 'cloud',
    model: 'groq:llama3',
    latencyMs: 42,
    ...(directives.length > 0 && { directives }),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('AI Protocol Integration Pipeline', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Happy path: directive triggers full persistence chain ──────────────────

  describe('Happy path — create_deck directive', () => {
    it('persiste el mazo y las tarjetas cuando el modelo emite create_deck', async () => {
      const rawResponse =
        'Claro, he generado un mazo para ti.\n' +
        '%%DIRECTIVE%%{"version":1,"type":"create_deck","mode":"flashcard","count":2}%%END%%\n' +
        'Revísalo en la sección de Flashcards.';

      const response = makeAIResponse(rawResponse);

      // 1. Directive must be extracted
      expect(response.directives).toHaveLength(1);
      expect(response.directives![0].type).toBe('create_deck');

      // 2. Content must be clean (no directive block)
      expect(response.content).not.toContain('%%DIRECTIVE%%');
      expect(response.content).toContain('Claro, he generado un mazo');

      // 3. Coordinator dispatches through the full pipeline
      await aiInteractionCoordinator.handle(response, {
        subjectId: 'subj-456',
        userId: 'user-123',
        contextText: 'Texto de biología celular sobre mitosis y meiosis.',
      });

      // 4. FlashcardDomainService.saveGeneratedDeck was called once
      expect(mockSaveGeneratedDeck).toHaveBeenCalledTimes(1);
      const saveArg = mockSaveGeneratedDeck.mock.calls[0][0];
      expect(saveArg).toMatchObject({
        subjectId: 'subj-456',
      });
      expect(typeof saveArg.title).toBe('string');
      expect(Array.isArray(saveArg.cards)).toBe(true);
      expect(saveArg.cards.length).toBeGreaterThan(0);
    });

    it('el content es entregado correctamente aunque no haya directivas', async () => {
      const rawResponse = 'La mitosis es el proceso de división celular en organismos eucariotas.';
      const response = makeAIResponse(rawResponse);

      expect(response.content).toBe(rawResponse);
      expect(response.directives).toBeUndefined();

      // No side effects — coordinator returns early
      await aiInteractionCoordinator.handle(response, {
        subjectId: 'subj-456',
        userId: 'user-123',
      });

      expect(mockSaveGeneratedDeck).not.toHaveBeenCalled();
    });
  });

  // ── Negative path: malformed directive — pipeline must not throw ───────────

  describe('Negative path — malformed directive', () => {
    it('no lanza excepción si el JSON de la directiva está malformado', async () => {
      const rawResponse =
        'Claro, aquí tienes.\n' +
        '%%DIRECTIVE%%{"version":1, "type": }%%END%%\n' +  // intentionally broken JSON
        'Espero que te sea útil.';

      const warnMock = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const response = makeAIResponse(rawResponse);

      // 1. ResponseInterpreter must NOT throw
      expect(response.directives).toBeUndefined(); // empty → not spread into response

      // 2. Content must still arrive
      expect(response.content).toContain('Claro, aquí tienes.');
      expect(response.content).toContain('Espero que te sea útil.');
      expect(response.content).not.toContain('%%DIRECTIVE%%');

      // 3. Coordinator must not throw either
      await expect(
        aiInteractionCoordinator.handle(response, { subjectId: '1', userId: '1' })
      ).resolves.not.toThrow();

      // 4. No persistence side effects
      expect(mockSaveGeneratedDeck).not.toHaveBeenCalled();

      // 5. A warning was logged
      expect(warnMock).toHaveBeenCalled();

      warnMock.mockRestore();
    });

    it('no lanza excepción si el contexto está incompleto (falta userId/subjectId)', async () => {
      const rawResponse = '%%DIRECTIVE%%{"version":1,"type":"create_deck","count":5}%%END%%';
      const warnMock = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const response = makeAIResponse(rawResponse);

      // Missing context — handler should warn and return, not throw
      await expect(
        aiInteractionCoordinator.handle(response, {})
      ).resolves.not.toThrow();

      expect(mockSaveGeneratedDeck).not.toHaveBeenCalled();
      expect(warnMock).toHaveBeenCalledWith(
        expect.stringContaining('Missing subjectId or userId')
      );

      warnMock.mockRestore();
    });
  });

  // ── Contract: directive version is preserved end-to-end ───────────────────

  describe('Protocol invariants', () => {
    it('preserva el campo version de la directiva a lo largo del pipeline', () => {
      const rawResponse = '%%DIRECTIVE%%{"version":1,"type":"create_deck"}%%END%%';
      const { directives } = extractDirectives(rawResponse);

      expect(directives[0].version).toBe(1);
    });

    it('soporta múltiples directivas en una misma respuesta', async () => {
      const rawResponse =
        '%%DIRECTIVE%%{"version":1,"type":"create_deck","count":3}%%END%%\n' +
        '%%DIRECTIVE%%{"version":1,"type":"create_anchor"}%%END%%';

      const { directives } = extractDirectives(rawResponse);

      expect(directives).toHaveLength(2);
      expect(directives[0].type).toBe('create_deck');
      expect(directives[1].type).toBe('create_anchor');
    });
  });
});
