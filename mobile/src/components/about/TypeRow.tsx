import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { aboutFeaturesStyles as styles } from '../../styles/AboutFeatures.styles';

interface TypeRowProps {
  icon: string;
  color: string;
  label: string;
}

export const TypeRow: React.FC<TypeRowProps> = ({ icon, color, label }) => (
  <View style={styles.typeRow}>
    <Ionicons name={icon as any} size={16} color={color} style={styles.typeIcon} />
    <Text style={styles.typeLabel}>{label}</Text>
  </View>
);
