import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedClockIcon, AnimatedTaskIcon } from './UpNextAnimatedIcon';
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
  const tint = accent ?? color;

  return (
    <TouchableOpacity style={styles.upNextCard} activeOpacity={0.7} onPress={onPress}>
      <View style={styles.upNextHeader}>
        <View style={styles.upNextHeaderCol}>
          <Text style={styles.upNextHeaderLine1} numberOfLines={1}>
            {`${title}:`}
          </Text>
          <Text style={[styles.upNextHeaderLine2, { color: tint }]} numberOfLines={1}>
            {context}
          </Text>
        </View>
        <View style={[styles.upNextIcon, { backgroundColor: tint + '15' }]}>
          {icon === 'time-outline' ? (
            <AnimatedClockIcon color={tint} size={18} live={!!accent} />
          ) : icon === 'document-text-outline' ? (
            <AnimatedTaskIcon color={tint} size={18} />
          ) : (
            <Ionicons name={icon} size={18} color={tint} />
          )}
        </View>
      </View>
      <View style={styles.upNextValueSlot}>
        <Text style={styles.upNextValue} numberOfLines={2}>
          {value}
        </Text>
      </View>
      <View style={styles.upNextFooterSlot}>
        <Text style={styles.upNextFooter} numberOfLines={1}>
          {footer}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
