import {
  AcademicImportModel,
  AcademicImportPreview,
  ImportError,
  ImportWarning,
} from './types';

export class PreviewBuilder {
  /**
   * Construye el modelo de vista (Preview) a partir del modelo de dominio jerárquico.
   */
  public static build(
    model: AcademicImportModel,
    warnings: ImportWarning[] = [],
    errors: ImportError[] = []
  ): AcademicImportPreview {
    let totalCourses = 0;
    let totalSubjects = 0;
    let totalAssessments = 0;
    let totalRows = 0;

    for (const course of model.courses) {
      totalCourses++;
      for (const subject of course.subjects) {
        totalSubjects++;
        for (const _assessment of subject.assessments) {
          totalAssessments++;
          totalRows++;
        }
      }
    }

    const warningRows = new Set(warnings.map(w => w.row)).size;
    const errorRows = new Set(errors.map(e => e.row)).size;
    const validRows = totalRows - errorRows;

    return {
      model,
      statistics: {
        totalCourses,
        totalSubjects,
        totalAssessments,
        totalRows,
        validRows,
        warningRows,
        errorRows,
      },
      warnings,
      errors,
    };
  }
}
