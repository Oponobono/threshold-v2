import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, Modal, TouchableOpacity, ScrollView,
  Animated, Dimensions, StyleSheet,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AIContextItemData, AIContextItemType } from './AIContextItem';
import { BentoContextCard, CELL_W, FULL_W } from './BentoContextCard';
import { RecordingItem } from '../hooks/useAudioRecorder';
import { YouTubeVideo } from '../services/api/types';
import { mapRecordings, mapPhotos, mapDocuments, mapVideos } from '../utils/aiContextMappers';

// ─── Constants ────────────────────────────────────────────────────────────────
const PRIMARY   = '#7B72FF';
const ASK_CLR   = '#00C896';
const BG_SHEET  = '#0E0E18';
const BG_CARD   = '#1C1C2A';
const BORDER    = 'rgba(255,255,255,0.08)';
const TXT_PRI   = '#F0F0F8';
const TXT_SEC   = 'rgba(240,240,248,0.45)';
const GAP       = 10;
const PAD       = 20;

type FilterKey = 'all' | 'audio' | 'videos' | 'docs' | 'photos';
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',    label: 'Todo'   },
  { key: 'audio',  label: 'Audio'  },
  { key: 'videos', label: 'Videos' },
  { key: 'docs',   label: 'Docs'   },
  { key: 'photos', label: 'Fotos'  },
];

const FILTER_TYPE_MAP: Partial<Record<FilterKey, AIContextItemType>> = {
  audio:  'recording',
  videos: 'video',
  docs:   'document',
  photos: 'photo',
};

// ─── Bento span assignment ────────────────────────────────────────────────────
// Only the first card in the filtered list is a hero (full-width).
// Everything else is 'half' so items pair up in 2-column rows.
function assignSpan(_item: AIContextItemData, index: number, list: AIContextItemData[]): 'full' | 'half' {
  if (list.length <= 2) return 'full';   // ≤2 items → each gets full width
  if (index === 0) return 'full';        // single hero anchor card
  return 'half';
}

