import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';

interface Props {
  dueCount: number;
  onReview: () => void;
  onSnooze: () => void;
}

export function UrgentReviewsCard({ dueCount, onReview, onSnooze }: Props) {
  const { t } = useTranslation();

  return (
    <View style={styles.wrapper}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>{t('dashboard.urgentReviews')}</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.snoozeBtn}
            onPress={onSnooze}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="pause-circle" size={18} color={theme.colors.warning} />
          </TouchableOpacity>
          <View style={styles.chip}>
            <Text style={styles.chipCount}>{dueCount}</Text>
            <Text style={styles.chipLabel}>{t('dashboard.decks')}</Text>
          </View>
        </View>
      </View>
      <View style={styles.card}>
        <View style={styles.badge}>
          <MaterialCommunityIcons name="brain" size={24} color={theme.colors.danger} />
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={1}>{t('dashboard.attentionRequired')}</Text>
          <Text style={styles.cardSubtext} numberOfLines={1}>
            {dueCount === 1
              ? t('dashboard.deckToReview')
              : t('dashboard.decksToReview', { count: dueCount })}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.reviewBtn}
          onPress={onReview}
        >
          <Text style={styles.reviewBtnText}>{t('dashboard.reviewBtn')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: '700',
    color: theme.colors.text.primary,
    letterSpacing: -0.3,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  snoozeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chip: {
    backgroundColor: theme.colors.dangerTransparent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.danger + '20',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chipCount: {
    color: theme.colors.danger,
    fontWeight: '800',
    fontSize: 12,
  },
  chipLabel: {
    color: theme.colors.danger,
    fontWeight: '500',
    fontSize: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: 14,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: theme.colors.dangerTransparent,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  cardSubtext: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text.secondary,
    marginTop: 3,
  },
  reviewBtn: {
    backgroundColor: theme.colors.inputBackground,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.danger + '30',
    flexShrink: 0,
  },
  reviewBtnText: {
    color: theme.colors.danger,
    fontWeight: '600',
    fontSize: theme.typography.sizes.sm,
  },
});
