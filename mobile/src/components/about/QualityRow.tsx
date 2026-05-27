import React from 'react';
import { View, Text } from 'react-native';
import { aboutFeaturesStyles as styles } from '../../styles/AboutFeatures.styles';

interface QualityRowProps {
  label: string;
  color: string;
}

export const QualityRow: React.FC<QualityRowProps> = ({ label, color }) => (
  <View style={styles.qualityRow}>
    <View style={[styles.qualityDot, { backgroundColor: color }]} />
    <Text style={styles.qualityLabel}>{label}</Text>
  </View>
);
