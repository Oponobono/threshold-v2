import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { globalStyles } from '../../styles/globalStyles';
import { calendarScreenStyles } from '../../styles/CalendarScreen.styles';

interface CalendarHeaderProps {
  isViewingCurrentMonth: boolean;
  onPressToday: () => void;
  onPressAdd: () => void;
  t: any;
}

export const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  isViewingCurrentMonth,
  onPressToday,
  onPressAdd,
  t,
}) => {
  return (
    <View style={calendarScreenStyles.headerContainer}>
      <View style={globalStyles.row}>
        <Ionicons name="calendar-outline" size={20} color={theme.colors.primary} style={globalStyles.mr8} />
        <Text style={calendarScreenStyles.headerTitle}>{t('dashboard.tabs.calendar')}</Text>
        <TouchableOpacity
          onPress={onPressAdd}
          style={calendarScreenStyles.addButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="add" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>
      <View style={[globalStyles.row, calendarScreenStyles.headerRightContainer]}>
        {!isViewingCurrentMonth && (
          <TouchableOpacity onPress={onPressToday} style={calendarScreenStyles.todayPill}>
            <Ionicons name="today-outline" size={14} color={theme.colors.primary} />
            <Text style={calendarScreenStyles.todayPillText}>{t('calendar.today')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};
