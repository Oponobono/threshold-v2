import React from 'react';
import { View, Text, TouchableOpacity, Modal, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../styles/theme';
import { menuStyles } from '../../styles/AddEventMenu.styles';
import { useSlideAnimation } from '../../hooks/useSlideAnimation';

interface AddEventMenuProps {
  visible: boolean;
  onClose: () => void;
  onAddEvent: () => void;
  onAddTask: () => void;
  t: any;
}

export const AddEventMenu: React.FC<AddEventMenuProps> = ({ visible, onClose, onAddEvent, onAddTask, t }) => {
  const slideAnim = useSlideAnimation(visible, 600);
  const insets = useSafeAreaInsets();

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={menuStyles.overlay}
        activeOpacity={1}
        onPress={onClose}
      />
      <Animated.View
        style={[
          menuStyles.container,
          {
            transform: [{ translateY: slideAnim }],
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        <View style={menuStyles.content}>
          <View style={menuStyles.header}>
            <Text style={menuStyles.title}>{t('calendar.addWhat')}</Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={24} color={theme.colors.text.primary} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={menuStyles.menuItem} onPress={onAddEvent}>
            <View style={menuStyles.menuItemIcon}>
              <Ionicons name="calendar-outline" size={24} color={theme.colors.primary} />
            </View>
            <View style={menuStyles.menuItemInfo}>
              <Text style={menuStyles.menuItemTitle}>{t('calendar.newEvent')}</Text>
              <Text style={menuStyles.menuItemSubtitle}>{t('calendar.createPersonalEvent')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.text.secondary} />
          </TouchableOpacity>

          <TouchableOpacity style={menuStyles.menuItem} onPress={onAddTask}>
            <View style={menuStyles.menuItemIcon}>
              <Ionicons name="checkbox-outline" size={24} color="#34C759" />
            </View>
            <View style={menuStyles.menuItemInfo}>
              <Text style={menuStyles.menuItemTitle}>{t('calendar.newTask')}</Text>
              <Text style={menuStyles.menuItemSubtitle}>{t('calendar.createTaskEvaluation')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.text.secondary} />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
};
