import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal, Pressable, ActionSheetIOS, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Assessment, deleteAssessment } from '../services/api';
import { theme } from '../styles/theme';
import { useCustomAlert } from './CustomAlert';
import { subjectDetailStyles as styles } from '../styles/SubjectDetail.styles';
import { EditGradeModal } from './dashboard/EditGradeModal';
import { EditTaskModal } from './dashboard/EditTaskModal';
import { CompleteTaskModal } from './dashboard/CompleteTaskModal';
import { dashboardStyles as dashStyles } from '../styles/Dashboard.styles';
import {
  getAssessmentProgress,
  normalizeGrade,
  parseWeight,
  formatGrade,
  SCALE_MAX,
} from '../utils/grades';

const ProgressBar = ({ value, color }: { value: number; color: string }) => (
  <View style={styles.progressTrack}>
    <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: color }]} />
  </View>
);

interface SubjectInsightsProps {
  recentAssessments: Assessment[];
  onDeleteAssessment?: (id: number) => void;
  onOpenCategories?: () => void;
  onAddAssessment?: () => void;
  subjects: any[];
}

/**
 * SubjectInsights.tsx
 *
 * Sección de la pantalla de detalle de materia que muestra el historial reciente
 * de evaluaciones (notas, tareas, exámenes). Cada elemento incluye el nombre,
 * tipo, peso porcentual, fecha, calificación obtenida y una barra de progreso con
 * color semántico (verde/naranja/rojo) basado en el porcentaje de logro.
 * Permite eliminar evaluaciones individuales con confirmación, y editar las notas.
 *
 * @param recentAssessments - Lista de evaluaciones de la materia para mostrar.
 * @param onDeleteAssessment - Callback opcional llamado con el ID al eliminar una evaluación.
 * @param subjects - Lista de materias disponibles para cambiar de materia al editar.
 */
