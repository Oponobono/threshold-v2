import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet, FlatList, Modal, Animated, Dimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { theme } from '../../src/styles/theme';
import { globalStyles } from '../../src/styles/globalStyles';
import { useDataStore } from '../../src/store/useDataStore';
import { EventCreationModal, CalendarEventInput } from '../../src/components/EventCreationModal';
import { createCalendarEvent, getCalendarEvents } from '../../src/services/api/calendar';
import { CreateTaskModal } from '../../src/components/dashboard/CreateTaskModal';
import { alertRef } from '../../src/components/CustomAlert';

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

  // ── Estado del modal de tareas ─────────────────────────────────
  const [taskModalVisible, setTaskModalVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);

  // ── Estado del modal de detalle de eventos ─────────────────────
  const [eventDetailVisible, setEventDetailVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  // ── Estado de creación de eventos ──────────────────────────────
  const [addMenuVisible, setAddMenuVisible] = useState(false);
  const [eventCreationVisible, setEventCreationVisible] = useState(false);
  const [taskCreationVisible, setTaskCreationVisible] = useState(false);

  // ── Estado de eventos del calendario ───────────────────────────
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  // ── Datos del backend ─────────────────────────────────────────
  const { schedules: allSchedules, assessments: allAssessments, loadAllData } = useDataStore();

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // ── Cargar eventos del calendario cuando cambia el mes ────────
  useEffect(() => {
    const loadEventsForMonth = async () => {
      try {
        setLoadingEvents(true);
        // Crear rangos de fecha para el mes actual
        const firstDay = new Date(viewYear, viewMonth, 1);
        const lastDay = new Date(viewYear, viewMonth + 1, 0);
        
        const startDay = String(firstDay.getDate()).padStart(2, '0');
        const startMonth = String(firstDay.getMonth() + 1).padStart(2, '0');
        const startYear = firstDay.getFullYear();
        const startDateStr = `${startDay}-${startMonth}-${startYear}`;
        
        const endDay = String(lastDay.getDate()).padStart(2, '0');
        const endMonth = String(lastDay.getMonth() + 1).padStart(2, '0');
        const endYear = lastDay.getFullYear();
        const endDateStr = `${endDay}-${endMonth}-${endYear}`;
        
        const events = await getCalendarEvents(startDateStr, endDateStr);
        setCalendarEvents(events || []);
      } catch (error) {
        console.warn('Error cargando eventos del calendario:', error);
        setCalendarEvents([]);
      } finally {
        setLoadingEvents(false);
      }
    };

    loadEventsForMonth();
  }, [viewYear, viewMonth]);

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

    // Clases recurrentes — consolidar clases consecutivas de la misma materia
    const rawClasses = allSchedules.filter(s => s.day_of_week === dayOfWeek).map(s => ({
      id: s.id,
      type: 'class',
      title: (s as any).name || t('calendar.defaultClassTitle'),
      color: (s as any).color || theme.colors.primary,
      start_time: s.start_time,
      end_time: s.end_time,
      subject_id: s.subject_id,
    }));

    // Agrupar por subject_id y consolidar rangos horarios
    const classMap = new Map<number, any>();
    rawClasses.forEach(cls => {
      if (classMap.has(cls.subject_id)) {
        const existing = classMap.get(cls.subject_id)!;
        // Actualizar el rango de hora (inicio mínimo, fin máximo)
        const newStartTime = existing.start_time < cls.start_time ? existing.start_time : cls.start_time;
        const newEndTime = existing.end_time > cls.end_time ? existing.end_time : cls.end_time;
        existing.start_time = newStartTime;
        existing.end_time = newEndTime;
        existing.time = `${newStartTime} - ${newEndTime}`;
      } else {
        classMap.set(cls.subject_id, {
          ...cls,
          time: `${cls.start_time} - ${cls.end_time}`,
        });
      }
    });

    const classes = Array.from(classMap.values());

    // Tareas / evaluaciones — comparamos ambos formatos posibles de fecha:
    // DD-MM-YYYY (guardado desde la app) y YYYY-MM-DD (ISO, guardado desde otros flujos)
    const dd  = day.toString().padStart(2, '0');
    const mm  = (viewMonth + 1).toString().padStart(2, '0');
    const yyyy = viewYear.toString();
    const dateStrDMY  = `${dd}-${mm}-${yyyy}`;   // 26-04-2026
    const dateStrISO  = `${yyyy}-${mm}-${dd}`;   // 2026-04-26

    const rawTasks = (allAssessments as any[])
      .filter((a: any) => a.date === dateStrDMY || a.date === dateStrISO)
      .map((a: any) => ({
        assessmentId: a.id,
        assessmentData: a, // Guardar datos completos
        title: a.name,
        time: a.type === 'task' ? (a.time || t('calendar.allDay')) : (a.type || t('calendar.defaultAssessmentTitle')),
        color: a.subject_color || theme.colors.primary,
        type: 'task',
        start_time: '23:59',
        subject_id: a.subject_id,
      }));

    // Consolidar tareas por materia: si hay múltiples tareas de la misma materia, mostrar una sola con contador
    const taskMap = new Map<number, any>();
    rawTasks.forEach(task => {
      if (taskMap.has(task.subject_id)) {
        const existing = taskMap.get(task.subject_id)!;
        existing.count = (existing.count || 1) + 1;
        // Guardar referencia a todas las tareas consolidadas
        if (!existing.allAssessments) {
          existing.allAssessments = [existing.assessmentData];
        }
        existing.allAssessments.push(task.assessmentData);
      } else {
        taskMap.set(task.subject_id, {
          ...task,
          count: 1,
          allAssessments: [task.assessmentData],
        });
      }
    });

    const tasks = Array.from(taskMap.values()).map(task => ({
      ...task,
      id: task.assessmentId, // Usar como ID principal
      title: task.count > 1 
        ? `${task.title} +${task.count - 1}` 
        : task.title,
    }));

    // ── Eventos del calendario (creados manualmente) ──────────────
    // Filtrar eventos que coincidan con este día
    const dayStr = day.toString().padStart(2, '0');
    const monthStr = (viewMonth + 1).toString().padStart(2, '0');
    const yearStr = viewYear.toString();
    const targetDate = `${dayStr}-${monthStr}-${yearStr}`; // DD-MM-YYYY

    const calendarDayEvents = (calendarEvents || [])
      .filter((event: any) => event.startDate === targetDate || event.start_date === targetDate)
      .map((event: any) => ({
        id: `event-${event.id}`,
        type: 'event',
        eventType: event.eventType || event.event_type,
        title: event.title,
        color: event.subjectColor || event.subject_color || '#A2845E',
        start_time: event.startTime || event.start_time || '08:00',
        end_time: event.endTime || event.end_time || '09:00',
        subject_id: event.subjectId || event.subject_id,
        description: event.description,
        allDay: event.allDay || event.all_day,
        time: event.allDay || event.all_day ? t('calendar.allDay') : `${event.startTime || event.start_time || '08:00'} - ${event.endTime || event.end_time || '09:00'}`,
      }));

    return [...classes, ...tasks, ...calendarDayEvents].sort((a: any, b: any) =>
      (a.start_time || '00:00').localeCompare(b.start_time || '00:00')
    );
  }, [allSchedules, allAssessments, calendarEvents, viewYear, viewMonth, t]);

  const getActivitySummary = (day: number) => {
    const schedule = getDaySchedule(day);
    return {
      hasClasses: schedule.some((item: any) => item.type === 'class'),
      hasTasks: schedule.some((item: any) => item.type === 'task'),
      hasEvents: schedule.some((item: any) => item.type === 'event'),
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
          <TouchableOpacity
            onPress={() => setAddMenuVisible(true)}
            style={styles.addButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="add" size={24} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>
        <View style={[globalStyles.row, styles.headerRightContainer]}>
          {!isViewingCurrentMonth && (
            <TouchableOpacity onPress={goToToday} style={styles.todayPill}>
              <Ionicons name="today-outline" size={14} color={theme.colors.primary} />
              <Text style={styles.todayPillText}>{t('calendar.today')}</Text>
            </TouchableOpacity>
          )}
        </View>
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
              const { hasClasses, hasTasks, hasEvents } = getActivitySummary(day);

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
                  
                  {(!selected && (hasClasses || hasTasks || hasEvents)) && (
                    <View style={styles.dotsContainer}>
                      {hasClasses && <View style={[styles.activityDot, { backgroundColor: '#2F80ED' }]} />}
                      {hasTasks && <View style={[styles.activityDot, { backgroundColor: '#FF9500' }]} />}
                      {hasEvents && <View style={[styles.activityDot, { backgroundColor: '#A2845E' }]} />}
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
                    if (item.type === 'task') {
                      // Abrir modal de tareas
                      setSelectedTask(item);
                      setTaskModalVisible(true);
                    } else if (item.type === 'event') {
                      // Abrir modal de detalle de evento
                      setSelectedEvent(item);
                      setEventDetailVisible(true);
                    } else if (item.subject_id) {
                      // Navegar a detalle de materia (clases)
                      router.push(`/subjects/${item.subject_id}`);
                    }
                  }}
                >
                  <View style={[styles.colorBar, { backgroundColor: item.color || theme.colors.primary }]} />
                  <View style={styles.eventTextContainer}>
                    <Text style={styles.eventTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.eventTime}>{item.time}</Text>
                  </View>
                  <View style={[
                    styles.eventTypeBadge, 
                    { 
                      backgroundColor: 
                        item.type === 'task' ? '#FFE8CC' : 
                        item.type === 'event' ? '#E8E0D8' : 
                        '#DDEEFF'
                    }
                  ]}>
                    <Ionicons
                      name={
                        item.type === 'task' ? 'clipboard-outline' : 
                        item.type === 'event' ? 'calendar-outline' :
                        'time-outline'
                      }
                      size={14}
                      color={
                        item.type === 'task' ? '#FF9500' : 
                        item.type === 'event' ? '#A2845E' :
                        '#2F80ED'
                      }
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

      {/* ── MODAL DE DETALLE DE TAREAS ──────────────────────── */}
      <TaskDetailModal 
        visible={taskModalVisible}
        onClose={() => {
          setTaskModalVisible(false);
          setSelectedTask(null);
        }}
        task={selectedTask}
        t={t}
      />

      {/* ── MODAL DE DETALLE DE EVENTOS ────────────────────── */}
      <EventDetailModal
        visible={eventDetailVisible}
        onClose={() => {
          setEventDetailVisible(false);
          setSelectedEvent(null);
        }}
        event={selectedEvent}
        t={t}
      />

      {/* ── MODAL PARA AGREGAR EVENTO O TAREA ──────────────── */}
      <AddEventMenu
        visible={addMenuVisible}
        onClose={() => setAddMenuVisible(false)}
        onAddEvent={() => {
          setAddMenuVisible(false);
          setEventCreationVisible(true);
        }}
        onAddTask={() => {
          setAddMenuVisible(false);
          setTaskCreationVisible(true);
        }}
        t={t}
      />

      {/* ── MODAL DE CREACIÓN DE EVENTOS ──────────────────── */}
      <EventCreationModal
        visible={eventCreationVisible}
        onClose={() => setEventCreationVisible(false)}
        onSave={async (event) => {
          try {
            console.log('Guardando evento:', event);
            await createCalendarEvent(event);
            
            // Recargar los eventos del calendario para mostrar el nuevo evento
            try {
              const firstDay = new Date(viewYear, viewMonth, 1);
              const lastDay = new Date(viewYear, viewMonth + 1, 0);
              
              const startDay = String(firstDay.getDate()).padStart(2, '0');
              const startMonth = String(firstDay.getMonth() + 1).padStart(2, '0');
              const startYear = firstDay.getFullYear();
              const startDateStr = `${startDay}-${startMonth}-${startYear}`;
              
              const endDay = String(lastDay.getDate()).padStart(2, '0');
              const endMonth = String(lastDay.getMonth() + 1).padStart(2, '0');
              const endYear = lastDay.getFullYear();
              const endDateStr = `${endDay}-${endMonth}-${endYear}`;
              
              const updatedEvents = await getCalendarEvents(startDateStr, endDateStr);
              setCalendarEvents(updatedEvents || []);
            } catch (reloadError) {
              console.warn('Error reloading events:', reloadError);
            }
            
            alertRef.show({
              title: t('common.success'),
              message: t('calendar.eventCreatedSuccess') || 'Evento creado exitosamente',
              type: 'success',
            });
          } catch (error) {
            console.error('Error creando evento:', error);
            alertRef.show({
              title: t('common.error'),
              message: error instanceof Error ? error.message : 'Error al crear el evento',
              type: 'error',
            });
          }
        }}
        selectedDate={new Date(viewYear, viewMonth, selectedDayNum)}
        subjects={useDataStore().subjects || []}
      />

      {/* ── MODAL DE CREACIÓN DE TAREAS ──────────────────── */}
      <CreateTaskModal
        visible={taskCreationVisible}
        onClose={() => setTaskCreationVisible(false)}
        subjects={useDataStore().subjects || []}
        onTaskCreated={async () => {
          // Recargar datos después de crear la tarea
          try {
            // Recarga todas las evaluaciones/tareas
            await loadAllData(true);
            
            // También recarga los eventos del calendario del mes
            try {
              const firstDay = new Date(viewYear, viewMonth, 1);
              const lastDay = new Date(viewYear, viewMonth + 1, 0);
              
              const startDay = String(firstDay.getDate()).padStart(2, '0');
              const startMonth = String(firstDay.getMonth() + 1).padStart(2, '0');
              const startYear = firstDay.getFullYear();
              const startDateStr = `${startDay}-${startMonth}-${startYear}`;
              
              const endDay = String(lastDay.getDate()).padStart(2, '0');
              const endMonth = String(lastDay.getMonth() + 1).padStart(2, '0');
              const endYear = lastDay.getFullYear();
              const endDateStr = `${endDay}-${endMonth}-${endYear}`;
              
              const updatedEvents = await getCalendarEvents(startDateStr, endDateStr);
              setCalendarEvents(updatedEvents || []);
            } catch (error) {
              console.warn('Error reloading calendar events after task creation:', error);
            }
          } catch (error) {
            console.warn('Error reloading data after task creation:', error);
          }
        }}
      />
    </SafeAreaView>
  );
}

// ── MODAL PARA SELECCIONAR ENTRE EVENTO O TAREA ──────────────
interface AddEventMenuProps {
  visible: boolean;
  onClose: () => void;
  onAddEvent: () => void;
  onAddTask: () => void;
  t: any;
}

const AddEventMenu: React.FC<AddEventMenuProps> = ({ visible, onClose, onAddEvent, onAddTask, t }) => {
  const slideAnim = useRef(new Animated.Value(600)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 600,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Overlay */}
      <TouchableOpacity
        style={menuStyles.overlay}
        activeOpacity={1}
        onPress={onClose}
      />

      {/* Modal Flotante */}
      <Animated.View
        style={[
          menuStyles.container,
          {
            transform: [{ translateY: slideAnim }],
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        <View style={menuStyles.content}>
          {/* Header */}
          <View style={menuStyles.header}>
            <Text style={menuStyles.title}>{t('calendar.addWhat')}</Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={24} color={theme.colors.text.primary} />
            </TouchableOpacity>
          </View>

          {/* Menu Items */}
          <TouchableOpacity style={menuStyles.menuItem} onPress={onAddEvent}>
            <View style={menuStyles.menuItemIcon}>
              <Ionicons name="calendar-outline" size={24} color={theme.colors.primary} />
            </View>
            <View style={menuStyles.menuItemInfo}>
              <Text style={menuStyles.menuItemTitle}>{t('calendar.newEvent')}</Text>
              <Text style={menuStyles.menuItemSubtitle}>{t('calendar.createPersonalEvent')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.text.secondary} />
          </TouchableOpacity>

          <TouchableOpacity style={menuStyles.menuItem} onPress={onAddTask}>
            <View style={menuStyles.menuItemIcon}>
              <Ionicons name="checkbox-outline" size={24} color="#34C759" />
            </View>
            <View style={menuStyles.menuItemInfo}>
              <Text style={menuStyles.menuItemTitle}>{t('calendar.newTask')}</Text>
              <Text style={menuStyles.menuItemSubtitle}>{t('calendar.createTaskEvaluation')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.text.secondary} />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
};

// ── MODAL DE DETALLE DE TAREAS ──────────────────────────────
interface TaskDetailModalProps {
  visible: boolean;
  onClose: () => void;
  task: any;
  t: any;
}

const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ visible, onClose, task, t }) => {
  const slideAnim = useRef(new Animated.Value(600)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 600,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  if (!task) return null;

  const allTasks = task.allAssessments || [task.assessmentData];

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Overlay */}
      <TouchableOpacity
        style={modalStyles.overlay}
        activeOpacity={1}
        onPress={onClose}
      />

      {/* Modal Flotante */}
      <Animated.View
        style={[
          modalStyles.container,
          {
            transform: [{ translateY: slideAnim }],
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        <View style={modalStyles.content}>
          <ScrollView 
            scrollEnabled={true}
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={modalStyles.header}>
              <Text style={modalStyles.title}>
                {allTasks.length === 1 ? t('calendar.taskDetail') : `${allTasks.length} ${t('calendar.tasks')}`}
              </Text>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={24} color={theme.colors.text.primary} />
              </TouchableOpacity>
            </View>

            {/* Lista de tareas */}
            <View style={modalStyles.tasksList}>
              {allTasks.map((assessment: any, index: number) => (
                <View key={assessment.id || index} style={[
                  modalStyles.taskItem,
                  index < allTasks.length - 1 && modalStyles.taskItemBorder
                ]}>
                  {/* Nombre de la tarea */}
                  <View style={modalStyles.taskHeader}>
                    <View style={[
                      modalStyles.taskColorDot, 
                      { backgroundColor: assessment.subject_color || theme.colors.primary }
                    ]} />
                    <Text style={modalStyles.taskName} numberOfLines={2}>{assessment.name}</Text>
                  </View>

                  {/* Detalles */}
                  <View style={modalStyles.taskDetails}>
                    {assessment.type && (
                      <View style={modalStyles.detailRow}>
                        <Ionicons name="bookmark-outline" size={16} color={theme.colors.text.secondary} />
                        <Text style={modalStyles.detailText}>{assessment.type}</Text>
                      </View>
                    )}
                    {assessment.date && (
                      <View style={modalStyles.detailRow}>
                        <Ionicons name="calendar-outline" size={16} color={theme.colors.text.secondary} />
                        <Text style={modalStyles.detailText}>{assessment.date}</Text>
                      </View>
                    )}
                    {assessment.time && (
                      <View style={modalStyles.detailRow}>
                        <Ionicons name="time-outline" size={16} color={theme.colors.text.secondary} />
                        <Text style={modalStyles.detailText}>{assessment.time}</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>

          {/* Footer Button */}
          <TouchableOpacity 
            style={modalStyles.closeButton}
            onPress={onClose}
          >
            <Text style={modalStyles.closeButtonText}>{t('common.close')}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
};

// ── MODAL DE DETALLE DE EVENTOS ────────────────────────────────────
interface EventDetailModalProps {
  visible: boolean;
  onClose: () => void;
  event: any;
  t: any;
}

const EventDetailModal: React.FC<EventDetailModalProps> = ({ visible, onClose, event, t }) => {
  const slideAnim = useRef(new Animated.Value(600)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 600,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  if (!event) return null;

  const eventTypeLabel = (type: string) => {
    switch (type) {
      case 'exam': return t('calendar.exam') || 'Examen';
      case 'task': return t('calendar.task') || 'Tarea';
      case 'class': return t('calendar.class') || 'Clase';
      case 'other': return t('calendar.other') || 'Otro';
      default: return type;
    }
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={modalStyles.overlay}
        activeOpacity={1}
        onPress={onClose}
      />

      <Animated.View
        style={[
          modalStyles.container,
          {
            transform: [{ translateY: slideAnim }],
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        <View style={modalStyles.content}>
          <ScrollView
            scrollEnabled={true}
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={modalStyles.header}>
              <Text style={modalStyles.title}>{t('calendar.eventDetail') || 'Detalle del evento'}</Text>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={24} color={theme.colors.text.primary} />
              </TouchableOpacity>
            </View>

            {/* Cuerpo del evento */}
            <View style={modalStyles.eventBody}>
              {/* Título */}
              <View style={[modalStyles.eventTitleRow, { borderLeftColor: event.color || '#A2845E' }]}>
                <Text style={modalStyles.eventTitle}>{event.title}</Text>
              </View>

              {/* Tipo */}
              <View style={modalStyles.detailRow}>
                <Ionicons name="bookmark-outline" size={16} color={theme.colors.text.secondary} />
                <Text style={modalStyles.detailText}>{eventTypeLabel(event.eventType)}</Text>
              </View>

              {/* Hora / Todo el día */}
              <View style={modalStyles.detailRow}>
                <Ionicons name="time-outline" size={16} color={theme.colors.text.secondary} />
                <Text style={modalStyles.detailText}>{event.time || t('calendar.allDay')}</Text>
              </View>

              {/* Descripción */}
              {event.description ? (
                <View style={modalStyles.detailRow}>
                  <Ionicons name="document-text-outline" size={16} color={theme.colors.text.secondary} />
                  <Text style={modalStyles.detailText}>{event.description}</Text>
                </View>
              ) : null}
            </View>
          </ScrollView>

          <TouchableOpacity
            style={modalStyles.closeButton}
            onPress={onClose}
          >
            <Text style={modalStyles.closeButtonText}>{t('common.close')}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
};

// Estilos del modal
const { height: screenHeight } = Dimensions.get('window');
const modalStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: screenHeight * 0.75,
    backgroundColor: 'transparent',
  },
  content: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  tasksList: {
    gap: 0,
  },
  taskItem: {
    paddingVertical: 12,
    gap: 10,
  },
  taskItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  taskColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  taskName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text.primary,
    flex: 1,
  },
  taskDetails: {
    gap: 8,
    marginLeft: 24,
  },
  eventBody: {
    gap: 16,
    paddingVertical: 8,
  },
  eventTitleRow: {
    borderLeftWidth: 4,
    paddingLeft: 12,
    marginBottom: 4,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    flex: 1,
  },
  closeButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

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
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  headerRightContainer: {
    gap: 8,
    flex: 1,
    justifyContent: 'flex-end',
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

// Estilos del AddEventMenu
const menuStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: screenHeight * 0.5,
    backgroundColor: 'transparent',
  },
  content: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 12,
    borderRadius: 14,
    backgroundColor: theme.colors.inputBackground,
    marginBottom: 8,
  },
  menuItemIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemInfo: {
    flex: 1,
    gap: 2,
  },
  menuItemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  menuItemSubtitle: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    fontWeight: '400',
  },
});