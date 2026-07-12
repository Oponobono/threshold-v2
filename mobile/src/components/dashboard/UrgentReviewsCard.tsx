import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { urgentReviewsCardStyles } from '../../styles/UrgentReviewsCard.styles';

interface Props {
  dueCount: number;
  onReview: () => void;
  onSnooze: () => void;
}

export function UrgentReviewsCard({ dueCount, onReview, onSnooze }: Props) {
  const { t } = useTranslation();

  return (
    <View style={urgentReviewsCardStyles.wrapper}>
      <View style={urgentReviewsCardStyles.headerRow}>
        <Text style={urgentReviewsCardStyles.sectionTitle}>{t('dashboard.urgentReviews')}</Text>
        <View style={urgentReviewsCardStyles.headerRight}>
          <TouchableOpacity
            style={urgentReviewsCardStyles.snoozeBtn}
            onPress={onSnooze}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="pause-circle" size={18} color={theme.colors.warning} />
          </TouchableOpacity>
          <View style={urgentReviewsCardStyles.chip}>
            <Text style={urgentReviewsCardStyles.chipCount}>{dueCount}</Text>
            <Text style={urgentReviewsCardStyles.chipLabel}>{t('dashboard.decks')}</Text>
          </View>
        </View>
      </View>
      <View style={urgentReviewsCardStyles.card}>
        <View style={urgentReviewsCardStyles.badge}>
          <MaterialCommunityIcons name="brain" size={24} color={theme.colors.danger} />
        </View>
        <View style={urgentReviewsCardStyles.cardBody}>
          <Text style={urgentReviewsCardStyles.cardTitle} numberOfLines={1}>{t('dashboard.attentionRequired')}</Text>
          <Text style={urgentReviewsCardStyles.cardSubtext} numberOfLines={1}>
            {dueCount === 1
              ? t('dashboard.deckToReview')
              : t('dashboard.decksToReview', { count: dueCount })}
          </Text>
        </View>
        <TouchableOpacity
          style={urgentReviewsCardStyles.reviewBtn}
          onPress={onReview}
        >
          <Text style={urgentReviewsCardStyles.reviewBtnText}>{t('dashboard.reviewBtn')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
