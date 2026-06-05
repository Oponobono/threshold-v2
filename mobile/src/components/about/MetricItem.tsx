import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { aboutFeaturesStyles as styles } from '../../styles/AboutFeatures.styles';
import { F } from './Formula';

interface MetricItemProps {
  icon: string;
  color: string;
  label: string;
  formula: React.ReactNode;
}

export const MetricItem: React.FC<MetricItemProps> = ({ icon, color, label, formula }) => (
  <View style={styles.metricItem}>
    <Ionicons name={icon as React.ComponentProps<typeof Ionicons>['name']} size={16} color={color} style={styles.metricIcon} />
    <View style={styles.metricContent}>
      <Text style={styles.metricLabel}>{label}</Text>
      <F>{formula}</F>
    </View>
  </View>
);
