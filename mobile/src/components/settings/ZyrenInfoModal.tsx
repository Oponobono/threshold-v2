import React from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { settingsStyles as styles } from '../../styles/Settings.styles';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const SPACING = { marginBottom: 24 };

const sectionTitle = {
  fontSize: 17,
  fontWeight: '800' as const,
  color: theme.colors.text.primary,
  marginBottom: 8,
  marginTop: 4,
};

const bodyText = {
  fontSize: 13,
  color: theme.colors.text.secondary,
  lineHeight: 20,
};

const iconRow = {
  flexDirection: 'row' as const,
  alignItems: 'flex-start' as const,
  gap: 8,
  marginBottom: 4,
};

const divider = {
  height: 1,
  backgroundColor: theme.colors.border + '60',
  marginVertical: 16,
};

const capabilities = [
  { icon: 'chatbubbles-outline' as const, key: 'capability.chat' },
  { icon: 'cards-outline' as const, key: 'capability.flashcards' },
  { icon: 'document-text-outline' as const, key: 'capability.documents' },
  { icon: 'microphone-outline' as const, key: 'capability.transcription' },
  { icon: 'logo-youtube' as const, key: 'capability.youtube' },
  { icon: 'image-outline' as const, key: 'capability.vision' },
  { icon: 'document-text-outline' as const, key: 'capability.summaries' },
  { icon: 'flash-outline' as const, key: 'capability.intentDetection' },
  { icon: 'hardware-chip-outline' as const, key: 'capability.dualModel' },
];

export const ZyrenInfoModal: React.FC<Props> = ({ visible, onClose }) => {
  const { t } = useTranslation();

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { maxHeight: '85%' }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Zyren</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.colors.text.primary} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.primary, marginBottom: 12, lineHeight: 22 }}>
              {t('settings.zyren.cognitiveCore')}
            </Text>

            <Text style={[bodyText, { marginBottom: 12 }]}>{t('settings.zyren.desc1')}</Text>
            <Text style={[bodyText, { marginBottom: 12 }]}>{t('settings.zyren.desc2')}</Text>

            <View style={divider} />

            <View style={SPACING}>
              <Text style={sectionTitle}>{t('settings.zyren.nameOrigin')}</Text>
              <Text style={[bodyText, { marginBottom: 8 }]}>{t('settings.zyren.nameOrigin1')}</Text>
              <Text style={[bodyText, { marginBottom: 8 }]}>{t('settings.zyren.nameOrigin2')}</Text>
              <Text style={[bodyText, { marginBottom: 8 }]}>{t('settings.zyren.nameOrigin3')}</Text>
              <Text style={[bodyText, { marginBottom: 8 }]}>{t('settings.zyren.nameOrigin4')}</Text>
            </View>

            <View style={SPACING}>
              <Text style={sectionTitle}>{t('settings.zyren.capabilities')}</Text>
              <View style={{ marginTop: 4 }}>
                {capabilities.map((cap, k) => (
                  <View key={k} style={iconRow}>
                    <Ionicons name={cap.icon as React.ComponentProps<typeof Ionicons>['name']} size={16} color={theme.colors.primary} style={{ marginTop: 2, flexShrink: 0 }} />
                    <Text style={[bodyText, { flex: 1 }]}>{t(`settings.zyren.${cap.key}`)}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={SPACING}>
              <Text style={sectionTitle}>{t('settings.zyren.relationshipTitle')}</Text>
              <Text style={[bodyText, { marginBottom: 8 }]}>{t('settings.zyren.rel1')}</Text>
              <Text style={[bodyText, { marginBottom: 8 }]}>{t('settings.zyren.rel2')}</Text>
              <Text style={[bodyText, { marginBottom: 8 }]}>{t('settings.zyren.rel3')}</Text>
            </View>

            <View style={divider} />

            <Text style={[bodyText, { fontStyle: 'italic', textAlign: 'center', paddingHorizontal: 8 }]}>
              {t('settings.zyren.final')}
            </Text>
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
