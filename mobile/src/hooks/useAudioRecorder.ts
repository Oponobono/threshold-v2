import { useState, useEffect, useRef, useCallback } from 'react';
import { alertRef } from '../components/CustomAlert';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { useTranslation } from 'react-i18next';
import {
  getAudioRecordings,
  createAudioRecording,
  deleteAudioRecording,
  AudioRecording,
} from '../services/api';
import { autoUploadIfEnabled } from '../services/backup/backupService';

export interface RecordingItem extends AudioRecording {
  // Aliases for compatibility
  id_string: string;
  uri: string;
  date: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const AUDIO_DIR = () => `${FileSystem.documentDirectory}Threshold/audio/`;

/**
 * Reads all local .m4a files from the audio directory and returns them as
 * lightweight RecordingItems. This works even when the backend is offline.
 */
async function readLocalFiles(t: (key: string, opts?: any) => string): Promise<RecordingItem[]> {
  const audioDir = AUDIO_DIR();
  const dirInfo = await FileSystem.getInfoAsync(audioDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(audioDir, { intermediates: true });
    return [];
  }

  const files = await FileSystem.readDirectoryAsync(audioDir);
  const m4aFiles = files.filter((f) => f.endsWith('.m4a'));

  return m4aFiles
    .map((file) => {
      const fullUri = audioDir + file;
      const timestamp = parseInt(file.split('_')[1] || '0', 10) || Date.now();
      const dateObj = new Date(timestamp);
      return {
        local_uri: fullUri,
        user_id: 0,
        id_string: file,            // fallback id before DB sync
        uri: fullUri,
        date: dateObj.toLocaleString(),
        name: t('dashboard.audioRecorderModal.fileLabel', {
          date: dateObj.toLocaleDateString(),
        }),
        created_at: dateObj.toISOString(),
      } as RecordingItem;
    })
    .sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime());
}

/**
 * Merges local files with DB records. DB entries are authoritative (they carry
 * name, subject_id, etc.). Orphan local files are shown as fallback.
 */
