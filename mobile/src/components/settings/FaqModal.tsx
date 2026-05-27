import React from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { settingsStyles as styles } from '../../styles/Settings.styles';

const FAQ_COUNT = 5;

interface Props {
  visible: boolean;
  onClose: () => void;
}

export const FaqModal: React.FC<Props> = ({ visible, onClose }) => {
  const { t } = useTranslation();

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { maxHeight: '80%' }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('about.faq')}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.colors.text.primary} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody}>
            {Array.from({ length: FAQ_COUNT }, (_, i) => (
              <View key={i} style={{ marginBottom: 20 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.text.primary, marginBottom: 4 }}>{t(`settings.faq.${i}.question`)}</Text>
                <Text style={{ fontSize: 13, color: theme.colors.text.secondary, lineHeight: 20 }}>{t(`settings.faq.${i}.answer`)}</Text>
              </View>
            ))}
          </ScrollView>
          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.modalBtnPrimary} onPress={onClose}>
              <Text style={styles.modalBtnPrimaryText}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
