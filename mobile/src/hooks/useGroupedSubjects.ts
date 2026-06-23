import { useState, useCallback, useMemo } from 'react';
import { useFocusEffect } from 'expo-router';
import { InteractionManager } from 'react-native';
import { courseRepository } from '../services/database';
import { Course } from '../services/api/types';

export interface SubjectSection {
  courseId: string | null;
  courseName: string;
  coursePlatform?: string;
  data: any[]; // Las materias enriquecidas (filteredSubjects)
}

export function useGroupedSubjects(subjects: any[]) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [collapsedCourses, setCollapsedCourses] = useState<Record<string, boolean>>({});
  
  const loadCourses = useCallback(async () => {
    try {
      const dbCourses = await courseRepository.getAll();
      setCourses(dbCourses);
    } catch (error) {
      console.error('[useGroupedSubjects] Error cargando cursos:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      InteractionManager.runAfterInteractions(() => {
        loadCourses();
      });
    }, [loadCourses])
  );

  const toggleCourse = useCallback((courseId: string) => {
    setCollapsedCourses(prev => ({ ...prev, [courseId]: !prev[courseId] }));
  }, []);

  const groupedSections = useMemo(() => {
    const sections: SubjectSection[] = [];
    const courseMap = new Map<string, any[]>();
    const independentSubjects: any[] = [];

    // Agrupar por curso
    subjects.forEach(subject => {
      if (subject.course_id) {
        if (!courseMap.has(subject.course_id)) {
          courseMap.set(subject.course_id, []);
        }
        courseMap.get(subject.course_id)!.push(subject);
      } else {
        independentSubjects.push(subject);
      }
    });

    // Construir secciones para TODOS los cursos registrados (incluso los vacíos)
    courses.forEach(course => {
      const isCollapsed = collapsedCourses[course.id] ?? false;
      sections.push({
        courseId: course.id,
        courseName: course.name,
        coursePlatform: course.platform,
        data: isCollapsed ? [] : (courseMap.get(course.id) || [])
      });
      courseMap.delete(course.id); // Remover para identificar huérfanos
    });

    // Materias que tienen course_id pero el curso no está cargado/borrado
    courseMap.forEach((subs, cId) => {
      const isCollapsed = collapsedCourses[cId] ?? false;
      sections.push({
        courseId: cId,
        courseName: `Curso ${cId.substring(0, 4).toUpperCase()}`, // Fallback
        data: isCollapsed ? [] : subs
      });
    });

    // Añadir materias independientes (sueltas) siempre al final
    if (independentSubjects.length > 0) {
      const isCollapsed = collapsedCourses['independent'] ?? false;
      sections.push({
        courseId: 'independent', // ID artificial para la sección de huérfanos
        courseName: 'INDEPENDIENTES / CURSOS SUELTOS',
        data: isCollapsed ? [] : independentSubjects
      });
    }

    return sections;
  }, [subjects, courses, collapsedCourses]);

  // Score de momentum agregado: promedio de todos los cursos cargados.
  // Si no hay cursos con score, devuelve 1.0 (estado neutro).
  const aggregatedMomentumScore = useMemo(() => {
    if (courses.length === 0) return 1.0;
    const coursesWithScore = courses.filter(c => c.momentum_score != null);
    if (coursesWithScore.length === 0) return 1.0;
    const total = coursesWithScore.reduce((sum, c) => sum + (c.momentum_score ?? 1.0), 0);
    return total / coursesWithScore.length;
  }, [courses]);

  return { groupedSections, courses, refreshCourses: loadCourses, toggleCourse, collapsedCourses, aggregatedMomentumScore };
}
