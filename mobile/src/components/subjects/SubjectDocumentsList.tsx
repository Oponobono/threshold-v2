import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, TouchableOpacity, Linking, Platform, Share, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { theme } from '../../styles/theme';
import { subjectDetailStyles as sectionStyles } from '../../styles/SubjectDetail.styles';
import { documentListStyles as styles } from '../../styles/SubjectDocumentsList.styles';
import { useCustomAlert } from '../ui/CustomAlert';
import { deleteScannedDocument, updateScannedDocument, deletePhoto } from '../../services/api';
import { extractTextFromImageHybrid, extractTextFromPDFHybrid } from '../../services/hybridAIService';
import * as IntentLauncher from 'expo-intent-launcher';
import * as FileSystem from 'expo-file-system/legacy';
import * as WebBrowser from 'expo-web-browser';
import * as Sharing from 'expo-sharing';
import { useTranslation } from 'react-i18next';
import { SubjectDocumentCard } from './SubjectDocumentCard';

const EXPANDED_MAX_HEIGHT = 340;

const FORMATS = ['all', 'pdf', 'doc', 'xls', 'ppt', 'txt', 'json'] as const;
type FormatFilter = (typeof FORMATS)[number];

const FORMAT_LABELS: Record<FormatFilter, string> = {
  all: 'Todos',
  pdf: 'PDF',
  doc: 'DOC',
  xls: 'XLS',
  ppt: 'PPT',
  txt: 'TXT',
  json: 'JSON',
};

function getFormatFromUri(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.doc') || lower.endsWith('.docx')) return 'doc';
  if (lower.endsWith('.xlsx') || lower.endsWith('.xlsm') || lower.endsWith('.xls') || lower.endsWith('.csv')) return 'xls';
  if (lower.endsWith('.ppt') || lower.endsWith('.pptx')) return 'ppt';
  if (lower.endsWith('.txt')) return 'txt';
  if (lower.endsWith('.json')) return 'json';
  return 'other';
}

export interface SubjectDocumentsListProps {
  documents: any[];
  onGenerateFlashcards?: (uris: string[]) => void;
  onExportPdf?: (uris: string[]) => void;
  onDocumentDeleted?: (id: number | string) => void;
  onOpenImportPDF?: () => void;
}

/**
 * SubjectDocumentsList.tsx
 *
 * Muestra una lista apilada de documentos escaneados asociados a una materia.
 * Incorpora un modo de selección múltiple (habilitado mediante long-press o el botón "Seleccionar")
 * que permite realizar acciones masivas sobre los documentos, tales como exportarlos a un PDF
 * único unificado o enviarlos a la IA para generar mazos de Flashcards.
 *
 * @param documents - Lista de documentos escaneados de la materia.
 * @param onGenerateFlashcards - Función que recibe las URIs de los documentos para enviarlos a Groq IA.
 * @param onExportPdf - Función que unifica las imágenes seleccionadas en un archivo `.pdf`.
 * @param onDocumentDeleted - Función de limpieza al eliminar exitosamente un archivo.
 */