export const SubjectInsights: React.FC<SubjectInsightsProps> = ({ recentAssessments, onDeleteAssessment, onOpenCategories, onAddAssessment, subjects }) => {
  const { t } = useTranslation();
  const { showAlert } = useCustomAlert();
  
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);
  const [isEditGradeModalVisible, setIsEditGradeModalVisible] = useState(false);
  const [isEditTaskModalVisible, setIsEditTaskModalVisible] = useState(false);
  const [isCompleteTaskModalVisible, setIsCompleteTaskModalVisible] = useState(false);
  const [isMenuModalVisible, setIsMenuModalVisible] = useState(false);

  const handleShowMenu = (assessment: Assessment) => {
    setSelectedAssessment(assessment);
    const isIncompleteTask = assessment.type === 'task' && !assessment.is_completed;
    
    if (Platform.OS === 'ios') {
      const options = [
        t('common.cancel'),
        ...(isIncompleteTask ? [t('tasks.markDelivered', 'Marcar como entregada')] : []),
        t('assessments.edit', 'Editar'),
        t('common.delete'),
      ];
      
      const deleteIndex = options.length - 1;
      const cancelIndex = 0;
      
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          destructiveButtonIndex: deleteIndex,
          cancelButtonIndex: cancelIndex,
          userInterfaceStyle: 'dark',
        },
        (buttonIndex) => {
          if (isIncompleteTask) {
            // For incomplete tasks: Cancel(0), MarkDelivered(1), Edit(2), Delete(3)
            if (buttonIndex === 1) {
              setIsCompleteTaskModalVisible(true);
            } else if (buttonIndex === 2) {
              setIsEditTaskModalVisible(true);
            } else if (buttonIndex === 3) {
              handleDelete(assessment.id!);
            }
          } else {
            // For completed tasks/grades: Cancel(0), Edit(1), Delete(2)
            if (buttonIndex === 1) {
              setIsEditGradeModalVisible(true);
            } else if (buttonIndex === 2) {
              handleDelete(assessment.id!);
            }
          }
        }
      );
    } else {
      // Android: mostrar modal personalizado
      setIsMenuModalVisible(true);
    }
  };

  const handleDelete = (id: number) => {
    showAlert({
      title: t('common.deleteItem') || 'Eliminar',
      message: t('assessments.deleteConfirm') || '¿Estás seguro de que quieres eliminar esta nota/evaluación?',
      type: 'confirm',
      buttons: [
        { text: t('common.cancel') || 'Cancelar', style: 'cancel' },
        {
          text: t('common.delete') || 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAssessment(id);
              onDeleteAssessment?.(id);
            } catch (e: any) {
              showAlert({ title: t('common.error') || 'Error', message: (t('common.errors.deleteFailed') || 'No se pudo eliminar: ') + `${e.message || 'Error de red'}`, type: 'error' });
            }
          }
        }
      ]
    });
  };

  return (
    <>
      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeaderRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.sectionTitle}>{t('analytics.insightsTitle')}</Text>
            <Text style={styles.sectionHint}>{t('analytics.insightsHint')}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center', flexShrink: 0 }}>
            <Text style={styles.sectionChip}>{recentAssessments.length} {t('subjects.notes')}</Text>
            
            {onOpenCategories && (
              <TouchableOpacity
                onPress={onOpenCategories}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="layers-outline" size={22} color={theme.colors.text.secondary} />
              </TouchableOpacity>
            )}

            {onAddAssessment && (
              <TouchableOpacity onPress={onAddAssessment} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="add-circle" size={24} color={theme.colors.primary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.insightsCard}>
          {recentAssessments.length > 0 ? (
            recentAssessments.map((assessment) => {
              const progress = getAssessmentProgress(assessment);
              const grade = normalizeGrade(assessment);
              const typeLabel = assessment.type === 'task' 
                ? t('dashboard.quickAddMenu.newTask') 
                : t('subjects.note');
              const weightValue = parseWeight(assessment);
              const weightText = weightValue > 0 ? ` (${weightValue}%)` : '';

              let scoreText = t('subjects.pending');
              if (grade !== null) {
                scoreText = `${formatGrade(grade)} / ${SCALE_MAX}`;
              } else if (assessment.type === 'task') {
                scoreText = assessment.is_completed ? (t('common.done') || 'Completado') : t('subjects.pending');
              }

              return (
                <View key={`${assessment.id ?? assessment.name}-${assessment.date ?? 'no-date'}`} style={styles.insightRow}>
                  <View style={styles.insightTopRow}>
                    <View style={styles.insightTextBlock}>
                      <Text style={styles.insightTitle} numberOfLines={1}>{assessment.name}</Text>
                      <Text style={styles.insightMeta} numberOfLines={1}>
                        {typeLabel}{weightText}{assessment.date ? ` · ${assessment.date}` : ''}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <Text style={styles.insightScore}>{scoreText}</Text>
                      {assessment.id && (
                        <TouchableOpacity 
                          onPress={() => handleShowMenu(assessment)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="ellipsis-vertical" size={20} color={theme.colors.text.secondary} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                  <ProgressBar value={progress} color={progress >= 80 ? '#34C759' : progress >= 60 ? '#FF9500' : '#FF3B30'} />
                </View>
              );
            })
          ) : (
            <View style={styles.emptyStateCard}>
              <Ionicons name="stats-chart-outline" size={24} color={theme.colors.text.secondary} />
              <Text style={styles.emptyStateTitle}>{t('analytics.emptyInsightsTitle')}</Text>
              <Text style={styles.emptyStateText}>{t('analytics.emptyInsightsText')}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Android Menu Modal */}
      {Platform.OS === 'android' && (
        <Modal
          visible={isMenuModalVisible}
          animationType="fade"
          transparent
          onRequestClose={() => setIsMenuModalVisible(false)}
        >
          <Pressable 
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }}
            onPress={() => setIsMenuModalVisible(false)}
          >
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Pressable 
                style={{
                  backgroundColor: theme.colors.background,
                  borderRadius: 12,
                  overflow: 'hidden',
                  minWidth: 200,
                }}
                onPress={() => null}
              >
                {selectedAssessment?.type === 'task' && !selectedAssessment?.is_completed && (
                  <TouchableOpacity
                    style={{
                      paddingVertical: 14,
                      paddingHorizontal: 16,
                      borderBottomWidth: 1,
                      borderBottomColor: theme.colors.border,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                    }}
                    onPress={() => {
                      setIsMenuModalVisible(false);
                      setIsCompleteTaskModalVisible(true);
                    }}
                  >
                    <Ionicons name="checkmark-circle" size={18} color={theme.colors.primary} />
                    <Text style={{ color: theme.colors.primary, fontSize: 14, fontWeight: '500' }}>
                      {t('tasks.markDelivered', 'Marcar como entregada')}
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={{
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    borderBottomWidth: selectedAssessment?.type === 'task' && !selectedAssessment?.is_completed ? 1 : 0,
                    borderBottomColor: theme.colors.border,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                  }}
                  onPress={() => {
                    setIsMenuModalVisible(false);
                    const isIncompleteTask = selectedAssessment?.type === 'task' && !selectedAssessment?.is_completed;
                    if (isIncompleteTask) {
                      setIsEditTaskModalVisible(true);
                    } else {
                      setIsEditGradeModalVisible(true);
                    }
                  }}
                >
                  <Ionicons name="pencil" size={18} color={theme.colors.primary} />
                  <Text style={{ color: theme.colors.primary, fontSize: 14, fontWeight: '500' }}>
                    {t('assessments.edit', 'Editar')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ 
                    paddingVertical: 14, 
                    paddingHorizontal: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                  }}
                  onPress={() => {
                    setIsMenuModalVisible(false);
                    if (selectedAssessment?.id) {
                      handleDelete(selectedAssessment.id);
                    }
                  }}
                >
                  <Ionicons name="trash" size={18} color="#FF3B30" />
                  <Text style={{ color: '#FF3B30', fontSize: 14, fontWeight: '500' }}>
                    {t('common.delete', 'Eliminar')}
                  </Text>
                </TouchableOpacity>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      )}

      {/* Edit Grade Modal */}
      <EditGradeModal
        visible={isEditGradeModalVisible}
        onClose={() => {
          setIsEditGradeModalVisible(false);
          setSelectedAssessment(null);
        }}
        assessment={selectedAssessment}
        subjects={subjects}
      />

      {/* Edit Task Modal */}
      <EditTaskModal
        visible={isEditTaskModalVisible}
        onClose={() => {
          setIsEditTaskModalVisible(false);
          setSelectedAssessment(null);
        }}
        task={selectedAssessment}
        subjects={subjects}
      />

      {/* Complete Task Modal */}
      <CompleteTaskModal
        visible={isCompleteTaskModalVisible}
        onClose={() => {
          setIsCompleteTaskModalVisible(false);
          setSelectedAssessment(null);
        }}
        task={selectedAssessment}
      />
    </>
  );
};

const insightStyles = StyleSheet.create({
  categoriesChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: theme.colors.card,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  categoriesChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.text.secondary,
  },
  addBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.inputBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
