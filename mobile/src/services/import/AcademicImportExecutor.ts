import { databaseService } from '../database/DatabaseService';
import { courseRepository } from '../database/repositories/CourseRepository';
import { subjectRepository } from '../database/repositories/SubjectRepository';
import { assessmentRepository } from '../database/repositories/AssessmentRepository';
import { syncService } from '../database/SyncService';
import { uuidv4 } from '../../utils/uuid';
import { Course, Subject, Assessment } from '../api/types';
import { AcademicImportModel, AcademicImportResult } from './types';

export class AcademicImportExecutor {
  /**
   * Ejecuta la importación en la base de datos local de manera atómica.
   * Retorna un AcademicImportResult con estadísticas de la ejecución.
   */
  public static async execute(userId: string, model: AcademicImportModel): Promise<AcademicImportResult> {
    if (!userId) throw new Error('NO_USER_ID');
    if (model.courses.length === 0) {
      return {
        importId: model.importId,
        success: true,
        durationMs: 0,
        coursesCreated: 0,
        subjectsCreated: 0,
        assessmentsCreated: 0,
      };
    }

    const startTime = Date.now();
    let coursesCreated = 0;
    let subjectsCreated = 0;
    let assessmentsCreated = 0;

    await databaseService.runInTransaction(async () => {
      // 1. Obtener datos existentes
      const existingCourses = await courseRepository.getAll();
      const existingSubjects = await subjectRepository.getAll();
      
      const courseNameToId = new Map<string, string>();
      for (const c of existingCourses) {
        courseNameToId.set(c.name.toLowerCase().trim(), c.id);
      }

      const subjectKeyToId = new Map<string, string>();
      for (const s of existingSubjects) {
        if (s.course_id) {
          subjectKeyToId.set(`${s.course_id}::${s.name.toLowerCase().trim()}`, s.id);
        }
      }

      // 2. Procesar e insertar cursos
      for (const course of model.courses) {
        const normCourseName = course.name.toLowerCase().trim();
        let courseId = courseNameToId.get(normCourseName);

        if (!courseId) {
          courseId = uuidv4();
          const newCourse: Course = {
            id: courseId,
            user_id: userId,
            name: course.name.trim(),
            platform: course.platform || undefined,
            instructor: course.instructor || undefined,
            main_url: course.mainUrl || undefined,
            total_hours: course.totalHours || undefined,
            status: 'active',
            momentum_score: 1.0,
            is_backed_up: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          await courseRepository.create(newCourse);
          await syncService.enqueueCreate('course', courseId, newCourse);
          courseNameToId.set(normCourseName, courseId);
          existingCourses.push(newCourse); 
          coursesCreated++;
        }

        // Insertar materias
        for (const subject of course.subjects) {
          const normSubjectName = subject.name.toLowerCase().trim();
          const subjectKey = `${courseId}::${normSubjectName}`;
          let subjectId = subjectKeyToId.get(subjectKey);

          if (!subjectId) {
            subjectId = uuidv4();
            const newSubject: Subject = {
              id: subjectId,
              user_id: userId,
              course_id: courseId,
              name: subject.name.trim(),
              code: subject.code || undefined,
              professor: subject.professor || undefined,
              credits: subject.credits || 0,
              target_grade: subject.targetGrade || undefined,
              color: '#4F46E5',
              icon: 'book-outline',
            };
            await subjectRepository.create(newSubject);
            await syncService.enqueueCreate('subject', subjectId, newSubject);
            subjectKeyToId.set(subjectKey, subjectId);
            existingSubjects.push(newSubject);
            subjectsCreated++;
          }

          // Insertar evaluaciones
          for (const assessment of subject.assessments) {
            const assessmentId = uuidv4();
            const defaultDate = new Date().toISOString().split('T')[0];
            
            let validDate = defaultDate;
            if (assessment.date) {
               if (/^\d{4}-\d{2}-\d{2}$/.test(assessment.date.trim())) {
                 validDate = assessment.date.trim();
               } else {
                 const parsedDate = new Date(assessment.date);
                 if (!isNaN(parsedDate.getTime())) {
                   validDate = parsedDate.toISOString().split('T')[0];
                 }
               }
            }

            const newAssessment: Assessment = {
              id: assessmentId,
              subject_id: subjectId,
              name: assessment.name.trim(),
              weight: assessment.weight || 0,
              score: assessment.score || 0,
              out_of: assessment.outOf || 100,
              is_completed: 1,
              date: validDate,
            };
            await assessmentRepository.create(newAssessment);
            await syncService.enqueueCreate('assessment', assessmentId, newAssessment);
            assessmentsCreated++;
          }
        }
      }
    });

    const result: AcademicImportResult = {
      importId: model.importId,
      success: true,
      durationMs: Date.now() - startTime,
      coursesCreated,
      subjectsCreated,
      assessmentsCreated,
    };

    // Logging for telemetry/diagnostics matching Logger.info style
    console.info('[AcademicImport]', JSON.stringify({
      importId: result.importId,
      duration: result.durationMs,
      success: result.success,
      coursesCreated: result.coursesCreated,
      subjectsCreated: result.subjectsCreated,
      assessmentsCreated: result.assessmentsCreated
    }));

    return result;
  }
}

