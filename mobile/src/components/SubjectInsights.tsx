import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Assessment, deleteAssessment } from '../services/api';
import { theme } from '../styles/theme';
import { useCustomAlert } from './CustomAlert';
import { subjectDetailStyles as styles } from '../styles/SubjectDetail.styles';
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
}

/**
 * SubjectInsights.tsx
 *
 * Sección de la pantalla de detalle de materia que muestra el historial reciente
 * de evaluaciones (notas, tareas, exámenes). Cada elemento incluye el nombre,
 * tipo, peso porcentual, fecha, calificación obtenida y una barra de progreso con
 * color semántico (verde/naranja/rojo) basado en el porcentaje de logro.
 * Permite eliminar evaluaciones individuales con confirmación.
 *
 * @param recentAssessments - Lista de evaluaciones de la materia para mostrar.
 * @param onDeleteAssessment - Callback opcional llamado con el ID al eliminar una evaluación.
 */
export const SubjectInsights: React.FC<SubjectInsightsProps> = ({ recentAssessments, onDeleteAssessment, onOpenCategories }) => {
  const { t } = useTranslation();
  const { showAlert } = useCustomAlert();

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
    <View style={styles.sectionBlock}>
      <View style={styles.sectionHeaderRow}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={styles.sectionTitle}>{t('analytics.insightsTitle')}</Text>
          <Text style={styles.sectionHint}>{t('analytics.insightsHint')}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {onOpenCategories && (
            <TouchableOpacity
              style={insightStyles.categoriesChip}
              onPress={onOpenCategories}
            >
              <Ionicons name="layers-outline" size={12} color={theme.colors.text.secondary} />
              <Text style={insightStyles.categoriesChipText}>{t('categories.chipLabel', 'Categorías')}</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.sectionChip}>{recentAssessments.length} {t('subjects.notes')}</Text>
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
                    {onDeleteAssessment && assessment.id && (
                      <TouchableOpacity 
                        onPress={() => handleDelete(assessment.id!)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="trash-outline" size={20} color={theme.colors.text.secondary} />
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
});
