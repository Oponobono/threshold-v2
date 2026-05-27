import React from 'react';
import { View, Text } from 'react-native';
import { aboutFeaturesStyles as styles } from '../../styles/AboutFeatures.styles';
import { F } from './Formula';

interface FormulaCardProps {
  title: string;
  formula: React.ReactNode;
}

export const FormulaCard: React.FC<FormulaCardProps> = ({ title, formula }) => (
  <View style={styles.formulaCard}>
    <Text style={styles.formulaTitle}>{title}</Text>
    <F>{formula}</F>
  </View>
);
