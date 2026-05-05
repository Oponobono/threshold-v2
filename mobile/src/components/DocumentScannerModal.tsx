import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Modal, TouchableOpacity, ActivityIndicator, Platform, Share, ScrollView } from 'react-native';
import { useCustomAlert } from './CustomAlert';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../styles/theme';
import { documentScannerStyles as localStyles } from '../styles/DocumentScannerModal.styles';
import { Subject, createPhoto, createScannedDocument, extractTextFromImage } from '../services/api';
import { AdvancedImageEnhancer, AdvancedImageEnhancerRef } from './AdvancedImageEnhancer';
import * as Print from 'expo-print';

// Importes condicionales para plataformas nativas
let DocumentScanner: any = null;
let ResponseType: any = null;
let Accelerometer: any = null;

if (Platform.OS !== 'web') {
  try {
    const scanner = require('react-native-document-scanner-plugin');
    DocumentScanner = scanner.default || scanner;
    ResponseType = scanner.ResponseType;
    const sensors = require('expo-sensors');
    Accelerometer = sensors.Accelerometer;
  } catch (e) {
    console.warn('Native modules not available:', e);
  }
}

interface DocumentScannerModalProps {
  isVisible: boolean;
  onClose: () => void;
  subjects: Subject[];
  onSave?: (uri: string, subjectId: number, base64?: string) => void;
  onOCR?: (base64: string) => Promise<string>;
}

type ScannerStep = 'guide' | 'saving';

/**
 * DocumentScannerModal.tsx
 *
 * Modal de escaneo de documentos que integra el plugin nativo `react-native-document-scanner-plugin`
 * para obtener una imagen con corrección automática de perspectiva.
 * Incluye un paso previo de guía que usa el acelerómetro (`expo-sensors`) para verificar
 * que el dispositivo esté paralelo al documento antes de disparar el escáner.
 * Una vez escaneado, ofrece el editor `AdvancedImageEnhancer` para aplicar filtros
 * (B/N, alto contraste, etc.) y finalmente permite exportar como Imagen o PDF.
 * También integra OCR vía Groq Vision para extraer texto directamente desde la vista de edición.
 *
 * @param isVisible - Controla si el modal está activo.
 * @param onClose - Callback para cerrar y limpiar el estado de escaneo.
 * @param subjects - Lista de materias para asignar el documento escaneado.
 * @param onSave - Callback opcional con la URI final y el ID de materia.
 * @param onOCR - (Deprecado/opcional) Función externa para extracción de texto.
 */
