import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, Modal, TouchableOpacity, ScrollView,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { theme } from '../styles/theme';
import { AIContextCarousel } from './AIContextCarousel';
import { AIContextItemData, AIContextItemType } from './AIContextItem';
import { RecordingItem } from '../hooks/useAudioRecorder';
import { YouTubeVideo } from '../services/api/types';
import { mapRecordings, mapPhotos, mapDocuments, mapVideos } from '../utils/aiContextMappers';
import { contextModalStyles as styles } from '../styles/SubjectAIContextModal.styles';

export interface SubjectAIContextModalProps {
  isVisible: boolean;
  onClose: () => void;
  subjectName: string;
  recordings?: RecordingItem[];
  photos?: any[];
  documents?: any[];
  videos?: YouTubeVideo[];
  onGenerateFlashcards?: (selectedItems: AIContextItemData[]) => void;
  onAskQuestions?: (selectedItems: AIContextItemData[]) => void;
}

/**
 * SubjectAIContextModal.tsx
 *
 * Hoja modal (Bottom Sheet extendido) que funciona como "Selector de Contexto".
 * Se abre al presionar el FAB (SubjectAIFab) en la pantalla de la materia.
 * Recopila todos los archivos de la materia (videos, audios, fotos, documentos) y los 
 * agrupa utilizando `AIContextCarousel`. Permite al usuario decidir qué enviar a la IA
 * antes de desencadenar flujos secundarios (crear flashcards o abrir el chat).
 *
 * @param isVisible - Estado de visibilidad.
 * @param onClose - Método para cerrar la hoja de selección.
 * @param subjectName - Nombre de la materia actual.
 * @param recordings - Arreglo de notas de voz de la materia.
 * @param photos - Arreglo de fotos.
 * @param documents - Arreglo de PDFs.
 * @param videos - Arreglo de videos vinculados.
 * @param onGenerateFlashcards - Callback ejecutado al presionar el botón de crear flashcards.
 * @param onAskQuestions - Callback ejecutado al presionar el botón de "Preguntar a IA".
 */
export const SubjectAIContextModal: React.FC<SubjectAIContextModalProps> = ({
  isVisible,
  onClose,
  subjectName,
  recordings = [],
  photos = [],
  documents = [],
  videos = [],
  onGenerateFlashcards,
  onAskQuestions,
}) => {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Map raw data once per render
  const allSections: { type: AIContextItemType; items: AIContextItemData[] }[] = useMemo(() => [
    { type: 'document',  items: mapDocuments(documents)   },
    { type: 'photo',     items: mapPhotos(photos)         },
    { type: 'recording', items: mapRecordings(recordings) },
    { type: 'video',     items: mapVideos(videos)         },
  ], [documents, photos, recordings, videos]);

  const allItems = useMemo(() => allSections.flatMap(s => s.items), [allSections]);

  const totalSelected = selectedIds.size;
  const hasContent = allItems.length > 0;

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleToggle = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback((items: AIContextItemData[]) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      const allSelected = items.every(i => next.has(i.id));
      if (allSelected) {
        items.forEach(i => next.delete(i.id));
      } else {
        items.forEach(i => next.add(i.id));
      }
      return next;
    });
  }, []);

  const handleGenerate = useCallback(() => {
    const selected = allItems.filter(i => selectedIds.has(i.id));
    onGenerateFlashcards?.(selected);
  }, [allItems, selectedIds, onGenerateFlashcards]);

  const handleAsk = useCallback(() => {
    const selected = allItems.filter(i => selectedIds.has(i.id));
    onAskQuestions?.(selected);
  }, [allItems, selectedIds, onAskQuestions]);

  const handleClose = () => {
    setSelectedIds(new Set());
    onClose();
  };

  return (
    <Modal visible={isVisible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MaterialCommunityIcons name="auto-fix" size={22} color={theme.colors.primary} />
                <Text style={styles.title}>{t('ai.assistantTitle') || 'Asistente de IA'}</Text>
              </View>
              <Text style={styles.subtitle}>
                {t('ai.selectFilesOf') || 'Selecciona archivos de '}
                <Text style={{ fontWeight: '700', color: theme.colors.text.primary }}>{subjectName}</Text>
                {t('ai.toGiveContext') || ' para dar contexto a la IA'}
              </Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={theme.colors.text.primary} />
            </TouchableOpacity>
          </View>

          {/* Badge de selección */}
          {totalSelected > 0 && (
            <View style={styles.selectionBadge}>
              <Ionicons name="checkmark-circle" size={14} color={theme.colors.primary} />
              <Text style={styles.selectionBadgeText}>
                {totalSelected} {totalSelected === 1 ? (t('ai.fileSelected') || 'archivo seleccionado') : (t('ai.filesSelected') || 'archivos seleccionados')}
              </Text>
            </View>
          )}

          {/* Carruseles */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {!hasContent ? (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="folder-open-outline" size={48} color={theme.colors.border} />
                <Text style={styles.emptyTitle}>{t('ai.noResourcesTitle') || 'Sin recursos disponibles'}</Text>
                <Text style={styles.emptyText}>
                  {t('ai.noResourcesText') || 'Agrega grabaciones, fotos, documentos o videos a esta materia para usarlos con la IA.'}
                </Text>
              </View>
            ) : (
              allSections.map(section => (
                <AIContextCarousel
                  key={section.type}
                  type={section.type}
                  items={section.items}
                  selectedIds={selectedIds}
                  onToggle={handleToggle}
                  onSelectAll={() => handleSelectAll(section.items)}
                />
              ))
            )}
          </ScrollView>

          {/* Botones de acción */}
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
            <TouchableOpacity
              onPress={handleAsk}
              disabled={totalSelected === 0}
              style={[styles.actionBtn, styles.askBtn, totalSelected === 0 && styles.actionBtnDisabled]}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="chat-processing-outline" size={20} color="#fff" />
              <Text style={styles.actionBtnText}>{t('ai.askAI') || 'Preguntar a IA'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleGenerate}
              disabled={totalSelected === 0}
              style={[styles.actionBtn, styles.generateBtn, totalSelected === 0 && styles.actionBtnDisabled]}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="cards-outline" size={20} color="#fff" />
              <Text style={styles.actionBtnText}>{t('ai.createFlashcards') || 'Crear Flashcards'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
