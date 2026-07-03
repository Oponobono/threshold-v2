import React from 'react';
import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { theme } from '../../styles/theme';
import { calendarAgendaStyles } from '../../styles/CalendarAgenda.styles';
import { calendarScreenStyles } from '../../styles/CalendarScreen.styles';
import { ScheduleItem } from '../../types/calendar';
import { alertRef } from '../ui/CustomAlert';

const LinkedDeckIndicator = ({ eventId }: { eventId: string }) => {
  const [deckCount, setDeckCount] = React.useState<number>(0);

  React.useEffect(() => {
    if (!eventId) return;
    let isMounted = true;
    import('../../services/database').then(m => m.flashcardDeckRepository.getByLinkedEvent(eventId))
      .then(sqliteDecks => {
        if (!isMounted) return;
        const mapped = (sqliteDecks || []).map((d: any) => ({ id: String(d.id) }));
        setDeckCount(mapped.length);
      }).catch(() => {});
    return () => { isMounted = false; };
  }, [eventId]);

  if (deckCount === 0) return null;

  return (
    <View style={{ marginRight: 8, paddingHorizontal: 6, paddingVertical: 4, backgroundColor: theme.colors.primary + '15', borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Ionicons name="layers-outline" size={14} color={theme.colors.primary} />
      <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.primary }}>{deckCount}</Text>
    </View>
  );
};

interface AgendaListProps {
  selectedDayLabel: string;
  events: ScheduleItem[];
  onPressTask: (item: ScheduleItem) => void;
  onPressEvent: (item: ScheduleItem) => void;
  onEditEvent?: (item: ScheduleItem) => void;
  onDeleteEvent?: (item: ScheduleItem) => void;
  onDeleteTask?: (item: ScheduleItem) => void;
  t: any;
}

export const AgendaList: React.FC<AgendaListProps> = ({
  selectedDayLabel,
  events,
  onPressTask,
  onPressEvent,
  onEditEvent,
  onDeleteEvent,
  onDeleteTask,
  t,
}) => {
  const router = useRouter();

  const showActions = (item: ScheduleItem) => {
    if (item.type === 'event') {
      alertRef.show({
        title: item.title,
        type: 'confirm',
        buttons: [
          { text: t('calendar.edit'), style: 'default', onPress: () => onEditEvent?.(item) },
          { text: t('calendar.delete'), style: 'destructive', onPress: () => onDeleteEvent?.(item) },
          { text: t('common.cancel'), style: 'cancel' },
        ],
      });
    } else if (item.type === 'task') {
      alertRef.show({
        title: item.title,
        type: 'confirm',
        buttons: [
          { text: t('calendar.delete'), style: 'destructive', onPress: () => onDeleteTask?.(item) },
          { text: t('common.cancel'), style: 'cancel' },
        ],
      });
    }
  };

  return (
    <>
      <View style={calendarScreenStyles.agendaHeader}>
        <Text style={calendarScreenStyles.agendaTitle}>{selectedDayLabel}</Text>
        <View style={calendarScreenStyles.agendaBadge}>
          <Text style={calendarScreenStyles.agendaBadgeText}>{events.length}</Text>
        </View>
      </View>

      <View style={calendarAgendaStyles.eventsColumn}>
        {events.length > 0 ? (
          <FlatList
            data={events}
            keyExtractor={(item, index) => item.id ? item.id.toString() : index.toString()}
            scrollEnabled={false}
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            initialNumToRender={5}
            windowSize={5}
            contentContainerStyle={{ gap: 10 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={calendarAgendaStyles.eventItem}
                activeOpacity={0.7}
                onPress={() => {
                  if (item.type === 'task') {
                    onPressTask(item);
                  } else if (item.type === 'event') {
                    onPressEvent(item);
                  } else if (item.subject_id) {
                    router.push(`/subjects/${item.subject_id}`);
                  }
                }}
              >
                <View style={[calendarAgendaStyles.colorBar, { backgroundColor: item.color || theme.colors.primary }]} />
                <View style={calendarAgendaStyles.eventTextContainer}>
                  <Text style={calendarAgendaStyles.eventTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={calendarAgendaStyles.eventTime}>{item.time}</Text>
                </View>
                <View style={calendarAgendaStyles.eventActions}>
                  <View style={[
                    calendarAgendaStyles.eventTypeBadge,
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
                  {(item.type === 'event' || item.type === 'task') && (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      {item.linked_deck_id && (
                        <LinkedDeckIndicator eventId={item.id.replace('event-', '')} />
                      )}
                      <TouchableOpacity
                        style={calendarAgendaStyles.menuButton}
                        onPress={() => showActions(item)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="ellipsis-vertical" size={16} color={theme.colors.text.secondary} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            )}
          />
        ) : (
          <View style={calendarAgendaStyles.emptyContainer}>
            <Ionicons name="cafe-outline" size={38} color={theme.colors.border} />
            <Text style={calendarAgendaStyles.emptyText}>{t('calendar.emptyEvents')}</Text>
          </View>
        )}
      </View>
    </>
  );
};
