import { extractDirectives } from '../core/ResponseInterpreter';
import { directiveRegistry, DirectiveHandler } from '../directives/DirectiveHandlerRegistry';
import { AIDirective } from '../providers/AIProvider';

describe('Threshold Directive Protocol (TDP)', () => {
  describe('ResponseInterpreter', () => {
    it('extrae correctamente una directiva válida', () => {
      const response = `Claro, aquí tienes.\n%%DIRECTIVE%%{"version":1,"type":"create_deck","count":5}%%END%%\nEspero sirva.`;
      const { cleanContent, directives } = extractDirectives(response);
      
      expect(cleanContent).toBe('Claro, aquí tienes.\n\nEspero sirva.');
      expect(directives).toHaveLength(1);
      expect(directives[0]).toEqual({ version: 1, type: 'create_deck', count: 5 });
    });

    it('ignora texto sin directivas', () => {
      const response = `Esta es una respuesta normal de chat sin nada raro.`;
      const { cleanContent, directives } = extractDirectives(response);
      
      expect(cleanContent).toBe(response);
      expect(directives).toHaveLength(0);
    });

    it('no rompe el flujo si el JSON está malformado y devuelve directives: []', () => {
      const response = `Aquí tienes.\n%%DIRECTIVE%%{"version":1, "type": }%%END%%`;
      // Temporarily mock console.warn to keep test output clean
      const warnMock = jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      const { cleanContent, directives } = extractDirectives(response);
      
      expect(cleanContent).toBe('Aquí tienes.');
      expect(directives).toHaveLength(0);
      expect(warnMock).toHaveBeenCalled();
      
      warnMock.mockRestore();
    });

    it('extrae correctamente múltiples directivas', () => {
      const response = `
      Primera directiva:
      %%DIRECTIVE%%{"version":1,"type":"create_deck"}%%END%%
      Segunda directiva:
      %%DIRECTIVE%%{"version":1,"type":"create_anchor"}%%END%%
      `;
      const { cleanContent, directives } = extractDirectives(response);
      
      expect(cleanContent).toBe('Primera directiva:\n      \n      Segunda directiva:');
      expect(directives).toHaveLength(2);
      expect(directives[0].type).toBe('create_deck');
      expect(directives[1].type).toBe('create_anchor');
    });
  });

  describe('DirectiveHandlerRegistry', () => {
    let mockHandle: jest.Mock;
    let mockCanHandle: jest.Mock;
    
    beforeEach(() => {
      mockHandle = jest.fn().mockResolvedValue(undefined);
      mockCanHandle = jest.fn().mockReturnValue(false);
      
      const mockHandler: DirectiveHandler = {
        canHandle: mockCanHandle,
        handle: mockHandle,
      };
      
      // Registering a temporary mock handler
      directiveRegistry.register(mockHandler);
    });

    it('no provoca fallos si la directiva es desconocida', async () => {
      const warnMock = jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      const unknownDirective: AIDirective = { version: 1, type: 'unknown_action' };
      
      // Should not throw
      await expect(directiveRegistry.handle(unknownDirective, {})).resolves.not.toThrow();
      expect(warnMock).toHaveBeenCalledWith(expect.stringContaining('No handler registered'));
      
      warnMock.mockRestore();
    });
    
    it('ejecuta correctamente el handler que sí la soporta', async () => {
      mockCanHandle.mockImplementation((d) => d.type === 'mock_supported');
      
      const supportedDirective: AIDirective = { version: 1, type: 'mock_supported' };
      const context = { subjectId: 123 };
      
      await directiveRegistry.handle(supportedDirective, context);
      
      expect(mockCanHandle).toHaveBeenCalledWith(supportedDirective);
      expect(mockHandle).toHaveBeenCalledWith(supportedDirective, context);
    });
  });
});
