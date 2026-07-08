import { fetchWithFallback, parseJsonSafely } from './client';
import { DEFAULT_GRADING_SYSTEMS } from './gradingDefaults';
import { syncService } from '../database';
import { storageService } from '../storageService';
import { uuidv4 } from '../../utils/uuid';
import { databaseService } from '../database/DatabaseService';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface GradingSystem {
  id: number;
  code: string;
  name: string;
  type: 'numeric' | 'gpa' | 'letter';
  mode: 'continuous' | 'discrete';
  direction: 'ascending' | 'descending';
  country_code: string;
  is_system_seeded: boolean;
  is_custom: boolean;
  created_by_user_id: number | null;
  based_on_system_id: number | null;
  // Joined from active version
  active_version_id: number;
  min_value: number;
  max_value: number;
  passing_value: number;
  precision: number;
}

export interface GradingScale {
  id: number;
  grading_version_id: number;
  min_score: number;
  max_score: number;
  label: string;
  gpa_equivalent: number | null;
  color: string;
  sort_order: number;
  is_passing: boolean;
  display_color: string | null;
  display_short_label: string | null;
  display_priority: number;
}

export interface GradingVersion {
  id: number;
  grading_system_id: number;
  owner_type: 'system' | 'user' | 'institution';
  owner_id: string | null;
  min_value: number;
  max_value: number;
  passing_value: number;
  precision: number;
  direction: 'ascending' | 'descending';
  mode: 'continuous' | 'discrete';
  system_code: string;
  is_active: boolean;
}

export interface GradeEquivalency {
  label: string;
  display_short_label: string;
  gpa_equivalent: number | null;
  color: string;
  is_passing: boolean;
  is_unofficial_equivalency: true;
}

export interface NormalizeResult {
  raw_value: number;
  normalized_value: number;
  display_value: number;
  equivalencies: GradeEquivalency | null;
  grading_version_id: number;
}

export interface AssessmentResult {
  id: number;
  assessment_id: number;
  user_id: number;
  raw_value: number;
  normalized_value: number;
  grading_version_id: number;
}

export interface GradeHistoryEntry {
  id: number;
  assessment_result_id: number;
  old_raw_value: number | null;
  new_raw_value: number;
  changed_by: number;
  changed_at: string;
  reason: string | null;
}

// ─── API calls ─────────────────────────────────────────────────────────────────

/**
 * Obtiene todos los sistemas de calificación disponibles para el usuario.
 * Offline-first: red → caché MMKV → defaults estáticos (nunca falla).
 */
export const fetchGradingSystems = async (): Promise<GradingSystem[]> => {
  try {
    const response = await fetchWithFallback('/grading-systems');
    if (!response.ok) throw new Error(`Failed to fetch grading systems (${response.status})`);
    const data = await parseJsonSafely(response);
    const systems = data?.systems || [];
    if (systems.length > 0) {
      await storageService.saveLocal('app:cache:grading_systems', JSON.stringify(systems));
    }
    return systems;
  } catch (error) {
    console.warn('[Grading] fetchGradingSystems falló, usando caché:', error);
    // Caché MMKV (contiene sistemas personalizados del usuario)
    const cached = await storageService.getLocal('app:cache:grading_systems');
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as GradingSystem[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          console.log(`[Grading] ✅ ${parsed.length} sistemas desde caché MMKV`);
          return parsed;
        }
      } catch {}
    }
    // Fallback final: sistemas estáticos incorporados — siempre disponibles offline
    console.log('[Grading] ✅ Usando sistemas de calificación estáticos (offline)');
    return DEFAULT_GRADING_SYSTEMS as GradingSystem[];
  }
};

/**
 * Genera escalas sintéticas locales para un sistema cuando no hay red.
 * Produce 3 rangos: reprobado / aprobado / excelente, usando los parámetros del sistema.
 */
function buildLocalScales(system: GradingSystem): GradingScale[] {
  const { min_value, max_value, passing_value, active_version_id } = system;
  const range = max_value - min_value;
  if (range <= 0) return [];

  const passingPct = ((passing_value - min_value) / range) * 100;
  const excellentPct = passingPct + (100 - passingPct) * 0.7; // 70% of passing range = "excellent"

  return [
    {
      id: 0, grading_version_id: active_version_id,
      min_score: 0, max_score: Math.floor(passingPct) - 1,
      label: 'Reprobado', gpa_equivalent: null,
      color: '#FF3B30', sort_order: 1, is_passing: false,
      display_color: '#FF3B30', display_short_label: 'F', display_priority: 1,
    },
    {
      id: 0, grading_version_id: active_version_id,
      min_score: Math.floor(passingPct), max_score: Math.floor(excellentPct),
      label: 'Aprobado', gpa_equivalent: null,
      color: '#FF9500', sort_order: 2, is_passing: true,
      display_color: '#FF9500', display_short_label: 'C', display_priority: 2,
    },
    {
      id: 0, grading_version_id: active_version_id,
      min_score: Math.floor(excellentPct) + 1, max_score: 100,
      label: 'Sobresaliente', gpa_equivalent: null,
      color: '#34C759', sort_order: 3, is_passing: true,
      display_color: '#34C759', display_short_label: 'A', display_priority: 3,
    },
  ];
}

