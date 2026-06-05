import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { dashboardStyles as styles } from '../../styles/Dashboard.styles';
import { studyTimerModalStyles as localStyles } from '../../styles/StudyTimerModal.styles';
import { Subject } from '../../services/api';

interface StudyTimerModalProps {
  isVisible: boolean;
  onClose: () => void;
  subjects: Subject[];
  onStart: (config: { mode: 'pomodoro' | 'threshold', subjectId: string | null, duration: number }) => void;
  viewState: 'config' | 'feedback';
  onSaveFeedback: (feedback: string) => void;
}

/**
 * StudyTimerModal.tsx
 *
 * Modal de configuración/feedback del temporizador de estudio. Opera en dos vistas:
 * - `config`: Permite elegir el modo (Pomodoro o Threshold), la duración en minutos
 *   (solo Pomodoro) y la materia activa. Al confirmar dispara `onStart`.
 * - `feedback`: Aparece al terminar una sesión, preguntando al alumno cómo siente
 *   su avance mediante botones de opciones predefinidas traducidas via i18n.
 *
 * @param isVisible - Controla la visibilidad del Bottom Sheet.
 * @param onClose - Callback para cerrar el modal.
 * @param subjects - Lista de materias disponibles para seleccionar.
 * @param onStart - Callback con la configuración final (modo, materia, duración en segundos).
 * @param viewState - Vista activa del modal ('config' | 'feedback').
 * @param onSaveFeedback - Callback con la opción de feedback seleccionada al finalizar.
 */
export const StudyTimerModal: React.FC<StudyTimerModalProps> = ({
  isVisible,
  onClose,
  subjects,
  onStart,
  viewState = 'config',
  onSaveFeedback
}) => {
  const { t } = useTranslation();
  
  const [selectedMode, setSelectedMode] = useState<'pomodoro' | 'threshold'>('pomodoro');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [duration, setDuration] = useState(25);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleStart = () => {
    onStart({
      mode: selectedMode,
      subjectId: selectedSubjectId,
      duration: duration * 60,
    });
    onClose();
  };

  const handleFeedback = (option: string) => {
    setFeedback(option);
    onSaveFeedback(option);
    onClose();
  };

  const renderConfig = () => (
    <View>
      <Text style={styles.sheetTitle}>{t('dashboard.studyTimerModal.title')}</Text>
      <Text style={styles.sheetSubtitle}>{t('dashboard.studyTimerModal.subtitle')}</Text>

      <Text style={styles.sheetLabel}>{t('dashboard.studyTimerModal.mode')}</Text>
      <View style={localStyles.modeContainer}>
        <TouchableOpacity 
          style={[localStyles.modeBtn, selectedMode === 'pomodoro' && localStyles.modeBtnActive]}
          onPress={() => setSelectedMode('pomodoro')}
        >
          <MaterialCommunityIcons 
            name="timer-sand" 
            size={24} 
            color={selectedMode === 'pomodoro' ? theme.colors.white : theme.colors.text.secondary} 
          />
          <Text style={[localStyles.modeBtnText, selectedMode === 'pomodoro' && localStyles.modeBtnTextActive]}>
            {t('dashboard.studyTimerModal.pomodoro')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[localStyles.modeBtn, selectedMode === 'threshold' && localStyles.modeBtnActive]}
          onPress={() => setSelectedMode('threshold')}
        >
          <MaterialCommunityIcons 
            name="trending-up" 
            size={24} 
            color={selectedMode === 'threshold' ? theme.colors.white : theme.colors.text.secondary} 
          />
          <Text style={[localStyles.modeBtnText, selectedMode === 'threshold' && localStyles.modeBtnTextActive]}>
            {t('dashboard.studyTimerModal.threshold')}
          </Text>
        </TouchableOpacity>
      </View>

      {selectedMode === 'pomodoro' && (
        <>
          <Text style={styles.sheetLabel}>{t('modals.durationMinutes')}</Text>
          <View style={localStyles.durationContainer}>
            {[15, 25, 45, 60].map((d) => (
              <TouchableOpacity 
                key={d} 
                style={[localStyles.durationChip, duration === d && localStyles.durationChipActive]}
                onPress={() => setDuration(d)}
              >
                <Text style={[localStyles.durationText, duration === d && localStyles.durationTextActive]}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      <Text style={styles.sheetLabel}>{t('dashboard.studyTimerModal.selectSubject')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={localStyles.subjectsScroll}>
        {subjects.map((s) => (
          <TouchableOpacity 
            key={s.id} 
            style={[localStyles.subjectCard, String(selectedSubjectId) === String(s.id) && { borderColor: theme.colors.primary, borderWidth: 2 }]}
            onPress={() => setSelectedSubjectId(String(s.id))}
          >
            <View style={[styles.subjectBadge, { backgroundColor: s.color || '#CCC', marginBottom: 0 }]}>
               <MaterialCommunityIcons name={(s.icon as React.ComponentProps<typeof MaterialCommunityIcons>['name']) || 'book-outline'} size={20} color={theme.colors.text.primary} />
            </View>
            <Text style={localStyles.subjectName} numberOfLines={1}>{s.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity style={[styles.sheetSaveBtn, { marginTop: 24 }]} onPress={handleStart}>
        <Text style={styles.sheetSaveText}>{t('dashboard.studyTimerModal.start')}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderFeedback = () => (
    <View style={{ alignItems: 'center' }}>
      <View style={localStyles.finishIcon}>
        <MaterialCommunityIcons name="star-face" size={48} color="#D4AF37" />
      </View>
      <Text style={styles.sheetTitle}>{t('dashboard.studyTimerModal.finished')}</Text>
      <Text style={[styles.sheetSubtitle, { textAlign: 'center' }]}>{t('dashboard.studyTimerModal.advanceQuestion')}</Text>

      <View style={localStyles.optionsGrid}>
        {Object.entries(t('dashboard.studyTimerModal.advanceOptions', { returnObjects: true }) as any).map(([key, value]: [string, any]) => (
          <TouchableOpacity 
            key={key} 
            style={localStyles.optionBtn}
            onPress={() => handleFeedback(value)}
          >
            <Text style={localStyles.optionText}>{value}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={[styles.sheetCancelBtn, { width: '100%', marginTop: 20 }]} onPress={onClose}>
        <Text style={styles.sheetCancelText}>{t('common.close')}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.sheetContent} onPress={() => null}>
          <View style={styles.sheetHandle} />
          {viewState === 'config' ? renderConfig() : renderFeedback()}
        </Pressable>
      </Pressable>
    </Modal>
  );
};
