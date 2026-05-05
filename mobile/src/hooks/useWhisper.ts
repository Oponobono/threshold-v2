import { useState, useCallback } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { initWhisper, WhisperContext } from 'whisper.rn';
import { useTranslation } from 'react-i18next';

export type WhisperModelType = 'tiny' | 'base';

const MODEL_URLS = {
  tiny: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
  base: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
};

/**
 * useWhisper
 *
 * Hook para la transcripción de audio completamente on-device usando el modelo Whisper
 * de OpenAI a través de la librería `whisper.rn` (GGML bindings nativos).
 * Gestiona el ciclo de vida del modelo:
 * 1. Verificar si el modelo binario (`.bin`) ya existe en el almacenamiento del dispositivo.
 * 2. Descargar el modelo desde Hugging Face con seguimiento de progreso si no existe.
 * 3. Inicializar el contexto de Whisper y mantenerlo en estado para reutilizarlo.
 * 4. Transcribir archivos de audio locales por URI directamente en el dispositivo.
 *
 * Soporta dos tamaños de modelo: `tiny` (~75MB) y `base` (~142MB).
 *
 * @returns `isDownloading` - `true` mientras el modelo se descarga.
 * @returns `downloadProgress` - Progreso normalizado (0-1) de la descarga del modelo.
 * @returns `isTranscribing` - `true` mientras se procesa el audio.
 * @returns `checkModelExists` - Verifica si el modelo está ya disponible localmente.
 * @returns `downloadModel` - Descarga e inicializa el modelo seleccionado.
 * @returns `transcribeAudio` - Transcribe un archivo de audio local por URI.
 * @returns `initContextIfNeeded` - Inicializa el contexto si el modelo ya existe pero no está cargado.
 */
export function useWhisper() {
  const { t } = useTranslation();
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [whisperContext, setWhisperContext] = useState<WhisperContext | null>(null);

  const getModelPath = (type: WhisperModelType) => {
    return `${FileSystem.documentDirectory}whisper-${type}.bin`;
  };

  const checkModelExists = async (type: WhisperModelType) => {
    const path = getModelPath(type);
    const info = await FileSystem.getInfoAsync(path);
    return info.exists;
  };

  const downloadModel = async (type: WhisperModelType) => {
    setIsDownloading(true);
    setDownloadProgress(0);
    const path = getModelPath(type);

    try {
      const downloadResumable = FileSystem.createDownloadResumable(
        MODEL_URLS[type],
        path,
        {},
        (downloadProgress) => {
          const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
          setDownloadProgress(progress);
        }
      );

      await downloadResumable.downloadAsync();
      
      // Initialize context right after downloading
      const context = await initWhisper({ filePath: path });
      setWhisperContext(context);
      
    } catch (error) {
      console.error('Failed to download model:', error);
      throw error;
    } finally {
      setIsDownloading(false);
    }
  };

  const initContextIfNeeded = async (type: WhisperModelType) => {
    if (whisperContext) return;
    
    const exists = await checkModelExists(type);
    if (exists) {
      const path = getModelPath(type);
      const context = await initWhisper({ filePath: path });
      setWhisperContext(context);
    }
  };

  const transcribeAudio = async (audioUri: string, type: WhisperModelType = 'tiny', language: string = 'es') => {
    setIsTranscribing(true);
    try {
      let context = whisperContext;
      
      // If context is not initialized, we try to initialize it.
      if (!context) {
        const path = getModelPath(type);
        context = await initWhisper({ filePath: path });
        setWhisperContext(context);
      }

      const { promise } = context.transcribe(audioUri, {
        language,
        maxLen: 1,
        tokenTimestamps: true,
      });

      const result = await promise;
      return result.result;
    } catch (error) {
      console.error('Transcription error:', error);
      throw error;
    } finally {
      setIsTranscribing(false);
    }
  };

  return {
    isDownloading,
    downloadProgress,
    isTranscribing,
    checkModelExists,
    downloadModel,
    transcribeAudio,
    initContextIfNeeded,
  };
}
