import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNextClass } from '../../hooks/useNextClass';
import { dashboardStyles as styles } from '../../styles/Dashboard.styles';

const COLOR = '#FF9500';

interface NextClassCardProps {
  onPress?: () => void;
}

export function NextClassCard({ onPress }: NextClassCardProps) {
  const nextClass = useNextClass();
  const { t } = useTranslation();

  if (!nextClass) {
    return (
      <TouchableOpacity style={styles.actionItem} activeOpacity={0.65} onPress={onPress}>
        <View style={[styles.actionCircle, { backgroundColor: COLOR + '08', borderColor: COLOR + '20' }]}>
          <Ionicons name="time-outline" size={28} color={COLOR} />
        </View>
        <Text style={styles.actionText} numberOfLines={1}>
          {t('dashboard.noClasses')}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={styles.actionItem}
      activeOpacity={0.65}
      onPress={onPress}
    >
      <View style={[styles.actionCircle, { backgroundColor: COLOR + '08', borderColor: COLOR + '20' }]}>
        <Ionicons name="time" size={28} color={COLOR} />
      </View>
      <Text style={styles.actionText} numberOfLines={1}>
        {nextClass.subjectName}
      </Text>
      <Text style={[styles.actionText, { fontSize: 10, opacity: 0.6 }]} numberOfLines={1}>
        {nextClass.start_time} - {nextClass.end_time}
      </Text>
    </TouchableOpacity>
  );
}
