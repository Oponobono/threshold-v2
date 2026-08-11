import React, { useState } from 'react';
import { View, LayoutAnimation } from 'react-native';
import { AgendaItem, CalendarScope } from '../../types/calendar';
import { AgendaSectionHeader } from './AgendaSectionHeader';
import { AgendaRow } from './AgendaRow';
import { useAgendaSections } from '../../hooks/useAgendaSections';

interface AgendaListProps {
  events: AgendaItem[];
  selectedDate: Date;
  scope: CalendarScope;
  t: any;
  onPressTask: (item: AgendaItem) => void;
  onPressEvent: (item: AgendaItem) => void;
  onSubjectPress?: (subjectId: string) => void;
}

export const AgendaList: React.FC<AgendaListProps> = ({
  events,
  selectedDate,
  scope,
  t,
  onPressTask,
  onPressEvent,
  onSubjectPress
}) => {
  const { allDayEvents, upcomingEvents, pastEvents, pastDefaultExpanded } = useAgendaSections(events, selectedDate);
  const [pastExpanded, setPastExpanded] = useState(pastDefaultExpanded);

  // Update pastExpanded when default changes (e.g. date changes)
  React.useEffect(() => {
    setPastExpanded(pastDefaultExpanded);
  }, [pastDefaultExpanded, selectedDate]);

  const togglePast = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setPastExpanded(!pastExpanded);
  };

  const handlePress = (item: AgendaItem) => {
    if (item.kind === 'assessment') {
      onPressTask(item);
    } else if (item.kind === 'calendar_event') {
      onPressEvent(item);
    } else if (item.subjectId && onSubjectPress) {
      onSubjectPress(item.subjectId);
    }
  };

  return (
    <View style={{ flex: 1, paddingBottom: 40, paddingTop: 8 }}>
      {allDayEvents.length > 0 && (
        <View>
          <AgendaSectionHeader title={t('calendar.allDay', 'TODO EL DÍA')} />
          {allDayEvents.map((item, index) => (
            <AgendaRow 
              key={item.id} 
              item={item} 
              scope={scope} 
              isLast={index === allDayEvents.length - 1 && upcomingEvents.length === 0 && pastEvents.length === 0} 
              onPress={handlePress} 
              t={t} 
            />
          ))}
        </View>
      )}

      {upcomingEvents.length > 0 && (
        <View>
          <AgendaSectionHeader title={t('calendar.upcoming', 'PRÓXIMOS')} />
          {upcomingEvents.map((item, index) => (
            <AgendaRow 
              key={item.id} 
              item={item} 
              scope={scope} 
              isLast={index === upcomingEvents.length - 1 && pastEvents.length === 0} 
              onPress={handlePress} 
              t={t} 
            />
          ))}
        </View>
      )}

      {pastEvents.length > 0 && (
        <View>
          <AgendaSectionHeader 
            title={t('calendar.past', 'PASADOS')} 
            count={pastEvents.length} 
            collapsible 
            isExpanded={pastExpanded} 
            onToggle={togglePast} 
          />
          {pastExpanded && pastEvents.map((item, index) => (
            <AgendaRow 
              key={item.id} 
              item={item} 
              scope={scope} 
              isLast={index === pastEvents.length - 1} 
              onPress={handlePress} 
              t={t} 
            />
          ))}
        </View>
      )}
    </View>
  );
};
