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
import { recordCardReview, CardReviewResponse } from '../../services/api/analytics';
import { useCustomAlert } from '../ui/CustomAlert';
import { theme } from '../../styles/theme';
import { styles } from '../../styles/CardReviewModal.styles';


// ─── Types ───────────────────────────────────────────────────────────────────

export interface CardReviewCard {
  cardId: string;
  front: string;
  back: string;
}

interface CardReviewModalProps {
  isVisible: boolean;
  card: CardReviewCard | null;
  userId: string;
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
  const { t, i18n } = useTranslation();
  const { showAlert } = useCustomAlert();

  // Timer state
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
        message: error.message || t('common.errorRecordingReview'),
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
    if (elapsedTime < 3) return { label: t('modals.qualityPerfect'), color: '#4CAF50' };
    if (elapsedTime < 8) return { label: t('modals.qualityGood'), color: '#2196F3' };
    if (elapsedTime < 15) return { label: t('modals.qualityAcceptable'), color: '#FF9800' };
    return { label: t('modals.qualitySlow'), color: '#F44336' };
  }, [elapsedTime, t]);

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
            <Ionicons name="close" size={24} color={theme.colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('modals.cardReview')}</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {!reviewResult ? (
            // Review Interface
            <>
              {/* Timer */}
              <View style={styles.timerSection}>
                <Text style={styles.timerLabel}>{t('modals.timeElapsed')}</Text>
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
                    <Text style={styles.cardLabel}>{t('modals.question')}</Text>
                    <Text style={styles.cardContent}>{card.front}</Text>
                    <View style={styles.flipHint}>
                      <Ionicons name="swap-horizontal-outline" size={16} color="#999" />
                      <Text style={styles.flipHintText}>{t('modals.tapToSeeAnswer')}</Text>
                    </View>
                  </Animated.View>

                  {/* Back Side */}
                  <Animated.View
                    style={[
                      styles.flipCard,
                      { opacity: backOpacity, transform: [{ rotateY: backRotate }] },
                    ]}
                  >
                    <Text style={styles.cardLabel}>{t('modals.answer')}</Text>
                    <Text style={styles.cardContent}>{card.back}</Text>
                    <View style={styles.flipHint}>
                      <Ionicons name="swap-horizontal-outline" size={16} color="#999" />
                      <Text style={styles.flipHintText}>{t('modals.tapToSeeQuestion')}</Text>
                    </View>
                  </Animated.View>
                </TouchableOpacity>
              </View>

              {/* Instructions */}
              {isFlipped && (
                <View style={styles.instructions}>
                  <Text style={styles.instructionsTitle}>{t('modals.rememberAnswer')}</Text>
                  <Text style={styles.instructionsText}>{t('modals.selectCorrectOrNot')}</Text>
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
                  <Text style={styles.buttonText}>{t('modals.incorrect')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.correctButton]}
                  onPress={() => handleReview('correct')}
                  disabled={isSubmitting || !isFlipped}
                >
                  <Ionicons name="checkmark-circle" size={20} color="white" />
                  <Text style={styles.buttonText}>{t('modals.correct')}</Text>
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
                  {reviewResult.quality >= 3 ? t('modals.excellent') : t('modals.needsPractice')}
                </Text>
              </View>

              {/* FSRS Metrics */}
              <View style={styles.metricsGrid}>
                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>{t('modals.retention')}</Text>
                  <Text style={styles.metricValue}>{reviewResult.retention}%</Text>
                </View>

                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>{t('modals.stability')}</Text>
                  <Text style={styles.metricValue}>{reviewResult.newStability.toFixed(2)}</Text>
                </View>

                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>{t('modals.difficulty')}</Text>
                  <Text style={styles.metricValue}>{reviewResult.newDifficulty.toFixed(2)}</Text>
                </View>

                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>{t('modals.repetitions')}</Text>
                  <Text style={styles.metricValue}>{reviewResult.newRepetitions}</Text>
                </View>
              </View>

              {/* Next Review */}
              <View style={styles.nextReviewBox}>
                <View style={styles.nextReviewHeader}>
                  <Ionicons name="calendar" size={20} color={theme.colors.primary} />
                  <Text style={styles.nextReviewTitle}>{t('modals.nextReview')}</Text>
                </View>
                <Text style={styles.nextReviewDate}>
                  {new Date(reviewResult.nextReviewDate).toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'es-ES', {
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
                <Text style={styles.continueButtonText}>{t('modals.continue')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

