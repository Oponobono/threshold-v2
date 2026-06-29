import { bootstrapManager } from '../bootstrap/BootstrapManager';

export async function initializeDatabase(): Promise<void> {
  await bootstrapManager.start();
}
