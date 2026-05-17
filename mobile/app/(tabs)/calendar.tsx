import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet, FlatList, InteractionManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { theme } from '../../src/styles/theme';
import { globalStyles } from '../../src/styles/globalStyles';
import { useDataStore } from '../../src/store/useDataStore';

const TODAY = new Date();

export default function CalendarScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();

  const weekLabels = Array.isArray(t('common.daysShort', { returnObjects: true }))
    ? (t('common.daysShort', { returnObjects: true }) as string[])
    : ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

  // ── Estado de navegación del mes ──────────────────────────────
  const [viewMonth, setViewMonth] = useState(TODAY.getMonth());
  const [viewYear, setViewYear]   = useState(TODAY.getFullYear());
  const [selectedDayNum, setSelectedDayNum] = useState(TODAY.getDate());

  // ── Datos del backend ─────────────────────────────────────────
  const { schedules: allSchedules, assessments: allAssessments, loadAllData } = useDataStore();

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      loadAllData();
    });
    return () => task.cancel();
  }, [loadAllData]);

  // ── Cálculos del mes en vista ─────────────────────────────────
  const daysInMonth  = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayRaw  = new Date(viewYear, viewMonth, 1).getDay();
  const startOffset  = firstDayRaw === 0 ? 6 : firstDayRaw - 1; // Lunes = 0

  const monthLabel = new Date(viewYear, viewMonth, 1)
    .toLocaleString(i18n.language === 'en' ? 'en-US' : 'es-ES', { month: 'long', year: 'numeric' });

  const isViewingCurrentMonth =
    viewMonth === TODAY.getMonth() && viewYear === TODAY.getFullYear();

  // ── Navegación ────────────────────────────────────────────────
  const goToPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
    setSelectedDayNum(1);
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
    setSelectedDayNum(1);
  };

  const goToToday = () => {
    setViewMonth(TODAY.getMonth());
    setViewYear(TODAY.getFullYear());
    setSelectedDayNum(TODAY.getDate());
  };

  // ── Lógica de actividades ─────────────────────────────────────
  const getDaySchedule = useCallback((day: number) => {
    const date = new Date(viewYear, viewMonth, day);
    let dayOfWeek = date.getDay();
    if (dayOfWeek === 0) dayOfWeek = 7;

    // Clases recurrentes — el endpoint /schedules/user/:id ya devuelve name y color de la materia
    const classes = allSchedules.filter(s => s.day_of_week === dayOfWeek).map(s => ({
      id: s.id,
      type: 'class',
      title: (s as any).name || t('calendar.defaultClassTitle'),          // nombre de la materia
      time: `${s.start_time} - ${s.end_time}`,
      color: (s as any).color || theme.colors.primary, // color de la materia
      start_time: s.start_time,
      subject_id: s.subject_id,
    }));

    // Tareas / evaluaciones — comparamos ambos formatos posibles de fecha:
    // DD-MM-YYYY (guardado desde la app) y YYYY-MM-DD (ISO, guardado desde otros flujos)
    const dd  = day.toString().padStart(2, '0');
    const mm  = (viewMonth + 1).toString().padStart(2, '0');
    const yyyy = viewYear.toString();
    const dateStrDMY  = `${dd}-${mm}-${yyyy}`;   // 26-04-2026
    const dateStrISO  = `${yyyy}-${mm}-${dd}`;   // 2026-04-26

    const tasks = (allAssessments as any[])
      .filter((a: any) => a.date === dateStrDMY || a.date === dateStrISO)
      .map((a: any) => ({
        id: a.id,
        title: a.name,
        time: a.type === 'task' ? (a.time || t('calendar.allDay')) : (a.type || t('calendar.defaultAssessmentTitle')),
        color: a.subject_color || theme.colors.primary,
        type: 'task',
        start_time: '23:59',
        subject_id: a.subject_id,
      }));

    return [...classes, ...tasks].sort((a: any, b: any) =>
      (a.start_time || '00:00').localeCompare(b.start_time || '00:00')
    );
  }, [allSchedules, allAssessments, viewYear, viewMonth, t]);

  const getActivitySummary = (day: number) => {
    const schedule = getDaySchedule(day);
    return {
      hasClasses: schedule.some((item: any) => item.type === 'class'),
      hasTasks: schedule.some((item: any) => item.type === 'task'),
    };
  };

  const filteredEvents = useMemo(
    () => getDaySchedule(selectedDayNum),
    [getDaySchedule, selectedDayNum]
  );

  const isToday = (day: number) =>
    isViewingCurrentMonth && day === TODAY.getDate();

  // ── Nombre del día seleccionado ───────────────────────────────
  const selectedDayLabel = new Date(viewYear, viewMonth, selectedDayNum)
    .toLocaleString(i18n.language === 'en' ? 'en-US' : 'es-ES', { weekday: 'long', day: 'numeric', month: 'short' });

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={globalStyles.safeArea}>
      {/* ── HEADER ─────────────────────────────────────────────── */}
      <View style={styles.headerContainer}>
        <View style={globalStyles.row}>
          <Ionicons name="calendar-outline" size={20} color={theme.colors.primary} style={globalStyles.mr8} />
          <Text style={styles.headerTitle}>{t('dashboard.tabs.calendar')}</Text>
        </View>
        {!isViewingCurrentMonth && (
          <TouchableOpacity onPress={goToToday} style={styles.todayPill}>
            <Ionicons name="today-outline" size={14} color={theme.colors.primary} />
            <Text style={styles.todayPillText}>{t('calendar.today')}</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* ── CARD CALENDARIO ─────────────────────────────────── */}
        <View style={styles.calendarCard}>

          {/* Navegación de mes */}
          <View style={styles.monthNav}>
            <TouchableOpacity style={styles.navBtn} onPress={goToPrevMonth} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="chevron-back" size={20} color={theme.colors.text.primary} />
            </TouchableOpacity>

            <Text style={styles.monthLabel}>{monthLabel}</Text>

            <TouchableOpacity style={styles.navBtn} onPress={goToNextMonth} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.text.primary} />
            </TouchableOpacity>
          </View>

          {/* Etiquetas de días de la semana */}
          <View style={styles.weekLabels}>
            {weekLabels.map((d, i) => (
              <Text key={i} style={styles.weekLabelText}>{d}</Text>
            ))}
          </View>

          {/* Grid de días */}
          <View style={styles.grid}>
            {Array.from({ length: startOffset }).map((_, i) => (
              <View key={`offset-${i}`} style={styles.cell} />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const selected = day === selectedDayNum;
              const today    = isToday(day);
              const { hasClasses, hasTasks } = getActivitySummary(day);

              return (
                <TouchableOpacity
                  key={day}
                  onPress={() => setSelectedDayNum(day)}
                  style={[
                    styles.cell,
                    selected && styles.selectedCell,
                    !selected && today && styles.todayCell,
                  ]}
                >
                  <Text style={[
                    styles.cellText,
                    selected && styles.selectedCellText,
                    !selected && today && styles.todayCellText,
                  ]}>
                    {day}
                  </Text>
                  
                  {(!selected && (hasClasses || hasTasks)) && (
                    <View style={styles.dotsContainer}>
                      {hasClasses && <View style={[styles.activityDot, { backgroundColor: '#2F80ED' }]} />}
                      {hasTasks && <View style={[styles.activityDot, { backgroundColor: '#FF9500' }]} />}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── AGENDA ──────────────────────────────────────────── */}
        <View style={styles.agendaHeader}>
          <Text style={styles.agendaTitle}>{selectedDayLabel}</Text>
          <View style={styles.agendaBadge}>
            <Text style={styles.agendaBadgeText}>{filteredEvents.length}</Text>
          </View>
        </View>

        <View style={styles.eventsColumn}>
          {filteredEvents.length > 0 ? (
            <FlatList
              data={filteredEvents}
              keyExtractor={(item, index) => item.id ? item.id.toString() : index.toString()}
              scrollEnabled={false} // Since it's inside a ScrollView
              removeClippedSubviews={true}
              maxToRenderPerBatch={10}
              initialNumToRender={5}
              windowSize={5}
              contentContainerStyle={{ gap: 10 }}
              renderItem={({ item, index }) => (
                <TouchableOpacity 
                  style={styles.eventItem} 
                  activeOpacity={0.7}
                  onPress={() => {
                    if (item.subject_id) {
                      router.push(`/subjects/${item.subject_id}`);
                    }
                  }}
                >
                  <View style={[styles.colorBar, { backgroundColor: item.color || theme.colors.primary }]} />
                  <View style={styles.eventTextContainer}>
                    <Text style={styles.eventTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.eventTime}>{item.time}</Text>
                  </View>
                  <View style={[styles.eventTypeBadge, { backgroundColor: item.type === 'task' ? '#FFE8CC' : '#DDEEFF' }]}>
                    <Ionicons
                      name={item.type === 'task' ? 'clipboard-outline' : 'time-outline'}
                      size={14}
                      color={item.type === 'task' ? '#FF9500' : '#2F80ED'}
                    />
                  </View>
                </TouchableOpacity>
              )}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="cafe-outline" size={38} color={theme.colors.border} />
              <Text style={styles.emptyText}>{t('calendar.emptyEvents')}</Text>
            </View>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerContainer: globalStyles.standardHeader,
  headerTitle: {
    ...globalStyles.screenTitle,
    flex: 1,
  },
  todayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.primary + '30',
  },
  todayPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 40,
  },
  calendarCard: {
    backgroundColor: theme.colors.background,
    borderRadius: 24,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: theme.colors.inputBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text.primary,
    textTransform: 'capitalize',
    letterSpacing: -0.3,
  },
  weekLabels: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  weekLabelText: {
    width: '14.28%',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text.secondary,
    textTransform: 'uppercase',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '14.28%',
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  cellText: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.colors.text.primary,
  },
  selectedCell: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
  },
  selectedCellText: {
    color: '#FFF',
    fontWeight: '700',
  },
  todayCell: {
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    borderRadius: 12,
  },
  todayCellText: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  dotsContainer: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 6,
    gap: 3,
  },
  activityDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  // ── AGENDA ─────────────────────────────────────────────────────
  agendaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  agendaTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text.primary,
    textTransform: 'capitalize',
    letterSpacing: -0.2,
  },
  agendaBadge: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  agendaBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  eventsColumn: {
    gap: 10,
  },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    elevation: 1,
  },
  colorBar: {
    width: 4,
    height: '100%',
    minHeight: 36,
    borderRadius: 2,
    marginRight: 12,
  },
  eventTextContainer: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  eventTime: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    marginTop: 2,
    fontWeight: '400',
  },
  eventTypeBadge: {
    width: 30,
    height: 30,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptyText: {
    color: theme.colors.text.secondary,
    fontSize: 14,
    fontWeight: '500',
  },
});