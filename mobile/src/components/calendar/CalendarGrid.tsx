import React, { useRef, useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing, ScrollView } from 'react-native';
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
  getActivitySummary: (day: number) => ActivitySummary;
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

function MonthGrid({
  daysInMonth,
  startOffset,
  selectedDayNum,
  isCurrentMonth,
  weekLabels,
  onSelectDay,
  getActivitySummary,
  isToday,
  width,
}: {
  daysInMonth: number;
  startOffset: number;
  selectedDayNum: number;
  isCurrentMonth: boolean;
  weekLabels: string[];
  onSelectDay: (day: number) => void;
  getActivitySummary: (day: number) => ActivitySummary;
  isToday: (day: number) => boolean;
  width: number;
}) {
  return (
    <View style={{ width }}>
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
          const selected = isCurrentMonth && day === selectedDayNum;
          const today = isCurrentMonth && isToday(day);
          const { hasClasses, hasTasks, hasEvents } = isCurrentMonth
            ? getActivitySummary(day)
            : { hasClasses: false, hasTasks: false, hasEvents: false };

          return (
            <TouchableOpacity
              key={day}
              onPress={() => isCurrentMonth && onSelectDay(day)}
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
}

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
  const animatedHeight = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;
  const animatedOpacity = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;
  const scrollRef = useRef<ScrollView>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const isAnimating = useRef(false);

  // Pre-compute adjacent months
  const prevM = month === 0 ? 11 : month - 1;
  const prevY = month === 0 ? year - 1 : year;
  const nextM = month === 11 ? 0 : month + 1;
  const nextY = month === 11 ? year + 1 : year;

  const prevMonthData = getMonthData(prevM, prevY);
  const nextMonthData = getMonthData(nextM, nextY);

  // Expand/collapse animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(animatedHeight, {
        toValue: isExpanded ? 1 : 0,
        duration: EXPAND_DURATION,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
        useNativeDriver: false,
      }),
      Animated.timing(animatedOpacity, {
        toValue: isExpanded ? 1 : 0,
        duration: isExpanded ? EXPAND_DURATION : EXPAND_DURATION * 0.6,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
        useNativeDriver: false,
      }),
    ]).start();
  }, [isExpanded]);

  // After month changes (state update from parent), snap back to center page instantly
  useEffect(() => {
    if (containerWidth > 0) {
      scrollRef.current?.scrollTo({ x: containerWidth, animated: false });
      isAnimating.current = false;
    }
  }, [month, year, containerWidth]);

  // When layout is ready, position to center page
  const handleLayout = useCallback((width: number) => {
    if (width === containerWidth) return;
    setContainerWidth(width);
    // scrollTo happens via the useEffect above once containerWidth is set
  }, [containerWidth]);

  const handlePrevMonth = () => {
    if (isAnimating.current || containerWidth === 0) return;
    isAnimating.current = true;
    scrollRef.current?.scrollTo({ x: 0, animated: true });
    setTimeout(() => onPrevMonth(), SLIDE_DURATION);
  };

  const handleNextMonth = () => {
    if (isAnimating.current || containerWidth === 0) return;
    isAnimating.current = true;
    scrollRef.current?.scrollTo({ x: containerWidth * 2, animated: true });
    setTimeout(() => onNextMonth(), SLIDE_DURATION);
  };

  const maxHeight = animatedHeight.interpolate({
    inputRange: [0, 1],
    outputRange: [0, GRID_APPROX_HEIGHT],
  });

  return (
    <View style={calendarGridStyles.calendarCard}>
      <View style={[calendarGridStyles.monthNav, !isExpanded && { marginBottom: 0 }]}>
        <TouchableOpacity
          style={calendarGridStyles.navBtn}
          onPress={handlePrevMonth}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={20} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7} onPress={onToggle}>
          <Text style={calendarGridStyles.monthLabel}>
            {isExpanded ? monthLabel : (collapsedLabel || monthLabel)}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={calendarGridStyles.navBtn}
          onPress={handleNextMonth}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-forward" size={20} color={theme.colors.text.primary} />
        </TouchableOpacity>
      </View>

      <Animated.View style={{ maxHeight, overflow: 'hidden', opacity: animatedOpacity }}>
        <ScrollView
          ref={scrollRef}
          horizontal
          scrollEnabled={false}
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onLayout={(e) => handleLayout(e.nativeEvent.layout.width)}
          contentOffset={containerWidth > 0 ? { x: containerWidth, y: 0 } : { x: 0, y: 0 }}
        >
          {/* Previous month */}
          <MonthGrid
            {...prevMonthData}
            selectedDayNum={selectedDayNum}
            isCurrentMonth={false}
            weekLabels={weekLabels}
            onSelectDay={onSelectDay}
            getActivitySummary={getActivitySummary}
            isToday={isToday}
            width={containerWidth || 1}
          />
          {/* Current month */}
          <MonthGrid
            daysInMonth={daysInMonth}
            startOffset={startOffset}
            selectedDayNum={selectedDayNum}
            isCurrentMonth={true}
            weekLabels={weekLabels}
            onSelectDay={onSelectDay}
            getActivitySummary={getActivitySummary}
            isToday={isToday}
            width={containerWidth || 1}
          />
          {/* Next month */}
          <MonthGrid
            {...nextMonthData}
            selectedDayNum={selectedDayNum}
            isCurrentMonth={false}
            weekLabels={weekLabels}
            onSelectDay={onSelectDay}
            getActivitySummary={getActivitySummary}
            isToday={isToday}
            width={containerWidth || 1}
          />
        </ScrollView>
      </Animated.View>
    </View>
  );
};
