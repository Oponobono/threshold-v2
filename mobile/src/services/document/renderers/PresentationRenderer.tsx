import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import type { DocumentModel } from '../../../domain/document/DocumentModel';
import type {
  DocumentRenderer,
  OnDocumentReady,
  OnPageChange,
  ScrollToPageRef,
} from '../../../domain/document/DocumentRenderer';
import type { PptxMetadata, PptxSlide } from '../extractors/PptxExtractor';
import type { MutableRefObject } from 'react';
import { theme } from '../../../styles/theme';
import { VisualCacheManager, type VisualRepresentationStatus } from '../VisualCacheManager';
import { NativePdfRenderer } from '../NativePdfRenderer';
import { AssetDocumentSource } from '../AssetDocumentSource';
import { DocumentModelBuilder } from '../../../domain/document/DocumentModelBuilder';

// ── Renderer class ─────────────────────────────────────────────────────────────

export class PresentationRenderer implements DocumentRenderer {
  supports(model: DocumentModel): boolean {
    const format = model.pages[0]?.content?.metadata?.format?.toLowerCase() || '';
    return format === 'pptx' || format === 'ppt';
  }

  render(
    model: DocumentModel,
    onPageChange?: OnPageChange,
    scrollToPageRef?: ScrollToPageRef,
    onDocumentReady?: OnDocumentReady,
    onSelection?: any,
    highlightedBlockId?: string,
    searchRef?: MutableRefObject<any>,
    onSearchResult?: any,
    highlightsRef?: MutableRefObject<any>,
    onHighlightTapped?: (id: string) => void,
  ): unknown {
    return (
      <PresentationRendererContent
        model={model}
        onDocumentReady={onDocumentReady}
        onPageChange={onPageChange}
        scrollToPageRef={scrollToPageRef}
        onSelection={onSelection}
        highlightedBlockId={highlightedBlockId}
        searchRef={searchRef}
        onSearchResult={onSearchResult}
        highlightsRef={highlightsRef}
        onHighlightTapped={onHighlightTapped}
      />
    );
  }
}

// ── Content Component ──────────────────────────────────────────────────────────

interface PresentationRendererContentProps {
  model: DocumentModel;
  onDocumentReady?: OnDocumentReady;
  onPageChange?: OnPageChange;
  scrollToPageRef?: ScrollToPageRef;
  onSelection?: any;
  highlightedBlockId?: string;
  searchRef?: MutableRefObject<any>;
  onSearchResult?: any;
  highlightsRef?: MutableRefObject<any>;
  onHighlightTapped?: (id: string) => void;
}

