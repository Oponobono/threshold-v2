/**
 * EventCreationModal.tsx
 * 
 * Modal para crear eventos en el calendario con diseño Bento minimalista.
 * Soporta eventos académicos y personales con vinculación opcional a materias.
 */

import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  ScrollView,
  TextInput,
  Switch,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../styles/theme';
import { globalStyles } from '../styles/globalStyles';
import DateTimePicker from '@react-native-community/datetimepicker';
import { alertRef } from './CustomAlert';

interface EventCreationModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (event: CalendarEventInput) => void;
  selectedDate?: Date;
  subjects: any[];
}

export interface CalendarEventInput {
  title: string;
  eventType: 'exam' | 'task' | 'class' | 'other';
  subjectId?: number;
  startDate: string; // DD-MM-YYYY
  endDate: string; // DD-MM-YYYY
  startTime?: string; // HH:MM
  endTime?: string; // HH:MM
  allDay: boolean;
  description?: string;
  createStudyPlan: boolean;
}

type EventType = 'exam' | 'task' | 'class' | 'other';

const { height: screenHeight } = Dimensions.get('window');

const EVENT_TYPES: Record<EventType, { label: string; color: string }> = {
  exam: { label: 'Examen', color: '#FF3B30' },
  task: { label: 'Tarea', color: '#34C759' },
  class: { label: 'Clase', color: '#007AFF' },
  other: { label: 'Otro', color: '#A2845E' },
};

