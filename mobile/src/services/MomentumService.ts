import { databaseService } from './database/DatabaseService';
import { courseRepository } from './database/repositories/CourseRepository';

export class MomentumService {
  /**
   * Calcula el nuevo score de Momentum basado en un decaimiento logarítmico
   * con una ventana de gracia de 72 horas.
   */
  static calculateNewMomentum(currentScore: number, lastStudiedAt: string | null): number {
    if (!lastStudiedAt) return 1.0; // Inicia al tope si es nuevo

    const now = Date.now();
    const lastSession = new Date(lastStudiedAt).getTime();
    
    // Fallback por si la fecha es inválida
    if (isNaN(lastSession)) return currentScore;

    const diffInHours = (now - lastSession) / (1000 * 60 * 60);

    if (diffInHours <= 72) {
      return currentScore; // Dentro de la ventana de gracia de 3 días
    }

    // Decaimiento logarítmico tras las 72 horas
    const hoursOverdue = diffInHours - 72;
    const decayFactor = 0.05 * Math.log1p(hoursOverdue);
    
    // Garantizamos que el score no baje de 0
    return Math.max(0, currentScore - decayFactor);
  }

  /**
   * Escanea todos los cursos locales y actualiza su Momentum Score
   * Ideal para ser ejecutado On-App-Start
   */
  static async updateAllMomentumScores(): Promise<void> {
    try {
      const db = databaseService.getDb();
      if (!db) return;

      const courses = await courseRepository.getAll();
      if (!courses || courses.length === 0) return;

      for (const course of courses) {
        const currentScore = course.momentum_score ?? 1.0;
        const newScore = this.calculateNewMomentum(currentScore, course.last_studied_at || null);

        // Si el score cambió significativamente, hacemos el UPDATE
        if (Math.abs(currentScore - newScore) > 0.01) {
          await db.runAsync(
            `UPDATE courses SET momentum_score = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [newScore, course.id]
          );
        }
      }
      
      console.log(`[MomentumService] Momentum recalculado para ${courses.length} cursos.`);
    } catch (error) {
      console.error('[MomentumService] Error recalculando Momentum:', error);
    }
  }

  /**
   * Refuerza el momentum cuando el usuario completa una clase o sesión
   */
  static async boostMomentum(courseId: string): Promise<void> {
    try {
      const db = databaseService.getDb();
      if (!db) return;

      const course = await courseRepository.getById(courseId);
      if (!course) return;

      // El boost suma un 15% al momentum actual, con un tope de 1.0 (100%)
      const currentScore = course.momentum_score ?? 0.5;
      const boostedScore = Math.min(1.0, currentScore + 0.15);
      const nowISO = new Date().toISOString();

      await db.runAsync(
        `UPDATE courses SET momentum_score = ?, last_studied_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [boostedScore, nowISO, course.id]
      );
      
      console.log(`[MomentumService] Boost aplicado al curso ${courseId} -> Nuevo score: ${boostedScore}`);
    } catch (error) {
      console.error('[MomentumService] Error en boostMomentum:', error);
    }
  }
}
