import React, { useEffect, useState, useRef, useMemo } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { documentViewerStyles as styles } from '../../src/styles/DocumentViewer.styles';
import { theme } from '../../src/styles/theme';
import { createDocumentSystem } from '../../src/services/document/DocumentSystemFactory';
import { AssetDocumentSource } from '../../src/services/document/AssetDocumentSource';
import { DocumentModelBuilder } from '../../src/domain/document/DocumentModelBuilder';
import type { DocumentModel } from '../../src/domain/document/DocumentModel';
import type { ExtractedDocument } from '../../src/domain/document/ExtractedDocument';
import { DocumentWorkspace } from '../../src/services/document/DocumentWorkspace';
import { createMMKV, type MMKV } from 'react-native-mmkv';

const PDF_DIR = `${require('expo-file-system/legacy').documentDirectory}Threshold/pdf/`;

// ── Persistent extraction cache (survives process restarts) ────────────────
// Lazy-initialized: MMKV native module must not be called at module load time
// or it crashes on HMR with 'prototype of undefined'.
let _extractionStore: MMKV | null = null;
const EXTRACTION_CACHE_VERSION = 2; // bumped: invalida cache de extracciones con regex roto

function getStore(): MMKV {
  if (!_extractionStore) {
    _extractionStore = createMMKV({ id: 'doc-extraction-cache' });
  }
  return _extractionStore;
}

function getExtractionCacheKey(hash: string) {
  return `v${EXTRACTION_CACHE_VERSION}:${hash}`;
}

function readExtractionCache(hash: string): ExtractedDocument | null {
  if (!hash) return null;
  try {
    const raw = getStore().getString(getExtractionCacheKey(hash));
    if (!raw) return null;
    return JSON.parse(raw) as ExtractedDocument;
  } catch {
    return null;
  }
}

function writeExtractionCache(hash: string, doc: ExtractedDocument) {
  if (!hash) return;
  try {
    getStore().set(getExtractionCacheKey(hash), JSON.stringify(doc));
  } catch {}
}

const nullRepo = {
  getById: async () => null,
  getByAssetId: async () => null,
  save: async () => {},
  delete: async () => {},
};

// In-memory model cache — persists while the app is alive (max 5 docs)
const MODEL_CACHE_MAX = 5;
const modelCache = new Map<string, DocumentModel>();
function getCached(key: string): DocumentModel | undefined { return modelCache.get(key); }
function setCached(key: string, model: DocumentModel) {
  if (modelCache.size >= MODEL_CACHE_MAX) {
    // Evict the oldest entry
    const oldest = modelCache.keys().next().value;
    if (oldest) modelCache.delete(oldest);
  }
  modelCache.set(key, model);
}

export default function DocumentViewerScreen() {
  const { documentUri, documentTitle } = useLocalSearchParams<{
    documentUri: string;
    documentTitle: string;
  }>();
  const router = useRouter();

  const [model, setModel] = useState<DocumentModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stable rendererRegistry — only created once per screen mount
  const rendererRegistry = useMemo(() => createDocumentSystem(nullRepo).rendererRegistry, []);

  useEffect(() => {
    // Cancellation flag: if the user navigates back before the doc finishes
    // loading, we abort all state updates to avoid stale-closure leaks.
    let cancelled = false;

    const load = async () => {
      if (!documentUri) {
        if (!cancelled) { setError('No se proporcionó URI del documento'); setLoading(false); }
        return;
      }

      const fullUri = documentUri.startsWith('file://')
        ? documentUri
        : `${PDF_DIR}${documentUri}`;

      // Evict stale in-memory model on every load.
      // Prevents a version-bumped extractor from being blocked by a model
      // that was built from a previous (broken) extraction in the same session.
      modelCache.delete(fullUri);

      // ── Fast path: model already cached ──────────────────────
      const cached = getCached(fullUri);
      if (cached) {
        if (!cancelled) { setModel(cached); setLoading(false); }
        return;
      }

      // ── Slow path: parse PDF and build model ──────────────────
      if (!cancelled) { setLoading(true); setError(null); }

      try {
        const system = createDocumentSystem(nullRepo);

        const ext = fullUri.split('.').pop()?.toLowerCase() || '';
        const mimeMap: Record<string, string> = {
          pdf: 'application/pdf',
          txt: 'text/plain',
          json: 'application/json',
          xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          xlsm: 'application/vnd.ms-excel.sheet.macroEnabled.12',
          xls: 'application/vnd.ms-excel',
          csv: 'text/csv',
          pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          ppt: 'application/vnd.ms-powerpoint',
        };
        const mimeType = mimeMap[ext] || 'application/pdf';

        const source = await AssetDocumentSource.fromFile(fullUri, mimeType);
        if (cancelled) return;

        // ── Persistent extraction cache (MMKV, keyed by file hash) ──
        let extracted: ExtractedDocument | null = readExtractionCache(source.hash);

        if (!extracted) {
          try {
            extracted = await system.extractorRegistry.resolve(source).extractDocument(source);
            writeExtractionCache(source.hash, extracted);
          } catch {
            extracted = {
              metadata: { format: 'application/pdf', title: documentTitle || 'Documento', pageCount: 0 },
              textBlocks: [],
              images: [],
              tables: [],
            };
          }
        }
        if (cancelled) return;

        const builder = new DocumentModelBuilder(extracted);
        const docModel = builder.build(fullUri, documentTitle || 'Documento');

        setCached(fullUri, docModel);
        if (!cancelled) setModel(docModel);
      } catch (e: any) {
        console.error('[DocumentViewer] Error loading:', e);
        if (!cancelled) setError(e.message || 'Error al cargar el documento');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      // Screen unmounting or documentUri changed — cancel any in-flight work
      cancelled = true;
      setModel(null);
      setLoading(true);
      setError(null);
    };
  }, [documentUri]);

  const title = documentTitle || 'Documento';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ── Header ────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={22} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
      </View>

      {/* ── States ────────────────────────────────────────────────── */}
      {loading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Cargando documento…</Text>
        </View>
      )}

      {!loading && error && (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorHint}>Verifica que el archivo no esté corrupto o protegido</Text>
        </View>
      )}

      {!loading && !error && model && (
        <DocumentWorkspace
          model={model}
          rendererRegistry={rendererRegistry}
        />
      )}
    </SafeAreaView>
  );
}
