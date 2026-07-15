import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { theme } from '../../src/styles/theme';
import { createDocumentSystem } from '../../src/services/document/DocumentSystemFactory';
import { AssetDocumentSource } from '../../src/services/document/AssetDocumentSource';
import { DocumentModelBuilder } from '../../src/domain/document/DocumentModelBuilder';
import type { DocumentModel } from '../../src/domain/document/DocumentModel';
import type { ExtractedDocument } from '../../src/domain/document/ExtractedDocument';
import { DocumentWorkspace } from '../../src/services/document/DocumentWorkspace';

const PDF_DIR = `${require('expo-file-system/legacy').documentDirectory}Threshold/pdf/`;

const nullRepo = {
  getById: async () => null,
  getByAssetId: async () => null,
  save: async () => {},
  delete: async () => {},
};

export default function DocumentViewerScreen() {
  const { documentUri, documentTitle } = useLocalSearchParams<{
    documentUri: string;
    documentTitle: string;
  }>();
  const router = useRouter();

  const [model, setModel] = useState<DocumentModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!documentUri) {
      setError('No se proporcionó URI del documento');
      setLoading(false);
      return;
    }
    loadDocument();
  }, [documentUri]);

  const loadDocument = async () => {
    try {
      setLoading(true);
      setError(null);

      const system = createDocumentSystem(nullRepo);

      const fullUri = documentUri.startsWith('file://')
        ? documentUri
        : `${PDF_DIR}${documentUri}`;

      const source = await AssetDocumentSource.fromFile(fullUri, 'application/pdf');
      // Fast path: skip heavy textual extraction for visual rendering.
      // NativePdfRenderer uses WebView + PDF.js which doesn't need the parsed text.
      const extractedFast: ExtractedDocument = {
        metadata: { format: 'application/pdf', title: documentTitle || 'Documento', pageCount: 0 },
        textBlocks: [],
        images: [],
        tables: [],
      };

      const builder = new DocumentModelBuilder(extractedFast);
      const docModel = builder.build(fullUri, documentTitle || 'Documento');

      setModel(docModel);
    } catch (e: any) {
      console.error('[DocumentViewer] Error loading:', e);
      setError(e.message || 'Error al cargar el documento');
    } finally {
      setLoading(false);
    }
  };

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
          rendererRegistry={createDocumentSystem(nullRepo).rendererRegistry}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: theme.colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  backBtn: {
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: theme.colors.text.primary,
  },
  errorText: {
    fontSize: 15,
    color: theme.colors.text.primary,
    textAlign: 'center',
  },
  errorHint: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    textAlign: 'center',
  },
});
