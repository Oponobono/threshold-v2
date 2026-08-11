import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

const MAX_VISIBLE_CHIPS = 5;

export const SubjectFilterBar: React.FC<SubjectFilterBarProps> = ({
  scope,
  onScopeChange,
  activeSubjects,
  hasGeneralEvents,
  totalCount
}) => {
  const [modalVisible, setModalVisible] = useState(false);

  const renderChip = (
    label: string, 
    color: string, 
    count: number, 
    isSelected: boolean, 
    onPress: () => void,
    isGeneral = false
  ) => {
    return (
      <TouchableOpacity
        key={label}
        style={[styles.chip, isSelected && styles.chipSelected]}
        onPress={onPress}
        accessibilityRole="tab"
        accessibilityState={{ selected: isSelected }}
        accessibilityLabel={`${label}, ${count} eventos`}
        activeOpacity={0.7}
      >
        {!isSelected ? (
          isGeneral ? (
            <Ionicons name="layers-outline" size={14} color={color} style={styles.icon} />
          ) : (
            <View style={[styles.dot, { backgroundColor: color }]} />
          )
        ) : (
          <Ionicons name="checkmark" size={14} color={theme.colors.background} style={styles.icon} />
        )}
        <Text style={[styles.chipLabel, isSelected && styles.chipLabelSelected]} numberOfLines={1}>
          {label}
        </Text>
        {count > 0 && (
          <View style={[styles.badge, isSelected && styles.badgeSelected]}>
            <Text style={[styles.badgeText, isSelected && styles.badgeTextSelected]}>
              {count}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderOverflowChip = (extraCount: number) => {
    return (
      <TouchableOpacity
        key="overflow"
        style={styles.chip}
        onPress={() => setModalVisible(true)}
        accessibilityRole="button"
        accessibilityLabel={`Ver ${extraCount} materias más`}
        activeOpacity={0.7}
      >
        <Text style={styles.chipLabel}>+{extraCount} más</Text>
      </TouchableOpacity>
    );
  };

  const isAllSelected = scope.kind === 'all';
  const isGeneralSelected = scope.kind === 'general';
  
  // Decide which chips to show
  // If the selected subject is in the hidden portion, we should swap it to be visible or auto-scroll.
  // For simplicity, we just show the first N and let the modal handle the rest.
  const visibleSubjects = activeSubjects.slice(0, MAX_VISIBLE_CHIPS);
  const extraCount = activeSubjects.length > MAX_VISIBLE_CHIPS ? activeSubjects.length - MAX_VISIBLE_CHIPS : 0;

  return (
    <View style={styles.container}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        decelerationRate="fast"
      >
        {renderChip(
          'Todas',
          theme.colors.text.secondary,
          totalCount,
          isAllSelected,
          () => onScopeChange({ kind: 'all' }),
          true 
        )}

        {visibleSubjects.map(subj => 
          renderChip(
            subj.name,
            subj.color,
            subj.count,
            scope.kind === 'subject' && scope.subjectId === subj.id,
            () => onScopeChange({ kind: 'subject', subjectId: subj.id })
          )
        )}

        {extraCount > 0 && renderOverflowChip(extraCount)}

        {hasGeneralEvents && renderChip(
          'General',
          theme.colors.text.placeholder,
          0, // We'll compute this correctly in the future if needed, or hide badge
          isGeneralSelected,
          () => onScopeChange({ kind: 'general' }),
          true
        )}
      </ScrollView>

      {/* Overflow Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent={true} onRequestClose={() => setModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filtrar por materia</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.colors.text.primary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList}>
              {activeSubjects.map(subj => {
                const isSelected = scope.kind === 'subject' && scope.subjectId === subj.id;
                return (
                  <TouchableOpacity
                    key={subj.id}
                    style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                    onPress={() => {
                      onScopeChange({ kind: 'subject', subjectId: subj.id });
                      setModalVisible(false);
                    }}
                  >
                    <View style={[styles.dot, { backgroundColor: subj.color, marginRight: 12 }]} />
                    <Text style={[styles.modalItemLabel, isSelected && styles.modalItemLabelSelected]}>{subj.name}</Text>
                    <Text style={styles.modalItemCount}>{subj.count}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 40,
  },
  chipSelected: {
    backgroundColor: theme.colors.text.primary,
    borderColor: theme.colors.text.primary,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  icon: {
    marginRight: 6,
  },
  chipLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text.primary,
  },
  chipLabelSelected: {
    color: theme.colors.background,
    fontWeight: '700',
  },
  badge: {
    marginLeft: 6,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeSelected: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text.secondary,
  },
  badgeTextSelected: {
    color: theme.colors.background,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  modalList: {
    padding: 16,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  modalItemSelected: {
    backgroundColor: theme.colors.primaryTransparent.light,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginHorizontal: -12,
    borderBottomWidth: 0,
  },
  modalItemLabel: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.text.primary,
  },
  modalItemLabelSelected: {
    fontWeight: '700',
    color: theme.colors.primary,
  },
  modalItemCount: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    fontWeight: '600',
  }
});
