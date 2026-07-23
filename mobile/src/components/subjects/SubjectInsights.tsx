import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable, ActionSheetIOS, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Assessment, deleteAssessment } from '../../services/api';
import { theme } from '../../styles/theme';
import { useCustomAlert } from '../ui/CustomAlert';
import { subjectDetailStyles as styles } from '../../styles/SubjectDetail.styles';
import { EditGradeModal } from '../dashboard/EditGradeModal';
import { EditTaskModal } from '../dashboard/EditTaskModal';
import { CompleteTaskModal } from '../dashboard/CompleteTaskModal';

import {
  getAssessmentProgress,
  normalizeGrade,
  parseWeight,
  formatGrade,
  SCALE_MAX,
} from '../../utils/grades';

interface SubjectInsightsProps {
  recentAssessments: Assessment[];
  onDeleteAssessment?: (id: string) => void;
  onOpenCategories?: () => void;
  onAddAssessment?: () => void;
  onAssessmentUpdated?: (assessment?: Assessment) => void;
  subjects: any[];
}

export const SubjectInsights: React.FC<SubjectInsightsProps> = ({ recentAssessments, onDeleteAssessment, onOpenCategories, onAddAssessment, onAssessmentUpdated, subjects }) => {
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
        ...(isIncompleteTask ? [t('tasks.markDelivered')] : []),
        t('assessments.edit'),
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
            if (buttonIndex === 1) {
              setIsCompleteTaskModalVisible(true);
            } else if (buttonIndex === 2) {
              setIsEditTaskModalVisible(true);
            } else if (buttonIndex === 3) {
              handleDelete(assessment.id!);
            }
          } else {
            if (buttonIndex === 1) {
              setIsEditGradeModalVisible(true);
            } else if (buttonIndex === 2) {
              handleDelete(assessment.id!);
            }
          }
        }
      );
    } else {
      setIsMenuModalVisible(true);
    }
  };

  const handleDelete = (id: string) => {
    showAlert({
      title: t('common.deleteItem'),
      message: t('assessments.deleteConfirm'),
      type: 'confirm',
      buttons: [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAssessment(id);
              onDeleteAssessment?.(id);
            } catch (e: any) {
              showAlert({ title: t('common.error'), message: t('common.errors.deleteFailed') + `${e.message || t('common.networkError')}`, type: 'error' });
            }
          }
        }
      ]
    });
  };

  const progressColor = (pct: number) => pct >= 80 ? theme.colors.success : pct >= 60 ? theme.colors.warning : theme.colors.danger;

  return (
    <>
      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>
              {t('analytics.insightsTitle')} {recentAssessments.length > 0 && `(${recentAssessments.length})`}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center', flexShrink: 0 }}>
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

        <View style={styles.insightsTableCard}>
          {recentAssessments.length > 0 ? (
            <ScrollView 
              style={{ maxHeight: 350 }} 
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={false}
            >
              {recentAssessments.map((assessment, index) => {
                const progress = getAssessmentProgress(assessment);
                const grade = normalizeGrade(assessment);
              const typeLabel = assessment.type === 'task'
                ? t('dashboard.quickAddMenu.newTask')
                : t('subjects.note');
              const weightValue = parseWeight(assessment);
              const weightText = weightValue > 0 ? `${weightValue}%` : '';
              const isPending = (assessment as any)._isPending === true;
              const isLast = index === recentAssessments.length - 1;

              const formattedDate = (() => {
                if (!assessment.date) return null;
                try {
                  const parts = assessment.date.split('-');
                  if (parts.length === 3) {
                    const year = parseInt(parts[0], 10);
                    const month = parseInt(parts[1], 10) - 1;
                    const day = parseInt(parts[2], 10);
                    const d = new Date(year, month, day);
                    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
                  }
                  return null;
                } catch {
                  return null;
                }
              })();

              let finalDisplayLabel = (assessment as any).display_label;
              let finalDisplayColor = (assessment as any).display_color;

              if (!finalDisplayLabel || /^\d+(\.\d+)?%?$/.test(finalDisplayLabel.trim())) {
                 if (progress >= 100) {
                    finalDisplayLabel = t('grades.perfect', 'Excelente');
                    finalDisplayColor = '#8B5CF6'; // Purple 500
                 } else if (progress >= 90) {
                    finalDisplayLabel = t('grades.excellent', 'Sobresaliente');
                    finalDisplayColor = '#10B981';
                 } else if (progress >= 75) {
                    finalDisplayLabel = t('grades.good', 'Bueno');
                    finalDisplayColor = '#3B82F6';
                 } else if (progress >= 60) {
                    finalDisplayLabel = t('grades.passing', 'Aprobado');
                    finalDisplayColor = '#F59E0B';
                 } else {
                    finalDisplayLabel = t('grades.failing', 'Reprobado');
                    finalDisplayColor = '#EF4444';
                 }
              }
              
              return (
                <View
                  key={`${assessment.id ?? assessment.name}-${assessment.date ?? 'no-date'}`}
                  style={[
                    styles.insightsAssessRow,
                    isLast && styles.insightsAssessRowLast,
                    isPending && styles.insightsAssessRowPending,
                  ]}
                >
                  {/* Left column: name, meta, progress bar */}
                  <View style={styles.insightsAssessInfo}>
                    <View style={styles.insightsAssessNameRow}>
                      <Text style={styles.insightsAssessName} numberOfLines={1}>{assessment.name}</Text>
                      {isPending && (
                        <View style={styles.assessPendingBadge}>
                          <Text style={styles.assessPendingText}>{t('common.syncing')}</Text>
                        </View>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                      <Text style={styles.insightsAssessMeta}>
                        {typeLabel}
                        {weightText ? ` · ${weightText}` : ''}
                      </Text>
                      {finalDisplayLabel ? (
                        <View style={{ 
                          backgroundColor: finalDisplayColor ? `${finalDisplayColor}15` : theme.colors.inputBackground,
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: 4,
                        }}>
                          <Text style={{
                            fontSize: 10,
                            fontWeight: '700',
                            color: finalDisplayColor || theme.colors.text.secondary,
                            textTransform: 'uppercase',
                            letterSpacing: 0.5
                          }}>
                            {finalDisplayLabel}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.insightsProgressRow}>
                      <View style={styles.insightsProgressTrack}>
                        <View
                          style={[
                            styles.insightsProgressFill,
                            {
                              width: `${Math.max(0, Math.min(100, progress))}%`,
                              backgroundColor: progressColor(progress),
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.insightsProgressPct}>{Math.round(progress)}%</Text>
                    </View>
                  </View>

                  {/* Right column: score (top) + date (bottom) + options button (top-right) */}
                  <View style={styles.insightsAssessRight}>
                    <View style={styles.insightsAssessScoreRow}>
                      {grade !== null ? (
                        <Text style={styles.insightsAssessScore}>
                          {formatGrade(grade)}<Text style={styles.insightsAssessScale}>/{SCALE_MAX}</Text>
                        </Text>
                      ) : (
                        <Text style={[styles.insightsAssessStatus, { color: assessment.type === 'task' && assessment.is_completed ? theme.colors.text.primary : theme.colors.text.secondary }]}>
                          {assessment.type === 'task'
                            ? (assessment.is_completed ? t('common.done') : t('subjects.pending'))
                            : t('subjects.pending')}
                        </Text>
                      )}
                      {assessment.id && (
                        <TouchableOpacity
                          onPress={() => handleShowMenu(assessment)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          style={{ marginLeft: 6 }}
                        >
                          <Ionicons name="ellipsis-vertical" size={16} color={theme.colors.text.secondary} />
                        </TouchableOpacity>
                      )}
                    </View>
                    {formattedDate && (
                      <Text style={styles.assessDateDiscreet}>{formattedDate}</Text>
                    )}
                  </View>
                </View>
              );
            })}
            </ScrollView>
          ) : (
            <View style={styles.insightsEmptyTable}>
              <Ionicons name="stats-chart-outline" size={24} color={theme.colors.text.secondary} style={{ opacity: 0.5, marginBottom: 8 }} />
              <Text style={{ color: theme.colors.text.secondary, fontSize: 13 }}>{t('analytics.emptyInsightsTitle')}</Text>
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
                      {t('tasks.markDelivered')}
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
                    {t('assessments.edit')}
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
                    {t('common.delete')}
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
          console.log('[SubjectInsights] 🔄 Cerrando EditGradeModal');
          setIsEditGradeModalVisible(false);
          setSelectedAssessment(null);
        }}
        assessment={selectedAssessment}
        subjects={subjects}
        onAssessmentSaved={(updatedAssessment) => {
          console.log('[SubjectInsights] 📥 onAssessmentSaved recibido:', {
            id: updatedAssessment?.id,
            grade_value: updatedAssessment?.grade_value,
            normalized_value: updatedAssessment?.normalized_value,
            is_completed: updatedAssessment?.is_completed,
            name: updatedAssessment?.name,
          });
          console.log('[SubjectInsights] 🔄 Propagando a parent via onAssessmentUpdated');
          onAssessmentUpdated?.(updatedAssessment);
        }}
      />

      {/* Edit Task Modal */}
      <EditTaskModal
        visible={isEditTaskModalVisible}
        onClose={() => {
          setIsEditTaskModalVisible(false);
          setSelectedAssessment(null);
          onAssessmentUpdated?.();
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
          onAssessmentUpdated?.();
        }}
        task={selectedAssessment}
      />
    </>
  );
};

