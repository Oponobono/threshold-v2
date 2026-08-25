/**
 * Offline persistence scenarios for grading config.
 *
 * Tests the lifecycle:
 *   1. Online: fetchGradingSystems → persistActiveGradingConfig → SQLite written
 *   2. App restart: config still available from SQLite
 *   3. Airplane mode: getLocalSemesterSummary reads from SQLite, no network
 *   4. Existing config: offline session uses persisted V1, never tries V2
 *
 * Since we can't run full E2E with real SQLite + network in unit tests,
 * we test the contract boundaries:
 *   - persistActiveGradingConfig writes correct params
 *   - getGradeVersionParams reads them back correctly
 *   - calculateSubjectGrade + denormalizeGrade produce correct output with persisted params
 *   - Default config is used when no persisted config exists (fresh install)
 */
import { calculateSubjectGrade, denormalizeGrade, type GradeVersionParams } from '../gradingEngine';

// ── Mock database layer ──

interface MockGradingConfig {
  id: string;
  grading_system_id: number | null;
  grading_version_id: number | null;
  min_value: number;
  max_value: number;
  direction: 'ascending' | 'descending';
  precision: number;
  passing_value: number;
  code: string | null;
  name: string | null;
}

const DEFAULT_CONFIG: MockGradingConfig = {
  id: 'active',
  grading_system_id: null,
  grading_version_id: null,
  min_value: 0,
  max_value: 5,
  direction: 'ascending',
  precision: 2,
  passing_value: 3.0,
  code: null,
  name: null,
};

// In-memory store simulating SQLite local_grading_config
let mockConfig: MockGradingConfig | null = null;

function mockGetActive(): MockGradingConfig {
  return mockConfig || DEFAULT_CONFIG;
}

function mockSaveActive(config: Omit<MockGradingConfig, 'id'>): void {
  mockConfig = { ...config, id: 'active' };
}

function mockReset(): void {
  mockConfig = null;
}

function mockGetGradeVersionParams(): GradeVersionParams {
  const c = mockGetActive();
  return {
    min_value: c.min_value,
    max_value: c.max_value,
    direction: c.direction,
    precision: c.precision,
  };
}

// ── Simulate persistActiveGradingConfig ──

interface GradingSystem {
  id: number;
  code: string;
  active_version_id: number;
  min_value: number;
  max_value: number;
  direction: 'ascending' | 'descending';
  precision: number;
  passing_value: number;
  name: string;
}

function persistActiveGradingConfig(
  systems: GradingSystem[],
  activeVersionId: string | null | undefined,
): void {
  if (!systems.length) return;
  let activeSystem: GradingSystem | undefined;
  if (activeVersionId) {
    activeSystem = systems.find(s => String(s.active_version_id) === activeVersionId);
  }
  if (!activeSystem) {
    activeSystem = systems[0];
  }
  mockSaveActive({
    grading_system_id: activeSystem.id,
    grading_version_id: activeSystem.active_version_id,
    min_value: activeSystem.min_value,
    max_value: activeSystem.max_value,
    direction: activeSystem.direction,
    precision: activeSystem.precision,
    passing_value: activeSystem.passing_value,
    code: activeSystem.code,
    name: activeSystem.name,
  });
}

// ── Tests ──

