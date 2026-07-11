import { EntitySynchronizer } from '../EntitySynchronizer';
import { assessmentFileRepository } from '../../database/repositories/AssessmentFileRepository';

export class AssessmentFileSynchronizer implements EntitySynchronizer {
  readonly entityType = 'assessment_files';

  async saveAll(items: any[]): Promise<number> {
    let count = 0;
    for (const item of items) {
      // Intencionalmente ignoramos/eliminamos local_uri si viniera del backend (que será null),
      // para no sobreescribir la ruta local si el archivo ya existe en el dispositivo.
      // El Asset Engine (AssetValidator) se encarga de enlazar local_uri después de la descarga.
      const { local_uri, ...safeItem } = item;
      
      await assessmentFileRepository.upsert(safeItem);
      count++;
    }
    return count;
  }

  async deleteItem(id: string): Promise<void> {
    await assessmentFileRepository.delete(id);
  }
}