// Build rows: 'full' items get their own row; 'half' items fill rows of 3 (3-column grid).
function buildRows(items: AIContextItemData[]) {
  type Cell = { item: AIContextItemData; span: 'full' | 'half' };
  const cells: Cell[] = items.map((item, i) => ({ item, span: assignSpan(item, i, items) }));
  const rows: Cell[][] = [];
  let i = 0;
  while (i < cells.length) {
    if (cells[i].span === 'full') {
      rows.push([cells[i]]);
      i++;
    } else {
      // Collect up to 3 consecutive half-cells per row
      const group: Cell[] = [];
      while (i < cells.length && cells[i].span === 'half' && group.length < 3) {
        group.push(cells[i]);
        i++;
      }
      rows.push(group);
    }
  }
  return rows;
}

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
 * SubjectAIContextModal — Bento Grid redesign (iOS 18 / Apple Intelligence dark aesthetic).
 *
 * Bottom Sheet with Smart Filter chips, modular Bento Grid cards, glassmorphism
 * action bar, and an animated selection counter badge.
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
  const badgeScale = useRef(new Animated.Value(1)).current;

  // ── Toast de advertencia ────────────────────────────────────────────────────
  const [toastMsg, setToastMsg] = useState('');
  const toastOpacity = useRef(new Animated.Value(0)).current;

  /** Muestra un toast que se desvanece automáticamente en ~3 segundos */
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

  // Sincronizar selectedIds con los items actuales — limpiar IDs que ya no existen
  useEffect(() => {
    setSelectedIds(prev => {
      const validIds = new Set(allItems.map(item => item.id));
      const cleaned = new Set(Array.from(prev).filter(id => validIds.has(id)));
      // Solo actualizar el estado si hay cambios
      return cleaned.size === prev.size ? prev : cleaned;
    });
  }, [allItems]);

  // Filter items
  const filteredItems = useMemo(() => {
    if (activeFilter === 'all') return allItems;
    const type = FILTER_TYPE_MAP[activeFilter];
    return allItems.filter(i => i.type === type);
  }, [allItems, activeFilter]);

  const rows = useMemo(() => buildRows(filteredItems), [filteredItems]);
  const totalSelected = selectedIds.size;
  const hasContent = allItems.length > 0;

  // Pulse badge on count change
  const pulseBadge = useCallback(() => {
    Animated.sequence([
      Animated.spring(badgeScale, { toValue: 1.25, useNativeDriver: true, tension: 400, friction: 12 }),
      Animated.spring(badgeScale, { toValue: 1,    useNativeDriver: true, tension: 400, friction: 12 }),
    ]).start();
  }, []);

  const handleToggle = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    pulseBadge();
  }, [pulseBadge]);

  const handleClose = () => { setSelectedIds(new Set()); setActiveFilter('all'); onClose(); };

  /**
   * Valida que los ítems seleccionados tengan texto procesado.
   * Retorna 'all_empty' si ninguno tiene texto, 'some_empty' si algunos no,
   * o 'ok' si todos tienen texto.
   */
  const checkTextReadiness = useCallback((selected: AIContextItemData[]) => {
    const withoutText = selected.filter(i => i.hasText === false);
    if (withoutText.length === 0) return { status: 'ok' as const, items: [] };
    if (withoutText.length === selected.length) return { status: 'all_empty' as const, items: withoutText };
    return { status: 'some_empty' as const, items: withoutText };
  }, []);

  /** Genera el mensaje de toast según los tipos de ítems sin texto */
  const getToastMessage = useCallback((items: AIContextItemData[]) => {
    const hasAudioVideo = items.some(i => i.type === 'recording' || i.type === 'video');
    const hasDocPhoto   = items.some(i => i.type === 'document'  || i.type === 'photo');
    if (hasAudioVideo && hasDocPhoto)
      return '⚠️ Transcribe los audios/videos y analiza con OCR los documentos/fotos antes de continuar.';
    if (hasAudioVideo)
      return '⚠️ Primero debes transcribir los archivos de audio o video antes de usarlos como contexto.';
    return '⚠️ Primero debes analizar los documentos o fotos con OCR antes de usarlos como contexto.';
  }, []);

  const handleAsk = useCallback(() => {
    const selected = allItems.filter(i => selectedIds.has(i.id));
    
    // Si no hay nada seleccionado, abrir chat sin contexto (Zyren responderá abiertamente)
    if (selected.length === 0) {
      showToast('💬 Abriendo chat libre. Puedes hacer preguntas sin contexto.');
      onAskQuestions?.(selected);
      return;
    }
    
    const { status, items } = checkTextReadiness(selected);
    if (status === 'all_empty') {
      showToast(getToastMessage(items));
      return; // bloquear — no hay texto con que responder
    }
    if (status === 'some_empty') showToast(getToastMessage(items)); // advertir pero continuar
    onAskQuestions?.(selected);
  }, [allItems, selectedIds, onAskQuestions, checkTextReadiness, getToastMessage, showToast]);

  const handleFlashcards = useCallback(() => {
    const selected = allItems.filter(i => selectedIds.has(i.id));
    const { status, items } = checkTextReadiness(selected);
    if (status === 'all_empty') {
      showToast(getToastMessage(items));
      return; // bloquear — sin texto no se pueden generar flashcards
    }
    if (status === 'some_empty') showToast(getToastMessage(items)); // advertir pero continuar
    onGenerateFlashcards?.(selected);
  }, [allItems, selectedIds, onGenerateFlashcards, checkTextReadiness, getToastMessage, showToast]);

  return (
    <Modal visible={isVisible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={s.backdrop}>
        <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>

          {/* Handle */}
          <View style={s.handle} />

          {/* Header */}
          <View style={s.header}>
            <View style={s.aiIconWrap}>
              <MaterialCommunityIcons name="auto-fix" size={18} color={PRIMARY} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Zyren</Text>
              <Text style={s.subtitle} numberOfLines={1}>
                Añade contexto a tu sesión
              </Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={s.closeBtn}>
              <Ionicons name="close" size={18} color={TXT_PRI} />
            </TouchableOpacity>
          </View>

          {/* Smart Filter chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.filterRow}
            style={{ flexGrow: 0 }}
          >
            {FILTERS.map(f => {
              const active = activeFilter === f.key;
              const count = f.key === 'all'
                ? allItems.length
                : allItems.filter(i => i.type === FILTER_TYPE_MAP[f.key]).length;
              if (f.key !== 'all' && count === 0) return null;
              return (
                <TouchableOpacity
                  key={f.key}
                  onPress={() => setActiveFilter(f.key)}
                  style={[s.chip, active && s.chipActive]}
                  activeOpacity={0.7}
                >
                  <Text style={[s.chipText, active && s.chipTextActive]}>{f.label}</Text>
                  {count > 0 && (
                    <View style={[s.chipBadge, active && s.chipBadgeActive]}>
                      <Text style={[s.chipBadgeText, active && { color: PRIMARY }]}>{count}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Bento Grid */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={s.gridContent}
            showsVerticalScrollIndicator={false}
          >
            {!hasContent ? (
              <View style={s.emptyState}>
                <MaterialCommunityIcons name="folder-open-outline" size={52} color="rgba(255,255,255,0.1)" />
                <Text style={s.emptyTitle}>Sin recursos</Text>
                <Text style={s.emptyText}>
                  Agrega grabaciones, fotos, documentos o videos a esta materia para usar la IA.
                </Text>
              </View>
            ) : filteredItems.length === 0 ? (
              <View style={s.emptyState}>
                <MaterialCommunityIcons name="filter-outline" size={42} color="rgba(255,255,255,0.1)" />
                <Text style={s.emptyTitle}>Sin resultados</Text>
                <Text style={s.emptyText}>No hay archivos de este tipo.</Text>
              </View>
            ) : (
              rows.map((row, ri) => (
                <View key={ri} style={s.row}>
                  {row.map(({ item, span }) => (
                    <BentoContextCard
                      key={item.id}
                      item={item}
                      span={span}
                      isSelected={selectedIds.has(item.id)}
                      onToggle={handleToggle}
                    />
                  ))}
                </View>
              ))
            )}
          </ScrollView>

          {/* Glassmorphism bottom action bar */}
          <View style={s.actionBar}>
            {/* Floating counter badge */}
            {totalSelected > 0 && (
              <Animated.View style={[s.counterBadge, { transform: [{ scale: badgeScale }] }]}>
                <Ionicons name="checkmark-circle" size={13} color={PRIMARY} />
                <Text style={s.counterText}>
                  {totalSelected} {totalSelected === 1 ? 'archivo' : 'archivos'} seleccionados
                </Text>
              </Animated.View>
            )}

            <View style={s.btnRow}>
              {/* Primary: Ask Assistant — HABILITADO incluso sin archivos para chat libre */}
              <TouchableOpacity
                onPress={handleAsk}
                activeOpacity={0.82}
                style={[
                  s.btn, s.btnPrimary,
                ]}
              >
                <MaterialCommunityIcons name="chat-processing-outline" size={18} color="#fff" />
                <Text style={s.btnPrimaryText}>Habla con Zyren</Text>
              </TouchableOpacity>

              {/* Secondary: Flashcards — REQUIERE archivos con contenido */}
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
                  Flashcards
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Toast de advertencia — se desvanece automáticamente */}
          <Animated.View style={[s.toast, { opacity: toastOpacity }]} pointerEvents="none">
            <Text style={s.toastText}>{toastMsg}</Text>
          </Animated.View>

        </View>
      </View>
    </Modal>
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
    gap: 12, marginBottom: 16,
    paddingHorizontal: PAD,
  },
  aiIconWrap: {
    width: 34, height: 34, borderRadius: 11,
    backgroundColor: `${PRIMARY}20`,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: `${PRIMARY}30`,
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

  // Grid
  gridContent: { paddingHorizontal: PAD, paddingBottom: 24, paddingTop: 4 },
  row: {
    flexDirection: 'row', gap: GAP, marginBottom: GAP,
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

  // Toast de advertencia
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
