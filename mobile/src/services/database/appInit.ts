import { bootstrapManager } from '../bootstrap/BootstrapManager';
import { storageService } from '../storageService';
import { sessionIdentity } from '../api/auth/SessionIdentity';

export async function initializeDatabase(): Promise<void> {
  // En warm start, inicializamos la identidad de sesión ANTES del bootstrap
  // para que el BootstrapManager no aborte instantáneamente.
  try {
    const userId = await storageService.getSecure('app_user_id');
    if (userId) {
      sessionIdentity.startSession(userId);
    }
  } catch (err) {
    console.warn('[appInit] Error leyendo app_user_id antes del bootstrap:', err);
  }

  await bootstrapManager.start();
}
