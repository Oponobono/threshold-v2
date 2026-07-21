import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable, ScrollView, Dimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useDataStore } from '../../store/useDataStore';
import { subjectsStyles as styles } from '../../styles/Subjects.styles';
import { theme } from '../../styles/theme';

export const ScheduleGrid = () => {
  const { t } = useTranslation();
  const { schedules, subjects } = useDataStore();
  const [modalVisible, setModalVisible] = useState(false);

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

  const screenWidth = Dimensions.get('window').width;
  const gridWidth = Math.max(screenWidth - 64, 500);

  return (
    <>
      <TouchableOpacity 
        style={styles.scheduleGridSection}
        activeOpacity={0.8}
        onPress={() => setModalVisible(true)}
      >
        <View style={styles.scheduleGridHeader}>
          <Text style={styles.scheduleGridTitle}>{t('subjects.scheduleGridTitle')}</Text>
          <Ionicons name="expand" size={14} color={theme.colors.text.secondary} />
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
                    {entries?.map((entry: any, idx: number) => {
                      const subject = subjects?.find((s: any) => s.id === entry.subject_id);
                      const color = subject?.color || entry.color || theme.colors.primary;
                      return (
                        <View
                          key={entry.id || idx}
                          style={[styles.sgBlock, { backgroundColor: color }]}
                        />
                      );
                    })}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
          <Pressable style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)' }} onPress={() => setModalVisible(false)} />
          
          <View style={{ backgroundColor: theme.colors.card, borderRadius: 20, overflow: 'hidden', maxHeight: '85%', width: '100%', flexShrink: 1, zIndex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
              <Text style={{ color: theme.colors.text.primary, fontSize: 18, fontWeight: '700' }}>{t('subjects.scheduleGridTitle')}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.colors.text.secondary} />
              </TouchableOpacity>
            </View>
            <ScrollView bounces={false} style={{ flexShrink: 1, width: '100%' }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false} style={{ width: '100%' }} contentContainerStyle={{ padding: 16 }}>
                <View>
                  <View style={{ flexDirection: 'row', marginBottom: 12 }}>
                    <View style={{ width: 45 }} />
                    {dayLabels.map(day => (
                      <View key={day} style={{ width: 85, alignItems: 'center' }}>
                        <Text style={{ fontSize: 13, color: theme.colors.text.secondary, fontWeight: '600' }}>{day}</Text>
                      </View>
                    ))}
                  </View>
                  {timeSlots.map(hour => (
                    <View key={hour} style={{ flexDirection: 'row', minHeight: 60, marginBottom: 2 }}>
                      <View style={{ width: 45, justifyContent: 'flex-start', paddingTop: 6 }}>
                        <Text style={{ fontSize: 12, color: theme.colors.text.secondary, fontWeight: '500' }}>{`${hour}:00`}</Text>
                      </View>
                      {[1, 2, 3, 4, 5, 6, 7].map(day => {
                        const rawEntries = gridMap[`${day}-${hour}`] || [];
                        // Deduplicate entries by subject_id to prevent double blocks
                        const entries = Array.from(new Map(rawEntries.map((e: any) => [e.subject_id, e])).values());

                        return (
                          <View key={`${day}-${hour}`} style={{ width: 85, paddingHorizontal: 2 }}>
                            {entries.map((entry: any, idx: number) => {
                              const subject = subjects?.find((s: any) => s.id === entry.subject_id);
                              const color = subject?.color || entry.color || theme.colors.primary;
                              const name = subject?.name || '';
                              return (
                                <View key={entry.id || idx} style={{ flex: 1, backgroundColor: color, borderRadius: 8, padding: 4, marginBottom: 2, minHeight: 50, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
                                   <Text style={{ color: theme.colors.text.secondary, fontSize: 10, fontWeight: '700', textAlign: 'center' }} numberOfLines={3}>
                                     {name}
                                   </Text>
                                </View>
                              );
                            })}
                            {!entries.length && (
                              <View style={{ flex: 1, borderTopWidth: 1, borderColor: theme.colors.border, opacity: 0.3, marginTop: 12 }} />
                            )}
                          </View>
                        );
                      })}
                    </View>
                  ))}
                </View>
              </ScrollView>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};
