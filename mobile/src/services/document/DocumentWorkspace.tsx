import { useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
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
import { theme } from '../../styles/theme';

interface DocumentWorkspaceProps {
  model: DocumentModel;
  rendererRegistry: RendererRegistry;
  onAction?: (
    action: import('../../domain/document/DocumentAction').DocumentAction,
    selection?: DocumentSelection,
  ) => void;
}

export function DocumentWorkspace({ model, rendererRegistry }: DocumentWorkspaceProps): ReactNode {
  const insets = useSafeAreaInsets();
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [tocVisible, setTocVisible] = useState(false);
  const [jumpVisible, setJumpVisible] = useState(false);
  const [jumpInput, setJumpInput] = useState('');
  const [keyboardUp, setKeyboardUp] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardUp(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardUp(false);
      setJumpVisible(false);
      setJumpInput('');
    });
    return () => { show.remove(); hide.remove(); };
  }, []);

  const scrollToPageRef = useRef<((page: number) => void) | null>(null) as ScrollToPageRef;

  const handlePageChange = useCallback((pageIndex: number) => {
    setCurrentPage(pageIndex + 1);
  }, []);

  const handleDocumentReady = useCallback((total: number) => {
    setTotalPages(total);
  }, []);

  const goToPage = useCallback(
    (oneBased: number) => {
      const clamped = Math.max(1, Math.min(oneBased, totalPages || 1));
      setCurrentPage(clamped);
      scrollToPageRef.current?.(clamped - 1); // 0-indexed
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

  const renderer = rendererRegistry.resolve(model);
  const rendered = renderer.render(model, handlePageChange, scrollToPageRef, handleDocumentReady);

  const knownTotal = totalPages > 0 ? totalPages : model.pages.length || 0;
  const progress = knownTotal > 0 ? currentPage / knownTotal : 0;
  const hasToc = model.tableOfContents.length > 0;
  const canPrev = currentPage > 1;
  const canNext = knownTotal > 0 && currentPage < knownTotal;

  return (
    <View style={styles.container}>
      {/* ── Viewer ───────────────────────────────────────────────── */}
      <View style={styles.content}>{rendered as ReactNode}</View>

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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { flex: 1 },

  // HUD
  hud: {
    backgroundColor: theme.colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  progressTrack: { height: 3, backgroundColor: theme.colors.border },
  progressFill: { height: 3, backgroundColor: theme.colors.primary },
  hudRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },

  // Nav buttons
  navBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: `${theme.colors.primary}15`,
  },
  navBtnDisabled: { backgroundColor: 'transparent' },
  navBtnText: { fontSize: 22, color: theme.colors.primary, lineHeight: 26 },
  navBtnTextDisabled: { color: theme.colors.border },

  // Page counter
  pageCounter: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
  },
  pageText: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    fontVariant: ['tabular-nums'],
  },

  // TOC button
  tocBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  tocBtnText: { fontSize: 18, color: theme.colors.text.secondary },

  // Jump modal
  backdrop: { flex: 1 },
  jumpModal: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  jumpSheet: {
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 16,
  },
  jumpLabel: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    marginBottom: 10,
    textAlign: 'center',
  },
  jumpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  jumpInput: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    paddingHorizontal: 8,
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text.primary,
    textAlign: 'center',
    backgroundColor: theme.colors.background,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
  jumpOf: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    fontVariant: ['tabular-nums'],
  },
  jumpGoBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  jumpGoBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  // TOC
  tocSheet: {
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '65%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 12,
  },
  tocHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  tocTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.text.primary },
  tocClose: { fontSize: 16, color: theme.colors.text.secondary },
  tocItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 11,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  tocItemActive: { backgroundColor: `${theme.colors.primary}18` },
  tocItemNum: {
    fontSize: 11,
    color: theme.colors.text.secondary,
    fontVariant: ['tabular-nums'],
    minWidth: 22,
    textAlign: 'right',
    marginTop: 2,
  },
  tocItemTitle: { fontSize: 14, color: theme.colors.text.primary, flex: 1, lineHeight: 20 },
  tocItemTitleActive: { color: theme.colors.primary, fontWeight: '600' },
});
