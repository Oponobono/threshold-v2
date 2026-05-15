/**
 * CardReviewModal.tsx
 *
 * Modal para revisar tarjetas individuales con cronómetro, flip animation,
 * y cálculo FSRS de métricas de retención.
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { recordCardReview, CardReviewResponse } from '../services/api/analytics';
import { useCustomAlert } from './CustomAlert';
import { theme } from '../styles/theme';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CardReviewCard {
  cardId: number;
  front: string;
  back: string;
}

interface CardReviewModalProps {
  isVisible: boolean;
  card: CardReviewCard | null;
  userId: number;
  onClose: () => void;
  onReviewComplete?: (result: CardReviewResponse) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const CardReviewModal: React.FC<CardReviewModalProps> = ({
  isVisible,
  card,
  userId,
  onClose,
  onReviewComplete,
}) => {
  const { t } = useTranslation();
  const { showAlert } = useCustomAlert();

  // Timer state
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Card flip state
  const [isFlipped, setIsFlipped] = useState(false);
  const flipAnim = useRef(new Animated.Value(0)).current;

  // Review state
  const [isAnswering, setIsAnswering] = useState(true);
  const [reviewResult, setReviewResult] = useState<CardReviewResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Start timer when modal opens
  useEffect(() => {
    if (isVisible && card) {
      setElapsedTime(0);
      setIsRunning(true);
      setIsFlipped(false);
      setIsAnswering(true);
      setReviewResult(null);
    }
  }, [isVisible, card]);

  // Timer effect
  useEffect(() => {
    if (isRunning && isAnswering) {
      timerRef.current = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [isRunning, isAnswering]);

  // Flip animation
  useEffect(() => {
    Animated.timing(flipAnim, {
      toValue: isFlipped ? 1 : 0,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [isFlipped, flipAnim]);

  const frontRotate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const backRotate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });

  const frontOpacity = flipAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0, 0],
  });

  const backOpacity = flipAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
  });

  // Handle review submission
  const handleReview = async (result: 'correct' | 'incorrect') => {
    if (!card) return;

    setIsRunning(false);
    setIsAnswering(false);
    setIsSubmitting(true);

    try {
      const response = await recordCardReview(
        card.cardId,
        userId,
        result,
        elapsedTime * 1000 // Convert to milliseconds
      );

      setReviewResult(response);
      setIsSubmitting(false);

      // Notify parent component
      onReviewComplete?.(response);
    } catch (error: any) {
      setIsSubmitting(false);
      showAlert({
        title: t('error'),
        message: error.message || t('error_recording_review'),
        type: 'error',
      });
    }
  };

  // Format time as MM:SS
  const formattedTime = useMemo(() => {
    const minutes = Math.floor(elapsedTime / 60);
    const seconds = elapsedTime % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, [elapsedTime]);

  // Quality assessment based on time
  const qualityHint = useMemo(() => {
    if (elapsedTime < 3) return { label: '⚡ Perfect', color: '#4CAF50' };
    if (elapsedTime < 8) return { label: '✓ Good', color: '#2196F3' };
    if (elapsedTime < 15) return { label: '⏱ Acceptable', color: '#FF9800' };
    return { label: '🐢 Slow', color: '#F44336' };
  }, [elapsedTime]);

  if (!card) return null;

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} disabled={isSubmitting}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('card_review') || 'Revisar Tarjeta'}</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {!reviewResult ? (
            // Review Interface
            <>
              {/* Timer */}
              <View style={styles.timerSection}>
                <Text style={styles.timerLabel}>{t('time_elapsed') || 'Tiempo'}</Text>
                <Text style={styles.timer}>{formattedTime}</Text>
                <View style={[styles.qualityBadge, { borderColor: qualityHint.color }]}>
                  <Text style={[styles.qualityText, { color: qualityHint.color }]}>
                    {qualityHint.label}
                  </Text>
                </View>
              </View>

              {/* Flip Card */}
              <View style={styles.flipCardContainer}>
                <TouchableOpacity
                  onPress={() => setIsFlipped(!isFlipped)}
                  style={styles.flipCardButton}
                  disabled={isSubmitting}
                >
                  {/* Front Side */}
                  <Animated.View
                    style={[
                      styles.flipCard,
                      { opacity: frontOpacity, transform: [{ rotateY: frontRotate }] },
                    ]}
                  >
                    <Text style={styles.cardLabel}>Pregunta</Text>
                    <Text style={styles.cardContent}>{card.front}</Text>
                    <View style={styles.flipHint}>
                      <Ionicons name="swap" size={16} color="#999" />
                      <Text style={styles.flipHintText}>Toca para ver respuesta</Text>
                    </View>
                  </Animated.View>

                  {/* Back Side */}
                  <Animated.View
                    style={[
                      styles.flipCard,
                      { opacity: backOpacity, transform: [{ rotateY: backRotate }] },
                    ]}
                  >
                    <Text style={styles.cardLabel}>Respuesta</Text>
                    <Text style={styles.cardContent}>{card.back}</Text>
                    <View style={styles.flipHint}>
                      <Ionicons name="swap" size={16} color="#999" />
                      <Text style={styles.flipHintText}>Toca para ver pregunta</Text>
                    </View>
                  </Animated.View>
                </TouchableOpacity>
              </View>

              {/* Instructions */}
              {isFlipped && (
                <View style={styles.instructions}>
                  <Text style={styles.instructionsTitle}>¿Recuerdas la respuesta?</Text>
                  <Text style={styles.instructionsText}>
                    Selecciona si respondiste correctamente o no
                  </Text>
                </View>
              )}

              {/* Review Buttons */}
              <View style={styles.buttonGroup}>
                <TouchableOpacity
                  style={[styles.button, styles.incorrectButton]}
                  onPress={() => handleReview('incorrect')}
                  disabled={isSubmitting || !isFlipped}
                >
                  <Ionicons name="close-circle" size={20} color="white" />
                  <Text style={styles.buttonText}>Incorrecto</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.correctButton]}
                  onPress={() => handleReview('correct')}
                  disabled={isSubmitting || !isFlipped}
                >
                  <Ionicons name="checkmark-circle" size={20} color="white" />
                  <Text style={styles.buttonText}>Correcto</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            // Results Interface
            <View style={styles.resultsSection}>
              <View style={styles.resultHeader}>
                <Ionicons
                  name={reviewResult.quality >= 3 ? 'checkmark-done-circle' : 'close-circle'}
                  size={56}
                  color={reviewResult.quality >= 3 ? '#4CAF50' : '#F44336'}
                />
                <Text style={[
                  styles.resultTitle,
                  { color: reviewResult.quality >= 3 ? '#4CAF50' : '#F44336' },
                ]}>
                  {reviewResult.quality >= 3 ? '¡Excelente!' : 'Necesitas practicar'}
                </Text>
              </View>

              {/* FSRS Metrics */}
              <View style={styles.metricsGrid}>
                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>Retención</Text>
                  <Text style={styles.metricValue}>{reviewResult.retention}%</Text>
                </View>

                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>Estabilidad</Text>
                  <Text style={styles.metricValue}>{reviewResult.newStability.toFixed(2)}</Text>
                </View>

                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>Dificultad</Text>
                  <Text style={styles.metricValue}>{reviewResult.newDifficulty.toFixed(2)}</Text>
                </View>

                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>Repeticiones</Text>
                  <Text style={styles.metricValue}>{reviewResult.newRepetitions}</Text>
                </View>
              </View>

              {/* Next Review */}
              <View style={styles.nextReviewBox}>
                <View style={styles.nextReviewHeader}>
                  <Ionicons name="calendar" size={20} color={theme.colors.primary} />
                  <Text style={styles.nextReviewTitle}>Próxima revisión</Text>
                </View>
                <Text style={styles.nextReviewDate}>
                  {new Date(reviewResult.nextReviewDate).toLocaleDateString('es-ES', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </Text>
                <Text style={styles.nextReviewSubtext}>
                  {reviewResult.message}
                </Text>
              </View>

              {/* Continue Button */}
              <TouchableOpacity
                style={styles.continueButton}
                onPress={onClose}
              >
                <Text style={styles.continueButtonText}>Continuar</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  timerSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  timerLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
    textTransform: 'uppercase',
    fontWeight: '600',
    letterSpacing: 1,
  },
  timer: {
    fontSize: 48,
    fontWeight: 'bold',
    color: theme.colors.primary,
    fontVariant: ['tabular-nums'],
  },
  qualityBadge: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 2,
  },
  qualityText: {
    fontSize: 12,
    fontWeight: '600',
  },
  flipCardContainer: {
    marginBottom: 24,
    perspective: 1000,
  },
  flipCardButton: {
    height: 300,
  },
  flipCard: {
    position: 'absolute',
    width: '100%',
    height: 300,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  cardLabel: {
    fontSize: 12,
    color: '#999',
    textTransform: 'uppercase',
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 8,
  },
  cardContent: {
    fontSize: 20,
    color: theme.colors.text,
    lineHeight: 28,
    flex: 1,
  },
  flipHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  flipHintText: {
    fontSize: 12,
    color: '#999',
  },
  instructions: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primary,
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 14,
    color: '#555',
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  incorrectButton: {
    backgroundColor: '#F44336',
  },
  correctButton: {
    backgroundColor: '#4CAF50',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  resultsSection: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
  },
  resultHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 12,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  nextReviewBox: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },
  nextReviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  nextReviewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  nextReviewDate: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginBottom: 4,
  },
  nextReviewSubtext: {
    fontSize: 12,
    color: '#999',
  },
  continueButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  continueButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
