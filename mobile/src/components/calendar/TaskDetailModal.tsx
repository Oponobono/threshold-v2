import React from 'react';
import { View, Text, TouchableOpacity, Modal, Animated, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../styles/theme';
import { modalStyles } from '../../styles/CalendarModals.styles';
import { useSlideAnimation } from '../../hooks/useSlideAnimation';

interface TaskDetailModalProps {
  visible: boolean;
  onClose: () => void;
  task: any;
  t: any;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ visible, onClose, task, t }) => {
  const slideAnim = useSlideAnimation(visible, 600);
  const insets = useSafeAreaInsets();

  if (!task) return null;

  const allTasks = task.allAssessments || [task.assessmentData];

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
                {allTasks.length === 1 ? t('calendar.taskDetail') : `${allTasks.length} ${t('calendar.tasks')}`}
              </Text>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={24} color={theme.colors.text.primary} />
              </TouchableOpacity>
            </View>

            <View style={modalStyles.tasksList}>
              {allTasks.map((assessment: any, index: number) => (
                <View key={assessment.id || index} style={[
                  modalStyles.taskItem,
                  index < allTasks.length - 1 && modalStyles.taskItemBorder
                ]}>
                  <View style={modalStyles.taskHeader}>
                    <View style={[
                      modalStyles.taskColorDot,
                      { backgroundColor: assessment.subject_color || theme.colors.primary }
                    ]} />
                    <Text style={modalStyles.taskName} numberOfLines={2}>{assessment.name}</Text>
                  </View>

                  <View style={modalStyles.taskDetails}>
                    {assessment.type && (
                      <View style={modalStyles.detailRow}>
                        <Ionicons name="bookmark-outline" size={16} color={theme.colors.text.secondary} />
                        <Text style={modalStyles.detailText}>{assessment.type}</Text>
                      </View>
                    )}
                    {assessment.date && (
                      <View style={modalStyles.detailRow}>
                        <Ionicons name="calendar-outline" size={16} color={theme.colors.text.secondary} />
                        <Text style={modalStyles.detailText}>{assessment.date}</Text>
                      </View>
                    )}
                    {assessment.time && (
                      <View style={modalStyles.detailRow}>
                        <Ionicons name="time-outline" size={16} color={theme.colors.text.secondary} />
                        <Text style={modalStyles.detailText}>{assessment.time}</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}
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
