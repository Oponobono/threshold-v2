import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { dashboardStyles as styles } from '../../styles/Dashboard.styles';
import { theme } from '../../styles/theme';
import { globalStyles } from '../../styles/globalStyles';
import { alertRef } from '../CustomAlert';
import { updateAssessment, type Assessment } from '../../services/api';
import { useDataStore } from '../../store/useDataStore';

interface CompleteTaskModalProps {
  visible: boolean;
  onClose: () => void;
  task: Assessment | null;
}

export const CompleteTaskModal = ({ visible, onClose, task }: CompleteTaskModalProps) => {
  const { t } = useTranslation();
  const { refreshSubjects } = useDataStore();

  const [gradeValue, setGradeValue] = useState('');
  const [gradePercentage, setGradePercentage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  React.useEffect(() => {
    if (!visible) {
      setGradeValue('');
      setGradePercentage('');
    }
  }, [visible]);

  const handleClose = () => {
    onClose();
  };

  const handleCompleteTask = async () => {
    if (!task?.id || !gradeValue.trim() || !gradePercentage.trim()) {
      alertRef.show({ 
        title: t('common.error'), 
        message: t('dashboard.quickAddMenu.errors.fillFields'), 
        type: 'warning' 
      });
      return;
    }

    try {
      setIsSaving(true);
      await updateAssessment(task.id, {
        is_completed: true,
        grade_value: Number(gradeValue),
        percentage: Number(gradePercentage),
      });

      alertRef.show({ 
        title: t('common.success'), 
        message: t('tasks.completeSuccess', 'Tarea marcada como entregada'), 
        type: 'success' 
      });
      
      const { refreshSubjects, refreshAssessments } = useDataStore.getState();
      await Promise.all([refreshSubjects(), refreshAssessments()]);
      handleClose();
    } catch (error: any) {
      alertRef.show({ 
        title: t('common.error'), 
        message: error?.message || t('common.errorOccurred'), 
        type: 'error' 
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <Pressable style={styles.sheetBackdrop} onPress={handleClose}>
        <Pressable style={styles.sheetContent} onPress={() => null}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{t('tasks.complete', 'Entregar Tarea')}</Text>
          
          <ScrollView showsVerticalScrollIndicator={false} style={{ flexShrink: 1 }} contentContainerStyle={{ paddingBottom: 10 }}>
            <Text style={styles.sheetLabel}>{t('tasks.taskName', 'Nombre de la tarea')}</Text>
            <View style={[styles.sheetInput, { backgroundColor: theme.colors.border }]}>
              <Text style={{ color: theme.colors.text.primary, fontSize: 16 }}>{task?.name}</Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={globalStyles.flex1}>
                <Text style={styles.sheetLabel}>{t('dashboard.quickAddMenu.grade.grade')}</Text>
                <TextInput
                  value={gradeValue}
                  onChangeText={setGradeValue}
                  style={styles.sheetInput}
                  keyboardType="numeric"
                  placeholder={t('dashboard.quickAddMenu.grade.gradePlaceholder')}
                  placeholderTextColor={theme.colors.text.placeholder}
                />
              </View>
              <View style={globalStyles.flex1}>
                <Text style={styles.sheetLabel}>{t('dashboard.quickAddMenu.grade.percentage')}</Text>
                <TextInput
                  value={gradePercentage}
                  onChangeText={setGradePercentage}
                  style={styles.sheetInput}
                  keyboardType="numeric"
                  placeholder={t('dashboard.quickAddMenu.grade.percentagePlaceholder')}
                  placeholderTextColor={theme.colors.text.placeholder}
                />
              </View>
            </View>
          </ScrollView>

          <View style={styles.sheetActions}>
            <TouchableOpacity style={[styles.sheetCancelBtn, { flex: 1 }]} onPress={handleClose}>
              <Text style={styles.sheetCancelText}>{t('dashboard.newSubject.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sheetSaveBtn, { flex: 1 }, isSaving && { opacity: 0.6 }]}
              onPress={handleCompleteTask}
              disabled={isSaving}
            >
              <Text style={styles.sheetSaveText}>
                {isSaving ? t('dashboard.newSubject.saving') : t('tasks.complete', 'Entregar')}
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};
