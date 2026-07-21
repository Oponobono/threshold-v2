import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable, ScrollView, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFonts, CabinSketch_700Bold, CabinSketch_400Regular } from '@expo-google-fonts/cabin-sketch';
import { useDataStore } from '../../store/useDataStore';
import { subjectsStyles as styles } from '../../styles/Subjects.styles';
import { theme } from '../../styles/theme';

const CHALK_BG = '#2c4a2e';
const CHALK_LINE = 'rgba(255,255,255,0.08)';
const CHALK_BORDER = 'rgba(255,255,255,0.15)';
const CHALK_TEXT = '#e8f0d8';
const CHALK_MUTED = 'rgba(232,240,216,0.55)';
const CHALK_HEADER_BG = '#1e3320';

export const ScheduleGrid = () => {
  const { t } = useTranslation();
  const { schedules, subjects } = useDataStore();
  const [modalVisible, setModalVisible] = useState(false);
  const [chalkMode, setChalkMode] = useState(false);

  const [fontsLoaded] = useFonts({ CabinSketch_700Bold, CabinSketch_400Regular });

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

  const chalkFont = fontsLoaded ? 'CabinSketch_700Bold' : undefined;
  const chalkFontRegular = fontsLoaded ? 'CabinSketch_400Regular' : undefined;

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
                        <View key={entry.id || idx} style={[styles.sgBlock, { backgroundColor: color }]} />
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
          <Pressable
            style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.7)' }}
            onPress={() => setModalVisible(false)}
          />

          <View style={{
            backgroundColor: chalkMode ? CHALK_BG : theme.colors.card,
            borderRadius: 20,
            overflow: 'hidden',
            maxHeight: '88%',
            width: '100%',
            flexShrink: 1,
            zIndex: 1,
            borderWidth: chalkMode ? 2 : 0,
            borderColor: chalkMode ? 'rgba(255,255,255,0.12)' : 'transparent',
          }}>

            {/* ── Header ── */}
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: chalkMode ? CHALK_BORDER : theme.colors.border,
              backgroundColor: chalkMode ? CHALK_HEADER_BG : 'transparent',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{
                  color: chalkMode ? CHALK_TEXT : theme.colors.text.primary,
                  fontSize: 18,
                  fontWeight: chalkMode ? undefined : '700',
                  fontFamily: chalkMode ? chalkFont : undefined,
                  letterSpacing: chalkMode ? 1 : 0,
                }}>
                  {t('subjects.scheduleGridTitle')}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {/* Theme toggle */}
                <TouchableOpacity
                  onPress={() => setChalkMode(v => !v)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: chalkMode ? CHALK_BORDER : theme.colors.border,
                    backgroundColor: chalkMode ? 'rgba(255,255,255,0.08)' : theme.colors.inputBackground,
                  }}
                >
                  <MaterialCommunityIcons
                    name={chalkMode ? 'monitor' : 'projector'}
                    size={14}
                    color={chalkMode ? CHALK_TEXT : theme.colors.text.secondary}
                  />
                  <Text style={{
                    fontSize: 12,
                    color: chalkMode ? CHALK_TEXT : theme.colors.text.secondary,
                    fontFamily: chalkMode ? chalkFontRegular : undefined,
                    fontWeight: chalkMode ? undefined : '600',
                  }}>
                    {chalkMode ? 'Digital' : 'Pizarra'}
                  </Text>
                </TouchableOpacity>

                {/* Close */}
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={24} color={chalkMode ? CHALK_MUTED : theme.colors.text.secondary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* ── Grid ── */}
            <ScrollView bounces={false} style={{ flexShrink: 1, width: '100%', backgroundColor: chalkMode ? CHALK_BG : 'transparent' }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false} style={{ width: '100%' }} contentContainerStyle={{ padding: 16 }}>
                <View>
                  {/* Day headers */}
                  <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                    <View style={{ width: 45 }} />
                    {dayLabels.map(day => (
                      <View key={day} style={{ width: 85, alignItems: 'center', paddingBottom: 8, borderBottomWidth: chalkMode ? 1 : 0, borderColor: CHALK_BORDER }}>
                        <Text style={{
                          fontSize: 13,
                          color: chalkMode ? CHALK_TEXT : theme.colors.text.secondary,
                          fontFamily: chalkMode ? chalkFont : undefined,
                          fontWeight: chalkMode ? undefined : '600',
                          letterSpacing: chalkMode ? 2 : 0,
                        }}>
                          {day.toUpperCase()}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Time rows */}
                  {timeSlots.map((hour, rowIdx) => (
                    <View
                      key={hour}
                      style={{
                        flexDirection: 'row',
                        minHeight: 65,
                        marginBottom: 2,
                        borderTopWidth: chalkMode ? 1 : 0,
                        borderColor: CHALK_LINE,
                        backgroundColor: chalkMode && rowIdx % 2 === 0 ? 'rgba(0,0,0,0.08)' : 'transparent',
                      }}
                    >
                      <View style={{ width: 45, justifyContent: 'flex-start', paddingTop: 8 }}>
                        <Text style={{
                          fontSize: 12,
                          color: chalkMode ? CHALK_MUTED : theme.colors.text.secondary,
                          fontFamily: chalkMode ? chalkFontRegular : undefined,
                          fontWeight: chalkMode ? undefined : '500',
                        }}>
                          {`${hour}:00`}
                        </Text>
                      </View>

                      {[1, 2, 3, 4, 5, 6, 7].map(day => {
                        const rawEntries = gridMap[`${day}-${hour}`] || [];
                        const entries = Array.from(new Map(rawEntries.map((e: any) => [e.subject_id, e])).values());

                        return (
                          <View key={`${day}-${hour}`} style={{ width: 85, paddingHorizontal: 3, justifyContent: 'center' }}>
                            {entries.map((entry: any, idx: number) => {
                              const subject = subjects?.find((s: any) => s.id === entry.subject_id);
                              const color = subject?.color || entry.color || theme.colors.primary;
                              const name = subject?.name || '';

                              if (chalkMode) {
                                return (
                                  <View
                                    key={`chalk-${entry.id || idx}`}
                                    style={{
                                      flex: 1,
                                      borderRadius: 8,
                                      borderWidth: 1.5,
                                      borderColor: color,
                                      backgroundColor: `${color}22`,
                                      padding: 4,
                                      marginBottom: 2,
                                      minHeight: 52,
                                      justifyContent: 'center',
                                      alignItems: 'center',
                                      overflow: 'hidden',
                                    }}
                                  >
                                    <Text
                                      style={{
                                        color: CHALK_TEXT,
                                        fontSize: 11,
                                        fontFamily: chalkFont,
                                        textAlign: 'center',
                                        lineHeight: 18,
                                        textShadowColor: 'rgba(255,255,255,0.2)',
                                        textShadowOffset: { width: 0.5, height: 0.5 },
                                        textShadowRadius: 2,
                                      }}
                                      numberOfLines={3}
                                    >
                                      {name}
                                    </Text>
                                  </View>
                                );
                              }

                              return (
                                <View
                                  key={`digital-${entry.id || idx}`}
                                  style={{
                                    flex: 1,
                                    backgroundColor: color,
                                    borderRadius: 8,
                                    padding: 4,
                                    marginBottom: 2,
                                    minHeight: 52,
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    overflow: 'hidden',
                                  }}
                                >
                                  <Text style={{ color: theme.colors.text.secondary, fontSize: 11, fontWeight: '700', textAlign: 'center' }} numberOfLines={3}>
                                    {name}
                                  </Text>
                                </View>
                              );
                            })}
                            {!entries.length && (
                              <View style={{
                                flex: 1,
                                borderTopWidth: 1,
                                borderColor: chalkMode ? CHALK_LINE : theme.colors.border,
                                opacity: 0.3,
                                marginTop: 14,
                              }} />
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
