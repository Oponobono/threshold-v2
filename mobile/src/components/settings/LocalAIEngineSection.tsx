/**
 * LocalAIEngineSection.tsx
 *
 * Sección "Motor de IA local" para la pantalla de configuración.
 * Tres bloques:
 *   1. Master Switch (Modo Offline Forzado)
 *   2. Catálogo de Modelos (Essential / Advanced)
 *   3. Almacenamiento y Mantenimiento
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, Switch, TouchableOpacity,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import NetInfo from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { settingsStyles as styles } from '../../styles/Settings.styles';
import { theme } from '../../styles/theme';
import { alertRef } from '../ui/CustomAlert';
import { useLocalAIStore, MODELS, WHISPER_MODEL, LocalModelId } from '../../store/useLocalAIStore';
import { useConnectivityStore } from '../../store/useConnectivityStore';
import {
  showDownloadProgressNotification,
  updateDownloadProgressNotification,
  completeDownloadNotification,
  cancelDownloadNotification,
} from '../../services/notificationService';

const SectionHeader = ({ title, desc, icon }: { title: string; desc: string; icon: string }) => (
  <View style={styles.sectionHeader}>
    <View style={{ flex: 1 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionDesc}>{desc}</Text>
    </View>
    <Ionicons name={icon as any} size={18} color={theme.colors.text.secondary} />
  </View>
);

const SettingRow = ({ title, desc, right }: { title: string; desc?: string; right: React.ReactNode }) => (
  <View style={styles.settingRow}>
    <View style={{ flex: 1, paddingRight: 12 }}>
      <Text style={styles.settingTitle}>{title}</Text>
      {desc ? <Text style={styles.settingDesc}>{desc}</Text> : null}
    </View>
    {right}
  </View>
);

export const LocalAIEngineSection = () => {
  const { t } = useTranslation();
  const isOnline = useConnectivityStore((s) => s.isOnline);

  const forceOfflineMode = useLocalAIStore((s) => s.forceOfflineMode);
  const activeModelId = useLocalAIStore((s) => s.activeModelId);
  const downloadProgress = useLocalAIStore((s) => s.downloadProgress);
  const downloadStatus = useLocalAIStore((s) => s.downloadStatus);
  const downloadedModels = useLocalAIStore((s) => s.downloadedModels);
  const storageUsedBytes = useLocalAIStore((s) => s.storageUsedBytes);
  const inferenceStatus = useLocalAIStore((s) => s.inferenceStatus);
  const deviceTier = useLocalAIStore((s) => s.deviceTier);
  const deviceCompatibleModels = useLocalAIStore((s) => s.deviceCompatibleModels);
  const deviceRamGB = useLocalAIStore((s) => s.deviceRamGB);

  const setForceOfflineMode = useLocalAIStore((s) => s.setForceOfflineMode);
  const setActiveModel = useLocalAIStore((s) => s.setActiveModel);
  const markModelDownloaded = useLocalAIStore((s) => s.markModelDownloaded);
  const markModelRemoved = useLocalAIStore((s) => s.markModelRemoved);
  const setDownloadProgress = useLocalAIStore((s) => s.setDownloadProgress);

  const [downloadingId, setDownloadingId] = useState<LocalModelId | null>(null);
  const downloadResumables = React.useRef<Record<string, FileSystem.DownloadResumable>>({});

  // Calcular almacenamiento usado
  useEffect(() => {
    const totalBytes = Object.values(downloadedModels).reduce((acc, path) => {
      // Estimación basada en el tamaño de descarga de cada modelo
      const modelId = Object.entries(MODELS).find(([, info]) => path.includes(info.filename))?.[0] as LocalModelId | undefined;
      if (modelId) return acc + MODELS[modelId].downloadSizeBytes;
      if (path.includes(WHISPER_MODEL.filename)) return acc + WHISPER_MODEL.downloadSizeBytes;
      return acc;
    }, 0);
    useLocalAIStore.getState().setStorageUsedBytes(totalBytes);
  }, [downloadedModels]);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return `0 ${t('settings.localAI.storageMB')}`;
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) return `${mb.toFixed(0)} ${t('settings.localAI.storageMB')}`;
    return `${(mb / 1024).toFixed(1)} ${t('settings.localAI.storageGB')}`;
  };

  const getStatusLabel = (): string => {
    if (forceOfflineMode && activeModelId) return t('settings.localAI.localStatus');
    if (isOnline && activeModelId && forceOfflineMode) return t('settings.localAI.localStatus');
    if (isOnline) return t('settings.localAI.cloudStatus');
    if (activeModelId) return t('settings.localAI.localStatus');
    return t('settings.localAI.noModelStatus');
  };

  const handleDownload = async (modelId: LocalModelId) => {
    const model = MODELS[modelId];
    const isEssential = modelId === 'essential';
    const confirmMsg = isEssential
      ? t('settings.localAI.downloadConfirmMsgEssential')
      : t('settings.localAI.downloadConfirmMsgAdvanced');

    // Confirmar descarga
    const confirmed = await new Promise<boolean>((resolve) => {
      alertRef.show({
        title: t('settings.localAI.downloadConfirmTitle'),
        message: confirmMsg,
        type: 'confirm',
        buttons: [
          { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
          { text: t('common.ok'), style: 'default', onPress: () => resolve(true) },
        ],
      });
    });
    if (!confirmed) return;

    // Verificar tipo de conexión
    const netState = await NetInfo.fetch();
    if (netState.type === 'cellular') {
      const proceedOnMobile = await new Promise<boolean>((resolve) => {
        alertRef.show({
          title: t('settings.localAI.downloadConfirmTitle'),
          message: t('settings.localAI.downloadWifiConfirm'),
          type: 'confirm',
          buttons: [
            { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
            { text: t('common.ok'), style: 'destructive', onPress: () => resolve(true) },
          ],
        });
      });
      if (!proceedOnMobile) return;
    }

    if (!isOnline) {
      alertRef.show({
        title: t('common.error'),
        message: t('common.networkError'),
        type: 'error',
        buttons: [{ text: t('common.ok') }],
      });
      return;
    }

    // Verificar espacio disponible en disco
    try {
      const freeBytes = await FileSystem.getFreeDiskStorageAsync?.();
      if (freeBytes !== undefined && freeBytes < model.downloadSizeBytes * 1.2) {
        const freeMB = Math.round(freeBytes / (1024 * 1024));
        alertRef.show({
          title: t('common.error'),
          message: t('settings.localAI.insufficientStorage') || `Espacio insuficiente. Disponible: ~${freeMB} MB, necesario: ~${model.downloadSize}`,
          type: 'error',
          buttons: [{ text: t('common.ok') }],
        });
        return;
      }
    } catch (_) {}

    setDownloadingId(modelId);
    setDownloadProgress(modelId, 0, 'downloading');

    try {
      const dir = `${FileSystem.documentDirectory}models/`;
      const dirInfo = await FileSystem.getInfoAsync(dir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      }

      const filePath = `${dir}${model.filename}`;

      let lastNotifiedPct = -1;

      const downloadResumable = FileSystem.createDownloadResumable(
        model.downloadUrl,
        filePath,
        {},
        async (progress) => {
          const pct = Math.round(progress.totalBytesExpectedToWrite > 0
            ? (progress.totalBytesWritten / progress.totalBytesExpectedToWrite) * 100
            : 0);
          setDownloadProgress(modelId, pct, 'downloading');

          // Actualizar notificación cada ~10% para no saturar
          if (pct - lastNotifiedPct >= 10 || pct === 100) {
            lastNotifiedPct = pct;
            await updateDownloadProgressNotification(model.label, pct).catch(() => {});
          }
        },
      );

      downloadResumables.current[modelId] = downloadResumable;

      await showDownloadProgressNotification(model.label, 0);

      const result = await downloadResumable.downloadAsync();
      if (result?.uri) {
        markModelDownloaded(modelId, result.uri);
        setDownloadingId(null);
        delete downloadResumables.current[modelId];
        await completeDownloadNotification(model.label);
        alertRef.show({
          title: t('common.success'),
          message: t('settings.localAI.downloadSuccess', { model: model.label }),
          type: 'success',
          buttons: [{ text: t('common.ok') }],
        });
      }
    } catch (error: any) {
      if (error?.message?.includes('cancelled') || error?.message?.includes('canceled')) {
        return; // Fue cancelado intencionalmente
      }
      setDownloadProgress(modelId, 0, 'error');
      setDownloadingId(null);
      delete downloadResumables.current[modelId];
      await cancelDownloadNotification();
      alertRef.show({
        title: t('common.error'),
        message: error?.message || t('settings.localAI.errorLoadingModel'),
        type: 'error',
        buttons: [{ text: t('common.ok') }],
      });
    }
  };

  const handleDeleteModel = async (modelId: LocalModelId) => {
    const confirmed = await new Promise<boolean>((resolve) => {
      alertRef.show({
        title: t('settings.localAI.delete'),
        message: t('settings.localAI.deleteConfirm'),
        type: 'confirm',
        buttons: [
          { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
          { text: t('common.ok'), style: 'destructive', onPress: () => resolve(true) },
        ],
      });
    });
    if (!confirmed) return;

    // Eliminar archivo
    const model = MODELS[modelId];
    const filePath = `${FileSystem.documentDirectory}models/${model.filename}`;
    try {
      const info = await FileSystem.getInfoAsync(filePath);
      if (info.exists) {
        await FileSystem.deleteAsync(filePath, { idempotent: true });
      }
    } catch {}
    markModelRemoved(modelId);
  };

  const handlePurgeCache = () => {
    alertRef.show({
      title: t('settings.localAI.purgeCache'),
      message: t('settings.localAI.purgeConfirm'),
      type: 'confirm',
      buttons: [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.ok'),
          style: 'destructive',
          onPress: async () => {
            // Eliminar todos los modelos
            for (const modelId of Object.keys(downloadedModels) as LocalModelId[]) {
              const model = MODELS[modelId];
              if (!model) continue;
              const filePath = `${FileSystem.documentDirectory}models/${model.filename}`;
              try {
                await FileSystem.deleteAsync(filePath, { idempotent: true });
              } catch {}
            }
            // También eliminar whisper
            const whisperPath = `${FileSystem.documentDirectory}models/${WHISPER_MODEL.filename}`;
            try {
              await FileSystem.deleteAsync(whisperPath, { idempotent: true });
            } catch {}

            useLocalAIStore.getState().reset();
            alertRef.show({
              title: t('common.success'),
              message: t('settings.localAI.purgeCache'),
              type: 'success',
              buttons: [{ text: t('common.ok') }],
            });
          },
        },
      ],
    });
  };

  const handleCancelDownload = async (modelId: LocalModelId | 'whisper') => {
    const resumable = downloadResumables.current[modelId];
    if (resumable) {
      try {
        await resumable.pauseAsync();
      } catch (e) {}
      delete downloadResumables.current[modelId];
    }
    setDownloadProgress(modelId, 0, 'none');
    if (modelId === 'whisper') {
      setWhisperDownloading(false);
    } else {
      setDownloadingId(null);
    }
    await cancelDownloadNotification();
  };

  const isDownloadingModel = (modelId: LocalModelId): boolean => {
    return downloadStatus[modelId] === 'downloading';
  };

  const isModelDownloaded = (modelId: LocalModelId): boolean => {
    return downloadedModels[modelId] !== undefined;
  };

  const [whisperDownloading, setWhisperDownloading] = useState(false);
  const isWhisperDownloaded = downloadedModels['whisper'] !== undefined;

  const handleWhisperDownload = async () => {
    if (!isOnline) {
      alertRef.show({ title: t('common.error'), message: t('common.networkError'), type: 'error', buttons: [{ text: t('common.ok') }] });
      return;
    }

    // Verificar espacio disponible en disco
    try {
      const freeBytes = await FileSystem.getFreeDiskStorageAsync?.();
      if (freeBytes !== undefined && freeBytes < WHISPER_MODEL.downloadSizeBytes * 1.2) {
        const freeMB = Math.round(freeBytes / (1024 * 1024));
        alertRef.show({
          title: t('common.error'),
          message: t('settings.localAI.insufficientStorage') || `Espacio insuficiente. Disponible: ~${freeMB} MB, necesario: ~${WHISPER_MODEL.downloadSize}`,
          type: 'error',
          buttons: [{ text: t('common.ok') }],
        });
        return;
      }
    } catch (_) {}

    setWhisperDownloading(true);
    setDownloadProgress('whisper', 0, 'downloading');

    try {
      const dir = `${FileSystem.documentDirectory}models/`;
      const dirInfo = await FileSystem.getInfoAsync(dir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      }

      const filePath = `${dir}${WHISPER_MODEL.filename}`;

      let lastNotifiedPct = -1;

      const downloadResumable = FileSystem.createDownloadResumable(
        WHISPER_MODEL.downloadUrl,
        filePath,
        {},
        async (progress) => {
          const pct = Math.round(progress.totalBytesExpectedToWrite > 0
            ? (progress.totalBytesWritten / progress.totalBytesExpectedToWrite) * 100
            : 0);
          setDownloadProgress('whisper', pct, 'downloading');

          if (pct - lastNotifiedPct >= 10 || pct === 100) {
            lastNotifiedPct = pct;
            await updateDownloadProgressNotification(t('settings.localAI.whisperTitle'), pct).catch(() => {});
          }
        },
      );

      downloadResumables.current['whisper'] = downloadResumable;

      await showDownloadProgressNotification(t('settings.localAI.whisperTitle'), 0);

      const result = await downloadResumable.downloadAsync();
      if (result?.uri) {
        markModelDownloaded('whisper', result.uri);
        setWhisperDownloading(false);
        delete downloadResumables.current['whisper'];
        await completeDownloadNotification(t('settings.localAI.whisperTitle'));
        alertRef.show({
          title: t('common.success'),
          message: t('settings.localAI.whisperDownloadSuccess'),
          type: 'success',
          buttons: [{ text: t('common.ok') }],
        });
      }
    } catch (error: any) {
      if (error?.message?.includes('cancelled') || error?.message?.includes('canceled')) {
        return; // Cancelado intencionalmente
      }
      setDownloadProgress('whisper', 0, 'error');
      setWhisperDownloading(false);
      delete downloadResumables.current['whisper'];
      await cancelDownloadNotification();
      alertRef.show({
        title: t('common.error'),
        message: error?.message || t('settings.localAI.errorLoadingModel'),
        type: 'error',
        buttons: [{ text: t('common.ok') }],
      });
    }
  };

  const handleWhisperDelete = async () => {
    const confirmed = await new Promise<boolean>((resolve) => {
      alertRef.show({
        title: t('settings.localAI.delete'),
        message: t('settings.localAI.deleteConfirm'),
        type: 'confirm',
        buttons: [
          { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
          { text: t('common.ok'), style: 'destructive', onPress: () => resolve(true) },
        ],
      });
    });
    if (!confirmed) return;

    const filePath = `${FileSystem.documentDirectory}models/${WHISPER_MODEL.filename}`;
    try {
      const info = await FileSystem.getInfoAsync(filePath);
      if (info.exists) {
        await FileSystem.deleteAsync(filePath, { idempotent: true });
      }
    } catch {}
    markModelRemoved('whisper');
  };

  return (
    <View style={[styles.section, styles.localAISection]}>
      <SectionHeader
        title={t('settings.localAI.title')}
        desc={t('settings.localAI.desc')}
        icon="hardware-chip-outline"
      />

      {/* ─────────────────────────── */}
      {/* BLOQUE 1: Control Local y Privacidad */}
      {/* ─────────────────────────── */}
      <View style={[styles.settingRow, { flexDirection: 'column', alignItems: 'flex-start', paddingBottom: 8 }]}>
        <Text style={[styles.sectionTitle, { fontSize: 15, marginBottom: 4 }]}>
          {t('settings.localAI.privacyTitle')}
        </Text>
        <Text style={[styles.settingDesc, { lineHeight: 18 }]}>
          {t('settings.localAI.privacyDesc')}
        </Text>
      </View>

      {forceOfflineMode && (
        <View style={{
          backgroundColor: '#2A2520',
          borderRadius: 8,
          padding: 12,
          marginBottom: 12,
          borderLeftWidth: 3,
          borderLeftColor: '#D4A056',
        }}>
          <Text style={{ color: '#E8D5B7', fontSize: 13, lineHeight: 19, marginBottom: 6 }}>
            {t('settings.localAI.offlineBannerPrivacy')}
          </Text>
          <Text style={{ color: '#C4B8A8', fontSize: 12, lineHeight: 17 }}>
            {t('settings.localAI.offlineBannerTradeoff')}
          </Text>
        </View>
      )}

      {/* Master Switch */}
      <SettingRow
        title={t('settings.localAI.masterSwitch')}
        desc={t('settings.localAI.masterSwitchDesc')}
        right={
          <Switch
            value={forceOfflineMode}
            onValueChange={setForceOfflineMode}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            thumbColor={theme.colors.white}
          />
        }
      />

      {/* Estado de conexión */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 6 }}>
        <View
          style={{
            width: 8, height: 8, borderRadius: 4,
            backgroundColor: forceOfflineMode && activeModelId ? '#34C759' : isOnline ? '#34C759' : '#FF9500',
          }}
        />
        <Text style={[styles.settingDesc, { fontStyle: 'italic' }]}>
          {getStatusLabel()}
        </Text>
      </View>

      {/* ─────────────────────────── */}
      {/* Banner de Capacidades del Dispositivo */}
      {/* ─────────────────────────── */}
      {deviceTier && (
        <View style={{
          backgroundColor: deviceTier === 'low' ? '#2A2020' : '#1E2A20',
          borderRadius: 8,
          padding: 12,
          marginTop: 16,
          marginBottom: 8,
          borderLeftWidth: 3,
          borderLeftColor: deviceTier === 'low' ? '#D45656' : '#56D46A',
        }}>
          <Text style={{ color: '#E8D5B7', fontSize: 13, fontWeight: '600', marginBottom: 4 }}>
            {deviceTier === 'low'
              ? t('settings.localAI.lowRamTitle', '📱 Dispositivo de gama baja')
              : deviceTier === 'mid'
              ? t('settings.localAI.midRamTitle', '📱 Dispositivo de gama media')
              : t('settings.localAI.highRamTitle', '📱 Dispositivo de gama alta')}
          </Text>
          <Text style={{ color: '#C4B8A8', fontSize: 12, lineHeight: 17 }}>
            {t('settings.localAI.ramDetected', `RAM detectada: ~${deviceRamGB}GB · `)}
            {deviceTier === 'low'
              ? t('settings.localAI.lowRamDesc', 'Solo modelos esenciales (Llama 3.2 1B) para evitar cierres por falta de memoria.')
              : deviceTier === 'mid'
              ? t('settings.localAI.midRamDesc', 'Compatible con modelos de hasta 2B de parámetros.')
              : t('settings.localAI.highRamDesc', 'Compatible con todos los modelos disponibles.')}
          </Text>
        </View>
      )}

      {/* ─────────────────────────── */}
      {/* BLOQUE 2: Catálogo de Modelos */}
      {/* ─────────────────────────── */}
      <View style={{ marginTop: 16 }}>
        <Text style={[styles.subSectionTitle, { marginTop: 0 }]}>{t('settings.localAI.availableModels')}</Text>

        {(Object.entries(MODELS) as [LocalModelId, typeof MODELS[LocalModelId]][]).map(([modelId, model]) => {
          const isDownloaded = isModelDownloaded(modelId);
          const isDownloading = isDownloadingModel(modelId);
          const isActive = activeModelId === modelId;
          const progress = typeof downloadProgress === 'object' ? (downloadProgress[modelId] || 0) : 0;
          const isCompatible = deviceCompatibleModels.length === 0 || deviceCompatibleModels.includes(modelId);

          return (
            <View
              key={modelId}
              style={[
                styles.modelCard,
                isActive && styles.modelCardActive,
                !isCompatible && { opacity: 0.5, borderColor: 'rgba(255,80,80,0.3)' },
              ]}
            >
              {/* Header */}
              <View style={styles.modelCardHeader}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.modelCardTitle}>{model.label}</Text>
                    {!isCompatible && (
                      <Text style={{ fontSize: 10, color: '#FF5050', fontWeight: '700' }}>
                        ⚠️
                      </Text>
                    )}
                  </View>
                  <Text style={styles.modelCardTag}>{t(model.labelTag)}</Text>
                </View>
                {isActive && (
                  <View style={styles.activeModelBadge}>
                    <Text style={styles.activeModelBadgeText}>{t('settings.localAI.active')}</Text>
                  </View>
                )}
              </View>

              {/* Descripción */}
              <Text style={styles.modelCardDesc}>{t(model.description as any)}</Text>

              {/* Métricas */}
              <View style={styles.modelCardMetrics}>
                <Text style={styles.modelCardMetric}>
                  <Text style={styles.modelCardMetricLabel}>{t('settings.localAI.downloadSize')}: </Text>
                  {model.downloadSize}
                </Text>
                <Text style={styles.modelCardMetric}>
                  <Text style={styles.modelCardMetricLabel}>{t('settings.localAI.ramMin')}: </Text>
                  {model.ramMin}
                </Text>
                <Text style={styles.modelCardMetric}>
                  <Text style={styles.modelCardMetricLabel}>{t('settings.localAI.speed')}: </Text>
                  {t(model.speedTag as any)}
                </Text>
              </View>

              {/* Capacidades */}
              <View style={styles.modelCardCapabilities}>
                {model.capabilities.map((cap, i) => (
                  <Text key={i} style={styles.modelCardCap}>✓ {t(cap as any)}</Text>
                ))}
              </View>

              {/* Progreso de descarga */}
              {isDownloading && (
                <View style={styles.progressContainer}>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
                  </View>
                  <Text style={styles.progressText}>{progress}%</Text>
                </View>
              )}

              {/* Acciones */}
              <View style={styles.modelCardActions}>
                {!isCompatible && !isDownloaded ? (
                  <View style={{ flex: 1, paddingVertical: 4 }}>
                    <Text style={{ fontSize: 11, color: '#FF5050', textAlign: 'center' }}>
                      {t('settings.localAI.incompatibleRam', `Requiere ${model.ramMin} RAM · tu dispositivo tiene ~${deviceRamGB}GB`)}
                    </Text>
                  </View>
                ) : isDownloaded ? (
                  <>
                    {!isActive ? (
                      <TouchableOpacity
                        style={styles.downloadBtn}
                        onPress={() => setActiveModel(modelId)}
                      >
                        <Text style={styles.downloadBtnText}>{t('settings.localAI.activate')}</Text>
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                      style={[styles.deleteBtn, isActive && { borderColor: theme.colors.danger }]}
                      onPress={() => handleDeleteModel(modelId)}
                    >
                      <Text style={styles.deleteBtnText}>{t('settings.localAI.delete')}</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.downloadBtn, 
                      isDownloading && { backgroundColor: theme.colors.danger, borderColor: theme.colors.danger, opacity: 1 }
                    ]}
                    onPress={() => isDownloading ? handleCancelDownload(modelId) : handleDownload(modelId)}
                  >
                    <Text style={styles.downloadBtnText}>
                      {isDownloading ? t('common.cancel', 'Cancelar') : t('common.download', 'Descargar')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
      </View>

      {/* ─────────────────────────── */}
      {/* Whisper (Transcripción de Audio Local) */}
      {/* ─────────────────────────── */}
      <View style={{ marginTop: 16 }}>
        <Text style={[styles.subSectionTitle, { marginTop: 0 }]}>{t('settings.localAI.whisperTitle')}</Text>
        <View style={styles.modelCard}>
          <Text style={styles.modelCardDesc}>{t('settings.localAI.whisperDesc')}</Text>

          <View style={styles.modelCardMetrics}>
            <Text style={styles.modelCardMetric}>
              <Text style={styles.modelCardMetricLabel}>{t('settings.localAI.downloadSize')}: </Text>
              {WHISPER_MODEL.downloadSize}
            </Text>
          </View>

          {whisperDownloading && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${typeof downloadProgress === 'object' ? (downloadProgress['whisper'] || 0) : 0}%` }]} />
              </View>
              <Text style={styles.progressText}>{typeof downloadProgress === 'object' ? (downloadProgress['whisper'] || 0) : 0}%</Text>
            </View>
          )}

          <View style={styles.modelCardActions}>
            {isWhisperDownloaded ? (
              <TouchableOpacity
                style={[styles.deleteBtn, { borderColor: theme.colors.danger }]}
                onPress={handleWhisperDelete}
              >
                <Text style={styles.deleteBtnText}>{t('settings.localAI.delete')}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[
                  styles.downloadBtn, 
                  whisperDownloading && { backgroundColor: theme.colors.danger, borderColor: theme.colors.danger, opacity: 1 }
                ]}
                onPress={() => whisperDownloading ? handleCancelDownload('whisper') : handleWhisperDownload()}
              >
                <Text style={styles.downloadBtnText}>
                  {whisperDownloading ? t('common.cancel', 'Cancelar') : t('common.download', 'Descargar')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* ─────────────────────────── */}
      {/* BLOQUE 3: Almacenamiento */}
      {/* ─────────────────────────── */}
      <View style={styles.storageBar}>
        <View style={styles.storageRow}>
          <Text style={[styles.subSectionTitle, { marginTop: 0, marginBottom: 2 }]}>{t('settings.localAI.storageTitle')}</Text>
          <Text style={[styles.settingDesc, { lineHeight: 18 }]}>
            {t('settings.localAI.storageDesc', { size: formatBytes(storageUsedBytes) })}
          </Text>
        </View>

        <View style={{ marginTop: 14, marginBottom: 4 }}>
          <Text style={[styles.subSectionTitle, { marginTop: 0, marginBottom: 8 }]}>
            {t('settings.localAI.offlineCapabilitiesTitle')}
          </Text>
          {[
            'capabilityOcr',
            'capabilityDocAnalyzer',
            'capabilityZyren',
            'capabilityFlashcards',
          ].map((cap) => (
            <View key={cap} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4, gap: 6 }}>
              <Text style={{ color: theme.colors.text.secondary, fontSize: 12, lineHeight: 20 }}>{'•'}</Text>
              <Text style={[styles.settingDesc, { flex: 1, lineHeight: 20 }]}>
                {t(`settings.localAI.${cap}`)}
              </Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.darkPill, { backgroundColor: theme.colors.danger, marginTop: 8 }]}
          onPress={handlePurgeCache}
        >
          <Ionicons name="trash-outline" size={14} color="#fff" style={{ marginRight: 6 }} />
          <Text style={styles.darkPillText}>{t('settings.localAI.purgeCache')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
