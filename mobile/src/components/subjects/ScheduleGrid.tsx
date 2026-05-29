import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useDataStore } from '../../store/useDataStore';
import { subjectsStyles as styles } from '../../styles/Subjects.styles';
import { theme } from '../../styles/theme';

export const ScheduleGrid = () => {
  const { t } = useTranslation();
  const { schedules } = useDataStore();

  const dayLabels = useMemo(() => {
    const raw = t('common.daysShort', { returnObjects: true });
    return Array.isArray(raw) ? (raw as string[]) : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  }, [t]);

  const timeSlots = useMemo(() => {
    if (!Array.isArray(schedules) || schedules.length === 0) return [];
    const hours = new Set<number>();
    schedules.forEach((s: any) => {
      const sh = parseInt(s.start_time?.split(':')[0] || '0', 10);
      const eh = parseInt(s.end_time?.split(':')[0] || '0', 10);
      for (let h = sh; h < eh; h++) hours.add(h);
    });
    return Array.from(hours).sort((a, b) => a - b);
  }, [schedules]);

  const gridMap = useMemo(() => {
    const map: Record<string, any[]> = {};
    if (!Array.isArray(schedules)) return map;
    schedules.forEach((s: any) => {
      const day = s.day_of_week;
      const sh = parseInt(s.start_time?.split(':')[0] || '0', 10);
      const eh = parseInt(s.end_time?.split(':')[0] || '0', 10);
      for (let h = sh; h < eh; h++) {
        const key = `${day}-${h}`;
        if (!map[key]) map[key] = [];
        map[key].push(s);
      }
    });
    return map;
  }, [schedules]);

  if (!Array.isArray(schedules) || schedules.length === 0 || timeSlots.length === 0) return null;

  return (
    <View style={styles.scheduleGridSection}>
      <View style={styles.scheduleGridHeader}>
        <Text style={styles.scheduleGridTitle}>{t('subjects.scheduleGridTitle')}</Text>
      </View>
      <View style={styles.scheduleGridContainer}>
        <View style={styles.sgRow}>
          <View style={styles.sgTimeCol} />
          {dayLabels.map((day) => (
            <View key={day} style={styles.sgDayCol}>
              <Text style={styles.sgDayText}>{day.toUpperCase()}</Text>
            </View>
          ))}
        </View>
        {timeSlots.map(hour => (
          <View key={hour} style={styles.sgRow}>
            <View style={styles.sgTimeCol}>
              <Text style={styles.sgTimeText}>{`${hour}:00`}</Text>
            </View>
            {[1, 2, 3, 4, 5, 6, 7].map(day => {
              const entries = gridMap[`${day}-${hour}`];
              return (
                <View key={`${day}-${hour}`} style={styles.sgCell}>
                  {entries?.map((entry: any, idx: number) => (
                    <View
                      key={entry.id || idx}
                      style={[styles.sgBlock, { backgroundColor: entry.color || theme.colors.primary }]}
                    />
                  ))}
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
};
