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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { styles } from '../../styles/EventCreationModal.styles';
import { globalStyles } from '../../styles/globalStyles';
import DateTimePicker from '@react-native-community/datetimepicker';
import { alertRef } from '../ui/CustomAlert';

interface EventCreationModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (event: CalendarEventInput, eventId?: string) => void;
  selectedDate?: Date;
  subjects: any[];
  editingEvent?: any | null;
}

export interface CalendarEventInput {
  title: string;
  eventType: 'exam' | 'task' | 'class' | 'other';
  subjectId?: string;
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

const EVENT_TYPES: Record<EventType, { labelKey: string; color: string }> = {
  exam: { labelKey: 'calendar.exam', color: '#FF3B30' },
  task: { labelKey: 'calendar.task', color: '#34C759' },
  class: { labelKey: 'calendar.class', color: '#007AFF' },
  other: { labelKey: 'calendar.other', color: '#A2845E' },
};

const EMPTY_DATE = new Date(2000, 0, 1);

export const EventCreationModal: React.FC<EventCreationModalProps> = ({
  visible,
  onClose,
  onSave,
  selectedDate,
  subjects = [],
  editingEvent,
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;

  // Form state
  const [title, setTitle] = useState('');
  const [eventType, setEventType] = useState<EventType>('task');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | undefined>();
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

  // Pre-fill form when editing an existing event
  useEffect(() => {
    if (visible && editingEvent) {
      setTitle(editingEvent.title || '');
      setEventType(editingEvent.event_type || editingEvent.eventType || 'task');
      setSelectedSubjectId(editingEvent.subject_id || editingEvent.subjectId);
      setAllDay(editingEvent.all_day ?? editingEvent.allDay ?? true);
      setDescription(editingEvent.description || '');
      setCreateStudyPlan(editingEvent.create_study_plan ?? editingEvent.createStudyPlan ?? false);

      const startD = editingEvent.start_date || editingEvent.startDate;
      if (startD) {
        // Formato esperado: YYYY-MM-DD
        const parts = startD.split('-');
        if (parts.length === 3) {
          const [y, m, d] = parts.map(Number);
          setStartDate(new Date(y, m - 1, d));
        }
      }
      
      const endD = editingEvent.end_date || editingEvent.endDate;
      if (endD) {
        const parts = endD.split('-');
        if (parts.length === 3) {
          const [y, m, d] = parts.map(Number);
          setEndDate(new Date(y, m - 1, d));
        }
      }
      
      const parseTime = (t: string) => {
        if (!t) return EMPTY_DATE;
        const [h, min] = t.split(':').map(Number);
        const d = new Date();
        d.setHours(h, min, 0, 0);
        return d;
      };
      setStartTime(parseTime(editingEvent.start_time || editingEvent.startTime));
      setEndTime(parseTime(editingEvent.end_time || editingEvent.endTime));
    } else if (visible && !editingEvent) {
      resetForm();
    }
  }, [visible, editingEvent]);

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
        message: t('calendar.eventNameRequired'),
        type: 'warning',
      });
      return;
    }

    if (eventType !== 'other' && !selectedSubjectId) {
      alertRef.show({
        title: t('common.error'),
        message: t('calendar.subjectRequired'),
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

    onSave(event, editingEvent?.id);
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
          <View style={[styles.content, { paddingBottom: insets.bottom }]}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>{editingEvent ? t('calendar.editEvent') : t('calendar.newEvent')}</Text>
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
                          {t(config.labelKey)}
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
                    <Text style={styles.dateTimeRowLabel}>{t('calendar.startTime')}</Text>
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
                    <Text style={styles.dateTimeRowLabel}>{t('calendar.endTime')}</Text>
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
  selectedId?: string;
  onSelect: (id: string) => void;
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
  const insets = useSafeAreaInsets();
  
  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="fade">
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
      <View style={styles.pickerContainer}>
        <View style={[styles.pickerContent, { paddingBottom: Math.max(insets.bottom, 20) }]}>
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


