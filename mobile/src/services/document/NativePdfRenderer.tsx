import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import { theme } from '../../styles/theme';
import type {
  DocumentRenderer,
  OnPageChange,
  OnDocumentReady,
  ScrollToPageRef,
  OnSearchResult,
} from '../../domain/document/DocumentRenderer';
import type { DocumentModel } from '../../domain/document/DocumentModel';
import type { MutableRefObject } from 'react';

export class NativePdfRenderer implements DocumentRenderer {
  render(
    model: DocumentModel,
    onPageChange?: OnPageChange,
    scrollToPageRef?: ScrollToPageRef,
    onDocumentReady?: OnDocumentReady,
    _onSelection?: unknown,
    _highlightedBlockId?: string,
    searchRef?: MutableRefObject<PdfSearchRef | null>,
    onSearchResult?: OnSearchResult,
  ): unknown {
    const fileUri = model.documentId.startsWith('file://')
      ? model.documentId
      : `${FileSystem.documentDirectory}Threshold/pdf/${model.documentId}`;

    return (
      <NativePdfRendererContent
        fileUri={fileUri}
        onPageChange={onPageChange}
        scrollToPageRef={scrollToPageRef}
        onDocumentReady={onDocumentReady}
        searchRef={searchRef}
        onSearchResult={onSearchResult}
      />
    );
  }
}

interface NativePdfRendererContentProps {
  fileUri: string;
  onPageChange?: OnPageChange;
  scrollToPageRef?: ScrollToPageRef;
  onDocumentReady?: OnDocumentReady;
  searchRef?: MutableRefObject<PdfSearchRef | null>;
  onSearchResult?: OnSearchResult;
}

export interface PdfSearchRef {
  search: (term: string) => void;
  next: () => void;
  prev: () => void;
  clear: () => void;
}

function buildHtmlFromUri(fileUri: string, bgColor: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=4.0, user-scalable=yes" />
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: ${bgColor}; width: 100%; overflow-x: hidden; }
    #pdf-container {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      padding: 8px 0;
      gap: 8px;
      width: 100%;
    }
    .page-wrapper {
      position: relative;
      width: 100%;
      display: block;
    }
    canvas {
      width: 100% !important;
      height: auto !important;
      display: block;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    }
    .highlight {
      position: absolute;
      background: rgba(255, 220, 0, 0.45);
      border-radius: 2px;
      pointer-events: none;
    }
    .highlight.active {
      background: rgba(255, 140, 0, 0.65);
    }
  </style>
