import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

interface PendingBadgeProps {
  count?: number;
  style?: ViewStyle;
}

export const PendingBadge = ({ count, style }: PendingBadgeProps) => {
  const { t } = useTranslation();
  const label = count && count > 1
    ? t('common.pendingItemsCount', { count })
    : t('common.pendingItem');

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.icon}>⏳</Text>
      <Text style={styles.label}>{count ? label : t('common.pendingItem')}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  icon: {
    fontSize: 12,
  },
  label: {
    fontSize: 11,
    color: '#E65100',
    fontWeight: '600',
  },
});