export const EventCreationModal: React.FC<EventCreationModalProps> = ({
  visible,
  onClose,
  onSave,
  selectedDate,
  subjects = [],
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;

  // Form state
  const [title, setTitle] = useState('');
  const [eventType, setEventType] = useState<EventType>('task');
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | undefined>();
  const [allDay, setAllDay] = useState(true);
  const [description, setDescription] = useState('');
  const [createStudyPlan, setCreateStudyPlan] = useState(false);

  // Date/Time state
  const [startDate, setStartDate] = useState(selectedDate || new Date());
  const [endDate, setEndDate] = useState(selectedDate || new Date());
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date(new Date().getTime() + 60 * 60 * 1000));

  // Pickers state
  const [showDatePicker, setShowDatePicker] = useState<'startDate' | 'endDate' | null>(null);
  const [showTimePicker, setShowTimePicker] = useState<'startTime' | 'endTime' | null>(null);
  const [showSubjectPicker, setShowSubjectPicker] = useState(false);

  // Animation
  useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: screenHeight,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  const handleDateChange = (date: Date, type: 'startDate' | 'endDate') => {
    if (type === 'startDate') {
      setStartDate(date);
      if (date > endDate) {
        setEndDate(date);
      }
    } else {
      setEndDate(date);
    }
    setShowDatePicker(null);
  };

  const handleTimeChange = (date: Date, type: 'startTime' | 'endTime') => {
    if (type === 'startTime') {
      setStartTime(date);
    } else {
      setEndTime(date);
    }
    setShowTimePicker(null);
  };

  const formatDate = (date: Date) => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const formatTime = (date: Date) => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const handleSave = () => {
    if (!title.trim()) {
      alertRef.show({
        title: t('common.error'),
        message: t('calendar.eventNameRequired') || 'Ingresa el nombre del evento',
        type: 'warning',
      });
      return;
    }

    if (eventType !== 'other' && !selectedSubjectId) {
      alertRef.show({
        title: t('common.error'),
        message: t('calendar.subjectRequired') || 'Selecciona una materia',
        type: 'warning',
      });
      return;
    }

    const event: CalendarEventInput = {
      title: title.trim(),
      eventType,
      subjectId: eventType !== 'other' ? selectedSubjectId : undefined,
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      startTime: allDay ? undefined : formatTime(startTime),
      endTime: allDay ? undefined : formatTime(endTime),
      allDay,
      description: description.trim() || undefined,
      createStudyPlan: eventType === 'exam' ? createStudyPlan : false,
    };

    onSave(event);
    resetForm();
    onClose();
  };

  const resetForm = () => {
    setTitle('');
    setEventType('task');
    setSelectedSubjectId(undefined);
    setAllDay(true);
    setDescription('');
    setCreateStudyPlan(false);
    setStartDate(new Date());
    setEndDate(new Date());
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Overlay */}
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      />

      {/* Modal flotante */}
      <Animated.View
        style={[
          styles.container,
          {
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <ScrollView
          scrollEnabled={true}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 0 }}
        >
          <View style={styles.content}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>{t('calendar.newEvent')}</Text>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={24} color={theme.colors.text.primary} />
              </TouchableOpacity>
            </View>

            {/* Bloque 1: Identidad - Título + Tipo */}
            <View style={styles.bentoBlock}>
              <View style={styles.bentoBlockContent}>
                {/* Título con estilos del login */}
                <View style={styles.titleInputContainer}>
                  <TextInput
                    style={styles.titleInput}
                    placeholder=""
                    placeholderTextColor="#8A8A8E"
                    value={title}
                    onChangeText={setTitle}
                    maxLength={100}
                    autoFocus
                  />
                  <Text style={styles.titleInputLabel}>{t('calendar.eventName')}</Text>
                </View>

                {/* Selector de Tipo */}
                <View style={styles.typePillsContainer}>
                  {(Object.entries(EVENT_TYPES) as [EventType, typeof EVENT_TYPES[EventType]][]).map(
                    ([type, config]) => (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.typePill,
                          eventType === type && {
                            backgroundColor: config.color,
                          },
                        ]}
                        onPress={() => {
                          setEventType(type);
                          if (type === 'other') {
                            setSelectedSubjectId(undefined);
                          }
                        }}
                      >
                        <Text style={[
                          styles.typePillText,
                          eventType === type && styles.typePillTextActive,
                        ]}>
                          {config.label}
                        </Text>
                      </TouchableOpacity>
                    )
                  )}
                </View>
              </View>
            </View>

            {/* Bloque 2: Vinculación Académica - Solo si no es "Otro" */}
            {eventType !== 'other' && (
              <View style={styles.bentoBlock}>
                <View style={styles.bentoBlockLabel}>
                  <Ionicons name="bookmark-outline" size={16} color={theme.colors.primary} />
                  <Text style={styles.bentoBlockTitle}>{t('calendar.linkedSubject')}</Text>
                </View>
                <TouchableOpacity
                  style={styles.subjectSelector}
                  onPress={() => setShowSubjectPicker(true)}
                >
                  <View style={globalStyles.row}>
                    <Ionicons name="layers-outline" size={18} color={theme.colors.primary} />
                    <Text style={styles.subjectSelectorText}>
                      {selectedSubjectId
                        ? subjects.find(s => s.id === selectedSubjectId)?.name ||
                          t('calendar.selectSubject')
                        : t('calendar.selectSubject')}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.text.secondary} />
                </TouchableOpacity>

                {/* Subject Picker Modal */}
                {showSubjectPicker && (
                  <SubjectPickerSheet
                    visible={showSubjectPicker}
                    subjects={subjects}
                    selectedId={selectedSubjectId}
                    onSelect={(id) => {
                      setSelectedSubjectId(id);
                      setShowSubjectPicker(false);
                    }}
                    onClose={() => setShowSubjectPicker(false)}
                  />
                )}
              </View>
            )}

            {/* Bloque 3: Tiempo */}
            <View style={[styles.bentoBlock, styles.whenBlock]}>
              <View style={styles.bentoBlockLabel}>
                <Ionicons name="time-outline" size={16} color={theme.colors.primary} />
                <Text style={styles.bentoBlockTitle}>{t('calendar.when')}</Text>
              </View>

              {/* All Day Switch */}
              <View style={styles.allDayRow}>
                <Text style={styles.allDayLabel}>{t('calendar.allDay')}</Text>
                <Switch
                  value={allDay}
                  onValueChange={setAllDay}
                  trackColor={{ false: theme.colors.border, true: theme.colors.primary + '40' }}
                  thumbColor={allDay ? theme.colors.primary : theme.colors.text.secondary}
                />
              </View>

              {/* All Day: Un solo campo de fecha */}
              {allDay && (
                <TouchableOpacity
                  style={styles.dateTimeButton}
                  onPress={() => setShowDatePicker('startDate')}
                >
                  <Ionicons name="calendar-outline" size={16} color={theme.colors.primary} />
                  <Text style={styles.dateTimeButtonText}>{formatDate(startDate)}</Text>
                </TouchableOpacity>
              )}

              {/* No All Day: Dos filas, cada una con botón de fecha + botón de hora */}
              {!allDay && (
                <>
                  {/* Inicio */}
                  <View style={styles.dateTimeRowContainer}>
                    <Text style={styles.dateTimeRowLabel}>Inicio</Text>
                    <View style={styles.dateTimeButtonRow}>
                      <TouchableOpacity
                        style={[styles.dateTimeButton, { flex: 1 }]}
                        onPress={() => setShowDatePicker('startDate')}
                      >
                        <Ionicons name="calendar-outline" size={16} color={theme.colors.primary} />
                        <Text style={styles.dateTimeButtonText}>{formatDate(startDate)}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.dateTimeButton, { flex: 1 }]}
                        onPress={() => setShowTimePicker('startTime')}
                      >
                        <Ionicons name="time-outline" size={16} color={theme.colors.primary} />
                        <Text style={styles.dateTimeButtonText}>{formatTime(startTime)}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Fin */}
                  <View style={styles.dateTimeRowContainer}>
                    <Text style={styles.dateTimeRowLabel}>Fin</Text>
                    <View style={styles.dateTimeButtonRow}>
                      <TouchableOpacity
                        style={[styles.dateTimeButton, { flex: 1 }]}
                        onPress={() => setShowDatePicker('endDate')}
                      >
                        <Ionicons name="calendar-outline" size={16} color={theme.colors.primary} />
                        <Text style={styles.dateTimeButtonText}>{formatDate(endDate)}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.dateTimeButton, { flex: 1 }]}
                        onPress={() => setShowTimePicker('endTime')}
                      >
                        <Ionicons name="time-outline" size={16} color={theme.colors.primary} />
                        <Text style={styles.dateTimeButtonText}>{formatTime(endTime)}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              )}

              {/* DateTimePicker - Start Date */}
              {showDatePicker === 'startDate' && (
                <DateTimePicker
                  value={startDate}
                  mode="date"
                  display="spinner"
                  onChange={(event, date) => {
                    if (date) handleDateChange(date, 'startDate');
                  }}
                />
              )}

              {/* DateTimePicker - End Date */}
              {showDatePicker === 'endDate' && (
                <DateTimePicker
                  value={endDate}
                  mode="date"
                  display="spinner"
                  onChange={(event, date) => {
                    if (date) handleDateChange(date, 'endDate');
                  }}
                />
              )}

              {/* DateTimePicker - Start Time */}
              {showTimePicker === 'startTime' && !allDay && (
                <DateTimePicker
                  value={startTime}
                  mode="time"
                  display="spinner"
                  onChange={(event, date) => {
                    if (date) handleTimeChange(date, 'startTime');
                  }}
                />
              )}

              {/* DateTimePicker - End Time */}
              {showTimePicker === 'endTime' && !allDay && (
                <DateTimePicker
                  value={endTime}
                  mode="time"
                  display="spinner"
                  onChange={(event, date) => {
                    if (date) handleTimeChange(date, 'endTime');
                  }}
                />
              )}
            </View>

            {/* Bloque 4: Plan de Estudio Automático - Solo para Exámenes */}
            {eventType === 'exam' && (
              <View style={styles.bentoBlock}>
                <View style={styles.bentoBlockLabel}>
                  <Ionicons name="bulb-outline" size={16} color={theme.colors.primary} />
                  <Text style={styles.bentoBlockTitle}>{t('calendar.studyPlan')}</Text>
                </View>
                <View style={styles.studyPlanRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.studyPlanLabel}>{t('calendar.createAutoStudyPlan')}</Text>
                    <Text style={styles.studyPlanSubtext}>
                      {t('calendar.studyPlanDescription')}
                    </Text>
                  </View>
                  <Switch
                    value={createStudyPlan}
                    onValueChange={setCreateStudyPlan}
                    trackColor={{ false: theme.colors.border, true: theme.colors.primary + '40' }}
                    thumbColor={createStudyPlan ? theme.colors.primary : theme.colors.text.secondary}
                  />
                </View>
              </View>
            )}

            {/* Bloque 5: Descripción/Notas - Opcional */}
            {eventType === 'other' && (
              <View style={styles.bentoBlock}>
                <View style={styles.bentoBlockLabel}>
                  <Ionicons name="document-text-outline" size={16} color={theme.colors.primary} />
                  <Text style={styles.bentoBlockTitle}>{t('calendar.notes')}</Text>
                </View>
                <TextInput
                  style={styles.descriptionInput}
                  placeholder={t('calendar.addNotes')}
                  placeholderTextColor={theme.colors.text.secondary}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={3}
                  maxLength={500}
                />
              </View>
            )}
          </View>
        </ScrollView>

        {/* Footer Buttons - Fuera del fondo redondeado */}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
          >
            <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
          >
            <Text style={styles.saveButtonText}>{t('common.save')}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
};

