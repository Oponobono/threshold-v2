import React from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, TouchableWithoutFeedback, StyleSheet } from 'react-native';
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
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center' }}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
        </TouchableWithoutFeedback>
        
        <View style={[styles.bottomSheetModalContent, { maxHeight: '85%', width: '100%', maxWidth: 600 }]}>
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="help-circle-outline" size={24} color={theme.colors.primary} />
              <Text style={styles.modalTitle}>{t('about.faq')}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color={theme.colors.text.primary} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={[styles.modalBody, { marginTop: 10 }]} showsVerticalScrollIndicator={false}>
            {Array.from({ length: FAQ_COUNT }, (_, i) => (
              <View key={i} style={{ marginBottom: 24 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: theme.colors.text.primary, marginBottom: 6 }}>
                  {t(`settings.faq.${i}.question`)}
                </Text>
                <Text style={{ fontSize: 14, color: theme.colors.text.secondary, lineHeight: 22 }}>
                  {t(`settings.faq.${i}.answer`)}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};
