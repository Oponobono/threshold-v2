import { fetchWithFallback, parseJsonSafely } from './client';
import { syncService } from '../database';
import { storageService } from '../storageService';

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
 */
export const fetchGradingSystems = async (): Promise<GradingSystem[]> => {
  try {
    console.log('[API] Fetching grading systems...');
    const response = await fetchWithFallback('/grading-systems');
    console.log('[API] Grading systems response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch grading systems (${response.status})`);
    }
    
    const data = await parseJsonSafely(response);
    console.log('[API] Parsed grading systems data:', data);
    
    const systems = data?.systems || [];
    if (systems.length > 0) {
      await storageService.saveLocal('app:cache:grading_systems', JSON.stringify(systems));
    }
    console.log('[API] Returning', systems.length, 'grading systems');
    return systems;
  } catch (error) {
    console.warn('[Grading] fetchGradingSystems falló, usando caché:', error);
    const cached = await storageService.getLocal('app:cache:grading_systems');
    if (cached) {
      const parsed = JSON.parse(cached) as GradingSystem[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        console.log(`[Grading] ✅ ${parsed.length} sistemas de calificación desde caché`);
        return parsed;
      }
    }
    throw error;
  }
};

/**
 * Obtiene las escalas de la versión activa de un sistema.
 */
export const fetchSystemScales = async (
  systemId: number
): Promise<{ version: GradingVersion; scales: GradingScale[] }> => {
  try {
    const response = await fetchWithFallback(`/grading-systems/${systemId}/scales`);
    if (!response.ok) throw new Error('Failed to fetch scales');
    return await parseJsonSafely(response);
  } catch (error) {
    console.warn(`[Grading] fetchSystemScales(${systemId}) falló, buscando sistemas cacheados...`);
    const cachedRaw = await storageService.getLocal('app:cache:grading_systems');
    if (cachedRaw) {
      const cachedSystems = JSON.parse(cachedRaw) as GradingSystem[];
      const system = cachedSystems.find(s => s.id === systemId);
      if (system) {
        console.warn(`[Grading] Fallback precario: devolviendo system simulado offline`);
      }
    }
    throw error;
  }
};

/**
 * Normaliza un valor crudo sin persistir. Útil para previews en la UI.
 */
export const normalizeGradePreview = async (
  rawValue: number,
  gradingSystemId: number
): Promise<NormalizeResult> => {
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
  try {
    const response = await fetchWithFallback(`/assessment-results/${resultId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        raw_value: rawValue,
        reason,
      })
    });
    if (!response.ok) throw new Error('Failed to update result');
    return await parseJsonSafely(response);
  } catch (error) {
    console.warn(`[Grading] Offline: encolando updateAssessmentResult ${resultId}`, error);
    await syncService.enqueueUpdate('assessment-result', String(resultId), { raw_value: rawValue, reason });
    return { id: resultId, raw_value: rawValue, _isPending: true } as any;
  }
};

/**
 * Obtiene el audit trail (append-only) de un resultado.
 */
export const fetchResultHistory = async (
  resultId: number
): Promise<GradeHistoryEntry[]> => {
  const response = await fetchWithFallback(`/assessment-results/${resultId}/history`);
  if (!response.ok) throw new Error('Failed to fetch history');
  const data = await parseJsonSafely(response);
  return data?.history || [];
};
