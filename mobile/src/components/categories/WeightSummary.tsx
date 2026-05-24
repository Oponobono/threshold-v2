import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AssessmentCategory } from '../../services/api/assessmentCategories';
import { theme } from '../../styles/theme';
import { categoriesStyles as styles } from '../../styles/Categories.styles';

interface WeightSummaryProps {
  categories: AssessmentCategory[];
}

export const WeightSummary: React.FC<WeightSummaryProps> = ({ categories }) => {
  const weightedCats = categories.filter(c => c.weight != null);
  const total = weightedCats.reduce((sum, c) => sum + (c.weight ?? 0), 0);
  const isBalanced = Math.abs(total - 100) < 0.01;

  return (
    <View style={[styles.summaryCard, isBalanced ? styles.summaryOk : styles.summaryWarn]}>
      <Ionicons
        name={isBalanced ? 'checkmark-circle' : 'alert-circle'}
        size={16}
        color={isBalanced ? theme.colors.success : theme.colors.warning}
      />
      <View style={{ flex: 1 }}>
        <Text style={styles.summaryText}>
          {isBalanced
            ? `Pesos balanceados · ${total}% total`
            : `Pesos suman ${total.toFixed(0)}% · Se esperan 100%`}
        </Text>
      </View>
    </View>
  );
};
