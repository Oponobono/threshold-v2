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
import type { DocumentSource } from '../../../domain/document/DocumentSource';
import type { SpreadsheetMetadata, SpreadsheetSheet } from '../extractors/XlsxExtractor';
import { theme } from '../../../styles/theme';
import type { MutableRefObject } from 'react';

// ── Renderer class (DocumentRenderer contract) ────────────────────────────────

export class SpreadsheetRenderer implements DocumentRenderer {
  supports(model: DocumentModel): boolean {
    const format = model.pages[0]?.content?.metadata?.format?.toLowerCase() || '';
    return format === 'xlsx' || format === 'xlsm' || format === 'xls' || format === 'csv';
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
    _source?: DocumentSource,
  ): unknown {
    return (
      <SpreadsheetRendererContent
        model={model}
        onDocumentReady={onDocumentReady}
        onPageChange={onPageChange}
        scrollToPageRef={scrollToPageRef}
      />
    );
  }
}

// ── Content component ─────────────────────────────────────────────────────────

interface SpreadsheetRendererContentProps {
  model: DocumentModel;
  onDocumentReady?: OnDocumentReady;
  onPageChange?: OnPageChange;
  scrollToPageRef?: ScrollToPageRef;
}

function SpreadsheetRendererContent({ model, onDocumentReady, onPageChange, scrollToPageRef }: SpreadsheetRendererContentProps) {
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
    onPageChange?.(index);
  }, [onPageChange]);

  // Permite que los botones de HUD (<- ->) cambien la hoja
  useMemo(() => {
    if (scrollToPageRef) {
      scrollToPageRef.current = (pageIndex: number) => {
        if (pageIndex >= 0 && pageIndex < sheets.length) {
          setActiveSheetIndex(pageIndex);
        }
      };
    }
  }, [scrollToPageRef, sheets.length]);

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

function getColumnLetter(index: number): string {
  let name = '';
  let i = index;
  while (i >= 0) {
    name = String.fromCharCode(65 + (i % 26)) + name;
    i = Math.floor(i / 26) - 1;
  }
  return name;
}

function buildSheetHtml(sheet: SpreadsheetSheet): string {
  const colLetterHeaders = sheet.headers.map((_, colIdx) => {
    return `<th class="col-header">${getColumnLetter(colIdx)}</th>`;
  }).join('');
  const theadHtml = `<thead><tr><th class="corner-header"></th>${colLetterHeaders}</tr></thead>`;

  const row1Cells = sheet.headers.map((h, colIdx) => 
    `<td data-sheet="${esc(sheet.name)}" data-row="0" data-col="${colIdx}">${esc(h)}</td>`
  ).join('');
  const row1Html = `<tr><td class="row-header">1</td>${row1Cells}</tr>`;

  const dataRowsHtml = sheet.rows.map((row, rowIdx) => {
    const cells = sheet.headers.map((_, colIdx) => 
      `<td data-sheet="${esc(sheet.name)}" data-row="${rowIdx + 1}" data-col="${colIdx}">${esc(String(row[colIdx] ?? ''))}</td>`
    ).join('');
    return `<tr><td class="row-header">${rowIdx + 2}</td>${cells}</tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }

  html, body {
    height: 100%;
    overflow: hidden; /* Prevent body scroll */
  }

  body {
    display: flex;
    flex-direction: column;
    background: #1A1A1A;
    color: #E8E8E8;
    font-family: -apple-system, 'Helvetica Neue', sans-serif;
    font-size: 13px;
  }

  .sheet-name {
    flex-shrink: 0;
    padding: 10px 14px 6px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.6px;
    text-transform: uppercase;
    color: #777;
    background: #1A1A1A;
    z-index: 30;
  }

  .table-wrapper {
    flex: 1;
    overflow: auto; /* Handles both X and Y scrolling */
    -webkit-overflow-scrolling: touch;
  }

  table {
    border-collapse: collapse;
    min-width: 100%;
    white-space: nowrap;
  }

  thead {
    /* Using position sticky directly on th is generally more robust in WebViews */
  }

  th {
    background: #252525;
    color: #AEAEAE;
    font-weight: 600;
    font-size: 11px;
    letter-spacing: 0.3px;
    padding: 8px 14px;
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

  /* Excel-like coordinates styling */
  .corner-header {
    position: sticky;
    left: 0;
    top: 0;
    z-index: 20;
    background: #1F1F1F;
    border-right: 1px solid #333;
    border-bottom: 1px solid #333;
    min-width: 40px;
  }

  .col-header {
    position: sticky;
    top: 0;
    z-index: 10;
    text-align: center;
    background: #1F1F1F;
    border-right: 1px solid #333;
    border-bottom: 1px solid #333;
    color: #888;
  }

  .row-header {
    position: sticky;
    left: 0;
    z-index: 5;
    background: #1F1F1F !important;
    color: #888;
    font-weight: 600;
    font-size: 11px;
    text-align: center;
    border-right: 1px solid #333;
    user-select: none;
    min-width: 40px;
  }
</style>
</head>
<body>
  <div class="sheet-name">${esc(sheet.name)}</div>
  <div class="table-wrapper">
    <table>
      ${theadHtml}
      <tbody>
        ${row1Html}
        ${dataRowsHtml}
      </tbody>
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
