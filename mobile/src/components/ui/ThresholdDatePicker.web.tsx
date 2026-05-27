import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, FlatList, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { thresholdDatePickerStyles as styles } from '../../styles/ThresholdDatePicker.styles';
import { useTranslation } from 'react-i18next';

interface Props {
  value: Date;
  onChange: (event: any, date?: Date) => void;
  mode?: 'date' | 'time';
}

/**
 * ThresholdDatePicker.web.tsx
 *
 * Implementación web-compatible del selector de fechas de Threshold.
 * Al estar en la plataforma web, los pickers nativos de iOS/Android no están disponibles,
 * por lo que este componente construye desde cero un calendario modal en React Native.
 * Soporta dos vistas: `calendar` (cuadrícula de días del mes) y `year` (lista de años).
 * El archivo es detectado automáticamente por Metro bundler por su extensión `.web.tsx`
 * en lugar del archivo base `ThresholdDatePicker.tsx`.
 *
 * @param value - La fecha actualmente seleccionada.
 * @param onChange - Callback compatible con la API de `@react-native-community/datetimepicker`.
 * @param mode - (No usado en web, mantiene la misma firma de interface que la versión nativa).
 */
export const ThresholdDatePicker = ({ value, onChange }: Props) => {
  const { t } = useTranslation();
  const [currentMonth, setCurrentMonth] = useState(new Date(value.getFullYear(), value.getMonth(), 1));
  const [view, setView] = useState<'calendar' | 'year'>('calendar');

  const generateDays = () => {
    const days = [];
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    for (let i = 0; i < firstDay; i++) {
      days.push({ day: '', type: 'empty' });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ day: i, type: 'current' });
    }
    return days;
  };

  const handleDayPress = (day: number) => {
    const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    onChange({ type: 'set' }, newDate);
  };

  const changeMonth = (offset: number) => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1));
  };

  const selectYear = (year: number) => {
    setCurrentMonth(new Date(year, currentMonth.getMonth(), 1));
    setView('calendar');
  };

  const isToday = (day: number) => {
    const today = new Date();
    return today.getDate() === day && today.getMonth() === currentMonth.getMonth() && today.getFullYear() === currentMonth.getFullYear();
  };

  const isSelected = (day: number) => {
    return value.getDate() === day && value.getMonth() === currentMonth.getMonth() && value.getFullYear() === currentMonth.getFullYear();
  };

  const years = Array.from({ length: 21 }, (_, i) => new Date().getFullYear() - 10 + i);

  return (
    <Modal transparent animationType="fade" visible={true}>
      <Pressable style={styles.backdrop} onPress={() => onChange({ type: 'dismissed' })}>
        <Pressable style={styles.container}>
          <View style={styles.header}>
            {view === 'calendar' ? (
              <>
                <TouchableOpacity onPress={() => changeMonth(-1)}>
                  <Ionicons name="chevron-back" size={20} color={theme.colors.text.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setView('year')}>
                  <Text style={styles.monthTitle}>
                    {(t('common.months', { returnObjects: true }) as string[])[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => changeMonth(1)}>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.text.primary} />
                </TouchableOpacity>
              </>
            ) : (
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity onPress={() => setView('calendar')} style={{ marginRight: 12 }}>
                  <Ionicons name="arrow-back" size={20} color={theme.colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.monthTitle}>{t('modals.selectYear')}</Text>
              </View>
            )}
          </View>

          {view === 'calendar' ? (
            <>
              <View style={styles.weekDays}>
                {[0,1,2,3,4,5,6].map(i => {
                  const d = (t('common.daysShort', { returnObjects: true }) as string[])[(i + 6) % 7];
                  return <Text key={i} style={styles.weekDayText}>{d}</Text>;
                })}
              </View>

              <View style={styles.grid}>
                {generateDays().map((item, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.dayCell,
                      item.type === 'empty' && { opacity: 0 },
                      isSelected(item.day as number) && styles.selectedDay
                    ]}
                    disabled={item.type === 'empty'}
                    onPress={() => handleDayPress(item.day as number)}
                  >
                    <Text style={[
                      styles.dayText,
                      isSelected(item.day as number) && styles.selectedDayText,
                      isToday(item.day as number) && !isSelected(item.day as number) && styles.todayText
                    ]}>
                      {item.day}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : (
            <ScrollView style={{ height: 210 }} showsVerticalScrollIndicator={false}>
              <View style={styles.yearGrid}>
                {years.map(y => (
                  <TouchableOpacity 
                    key={y} 
                    style={[styles.yearCell, currentMonth.getFullYear() === y && styles.selectedYear]} 
                    onPress={() => selectYear(y)}
                  >
                    <Text style={[styles.yearText, currentMonth.getFullYear() === y && styles.selectedYearText]}>{y}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}

          <TouchableOpacity 
            style={styles.closeBtn}
            onPress={() => onChange({ type: 'dismissed' })}
          >
            <Text style={styles.closeBtnText}>{t('modals.cancel')}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};
