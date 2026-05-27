import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { settingsStyles as styles } from '../../styles/Settings.styles';
import { alertRef } from '../ui/CustomAlert';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (message: string) => Promise<void>;
}

export const SendFeedbackModal: React.FC<Props> = ({ visible, onClose, onSubmit }) => {
  const { t } = useTranslation();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim()) {
      alertRef.show({ title: t('common.error'), message: 'Escribe un mensaje', type: 'warning' });
      return;
    }
    setSending(true);
    try {
      await onSubmit(message.trim());
      setMessage('');
      alertRef.show({ title: t('common.success'), message: 'Gracias por tu comentario', type: 'success' });
      onClose();
    } catch (error: any) {
      alertRef.show({ title: t('common.error'), message: error.message, type: 'error' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('about.sendFeedback')}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.colors.text.primary} />
            </TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            <Text style={styles.modalDesc}>{t('about.feedbackDesc', '¿Tienes sugerencias, reporte de bugs o comentarios? Cuéntanos.')}</Text>
            <TextInput
              style={[styles.modalInput, { minHeight: 120, textAlignVertical: 'top' }]}
              value={message}
              onChangeText={setMessage}
              placeholder={t('about.feedbackPlaceholder', 'Escribe tu mensaje aquí...')}
              placeholderTextColor={theme.colors.text.secondary}
              multiline
            />
          </View>
          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.modalBtnSecondary} onPress={onClose}>
              <Text style={styles.modalBtnSecondaryText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalBtnPrimary, sending && { opacity: 0.6 }]} onPress={handleSubmit} disabled={sending}>
              <Text style={styles.modalBtnPrimaryText}>{sending ? t('common.sending', 'Enviando...') : t('about.send')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
