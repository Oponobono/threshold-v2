import { databaseService } from './DatabaseService';
import { fetchWithFallback } from '../api/client';
import * as FileSystem from 'expo-file-system/legacy';

export class MediaSyncService {
  private isSyncing = false;

  /**
   * Fase 1: Subida de Binarios (Fotos, Audios, Documentos)
   * Retorna un conjunto de IDs de entidades que fallaron en subir,
   * para que la Fase 2 (JSON Payload) no cree registros huérfanos.
   */
  async syncPendingMedia(): Promise<Set<string>> {
    const failedEntityIds = new Set<string>();

    if (this.isSyncing) return failedEntityIds;
    this.isSyncing = true;

    try {
      const db = databaseService.getDb();
      
      const tables = [
        { name: 'photos', type: 'image/jpeg' }, 
        { name: 'audio_recordings', type: 'audio/m4a' },
        { name: 'scanned_documents', type: 'application/pdf' }
      ];

      for (const table of tables) {
        // Encontrar registros con local_uri pero sin cloud_url
        const rows: any[] = await db.getAllAsync(
          `SELECT id, local_uri FROM ${table.name} WHERE local_uri IS NOT NULL AND cloud_url IS NULL`
        );

        for (const row of rows) {
          try {
            console.log(`[MediaSync] Iniciando Fase 1 para ${table.name}/${row.id}`);
            const fileInfo = await FileSystem.getInfoAsync(row.local_uri);
            if (!fileInfo.exists) {
              console.warn(`[MediaSync] Archivo no encontrado localmente para ${table.name}/${row.id}`);
              // Si el archivo físico no existe, lo marcamos como fallido para que no se envíe un payload sin archivo válido.
              failedEntityIds.add(row.id);
              continue; 
            }

            const formData = new FormData();
            formData.append('file', {
              uri: row.local_uri,
              name: row.local_uri.split('/').pop() || `file_${row.id}`,
              type: table.type,
            } as any);

            const response = await fetchWithFallback('/upload', {
              method: 'POST',
              body: formData,
              // En React Native, NO debes setear 'Content-Type': 'multipart/form-data' 
              // manualmente, ya que el motor debe agregar el 'boundary' automáticamente.
            });

            if (!response.ok) {
              throw new Error(`Upload failed con estado: ${response.status}`);
            }

            const data = await response.json().catch(() => ({}));
            const cloudUrl = data.url;

            if (cloudUrl) {
              await db.runAsync(`UPDATE ${table.name} SET cloud_url = ? WHERE id = ?`, [cloudUrl, row.id]);
              console.log(`[MediaSync] ✅ Fase 1 Exitosa: ${table.name}/${row.id} -> ${cloudUrl}`);
            } else {
              throw new Error('Respuesta del servidor no contiene URL.');
            }
          } catch (e) {
            console.error(`[MediaSync] ❌ Fase 1 Fallida para ${table.name}/${row.id}`, e);
            failedEntityIds.add(row.id);
          }
        }
      }

      // NOTA: Los archivos locales NUNCA se borran automáticamente.
      // El dispositivo es el almacenamiento primario. La nube es solo un respaldo opcional.
      // El usuario puede liberar espacio manualmente desde los ajustes del sistema.
      
    } finally {
      this.isSyncing = false;
    }

    return failedEntityIds;
  }
}

export const mediaSyncService = new MediaSyncService();
