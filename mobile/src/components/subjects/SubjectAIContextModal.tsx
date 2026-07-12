import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Animated, StyleSheet,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AIContextItemData, AIContextItemType } from '../ai/AIContextItem';
import { RecordingItem } from '../../hooks/useAudioRecorder';
import { YouTubeVideo } from '../../services/api/types';
import { mapRecordings, mapPhotos, mapDocuments, mapVideos } from '../../utils/aiContextMappers';
import LottieView from 'lottie-react-native';
import { s, PRIMARY, ASK_CLR, TXT_PRI, TXT_SEC } from '../../styles/SubjectAIContextModal.styles';

const zyrenOrbAnimation = require('../../lottieFiles/ai_orb.json');

type FilterKey = 'all' | 'audio' | 'videos' | 'docs' | 'photos';

const FILTER_TYPE_MAP: Partial<Record<FilterKey, AIContextItemType>> = {
  audio:  'recording',
  videos: 'video',
  docs:   'document',
  photos: 'photo',
};

const ITEMS_PER_PAGE = 10;

// ─── Props ────────────────────────────────────────────────────────────────────
export interface SubjectAIContextModalProps {
  isVisible: boolean;
  onClose: () => void;
  subjectName: string;
  recordings?: RecordingItem[];
  photos?: any[];
  documents?: any[];
  videos?: YouTubeVideo[];
  onGenerateFlashcards?: (selected: AIContextItemData[]) => void;
  onAskQuestions?: (selected: AIContextItemData[]) => void;
}

/**
 * SubjectAIContextModal — Selector de contexto Zyren con búsqueda.
 *
 * Bottom Sheet con barra de búsqueda (OCR/transcripción), chips de categoría
 * horizontal, lista compacta de archivos (10 por página), "Ver más" y
 * barra de acción inferior.
 */
