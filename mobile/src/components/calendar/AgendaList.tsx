import React from 'react';
import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { theme } from '../../styles/theme';
import { calendarAgendaStyles } from '../../styles/CalendarAgenda.styles';
import { calendarScreenStyles } from '../../styles/CalendarScreen.styles';
import { ScheduleItem } from '../../types/calendar';

interface AgendaListProps {
  selectedDayLabel: string;
  events: ScheduleItem[];
  onPressTask: (item: ScheduleItem) => void;
  onPressEvent: (item: ScheduleItem) => void;
  t: any;
}

export const AgendaList: React.FC<AgendaListProps> = ({
  selectedDayLabel,
  events,
  onPressTask,
  onPressEvent,
  t,
}) => {
  const router = useRouter();

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
