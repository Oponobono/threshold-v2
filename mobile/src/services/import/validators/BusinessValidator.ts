import { AcademicImportModel, ImportError, ImportWarning, ImportCourseRow, ImportSubjectRow, ImportAssessmentRow, ImportErrorCode } from '../types';

export class BusinessValidator {
  /**
   * Valida las reglas de negocio en el modelo de dominio.
   */
  public static validate(model: AcademicImportModel): { warnings: ImportWarning[]; errors: ImportError[] } {
    const warnings: ImportWarning[] = [];
    const errors: ImportError[] = [];

    for (const course of model.courses) {
      for (const subject of course.subjects) {
        for (const assessment of subject.assessments) {
          this.validateAssessment(course, subject, assessment, warnings, errors);
        }
      }
    }

    return { warnings, errors };
  }

  private static validateAssessment(
    course: ImportCourseRow,
    subject: ImportSubjectRow,
    assessment: ImportAssessmentRow,
    warnings: ImportWarning[],
    errors: ImportError[]
  ) {
    const rowIdx = assessment._originalRowIndex || 0;

    if (assessment.weight !== undefined && (assessment.weight < 0 || assessment.weight > 100)) {
      errors.push({
        code: ImportErrorCode.InvalidWeight,
        row: rowIdx,
        message: `La evaluación "${assessment.name}" en "${subject.name}" tiene un peso inválido (${assessment.weight}%). Debe estar entre 0 y 100.`,
      });
    }

    if (assessment.score !== undefined && assessment.score < 0) {
      errors.push({
        code: ImportErrorCode.InvalidScore,
        row: rowIdx,
        message: `La evaluación "${assessment.name}" tiene una nota negativa (${assessment.score}).`,
      });
    }

    if (assessment.outOf !== undefined && assessment.outOf <= 0) {
      errors.push({
        code: ImportErrorCode.InvalidMaxScore,
        row: rowIdx,
        message: `La evaluación "${assessment.name}" tiene una nota máxima inválida (${assessment.outOf}).`,
      });
    }

    if (assessment.score !== undefined && assessment.outOf !== undefined && assessment.score > assessment.outOf) {
      warnings.push({
        code: ImportErrorCode.ScoreExceedsMax,
        row: rowIdx,
        message: `En "${assessment.name}", la nota (${assessment.score}) es mayor a la nota máxima (${assessment.outOf}).`,
      });
    }
  }
}
