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

const zyrenOrbAnimation = require('../../lottieFiles/ai_orb.json');

// ─── Constants ────────────────────────────────────────────────────────────────
const PRIMARY   = '#7B72FF';
const ASK_CLR   = '#00C896';
const BG_SHEET  = '#0E0E18';
const BG_CARD   = '#1C1C2A';
const BORDER    = 'rgba(255,255,255,0.08)';
const TXT_PRI   = '#F0F0F8';
const TXT_SEC   = 'rgba(240,240,248,0.45)';
const PAD       = 20;

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
  const badgeScale = useRef(new Animated.Value(1)).current;
  const searchRef = useRef<TextInput>(null);

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
  }, []);

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
          {!hasContent ? (
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

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.62)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: BG_SHEET,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    height: '92%',
    paddingTop: 12,
    overflow: 'hidden',
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  handle: {
    width: 38, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignSelf: 'center', marginBottom: 18,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    gap: 12, marginBottom: 12,
    paddingHorizontal: PAD,
  },
  aiIconWrap: {
    width: 34, height: 34,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  title: {
    fontSize: 17, fontWeight: '800', color: TXT_PRI, letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 12, color: TXT_SEC, marginTop: 2,
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: BORDER,
  },

  // 🔍 Search bar
  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: PAD, marginBottom: 12,
    paddingHorizontal: 12, height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: BORDER,
  },
  searchInput: {
    flex: 1,
    fontSize: 14, color: TXT_PRI,
    paddingVertical: 0,
  },

  // Filter chips
  filterRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: PAD, paddingBottom: 14,
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  chipActive: {
    borderColor: `${PRIMARY}60`,
    backgroundColor: `${PRIMARY}18`,
  },
  chipText: { fontSize: 13, fontWeight: '600', color: TXT_SEC },
  chipTextActive: { color: PRIMARY },
  chipBadge: {
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
  },
  chipBadgeActive: { backgroundColor: `${PRIMARY}22` },
  chipBadgeText: { fontSize: 10, fontWeight: '700', color: TXT_SEC },

  // List content
  listContent: {
    paddingHorizontal: PAD, paddingBottom: 24, paddingTop: 4,
  },

  // List item compact
  listItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 12,
    marginBottom: 6,
    borderRadius: 14,
    backgroundColor: BG_CARD,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  listItemSelected: {
    backgroundColor: `${PRIMARY}12`,
    borderColor: `${PRIMARY}40`,
  },
  listIconBg: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 10,
  },
  listInfo: {
    flex: 1, marginRight: 8,
  },
  listLabel: {
    fontSize: 13, fontWeight: '600', color: TXT_PRI,
  },
  listMeta: {
    fontSize: 10, color: TXT_SEC, marginTop: 2,
  },
  listCheck: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  listCheckActive: {
    backgroundColor: PRIMARY,
    borderWidth: 0,
  },

  // See more
  seeMoreBtn: {
    alignItems: 'center', paddingVertical: 14, marginTop: 2,
  },
  seeMoreText: {
    fontSize: 13, fontWeight: '700', color: PRIMARY,
  },

  // Empty state
  emptyState: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 60, gap: 12, paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 16, fontWeight: '700', color: TXT_PRI,
  },
  emptyText: {
    fontSize: 13, color: TXT_SEC,
    textAlign: 'center', lineHeight: 20,
  },

  // Action bar
  actionBar: {
    paddingHorizontal: PAD,
    paddingTop: 14,
    paddingBottom: 6,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    backgroundColor: 'rgba(14,14,24,0.88)',
    gap: 10,
  },
  counterBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'center',
    backgroundColor: `${PRIMARY}15`,
    borderRadius: 20, borderWidth: 1, borderColor: `${PRIMARY}30`,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  counterText: {
    fontSize: 12, fontWeight: '700', color: PRIMARY,
  },
  btnRow: {
    flexDirection: 'row', gap: 10,
  },
  btn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
    paddingVertical: 15, borderRadius: 18,
  },
  btnPrimary: {
    backgroundColor: ASK_CLR,
    shadowColor: ASK_CLR,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  btnPrimaryText: {
    color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: -0.2,
  },
  btnSecondary: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  btnSecondaryText: {
    color: TXT_PRI, fontSize: 14, fontWeight: '700', letterSpacing: -0.2,
  },
  btnDisabled: {
    opacity: 0.35,
    shadowOpacity: 0,
    elevation: 0,
  },

  // Toast
  toast: {
    position: 'absolute',
    bottom: 120,
    left: PAD,
    right: PAD,
    backgroundColor: 'rgba(20,20,36,0.97)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,200,60,0.40)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 14,
  },
  toastText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFD96A',
    lineHeight: 19,
    textAlign: 'center',
  },
});
