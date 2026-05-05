import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';
import { subjectDetailStyles as sectionStyles } from '../styles/SubjectDetail.styles';
import { documentListStyles as styles } from '../styles/SubjectDocumentsList.styles';
import { useCustomAlert } from './CustomAlert';
import { deleteScannedDocument } from '../services/api';
import * as IntentLauncher from 'expo-intent-launcher';
import * as FileSystem from 'expo-file-system/legacy';
import { useTranslation } from 'react-i18next';
import { SubjectDocumentCard } from './SubjectDocumentCard';

export interface SubjectDocumentsListProps {
  documents: any[];
  onGenerateFlashcards?: (uris: string[]) => void;
  onExportPdf?: (uris: string[]) => void;
  onDocumentDeleted?: (id: number | string) => void;
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
  onDocumentDeleted 
}) => {
  const { t } = useTranslation();
  const { showAlert } = useCustomAlert();
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number | string>>(new Set());

  if (documents.length === 0) return null;

  const openDocument = async (uri: string) => {
    try {
      if (Platform.OS === 'android') {
        // En Android, necesitamos obtener un content URI y usar IntentLauncher
        const contentUri = await FileSystem.getContentUriAsync(uri);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1,
          type: 'application/pdf',
        });
      } else {
        // En iOS, Linking puede abrir archivos locales (o webview)
        await Linking.openURL(uri);
      }
    } catch (error) {
      console.error('Error opening document:', error);
      alert(t('common.errors.pdfViewerNeeded') || 'No se pudo abrir el documento. Asegúrate de tener un visor de PDF instalado.');
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
               await deleteScannedDocument(docId);
               onDocumentDeleted?.(docId);
            } catch (e) {
               showAlert({ title: t('common.error') || 'Error', message: t('common.errors.deleteFailed') || 'No se pudo eliminar el documento.', type: 'error' });
            }
          }
        }
      ]
    });
  };

  return (
    <View style={sectionStyles.sectionBlock}>
      <View style={sectionStyles.sectionHeaderRow}>
        <View>
          <Text style={sectionStyles.sectionTitle}>{t('subjects.scannedDocuments')}</Text>
          <Text style={sectionStyles.sectionHint}>{t('subjects.scannedDocumentsHint')}</Text>
        </View>
        {selectionMode ? (
          <TouchableOpacity onPress={() => { setSelectionMode(false); setSelectedIds(new Set()); }}>
            <Text style={{ color: theme.colors.primary, fontWeight: '600', fontSize: 12 }}>{t('modals.cancel')}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => setSelectionMode(true)}>
            <Text style={{ color: theme.colors.primary, fontWeight: '600', fontSize: 12 }}>{t('modals.select')}</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.list}>
        {documents.map((doc, index) => {
          const docId = doc.id || index;
          const isSelected = selectedIds.has(docId);

          return (
            <SubjectDocumentCard
              key={docId}
              doc={doc}
              index={index}
              isSelected={isSelected}
              selectionMode={selectionMode}
              onPress={() => selectionMode ? toggleSelection(docId) : openDocument(doc.local_uri)}
              onLongPress={() => handleLongPress(docId)}
              onDelete={() => handleDelete(docId)}
            />
          );
        })}
      </View>

      {selectionMode && selectedIds.size > 0 && (
        <View style={styles.actionBottomBar}>
          <Text style={styles.actionText}>{selectedIds.size} seleccionados</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={styles.actionBtn} onPress={handleExport}>
              <Ionicons name="document-text-outline" size={20} color="white" />
              <Text style={styles.actionBtnText}>{t('subjects.pdf')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.colors.primary }]} onPress={handleGenerate}>
              <Ionicons name="flash-outline" size={20} color="white" />
              <Text style={styles.actionBtnText}>{t('subjects.flashcards')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};
