import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { calendarGridStyles } from '../../styles/CalendarGrid.styles';
import { ActivitySummary } from '../../types/calendar';

interface CalendarGridProps {
  monthLabel: string;
  year: number;
  month: number;
  daysInMonth: number;
  startOffset: number;
  selectedDayNum: number;
  weekLabels: string[];
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectDay: (day: number) => void;
  getActivitySummary: (day: number) => ActivitySummary;
  isToday: (day: number) => boolean;
}

export const CalendarGrid: React.FC<CalendarGridProps> = ({
  monthLabel,
  daysInMonth,
  startOffset,
  selectedDayNum,
  weekLabels,
  onPrevMonth,
  onNextMonth,
  onSelectDay,
  getActivitySummary,
  isToday,
}) => {
  return (
    <View style={calendarGridStyles.calendarCard}>
      <View style={calendarGridStyles.monthNav}>
        <TouchableOpacity style={calendarGridStyles.navBtn} onPress={onPrevMonth} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={20} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <Text style={calendarGridStyles.monthLabel}>{monthLabel}</Text>
        <TouchableOpacity style={calendarGridStyles.navBtn} onPress={onNextMonth} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.text.primary} />
        </TouchableOpacity>
      </View>

      <View style={calendarGridStyles.weekLabels}>
        {weekLabels.map((d, i) => (
          <Text key={i} style={calendarGridStyles.weekLabelText}>{d}</Text>
        ))}
      </View>

      <View style={calendarGridStyles.grid}>
        {Array.from({ length: startOffset }).map((_, i) => (
          <View key={`offset-${i}`} style={calendarGridStyles.cell} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const selected = day === selectedDayNum;
          const today = isToday(day);
          const { hasClasses, hasTasks, hasEvents } = getActivitySummary(day);

          return (
            <TouchableOpacity
              key={day}
              onPress={() => onSelectDay(day)}
              style={[
                calendarGridStyles.cell,
                selected && calendarGridStyles.selectedCell,
                !selected && today && calendarGridStyles.todayCell,
              ]}
            >
              <Text style={[
                calendarGridStyles.cellText,
                selected && calendarGridStyles.selectedCellText,
                !selected && today && calendarGridStyles.todayCellText,
              ]}>
                {day}
              </Text>
              {(!selected && (hasClasses || hasTasks || hasEvents)) && (
                <View style={calendarGridStyles.dotsContainer}>
                  {hasClasses && <View style={[calendarGridStyles.activityDot, { backgroundColor: '#2F80ED' }]} />}
                  {hasTasks && <View style={[calendarGridStyles.activityDot, { backgroundColor: '#FF9500' }]} />}
                  {hasEvents && <View style={[calendarGridStyles.activityDot, { backgroundColor: '#A2845E' }]} />}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};
