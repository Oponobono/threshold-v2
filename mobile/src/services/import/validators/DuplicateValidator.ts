import { AcademicImportModel, ImportError, ImportErrorCode } from '../types';
import { courseRepository } from '../../database/repositories/CourseRepository';
import { subjectRepository } from '../../database/repositories/SubjectRepository';
import { assessmentRepository } from '../../database/repositories/AssessmentRepository';

export class DuplicateValidator {
  /**
   * Valida duplicados exactos consultando la base de datos local.
   * Retorna un arreglo de ImportError.
   */
  public static async validate(model: AcademicImportModel): Promise<ImportError[]> {
    const existingCourses = await courseRepository.getAll();
    const existingSubjects = await subjectRepository.getAll();
    const existingAssessments = await assessmentRepository.getAll();

    const assessmentSignatures = new Set<string>();
    for (const a of existingAssessments) {
      const subject = existingSubjects.find(s => s.id === a.subject_id);
      if (subject) {
        const course = existingCourses.find(c => c.id === subject.course_id);
        if (course) {
          const sig = this.createSignature(
            course.name, 
            subject.name, 
            a.name, 
            a.weight, 
            a.score, 
            a.out_of
          );
          assessmentSignatures.add(sig);
        }
      }
    }

    const errors: ImportError[] = [];

    for (const course of model.courses) {
      for (const subject of course.subjects) {
        for (const assessment of subject.assessments) {
          const sig = this.createSignature(
            course.name,
            subject.name,
            assessment.name,
            assessment.weight,
            assessment.score,
            assessment.outOf
          );
          
          if (assessmentSignatures.has(sig)) {
            errors.push({
              code: ImportErrorCode.DuplicateAssessment,
              row: assessment._originalRowIndex || 0,
              message: `Evaluación duplicada: "${assessment.name}" en la materia "${subject.name}" ya existe en el sistema.`,
            });
          }
        }
      }
    }

    return errors;
  }

  /**
   * Genera una firma fuerte para detectar duplicados (Course+Subject+Assessment+Weight+Score+OutOf)
   */
  private static createSignature(
    course: string,
    subject: string,
    assessment: string,
    weight: number | undefined,
    score: number | undefined,
    outOf: number | undefined
  ): string {
    const w = weight || 0;
    const s = score || 0;
    const o = outOf || 100;
    return `${course.toLowerCase().trim()}|${subject.toLowerCase().trim()}|${assessment.toLowerCase().trim()}|${w}|${s}|${o}`;
  }
}
