import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { AssessmentCategory } from '../../services/api/assessmentCategories';
import { theme } from '../../styles/theme';
import { categoriesStyles as styles } from '../../styles/Categories.styles';
import { accentForIndex } from '../../hooks/useCategories';

interface CategoryCardProps {
  category: AssessmentCategory;
  index: number;
  onEdit: (cat: AssessmentCategory) => void;
  onDelete: (cat: AssessmentCategory) => void;
}

export const CategoryCard: React.FC<CategoryCardProps> = ({ category, index, onEdit, onDelete }) => {
  const { t } = useTranslation();
  const accent = accentForIndex(index);
  const dropCount = category.drop_lowest ?? 0;

  return (
    <View style={styles.card}>
      <View style={[styles.cardAccent, { backgroundColor: accent }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardTopRow}>
          <View style={styles.cardIconWrap}>
            <Ionicons name="layers-outline" size={18} color={accent} />
          </View>
          <Text style={styles.cardName} numberOfLines={1}>
            {category.name}
          </Text>
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={styles.cardAction}
              onPress={() => onEdit(category)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="pencil-outline" size={16} color={theme.colors.text.secondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cardAction}
              onPress={() => onDelete(category)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="trash-outline" size={16} color={theme.colors.text.secondary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.pillsRow}>
          {category.weight != null && (
            <View style={styles.pill}>
              <Ionicons name="speedometer-outline" size={11} color={theme.colors.text.secondary} />
              <Text style={styles.pillText}>{category.weight}% peso</Text>
            </View>
          )}

          {dropCount > 0 && (
            <View style={[styles.pill, styles.pillWarning]}>
              <Ionicons name="arrow-down-circle-outline" size={11} color={theme.colors.warning} />
              <Text style={[styles.pillText, { color: theme.colors.warning }]}>
                Elimina {dropCount} peor{dropCount > 1 ? 'es' : ''}
              </Text>
            </View>
          )}

          {dropCount === 0 && category.weight == null && (
            <View style={styles.pill}>
              <Ionicons name="checkmark-circle-outline" size={11} color={theme.colors.text.secondary} />
              <Text style={styles.pillText}>Sin reglas especiales</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};
