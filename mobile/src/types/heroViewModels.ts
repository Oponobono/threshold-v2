import type { MemoryLevel } from '../domain/knowledge/types';
import type { ContentType } from './content';

export interface KnowledgeSummary {
  readonly subjectId: string;
  readonly subjectName: string;
  readonly score: number;
  readonly memoryLevel: MemoryLevel;
  readonly retrievability: number;
}

export interface CourseHeroViewModel {
  readonly title: string;
  readonly instructor?: string;
  readonly platform?: string;
  readonly tags?: readonly string[];
  readonly progress: number;
  readonly completedClasses: number;
  readonly totalClasses: number;
  readonly knowledge?: KnowledgeSummary;
  readonly momentum: number;
  readonly continueLabel: string;
  readonly contentType: ContentType;
  readonly subjectCount: number;
  readonly globalProgress: { completed: number; total: number; percentage: number };
  readonly creditCount?: number;
  readonly mainUrl?: string;
  readonly certificateUrl?: string;
}

export interface GlobalHeroViewModel {
  readonly health: number;
  readonly recommendation?: {
    readonly subjectName: string;
    readonly action: string;
    readonly detail: string;
  };
  readonly recentActivity: ReadonlyArray<{
    readonly name: string;
    readonly activityType: ContentType;
    readonly lastActivity: string;
  }>;
  readonly courseCount: number;
  readonly subjectCount: number;
  readonly upcomingExam?: {
    readonly name: string;
    readonly daysLeft: number;
    readonly isUrgent: boolean;
    readonly isOverdue: boolean;
  };
}