</head>
<body>
  <div id="pdf-container"></div>
  <script>
    function postMsg(obj) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(obj));
      }
    }

    window.onerror = function(message, source, lineno) {
      postMsg({ type: 'error', message: 'Global Error: ' + message + ' at line ' + lineno });
    };

    try {
      if (typeof pdfjsLib === 'undefined') {
        throw new Error('PDF.js falló al cargar. Verifica tu conexión a internet.');
      }
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    } catch (err) {
      postMsg({ type: 'error', message: err.message });
    }

    var totalPages = 0;
    var lastReportedPage = 0;
    // pageData[pageNum] = { canvas, viewport, textItems }
    var pageData = {};
    var allMatches = [];
    var currentMatchIndex = -1;

    function getCurrentPage() {
      var wrappers = document.querySelectorAll('.page-wrapper[data-page]');
      if (!wrappers.length) return 1;
      var mid = window.scrollY + window.innerHeight / 2;
      var current = 1;
      wrappers.forEach(function(w) {
        if (w.offsetTop <= mid) {
          current = parseInt(w.getAttribute('data-page'), 10);
        }
      });
      return current;
    }

    window.addEventListener('scroll', function() {
      var p = getCurrentPage();
      if (p !== lastReportedPage) {
        lastReportedPage = p;
        postMsg({ type: 'pageChange', page: p });
      }
    }, { passive: true });

    // ── Search engine ───────────────────────────────────────────
    function clearHighlights() {
      document.querySelectorAll('.highlight').forEach(function(el) { el.remove(); });
      allMatches = [];
      currentMatchIndex = -1;
    }

    function buildHighlight(wrapper, item, viewport, isActive) {
      var canvas = wrapper.querySelector('canvas');
      // displayScale: ratio between displayed canvas px and natural canvas px
      var displayScale = canvas.offsetWidth / viewport.width;

      // item.transform = [a, b, c, d, tx, ty] in PDF user space
      // viewport.scale converts user-space → natural canvas pixels
      // Y-axis is flipped: PDF origin is bottom-left, CSS origin is top-left
      var vScale = viewport.scale;
      var tx = item.transform[4];
      var ty = item.transform[5];
      // font size (d component) gives the character height in user space
      var fontSizeUser = Math.abs(item.transform[3]);
      // ascent is roughly 80% of font size (typical for most fonts)
      var ascentUser = fontSizeUser * 0.8;

      // canvas-pixel coords (before display scaling)
      var canvasX = tx * vScale;
      // ty is the baseline; top of the glyph = baseline + ascent (PDF Y goes up)
      var canvasY = viewport.height - (ty + ascentUser) * vScale;
      var canvasW = item.width * vScale;
      var canvasH = fontSizeUser * vScale;

      var el = document.createElement('div');
      el.className = 'highlight' + (isActive ? ' active' : '');
      el.style.left   = (canvasX * displayScale) + 'px';
      el.style.top    = (canvasY * displayScale) + 'px';
      el.style.width  = (canvasW * displayScale) + 'px';
      el.style.height = (canvasH * displayScale) + 'px';
      wrapper.appendChild(el);
      return el;
    }

    function searchInAllPages(term) {
      clearHighlights();
      if (!term || !term.trim()) {
        postMsg({ type: 'searchResult', total: 0, current: 0 });
        return;
      }
      var lower = term.toLowerCase();
      var matches = [];

      Object.keys(pageData).sort(function(a,b){ return parseInt(a)-parseInt(b); }).forEach(function(pageNum) {
        var data = pageData[pageNum];
        if (!data || !data.textItems) return;
        var wrapper = document.querySelector('.page-wrapper[data-page="' + pageNum + '"]');
        if (!wrapper) return;

        data.textItems.forEach(function(item) {
          if (!item.str || !item.str.toLowerCase().includes(lower)) return;
          matches.push({
            pageNum: parseInt(pageNum),
            wrapper: wrapper,
            viewport: data.viewport,
            item: item
          });
        });
      });

      allMatches = matches;
      matches.forEach(function(m) {
        m.el = buildHighlight(m.wrapper, m.item, m.viewport, false);
      });

      if (matches.length > 0) {
        currentMatchIndex = 0;
        activateMatch(0);
      } else {
        postMsg({ type: 'searchResult', total: 0, current: 0 });
      }
    }

    function activateMatch(index) {
      allMatches.forEach(function(m, i) {
        if (m.el) {
          m.el.className = 'highlight' + (i === index ? ' active' : '');
        }
      });
      var m = allMatches[index];
      if (m && m.el) {
        m.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      postMsg({ type: 'searchResult', total: allMatches.length, current: index });
    }

    function searchNext() {
      if (!allMatches.length) return;
      currentMatchIndex = (currentMatchIndex + 1) % allMatches.length;
      activateMatch(currentMatchIndex);
    }

    function searchPrev() {
      if (!allMatches.length) return;
      currentMatchIndex = (currentMatchIndex - 1 + allMatches.length) % allMatches.length;
      activateMatch(currentMatchIndex);
    }

    // ── Command receiver from React Native ──────────────────────
    window.handleRNCommand = function(json) {
      try {
        var cmd = JSON.parse(json);
        if (cmd.type === 'search')      { searchInAllPages(cmd.term); }
        else if (cmd.type === 'next')   { searchNext(); }
        else if (cmd.type === 'prev')   { searchPrev(); }
        else if (cmd.type === 'clear')  { clearHighlights(); postMsg({ type: 'searchResult', total: 0, current: 0 }); }
        else if (cmd.type === 'goPage') {
          var c = document.querySelector('.page-wrapper[data-page="' + cmd.page + '"]');
          if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      } catch(e) {}
    };

    // ── PDF rendering ───────────────────────────────────────────
    async function renderPDF(pdfUri) {
      try {
        var loadingTask = pdfjsLib.getDocument({ url: pdfUri });
        var pdf = await loadingTask.promise;
        totalPages = pdf.numPages;
        postMsg({ type: 'ready', totalPages: totalPages });
        postMsg({ type: 'loaded' });

        var container = document.getElementById('pdf-container');

        for (var pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          var page = await pdf.getPage(pageNum);
          var scale = Math.min(window.devicePixelRatio || 1.5, 2.0);
          var viewport = page.getViewport({ scale: scale });

          var wrapper = document.createElement('div');
          wrapper.className = 'page-wrapper';
          wrapper.setAttribute('data-page', String(pageNum));

          var canvas = document.createElement('canvas');
          canvas.setAttribute('data-page', String(pageNum));
          var ctx = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width  = viewport.width;
          wrapper.appendChild(canvas);
          container.appendChild(wrapper);

          await page.render({ canvasContext: ctx, viewport: viewport }).promise;

          // Extract text for search
          var textContent = await page.getTextContent();
          pageData[pageNum] = {
            viewport: viewport,
            textItems: textContent.items
          };

          page.cleanup();
          await new Promise(function(resolve) { setTimeout(resolve, 0); });
          postMsg({ type: 'pageRendered', page: pageNum, total: totalPages });
        }
      } catch (e) {
        postMsg({ type: 'error', message: e.message });
      }
    }

    renderPDF('${fileUri}');
  </script>
</body>
</html>`;
}

function NativePdfRendererContent({
  fileUri,
  onPageChange,
  scrollToPageRef,
  onDocumentReady,
  searchRef,
  onSearchResult,
}: NativePdfRendererContentProps) {
  const [loading, setLoading] = useState(true);
  const [html, setHtml] = useState<string | null>(null);
  const webViewRef = useRef<WebView>(null);

  const injectCommand = (cmd: object) => {
    const js = `(function(){ window.handleRNCommand('${JSON.stringify(cmd).replace(/'/g, "\\'")
}'); true; })();`;
    webViewRef.current?.injectJavaScript(js);
  };

  // Expose searchRef so DocumentWorkspace can drive search
  useEffect(() => {
    if (!searchRef) return;
    searchRef.current = {
      search: (term: string) => injectCommand({ type: 'search', term }),
      next:   ()             => injectCommand({ type: 'next' }),
      prev:   ()             => injectCommand({ type: 'prev' }),
      clear:  ()             => injectCommand({ type: 'clear' }),
    };
    return () => { if (searchRef) searchRef.current = null; };
  }, [searchRef]);

  // Expose page scroll
  useEffect(() => {
    if (!scrollToPageRef) return;
    scrollToPageRef.current = (page: number) => injectCommand({ type: 'goPage', page: page + 1 });
    return () => { if (scrollToPageRef) scrollToPageRef.current = null; };
  }, [scrollToPageRef]);

  useEffect(() => {
    if (Platform.OS !== 'ios') {
      setHtml(buildHtmlFromUri(fileUri, theme.colors.background));
    }
  }, [fileUri]);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'ready') {
        onDocumentReady?.(data.totalPages);
      } else if (data.type === 'pageChange') {
        onPageChange?.(data.page - 1);
      } else if (data.type === 'loaded') {
        setLoading(false);
      } else if (data.type === 'error') {
        console.error('[PDF.js]', data.message);
        setLoading(false);
      } else if (data.type === 'searchResult') {
        onSearchResult?.(data.total, data.current);
      }
    } catch {}
  };

  if (Platform.OS === 'ios') {
    return (
      <View style={styles.container}>
        <WebView
          ref={webViewRef}
          source={{ uri: fileUri }}
          style={styles.webview}
          onLoadEnd={() => setLoading(false)}
        />
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        )}
      </View>
    );
  }

  if (!html) {
    return (
      <View style={styles.loadingOverlay}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html, baseUrl: fileUri.substring(0, fileUri.lastIndexOf('/') + 1) }}
          style={styles.webview}
          allowFileAccess={true}
          allowUniversalAccessFromFileURLs={true}
          allowFileAccessFromFileURLs={true}
          mixedContentMode="always"
          onMessage={handleMessage}
        />
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  webview: { flex: 1, backgroundColor: 'transparent' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
});
