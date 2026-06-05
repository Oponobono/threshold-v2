import { useMemo, useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Assessment, Subject, UserProfile } from '../services/api';
import { getProjectionAnalytics } from '../services/api/assessments';
import { useConnectivityStore } from '../store/useConnectivityStore';
import { calculateProjection } from '../utils/projectionEngine';
import {
  parseDate,
  parseWeight,
  normalizeGrade,
  formatGrade,
  SCALE_MAX,
} from '../utils/grades';

/**
 * useSubjectGrades
 *
 * Hook de cálculo académico que centraliza toda la lógica del "Threshold" (umbral de aprobación).
 * Recibe las evaluaciones de una materia y calcula de forma reactiva (usando `useMemo`) los
 * indicadores clave necesarios para que el alumno entienda su situación académica:
 *
 * - `evaluatedPercentage` (Pe): Porcentaje del curso ya evaluado.
 * - `accumulatedPoints` (Pts): Suma ponderada de los puntos obtenidos.
 * - `averageGrade` (A_actual): Promedio actual del alumno en la materia.
 * - `targetGrade`: Nota mínima requerida para aprobar (configurable por materia o por perfil).
 * - `requiredGrade`: Nota que se necesita en el porcentaje restante para alcanzar `targetGrade`.
 * - `thresholdStatus`: Semafóro de riesgo ('safe' | 'caution' | 'risk').
 * - `finalNeededText`: Mensaje en lenguaje natural (i18n) explicando la situación.
 *
 * @param assessments - Lista completa de evaluaciones/tareas de la materia.
 * @param selectedSubject - Objeto de la materia (para leer `target_grade`).
 * @param profile - Perfil del usuario (fallback de `approval_threshold`).
 * @returns Objeto con todos los indicadores de rendimiento académico calculados.
 */
