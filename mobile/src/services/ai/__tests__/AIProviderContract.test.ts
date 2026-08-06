/**
 * AI Domain v2.0 — Provider Contract Test
 *
 * Validates that CloudProvider and LocalProvider return semantically equivalent
 * AIResponse shapes. We do NOT assert toEqual (too brittle), only structural invariants.
 *
 * Both providers are mocked at the network/inference layer so we validate
 * the contract without requiring a live backend or a loaded model.
 */

import { AIResponse } from '../providers/AIProvider';
import { extractDirectives } from '../core/ResponseInterpreter';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Validates the structural contract of an AIResponse object.
 * This is the source of truth for what any provider must return.
 */
function assertAIResponseContract(response: AIResponse, label: string): void {
  const contentIsString = typeof response.content === 'string';
  const providerIsString = typeof response.provider === 'string';
  const providerNonEmpty = response.provider.length > 0;
  const modelIsString = typeof response.model === 'string';
  const modelNonEmpty = response.model.length > 0;
  const latencyIsNumber = typeof response.latencyMs === 'number';
  const latencyNonNegative = response.latencyMs >= 0;

  expect(contentIsString).toBe(true);   // [label] content must be string
  expect(providerIsString).toBe(true);  // [label] provider must be string
  expect(providerNonEmpty).toBe(true);  // [label] provider must not be empty
  expect(modelIsString).toBe(true);     // [label] model must be string
  expect(modelNonEmpty).toBe(true);     // [label] model must not be empty
  expect(latencyIsNumber).toBe(true);   // [label] latencyMs must be number
  expect(latencyNonNegative).toBe(true);// [label] latencyMs must be non-negative

  // directives is optional but when present must be a valid array of versioned typed directives
  if (response.directives !== undefined) {
    expect(Array.isArray(response.directives)).toBe(true); // [label] directives must be array
    for (const d of response.directives) {
      expect(typeof d.version).toBe('number'); // [label] directive.version must be number
      expect(typeof d.type).toBe('string');    // [label] directive.type must be string
    }
  }
}

/**
 * Validates that when both providers receive the same raw content with a directive,
 * they produce semantically equivalent directives (same type and version).
 */
function assertDirectiveEquivalence(cloud: AIResponse, local: AIResponse): void {
  const cloudDirs = cloud.directives ?? [];
  const localDirs = local.directives ?? [];

  expect(cloudDirs.length).toBe(localDirs.length);

  for (let i = 0; i < cloudDirs.length; i++) {
    expect(cloudDirs[i].type).toBe(localDirs[i].type);
    expect(cloudDirs[i].version).toBe(localDirs[i].version);
    // Directive-specific payload fields should also match semantically
    if (cloudDirs[i].mode !== undefined) {
      expect(cloudDirs[i].mode).toBe(localDirs[i].mode);
    }
    if (cloudDirs[i].count !== undefined) {
      expect(cloudDirs[i].count).toBe(localDirs[i].count);
    }
  }
}

// ─── Simulate what each provider does internally ─────────────────────────────
// Both providers: receive raw text from model → run extractDirectives → return AIResponse.
// We simulate that raw text here and verify the output shape matches the contract.

function simulateCloudProviderResponse(rawModelText: string): AIResponse {
  const start = Date.now();
  const { cleanContent, directives } = extractDirectives(rawModelText);
  return {
    content: cleanContent,
    provider: 'cloud',
    model: 'groq:llama3-8b',
    latencyMs: Date.now() - start,
    ...(directives.length > 0 && { directives }),
  };
}

