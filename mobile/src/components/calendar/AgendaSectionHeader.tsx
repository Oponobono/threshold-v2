import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';

interface AgendaSectionHeaderProps {
  title: string;
  count?: number;
  collapsible?: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
}

export const AgendaSectionHeader: React.FC<AgendaSectionHeaderProps> = ({
  title,
  count,
  collapsible,
  isExpanded,
  onToggle
}) => {
  return (
    <TouchableOpacity
      disabled={!collapsible}
      onPress={onToggle}
      activeOpacity={0.7}
      style={styles.container}
      accessibilityRole={collapsible ? 'button' : 'header'}
      accessibilityState={collapsible ? { expanded: isExpanded } : undefined}
      accessibilityLabel={`${title}, ${count || 0} eventos${collapsible ? (isExpanded ? ', expandido' : ', colapsado') : ''}`}
    >
      <View style={styles.left}>
        {collapsible && (
          <Ionicons 
            name={isExpanded ? "chevron-down" : "chevron-forward"} 
            size={16} 
            color={theme.colors.text.secondary} 
            style={styles.icon}
          />
        )}
        <Text style={styles.title}>{title}</Text>
        {count !== undefined && (
          <Text style={styles.count}> · {count}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    backgroundColor: 'transparent',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 6,
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  count: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text.secondary,
  }
});
