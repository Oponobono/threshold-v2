import React, { useRef, useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, AccessibilityInfo } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { calendarGridStyles } from '../../styles/CalendarGrid.styles';
import { ActivitySummary } from '../../types/calendar';

const GRID_APPROX_HEIGHT = 320;
const EXPAND_DURATION = 270;
const SLIDE_DURATION = 300;

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
  getActivitySummary: (yearOrDay: number, month?: number, day?: number) => ActivitySummary;
  isToday: (day: number) => boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
  collapsedLabel?: string;
}

function getMonthData(m: number, y: number) {
  const days = new Date(y, m + 1, 0).getDate();
  const firstDay = new Date(y, m, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  return { daysInMonth: days, startOffset: offset };
}

interface DayCellProps {
  day: number;
  selected: boolean;
  today: boolean;
  hasClasses: boolean;
  hasTasks: boolean;
  hasEvents: boolean;
  eventCount: number;
  onSelectDay: (day: number) => void;
  isCurrentMonth: boolean;
}

const DayCell = React.memo<DayCellProps>((
  {
  day,
  selected,
  today,
  hasClasses,
  hasTasks,
  hasEvents,
  eventCount,
  onSelectDay,
  isCurrentMonth,
}) => {
  const handlePress = useCallback(() => {
    if (isCurrentMonth) onSelectDay(day);
  }, [isCurrentMonth, onSelectDay, day]);

  const showBadge = isCurrentMonth && eventCount > 1;

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={isCurrentMonth ? 0.7 : 1}
      accessibilityRole="button"
      accessibilityLabel={`${day}${today ? ', hoy' : ''}${selected ? ', seleccionado' : ''}${hasClasses ? ', clases programadas' : ''}${hasTasks ? ', tareas pendientes' : ''}${hasEvents ? ', eventos' : ''}${eventCount > 1 ? `, ${eventCount} actividades` : ''}`}
      style={[
        calendarGridStyles.cell,
        selected && calendarGridStyles.selectedCell,
        !selected && today && calendarGridStyles.todayCell,
        !isCurrentMonth && { opacity: 0.35 },
      ]}
    >
      <View style={calendarGridStyles.dayNumberWrapper}>
        <Text style={[
          calendarGridStyles.cellText,
          selected && calendarGridStyles.selectedCellText,
          !selected && today && calendarGridStyles.todayCellText,
        ]}>
          {day}
        </Text>
        {showBadge && (
          <View style={[
            calendarGridStyles.countBadge,
            selected && calendarGridStyles.countBadgeSelected,
          ]}>
            <Text style={[
              calendarGridStyles.countBadgeText,
              selected && calendarGridStyles.countBadgeTextSelected,
            ]}>
              {eventCount > 9 ? '9+' : eventCount}
            </Text>
          </View>
        )}
      </View>
      {(!selected && (hasClasses || hasTasks || hasEvents)) && (
        <View style={calendarGridStyles.dotsContainer}>
          {hasClasses && <View style={[calendarGridStyles.activityDot, { backgroundColor: '#2F80ED' }]} />}
          {hasTasks && <View style={[calendarGridStyles.activityDot, { backgroundColor: '#FF9500' }]} />}
          {hasEvents && <View style={[calendarGridStyles.activityDot, { backgroundColor: '#A2845E' }]} />}
        </View>
      )}
    </TouchableOpacity>
  );
});
DayCell.displayName = 'DayCell';

interface MonthGridProps {
  year: number;
  month: number;
  daysInMonth: number;
  startOffset: number;
  selectedDayNum: number;
  weekLabels: string[];
  onSelectDay: (day: number) => void;
  getActivitySummary: (yearOrDay: number, month?: number, day?: number) => ActivitySummary;
  isToday: (day: number) => boolean;
}

const MonthGrid = React.memo<MonthGridProps>(({
  year,
  month,
  daysInMonth,
  startOffset,
  selectedDayNum,
  weekLabels,
  onSelectDay,
  getActivitySummary,
  isToday,
}) => {
  return (
    <View style={{ width: '100%' }}>
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
          const { hasClasses, hasTasks, hasEvents, totalCount } = getActivitySummary(year, month, day);

          return (
            <DayCell
              key={day}
              day={day}
              selected={selected}
              today={today}
              hasClasses={hasClasses}
              hasTasks={hasTasks}
              hasEvents={hasEvents}
              eventCount={totalCount}
              onSelectDay={onSelectDay}
              isCurrentMonth={true}
            />
          );
        })}
      </View>
    </View>
  );
});
MonthGrid.displayName = 'MonthGrid';

export const CalendarGrid: React.FC<CalendarGridProps> = ({
  monthLabel,
  month,
  year,
  daysInMonth,
  startOffset,
  selectedDayNum,
  weekLabels,
  onPrevMonth,
  onNextMonth,
  onSelectDay,
  getActivitySummary,
  isToday,
  isExpanded = true,
  onToggle,
  collapsedLabel,
}) => {
  const [reduceMotion, setReduceMotion] = useState(false);
  const progress = useSharedValue(isExpanded ? 1 : 0);
  const monthFade = useSharedValue(1);

  // Detección de movimiento reducido para accesibilidad
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  // Animación nativa en el hilo de UI para expandir / colapsar
  useEffect(() => {
    if (reduceMotion) {
      progress.value = isExpanded ? 1 : 0;
    } else {
      progress.value = withTiming(isExpanded ? 1 : 0, {
        duration: isExpanded ? EXPAND_DURATION : EXPAND_DURATION * 0.7,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
      });
    }
  }, [isExpanded, reduceMotion, progress]);

  // Transición sutil al cambiar de mes
  useEffect(() => {
    if (!reduceMotion) {
      monthFade.value = 0.5;
      monthFade.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.ease) });
    }
  }, [month, year, reduceMotion, monthFade]);

  const animatedGridStyle = useAnimatedStyle(() => {
    return {
      maxHeight: progress.value * GRID_APPROX_HEIGHT,
      opacity: progress.value,
      overflow: 'hidden',
    };
  });

  const animatedMonthStyle = useAnimatedStyle(() => {
    return {
      opacity: monthFade.value,
    };
  });

  return (
    <View style={calendarGridStyles.calendarCard}>
      <View style={[calendarGridStyles.monthNav, !isExpanded && { marginBottom: 0 }]}>
        <TouchableOpacity
          style={calendarGridStyles.navBtn}
          onPress={onPrevMonth}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Mes anterior"
        >
          <Ionicons name="chevron-back" size={20} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={calendarGridStyles.monthTitleBtn}
          activeOpacity={0.7}
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityLabel={`${isExpanded ? monthLabel : (collapsedLabel || monthLabel)}. ${isExpanded ? 'Toca para colapsar' : 'Toca para expandir'}`}
        >
          <Text
            style={calendarGridStyles.monthLabel}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {isExpanded ? monthLabel : (collapsedLabel || monthLabel)}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={calendarGridStyles.navBtn}
          onPress={onNextMonth}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Mes siguiente"
        >
          <Ionicons name="chevron-forward" size={20} color={theme.colors.text.primary} />
        </TouchableOpacity>
      </View>

      <Animated.View style={animatedGridStyle}>
        <Animated.View style={animatedMonthStyle}>
          <MonthGrid
            year={year}
            month={month}
            daysInMonth={daysInMonth}
            startOffset={startOffset}
            selectedDayNum={selectedDayNum}
            weekLabels={weekLabels}
            onSelectDay={onSelectDay}
            getActivitySummary={getActivitySummary}
            isToday={isToday}
          />
        </Animated.View>
      </Animated.View>
    </View>
  );
};
