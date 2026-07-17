import { useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { DocumentModel, DocumentTocEntry } from '../../domain/document/DocumentModel';
import type { DocumentSelection } from '../../domain/document/DocumentSelection';
import type { RendererRegistry } from '../../domain/document/RendererRegistry';
import type { ScrollToPageRef } from '../../domain/document/DocumentRenderer';
import type { DocumentSource } from '../../domain/document/DocumentSource';
import { documentWorkspaceStyles as styles } from '../../styles/DocumentWorkspace.styles';
import { theme } from '../../styles/theme';
import { DocumentSelectionToolbar } from './DocumentSelectionToolbar';
import type { TextSelectionEvent } from './PdfRenderer';
import type { PdfSearchRef, PdfHighlightRef } from './NativePdfRenderer';
import { ClipboardCopyUseCase } from './ClipboardCopyUseCase';
import { SharingTextUseCase } from './SharingTextUseCase';
import { useCustomAlert } from '../../components/ui/CustomAlert';
import { SearchBar } from './SearchBar';
import { Ionicons } from '@expo/vector-icons';
import { createHighlight, getHighlights, deleteHighlight, updateHighlightColor } from './HighlightService';
import type { DocumentHighlight, HighlightColor } from '../../domain/document/DocumentHighlight';

const copyUseCase = new ClipboardCopyUseCase();
const shareUseCase = new SharingTextUseCase();

interface DocumentWorkspaceProps {
  model: DocumentModel;
  rendererRegistry: RendererRegistry;
  source?: DocumentSource;
  onAction?: (
    action: import('../../domain/document/DocumentAction').DocumentAction,
    selection?: DocumentSelection,
  ) => void;
}

export function DocumentWorkspace({ model, rendererRegistry, source }: DocumentWorkspaceProps): ReactNode {
  const insets = useSafeAreaInsets();
  const { showAlert } = useCustomAlert();
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [tocVisible, setTocVisible] = useState(false);
  const [jumpVisible, setJumpVisible] = useState(false);
  const [jumpInput, setJumpInput] = useState('');
  const [keyboardUp, setKeyboardUp] = useState(false);
  const [currentSelection, setCurrentSelection] = useState<TextSelectionEvent | null>(null);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchCurrentIdx, setSearchCurrentIdx] = useState(0);
  const pdfSearchRef = useRef<PdfSearchRef | null>(null);
  const highlightsRef = useRef<PdfHighlightRef | null>(null);
  const [highlights, setHighlights] = useState<DocumentHighlight[]>([]);
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardUp(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardUp(false);
      setJumpVisible(false);
      setJumpInput('');
    });
    return () => { show.remove(); hide.remove(); };
  }, []);

  // Load highlights on mount
  useEffect(() => {
    getHighlights(model.documentId).then(hl => {
      setHighlights(hl);
      highlightsRef.current?.set(hl);
    });
  }, [model.documentId]);

  // Push highlights to renderer whenever they change
  useEffect(() => {
    highlightsRef.current?.set(highlights);
  }, [highlights]);

  const scrollToPageRef = useRef<((page: number) => void) | null>(null) as ScrollToPageRef;

  const handlePageChange = useCallback((pageIndex: number) => {
    setCurrentPage(pageIndex + 1);
  }, []);

  const handleDocumentReady = useCallback((total: number) => {
    setTotalPages(total);
    if (highlightsRef.current) {
      highlightsRef.current.set(highlights);
    }
  }, [highlights]);

  const goToPage = useCallback(
    (oneBased: number) => {
      const clamped = Math.max(1, Math.min(oneBased, totalPages || 1));
      setCurrentPage(clamped);
      scrollToPageRef.current?.(clamped - 1);
    },
    [totalPages],
  );

  const handleJumpConfirm = useCallback(() => {
    const n = parseInt(jumpInput, 10);
    if (!isNaN(n)) goToPage(n);
    setJumpVisible(false);
    setJumpInput('');
  }, [jumpInput, goToPage]);

  const navigateToPage = useCallback(
    (pageIndex: number) => {
      goToPage(pageIndex + 1);
      setTocVisible(false);
    },
    [goToPage],
  );

  const toggleSearch = useCallback(() => {
    setSearchVisible(v => {
      if (v) {
        pdfSearchRef.current?.clear();
        setSearchTotal(0);
        setSearchCurrentIdx(0);
      }
      return !v;
    });
  }, []);

  const handleSelection = useCallback((event: TextSelectionEvent) => {
    setCurrentSelection(event);
  }, []);

  const handleCopy = useCallback(async () => {
    if (!currentSelection) return;
    const selection: DocumentSelection = {
      selectionFingerprint: `${model.documentId}-${currentSelection.pageIndex}-${currentSelection.startIndex}`,
      documentId: model.documentId,
      range: { start: currentSelection.startIndex, end: currentSelection.endIndex },
      content: { text: currentSelection.text },
      metadata: { page: currentSelection.pageIndex, timestamp: new Date() },
    };
    const ok = await copyUseCase.execute(selection);
    setCurrentSelection(null);
    if (ok) {
      showAlert({ title: 'Copiado', message: 'Texto copiado al portapapeles', type: 'success' });
    }
  }, [currentSelection, model.documentId, showAlert]);

  const handleShare = useCallback(async () => {
    if (!currentSelection) return;
    const selection: DocumentSelection = {
      selectionFingerprint: `${model.documentId}-${currentSelection.pageIndex}-${currentSelection.startIndex}`,
      documentId: model.documentId,
      range: { start: currentSelection.startIndex, end: currentSelection.endIndex },
      content: { text: currentSelection.text },
      metadata: { page: currentSelection.pageIndex, timestamp: new Date() },
    };
    await shareUseCase.execute(selection, model.title);
    setCurrentSelection(null);
  }, [currentSelection, model.documentId, model.title]);

  const handleCloseSelection = useCallback(() => {
    setCurrentSelection(null);
    setActiveHighlightId(null);
  }, []);

  const handleHighlight = useCallback(async (color: HighlightColor) => {
    if (!currentSelection) return;

    if (activeHighlightId) {
      const existing = highlights.find(h => h.id === activeHighlightId);
      if (existing) {
        const updated = await updateHighlightColor(existing, color);
        setHighlights(prev => prev.map(h => (h.id === existing.id ? updated : h)));
      }
    } else {
      const hl = await createHighlight({
        documentId: model.documentId,
        pageIndex: currentSelection.pageIndex,
        text: currentSelection.text,
        color,
        anchorOffset: currentSelection.startIndex,
        focusOffset: currentSelection.endIndex,
      });
      setHighlights(prev => [...prev, hl]);
    }
    
    setCurrentSelection(null);
    setActiveHighlightId(null);
  }, [currentSelection, activeHighlightId, highlights, model.documentId]);

  const handleHighlightTapped = useCallback((id: string) => {
    const hl = highlights.find(h => h.id === id);
    if (!hl) return;
    
    setActiveHighlightId(hl.id);
    setCurrentSelection({
      documentId: hl.documentId,
      pageIndex: hl.pageIndex,
      blockIndex: 0,
      text: hl.text,
      startIndex: hl.anchorOffset,
      endIndex: hl.focusOffset
    });
  }, [highlights]);

  const handleDeleteHighlight = useCallback(async () => {
    if (!activeHighlightId) return;
    await deleteHighlight(activeHighlightId);
    setHighlights(prev => prev.filter(h => h.id !== activeHighlightId));
    setCurrentSelection(null);
    setActiveHighlightId(null);
  }, [activeHighlightId]);

  const renderer = rendererRegistry.resolve(model);
  const rendered = renderer.render(
    model,
    handlePageChange,
    scrollToPageRef,
    handleDocumentReady,
    handleSelection,
    undefined,
    pdfSearchRef,
    (total: number, current: number) => {
      setSearchTotal(total);
      setSearchCurrentIdx(current);
    },
    highlightsRef,
    handleHighlightTapped,
    source,
  );

  const knownTotal = totalPages > 0 ? totalPages : model.pages.length || 0;
  const progress = knownTotal > 0 ? currentPage / knownTotal : 0;
  const hasToc = model.tableOfContents.length > 0;
  const canPrev = currentPage > 1;
  const canNext = knownTotal > 0 && currentPage < knownTotal;

  return (
    <View style={styles.container}>
      {searchVisible && (
        <View style={styles.searchBarContainer}>
          <SearchBar
            resultCount={searchTotal}
            currentIndex={searchCurrentIdx}
            onSearch={(q) => pdfSearchRef.current?.search(q.text)}
            onNext={() => pdfSearchRef.current?.next()}
            onPrev={() => pdfSearchRef.current?.prev()}
            onClear={() => { pdfSearchRef.current?.clear(); setSearchTotal(0); setSearchCurrentIdx(0); }}
          />
        </View>
      )}
      <View style={styles.content}>{rendered as ReactNode}</View>

      <DocumentSelectionToolbar
        selection={currentSelection}
        onCopy={handleCopy}
        onShare={handleShare}
        onHighlight={handleHighlight}
        onClose={handleCloseSelection}
        onDelete={handleDeleteHighlight}
        bottomInset={insets.bottom || 0}
        mode={activeHighlightId ? 'edit' : 'create'}
      />

      {/* ── Bottom HUD ───────────────────────────────────────────── */}
      <View style={[styles.hud, { paddingBottom: insets.bottom || 8 }]}>
        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>

        <View style={styles.hudRow}>
          {/* Prev button */}
          <TouchableOpacity
            onPress={() => goToPage(currentPage - 1)}
            disabled={!canPrev}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[styles.navBtn, !canPrev && styles.navBtnDisabled]}
          >
            <Text style={[styles.navBtnText, !canPrev && styles.navBtnTextDisabled]}>‹</Text>
          </TouchableOpacity>

          {/* Page counter — tap to jump */}
          <TouchableOpacity
            onPress={() => {
              setJumpInput(String(currentPage));
              setJumpVisible(true);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
            style={styles.pageCounter}
          >
            <Text style={styles.pageText}>
              {knownTotal > 0 ? `${currentPage} / ${knownTotal}` : '…'}
            </Text>
          </TouchableOpacity>

          {/* Next button */}
          <TouchableOpacity
            onPress={() => goToPage(currentPage + 1)}
            disabled={!canNext}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[styles.navBtn, !canNext && styles.navBtnDisabled]}
          >
            <Text style={[styles.navBtnText, !canNext && styles.navBtnTextDisabled]}>›</Text>
          </TouchableOpacity>

          {hasToc && (
            <TouchableOpacity
              onPress={() => setTocVisible(true)}
              style={styles.tocBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.tocBtnText}>☰</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={toggleSearch}
            style={[styles.tocBtn, searchVisible && { backgroundColor: 'rgba(0,122,255,0.15)' }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name="search"
              size={18}
              color={searchVisible ? '#007AFF' : theme.colors.text.secondary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Jump to page modal ──────────────────────────────────── */}
      <Modal
        visible={jumpVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setJumpVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.jumpModal}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={() => setJumpVisible(false)}
          />
          <View style={[styles.jumpSheet, { paddingBottom: keyboardUp ? 8 : Math.max(insets.bottom, 20) + 12 }]}>
            <Text style={styles.jumpLabel}>Ir a página</Text>
            <View style={styles.jumpRow}>
              <TextInput
                style={styles.jumpInput}
                value={jumpInput}
                onChangeText={setJumpInput}
                keyboardType="number-pad"
                autoFocus
                selectTextOnFocus
                returnKeyType="go"
                onSubmitEditing={handleJumpConfirm}
                placeholder={String(currentPage)}
                placeholderTextColor={theme.colors.text.secondary}
                maxLength={5}
              />
              <Text style={styles.jumpOf}>/ {knownTotal || '?'}</Text>
              <TouchableOpacity style={styles.jumpGoBtn} onPress={handleJumpConfirm}>
                <Text style={styles.jumpGoBtnText}>Ir</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── TOC Modal ────────────────────────────────────────────── */}
      <Modal
        visible={tocVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setTocVisible(false)}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setTocVisible(false)}
        />
        <SafeAreaView style={styles.tocSheet} edges={['bottom']}>
          <View style={styles.tocHeader}>
            <Text style={styles.tocTitle}>Índice del documento</Text>
            <TouchableOpacity onPress={() => setTocVisible(false)}>
              <Text style={styles.tocClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <FlatList<DocumentTocEntry>
            data={model.tableOfContents as DocumentTocEntry[]}
            keyExtractor={(item, i) => `${item.pageIndex}-${i}`}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.tocItem,
                  item.pageIndex === currentPage - 1 && styles.tocItemActive,
                ]}
                onPress={() => navigateToPage(item.pageIndex)}
              >
                <Text style={styles.tocItemNum}>{item.pageIndex + 1}</Text>
                <Text
                  style={[
                    styles.tocItemTitle,
                    item.pageIndex === currentPage - 1 && styles.tocItemTitleActive,
                  ]}
                  numberOfLines={2}
                >
                  {item.title}
                </Text>
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}
