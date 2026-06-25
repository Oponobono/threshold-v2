import { useState, useCallback, useMemo } from 'react';
import { Course } from '../services/api/types';

export interface SubjectSection {
  courseId: string | null;
  courseName: string;
  coursePlatform?: string;
  mainUrl?: string;
  data: any[];
}

export function useGroupedSubjects(courses: Course[], subjects: any[]) {
  const [collapsedCourses, setCollapsedCourses] = useState<Record<string, boolean>>({});

  const toggleCourse = useCallback((courseId: string) => {
    setCollapsedCourses(prev => ({ ...prev, [courseId]: !prev[courseId] }));
  }, []);

  const groupedSections = useMemo(() => {
    const sections: SubjectSection[] = [];
    const courseMap = new Map<string, any[]>();
    const independentSubjects: any[] = [];

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

    courses.forEach(course => {
      const isCollapsed = collapsedCourses[course.id] ?? false;
      sections.push({
        courseId: course.id,
        courseName: course.name,
        coursePlatform: course.platform,
        mainUrl: course.main_url,
        data: isCollapsed ? [] : (courseMap.get(course.id) || [])
      });
      courseMap.delete(course.id);
    });

    courseMap.forEach((subs, cId) => {
      const isCollapsed = collapsedCourses[cId] ?? false;
      sections.push({
        courseId: cId,
        courseName: `Curso ${cId.substring(0, 4).toUpperCase()}`,
        data: isCollapsed ? [] : subs
      });
    });

    if (independentSubjects.length > 0) {
      const isCollapsed = collapsedCourses['independent'] ?? false;
      sections.push({
        courseId: 'independent',
        courseName: 'INDEPENDIENTES / CURSOS SUELTOS',
        data: isCollapsed ? [] : independentSubjects
      });
    }

    return sections;
  }, [subjects, courses, collapsedCourses]);

  const aggregatedMomentumScore = useMemo(() => {
    if (courses.length === 0) return 1.0;
    const coursesWithScore = courses.filter(c => c.momentum_score != null);
    if (coursesWithScore.length === 0) return 1.0;
    const total = coursesWithScore.reduce((sum, c) => sum + (c.momentum_score ?? 1.0), 0);
    return total / coursesWithScore.length;
  }, [courses]);

  return { groupedSections, courses, refreshCourses: () => {}, toggleCourse, collapsedCourses, aggregatedMomentumScore };
}