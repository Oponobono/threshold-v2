import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, KeyboardAvoidingView, Platform, TouchableWithoutFeedback } from 'react-native';
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
  const MAX_CHARS = 1000;

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
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.bottomSheetModalOverlay} />
        </TouchableWithoutFeedback>
        <View style={styles.bottomSheetModalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('about.sendFeedback')}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.colors.text.primary} />
            </TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            <Text style={styles.modalDesc}>{t('about.feedbackDesc', '¿Tienes sugerencias, reporte de bugs o comentarios? Cuéntanos.')}</Text>
            <TextInput
              style={[styles.modalInput, { height: 240, textAlignVertical: 'top' }]}
              value={message}
              onChangeText={(text) => text.length <= MAX_CHARS && setMessage(text)}
              placeholder={t('about.feedbackPlaceholder', 'Escribe tu mensaje aquí...')}
              placeholderTextColor={theme.colors.text.secondary}
              multiline
              maxLength={MAX_CHARS}
            />
            <Text style={{ alignSelf: 'flex-end', color: theme.colors.text.secondary, marginTop: 5 }}>
              {message.length}/{MAX_CHARS}
            </Text>
          </View>
          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.modalBtnSecondary} onPress={onClose}>
              <Text style={styles.modalBtnSecondaryText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.modalBtnPrimary, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }, sending && { opacity: 0.6 }]} 
              onPress={handleSubmit} 
              disabled={sending}
            >
              <Text style={[styles.modalBtnPrimaryText, { marginRight: 8 }]}>
                {sending ? t('common.sending', 'Enviando...') : t('about.send')}
              </Text>
              {!sending && <Ionicons name="send" size={16} color={theme.colors.white} />}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
