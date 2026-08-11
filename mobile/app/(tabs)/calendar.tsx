import React, { useState, useMemo, useCallback } from 'react';
import { ScrollView, View, LayoutAnimation, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { globalStyles } from '../../src/styles/globalStyles';
import { useDataStore } from '../../src/store/useDataStore';
import { useCalendar } from '../../src/hooks/useCalendar';
import { EventCreationModal } from '../../src/components/modals/EventCreationModal';
import { CreateTaskModal } from '../../src/components/dashboard/CreateTaskModal';
import { CalendarHeader } from '../../src/components/calendar/CalendarHeader';
import { CalendarGrid } from '../../src/components/calendar/CalendarGrid';
import { AgendaList } from '../../src/components/calendar/AgendaList';
import { SubjectRail } from '../../src/components/calendar/SubjectRail';
import { CalendarScope } from '../../src/types/calendar';
import { AddEventMenu } from '../../src/components/calendar/AddEventMenu';
import { TaskDetailModal } from '../../src/components/calendar/TaskDetailModal';
import { EventDetailModal } from '../../src/components/calendar/EventDetailModal';
import { SubjectFilterBar } from '../../src/components/calendar/SubjectFilterBar';
import { ActiveFilterBanner } from '../../src/components/calendar/ActiveFilterBanner';
import { EmptyAgendaState } from '../../src/components/calendar/EmptyAgendaState';
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, getCalendarEvents } from '../../src/services/api/calendar';
import { deleteAssessment } from '../../src/services/api';
import { alertRef } from '../../src/components/ui/CustomAlert';
import { calendarScreenStyles } from '../../src/styles/CalendarScreen.styles';
import { useActiveSubjects } from '../../src/hooks/useActiveSubjects';

export default function CalendarScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();

  const weekLabels = Array.isArray(t('common.daysShort', { returnObjects: true }))
    ? (t('common.daysShort', { returnObjects: true }) as string[])
    : ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

  const lang = i18n.language === 'en' ? 'en' : 'es-ES';

  const calendar = useCalendar(t, lang);

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
    const weekday = d.toLocaleString(locale, { weekday: 'long' });
    const month = d.toLocaleString(locale, { month: 'short' });
    const capitalMonth = month.charAt(0).toUpperCase() + month.slice(1).replace('.', '');
    const day = calendar.selectedDayNum;
    const year = calendar.viewYear;
    return `${weekday}, ${capitalMonth} ${day} - ${year}`;
  })();

  const [isCalendarExpanded, setIsCalendarExpanded] = useState(true);
  const [scope, setScope] = useState<CalendarScope>({ kind: 'all' });

  const subjects = useDataStore().subjects || [];

  const { activeSubjects, hasGeneralEvents, totalCount } = useActiveSubjects(calendar.filteredEvents, subjects);

  const scopedEvents = useMemo(() => {
    if (scope.kind === 'all') return calendar.filteredEvents;
    if (scope.kind === 'general') return calendar.filteredEvents.filter(e => !e.subjectId);
    return calendar.filteredEvents.filter(e => e.subjectId === scope.subjectId);
  }, [calendar.filteredEvents, scope]);

  // Reset scope when changing days (optional, but requested behavior based on earlier docs might differ, wait, plan says "el scope persiste al cambiar de dia"). 
  // Let's keep it persistent.

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

  const toggleCalendar = () => {
    LayoutAnimation.configureNext({
      duration: 280,
      create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    });
    setIsCalendarExpanded(!isCalendarExpanded);
  };

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
          onSelectDay={(day) => {
            LayoutAnimation.configureNext({
              duration: 280,
              create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
              update: { type: LayoutAnimation.Types.easeInEaseOut },
              delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
            });
            calendar.setSelectedDayNum(day);
            setIsCalendarExpanded(false); // Auto-collapse
          }}
          getActivitySummary={calendar.getActivitySummary}
          isToday={calendar.isToday}
          isExpanded={isCalendarExpanded}
          onToggle={toggleCalendar}
          collapsedLabel={selectedDayLabel}
        />

        <SubjectFilterBar
          scope={scope}
          onScopeChange={setScope}
          activeSubjects={activeSubjects}
          hasGeneralEvents={hasGeneralEvents}
          totalCount={totalCount}
        />

        <ActiveFilterBanner 
          scope={scope} 
          onClear={() => setScope({ kind: 'all' })} 
          activeSubjects={activeSubjects} 
        />

        {scopedEvents.length === 0 ? (
          <EmptyAgendaState 
            scope={scope} 
            onClear={() => setScope({ kind: 'all' })} 
            activeSubjects={activeSubjects} 
          />
        ) : (
          <AgendaList
            events={scopedEvents}
            selectedDate={new Date(calendar.viewYear, calendar.viewMonth, calendar.selectedDayNum)}
            scope={scope}
            onPressTask={(item) => {
              setSelectedTask(item);
              setTaskModalVisible(true);
            }}
            onPressEvent={(item) => {
              setSelectedEvent(item);
              setEventDetailVisible(true);
            }}
            onSubjectPress={(id) => setScope({ kind: 'subject', subjectId: id })}
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
