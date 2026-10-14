import React, { useState, useMemo, useCallback } from 'react';
import { ScrollView, View, LayoutAnimation, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { globalStyles } from '../../src/styles/globalStyles';
import { theme } from '../../src/styles/theme';
import { useDataStore } from '../../src/store/useDataStore';
import { useCalendar } from '../../src/hooks/useCalendar';
import { EventCreationModal } from '../../src/components/modals/EventCreationModal';
import { CreateTaskModal } from '../../src/components/dashboard/CreateTaskModal';
import { CalendarHeader } from '../../src/components/calendar/CalendarHeader';
import { CalendarGrid } from '../../src/components/calendar/CalendarGrid';
import { AgendaList } from '../../src/components/calendar/AgendaList';
import { CalendarFilterBar } from '../../src/components/calendar/CalendarFilterBar';
import { AddEventMenu } from '../../src/components/calendar/AddEventMenu';
import { TaskDetailModal } from '../../src/components/calendar/TaskDetailModal';
import { EventDetailModal } from '../../src/components/calendar/EventDetailModal';
import { EmptyAgendaState } from '../../src/components/calendar/EmptyAgendaState';
import { OptionSelectorModal, SelectorOption } from '../../src/components/ui/OptionSelectorModal';
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from '../../src/services/api/calendar';
import { deleteAssessment } from '../../src/services/api';
import { alertRef } from '../../src/components/ui/CustomAlert';
import { calendarScreenStyles } from '../../src/styles/CalendarScreen.styles';

export default function CalendarScreen() {
  const { t, i18n } = useTranslation();


  const weekLabels = Array.isArray(t('common.daysShort', { returnObjects: true }))
    ? (t('common.daysShort', { returnObjects: true }) as string[])
    : ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

  const lang = i18n.language === 'en' ? 'en' : 'es-ES';

  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [courseModalVisible, setCourseModalVisible] = useState(false);
  const [subjectModalVisible, setSubjectModalVisible] = useState(false);

  const scopeFilter = useMemo(() => ({
    courseId: selectedCourseId,
    subjectId: selectedSubjectId,
  }), [selectedCourseId, selectedSubjectId]);

  const calendar = useCalendar(t, lang, scopeFilter);

  const [taskModalVisible, setTaskModalVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);

  const [eventDetailVisible, setEventDetailVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  const [addMenuVisible, setAddMenuVisible] = useState(false);
  const [eventCreationVisible, setEventCreationVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [taskCreationVisible, setTaskCreationVisible] = useState(false);

  const selectedDayLabel = (() => {
    const d = new Date(calendar.viewYear, calendar.viewMonth, calendar.selectedDayNum);
    const locale = lang === 'en' ? 'en-US' : 'es-ES';
    const weekdayRaw = d.toLocaleString(locale, { weekday: 'long' });
    const weekday = weekdayRaw.charAt(0).toUpperCase() + weekdayRaw.slice(1);
    const monthRaw = d.toLocaleString(locale, { month: 'long' });
    const month = monthRaw.charAt(0).toUpperCase() + monthRaw.slice(1);
    const day = calendar.selectedDayNum;
    const year = calendar.viewYear;

    if (lang === 'en') {
      return `${weekday}, ${month} ${day} - ${year}`;
    }
    return `${weekday}, ${day} de ${month} - ${year}`;
  })();

  const [isCalendarExpanded, setIsCalendarExpanded] = useState(true);

  // Selectores atómicos para evitar re-renders por mutaciones ajenas
  const subjects = useDataStore(s => s.subjects);
  const courses = useDataStore(s => s.courses);

  // Courses que tienen al menos un evento en el día seleccionado (usando eventos sin filtrar para preservar todas las opciones en el modal)
  const activeCourseIds = useMemo(() => {
    const ids = new Set<string>();
    for (const e of calendar.unscopedDayEvents) {
      const subj = subjects.find((s: any) => s.id === e.subjectId);
      if (subj?.course_id) ids.add(subj.course_id);
    }
    return ids;
  }, [calendar.unscopedDayEvents, subjects]);

  const courseOptions: SelectorOption[] = useMemo(() =>
    (courses || []).filter((c: any) => activeCourseIds.has(c.id)).map((c: any) => ({ id: c.id, name: c.name })),
    [courses, activeCourseIds]
  );

  // Materias filtradas por curso seleccionado, con eventos en el día
  const activeSubjectIds = useMemo(() => {
    const ids = new Set<string>();
    for (const e of calendar.unscopedDayEvents) {
      if (e.subjectId) ids.add(e.subjectId);
    }
    return ids;
  }, [calendar.unscopedDayEvents]);

  const subjectsForCourse = useMemo(() => {
    return (subjects || []).filter((s: any) => {
      if (!activeSubjectIds.has(s.id)) return false;
      if (selectedCourseId) return s.course_id === selectedCourseId;
      return true;
    });
  }, [subjects, activeSubjectIds, selectedCourseId]);

  const subjectOptions: SelectorOption[] = useMemo(() =>
    subjectsForCourse.map((s: any) => ({
      id: s.id,
      name: s.name,
      icon: s.icon || 'book-outline',
      color: s.color,
      subtitle: s.professor,
    })),
    [subjectsForCourse]
  );

  const selectedCourseName = (courses || []).find((c: any) => c.id === selectedCourseId)?.name || null;
  const selectedSubjectName = (subjects || []).find((s: any) => s.id === selectedSubjectId)?.name || null;

  const showCourseFilter = courseOptions.length > 0;
  const showSubjectFilter = subjectOptions.length > 0;

  const scopedEvents = calendar.filteredEvents;

  useFocusEffect(
    useCallback(() => {
      calendar.reloadEventsForMonth();
    }, [calendar.reloadEventsForMonth])
  );

  const handleEditEvent = (item: any) => {
    const eventIdStr = item.id ? String(item.id).replace('event-', '') : null;
    if (!eventIdStr) return;
    const found = calendar.calendarEvents?.find((e: any) => String(e.id) === eventIdStr);
    if (found) {
      setEditingEvent(found);
      setEventCreationVisible(true);
    }
  };

  const handleDeleteEvent = (item: any) => {
    const eventIdStr = item.id ? String(item.id).replace('event-', '') : null;
    if (!eventIdStr) return;
    alertRef.show({
      title: t('calendar.delete'),
      message: t('calendar.deleteConfirm'),
      type: 'confirm',
      buttons: [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('calendar.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCalendarEvent(eventIdStr);
              await calendar.reloadEventsForMonth();
              alertRef.show({
                title: t('common.success'),
                message: t('calendar.eventDeleted'),
                type: 'success',
              });
            } catch (error) {
              console.error('Error deleting event:', error);
              alertRef.show({
                title: t('common.error'),
                message: error instanceof Error ? error.message : 'Error al eliminar',
                type: 'error',
              });
            }
          },
        },
      ],
    });
  };

  const handleDeleteTask = (item: any) => {
    const assessmentIds = item.allAssessments?.map((a: any) => a.id) || [item.assessmentId];
    const count = assessmentIds.filter(Boolean).length;
    if (count === 0) return;
    alertRef.show({
      title: t('calendar.delete'),
      message: count === 1
        ? t('calendar.deleteTaskConfirm')
        : t('calendar.deleteTasksConfirm', { count }),
      type: 'confirm',
      buttons: [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('calendar.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await Promise.all(assessmentIds.map((id: any) => deleteAssessment(String(id))));
              await calendar.loadAllData(true);
              await calendar.reloadEventsForMonth();
              alertRef.show({
                title: t('common.success'),
                message: t('calendar.taskDeleted'),
                type: 'success',
              });
            } catch (error) {
              console.error('Error deleting task:', error);
              alertRef.show({
                title: t('common.error'),
                message: error instanceof Error ? error.message : 'Error al eliminar',
                type: 'error',
              });
            }
          },
        },
      ],
    });
  };

  const toggleCalendar = useCallback(() => {
    setIsCalendarExpanded(prev => !prev);
  }, []);

  const handleSelectDay = useCallback((day: number) => {
    calendar.setSelectedDayNum(day);
  }, [calendar.setSelectedDayNum]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={globalStyles.safeArea}>
      <CalendarHeader
        isViewingCurrentMonth={calendar.isViewingCurrentMonth}
        onPressToday={() => {
          calendar.goToToday();
          setIsCalendarExpanded(true);
        }}
        onPressAdd={() => setAddMenuVisible(true)}
        t={t}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={calendarScreenStyles.scrollContent}>
        <CalendarGrid
          monthLabel={calendar.monthLabel}
          year={calendar.viewYear}
          month={calendar.viewMonth}
          daysInMonth={calendar.daysInMonth}
          startOffset={calendar.startOffset}
          selectedDayNum={calendar.selectedDayNum}
          weekLabels={weekLabels}
          onPrevMonth={calendar.goToPrevMonth}
          onNextMonth={calendar.goToNextMonth}
          onSelectDay={handleSelectDay}
          getActivitySummary={calendar.getActivitySummary}
          isToday={calendar.isToday}
          isExpanded={isCalendarExpanded}
          onToggle={toggleCalendar}
          collapsedLabel={selectedDayLabel}
        />

        {showCourseFilter && (
          <CalendarFilterBar
            selectedCourseName={selectedCourseName}
            selectedSubjectName={selectedSubjectName}
            isActiveCourse={!!selectedCourseId}
            isActiveSubject={!!selectedSubjectId}
            onPressCourse={() => setCourseModalVisible(true)}
            onPressSubject={() => setSubjectModalVisible(true)}
            showSubjectFilter={showSubjectFilter}
          />
        )}

        {!calendar.isReady ? (
          <View style={{ padding: 48, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
          </View>
        ) : scopedEvents.length === 0 ? (
          <EmptyAgendaState
            scope={{ kind: selectedSubjectId ? 'subject' : selectedCourseId ? 'subject' : 'all', subjectId: selectedSubjectId || selectedCourseId || '' } as any}
            onClear={() => { setSelectedCourseId(null); setSelectedSubjectId(null); }}
            activeSubjects={[]}
          />
        ) : (
          <AgendaList
            events={scopedEvents}
            selectedDate={new Date(calendar.viewYear, calendar.viewMonth, calendar.selectedDayNum)}
            scope={{ kind: selectedSubjectId ? 'subject' : 'all', subjectId: selectedSubjectId || '' } as any}
            onPressTask={(item) => {
              setSelectedTask(item);
              setTaskModalVisible(true);
            }}
            onPressEvent={(item) => {
              setSelectedEvent(item);
              setEventDetailVisible(true);
            }}
            onSubjectPress={(id) => setSelectedSubjectId(id)}
            t={t}
          />
        )}
      </ScrollView>

      {calendar.isReady && (
        <>
          <TaskDetailModal
            visible={taskModalVisible}
            onClose={() => {
              setTaskModalVisible(false);
              setSelectedTask(null);
            }}
            task={selectedTask}
            t={t}
          />

          <EventDetailModal
            visible={eventDetailVisible}
            onClose={() => {
              setEventDetailVisible(false);
              setSelectedEvent(null);
            }}
            event={selectedEvent}
            t={t}
          />
        </>
      )}

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

      <OptionSelectorModal
        visible={courseModalVisible}
        title="Seleccionar curso"
        options={courseOptions}
        selectedId={selectedCourseId}
        onSelect={(id) => {
          setSelectedCourseId(id);
          setSelectedSubjectId(null);
        }}
        onClose={() => setCourseModalVisible(false)}
        clearLabel="Quitar filtro de curso"
      />

      <OptionSelectorModal
        visible={subjectModalVisible}
        title="Seleccionar materia"
        options={subjectOptions}
        selectedId={selectedSubjectId}
        onSelect={setSelectedSubjectId}
        onClose={() => setSubjectModalVisible(false)}
        clearLabel="Quitar filtro de materia"
      />

      {calendar.isReady && (
        <>
          <EventCreationModal
            visible={eventCreationVisible}
            onClose={() => {
              setEventCreationVisible(false);
              setEditingEvent(null);
            }}
            onSave={async (event, eventId) => {
              try {
                if (eventId) {
                  await updateCalendarEvent(eventId, event);
                } else {
                  await createCalendarEvent(event);
                }
                await calendar.reloadEventsForMonth();
                alertRef.show({
                  title: t('common.success'),
                  message: eventId
                    ? t('calendar.eventUpdatedSuccess')
                    : t('calendar.eventCreatedSuccess'),
                  type: 'success',
                });
              } catch (error) {
                console.error('Error guardando evento:', error);
                alertRef.show({
                  title: t('common.error'),
                  message: error instanceof Error ? error.message : 'Error al guardar el evento',
                  type: 'error',
                });
              }
            }}
            selectedDate={new Date(calendar.viewYear, calendar.viewMonth, calendar.selectedDayNum)}
            subjects={subjects}
            editingEvent={editingEvent}
          />

          <CreateTaskModal
            visible={taskCreationVisible}
            onClose={() => setTaskCreationVisible(false)}
            subjects={subjects}
            onTaskCreated={async () => {
              try {
                await calendar.loadAllData(true);
                await calendar.reloadEventsForMonth();
              } catch (error) {
                console.warn('Error reloading data after task creation:', error);
              }
            }}
          />
        </>
      )}
    </SafeAreaView>
  );
}