export function useSubjectGrades(
  assessments: Assessment[],
  selectedSubject: Subject | null,
  profile: UserProfile | null
) {
  const { t } = useTranslation();
  
  // Estado para almacenar datos de proyección desde el backend
  const [projectionData, setProjectionData] = useState<{
    currentAverage?: number;
    currentEMA?: number;
    projectedGrade?: number;
    delta?: number;
    evaluatedWeight?: number;
    remainingWeight?: number;
    maxScale?: number;
  } | null>(null);

  // Cliente offline: calcular proyección local cuando no hay conexión
  const isOnline = useConnectivityStore((s) => s.isOnline);
  const offlineFallbackRef = useRef(false);

  // Efecto: Cargar datos de proyección del backend cuando la materia cambie o se actualicen assessments
  useEffect(() => {
    console.log('[useSubjectGrades] 🔍 Effect ejecutado - selectedSubject.id:', selectedSubject?.id, 'assessmentCount:', assessments.length);

    if (!isOnline) {
      console.log('[useSubjectGrades] 📡 Modo offline: usando proyección local');
      offlineFallbackRef.current = true;
      const local = calculateProjection(assessments, selectedSubject, profile);
      setProjectionData({
        currentAverage: local.currentAverage,
        currentEMA: local.currentEMA,
        projectedGrade: local.projectedGrade,
        delta: local.delta,
        evaluatedWeight: local.evaluatedWeight,
        remainingWeight: local.remainingWeight,
        maxScale: SCALE_MAX,
      });
      return;
    }

    if (!selectedSubject?.id) {
      console.log('[useSubjectGrades] ⚠️ selectedSubject.id no disponible:', selectedSubject?.id);
      if (!offlineFallbackRef.current) {
        setProjectionData(null);
      }
      return;
    }

    const loadProjection = async () => {
      try {
        console.log(`[useSubjectGrades] 📊 Cargando proyección para subject ${selectedSubject.id}`);
        const data = await getProjectionAnalytics(selectedSubject.id);
        if (data) {
          console.log(`[useSubjectGrades] 📊 Proyección cargada exitosamente:`, {
            currentAverage: data.currentAverage,
            currentEMA: data.currentEMA,
            projectedGrade: data.projectedGrade,
            delta: data.delta,
            evaluatedWeight: data.evaluatedWeight,
            remainingWeight: data.remainingWeight,
            assessmentCount: data.assessmentCount,
          });
          offlineFallbackRef.current = false;
          setProjectionData(data);
        } else {
          console.warn('[useSubjectGrades] ⚠️ getProjectionAnalytics retornó null, usando local');
          const local = calculateProjection(assessments, selectedSubject, profile);
          setProjectionData({
            currentAverage: local.currentAverage,
            currentEMA: local.currentEMA,
            projectedGrade: local.projectedGrade,
            delta: local.delta,
            evaluatedWeight: local.evaluatedWeight,
            remainingWeight: local.remainingWeight,
            maxScale: SCALE_MAX,
          });
        }
      } catch (error) {
        console.warn(`[useSubjectGrades] ⚠️ Error cargando proyección, usando local:`, error);
        const local = calculateProjection(assessments, selectedSubject, profile);
        setProjectionData({
          currentAverage: local.currentAverage,
          currentEMA: local.currentEMA,
          projectedGrade: local.projectedGrade,
          delta: local.delta,
          evaluatedWeight: local.evaluatedWeight,
          remainingWeight: local.remainingWeight,
          maxScale: SCALE_MAX,
        });
      }
    };

    loadProjection();
  }, [selectedSubject?.id, assessments.length, isOnline]);

  const gradedAssessments = useMemo(() => {
    // Only include assessments with actual grades/scores
    // Tasks (is_completed) should NOT be included in GPA calculations
    // because they have no numeric score to contribute to the average
    const filtered = assessments.filter((assessment) => normalizeGrade(assessment) !== null);
    console.log('[useSubjectGrades] 📊 FILTER LOGIC:', {
      totalAssessments: assessments.length,
      gradedAssessments: filtered.length,
      filterDetails: assessments.map(a => ({
        id: a.id,
        name: a.name,
        type: a.type,
        is_completed: a.is_completed,
        normalizeGrade: normalizeGrade(a),
        passesFilter: normalizeGrade(a) !== null,
      }))
    });
    return filtered;
  }, [assessments]);

  // 1. Porcentaje Evaluado (Pe)
  const evaluatedPercentage = useMemo(
    () => {
      const result = gradedAssessments.reduce((sum, assessment) => sum + parseWeight(assessment), 0);
      console.log('[useSubjectGrades] 📊 evaluatedPercentage:', result, 'from assessments:', gradedAssessments.length);
      return result;
    },
    [gradedAssessments],
  );

  // 3. Puntos Acumulados (Pts)
  const accumulatedPoints = useMemo(
    () => {
      const result = gradedAssessments.reduce((sum, assessment) => {
        const grade = normalizeGrade(assessment) || 0;
        const weight = parseWeight(assessment) || 0;
        const contribution = grade * (weight / 100);
        console.log('[useSubjectGrades] 📊 Assessment contribution:', { id: assessment.id, grade, weight, contribution });
        return sum + contribution;
      }, 0);
      console.log('[useSubjectGrades] 📊 accumulatedPoints (total):', result);
      return result;
    },
    [gradedAssessments],
  );

  // 2. Promedio Actual (A_actual)
  const averageGrade = useMemo(() => {
    let result = 0;
    if (evaluatedPercentage > 0) {
      result = accumulatedPoints / (evaluatedPercentage / 100);
      console.log('[useSubjectGrades] 📊 averageGrade (weighted):', result, 'accumulatedPoints:', accumulatedPoints, 'evaluatedPercentage:', evaluatedPercentage);
    } else {
      // FALLBACK: Simple average if no weights are defined but there are grades
      if (gradedAssessments.length > 0) {
        const validGrades = gradedAssessments
          .map(a => normalizeGrade(a))
          .filter(g => g !== null) as number[];
        
        if (validGrades.length > 0) {
          result = validGrades.reduce((sum, g) => sum + g, 0) / validGrades.length;
          console.log('[useSubjectGrades] 📊 averageGrade (simple fallback):', result, 'validGrades:', validGrades);
        }
      }
    }
    
    return result;
  }, [accumulatedPoints, evaluatedPercentage, gradedAssessments]);

  // 4. Nota Necesaria (N_necesaria)
  const targetGrade = useMemo(() => {
    const subjectTarget = selectedSubject?.target_grade;
    if (typeof subjectTarget === 'number' && subjectTarget > 0) return subjectTarget;

    const fallbackThreshold = profile?.approval_threshold;
    if (typeof fallbackThreshold === 'number' && fallbackThreshold > 0) {
      return fallbackThreshold > SCALE_MAX ? fallbackThreshold / 20 : fallbackThreshold;
    }

    return 3.0; // Fallback a 3.0
  }, [profile?.approval_threshold, selectedSubject?.target_grade]);

  const remainingPercentage = useMemo(() => Math.max(100 - evaluatedPercentage, 0), [evaluatedPercentage]);

  const requiredGrade = useMemo(() => {
    if (remainingPercentage <= 0) return null;
    const missingPoints = targetGrade - accumulatedPoints;
    const result = missingPoints / (remainingPercentage / 100);
    console.log('[useSubjectGrades] 📊 requiredGrade:', result, 'missingPoints:', missingPoints, 'remainingPercentage:', remainingPercentage);
    return result;
  }, [targetGrade, accumulatedPoints, remainingPercentage]);

  const projectedGrade = useMemo(() => {
    if (projectionData?.projectedGrade !== undefined) {
      let val = projectionData.projectedGrade;
      const maxScale = projectionData.maxScale ?? SCALE_MAX;
      if (maxScale !== SCALE_MAX && val > 0) {
        val = (val / maxScale) * SCALE_MAX;
      }
      return val;
    }
    return averageGrade;
  }, [projectionData, averageGrade]);

  const securedPercent = useMemo(() => {
    return Math.max(0, Math.min(100, evaluatedPercentage));
  }, [evaluatedPercentage]);

  const deliveredText = `${gradedAssessments.length} / ${Math.max(assessments.length, gradedAssessments.length)}`;
  console.log('[useSubjectGrades] 📊 FINAL RESULTS:', {
    deliveredText,
    averageGrade,
    projectedGrade,
    securedPercent,
    evaluatedPercentage,
    accumulatedPoints,
    targetGrade,
    requiredGrade,
  });
  
  const finalNeededText = useMemo(() => {
    if (requiredGrade === null || remainingPercentage === 0) {
      if (accumulatedPoints >= targetGrade) return t('subjects.thresholdPassed');
      return t('subjects.thresholdNoMoreEvaluations', { grade: formatGrade(accumulatedPoints) });
    }
    
    if (requiredGrade > SCALE_MAX) {
      return t('subjects.thresholdDanger', { max: SCALE_MAX, required: formatGrade(requiredGrade), remaining: remainingPercentage });
    }
    
    if (requiredGrade <= 0) {
      return t('subjects.thresholdSecured');
    }

    return t('subjects.thresholdNeed', { required: formatGrade(requiredGrade), remaining: remainingPercentage, target: targetGrade });
  }, [requiredGrade, remainingPercentage, accumulatedPoints, targetGrade, t]);

  const recentAssessments = useMemo(() => {
    return [...assessments]
      .sort((a, b) => parseDate(b.date) - parseDate(a.date))
      .slice(0, 15);
  }, [assessments]);

  const thresholdStatus = useMemo<'safe' | 'caution' | 'risk'>(() => {
    if (evaluatedPercentage === 0) return 'safe';
    if (accumulatedPoints >= targetGrade) return 'safe';
    if (requiredGrade === null) return 'safe';

    // If you need more than the max scale, you're at high risk (impossible or near impossible)
    if (requiredGrade > SCALE_MAX * 0.9) return 'risk';
    
    // If you need significantly higher than the target grade to recover
    const midpoint = (SCALE_MAX + targetGrade) / 2;
    if (requiredGrade > midpoint) return 'risk';
    if (requiredGrade > targetGrade) return 'caution';
    
    return 'safe';
  }, [evaluatedPercentage, accumulatedPoints, targetGrade, requiredGrade]);

  return {
    evaluatedPercentage,
    accumulatedPoints,
    averageGrade,
    targetGrade,
    remainingPercentage,
    requiredGrade,
    projectedGrade,
    delta: projectionData?.delta !== undefined
      ? (() => {
          const maxScale = projectionData.maxScale ?? SCALE_MAX;
          return maxScale !== SCALE_MAX ? (projectionData.delta ?? 0 / maxScale) * SCALE_MAX : projectionData.delta ?? 0;
        })()
      : 0,
    currentEMA: projectionData?.currentEMA ?? null,
    securedPercent,
    deliveredText,
    finalNeededText,
    recentAssessments,
    thresholdStatus,
  };
}
