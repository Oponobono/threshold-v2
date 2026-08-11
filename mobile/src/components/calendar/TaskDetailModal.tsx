import React from 'react';
import { View, Text, TouchableOpacity, Modal, Animated, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../styles/theme';
import { modalStyles } from '../../styles/CalendarModals.styles';
import { useSlideAnimation } from '../../hooks/useSlideAnimation';
import { AgendaItem } from '../../types/calendar';

interface TaskDetailModalProps {
  visible: boolean;
  onClose: () => void;
  task: AgendaItem | null;
  t: any;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ visible, onClose, task, t }) => {
  const slideAnim = useSlideAnimation(visible, 600);
  const insets = useSafeAreaInsets();

  if (!task) return null;

  const isCompleted = task.status?.is_completed;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={modalStyles.overlay}
        activeOpacity={1}
        onPress={onClose}
      />
      <Animated.View
        style={[
          modalStyles.container,
          {
            transform: [{ translateY: slideAnim }],
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        <View style={modalStyles.content}>
          <ScrollView
            scrollEnabled={true}
            showsVerticalScrollIndicator={false}
          >
            <View style={modalStyles.header}>
              <Text style={modalStyles.title}>
                {t('calendar.taskDetail', 'Detalle')}
              </Text>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.inputBackground, alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="close" size={18} color={theme.colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
              <View 
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingVertical: 14,
                }}
              >
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <View style={{ 
                      width: 8, 
                      height: 8, 
                      borderRadius: 4, 
                      backgroundColor: task.subjectColor || theme.colors.primary,
                      marginRight: 8 
                    }} />
                    <Text 
                      style={{ fontSize: 16, fontWeight: '600', color: theme.colors.text.primary, flexShrink: 1 }} 
                    >
                      {task.title}
                    </Text>
                  </View>
                  
                  <Text style={{ fontSize: 13, color: theme.colors.text.secondary }}>
                    <Text style={{ fontWeight: '500' }}>{task.type || t('grades.eval', 'Evaluación')}</Text>
                    {task.weight ? ` • ${task.weight}%` : ''}
                  </Text>
                  
                  {task.subject && (
                    <Text style={{ fontSize: 13, color: theme.colors.text.secondary, marginTop: 4 }}>
                      {task.subject}
                    </Text>
                  )}
                </View>
                
                <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                  {!task.allDay && (
                    <Text style={{ fontSize: 13, fontWeight: '500', color: theme.colors.text.primary, marginBottom: 2 }}>
                      {task.time_label}
                    </Text>
                  )}
                  <Text style={{ fontSize: 12, color: isCompleted ? theme.colors.success : theme.colors.text.placeholder }}>
                    {isCompleted ? t('common.done', 'Completada') : t('subjects.pending', 'Pendiente')}
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>

          <TouchableOpacity
            style={modalStyles.closeButton}
            onPress={onClose}
          >
            <Text style={modalStyles.closeButtonText}>{t('common.close')}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
};