/**
 * Obtiene las escalas de la versión activa de un sistema.
 * Offline-first: red → defaults estáticos con escalas sintéticas (nunca falla).
 */
export const fetchSystemScales = async (
  systemId: number
): Promise<{ version: GradingVersion; scales: GradingScale[] }> => {
  try {
    const response = await fetchWithFallback(`/grading-systems/${systemId}/scales`);
    if (!response.ok) throw new Error('Failed to fetch scales');
    const data = await parseJsonSafely(response);
    // Cachear las escalas junto al sistema
    if (data?.scales?.length) {
      try {
        await storageService.saveLocal(`app:cache:grading_scales_${systemId}`, JSON.stringify(data));
      } catch {}
    }
    return data;
  } catch (error) {
    console.warn(`[Grading] fetchSystemScales(${systemId}) falló, buscando caché local...`);
    // 1. Caché de escalas específicas (guardada en llamadas anteriores con red)
    const cachedScales = await storageService.getLocal(`app:cache:grading_scales_${systemId}`);
    if (cachedScales) {
      try {
        const parsed = JSON.parse(cachedScales);
        if (parsed?.scales?.length) {
          console.log(`[Grading] ✅ Escalas de sistema ${systemId} desde caché`);
          return parsed;
        }
      } catch {}
    }
    // 2. Construir escalas sintéticas desde los parámetros del sistema (funciona 100% offline)
    const system =
      DEFAULT_GRADING_SYSTEMS.find(s => s.id === systemId) as GradingSystem | undefined;
    if (system) {
      const scales = buildLocalScales(system);
      const version: GradingVersion = {
        id: system.active_version_id,
        grading_system_id: system.id,
        owner_type: 'system',
        owner_id: null,
        min_value: system.min_value,
        max_value: system.max_value,
        passing_value: system.passing_value,
        precision: system.precision,
        direction: system.direction,
        mode: system.mode,
        system_code: system.code,
        is_active: true,
      };
      console.log(`[Grading] ✅ Escalas sintéticas locales para sistema ${systemId} (offline)`);
      return { version, scales };
    }
    throw error;
  }
};

/**
 * Calcula localmente el normalized_value para previews en la UI.
 * No depende del backend: usa los parámetros min/max del sistema.
 */
function normalizeGradeLocally(rawValue: number, system: GradingSystem): NormalizeResult {
  const range = system.max_value - system.min_value;
  const normalized = range > 0
    ? Math.min(1, Math.max(0, (rawValue - system.min_value) / range))
    : 0;
  const display = parseFloat((rawValue).toFixed(system.precision));
  return {
    raw_value: rawValue,
    normalized_value: normalized,
    display_value: display,
    equivalencies: null,
    grading_version_id: system.active_version_id,
  };
}

/**
 * Normaliza un valor crudo sin persistir. Útil para previews en la UI.
 * Offline-first: intenta el backend y cae a cálculo local si no hay red.
 */
export const normalizeGradePreview = async (
  rawValue: number,
  gradingSystemId: number
): Promise<NormalizeResult> => {
  try {
    const response = await fetchWithFallback('/grading-systems/normalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        raw_value: rawValue,
        grading_system_id: gradingSystemId,
      })
    });
    if (!response.ok) throw new Error('Failed to normalize');
    return await parseJsonSafely(response);
  } catch {
    // Cálculo 100% local: sin red, sin caché, usando sólo los parámetros del sistema
    const system = DEFAULT_GRADING_SYSTEMS.find(s => s.id === gradingSystemId) as GradingSystem | undefined;
    if (system) {
      console.log(`[Grading] normalizeGradePreview offline — cálculo local para sistema ${gradingSystemId}`);
      return normalizeGradeLocally(rawValue, system);
    }
    throw new Error(`Sistema de calificación ${gradingSystemId} no disponible offline`);
  }
};

/**
 * Crea un resultado de evaluación. El normalized_value se congela en el backend.
 */
