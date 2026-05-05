import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { theme } from '../styles/theme';
import { pdfImportStyles as s } from '../styles/PDFImportModal.styles';
import { useCustomAlert } from './CustomAlert';
import { createScannedDocument, extractTextFromImage } from '../services/api';

export interface PDFImportModalProps {
  isVisible: boolean;
  onClose: () => void;
  selectedSubjectId?: number;
  onImportSuccess?: (documentUri: string, documentId?: number) => void;
}

const PDF_DIR = () => `${FileSystem.documentDirectory}Threshold/pdf/`;

/**
 * PDFImportModal.tsx
 *
 * Modal para importar documentos PDF utilizando el selector nativo del sistema
 * (expo-document-picker), lo cual resuelve las limitaciones de Scoped Storage en Android 11+.
 */
export const PDFImportModal: React.FC<PDFImportModalProps> = ({
  isVisible,
  onClose,
  selectedSubjectId,
  onImportSuccess,
}) => {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { showAlert } = useCustomAlert();
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractOCR, setExtractOCR] = useState(true);

  const handleLaunchPicker = async () => {
    if (!selectedSubjectId) {
      showAlert({
        title: t('common.error') || 'Error',
        message: 'Selecciona una materia primero',
        type: 'error',
      });
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];
      await handleImportPDF(file);
    } catch (error: any) {
      console.error('[PDFImportModal] DocumentPicker error:', error);
      showAlert({
        title: 'Error',
        message: 'No se pudo abrir el selector de archivos',
        type: 'error',
      });
    }
  };

  const handleImportPDF = async (file: DocumentPicker.DocumentPickerAsset) => {
    try {
      setIsProcessing(true);

      const maxSize = 50 * 1024 * 1024; // 50MB
      if (file.size && file.size > maxSize) {
        showAlert({
          title: t('common.error') || 'Error',
          message: 'El archivo es demasiado grande (máx. 50MB)',
          type: 'error',
        });
        setIsProcessing(false);
        return;
      }

      const pdfDir = PDF_DIR();
      const pdfDirInfo = await FileSystem.getInfoAsync(pdfDir);
      if (!pdfDirInfo.exists) {
        await FileSystem.makeDirectoryAsync(pdfDir, { intermediates: true });
      }

      // Evitar espacios u otros caracteres raros en el nombre de archivo interno
      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const filename = `imported_${Date.now()}_${safeName}`;
      const localPdfUri = `${pdfDir}${filename}`;

      await FileSystem.copyAsync({
        from: file.uri,
        to: localPdfUri,
      });

      let ocrText: string | null = null;
      if (extractOCR) {
        try {
          const base64Data = await FileSystem.readAsStringAsync(localPdfUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          ocrText = await extractTextFromImage(base64Data);
        } catch (ocrErr) {
          console.warn('[PDFImportModal] OCR falló:', ocrErr);
        }
      }

      const savedDoc = await createScannedDocument({
        subject_id: selectedSubjectId,
        local_uri: localPdfUri,
        name: file.name,
        ocr_text: ocrText || null,
      });

      showAlert({
        title: t('common.success') || 'Éxito',
        message: `${file.name} importado`,
        type: 'success',
      });

      onImportSuccess?.(localPdfUri, savedDoc.id);
      onClose();
    } catch (error: any) {
      console.error('[PDFImportModal] Error importando:', error);
      showAlert({
        title: t('common.error') || 'Error',
        message: error?.message || 'Error al importar el archivo',
        type: 'error',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]} onPress={() => null}>
          <View style={s.handle} />

          {/* Header */}
          <View style={s.header}>
            <View style={s.headerLeft}>
              <Text style={s.headerTitle}>Importar Documento PDF</Text>
            </View>
            <TouchableOpacity onPress={onClose} disabled={isProcessing} style={s.closeBtn}>
              <Ionicons name="close" size={18} color={theme.colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <View style={{ paddingHorizontal: 24, paddingTop: 16 }}>
            <Text style={{ fontSize: 14, color: theme.colors.text.secondary, marginBottom: 24, lineHeight: 20 }}>
              Utiliza el explorador nativo de tu dispositivo para buscar y seleccionar el archivo PDF que deseas importar a esta materia.
            </Text>

            {/* OCR Toggle */}
            <TouchableOpacity
              onPress={() => setExtractOCR(!extractOCR)}
              disabled={isProcessing}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: theme.colors.inputBackground,
                padding: 16,
                borderRadius: 12,
                marginBottom: 24,
                borderWidth: 1,
                borderColor: theme.colors.border,
              }}
              activeOpacity={0.7}
            >
              <Ionicons
                name={extractOCR ? 'checkbox' : 'square-outline'}
                size={22}
                color={extractOCR ? theme.colors.primary : theme.colors.text.secondary}
              />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: theme.colors.text.primary }}>
                  Extraer texto (OCR)
                </Text>
                <Text style={{ fontSize: 13, color: theme.colors.text.secondary, marginTop: 4 }}>
                  Permite a la inteligencia artificial leer el contenido.
                </Text>
              </View>
            </TouchableOpacity>

            {/* Launch Button */}
            <TouchableOpacity
              onPress={handleLaunchPicker}
              disabled={isProcessing}
              style={{
                backgroundColor: theme.colors.primary,
                borderRadius: 16,
                paddingVertical: 18,
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="folder-open-outline" size={20} color="white" />
              <Text style={{ color: 'white', fontSize: 16, fontWeight: '700', marginLeft: 10 }}>
                Abrir explorador de archivos
              </Text>
            </TouchableOpacity>
          </View>

          {/* Processing Overlay */}
          {isProcessing && (
            <View style={s.processingOverlay}>
              <View style={s.processingBox}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={s.processingText}>Importando archivo...</Text>
              </View>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};
