# Assets Pipeline

Los assets (fotos, audio, documentos) siguen un pipeline separado del sync de datos estructurados:

```
CREATE (local) → Enqueue → Sync CREATE (JSON metadata) → 
AssetUploadManager (blob, 2 concurrentes, retry exponencial) → 
checksum verification → cloud_url actualizado
```

## Componentes

| Componente | Archivo | Rol |
|---|---|---|
| **AssetSyncEngine** | `asset/AssetSyncEngine.ts` | Orquestador: schedulePendingDownloads, requestPriorityDownload, scheduleUpload |
| **AssetUploadManager** | `asset/AssetUploadManager.ts` | Cola de subida (2 concurrentes, retry exponencial, FormData) |
| **AssetDownloadManager** | `asset/AssetDownloadManager.ts` | Cola de descarga (3 concurrentes, checksums, prioridades, resume) |
| **PersistentLocalAssetStore** | `asset/PersistentLocalAssetStore.ts` | File system manager, checksums, LRU eviction (3GB) |
| **BaseAssetSynchronizer** | `asset/BaseAssetSynchronizer.ts` | Clase base abstracta |
| **PhotoSynchronizer** | `asset/PhotoSynchronizer.ts` | Synchronizer para photos |
| **AudioSynchronizer** | `asset/AudioSynchronizer.ts` | Synchronizer para audio_recordings |
| **DocumentSynchronizer** | `asset/DocumentSynchronizer.ts` | Synchronizer para scanned_documents |
| **AssetValidator** | `asset/AssetValidator.ts` | Checksum post-descarga, detección de corruptos |

## Estados de Asset

| Estado | Descripción |
|---|---|
| `pending` | Creado localmente, pendiente de subir |
| `uploading` | Subiendo ahora |
| `uploaded` | Subido exitosamente |
| `download_pending` | Pendiente de descargar en otro dispositivo |
| `downloading` | Descargando ahora |
| `downloaded` | Descargado exitosamente |
| `failed` | Error en upload/download |

## Integración

- **Photos**: `scheduleUpload()` al crear foto + `priorityDownload` en ImageViewerModal
- **Audio**: `scheduleUpload()` al crear grabación
- **Documents**: `scheduleUpload()` al crear documento
- **SyncManager**: Orquesta assets como fase paralela al sync de datos

## Validación

- Checksum verification post-descarga
- Detección de archivos corruptos o faltantes
- LRU eviction cuando se superan 3GB de almacenamiento local
