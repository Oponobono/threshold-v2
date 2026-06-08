import React, { useEffect, useRef } from 'react';
import { View, Text, Modal, TouchableOpacity, Animated, FlatList, Easing, Pressable } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { dashboardStyles as styles } from '../../styles/Dashboard.styles';
import { audioRecorderStyles as localStyles } from '../../styles/AudioRecorderModal.styles';
import { useAudioRecorder, RecordingItem } from '../../hooks/useAudioRecorder';
import { AudioPlayerItem } from './AudioPlayerItem';

interface AudioRecorderModalProps {
  isVisible: boolean;
  onClose: () => void;
}

/**
 * AudioRecorderModal.tsx
 *
 * Hoja modal "Bottom Sheet" que alberga la grabadora de voz principal de la app.
 * Gestiona el ciclo completo de grabación (iniciar, pausar, detener) y muestra una animación
 * reactiva del micrófono basándose en el volumen detectado (decibeles).
 * Debajo de los controles de grabación, despliega una lista rápida con los últimos 4 audios grabados.
 *
 * @param isVisible - Controla si el modal de grabación está visible.
 * @param onClose - Función ejecutada al cerrar el modal (o al minimizarlo).
 */
export const AudioRecorderModal: React.FC<AudioRecorderModalProps> = ({ isVisible, onClose }) => {
  const { t } = useTranslation();
  const router = useRouter();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const {
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
    deleteRecordingConfirmed,
    formatDuration,
    loadRecordings,
    cleanupAudio,
  } = useAudioRecorder();

  // Stop audio playback when modal closes
  useEffect(() => {
    if (!isVisible) {
      cleanupAudio();
    }
  }, [isVisible, cleanupAudio]);

  // Safety cleanup when component unmounts
  useEffect(() => {
    return () => {
      cleanupAudio();
    };
  }, [cleanupAudio]);
  const meterAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    // Map dBFS to 0-1: silence=-160 → 0, loud=0 → 1 (clamped)
    const normalised = Math.max(0, Math.min(1, (meteringDb + 60) / 60));
    Animated.timing(meterAnim, {
      toValue: normalised,
      duration: 80,
      useNativeDriver: false,
    }).start();
  }, [meteringDb, meterAnim]);

  // Reload recordings when modal becomes visible to sync with full screen
  useEffect(() => {
    if (isVisible) {
      loadRecordings();
    }
  }, [isVisible, loadRecordings]);

  // Reload recordings right after a recording stops (transition: recording → stopped)
  const prevIsRecordingRef = React.useRef(isRecording);
  useEffect(() => {
    if (prevIsRecordingRef.current === true && isRecording === false) {
      // Small delay so stopRecording finishes saving to DB before we fetch
      setTimeout(() => loadRecordings(), 800);
    }
    prevIsRecordingRef.current = isRecording;
  }, [isRecording, loadRecordings]);

  useEffect(() => {
    const startPulse = () => {
      pulseAnim.setValue(1);
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    const stopPulse = () => {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    };

    if (isRecording && !isPaused) {
      startPulse();
    } else {
      stopPulse();
    }
  }, [isRecording, isPaused, pulseAnim]);

  const handleOpenFullList = () => {
    onClose();
    router.push('/recordings' as any);
  };

  const renderRecordingItem = ({ item }: { item: RecordingItem }) => {
    return (
      <AudioPlayerItem
        item={item}
        isPlaying={playingId === (item.id_string || item.id?.toString() || '')}
        onPlay={playSound}
        onStop={stopSound}
        onDelete={deleteRecordingConfirmed}
        onPress={() => {
          onClose();
          router.push(`/recordings/${encodeURIComponent(item.id_string || item.id?.toString() || '')}?type=recording` as any);
        }}
      />
    );
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <View style={[styles.sheetContent, { height: '80%' }]} onStartShouldSetResponder={() => true}>
          <View style={styles.sheetHandle} />
          
          <View style={localStyles.header}>
            <View style={{ flex: 1, paddingRight: 16 }}>
              <Text style={styles.sheetTitle}>{t('dashboard.audioRecorderModal.title')}</Text>
              <Text style={styles.sheetSubtitle}>{t('dashboard.audioRecorderModal.subtitle')}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <TouchableOpacity onPress={handleOpenFullList} style={localStyles.closeBtn}>
                <Ionicons name="list" size={24} color={theme.colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={localStyles.closeBtn}>
                <Ionicons name="close" size={24} color={theme.colors.text.primary} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={localStyles.recorderContainer}>
            <View style={localStyles.timerContainer}>
              <Text style={[localStyles.timerText, isRecording && { color: theme.colors.text.error }]}>
                {formatDuration(recordingDuration)}
              </Text>
              {isRecording && (
                <Text style={[localStyles.statusText, isPaused && { color: theme.colors.text.secondary }]}>
                  {isPaused 
                    ? t('dashboard.audioRecorderModal.recordingPaused') 
                    : t('dashboard.audioRecorderModal.recordingInProgress')}
                </Text>
              )}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 24 }}>
              {isRecording && (
                <TouchableOpacity 
                  onPress={isPaused ? resumeRecording : pauseRecording}
                  activeOpacity={0.7}
                  style={localStyles.secondaryRecordBtn}
                >
                  <Ionicons 
                    name={isPaused ? "play" : "pause"} 
                    size={24} 
                    color={theme.colors.text.secondary} 
                  />
                </TouchableOpacity>
              )}

              <TouchableOpacity 
                onPress={isRecording ? stopRecording : startRecording}
                activeOpacity={0.8}
              >
                <Animated.View style={[
                  localStyles.recordButton,
                  { transform: [{ scale: pulseAnim }] },
                  isRecording && localStyles.recordingButtonActive
                ]}>
                  <View style={[
                    localStyles.recordButtonInner,
                    isRecording && localStyles.recordingButtonInnerActive
                  ]} />
                </Animated.View>
              </TouchableOpacity>

              {isRecording && (
                <View style={{ width: 44 }} />
              )}
            </View>
            
            {/* Live waveform during recording */}
            {isRecording && !isPaused && (
              <View style={localStyles.liveWaveform}>
                {Array.from({ length: 15 }, (_, i) => {
                  // Each bar has a fixed base ratio so they have different heights
                  const baseRatio = 0.25 + Math.sin((i / 14) * Math.PI) * 0.75;
                  const minH = 3;
                  const maxH = 32;
                  const barH = meterAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [minH, minH + (maxH - minH) * baseRatio],
                  });
                  return (
                    <Animated.View
                      key={i}
                      style={[
                        localStyles.liveWaveBar,
                        { height: barH },
                      ]}
                    />
                  );
                })}
              </View>
            )}

            <Text style={localStyles.hintText}>
              {isRecording
                ? t('dashboard.audioRecorderModal.stopRecording')
                : t('dashboard.audioRecorderModal.startRecording')}
            </Text>
          </View>

          <View style={localStyles.listHeader}>
            <Text style={localStyles.listTitle}>{t('dashboard.audioRecorderModal.recordingsList')}</Text>
            <Text style={localStyles.countText}>{recordings.length}</Text>
          </View>

          <FlatList
            data={recordings.slice(0, 4)} // Solamente las últimas 4
            keyExtractor={(item) => item.id_string || item.id?.toString() || Math.random().toString()}
            renderItem={renderRecordingItem}
            contentContainerStyle={localStyles.listContent}
            style={localStyles.recordingsFlatList}
            scrollEnabled={recordings.length > 0}
            ListEmptyComponent={
              <View style={localStyles.emptyState}>
                <MaterialCommunityIcons name="microphone-off" size={48} color={theme.colors.border} />
                <Text style={localStyles.emptyText}>{t('dashboard.audioRecorderModal.emptyState')}</Text>
              </View>
            }
            ListFooterComponent={
              recordings.length > 4 ? (
                <TouchableOpacity style={{ marginTop: 12, alignItems: 'center', padding: 8 }} onPress={handleOpenFullList}>
                  <Text style={{ color: theme.colors.primary, fontWeight: '500' }}>
                    {t('dashboard.audioRecorderModal.viewAll', { count: recordings.length })}
                  </Text>
                </TouchableOpacity>
              ) : null
            }
          />
        </View>
      </Pressable>
    </Modal>
  );
};