export const SubjectDocumentsList: React.FC<SubjectDocumentsListProps> = ({ 
  documents,
  onGenerateFlashcards,
  onExportPdf,
  onDocumentDeleted,
  onOpenImportPDF
}) => {
  const { t } = useTranslation();
  const { showAlert } = useCustomAlert();
  const router = useRouter();
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number | string>>(new Set());
  const [ocrInProgress, setOcrInProgress] = useState<Set<string | number>>(new Set());
  const [isRescanningAll, setIsRescanningAll] = useState(false);
  const [filterFormat, setFilterFormat] = useState<FormatFilter>('all');

  const availableFormats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const doc of documents) {
      const fmt = getFormatFromUri(doc.local_uri || '');
      counts[fmt] = (counts[fmt] || 0) + 1;
    }
    return FORMATS.filter((f) => f === 'all' || (counts[f] && counts[f] > 0));
  }, [documents]);

  useEffect(() => {
    if (filterFormat !== 'all' && !availableFormats.includes(filterFormat)) {
      setFilterFormat('all');
    }
  }, [availableFormats, filterFormat]);

  const filteredDocuments = filterFormat === 'all'
    ? documents
    : documents.filter((doc) => getFormatFromUri(doc.local_uri || '') === filterFormat);

  const openDocument = async (doc: any) => {
    try {
      if (doc.local_uri) {
        const fileInfo = await FileSystem.getInfoAsync(doc.local_uri);
        if (fileInfo.exists) {
          const lower = doc.local_uri.toLowerCase();
          const isSupported = lower.endsWith('.pdf') || lower.endsWith('.txt') || lower.endsWith('.json') || lower.endsWith('.xlsx') || lower.endsWith('.xlsm') || lower.endsWith('.xls') || lower.endsWith('.csv') || lower.endsWith('.pptx') || lower.endsWith('.ppt') || lower.endsWith('.docx') || lower.endsWith('.doc');
          if (isSupported) {
            router.push({
              pathname: '/documents/[documentUri]',
              params: {
                documentUri: doc.local_uri,
                documentTitle: doc.filename || doc.name || 'Documento',
                documentId: String(doc.id),
              },
            });
            return;
          }
          
          if (Platform.OS === 'android') {
            const contentUri = await FileSystem.getContentUriAsync(doc.local_uri);
            await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
              data: contentUri,
              flags: 1,
              type: 'application/pdf',
            });
          } else {
            await Linking.openURL(doc.local_uri);
          }
          return;
        }
      }

      if (doc.cloud_url && doc.cloud_url !== 'ghost_file') {
        await WebBrowser.openBrowserAsync(doc.cloud_url);
        return;
      }

      showAlert({
        title: 'Archivo no disponible',
        message: 'El archivo fue eliminado del dispositivo y no tiene respaldo en la nube.',
        type: 'warning',
      });
    } catch (error: any) {
      console.error('Error opening document:', error);
      const msg: string = error?.message || '';
      
      if (doc.cloud_url && doc.cloud_url !== 'ghost_file' && (msg.includes("doesn't exist") || msg.includes('Directory') || msg.includes('cache'))) {
        await WebBrowser.openBrowserAsync(doc.cloud_url);
      } else {
        showAlert({
          title: 'No se pudo abrir',
          message: t('common.errors.pdfViewerNeeded') || 'Asegúrate de tener un visor de PDF instalado.',
          type: 'error',
        });
      }
    }
  };

  const handleShare = async (doc: any) => {
    try {
      if (doc.local_uri) {
        const fileInfo = await FileSystem.getInfoAsync(doc.local_uri);
        if (fileInfo.exists) {
          const canShare = await Sharing.isAvailableAsync();
          if (canShare) {
            await Sharing.shareAsync(doc.local_uri);
            return;
          }
        }
      }
      if (doc.cloud_url && doc.cloud_url !== 'ghost_file') {
        await Share.share({ message: doc.cloud_url, url: doc.cloud_url });
      } else {
        showAlert({ title: 'Aviso', message: 'No hay archivo disponible para compartir.', type: 'warning' });
      }
    } catch (e) {
      console.error('Error sharing:', e);
    }
  };

  const toggleSelection = (id: string | number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
      if (newSelected.size === 0) setSelectionMode(false);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleLongPress = (id: string | number) => {
    if (!selectionMode) {
      setSelectionMode(true);
      toggleSelection(id);
    }
  };

  const handleGenerate = () => {
    if (!onGenerateFlashcards) return;
    const selectedUris = documents
      .filter(d => selectedIds.has(d.id || documents.indexOf(d)))
      .map(d => d.local_uri);
    onGenerateFlashcards(selectedUris);
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleExport = () => {
    if (!onExportPdf) return;
    const selectedUris = documents
      .filter(d => selectedIds.has(d.id || documents.indexOf(d)))
      .map(d => d.local_uri);
    onExportPdf(selectedUris);
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleDelete = (docId: number | string) => {
    showAlert({
      title: t('common.deleteItem') || 'Eliminar documento',
      message: t('subjects.deleteDocumentConfirm') || '¿Estás seguro de que quieres eliminar este documento?',
      type: 'confirm',
      buttons: [
        { text: t('common.cancel') || 'Cancelar', style: 'cancel' },
        {
          text: t('common.delete') || 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
               console.log(`[SubjectDocumentsList] Iniciando borrado de ID: ${docId}`);
               const doc = documents.find(d => (d.id || documents.indexOf(d)) === docId);
               
               if (doc?.is_legacy_photo) {
                 console.log('[SubjectDocumentsList] Borrando como foto legacy...');
                  await deletePhoto(String(docId));
               } else {
                 console.log('[SubjectDocumentsList] Borrando como documento escaneado...');
                  await deleteScannedDocument(String(docId));
               }
               
               // Eliminar archivo físico para liberar espacio
               if (doc?.local_uri) {
                 try {
                   console.log(`[SubjectDocumentsList] Intentando borrar archivo físico: ${doc.local_uri}`);
                   const fileInfo = await FileSystem.getInfoAsync(doc.local_uri);
                   if (fileInfo.exists) {
                     await FileSystem.deleteAsync(doc.local_uri);
                     console.log('[SubjectDocumentsList] Archivo físico borrado con éxito.');
                   } else {
                     console.log('[SubjectDocumentsList] El archivo físico no existe, saltando borrado.');
                   }
                 } catch (fsError) {
                   console.warn('[SubjectDocumentsList] Error al borrar archivo físico:', fsError);
                 }
               }
               
               console.log('[SubjectDocumentsList] Borrado completado con éxito, notificando a la UI.');
               onDocumentDeleted?.(docId);
            } catch (e: any) {
               console.error('[SubjectDocumentsList] ERROR CRÍTICO AL BORRAR:', e);
               showAlert({ title: t('common.error') || 'Error', message: (t('common.errors.deleteFailed') || 'No se pudo eliminar el documento.') + ` (${e.message})`, type: 'error' });
            }
          }
        }
      ]
    });
  };

  const handleExtractOCR = async (docId: string | number) => {
    const doc = documents.find(d => d.id === docId || documents.indexOf(d) === docId);
    if (!doc) return;

    try {
      setOcrInProgress(prev => new Set([...prev, docId]));

      // Verificar si el archivo existe antes de leerlo
      const fileInfo = await FileSystem.getInfoAsync(doc.local_uri);
      if (!fileInfo.exists) {
        showAlert({
          title: t('common.error') || 'Error',
          message: t('common.errors.fileNotFound') || 'El archivo ya no existe en el dispositivo.',
          type: 'error',
        });
        return;
      }

      // Leer el archivo PDF/imagen
      const fileContent = await FileSystem.readAsStringAsync(doc.local_uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Llamar a la API de OCR o extracción de PDF según el tipo de archivo
      let ocrText = '';
      if (doc.local_uri.toLowerCase().endsWith('.pdf')) {
        ocrText = await extractTextFromPDFHybrid(fileContent);
      } else {
        ocrText = await extractTextFromImageHybrid(fileContent);
      }

      if (!ocrText) {
        showAlert({
          title: t('common.warning') || 'Aviso',
          message: t('subjects.ocrNoTextFound') || 'No se encontró texto en el documento. Verifica que sea un PDF o imagen legible.',
          type: 'warning',
        });
        return;
      }

      // Actualizar el documento en la BD
      await updateScannedDocument(docId as any, { ocr_text: ocrText });

      showAlert({
        title: t('common.success') || 'Éxito',
        message: t('subjects.ocrExtracted') || 'Texto extraído correctamente. Ya puedes usar este documento con Zyren.',
        type: 'success',
      });

      // Recargar documentos (delegado al padre)
      onDocumentDeleted?.(docId); // Trigger parent to refresh
    } catch (error: any) {
      console.error('[OCR Error]', error);
      showAlert({
        title: t('common.error') || 'Error',
        message: error?.message || t('subjects.ocrFailed') || 'No se pudo extraer el texto del documento.',
        type: 'error',
      });
    } finally {
      setOcrInProgress(prev => {
        const next = new Set(prev);
        next.delete(docId);
        return next;
      });
    }
  };

  const handleRescanSelected = async () => {
    // Filtramos solo los seleccionados que no tienen texto activo
    const docsToRescan = documents.filter(d => {
      const docId = d.id || documents.indexOf(d);
      return selectedIds.has(docId) && (!d.ocr_text || d.ocr_text.trim() === '');
    });
    
    if (docsToRescan.length === 0) return;

    setIsRescanningAll(true);
    let successCount = 0;
    
    // Procesamos secuencialmente para no saturar la memoria o el backend
    for (const doc of docsToRescan) {
      const docId = doc.id || documents.indexOf(doc);
      try {
        setOcrInProgress(prev => new Set([...prev, docId]));
        const fileInfo = await FileSystem.getInfoAsync(doc.local_uri);
        if (!fileInfo.exists) {
          console.warn(`[SubjectDocumentsList] Archivo no encontrado para rescan: ${doc.local_uri}`);
          continue;
        }

        const fileContent = await FileSystem.readAsStringAsync(doc.local_uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        let text = '';
        if (doc.local_uri.toLowerCase().endsWith('.pdf')) {
          text = await extractTextFromPDFHybrid(fileContent);
        } else {
          text = await extractTextFromImageHybrid(fileContent);
        }
        
        if (text && text.trim().length > 0) {
          await updateScannedDocument(docId as any, { ocr_text: text });
          successCount++;
        }
      } catch (err) {
        console.warn(`Error rescaneando doc ${docId}:`, err);
      } finally {
        setOcrInProgress(prev => {
          const next = new Set(prev);
          next.delete(docId);
          return next;
        });
      }
    }
    
    setIsRescanningAll(false);
    setSelectionMode(false);
    setSelectedIds(new Set());
    
    if (successCount > 0) {
      showAlert({
        title: t('subjects.rescanSuccessTitle'),
        message: t('subjects.rescanSuccessMessage', { count: successCount }),
        type: 'success',
      });
      // Llamamos a la función para recargar todo, simulando una eliminación para forzar el refetch del padre
      onDocumentDeleted?.(-1); 
    } else {
      showAlert({
        title: t('subjects.rescanErrorTitle'),
        message: t('subjects.rescanErrorMessage'),
        type: 'error',
      });
    }
  };

  return (
    <View style={sectionStyles.sectionBlock}>
      <View style={sectionStyles.sectionHeaderRow}>
        <View>
          <Text style={sectionStyles.sectionTitle}>{t('documents.title')}</Text>
          <Text style={sectionStyles.sectionHint}>{t('documents.hint')}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <TouchableOpacity 
            onPress={() => router.push('/documents')} 
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons 
              name="menu" 
              size={22} 
              color={theme.colors.text.secondary} 
            />
          </TouchableOpacity>
          {documents.length > 0 && (
            <TouchableOpacity 
              onPress={() => {
                if (selectionMode) {
                  setSelectionMode(false);
                  setSelectedIds(new Set());
                } else {
                  setSelectionMode(true);
                }
              }} 
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons 
                name={selectionMode ? "document-text" : "document-text-outline"} 
                size={22} 
                color={selectionMode ? theme.colors.primary : theme.colors.text.secondary} 
              />
            </TouchableOpacity>
          )}
          {onOpenImportPDF && (
            <TouchableOpacity onPress={onOpenImportPDF} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="add-circle" size={24} color={theme.colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {documents.length > 0 && (
        <View style={styles.pillsRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsContent}>
            {availableFormats.map((f) => {
              const isActive = filterFormat === f;
              return (
                <TouchableOpacity
                  key={f}
                  onPress={() => setFilterFormat(f)}
                  activeOpacity={0.72}
                  style={[styles.pill, isActive && styles.pillActive]}
                >
                  <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
                    {FORMAT_LABELS[f]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      <View style={filteredDocuments.length === 0 ? sectionStyles.insightsCard : styles.documentContainer}>
        {filteredDocuments.length === 0 ? (
          <View style={sectionStyles.emptyStateCard}>
            <Ionicons name="document-text-outline" size={24} color={theme.colors.text.secondary} />
            <Text style={sectionStyles.emptyStateTitle}>{FORMAT_LABELS[filterFormat]}</Text>
            <Text style={sectionStyles.emptyStateText}>
              {filterFormat === 'all' ? t('documents.emptyState') : `No hay documentos ${FORMAT_LABELS[filterFormat]}`}
            </Text>
          </View>
        ) : (
          <ScrollView
            nestedScrollEnabled={true}
            showsVerticalScrollIndicator={filteredDocuments.length > 4}
            bounces={false}
          >
            <View style={styles.list}>
              {filteredDocuments.map((doc, index) => {
                  const docId = doc.id || index;
                  const isSelected = selectedIds.has(docId);
                  const isExtracting = ocrInProgress.has(docId);

                  return (
                    <SubjectDocumentCard
                      key={docId}
                      doc={doc}
                      index={index}
                      isSelected={isSelected}
                      selectionMode={selectionMode}
                      onPress={() => selectionMode ? toggleSelection(docId) : openDocument(doc)}
                      onLongPress={() => handleLongPress(docId)}
                      onDelete={() => handleDelete(docId)}
                      onShare={() => handleShare(doc)}
                      onExtractOCR={() => handleExtractOCR(docId)}
                      isExtractingOCR={isExtracting}
                    />
                  );
                })}
              </View>
            </ScrollView>
        )}
      </View>

      {selectionMode && (
        <View style={styles.actionBottomBar}>
          {selectedIds.size === 0 ? (
            <Text style={[styles.actionText, { flex: 1, textAlign: 'center' }]}>
              Selecciona un documento
            </Text>
          ) : (
            <>
              <Text style={styles.actionText}>{selectedIds.size} documento(s)</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(() => {
                  const selectedDocs = documents.filter(d => selectedIds.has(d.id || documents.indexOf(d)));
                  const canRescan = selectedDocs.some(d => !d.ocr_text || d.ocr_text.trim() === '');
                  
                  if (canRescan) {
                    return (
                      <TouchableOpacity style={styles.actionBtn} onPress={handleRescanSelected}>
                        <Ionicons name="document-text" size={16} color={theme.colors.primary} />
                        <Text style={styles.actionBtnText}>Reescanear</Text>
                      </TouchableOpacity>
                    );
                  } else {
                    return (
                      <View style={[styles.actionBtn, { opacity: 0.7, backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.colors.border }]}>
                        <Ionicons name="checkmark-done" size={16} color={theme.colors.text.secondary} />
                        <Text style={[styles.actionBtnText, { color: theme.colors.text.secondary }]}>Texto activo</Text>
                      </View>
                    );
                  }
                })()}
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
};

