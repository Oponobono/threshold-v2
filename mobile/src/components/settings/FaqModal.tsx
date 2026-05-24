import React from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { settingsStyles as styles } from '../../styles/Settings.styles';

interface FaqItem {
  q: string;
  a: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

const FAQS_ES: FaqItem[] = [
  { q: '¿Cómo puedo cambiar mi contraseña?', a: 'Ve a Seguridad y cuenta > Cambiar contraseña desde la pantalla de configuración.' },
  { q: '¿Qué significa el PIN de perfil?', a: 'Es un código único que compartes con compañeros para unirte a grupos de estudio colaborativos.' },
  { q: '¿Cómo funcionan las escalas de calificación?', a: 'Puedes seleccionar entre escalas predefinidas o crear una personalizada desde Preferencias académicas.' },
  { q: '¿Se guardan mis datos en la nube?', a: 'Sí, activa la opción "Backup en la nube" para respaldar tus archivos en Uploadthing.' },
  { q: '¿Cómo elimino mi cuenta?', a: 'Ve a Seguridad y cuenta > Eliminar cuenta. Tienes 14 días para recuperarla.' },
];

const FAQS_EN: FaqItem[] = [
  { q: 'How do I change my password?', a: 'Go to Security & Account > Change password from the settings screen.' },
  { q: 'What is the profile PIN for?', a: 'It is a unique code you share with classmates to join collaborative study groups.' },
  { q: 'How do grading scales work?', a: 'You can select from predefined scales or create a custom one in Academic Preferences.' },
  { q: 'Is my data backed up to the cloud?', a: 'Yes, enable "Cloud Backup" to back up your files to Uploadthing.' },
  { q: 'How do I delete my account?', a: 'Go to Security & Account > Delete account. You have 14 days to recover it.' },
];

export const FaqModal: React.FC<Props> = ({ visible, onClose }) => {
  const { t, i18n } = useTranslation();
  const faqs = i18n.language === 'es' ? FAQS_ES : FAQS_EN;

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
            {faqs.map((item, i) => (
              <View key={i} style={{ marginBottom: 20 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.text.primary, marginBottom: 4 }}>{item.q}</Text>
                <Text style={{ fontSize: 13, color: theme.colors.text.secondary, lineHeight: 20 }}>{item.a}</Text>
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