export const SubjectAIContextModal: React.FC<SubjectAIContextModalProps> = ({
  isVisible, onClose, subjectName,
  recordings = [], photos = [], documents = [], videos = [],
  onGenerateFlashcards, onAskQuestions,
}) => {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showContent, setShowContent] = useState(false);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [isInitialLoading, setInitialLoading] = useState(true);
  const badgeScale = useRef(new Animated.Value(1)).current;
  const searchRef = useRef<TextInput>(null);
  const loadingOpacity = useRef(new Animated.Value(1)).current;
  const loadingSpin = useRef(new Animated.Value(0)).current;

  // ── Toast de advertencia ────────────────────────────────────────────────────
  const [toastMsg, setToastMsg] = useState('');
  const toastOpacity = useRef(new Animated.Value(0)).current;

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.delay(2600),
      Animated.timing(toastOpacity, { toValue: 0, duration: 380, useNativeDriver: true }),
    ]).start();
  }, [toastOpacity]);

  // Map raw data to unified format
  const allItems = useMemo<AIContextItemData[]>(() => [
    ...mapDocuments(documents),
    ...mapPhotos(photos),
    ...mapRecordings(recordings),
    ...mapVideos(videos),
  ], [documents, photos, recordings, videos]);

  // Sincronizar selectedIds con los items actuales
  useEffect(() => {
    setSelectedIds(prev => {
      const validIds = new Set(allItems.map(item => item.id));
      const cleaned = new Set(Array.from(prev).filter(id => validIds.has(id)));
      return cleaned.size === prev.size ? prev : cleaned;
    });
  }, [allItems]);

  // ── Loading state ───────────────────────────────────────────────────────────
  // Cuando el modal se abre, algunas props pueden llegar vacías el primer render
  // mientras el padre termina de cargar. Mostramos un indicador breve.
  useEffect(() => {
    if (isVisible) {
      setInitialLoading(true);
      const timer = setTimeout(() => setInitialLoading(false), 500);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  useEffect(() => {
    if (allItems.length > 0) setInitialLoading(false);
  }, [allItems]);

  // Pulsing animation for loading indicator
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(loadingOpacity, { toValue: 0.3, duration: 600, useNativeDriver: true }),
        Animated.timing(loadingOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    );
    const spin = Animated.loop(
      Animated.timing(loadingSpin, { toValue: 1, duration: 1200, useNativeDriver: true }),
    );
    pulse.start();
    spin.start();
    return () => { pulse.stop(); spin.stop(); };
  }, [loadingOpacity, loadingSpin]);

  const spinInterpolation = loadingSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Category counts
  const categoryCounts = useMemo(() => ({
    all: allItems.length,
    docs: allItems.filter(i => i.type === 'document').length,
    photos: allItems.filter(i => i.type === 'photo').length,
    audio: allItems.filter(i => i.type === 'recording').length,
    videos: allItems.filter(i => i.type === 'video').length,
  }), [allItems]);

  // Search matching
  const searchFiltered = useMemo(() => {
    if (!searchQuery.trim()) return allItems;
    const q = searchQuery.toLowerCase().trim();
    return allItems.filter(i =>
      i.label.toLowerCase().includes(q) ||
      (i.searchText && i.searchText.toLowerCase().includes(q))
    );
  }, [allItems, searchQuery]);

  // Category filter applied on top of search
  const displayedItems = useMemo(() => {
    const source = searchQuery.trim() ? searchFiltered : allItems;
    if (activeFilter === 'all') return source;
    const type = FILTER_TYPE_MAP[activeFilter];
    return source.filter(i => i.type === type);
  }, [searchFiltered, allItems, activeFilter, searchQuery]);

  const visibleItems = useMemo(() => displayedItems.slice(0, visibleCount), [displayedItems, visibleCount]);
  const totalMatching = displayedItems.length;
  const totalSelected = selectedIds.size;
  const hasContent = allItems.length > 0;

  const pulseBadge = useCallback(() => {
    Animated.sequence([
      Animated.spring(badgeScale, { toValue: 1.25, useNativeDriver: true, tension: 400, friction: 12 }),
      Animated.spring(badgeScale, { toValue: 1,    useNativeDriver: true, tension: 400, friction: 12 }),
    ]).start();
  }, [badgeScale]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleToggle = useCallback((id: string) => {
    const item = allItems.find(i => i.id === id);
    if (!item) return;

    if (!item.hasText) {
      if (item.type === 'photo') {
        showToast(t('ai.missingOCRPhoto', 'Esta fotografía aún no ha sido procesada. Por favor, extrae el texto mediante OCR para proporcionarle contexto adicional a Zyren.'));
      } else if (item.type === 'document') {
        showToast(t('ai.missingOCRDocument', 'Este documento aún no ha sido analizado. Por favor, realiza un escaneo de texto (OCR) para proporcionar contexto inteligente a tu asistente.'));
      } else if (item.type === 'recording') {
        showToast(t('ai.missingTranscriptRecording', 'Esta grabación requiere una transcripción. Por favor, transcribe el audio para que Zyren pueda utilizarlo como base de conocimiento.'));
      } else if (item.type === 'video') {
        showToast(t('ai.missingTranscriptVideo', 'Este video necesita ser transcrito. Por favor, genera una transcripción o resumen para enriquecer tu sesión de estudio.'));
      }
      return;
    }

    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
    pulseBadge();
  }, [allItems, showToast, t, pulseBadge]);

  const handleFilterPress = useCallback((key: FilterKey) => {
    setActiveFilter(key);
    setShowContent(true);
    setVisibleCount(ITEMS_PER_PAGE);
  }, []);

  const handleSearch = useCallback((text: string) => {
    setSearchQuery(text);
    setShowContent(true);
    setVisibleCount(ITEMS_PER_PAGE);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setShowContent(false);
    setVisibleCount(ITEMS_PER_PAGE);
    searchRef.current?.blur();
  }, []);

  const showMore = useCallback(() => {
    setVisibleCount(prev => prev + ITEMS_PER_PAGE);
  }, []);

  const handleClose = useCallback(() => {
    setSelectedIds(new Set());
    setActiveFilter('all');
    setSearchQuery('');
    setShowContent(false);
    setVisibleCount(ITEMS_PER_PAGE);
    onClose();
  }, [onClose]);

  const checkTextReadiness = useCallback((selected: AIContextItemData[]) => {
    const withoutText = selected.filter(i => i.hasText === false);
    if (withoutText.length === 0) return { status: 'ok' as const, items: [] };
    if (withoutText.length === selected.length) return { status: 'all_empty' as const, items: withoutText };
    return { status: 'some_empty' as const, items: withoutText };
  }, []);

  const getToastMessage = useCallback((items: AIContextItemData[]) => {
    const hasAudioVideo = items.some(i => i.type === 'recording' || i.type === 'video');
    const hasDocPhoto   = items.some(i => i.type === 'document'  || i.type === 'photo');
    if (hasAudioVideo && hasDocPhoto)
      return t('ai.toastMediaAndDoc', '⚠️ Transcribe los audios/videos y analiza con OCR los documentos/fotos antes de continuar.');
    if (hasAudioVideo)
      return t('ai.toastMedia', '⚠️ Primero debes transcribir los archivos de audio o video antes de usarlos como contexto.');
    return t('ai.toastDoc', '⚠️ Primero debes analizar los documentos o fotos con OCR antes de usarlos como contexto.');
  }, [t]);

  const handleAsk = useCallback(() => {
    const selected = allItems.filter(i => selectedIds.has(i.id));
    if (selected.length === 0) {
      showToast(t('ai.chatOpenFree', '💬 Abriendo chat libre. Puedes hacer preguntas sin contexto.'));
      onAskQuestions?.(selected);
      return;
    }
    const { status, items } = checkTextReadiness(selected);
    if (status === 'all_empty') {
      showToast(getToastMessage(items));
      return;
    }
    if (status === 'some_empty') showToast(getToastMessage(items));
    onAskQuestions?.(selected);
  }, [allItems, selectedIds, onAskQuestions, checkTextReadiness, getToastMessage, showToast, t]);

  const handleFlashcards = useCallback(() => {
    const selected = allItems.filter(i => selectedIds.has(i.id));
    const { status, items } = checkTextReadiness(selected);
    if (status === 'all_empty') {
      showToast(getToastMessage(items));
      return;
    }
    if (status === 'some_empty') showToast(getToastMessage(items));
    onGenerateFlashcards?.(selected);
  }, [allItems, selectedIds, onGenerateFlashcards, checkTextReadiness, getToastMessage, showToast]);

  // ── UI builders ─────────────────────────────────────────────────────────────

  const filterChips = useMemo(() => {
    const labels: Record<FilterKey, string> = {
      all:    t('ai.filterAll', 'Todos'),
      audio:  t('ai.filterAudio', 'Grabaciones'),
      videos: t('ai.filterVideos', 'Videos'),
      docs:   t('ai.filterDocs', 'Docs'),
      photos: t('ai.filterPhotos', 'Fotos'),
    };
    return (['all', 'docs', 'photos', 'audio', 'videos'] as FilterKey[])
      .filter(k => k === 'all' || categoryCounts[k] > 0)
      .map(k => ({
        key: k,
        label: labels[k],
        count: categoryCounts[k],
        active: activeFilter === k,
      }));
  }, [t, categoryCounts, activeFilter]);

  const typeMeta: Record<AIContextItemType, { icon: string; color: string; label: string }> = {
    document:   { icon: 'file-document-outline', color: '#8B7FFF', label: 'PDF' },
    photo:      { icon: 'image-outline',         color: '#38BDF8', label: 'FOTO' },
    recording:  { icon: 'microphone',            color: '#34D399', label: 'AUDIO' },
    video:      { icon: 'logo-youtube',          color: '#F87171', label: 'VIDEO' },
  };

  if (!isVisible) return null;

  return (
    <View style={StyleSheet.absoluteFill}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={handleClose} />
      <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>

        {/* Handle */}
        <View style={s.handle} />

        {/* Header */}
        <View style={s.header}>
          <View style={s.aiIconWrap}>
            <LottieView source={zyrenOrbAnimation} autoPlay loop style={{ width: 34, height: 34 }} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Zyren</Text>
            <Text style={s.subtitle} numberOfLines={1}>
              {t('ai.addContext', 'Añade contexto a tu sesión')}
            </Text>
          </View>
          <TouchableOpacity onPress={handleClose} style={s.closeBtn}>
            <Ionicons name="close" size={18} color={TXT_PRI} />
          </TouchableOpacity>
        </View>

        {/* 🔍 Search bar */}
        <View style={s.searchContainer}>
          <Ionicons name="search" size={16} color={TXT_SEC} style={{ marginRight: 8 }} />
          <TextInput
            ref={searchRef}
            value={searchQuery}
            onChangeText={handleSearch}
            placeholder={t('ai.searchPlaceholder', 'Buscar archivo...')}
            placeholderTextColor={TXT_SEC}
            style={s.searchInput}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={clearSearch} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close-circle" size={16} color={TXT_SEC} />
            </TouchableOpacity>
          )}
        </View>

        {/* Category pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filterRow}
          style={{ flexGrow: 0 }}
        >
          {filterChips.map(f => (
            <TouchableOpacity
              key={f.key}
              onPress={() => handleFilterPress(f.key)}
              style={[s.chip, f.active && s.chipActive]}
              activeOpacity={0.7}
            >
              <Text style={[s.chipText, f.active && s.chipTextActive]}>{f.label}</Text>
              {f.count > 0 && (
                <View style={[s.chipBadge, f.active && s.chipBadgeActive]}>
                  <Text style={[s.chipBadgeText, f.active && { color: PRIMARY }]}>{f.count}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Content area */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
        >
          {isInitialLoading ? (
            <View style={s.emptyState}>
              <Animated.View style={{ transform: [{ rotate: spinInterpolation }] }}>
                <MaterialCommunityIcons name="sync" size={36} color={PRIMARY} />
              </Animated.View>
              <Animated.Text style={[s.loadingText, { opacity: loadingOpacity }]}>
                {t('ai.searching', 'Buscando archivos...')}
              </Animated.Text>
            </View>
          ) : !hasContent ? (
            <View style={s.emptyState}>
              <MaterialCommunityIcons name="folder-open-outline" size={52} color="rgba(255,255,255,0.1)" />
              <Text style={s.emptyTitle}>{t('ai.emptyNoResources', 'Sin recursos')}</Text>
              <Text style={s.emptyText}>
                {t('ai.emptyNoResourcesText', 'Agrega grabaciones, fotos, documentos o videos a esta materia para usar la IA.')}
              </Text>
            </View>
          ) : !showContent ? (
            <View style={s.emptyState}>
              <MaterialCommunityIcons name="file-find-outline" size={42} color="rgba(255,255,255,0.1)" />
              <Text style={s.emptyTitle}>{t('ai.searchPrompt', 'Busca o selecciona una categoría para comenzar')}</Text>
            </View>
          ) : visibleItems.length === 0 ? (
            <View style={s.emptyState}>
              <MaterialCommunityIcons name="filter-outline" size={42} color="rgba(255,255,255,0.1)" />
              <Text style={s.emptyTitle}>{t('ai.emptyNoResults', 'Sin resultados')}</Text>
              <Text style={s.emptyText}>{t('ai.emptyNoResultsText', 'No hay archivos de este tipo.')}</Text>
            </View>
          ) : (
            <>
              {visibleItems.map(item => {
                const m = typeMeta[item.type];
                const isSelected = selectedIds.has(item.id);
                return (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.75}
                    onPress={() => handleToggle(item.id)}
                    style={[s.listItem, isSelected && s.listItemSelected]}
                  >
                    <View style={[s.listIconBg, { backgroundColor: `${m.color}20` }]}>
                      <MaterialCommunityIcons name={m.icon as any} size={20} color={m.color} />
                    </View>
                    <View style={s.listInfo}>
                      <Text numberOfLines={1} style={s.listLabel}>{item.label}</Text>
                      <Text style={s.listMeta}>
                        {m.label}
                        {item.hasText ? ` • ${t('ai.ready', 'Listo')}` : ` • ${t('ai.noText', 'Sin texto')}`}
                      </Text>
                    </View>
                    <View style={[s.listCheck, isSelected && s.listCheckActive]}>
                      {isSelected && <Ionicons name="checkmark" size={12} color="#fff" />}
                    </View>
                  </TouchableOpacity>
                );
              })}
              {totalMatching > visibleCount && (
                <TouchableOpacity onPress={showMore} style={s.seeMoreBtn} activeOpacity={0.7}>
                  <Text style={s.seeMoreText}>
                    {t('ai.seeMore', { count: totalMatching - visibleCount, defaultValue: `Ver más (${totalMatching - visibleCount} más)` })}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </ScrollView>

        {/* Bottom action bar */}
        <View style={s.actionBar}>
          {totalSelected > 0 && (
            <Animated.View style={[s.counterBadge, { transform: [{ scale: badgeScale }] }]}>
              <Ionicons name="checkmark-circle" size={13} color={PRIMARY} />
              <Text style={s.counterText}>
                {t('ai.filesSelected', { count: totalSelected, plural: totalSelected !== 1 ? 's' : '', defaultValue: `${totalSelected} archivo${totalSelected !== 1 ? 's' : ''} seleccionado${totalSelected !== 1 ? 's' : ''}` })}
              </Text>
            </Animated.View>
          )}

          <View style={s.btnRow}>
            <TouchableOpacity
              onPress={handleAsk}
              activeOpacity={0.82}
              style={[s.btn, s.btnPrimary]}
            >
              <MaterialCommunityIcons name="chat-processing-outline" size={18} color="#fff" />
              <Text style={s.btnPrimaryText}>{t('ai.talkWithZyren', 'Habla con Zyren')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleFlashcards}
              disabled={totalSelected === 0}
              activeOpacity={0.82}
              style={[
                s.btn, s.btnSecondary,
                totalSelected === 0 && s.btnDisabled,
              ]}
            >
              <MaterialCommunityIcons name="cards-outline" size={18} color={totalSelected > 0 ? TXT_PRI : TXT_SEC} />
              <Text style={[s.btnSecondaryText, totalSelected === 0 && { color: TXT_SEC }]}>
                {t('ai.flashcardsBtn', 'Flashcards')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Toast */}
        <Animated.View style={[s.toast, { opacity: toastOpacity }]} pointerEvents="none">
          <Text style={s.toastText}>{toastMsg}</Text>
        </Animated.View>

      </View>
    </View>
  );
};
