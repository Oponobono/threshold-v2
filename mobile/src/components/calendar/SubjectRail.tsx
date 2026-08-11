import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { CalendarScope } from '../../types/calendar';

if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

export interface ActiveSubject {
  id: string;
  name: string;
  color?: string;
  count: number;
}

interface SubjectRailProps {
  activeSubjects: ActiveSubject[];
  generalEventsCount: number;
  scope: CalendarScope;
  onSelectScope: (scope: CalendarScope) => void;
  isExpanded: boolean;
  onToggle: () => void;
}

export const SubjectRail: React.FC<SubjectRailProps> = ({
  activeSubjects,
  generalEventsCount,
  scope,
  onSelectScope,
  isExpanded,
  onToggle,
}) => {
  const toggleRail = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onToggle();
  };

  const renderItem = (
    label: string, 
    color: string | undefined, 
    count: number, 
    isSelected: boolean, 
    onPress: () => void,
    icon?: string
  ) => {
    return (
      <TouchableOpacity 
        style={[
          styles.itemContainer, 
          isSelected && styles.itemSelected,
          !isExpanded && styles.itemContainerCollapsed
        ]} 
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={styles.indicatorContainer}>
          {icon ? (
            <Ionicons name={icon as any} size={16} color={isSelected ? theme.colors.primary : theme.colors.text.secondary} />
          ) : (
            <View style={[styles.colorDot, { backgroundColor: color || theme.colors.text.secondary }]} />
          )}
        </View>

        {isExpanded && (
          <View style={styles.expandedContent}>
            <Text 
              style={[
                styles.itemLabel, 
                isSelected && styles.itemLabelSelected
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>
            {count > 0 && (
              <Text style={[styles.itemCount, isSelected && styles.itemCountSelected]}>
                {count}
              </Text>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const getSelectedSubjectName = () => {
    if (scope.kind === 'subject') {
      const subj = activeSubjects.find(s => s.id === scope.subjectId);
      return subj ? subj.name : '';
    }
    if (scope.kind === 'general') {
      return 'General';
    }
    return '';
  };

  const selectedName = getSelectedSubjectName();

  return (
    <View style={[styles.container, isExpanded ? styles.containerExpanded : styles.containerCollapsed]}>
      {/* Top Header & Toggle */}
      <View style={[styles.header, !isExpanded && styles.headerCollapsed]}>
        {!isExpanded && selectedName ? (
          <View style={styles.collapsedHeaderContent}>
            <Text style={styles.collapsedHeaderText} numberOfLines={1}>{selectedName}</Text>
          </View>
        ) : null}
        
        <TouchableOpacity style={styles.toggleButton} onPress={toggleRail} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name={isExpanded ? 'chevron-back' : 'chevron-forward'} size={20} color={theme.colors.text.secondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.itemsWrapper}>
        {renderItem(
          'Todas', 
          undefined, 
          0, // count not needed for Todas
          scope.kind === 'all', 
          () => onSelectScope({ kind: 'all' }),
          'calendar-outline'
        )}

        <View style={styles.divider} />

        {activeSubjects.map(subject => (
          <React.Fragment key={subject.id}>
            {renderItem(
              subject.name,
              subject.color,
              subject.count,
              scope.kind === 'subject' && scope.subjectId === subject.id,
              () => onSelectScope({ kind: 'subject', subjectId: subject.id })
            )}
          </React.Fragment>
        ))}

        {generalEventsCount > 0 && (
          <>
            <View style={styles.divider} />
            {renderItem(
              'General',
              theme.colors.text.placeholder,
              generalEventsCount,
              scope.kind === 'general',
              () => onSelectScope({ kind: 'general' }),
              'layers-outline'
            )}
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.background,
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
    paddingVertical: theme.spacing.sm,
  },
  containerExpanded: {
    width: 170,
  },
  containerCollapsed: {
    width: 55,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
    minHeight: 32,
  },
  headerCollapsed: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  collapsedHeaderContent: {
    transform: [{ rotate: '-90deg' }],
    width: 120,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: 80,
  },
  collapsedHeaderText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  toggleButton: {
    padding: 4,
  },
  itemsWrapper: {
    flex: 1,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: theme.spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  itemContainerCollapsed: {
    paddingHorizontal: 0,
    justifyContent: 'center',
  },
  itemSelected: {
    borderLeftColor: theme.colors.primary,
  },
  indicatorContainer: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  expandedContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginLeft: theme.spacing.sm,
  },
  itemLabel: {
    fontSize: 13,
    color: theme.colors.text.primary,
    flex: 1,
  },
  itemLabelSelected: {
    fontWeight: '700',
  },
  itemCount: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.text.secondary,
    marginLeft: 8,
  },
  itemCountSelected: {
    color: theme.colors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 4,
    marginHorizontal: theme.spacing.md,
  }
});