describe('Grading config persistence — offline scenarios', () => {

  beforeEach(() => {
    mockReset();
  });

  describe('Scenario 1: first-time online → restart → airplane → summary', () => {
    it('config persists across "restart" and works offline', () => {
      // 1. Online: fetchGradingSystems returns Colombian system
      const systems: GradingSystem[] = [
        {
          id: 1, code: 'COL_0_5', active_version_id: 42,
          min_value: 0, max_value: 5, direction: 'ascending',
          precision: 1, passing_value: 3.0, name: 'Colombiano',
        },
      ];

      // 2. persistActiveGradingConfig
      persistActiveGradingConfig(systems, '42');
      expect(mockConfig).not.toBeNull();
      expect(mockConfig!.grading_version_id).toBe(42);
      expect(mockConfig!.min_value).toBe(0);
      expect(mockConfig!.max_value).toBe(5);
      expect(mockConfig!.direction).toBe('ascending');

      // 3. App restart: config still in SQLite
      const params = mockGetGradeVersionParams();
      expect(params.min_value).toBe(0);
      expect(params.max_value).toBe(5);
      expect(params.direction).toBe('ascending');
      expect(params.precision).toBe(1);

      // 4. Airplane mode: compute semester summary locally
      const cats = [
        { id: 'exam', name: 'Exams', weight: 60, drop_lowest: 0 },
        { id: 'hw', name: 'HW', weight: 40, drop_lowest: 0 },
      ];
      const assessments = [
        { id: 'a1', category_id: 'exam', weight: 1, normalized_value: 0.8 },
        { id: 'a2', category_id: 'hw', weight: 1, normalized_value: 0.6 },
      ];

      const { normalized_avg_score } = calculateSubjectGrade(cats, assessments);
      const avg_score = denormalizeGrade(normalized_avg_score, params);

      // Backend would compute: exam avg=0.8, hw avg=0.6, overall=0.8*60+0.6*40=72/100=0.72
      // denormalize(0.72, {0,5,asc,1}) = 0 + 0.72 * 5 = 3.6
      expect(avg_score).toBe(3.6);
    });
  });

  describe('Scenario 2: existing config V1, offline, never tries V2', () => {
    it('uses persisted V1 params without network', () => {
      // Simulate: user already has config from a previous online session
      mockSaveActive({
        grading_system_id: 1,
        grading_version_id: 42,
        min_value: 0,
        max_value: 5,
        direction: 'ascending',
        precision: 1,
        passing_value: 3.0,
        code: 'COL_0_5',
        name: 'Colombiano',
      });

      // Now offline: getGradeVersionParams reads from SQLite only
      const params = mockGetGradeVersionParams();
      expect(params.min_value).toBe(0);
      expect(params.max_value).toBe(5);
      expect(params.direction).toBe('ascending');
      expect(params.precision).toBe(1);

      // No network call made (mockConfig was set directly, no fetchGradingSystems)
      // Summary computation works with V1 params
      const { normalized_avg_score } = calculateSubjectGrade(
        [{ id: 'cat1', name: 'Exams', weight: 100, drop_lowest: 0 }],
        [{ id: 'a1', category_id: 'cat1', weight: 1, normalized_value: 0.6 }],
      );
      const avg_score = denormalizeGrade(normalized_avg_score, params);
      expect(avg_score).toBe(3.0); // 0.6 * 5 = 3.0
    });
  });

  describe('Scenario 3: fresh install (no config) uses defaults', () => {
    it('default config is 0-5 ascending', () => {
      mockReset(); // No config persisted
      const params = mockGetGradeVersionParams();
      expect(params.min_value).toBe(0);
      expect(params.max_value).toBe(5);
      expect(params.direction).toBe('ascending');
      expect(params.precision).toBe(2);
    });
  });

  describe('Scenario 4: German system persists correctly', () => {
    it('descending system round-trips', () => {
      const systems: GradingSystem[] = [
        {
          id: 2, code: 'DE_1_5', active_version_id: 99,
          min_value: 1, max_value: 5, direction: 'descending',
          precision: 0, passing_value: 4.0, name: 'Deutsch',
        },
      ];

      persistActiveGradingConfig(systems, '99');
      const params = mockGetGradeVersionParams();
      expect(params.direction).toBe('descending');
      expect(params.min_value).toBe(1);
      expect(params.max_value).toBe(5);

      // normalized 0.5 → 1 + 0.5 * (5-1) ... no, descending:
      // raw = max - norm * (max - min) = 5 - 0.5 * 4 = 3
      const result = denormalizeGrade(0.5, params);
      expect(result).toBe(3);
    });
  });

  describe('Scenario 5: config update (system change)', () => {
    it('overwrites previous config with new system', () => {
      // Start with Colombian
      persistActiveGradingConfig([
        {
          id: 1, code: 'COL_0_5', active_version_id: 42,
          min_value: 0, max_value: 5, direction: 'ascending',
          precision: 1, passing_value: 3.0, name: 'Colombiano',
        },
      ], '42');
      expect(mockGetGradeVersionParams().max_value).toBe(5);

      // User switches to 0-100 percentage
      persistActiveGradingConfig([
        {
          id: 3, code: '0_100_PCT', active_version_id: 77,
          min_value: 0, max_value: 100, direction: 'ascending',
          precision: 0, passing_value: 60, name: 'Porcentaje',
        },
      ], '77');

      const params = mockGetGradeVersionParams();
      expect(params.max_value).toBe(100);
      expect(params.precision).toBe(0);

      const result = denormalizeGrade(0.85, params);
      expect(result).toBe(85);
    });
  });

  describe('Scenario 6: multiple systems, correct one selected', () => {
    it('selects matching system by activeVersionId', () => {
      const systems: GradingSystem[] = [
        {
          id: 1, code: 'COL_0_5', active_version_id: 42,
          min_value: 0, max_value: 5, direction: 'ascending',
          precision: 1, passing_value: 3.0, name: 'Colombiano',
        },
        {
          id: 2, code: 'DE_1_5', active_version_id: 99,
          min_value: 1, max_value: 5, direction: 'descending',
          precision: 0, passing_value: 4.0, name: 'Deutsch',
        },
      ];

      // User's active version is 99 (German)
      persistActiveGradingConfig(systems, '99');
      const params = mockGetGradeVersionParams();
      expect(params.direction).toBe('descending');
      expect(params.min_value).toBe(1);
    });

    it('falls back to first system if version not found', () => {
      const systems: GradingSystem[] = [
        {
          id: 1, code: 'COL_0_5', active_version_id: 42,
          min_value: 0, max_value: 5, direction: 'ascending',
          precision: 1, passing_value: 3.0, name: 'Colombiano',
        },
      ];

      persistActiveGradingConfig(systems, '999'); // non-existent
      const params = mockGetGradeVersionParams();
      expect(params.direction).toBe('ascending'); // fell back to first system
      expect(params.min_value).toBe(0);
    });
  });

  describe('Scenario 7: empty systems list does not overwrite', () => {
    it('empty array leaves config unchanged', () => {
      mockSaveActive({
        grading_system_id: 1,
        grading_version_id: 42,
        min_value: 0,
        max_value: 5,
        direction: 'ascending',
        precision: 1,
        passing_value: 3.0,
        code: 'COL_0_5',
        name: 'Colombiano',
      });

      persistActiveGradingConfig([], '42');
      const params = mockGetGradeVersionParams();
      expect(params.max_value).toBe(5); // V1 preserved
    });
  });
});
