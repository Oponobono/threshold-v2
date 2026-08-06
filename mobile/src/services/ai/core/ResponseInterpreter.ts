import { AIDirective } from '../providers/AIProvider';

const DIRECTIVE_PATTERN = /%%DIRECTIVE%%([\s\S]+?)%%END%%/g;

export interface ParsedResponse {
  cleanContent: string;
  directives: AIDirective[];
}

/**
 * Extracts and parses %%DIRECTIVE%% blocks from a raw LLM response string.
 * This parser is completely dumb: it only extracts the JSON block and parses it.
 * It does not validate the content or structure of the JSON.
 */
export function extractDirectives(rawResponse: string): ParsedResponse {
  if (!rawResponse) return { cleanContent: '', directives: [] };

  const directives: AIDirective[] = [];
  let cleanContent = rawResponse;

  let match;
  // Reset lastIndex just in case, though it's a new execution since DIRECTIVE_PATTERN is global
  DIRECTIVE_PATTERN.lastIndex = 0;
  
  while ((match = DIRECTIVE_PATTERN.exec(rawResponse)) !== null) {
    try {
      const payload = JSON.parse(match[1]);
      directives.push(payload);
    } catch (err) {
      console.warn('[ResponseInterpreter] Error parsing directive JSON:', err);
    }
  }

  cleanContent = rawResponse.replace(DIRECTIVE_PATTERN, '').trim();

  return {
    cleanContent,
    directives,
  };
}