// Subject Picker Simple Sheet
interface SubjectPickerSheetProps {
  visible: boolean;
  subjects: any[];
  selectedId?: number;
  onSelect: (id: number) => void;
  onClose: () => void;
}

const SubjectPickerSheet: React.FC<SubjectPickerSheetProps> = ({
  visible,
  subjects,
  selectedId,
  onSelect,
  onClose,
}) => {
  const { t } = useTranslation();
  
  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="fade">
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
      <View style={styles.pickerContainer}>
        <View style={styles.pickerContent}>
          <Text style={styles.pickerTitle}>{t('calendar.selectSubject')}</Text>
          <ScrollView style={styles.pickerList}>
            {subjects.map((subject) => (
              <TouchableOpacity
                key={subject.id}
                style={[
                  styles.pickerItem,
                  selectedId === subject.id && styles.pickerItemSelected,
                ]}
                onPress={() => onSelect(subject.id)}
              >
                <View
                  style={[
                    styles.pickerItemColor,
                    { backgroundColor: subject.color || theme.colors.primary },
                  ]}
                />
                <Text style={styles.pickerItemText}>{subject.name}</Text>
                {selectedId === subject.id && (
                  <Ionicons name="checkmark" size={20} color={theme.colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: screenHeight * 0.85,
    backgroundColor: 'transparent',
  },
  content: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },

  // Bento Blocks
  bentoBlock: {
    backgroundColor: '#F8F9FA',
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  whenBlock: {
    // No additional margin needed
  },
  bentoBlockLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bentoBlockTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bentoBlockContent: {
    gap: 12,
  },

  // Bloque 1: Título con estilos del login
  titleInputContainer: {
    position: 'relative',
    backgroundColor: '#F9F9F7',
    borderWidth: 0.8,
    borderColor: theme.colors.border,
    borderRadius: 12,
    height: 54,
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  titleInput: {
    fontSize: 15,
    fontWeight: '400',
    color: theme.colors.text.primary,
    padding: 0,
    flex: 1,
  },
  titleInputLabel: {
    position: 'absolute',
    left: 16,
    top: -8,
    backgroundColor: '#F9F9F7',
    paddingHorizontal: 4,
    fontSize: 11,
    fontWeight: '300',
    color: '#8A8A8E',
    letterSpacing: 0.5,
  },

  // Bloque 1: Type Pills
  typePillsContainer: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  typePill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: theme.colors.inputBackground,
    borderWidth: 0,
  },
  typePillText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text.secondary,
  },
  typePillTextActive: {
    color: '#fff',
  },

  // Bloque 2: Subject Selector
  subjectSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  subjectSelectorText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text.primary,
    marginLeft: 8,
    flex: 1,
  },

  // Bloque 3: Time
  allDayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  allDayLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text.primary,
  },
  dateTimeRowContainer: {
    gap: 6,
  },
  dateTimeRowLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text.secondary,
    marginLeft: 4,
  },
  dateTimeButtonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  dateTimeButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.colors.text.primary,
  },
  dateTimeButtonDivider: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    marginHorizontal: 2,
  },

  // Bloque 4: Study Plan
  studyPlanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  studyPlanLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 4,
  },
  studyPlanSubtext: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    marginTop: 2,
  },

  // Bloque 5: Description
  descriptionInput: {
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: theme.colors.text.primary,
    textAlignVertical: 'top',
  },

  // Footer
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: theme.colors.background,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: theme.colors.inputBackground,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text.secondary,
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },

  // Subject Picker
  pickerContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  pickerContent: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: screenHeight * 0.6,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text.primary,
    marginBottom: 16,
  },
  pickerList: {
    gap: 8,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: theme.colors.inputBackground,
    marginBottom: 8,
  },
  pickerItemSelected: {
    backgroundColor: theme.colors.primary + '15',
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
  },
  pickerItemColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  pickerItemText: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.colors.text.primary,
    flex: 1,
  },
});
