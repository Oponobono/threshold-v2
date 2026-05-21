/**
 * Academic Workflow Engine
 * 
 * Responsable de aplicar reglas y políticas de evaluación académicas (e.g., Drop Lowest, Categorías con pesos)
 * sobre los resultados congelados (normalized_value).
 */

class AcademicWorkflowEngine {
  /**
   * Calcula el promedio normalizado (0.0 a 1.0) para una materia, aplicando todas las políticas
   * definidas en sus categorías.
   * 
   * @param {Array} categories - Array de categorías { id, name, weight, drop_lowest }
   * @param {Array} assessments - Array de evaluaciones { id, category_id, weight, normalized_value }
   * @returns {Object} { normalized_avg_score, dropped_assessment_ids, category_averages }
   */
  static calculateSubjectGrade(categories = [], assessments = []) {
    if (!assessments || assessments.length === 0) {
      return { normalized_avg_score: 0, dropped_assessment_ids: [], category_averages: {} };
    }

    const droppedAssessmentIds = [];
    const categoryAverages = {};
    
    // Agrupar evaluaciones por categoría
    const grouped = { uncategorized: [] };
    categories.forEach(c => { grouped[c.id] = []; });
    
    assessments.forEach(a => {
      // Ignorar evaluaciones sin nota normalizada (no evaluadas aún)
      if (a.normalized_value === null || a.normalized_value === undefined) return;
      
      const catId = a.category_id || 'uncategorized';
      if (!grouped[catId]) grouped[catId] = [];
      grouped[catId].push(a);
    });

    let totalSubjectWeight = 0;
    let totalSubjectScore = 0;
    let hasCategoryWeights = false;

    // Detectar si las categorías tienen pesos explícitos
    categories.forEach(c => {
      const w = parseFloat(c.weight);
      if (!isNaN(w) && w > 0) hasCategoryWeights = true;
    });

    Object.keys(grouped).forEach(catId => {
      const items = grouped[catId];
      if (items.length === 0) return;

      let catDef = catId === 'uncategorized' ? null : categories.find(c => String(c.id) === String(catId));
      let dropCount = catDef ? (catDef.drop_lowest || 0) : 0;

      // Política: Drop Lowest
      if (dropCount > 0 && items.length > dropCount) {
        // Ordenar ascendente por nota normalizada
        items.sort((a, b) => parseFloat(a.normalized_value) - parseFloat(b.normalized_value));
        for (let i = 0; i < dropCount; i++) {
          droppedAssessmentIds.push(items[i].id);
          items[i].dropped = true;
        }
      }

      // Calcular promedio de la categoría
      let catTotalScore = 0;
      let catTotalWeight = 0;
      let hasItemWeights = false;

      const activeItems = items.filter(i => !i.dropped);
      if (activeItems.length === 0) return;

      activeItems.forEach(i => {
        let itemWeightStr = String(i.weight || '').replace('%', '');
        let itemWeight = parseFloat(itemWeightStr);

        if (!isNaN(itemWeight) && itemWeight > 0) {
          hasItemWeights = true;
          catTotalScore += parseFloat(i.normalized_value) * itemWeight;
          catTotalWeight += itemWeight;
        } else {
          // Fallback: promedio simple dentro de la categoría si no hay pesos
          catTotalScore += parseFloat(i.normalized_value);
          catTotalWeight += 1;
        }
      });

      const catAvg = catTotalScore / catTotalWeight;
      categoryAverages[catId] = catAvg;

      // Sumar al total de la materia
      if (catDef && hasCategoryWeights) {
        const catWeight = parseFloat(catDef.weight) || 0;
        totalSubjectScore += catAvg * catWeight;
        totalSubjectWeight += catWeight;
      } else {
        // Si no hay pesos a nivel de categoría, la categoría vale lo que suma su interior
        // O un promedio simple de categorías
        if (catId === 'uncategorized' && !hasCategoryWeights) {
          // El peso de los uncategorized es el total de sus evaluaciones si son ponderadas
          totalSubjectScore += catTotalScore;
          totalSubjectWeight += catTotalWeight;
        } else {
          totalSubjectScore += catAvg;
          totalSubjectWeight += 1;
        }
      }
    });

    let finalAvg = 0;
    if (totalSubjectWeight > 0) {
      finalAvg = totalSubjectScore / totalSubjectWeight;
    }

    // Truncar a 5 decimales por precisión estándar
    finalAvg = Math.round(finalAvg * 100000) / 100000;

    return {
      normalized_avg_score: finalAvg,
      dropped_assessment_ids: droppedAssessmentIds,
      category_averages: categoryAverages
    };
  }
}

module.exports = AcademicWorkflowEngine;
