import React from 'react';
import { Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { dashboardStyles as styles } from '../../styles/Dashboard.styles';

interface Props {
  visible: boolean;
  onClose: () => void;
  onAddGrade: () => void;
  onAddTask: () => void;
  onTakePhoto: () => void;
}

export const QuickAddMenuModal = React.memo(({ visible, onClose, onAddGrade, onAddTask, onTakePhoto }: Props) => {
  const { t } = useTranslation();

  if (!visible) return null;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.sheetContent} onPress={() => null}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{t('dashboard.quickAddMenu.title')}</Text>
          <Text style={styles.sheetSubtitle}>{t('dashboard.quickAddDesc')}</Text>

          <View style={styles.quickAddMenuContainer}>
            <TouchableOpacity style={styles.quickAddMenuItem} onPress={onAddGrade}>
              <View style={styles.quickAddMenuIcon}>
                <MaterialCommunityIcons name="calculator" size={24} color={theme.colors.primary} />
              </View>
              <View style={styles.quickAddMenuInfo}>
                <Text style={styles.quickAddMenuText}>{t('dashboard.quickAddMenu.registerGrade')}</Text>
                <Text style={styles.quickAddMenuSubtext}>{t('dashboard.quickAddMenu.registerGradeSubtext')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.text.placeholder} style={styles.quickAddMenuChevron} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickAddMenuItem} onPress={onAddTask}>
              <View style={styles.quickAddMenuIcon}>
                <MaterialCommunityIcons name="clipboard-text-outline" size={24} color="#34C759" />
              </View>
              <View style={styles.quickAddMenuInfo}>
                <Text style={styles.quickAddMenuText}>{t('dashboard.quickAddMenu.newTask')}</Text>
                <Text style={styles.quickAddMenuSubtext}>{t('dashboard.quickAddMenu.newTaskSubtext')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.text.placeholder} style={styles.quickAddMenuChevron} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickAddMenuItem} onPress={onTakePhoto}>
              <View style={styles.quickAddMenuIcon}>
                <MaterialCommunityIcons name="camera-outline" size={24} color="#FF9500" />
              </View>
              <View style={styles.quickAddMenuInfo}>
                <Text style={styles.quickAddMenuText}>{t('dashboard.quickAddMenu.takePhotoLabel')}</Text>
                <Text style={styles.quickAddMenuSubtext}>{t('dashboard.quickAddMenu.takePhotoSubtext')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.text.placeholder} style={styles.quickAddMenuChevron} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={[styles.sheetCancelBtn, { marginTop: 20 }]} onPress={onClose}>
            <Text style={styles.sheetCancelText}>{t('dashboard.newSubject.cancel')}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
});
QuickAddMenuModal.displayName = 'QuickAddMenuModal';
