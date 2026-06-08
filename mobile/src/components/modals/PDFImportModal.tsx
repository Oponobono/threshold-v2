import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { theme } from '../../styles/theme';
import { flashcardImportStyles as s } from '../../styles/FlashcardImportModal.styles';
import { useCustomAlert } from '../ui/CustomAlert';
import { createScannedDocument } from '../../services/api';
import { extractTextFromPDFHybrid } from '../../services/hybridAIService';

export interface PDFImportModalProps {
  isVisible: boolean;
  onClose: () => void;
  selectedSubjectId?: string;
  onImportSuccess?: (documentUri: string, documentId?: string) => void;
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
  const { t } = useTranslation();
  const { showAlert } = useCustomAlert();
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractOCR, setExtractOCR] = useState(true);

  const handleLaunchPicker = async () => {
    if (!selectedSubjectId) {
      showAlert({
        title: t('common.error') || 'Error',
        message: t('subjects.selectSubjectFirst', 'Selecciona una materia primero'),
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
        title: t('common.error') || 'Error',
        message: t('documents.pickerError', 'No se pudo abrir el selector de archivos'),
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
          message: t('documents.tooLarge', 'El archivo es demasiado grande (máx. 50MB)'),
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
          const extracted = await extractTextFromPDFHybrid(base64Data);
          ocrText = extracted !== undefined ? extracted : null;
          
          if (!ocrText) {
            console.warn('[PDFImportModal] OCR executó pero no extrajo texto. Base64 size:', base64Data.length);
          }
        } catch (ocrErr) {
          console.warn('[PDFImportModal] Extracción de texto falló:', ocrErr);
          showAlert({
            title: t('common.warning') || 'Aviso',
            message: t('documents.textExtractionFailed', 'No se pudo extraer texto del PDF. El documento se guardará sin contenido textual.'),
            type: 'warning',
          });
          ocrText = null; // null indica que el OCR falló, no que no se intentó
        }
      }

      const savedDoc = await createScannedDocument({
        subject_id: selectedSubjectId,
        local_uri: localPdfUri,
        name: file.name,
        ocr_text: ocrText ? ocrText : undefined, // Enviar undefined si es null (no se intentó) o "" (no encontró texto)
      });
      
      // createScannedDocument ya gestiona el auto-upload según las preferencias de backup

      showAlert({
        title: t('common.success') || 'Éxito',
        message: t('documents.importedFile', { file: file.name, defaultValue: `${file.name} importado` }),
        type: 'success',
      });

      onImportSuccess?.(localPdfUri, savedDoc.id);
      onClose();
    } catch (error: any) {
      console.error('[PDFImportModal] Error importando:', error);
      showAlert({
        title: t('common.error') || 'Error',
        message: error?.message || t('documents.importError', 'Error al importar el archivo'),
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
        <Pressable style={s.modal} onPress={() => null}>
          {/* Header */}
          <View style={s.header}>
            <View style={s.headerLeft}>
              <Text style={s.headerTitle}>{t('documents.importTitle', 'Importar PDF')}</Text>
            </View>
            <TouchableOpacity onPress={onClose} disabled={isProcessing} style={s.closeBtn}>
              <Ionicons name="close" size={16} color={theme.colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <View>
            <Text
              style={{
                fontSize: 13,
                color: theme.colors.text.secondary,
                marginBottom: 16,
                lineHeight: 18,
                textAlign: 'center',
              }}
            >
              {t('documents.uploadPrompt', 'Sube tu PDF y extrae el texto con IA 🚀')}
            </Text>

            {/* OCR Toggle */}
            <TouchableOpacity
              onPress={() => setExtractOCR(!extractOCR)}
              disabled={isProcessing}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: theme.colors.inputBackground,
                padding: 11,
                borderRadius: 10,
                marginBottom: 14,
                borderWidth: 1,
                borderColor: theme.colors.border,
              }}
              activeOpacity={0.7}
            >
              <Ionicons
                name={extractOCR ? 'checkbox' : 'square-outline'}
                size={18}
                color={extractOCR ? theme.colors.primary : theme.colors.text.secondary}
              />
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.text.primary }}>
                  {t('documents.extractText', 'Extraer texto')}
                </Text>
                <Text style={{ fontSize: 11, color: theme.colors.text.secondary, marginTop: 2 }}>
                  {t('documents.aiReadable', 'La IA podrá leer el contenido')}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Launch Button */}
            <TouchableOpacity
              onPress={handleLaunchPicker}
              disabled={isProcessing}
              style={{
                backgroundColor: theme.colors.primary,
                borderRadius: 12,
                paddingVertical: 12,
                paddingHorizontal: 16,
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 8,
                opacity: isProcessing ? 0.6 : 1,
              }}
              activeOpacity={0.8}
            >
              {isProcessing ? (
                <>
                  <ActivityIndicator color={theme.colors.white} size="small" />
                  <Text style={{ color: theme.colors.white, fontSize: 14, fontWeight: '700' }}>
                    {t('common.loading')}...
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons name="folder-outline" size={18} color={theme.colors.white} />
                  <Text style={{ color: theme.colors.white, fontSize: 14, fontWeight: '700' }}>
                    {t('documents.selectPdf', 'Seleccionar PDF')}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};
