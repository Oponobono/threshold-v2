import React from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { recordingsStyles as styles } from '../../styles/RecordingsScreen.styles';

interface AudioRecorderBottomBarProps {
  isRecording: boolean;
  isPaused: boolean;
  recordingDuration: number;
  formatDuration: (ms: number) => string;
  pulseAnim: Animated.Value;
  meterAnim: Animated.AnimatedInterpolation<string | number>;
  insetsBottom: number;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

/**
 * Componente de la barra flotante de grabación de audio.
 * Muestra el botón de "Iniciar Grabación" o la barra activa con medidor de decibeles.
 */
export const AudioRecorderBottomBar: React.FC<AudioRecorderBottomBarProps> = ({
  isRecording,
  isPaused,
  recordingDuration,
  formatDuration,
  pulseAnim,
  meterAnim,
  insetsBottom,
  onStart,
  onPause,
  onResume,
  onStop,
}) => {
  const { t } = useTranslation();
  const safeBottom = Math.max(insetsBottom, 16) + 8;

  if (!isRecording) {
    return (
      <View style={[styles.idleRecorderContainer, { paddingBottom: safeBottom }]}>
        <TouchableOpacity onPress={onStart} style={styles.startRecordingBtn} activeOpacity={0.8}>
          <Ionicons name="mic" size={20} color="white" style={{ marginRight: 8 }} />
          <Text style={styles.startRecordingText}>
            {t('dashboard.audioRecorderModal.startRecording') || 'Iniciar Grabación'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.activeRecorderContainer,
        {
          bottom: safeBottom,
          borderColor: isPaused ? theme.colors.border : theme.colors.primary,
        },
      ]}
    >
      {/* Timer + waveform */}
      <View style={styles.recordingInfo}>
        <Animated.View
          style={[
            styles.recordingDot,
            isPaused && { backgroundColor: theme.colors.text.secondary },
            !isPaused && { opacity: pulseAnim },
          ]}
        />
        <Text style={styles.recordingTimerText}>{formatDuration(recordingDuration)}</Text>

        <View style={styles.wavesContainer}>
          {Array.from({ length: 15 }, (_, i) => {
            const baseRatio = 0.25 + Math.sin((i / 14) * Math.PI) * 0.75;
            const minH = 4;
            const maxH = 24;
            const barH = isPaused
              ? minH
              : (meterAnim as unknown as Animated.AnimatedInterpolation<number>).interpolate({
                  inputRange: [0, 1],
                  outputRange: [minH, minH + (maxH - minH) * baseRatio],
                });
            return (
              <Animated.View
                key={i}
                style={[
                  styles.waveBar,
                  {
                    height: barH,
                    backgroundColor: isPaused ? theme.colors.text.placeholder : theme.colors.primary,
                    opacity: isPaused ? 0.5 : 1,
                  },
                ]}
              />
            );
          })}
        </View>
      </View>

      {/* Controls */}
      <View style={styles.recordingControls}>
        <TouchableOpacity onPress={isPaused ? onResume : onPause} style={styles.iconBtn}>
          <Ionicons name={isPaused ? 'play' : 'pause'} size={20} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onStop} style={styles.stopBtn}>
          <Ionicons name="stop" size={18} color="white" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};