function PresentationRendererContent({
  model,
  onDocumentReady,
  onPageChange,
  scrollToPageRef,
  onSelection,
  highlightedBlockId,
  searchRef,
  onSearchResult,
  highlightsRef,
  onHighlightTapped,
}: PresentationRendererContentProps) {
  const documentId = model.documentId;
  const meta = model.pages[0]?.content.metadata as unknown as PptxMetadata | undefined;
  const slides: PptxSlide[] = (meta?.slides ?? []) as PptxSlide[];
  // localUri viene en la metadata del extractor (field: sourceUri o uri)
  const localUri: string = (meta as any)?.localUri ?? (meta as any)?.sourceUri ?? documentId;

  const [visualStatus, setVisualStatus] = useState<VisualRepresentationStatus>(
    () => VisualCacheManager.getStatus(documentId),
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pdfModel, setPdfModel] = useState<DocumentModel | null>(null);
  const notifiedReady = useRef(false);
  const conversionStarted = useRef(false);

  // Notificar cantidad de páginas al workspace
  const handleLayout = useCallback(() => {
    if (!notifiedReady.current) {
      notifiedReady.current = true;
      onDocumentReady?.(Math.max(slides.length, 1));
    }
  }, [onDocumentReady, slides.length]);

  // ── Fase 2: Cargar PDF cacheado o iniciar conversión ────────────────────────
  useEffect(() => {
    if (visualStatus === 'AVAILABLE') {
      const cachedUri = VisualCacheManager.getCachedPdfUri(documentId);
      if (cachedUri) loadPdfModel(cachedUri);
      return;
    }

    if (visualStatus === 'PENDING' || visualStatus === 'FAILED' || visualStatus === 'UNSUPPORTED') return;

    // NONE → intentar conversión si hay internet
    if (conversionStarted.current) return;
    conversionStarted.current = true;

    (async () => {
      const net = await NetInfo.fetch();
      console.log('[PPT] NetInfo:', net.isConnected, net.type);
      if (!net.isConnected) {
        console.warn('[PPT] Sin conexión, usando fallback de texto');
        return;
      }

      const mimeType = model.pages[0]?.content?.metadata?.format === 'ppt'
        ? 'application/vnd.ms-powerpoint'
        : 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

      console.log('[PPT] Iniciando conversión:', { localUri, mimeType });

      try {
        VisualCacheManager.setStatus(documentId, 'PENDING');
        setVisualStatus('PENDING');

        const { convertPresentationToPdf } = require('../../api/documents');
        console.log('[PPT] Llamando convertPresentationToPdf...');
        const pdfData: ArrayBuffer = await convertPresentationToPdf(localUri, mimeType);
        console.log('[PPT] PDF recibido, tamaño:', pdfData.byteLength);

        const pdfUri = await VisualCacheManager.storePdf(documentId, pdfData);
        console.log('[PPT] PDF guardado en:', pdfUri);
        setVisualStatus('AVAILABLE');
        loadPdfModel(pdfUri);
      } catch (err: any) {
        const isMissingLibreOffice = err?.message === 'LIBREOFFICE_UNAVAILABLE';
        const newStatus: VisualRepresentationStatus = isMissingLibreOffice ? 'UNSUPPORTED' : 'FAILED';
        VisualCacheManager.setStatus(documentId, isMissingLibreOffice ? 'NONE' : 'FAILED');
        setVisualStatus(newStatus);
        setErrorMessage(err?.message || String(err));
        console.warn('[PresentationRenderer] Conversión falló:', err?.message);
      }
    })();
  }, [documentId, visualStatus, model]);

  async function loadPdfModel(pdfUri: string) {
    try {
      const source = await AssetDocumentSource.fromFile(pdfUri, 'application/pdf');
      const { PdfDocumentExtractor } = require('../PdfDocumentExtractor');
      const extractor = new PdfDocumentExtractor();
      const extracted = await extractor.extractDocument(source);
      const builder = new DocumentModelBuilder(extracted);
      const built = builder.build(pdfUri, model.title);
      setPdfModel(built);
      // Notificar con el conteo de páginas real del PDF
      if (!notifiedReady.current) {
        notifiedReady.current = true;
        onDocumentReady?.(built.pages.length);
      }
    } catch (e) {
      console.warn('[PresentationRenderer] Error cargando PDF cacheado:', e);
      VisualCacheManager.invalidate(documentId);
      setVisualStatus('NONE');
    }
  }

  // ── Si el PDF está listo → delegar al NativePdfRenderer ───────────────────
  if (visualStatus === 'AVAILABLE' && pdfModel) {
    const pdfRenderer = new NativePdfRenderer();
    return pdfRenderer.render(
      pdfModel,
      onPageChange,
      scrollToPageRef,
      onDocumentReady,
      onSelection,
      highlightedBlockId,
      searchRef,
      onSearchResult,
      highlightsRef,
      onHighlightTapped,
    ) as React.ReactElement;
  }

  // ── Fallback: vista semántica de texto ─────────────────────────────────────
  return (
    <View style={styles.container} onLayout={handleLayout}>
      {/* Banner de estado */}
      <StatusBanner status={visualStatus} errorMessage={errorMessage} />

      {/* Lista de diapositivas */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {slides.length > 0 ? (
          slides.map((slide) => <SlideCard key={slide.index} slide={slide} />)
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Esta presentación no contiene diapositivas con texto.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ── Status Banner ──────────────────────────────────────────────────────────────

function StatusBanner({ status, errorMessage }: { status: VisualRepresentationStatus, errorMessage?: string | null }) {
  if (status === 'NONE') {
    return (
      <View style={[styles.banner, styles.bannerOffline]}>
        <Text style={[styles.bannerText, styles.bannerTextOffline]}>
          Modo lectura. Conéctate a Internet para generar la vista visual de alta fidelidad.
        </Text>
      </View>
    );
  }
  if (status === 'UNSUPPORTED') {
    return (
      <View style={[styles.banner, styles.bannerOffline]}>
        <Text style={[styles.bannerText, styles.bannerTextOffline]}>
          El servidor no dispone de conversión de presentaciones. Vista de texto disponible.
        </Text>
      </View>
    );
  }
  if (status === 'PENDING') {
    return (
      <View style={[styles.banner, styles.bannerPending]}>
        <ActivityIndicator size="small" color="#FFB300" style={{ marginRight: 8 }} />
        <Text style={[styles.bannerText, styles.bannerTextPending]}>
          Generando representación visual…
        </Text>
      </View>
    );
  }
  if (status === 'FAILED') {
    return (
      <View style={[styles.banner, styles.bannerFailed]}>
        <Text style={[styles.bannerText, styles.bannerTextFailed]}>
          No fue posible generar la vista visual: {errorMessage || 'Error desconocido'}. El contenido sigue accesible en modo lectura.
        </Text>
      </View>
    );
  }
  return null;
}

// ── Slide Card ─────────────────────────────────────────────────────────────────

function SlideCard({ slide }: { slide: PptxSlide }) {
  return (
    <View style={styles.slideCard}>
      <View style={styles.slideIndexChip}>
        <Text style={styles.slideIndexText}>{slide.index}</Text>
      </View>
      {slide.title && (
        <Text style={styles.slideTitle} numberOfLines={3}>{slide.title}</Text>
      )}
      {slide.blocks.slice(1).map((block, i) => (
        <Text key={i} style={styles.slideBody}>{block}</Text>
      ))}
      {slide.notes && (
        <View style={styles.notesContainer}>
          <Text style={styles.notesLabel}>NOTAS</Text>
          <Text style={styles.notesText}>{slide.notes}</Text>
        </View>
      )}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexShrink: 0,
  },
  bannerOffline: { backgroundColor: '#1A1A2E', borderBottomWidth: 1, borderColor: '#2A2A4A' },
  bannerPending: { backgroundColor: '#2A1F00', borderBottomWidth: 1, borderColor: '#4D3800' },
  bannerFailed:  { backgroundColor: '#2A0000', borderBottomWidth: 1, borderColor: '#4D0000' },
  bannerText: { fontSize: 12, lineHeight: 17, flex: 1 },
  bannerTextOffline: { color: '#8888CC' },
  bannerTextPending: { color: '#FFB300' },
  bannerTextFailed:  { color: '#FF6B6B' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, gap: 12, paddingBottom: 40 },
  slideCard: {
    backgroundColor: theme.colors.card || '#1E1E1E',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border || '#2C2C2C',
  },
  slideIndexChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#D24726',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 10,
  },
  slideIndexText: { color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  slideTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text?.primary || '#E8E8E8',
    marginBottom: 8,
    lineHeight: 22,
  },
  slideBody: {
    fontSize: 13,
    color: theme.colors.text?.secondary || '#999',
    lineHeight: 20,
    marginTop: 4,
  },
  notesContainer: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: theme.colors.border || '#2C2C2C',
  },
  notesLabel: { fontSize: 10, fontWeight: '700', color: '#666', letterSpacing: 0.8, marginBottom: 4 },
  notesText: { fontSize: 12, color: '#777', fontStyle: 'italic', lineHeight: 18 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyText: { color: '#666', fontSize: 14 },
});
