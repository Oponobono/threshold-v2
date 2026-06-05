import React, { useState, useMemo } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { globalStyles } from '../../src/styles/globalStyles';
import { useDataStore } from '../../src/store/useDataStore';
import { useCalendar } from '../../src/hooks/useCalendar';
import { EventCreationModal } from '../../src/components/modals/EventCreationModal';
import { CreateTaskModal } from '../../src/components/dashboard/CreateTaskModal';
import { CalendarHeader } from '../../src/components/calendar/CalendarHeader';
import { CalendarGrid } from '../../src/components/calendar/CalendarGrid';
import { AgendaList } from '../../src/components/calendar/AgendaList';
import { AddEventMenu } from '../../src/components/calendar/AddEventMenu';
import { TaskDetailModal } from '../../src/components/calendar/TaskDetailModal';
import { EventDetailModal } from '../../src/components/calendar/EventDetailModal';
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, getCalendarEvents } from '../../src/services/api/calendar';
import { deleteAssessment } from '../../src/services/api';
import { alertRef } from '../../src/components/ui/CustomAlert';
import { calendarScreenStyles } from '../../src/styles/CalendarScreen.styles';

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

  const selectedDayLabel = new Date(calendar.viewYear, calendar.viewMonth, calendar.selectedDayNum)
    .toLocaleString(lang === 'en' ? 'en-US' : 'es-ES', { weekday: 'long', day: 'numeric', month: 'short' });

  const subjects = useDataStore().subjects || [];

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

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={globalStyles.safeArea}>
      <CalendarHeader
        isViewingCurrentMonth={calendar.isViewingCurrentMonth}
        onPressToday={calendar.goToToday}
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
          onSelectDay={calendar.setSelectedDayNum}
          getActivitySummary={calendar.getActivitySummary}
          isToday={calendar.isToday}
        />

        <AgendaList
          selectedDayLabel={selectedDayLabel}
          events={calendar.filteredEvents}
          onPressTask={(item) => {
            setSelectedTask(item);
            setTaskModalVisible(true);
          }}
          onPressEvent={(item) => {
            setSelectedEvent(item);
            setEventDetailVisible(true);
          }}
          onEditEvent={handleEditEvent}
          onDeleteEvent={handleDeleteEvent}
          onDeleteTask={handleDeleteTask}
          t={t}
        />
      </ScrollView>

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
    </SafeAreaView>
  );
}
