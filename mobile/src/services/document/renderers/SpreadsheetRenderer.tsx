import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { WebView } from 'react-native-webview';
import type { DocumentModel } from '../../../domain/document/DocumentModel';
import type {
  DocumentRenderer,
  OnDocumentReady,
  OnPageChange,
  ScrollToPageRef,
} from '../../../domain/document/DocumentRenderer';
import type { SpreadsheetMetadata, SpreadsheetSheet } from '../extractors/XlsxExtractor';
import { theme } from '../../../styles/theme';
import type { MutableRefObject } from 'react';

// ── Renderer class (DocumentRenderer contract) ────────────────────────────────

export class SpreadsheetRenderer implements DocumentRenderer {
  supports(model: DocumentModel): boolean {
    const format = model.pages[0]?.content?.metadata?.format?.toLowerCase() || '';
    return format === 'xlsx' || format === 'xls' || format === 'csv';
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
      <SpreadsheetRendererContent
        model={model}
        onDocumentReady={onDocumentReady}
      />
    );
  }
}

// ── Content component ─────────────────────────────────────────────────────────

interface SpreadsheetRendererContentProps {
  model: DocumentModel;
  onDocumentReady?: OnDocumentReady;
}

function SpreadsheetRendererContent({ model, onDocumentReady }: SpreadsheetRendererContentProps) {
  const meta = model.pages[0]?.content.metadata as unknown as SpreadsheetMetadata | undefined;
  const sheets: SpreadsheetSheet[] = (meta?.sheets as SpreadsheetSheet[]) ?? [];

  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const notifiedReady = useRef(false);

  const activeSheet = sheets[activeSheetIndex];

  const html = useMemo(() => {
    if (!activeSheet) return buildEmptyHtml();
    return buildSheetHtml(activeSheet);
  }, [activeSheet]);

  const handleWebViewLoad = useCallback(() => {
    if (!notifiedReady.current) {
      notifiedReady.current = true;
      onDocumentReady?.(Math.max(sheets.length, 1));
    }
  }, [onDocumentReady, sheets.length]);

  const handleSheetSelect = useCallback((index: number) => {
    setActiveSheetIndex(index);
  }, []);

  return (
    <View style={styles.container}>
      {/* ── Sheet selector ──────────────────────────────────────── */}
      {sheets.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabBar}
          contentContainerStyle={styles.tabBarContent}
        >
          {sheets.map((sheet, index) => (
            <TouchableOpacity
              key={`${sheet.name}-${index}`}
              style={[styles.tab, activeSheetIndex === index && styles.tabActive]}
              onPress={() => handleSheetSelect(index)}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.tabText, activeSheetIndex === index && styles.tabTextActive]}
                numberOfLines={1}
              >
                {sheet.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* ── Spreadsheet WebView ─────────────────────────────────── */}
      {activeSheet ? (
        <WebView
          key={`sheet-${activeSheetIndex}`}  // force remount on sheet change
          source={{ html }}
          style={styles.webView}
          originWhitelist={['*']}
          scrollEnabled
          onLoad={handleWebViewLoad}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          overScrollMode="never"
          bounces={false}
        />
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Este archivo no contiene hojas de cálculo.</Text>
        </View>
      )}
    </View>
  );
}

// ── HTML generation ───────────────────────────────────────────────────────────

function buildSheetHtml(sheet: SpreadsheetSheet): string {
  const headerCells = sheet.headers
    .map(
      (h, colIdx) =>
        `<th data-sheet="${esc(sheet.name)}" data-row="0" data-col="${colIdx}">${esc(h)}</th>`,
    )
    .join('');

  const dataRows = sheet.rows
    .map((row, rowIdx) => {
      const cells = sheet.headers
        .map(
          (_, colIdx) =>
            `<td data-sheet="${esc(sheet.name)}" data-row="${rowIdx + 1}" data-col="${colIdx}">${esc(String(row[colIdx] ?? ''))}</td>`,
        )
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: #1A1A1A;
    color: #E8E8E8;
    font-family: -apple-system, 'Helvetica Neue', sans-serif;
    font-size: 13px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .sheet-name {
    padding: 10px 14px 6px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.6px;
    text-transform: uppercase;
    color: #777;
  }

  .table-wrapper {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    padding-bottom: 40px;
  }

  table {
    border-collapse: collapse;
    min-width: 100%;
    white-space: nowrap;
  }

  thead {
    position: sticky;
    top: 0;
    z-index: 10;
  }

  th {
    background: #252525;
    color: #AEAEAE;
    font-weight: 600;
    font-size: 11px;
    letter-spacing: 0.3px;
    padding: 10px 14px;
    border-bottom: 1px solid #333;
    border-right: 1px solid #2A2A2A;
    text-align: left;
    white-space: nowrap;
    user-select: none;
  }

  td {
    padding: 9px 14px;
    border-bottom: 1px solid #242424;
    border-right: 1px solid #242424;
    color: #E0E0E0;
    vertical-align: middle;
    white-space: nowrap;
    user-select: text;
  }

  tr:nth-child(even) td { background: #1F1F1F; }
  tr:hover td { background: #252E3A; }

  td:empty::after {
    content: '—';
    color: #444;
  }

  td[data-col="0"] {
    color: #E8E8E8;
    font-weight: 500;
  }
</style>
</head>
<body>
  <div class="sheet-name">${esc(sheet.name)}</div>
  <div class="table-wrapper">
    <table>
      <thead><tr>${headerCells}</tr></thead>
      <tbody>${dataRows}</tbody>
    </table>
  </div>
</body>
</html>`;
}

function buildEmptyHtml(): string {
  return `<!DOCTYPE html><html><body style="background:#1A1A1A;color:#666;display:flex;align-items:center;justify-content:center;height:100vh;font-family:-apple-system,sans-serif;font-size:14px;">Sin contenido</body></html>`;
}

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A1A',
  },
  tabBar: {
    backgroundColor: '#141414',
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
    maxHeight: 44,
    flexShrink: 0,
  },
  tabBarContent: {
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 4,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 6,
  },
  tabActive: {
    backgroundColor: '#252E3A',
  },
  tabText: {
    fontSize: 13,
    color: '#777',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  webView: {
    flex: 1,
    backgroundColor: '#1A1A1A',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#666',
    fontSize: 14,
  },
});
