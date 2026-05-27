import React from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { theme } from '../../styles/theme';
import { useCustomAlert } from '../ui/CustomAlert';
import { galleryStyles } from '../../styles/Gallery.styles';

interface OcrModalProps {
  visible: boolean;
  text: string;
  onClose: () => void;
  t: any;
}

export const OcrModal: React.FC<OcrModalProps> = ({ visible, text, onClose, t }) => {
  const { showAlert } = useCustomAlert();

  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(text);
      showAlert({
        title: t('common.success') || 'Éxito',
        message: t('common.copiedToClipboard') || 'Texto copiado al portapapeles',
        type: 'success',
      });
    } catch {
      showAlert({
        title: t('common.error') || 'Error',
        message: t('common.errors.copyFailed') || 'No se pudo copiar el texto',
        type: 'error',
      });
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={galleryStyles.ocrModalContainer}>
        <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1 }}>
          <View style={galleryStyles.ocrModalHeader}>
            <Text style={galleryStyles.ocrModalTitle}>
              {t('common.recognizedText') || 'Texto Reconocido'}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.colors.text.primary} />
            </TouchableOpacity>
          </View>
          <ScrollView style={galleryStyles.ocrModalContent} contentContainerStyle={galleryStyles.ocrModalContentInner}>
            <Text style={galleryStyles.ocrModalText}>{text}</Text>
          </ScrollView>
          <SafeAreaView edges={['bottom']} style={galleryStyles.ocrModalFooter}>
            <TouchableOpacity style={galleryStyles.ocrModalCopyBtn} onPress={handleCopy}>
              <Ionicons name="copy" size={20} color={theme.colors.white} />
              <Text style={galleryStyles.ocrModalCopyText}>
                {t('common.copyText') || 'Copiar Texto'}
              </Text>
            </TouchableOpacity>
          </SafeAreaView>
        </SafeAreaView>
      </View>
    </Modal>
  );
};
