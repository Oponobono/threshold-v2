import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AutoScrollText } from '../ui/AutoScrollText';
import { dashboardStyles as styles } from '../../styles/Dashboard.styles';

interface UpNextCardProps {
  title: string;
  context: string;
  value: string;
  footer: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  accent?: string;
  onPress?: () => void;
}

export function UpNextCard({
  title,
  context,
  value,
  footer,
  icon,
  color,
  accent,
  onPress,
}: UpNextCardProps) {
  return (
    <TouchableOpacity style={styles.upNextCard} activeOpacity={0.7} onPress={onPress}>
      <View style={styles.upNextHeader}>
        <View style={styles.upNextHeaderCol}>
          <Text style={styles.upNextHeaderLine1} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.upNextHeaderLine2} numberOfLines={1}>
            {context}
          </Text>
        </View>
        <View style={[styles.upNextIcon, { backgroundColor: (accent ?? color) + '20', borderColor: (accent ?? color) + '40' }]}>
          <Ionicons name={icon} size={18} color={accent ?? color} />
        </View>
      </View>
      <View style={styles.upNextValueSlot}>
        <AutoScrollText text={value} style={styles.upNextValue} lineHeight={20} autoplay pointerEvents="none" />
      </View>
      <View style={styles.upNextFooterSlot}>
        <AutoScrollText text={footer} style={styles.upNextFooter} lineHeight={16} autoplay pointerEvents="none" />
      </View>
    </TouchableOpacity>
  );
}
