import React from 'react';
import { FlatList, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { theme } from '../../styles/theme';
import { CalendarScope } from '../../types/calendar';
import { ActiveSubject } from '../../hooks/useActiveSubjects';

interface SubjectFilterBarProps {
  scope: CalendarScope;
  onScopeChange: (scope: CalendarScope) => void;
  activeSubjects: ActiveSubject[];
  hasGeneralEvents: boolean;
  totalCount: number;
}

type FilterItem =
  | { kind: 'all' }
  | { kind: 'subject'; id: string; name: string; color: string }
  | { kind: 'general' };

export const SubjectFilterBar: React.FC<SubjectFilterBarProps> = ({
  scope,
  onScopeChange,
  activeSubjects,
  hasGeneralEvents,
}) => {
  const items: FilterItem[] = [
    { kind: 'all' },
    ...activeSubjects.map(s => ({ kind: 'subject' as const, id: s.id, name: s.name, color: s.color })),
    ...(hasGeneralEvents ? [{ kind: 'general' as const }] : []),
  ];

  const isSelected = (item: FilterItem): boolean => {
    if (item.kind === 'all') return scope.kind === 'all';
    if (item.kind === 'general') return scope.kind === 'general';
    return scope.kind === 'subject' && scope.subjectId === item.id;
  };

  const getActiveColor = (item: FilterItem): string => {
    if (item.kind === 'subject') return item.color || theme.colors.text.primary;
    return theme.colors.text.primary;
  };

  const getLabel = (item: FilterItem): string => {
    if (item.kind === 'all') return 'Todas';
    if (item.kind === 'general') return 'General';
    return item.name;
  };

  const handlePress = (item: FilterItem) => {
    if (item.kind === 'all') onScopeChange({ kind: 'all' });
    else if (item.kind === 'general') onScopeChange({ kind: 'general' });
    else onScopeChange({ kind: 'subject', subjectId: item.id });
  };

  return (
    <FlatList
      horizontal
      data={items}
      keyExtractor={(item, index) =>
        item.kind === 'subject' ? item.id : `${item.kind}-${index}`
      }
      showsHorizontalScrollIndicator={false}
      style={styles.list}
      contentContainerStyle={styles.content}
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      initialNumToRender={6}
      renderItem={({ item }) => {
        const active = isSelected(item);
        const activeColor = getActiveColor(item);
        return (
          <TouchableOpacity
            style={[
              styles.chip,
              active && { backgroundColor: activeColor, borderColor: activeColor },
            ]}
            onPress={() => handlePress(item)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            activeOpacity={0.7}
          >
            <Text
              style={[styles.chipText, active && styles.chipTextActive]}
              numberOfLines={1}
            >
              {getLabel(item)}
            </Text>
          </TouchableOpacity>
        );
      }}
    />
  );
};

const styles = StyleSheet.create({
  list: {
    maxHeight: 46,
    flexGrow: 0,
    minHeight: 46,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 6,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: 'transparent',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.colors.text.secondary,
    letterSpacing: -0.1,
  },
  chipTextActive: {
    fontWeight: '700',
    color: theme.colors.white,
  },
});