export const DocumentScannerModal: React.FC<DocumentScannerModalProps> = ({
  isVisible,
  onClose,
  subjects,
  onSave,
  onOCR
}) => {
  const { t } = useTranslation();
  const { showAlert } = useCustomAlert();
  const [step, setStep] = useState<ScannerStep>('guide');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLevel, setIsLevel] = useState(false);
  const [exportFormat, setExportFormat] = useState<'image' | 'pdf'>('image');
  const [activeFilter, setActiveFilter] = useState('original');
  const enhancerRef = useRef<AdvancedImageEnhancerRef>(null);

  useEffect(() => {
    let subscription: any;
    if (isVisible && step === 'guide' && Accelerometer) {
      Accelerometer.setUpdateInterval(200);
      subscription = Accelerometer.addListener(({ x, y, z }: any) => {
        const isFlat = Math.abs(x) < 0.2 && Math.abs(y) < 0.2 && Math.abs(z) > 0.8;
        setIsLevel(isFlat);
      });
    }
    return () => {
      if (subscription) subscription.remove();
    };
  }, [isVisible, step]);

  const launchNativeScanner = async () => {
    if (!DocumentScanner) {
      showAlert({ title: t('common.error'), message: 'Document scanning is not available on this platform', type: 'info' });
      return;
    }

    try {
      const { scannedImages, status } = await DocumentScanner.scanDocument({
        maxNumDocuments: 1,
        croppedImageQuality: 100, // Mejor calidad para evitar artefactos en OCR
        letCropping: true, // Habilita la pantalla nativa de recorte para corregir perspectiva/ondulaciones
        responseType: ResponseType.ImageFilePath
      });

      if (status === 'success' && scannedImages && scannedImages.length > 0) {
        setCapturedImage(scannedImages[0]);
        setStep('saving');
      } else {
        resetAndClose();
      }
    } catch (error) {
      console.error(error);
      showAlert({ title: t('common.error'), message: t('dashboard.documentScannerModal.errorStartScanner'), type: 'error' });
      resetAndClose();
    }
  };

  const handleSave = async () => {
    if (!capturedImage || !selectedSubjectId) {
      showAlert({ title: t('common.error'), message: t('dashboard.documentScannerModal.selectSubjectError'), type: 'warning' });
      return;
    }

    const finalImageUri = capturedImage;

    try {
      setIsProcessing(true);
      
      let finalImageUri = capturedImage;
      let base64Img = '';
      if (enhancerRef.current) {
        const processedUri = await enhancerRef.current.exportProcessedImage();
        if (processedUri) {
          finalImageUri = processedUri;
        }
        base64Img = await enhancerRef.current.exportBase64() || '';
      }
      
      if (exportFormat === 'pdf') {
        const imgSrc = base64Img ? `data:image/jpeg;base64,${base64Img}` : finalImageUri;
        const html = `
          <html>
            <body style="margin: 0; padding: 0;">
              <img src="${imgSrc}" style="width: 100%;" />
            </body>
          </html>
        `;
        const { uri: pdfUri } = await Print.printToFileAsync({ html });
        console.log("PDF generado en:", pdfUri);
        
        await createScannedDocument({
          subject_id: selectedSubjectId,
          local_uri: pdfUri,
          name: `Documento Escaneado ${new Date().toLocaleDateString()}`
        });
        
        finalImageUri = pdfUri;
      } else {
        await createPhoto({
          subject_id: selectedSubjectId,
          local_uri: finalImageUri,
        });
      }
      
      if (onSave) onSave(exportFormat === 'pdf' ? finalImageUri /* should be pdfUri eventually */ : finalImageUri, selectedSubjectId);
      showAlert({ title: t('common.success'), message: t('dashboard.documentScannerModal.success', { subject: subjects.find(s => s.id === selectedSubjectId)?.name }), type: 'success' });
      resetAndClose();
    } catch (error) {
      showAlert({ title: t('common.error'), message: t('dashboard.documentScannerModal.error'), type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };


  const handleOCR = async () => {
    if (!capturedImage) return;
    try {
      setIsProcessing(true);
      const base64Data = await enhancerRef.current?.exportBase64();
      if (!base64Data) throw new Error('No se pudo exportar la imagen desde el canvas.');
      
      // Diagnóstico: tamaño estimado en MB
      const estimatedMB = ((base64Data.length * 3) / 4 / 1024 / 1024).toFixed(2);
      console.log(`[OCR] Tamaño imagen base64: ~${estimatedMB} MB`);
      
      if ((base64Data.length * 3) / 4 > 3.5 * 1024 * 1024) {
        showAlert({ 
          title: t('common.errors.imageTooLarge') || 'Imagen muy grande', 
          message: (t('common.errors.imageTooLargeDesc') || `La imagen pesa ~${estimatedMB}MB. Aplica el filtro "B/N OCR" para reducir el tamaño e intenta de nuevo.`), 
          type: 'warning' 
        });
        return;
      }

      const text = await extractTextFromImage(base64Data);
      
      if (!text || text.trim() === '') {
        showAlert({ title: t('common.notice') || 'Sin texto', message: t('common.errors.noTextDetected') || 'No se detectó texto en la imagen.', type: 'info' });
        return;
      }

      await Share.share({
        title: t('dashboard.documentScannerModal.transcribedText') || 'Texto extraído de Threshold',
        message: text,
      });
    } catch (error: any) {
      console.error('[OCR] Error:', error.message);
      showAlert({ title: t('common.ocrError') || 'Error OCR', message: error.message, type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };


  const resetAndClose = () => {
    setStep('guide');
    setCapturedImage(null);
    setSelectedSubjectId(null);
    setIsProcessing(false);
    setIsLevel(false);
    onClose();
  };

  const handleDiscard = () => {
    // No borramos la imagen inmediatamente para que la vista actual no desaparezca de golpe.
    // Simplemente lanzamos el escáner encima.
    launchNativeScanner();
  };

  const isSaveDisabled = !selectedSubjectId || isProcessing;

  return (
    <Modal visible={isVisible} animationType="slide" transparent={false} onRequestClose={step === 'saving' ? handleDiscard : resetAndClose}>
      <View style={localStyles.container}>
        
        {step === 'guide' && (
          <View style={localStyles.guideScreen}>
            <View style={localStyles.header}>
              <TouchableOpacity onPress={resetAndClose} style={localStyles.closeBtn}>
                <Ionicons name="close" size={28} color={theme.colors.text.secondary} />
              </TouchableOpacity>
              <Text style={localStyles.headerTitle}>{t('dashboard.documentScannerModal.preparationTitle')}</Text>
              <View style={localStyles.headerSpacer} />
            </View>

            <View style={localStyles.guideContent}>
              <View style={[localStyles.levelIndicator, isLevel && localStyles.levelIndicatorActive]}>
                <View style={[localStyles.levelBubble, isLevel && localStyles.levelBubbleActive]} />
              </View>
              
              <Text style={localStyles.guideTitle}>
                {isLevel ? t('dashboard.documentScannerModal.positionPerfect') : t('dashboard.documentScannerModal.positionParallel')}
              </Text>
              <Text style={localStyles.guideSubtitle}>
                {t('dashboard.documentScannerModal.positionSubtitle')}
              </Text>
            </View>

            <View style={localStyles.guideFooter}>
              <TouchableOpacity 
                style={[localStyles.launchBtn, isLevel ? localStyles.launchBtnActive : localStyles.launchBtnInactive]} 
                onPress={launchNativeScanner}
              >
                <Ionicons name="scan" size={24} color={isLevel ? "white" : theme.colors.text.secondary} />
                <Text style={[localStyles.launchBtnText, !isLevel && localStyles.launchBtnTextInactive]}>
                  {isLevel ? t('dashboard.documentScannerModal.scanButtonReady') : t('dashboard.documentScannerModal.scanButtonNotReady')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {step === 'saving' && capturedImage && (
          <View style={localStyles.savingContainer}>

            {/* Header con botón volver */}
            <View style={localStyles.savingHeader}>
              <TouchableOpacity onPress={resetAndClose} style={localStyles.backBtn}>
                <Ionicons name="arrow-back" size={22} color={theme.colors.text.primary} />
              </TouchableOpacity>
              <Text style={localStyles.savingHeaderTitle}>{t('modals.editScan')}</Text>
              {/* OCR: ícono en el header para acceso rápido */}
              <TouchableOpacity
                style={[localStyles.ocrIconBtn, isProcessing && { opacity: 0.5 }]}
                onPress={handleOCR}
                disabled={isProcessing}
              >
                {isProcessing
                  ? <ActivityIndicator size="small" color="#C5A059" />
                  : <MaterialCommunityIcons name="text-recognition" size={22} color="#C5A059" />
                }
              </TouchableOpacity>
            </View>

            {/* Imagen + filtros */}
            <AdvancedImageEnhancer
              ref={enhancerRef}
              imageUri={capturedImage}
              onFilterChange={setActiveFilter}
            />

            {/* Formato de exportación */}
            <View style={localStyles.sectionBlock}>
              <Text style={localStyles.sectionLabel}>{t('modals.exportFormat')}</Text>
              <View style={localStyles.modeBadges}>
                <TouchableOpacity
                  style={[localStyles.modeBadge, exportFormat === 'image' && localStyles.modeBadgeActive]}
                  onPress={() => setExportFormat('image')}
                >
                  <Ionicons
                    name="image-outline"
                    size={14}
                    color={exportFormat === 'image' ? theme.colors.primary : theme.colors.text.secondary}
                  />
                  <Text style={[localStyles.modeBadgeText, exportFormat === 'image' && localStyles.modeBadgeTextActive]}>
                    {' '}{t('common.photo') || 'Foto de Galería'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[localStyles.modeBadge, exportFormat === 'pdf' && localStyles.modeBadgeActive]}
                  onPress={() => setExportFormat('pdf')}
                >
                  <Ionicons
                    name="document-text-outline"
                    size={14}
                    color={exportFormat === 'pdf' ? theme.colors.primary : theme.colors.text.secondary}
                  />
                  <Text style={[localStyles.modeBadgeText, exportFormat === 'pdf' && localStyles.modeBadgeTextActive]}>
                    {' '}{t('common.document') || 'Documento PDF'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Selección de materia */}
            <View style={localStyles.sectionBlock}>
              <Text style={localStyles.sectionLabel}>{t('dashboard.documentScannerModal.save')}</Text>
              <ScrollView 
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={localStyles.subjectScrollContainer}
              >
                {subjects.map(s => (
                  <TouchableOpacity
                    key={s.id}
                    style={[
                      localStyles.subjectItem,
                      selectedSubjectId === s.id && {
                        backgroundColor: s.color ? s.color + '30' : theme.colors.primary + '20',
                        borderColor: s.color || theme.colors.primary,
                        borderWidth: 2,
                      },
                    ]}
                    onPress={() => setSelectedSubjectId(s.id)}
                  >
                    <View style={[localStyles.subjectBadgeOverride, { backgroundColor: s.color || '#CCC' }]}>
                      <MaterialCommunityIcons name={(s.icon as any) || 'book-outline'} size={16} color="white" />
                    </View>
                    <Text style={localStyles.subjectName} numberOfLines={1}>{s.name}</Text>
                    {selectedSubjectId === s.id && (
                      <Ionicons name="checkmark-circle" size={16} color={s.color || theme.colors.primary} style={{ marginLeft: 6 }} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Barra de acciones */}
            <View style={localStyles.saveActions}>
              <TouchableOpacity
                onPress={handleDiscard}
                style={[localStyles.actionBtn, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.border, borderWidth: 1 }]}
              >
                <Ionicons name="camera-reverse-outline" size={18} color={theme.colors.text.primary} />
                <Text style={[localStyles.actionBtnText, { color: theme.colors.text.primary }]}>{t('modals.retake')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSave}
                disabled={isSaveDisabled}
                style={[localStyles.actionBtn, localStyles.actionBtnSave, isSaveDisabled && localStyles.primaryBtnDisabled]}
              >
                {isProcessing
                  ? <ActivityIndicator color="white" size="small" />
                  : <>
                      <Ionicons name="cloud-upload-outline" size={18} color="white" />
                      <Text style={[localStyles.actionBtnText, { color: 'white' }]}>{t('modals.save')}</Text>
                    </>
                }
              </TouchableOpacity>
            </View>

          </View>
        )}

        {isProcessing && (
          <View style={localStyles.loaderOverlay}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={localStyles.loaderText}>{t('dashboard.documentScannerModal.saving')}</Text>
          </View>
        )}

      </View>
    </Modal>
  );
};