function mergeLocalAndDb(
  localFiles: RecordingItem[],
  dbRecordings: AudioRecording[],
  t: (key: string, opts?: any) => string
): RecordingItem[] {
  const dbByUri = new Map<string, AudioRecording>(dbRecordings.map((r) => [r.local_uri, r]));

  const merged: RecordingItem[] = localFiles.map((local) => {
    const db = dbByUri.get(local.uri);
    if (db) {
      return {
        ...db,
        id_string: db.id?.toString() || db.local_uri,
        uri: db.local_uri,
        date: new Date(db.created_at || Date.now()).toLocaleString(),
        name:
          db.name ||
          t('dashboard.audioRecorderModal.fileLabel', {
            date: new Date(db.created_at || Date.now()).toLocaleDateString(),
          }),
      } as RecordingItem;
    }
    return local; // file exists locally but not in DB yet
  });

  // Also include DB entries whose local file no longer exists — mark them
  // so the UI can show a "file missing" state and let the user delete the record.
  const mergedUris = new Set(merged.map((r) => r.uri));
  for (const db of dbRecordings) {
    if (!mergedUris.has(db.local_uri)) {
      const hasCloudBackup = db.cloud_url && db.cloud_url !== 'ghost_file';
      
      merged.push({
        ...db,
        id_string: db.id?.toString() || db.local_uri,
        uri: db.local_uri,
        date: new Date(db.created_at || Date.now()).toLocaleString(),
        name: db.name || t('dashboard.audioRecorderModal.fileLabel', {
          date: new Date(db.created_at || Date.now()).toLocaleDateString(),
        }),
        missingFile: !hasCloudBackup,
        isStreaming: !!hasCloudBackup,
      } as RecordingItem & { missingFile: boolean; isStreaming?: boolean });
    }
  }

  return merged.sort(
    (a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime()
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────
/**
 * useAudioRecorder
 *
 * Hook central para la gestión del ciclo completo de grabaciones de voz.
 * Implementa una estrategia offline-first:
 * 1. Muestra inmediatamente los archivos `.m4a` almacenados localmente.
 * 2. En segundo plano sincroniza con la BD del servidor (metadatos enriquecidos).
 * 3. Los archivos locales sin registro en BD se sincronizan automáticamente.
 * 4. Los registros en BD cuyos archivos físicos ya no existen se marcan como `missingFile`.
 *
 * Expone el estado y los controladores necesarios para:
 * - Iniciar, pausar, reanudar y detener una grabación (`expo-av`).
 * - Reproducir y detener un audio de la lista.
 * - Eliminar una grabación del sistema de archivos y de la BD.
 *
 * @returns Objeto con el estado de la grabación activa, la lista de audios,
 *          métricas en tiempo real (duración, decibelios) y todas las funciones de control.
 */
export function useAudioRecorder() {
  const { t } = useTranslation();

  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordings, setRecordings] = useState<RecordingItem[]>([]);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [meteringDb, setMeteringDb] = useState<number>(-160);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const isPlayingRef = useRef(false);

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  useEffect(() => {
    loadRecordings();
    return () => {
      if (sound) {
        sound.unloadAsync().catch(() => {});
        setSound(null);
        setPlayingId(null);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // NOTE: Duration is now tracked exclusively by the recording status callback
  // (setOnRecordingStatusUpdate every 100ms). The old setInterval was removed
  // to prevent the race condition that caused the counter to jump ahead.

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ── Load recordings ────────────────────────────────────────────────────────
  /**
   * Strategy:
   * 1. IMMEDIATELY show local files so the list is never empty due to network.
   * 2. In the background try to fetch DB records and merge them in (richer metadata).
   * 3. Orphan local files get synced to the DB silently.
   */
  const loadRecordings = useCallback(async () => {
    try {
      // Step 1: Show local files right away
      const localFiles = await readLocalFiles(t);
      if (localFiles.length > 0) {
        setRecordings(localFiles);
      }

      // Step 2: Try to enrich with DB data
      let dbRecordings: AudioRecording[] = [];
      try {
        const raw = await getAudioRecordings();
        dbRecordings = Array.isArray(raw) ? raw : [];
      } catch (networkErr) {
        console.warn('[useAudioRecorder] Backend unreachable, showing local files only.', networkErr);
        // Local files already shown — nothing more to do
        return;
      }

      // Step 3: Sync orphans to DB (fire-and-forget, don't block UI)
      const dbUris = new Set(dbRecordings.map((r) => r.local_uri));
      for (const local of localFiles) {
        if (!dbUris.has(local.uri)) {
          try {
            const newRecord = await createAudioRecording({
              local_uri: local.uri,
              duration: 0,
              name: local.name || undefined,
              subject_id: null,
            });
            dbRecordings.push(newRecord);
          } catch (syncErr) {
            console.warn('[useAudioRecorder] Failed to sync orphan:', local.uri, syncErr);
          }
        }
      }

      // Step 4: Merge and update UI
      const merged = mergeLocalAndDb(localFiles, dbRecordings, t);
      setRecordings(merged);
    } catch (err) {
      console.error('[useAudioRecorder] loadRecordings error:', err);
    }
  }, [t]);

  const isStartingRef = useRef(false);

  // ── Recording controls ────────────────────────────────────────────────────
  async function startRecording() {
    if (isStartingRef.current || isRecording || recording) {
      console.warn('[useAudioRecorder] startRecording ignorado: ya está grabando o iniciando');
      return;
    }
    isStartingRef.current = true;
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        alertRef.show({ title: t('common.error'), message: t('dashboard.audioRecorderModal.permissionError'), type: 'error' });
        return;
      }

      await Audio.setAudioModeAsync({ 
        allowsRecordingIOS: true, 
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        {
          ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
          isMeteringEnabled: true,
        },
        (status) => {
          // Fired ~every 100ms — update duration and metering in real time
          if (status.isRecording) {
            const secs = Math.floor((status.durationMillis ?? 0) / 1000);
            setRecordingDuration(secs);
            if (status.metering !== undefined) {
              setMeteringDb(status.metering); // dBFS, typically -160 … 0
            }
          }
        },
        100 // status update interval in ms
      );

      setRecording(newRecording);
      setIsRecording(true);
      setIsPaused(false);
      setRecordingDuration(0);
      setMeteringDb(-160);
    } catch (err) {
      console.error('Failed to start recording', err);
      alertRef.show({ title: t('common.error'), message: t('dashboard.audioRecorderModal.recordingError'), type: 'error' });
    } finally {
      isStartingRef.current = false;
    }
  }

  async function pauseRecording() {
    if (!recording) return;
    try {
      await recording.pauseAsync();
      setIsPaused(true);
    } catch (error) {
      console.error('Failed to pause recording', error);
    }
  }

  async function resumeRecording() {
    if (!recording) return;
    try {
      await recording.startAsync();
      setIsPaused(false);
    } catch (error) {
      console.error('Failed to resume recording', error);
    }
  }

  async function stopRecording() {
    if (!recording) return;

    const currentDuration = recordingDuration;
    setIsRecording(false);
    setIsPaused(false);
    setRecording(null);
    setRecordingDuration(0);
    setMeteringDb(-160);

    try {
      await recording.stopAndUnloadAsync();
      const tempUri = recording.getURI();

      if (tempUri) {
        const audioDir = AUDIO_DIR();
        const fileName = `rec_${Date.now()}.m4a`;
        const permanentUri = audioDir + fileName;

        // Make sure directory exists
        const dirInfo = await FileSystem.getInfoAsync(audioDir);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(audioDir, { intermediates: true });
        }

        await FileSystem.moveAsync({ from: tempUri, to: permanentUri });

        // Show immediately in the list (optimistic update)
        const now = new Date();
        const defaultName = t('dashboard.audioRecorderModal.fileLabel', {
          date: now.toLocaleDateString(),
        });
        const optimisticItem: RecordingItem = {
          local_uri: permanentUri,
          user_id: 0,
          id_string: fileName,
          uri: permanentUri,
          date: now.toLocaleString(),
          name: defaultName,
          created_at: now.toISOString(),
          duration: currentDuration,
        };
        setRecordings((prev) => [optimisticItem, ...prev]);

        // Persist to DB in background
        try {
          const audioData = await createAudioRecording({
            local_uri: permanentUri,
            duration: currentDuration,
            name: defaultName,
            subject_id: null,
          });
          
          // Auto subida si está habilitada
          if (audioData?.id) {
            await autoUploadIfEnabled(
              permanentUri,
              'audio',
              audioData.id,
              `audio_${audioData.id}.m4a`,
              'audio/mp4'
            ).catch(err => console.warn('[useAudioRecorder] Auto-upload error:', err));
          }
          
          // Refresh to get the DB id and any extra metadata
          await loadRecordings();
        } catch (dbErr) {
          console.warn('[useAudioRecorder] Could not save to DB, file kept locally.', dbErr);
        }
      }
    } catch (error) {
      console.error('Failed to stop recording', error);
    }
  }

  // ── Playback ───────────────────────────────────────────────────────────────
  async function playSound(uri: string, id: string) {
    // Prevenir múltiples clicks simultáneos (idempotencia)
    if (isPlayingRef.current) {
      console.warn('[useAudioRecorder] Reproducción ya en progreso, ignorando click');
      return;
    }
    isPlayingRef.current = true;

    try {
      // Detener reproducción anterior ANTES de crear una nueva
      if (sound) {
        try {
          await sound.stopAsync();
          await sound.unloadAsync();
        } catch (stopErr) {
          console.warn('[useAudioRecorder] Error deteniendo audio anterior:', stopErr);
        }
        setSound(null);
        setPlayingId(null);
      }

      let targetUri = uri;
      
      // Check if it's a local path
      if (uri.startsWith('file://') || uri.startsWith('/')) {
        const fileInfo = await FileSystem.getInfoAsync(uri);
        if (!fileInfo.exists) {
          const item = recordings.find((r) => r.id_string === String(id) || r.uri === uri);
          if (item && item.cloud_url && item.cloud_url !== 'ghost_file') {
            targetUri = item.cloud_url;
          } else {
            alertRef.show({ title: 'Error', message: 'El archivo local no existe y no hay respaldo en la nube.', type: 'error' });
            return;
          }
        }
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: targetUri },
        { shouldPlay: true }
      );

      setSound(newSound);
      setPlayingId(id);

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlayingId(null);
          isPlayingRef.current = false;
        }
      });
    } catch (error) {
      console.error('Error playing sound', error);
      alertRef.show({ title: 'Error', message: 'No se pudo reproducir el audio.', type: 'error' });
    } finally {
      isPlayingRef.current = false;
    }
  }

  async function stopSound() {
    if (sound) {
      try {
        await sound.stopAsync();
        await sound.unloadAsync();
      } catch (err) {
        console.warn('[useAudioRecorder] Error stopping sound:', err);
      }
      setSound(null);
      setPlayingId(null);
      isPlayingRef.current = false;
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  // deleteRecordingConfirmed: runs the actual deletion without showing any dialog.
  // The calling component is responsible for showing the confirmation prompt.
  async function deleteRecordingConfirmed(id: number | string, uri: string) {
    // 1. Optimistic update: remove from UI immediately
    const previousRecordings = [...recordings];
    setRecordings((prev) =>
      prev.filter((r) => r.uri !== uri && r.id_string !== String(id))
    );

    try {
      // Convert string id to number if needed
      const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
      
      // 2. Delete from DB if it's a numeric ID (already synced)
      if (!isNaN(numericId) && numericId > 0) {
        try {
          await deleteAudioRecording(numericId);
        } catch (dbErr) {
          console.error('Error deleting from DB:', dbErr);
          throw dbErr; // Let the outer catch handle and revert
        }
      }
      
      // 3. Delete the physical file - wait for completion
      try {
        const fileInfo = await FileSystem.getInfoAsync(uri);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(uri);
        }
      } catch (fileErr) {
        console.warn('Error deleting file:', fileErr);
        // Continue anyway - file might not exist locally
      }

      // Refresh after a small delay to ensure everything is in sync
      setTimeout(() => loadRecordings(), 500);
    } catch (error) {
      console.error('Error in deleteRecordingConfirmed:', error);
      
      // Revert optimistic update on failure
      setRecordings(previousRecordings);
      
      // Show error to user
      alertRef.show({
        title: 'Error al eliminar',
        message: 'Ocurrió un error al eliminar la grabación. Por favor, intenta de nuevo.',
        type: 'error',
        buttons: [{ text: 'OK', style: 'cancel' }]
      });
    }
  }

  // Fallback with native Alert (kept for backward compatibility)
  async function deleteRecording(id: number | string, uri: string) {
    alertRef.show({
      title: t('dashboard.audioRecorderModal.delete'),
      message: t('dashboard.audioRecorderModal.deleteConfirm') || '¿Estás seguro? Esta acción no se puede deshacer.',
      type: 'confirm',
      buttons: [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete') || 'Eliminar', style: 'destructive', onPress: () => deleteRecordingConfirmed(id, uri) },
      ],
    });
  }

  // ── Cleanup helper ─────────────────────────────────────────────────────────
  async function cleanupAudio() {
    isPlayingRef.current = false;
    if (sound) {
      try {
        await sound.stopAsync();
        await sound.unloadAsync();
      } catch (err) {
        console.warn('[useAudioRecorder] Cleanup error:', err);
      }
      setSound(null);
      setPlayingId(null);
    }
  }

  return {
    recording,
    isRecording,
    isPaused,
    recordings,
    recordingDuration,
    meteringDb,
    playingId,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    playSound,
    stopSound,
    deleteRecording,
    deleteRecordingConfirmed,
    formatDuration,
    loadRecordings,
    cleanupAudio,
  };
}