export const createAssessmentResult = async (
  assessmentId: number,
  rawValue: number,
  gradingSystemId: number
): Promise<AssessmentResult> => {
  try {
    const response = await fetchWithFallback('/assessment-results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assessment_id: assessmentId,
        raw_value: rawValue,
        grading_system_id: gradingSystemId,
      })
    });
    if (!response.ok) throw new Error('Failed to create result');
    return await parseJsonSafely(response);
  } catch (error) {
    console.warn('[Grading] Offline: encolando createAssessmentResult', error);
    await syncService.enqueueCreate('assessment-result', undefined, {
      assessment_id: assessmentId,
      raw_value: rawValue,
      grading_system_id: gradingSystemId,
    });
    return { id: `pending-${Date.now()}`, assessment_id: assessmentId, raw_value: rawValue, grading_version_id: gradingSystemId, _isPending: true } as any;
  }
};

/**
 * Actualiza el raw_value de un resultado. El backend registra el cambio en grade_history.
 */
export const updateAssessmentResult = async (
  resultId: number,
  rawValue: number,
  reason?: string
): Promise<AssessmentResult> => {
  // Siempre registrar el cambio localmente para el audit trail offline
  const saveLocalHistory = async (oldValue?: number) => {
    try {
      const db = databaseService.getDb();
      await db.runAsync(
        `INSERT INTO grade_history (id, assessment_result_id, old_raw_value, new_raw_value, changed_at, reason)
         VALUES (?, ?, ?, ?, datetime('now'), ?)`,
        uuidv4(), String(resultId), oldValue ?? null, rawValue, reason ?? null
      );
    } catch (e) {
      console.warn('[Grading] No se pudo guardar historial local:', e);
    }
  };

  try {
    const response = await fetchWithFallback(`/assessment-results/${resultId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw_value: rawValue, reason })
    });
    if (!response.ok) throw new Error('Failed to update result');
    const data = await parseJsonSafely(response);
    await saveLocalHistory(data?.old_raw_value);
    return data;
  } catch (error) {
    console.warn(`[Grading] Offline: encolando updateAssessmentResult ${resultId}`, error);
    await saveLocalHistory();
    await syncService.enqueueUpdate('assessment-result', String(resultId), { raw_value: rawValue, reason });
    return { id: resultId, raw_value: rawValue, _isPending: true } as any;
  }
};

/**
 * Obtiene el audit trail (append-only) de un resultado.
 * Offline-first: lee de SQLite local primero, enriquece desde API en background.
 */
export const fetchResultHistory = async (
  resultId: number
): Promise<GradeHistoryEntry[]> => {
  // 1. Leer historial local de SQLite
  let localHistory: GradeHistoryEntry[] = [];
  try {
    const db = databaseService.getDb();
    const rows = await db.getAllAsync(
      `SELECT id, assessment_result_id, old_raw_value, new_raw_value, changed_by, changed_at, reason
       FROM grade_history
       WHERE assessment_result_id = ?
       ORDER BY changed_at DESC`,
      String(resultId)
    ) as any[];
    localHistory = rows.map(r => ({
      id: r.id,
      assessment_result_id: r.assessment_result_id,
      old_raw_value: r.old_raw_value ?? null,
      new_raw_value: r.new_raw_value,
      changed_by: r.changed_by ?? 0,
      changed_at: r.changed_at,
      reason: r.reason ?? null,
    })) as GradeHistoryEntry[];
  } catch (e) {
    console.warn('[fetchResultHistory] Error leyendo historial local:', e);
  }

  // 2. Enriquecer desde API en background (no bloqueante)
  (async () => {
    try {
      const response = await fetchWithFallback(`/assessment-results/${resultId}/history`);
      if (!response.ok) return;
      const data = await parseJsonSafely(response);
      const apiHistory: GradeHistoryEntry[] = data?.history || [];
      if (apiHistory.length === 0) return;

      // Persistir entradas nuevas de la API que no existen localmente
      const db = databaseService.getDb();
      for (const entry of apiHistory) {
        try {
          await db.runAsync(
            `INSERT OR IGNORE INTO grade_history (id, assessment_result_id, old_raw_value, new_raw_value, changed_by, changed_at, reason)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            String(entry.id || uuidv4()), String(resultId),
            entry.old_raw_value ?? null, entry.new_raw_value,
            entry.changed_by ?? null, entry.changed_at,
            entry.reason ?? null
          );
        } catch {}
      }
    } catch {}
  })();

  // 3. Si hay datos locales, devolverlos inmediatamente; si no, esperar la API
  if (localHistory.length > 0) return localHistory;

  try {
    const response = await fetchWithFallback(`/assessment-results/${resultId}/history`);
    if (!response.ok) throw new Error('Failed to fetch history');
    const data = await parseJsonSafely(response);
    return data?.history || [];
  } catch {
    return [];
  }
};