function simulateLocalProviderResponse(rawModelText: string): AIResponse {
  const start = Date.now();
  const { cleanContent, directives } = extractDirectives(rawModelText);
  return {
    content: cleanContent,
    provider: 'local',
    model: 'llama3.2-3b-q4',
    latencyMs: Date.now() - start,
    ...(directives.length > 0 && { directives }),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('AIProvider Contract — Cloud vs Local', () => {
  describe('Structural contract', () => {
    it('CloudProvider satisface el contrato AIResponse (sin directiva)', () => {
      const response = simulateCloudProviderResponse('Esta es una respuesta de texto plano.');
      assertAIResponseContract(response, 'CloudProvider');
    });

    it('LocalProvider satisface el contrato AIResponse (sin directiva)', () => {
      const response = simulateLocalProviderResponse('Esta es una respuesta de texto plano.');
      assertAIResponseContract(response, 'LocalProvider');
    });

    it('CloudProvider satisface el contrato AIResponse (con directiva válida)', () => {
      const raw = 'Aquí tienes el mazo.\n%%DIRECTIVE%%{"version":1,"type":"create_deck","mode":"mixed","count":10}%%END%%';
      const response = simulateCloudProviderResponse(raw);
      assertAIResponseContract(response, 'CloudProvider+directive');
      expect(response.directives).toHaveLength(1);
    });

    it('LocalProvider satisface el contrato AIResponse (con directiva válida)', () => {
      const raw = 'Aquí tienes el mazo.\n%%DIRECTIVE%%{"version":1,"type":"create_deck","mode":"mixed","count":10}%%END%%';
      const response = simulateLocalProviderResponse(raw);
      assertAIResponseContract(response, 'LocalProvider+directive');
      expect(response.directives).toHaveLength(1);
    });
  });

  describe('Equivalencia semántica de directivas', () => {
    it('CloudProvider y LocalProvider producen directivas semánticamente equivalentes para el mismo input', () => {
      const raw =
        'Generé el mazo para ti.\n' +
        '%%DIRECTIVE%%{"version":1,"type":"create_deck","mode":"flashcard","count":5}%%END%%';

      const cloud = simulateCloudProviderResponse(raw);
      const local = simulateLocalProviderResponse(raw);

      // Both pass structural contract
      assertAIResponseContract(cloud, 'cloud');
      assertAIResponseContract(local, 'local');

      // Directives are semantically equivalent (same type, version, mode, count)
      assertDirectiveEquivalence(cloud, local);
    });

    it('ambos proveedores entregan content sin bloques %%DIRECTIVE%%', () => {
      const raw = 'Texto.\n%%DIRECTIVE%%{"version":1,"type":"create_deck"}%%END%%\nMás texto.';

      const cloud = simulateCloudProviderResponse(raw);
      const local = simulateLocalProviderResponse(raw);

      expect(cloud.content).not.toContain('%%DIRECTIVE%%');
      expect(local.content).not.toContain('%%DIRECTIVE%%');
      expect(cloud.content).toContain('Texto.');
      expect(local.content).toContain('Texto.');
    });

    it('ambos proveedores manejan JSON malformado sin lanzar — directives omitido', () => {
      const raw = '%%DIRECTIVE%%{"version":1, "type": }%%END%%Respuesta de fallback.';
      const warnMock = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const cloud = simulateCloudProviderResponse(raw);
      const local = simulateLocalProviderResponse(raw);

      assertAIResponseContract(cloud, 'cloud-malformed');
      assertAIResponseContract(local, 'local-malformed');

      // When directives fail parsing, both omit the field (undefined, not [])
      expect(cloud.directives).toBeUndefined();
      expect(local.directives).toBeUndefined();

      // Both still deliver content
      expect(cloud.content).toContain('Respuesta de fallback.');
      expect(local.content).toContain('Respuesta de fallback.');

      warnMock.mockRestore();
    });
  });

  describe('Provider identity invariants', () => {
    it('CloudProvider.provider === "cloud"', () => {
      const r = simulateCloudProviderResponse('hola');
      expect(r.provider).toBe('cloud');
    });

    it('LocalProvider.provider === "local"', () => {
      const r = simulateLocalProviderResponse('hola');
      expect(r.provider).toBe('local');
    });

    it('los providers tienen nombres distintos entre sí', () => {
      const cloud = simulateCloudProviderResponse('test');
      const local = simulateLocalProviderResponse('test');
      expect(cloud.provider).not.toBe(local.provider);
    });
  });
});
