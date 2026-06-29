import { BaseQuery } from './BaseQuery';

export interface FavoriteCourse {
  id: string;
  name: string;
  platform?: string;
  momentumScore?: number;
  totalClasses?: number;
  completedClasses?: number;
  lastStudiedAt?: string;
}

export class FavoriteCoursesQuery extends BaseQuery<FavoriteCourse> {
  constructor(private userId: string, private limit = 5) { super(); }

  protected sql(): string {
    return `
      SELECT id, name, platform, momentum_score as momentumScore,
             total_classes as totalClasses, completed_classes as completedClasses,
             last_studied_at as lastStudiedAt
      FROM courses
      WHERE user_id = ?
      ORDER BY momentum_score DESC, last_studied_at DESC
      LIMIT ?
    `;
  }

  protected params(): any[] {
    return [this.userId, this.limit];
  }

  protected mapRow(row: any): FavoriteCourse {
    return {
      id: row.id,
      name: row.name,
      platform: row.platform,
      momentumScore: row.momentumScore,
      totalClasses: row.totalClasses,
      completedClasses: row.completedClasses,
      lastStudiedAt: row.lastStudiedAt,
    };
  }
}
