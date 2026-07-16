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
    onSelection?: OnTextSelection,
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
        onSelection={onSelection}
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
  onSelection?: OnTextSelection;
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
      display: block;
      width: 100% !important;
      height: auto !important;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    }
    .highlight {
      position: absolute;
      background: rgba(255, 220, 0, 0.45);
      border-radius: 2px;
      pointer-events: none;
      z-index: 5;
    }
    .highlight.active {
      background: rgba(255, 140, 0, 0.65);
    }
    .textLayer {
      position: absolute;
      left: 0;
      top: 0;
      right: 0;
      bottom: 0;
      overflow: hidden;
      line-height: 1.0;
      -webkit-user-select: text;
      user-select: text;
      pointer-events: auto;
      z-index: 10;
    }
    .textLayer > span, .textLayer > br {
      position: absolute;
      white-space: pre;
      transform-origin: 0% 0%;
      color: rgba(0,0,0,0.01) !important;
      cursor: text;
    }
    .textLayer ::selection {
      background: rgba(0, 110, 255, 0.3) !important;
      color: rgba(0,0,0,0.01) !important;
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

    function clearHighlights() {
      document.querySelectorAll('.highlight').forEach(function(el) { el.remove(); });
      allMatches = [];
      currentMatchIndex = -1;
    }

    function buildHighlight(wrapper, item, unscaledW, unscaledH, isActive) {
      var canvas = wrapper.querySelector('canvas');
      var rect = canvas.getBoundingClientRect();
      var actualW = rect.width > 0 ? rect.width : canvas.offsetWidth;
      var effectiveScale = actualW / unscaledW;
      var pageHeightCSS  = unscaledH * effectiveScale;

      var userX = item.transform[4];
      var userY = item.transform[5];
      var fontSizeUser  = Math.abs(item.transform[3]);
      var fontSizePx    = fontSizeUser * effectiveScale;
      var ascentPx      = fontSizePx * 0.8;

      var el = document.createElement('div');
      el.className = 'highlight' + (isActive ? ' active' : '');
      el.style.left   = (userX * effectiveScale) + 'px';
      el.style.top    = (pageHeightCSS - userY * effectiveScale - ascentPx) + 'px';
      el.style.width  = (item.width * effectiveScale) + 'px';
      el.style.height = fontSizePx + 'px';
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
            unscaledW: data.unscaledW,
            unscaledH: data.unscaledH,
            item: item
          });
        });
      });

      allMatches = matches;
      matches.forEach(function(m) {
        m.el = buildHighlight(m.wrapper, m.item, m.unscaledW, m.unscaledH, false);
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

    var selectionTimer = null;
    document.addEventListener('selectionchange', function() {
      if (selectionTimer) clearTimeout(selectionTimer);
      selectionTimer = setTimeout(function() {
        var sel = window.getSelection();
        var text = sel ? sel.toString().trim() : '';
        if (!text) return;
        var anchor = sel.anchorNode;
        var page = 1;
        if (anchor) {
          var el = anchor.nodeType === 3 ? anchor.parentElement : anchor;
          var wrapper = el ? el.closest('.page-wrapper') : null;
          if (wrapper) page = parseInt(wrapper.getAttribute('data-page'), 10) || 1;
        }
        var anchorOffset = sel.anchorOffset;
        var focusOffset = sel.focusOffset;
        postMsg({
          type: 'textSelection',
          text: text,
          page: page,
          anchorOffset: anchorOffset,
          focusOffset: focusOffset,
        });
      }, 300);
    });

    function buildTextLayer(textLayerDiv, textItems, unscaledW, unscaledH, actualCSSWidth) {
      // effectiveScale = how many CSS px per PDF user-space unit.
      // We derive it from the ACTUAL rendered canvas width so it is always pixel-perfect,
      // regardless of what window.innerWidth or devicePixelRatio report.
      var effectiveScale = actualCSSWidth / unscaledW;
      var pageHeightCSS  = unscaledH * effectiveScale;

      textLayerDiv.innerHTML = '';
      textItems.forEach(function(item) {
        if (!item.str || item.str.trim() === '') return;
        var span = document.createElement('span');
        span.textContent = item.str;

        // PDF user-space coordinates
        var userX = item.transform[4];
        var userY = item.transform[5];

        // Font size in PDF user units is the absolute magnitude of the scaleY component
        var fontSizeUser = Math.abs(item.transform[3]);
        var fontSizePx   = fontSizeUser * effectiveScale;
        // Ascent ~80 % of em height — used to convert baseline Y to CSS top
        var ascentPx     = fontSizePx * 0.8;

        span.style.left       = (userX * effectiveScale) + 'px';
        // PDF Y is bottom-referenced; CSS top is top-referenced → flip
        span.style.top        = (pageHeightCSS - userY * effectiveScale - ascentPx) + 'px';
        span.style.fontSize   = fontSizePx + 'px';
        span.style.fontFamily = item.fontName || 'sans-serif';
        // No width constraint: constraining width makes adjacent spans' hit-areas
        // overlap and corrupts getSelection().toString().

        var angle = Math.atan2(item.transform[1], item.transform[0]);
        if (Math.abs(angle) > 0.001) {
          span.style.transform = 'rotate(' + (-angle) + 'rad)';
        }
        textLayerDiv.appendChild(span);
      });
    }

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

          // Unscaled viewport gives us the page dimensions in PDF user units
          var unscaledViewport = page.getViewport({ scale: 1.0 });
          var unscaledW = unscaledViewport.width;
          var unscaledH = unscaledViewport.height;

          // Render the canvas at a high DPI scale for sharpness.
          // CSS (width: 100%; height: auto) will scale it down to fit the container.
          var pixelRatio   = window.devicePixelRatio || 1;
          var renderScale  = 2 * pixelRatio;
          var renderVP     = page.getViewport({ scale: renderScale });

          var wrapper = document.createElement('div');
          wrapper.className = 'page-wrapper';
          wrapper.setAttribute('data-page', String(pageNum));
          // Let CSS set the visual width (width: 100%); height follows from aspect ratio.

          var canvas = document.createElement('canvas');
          canvas.setAttribute('data-page', String(pageNum));
          var ctx = canvas.getContext('2d');
          // Intrinsic pixel dimensions for high-DPI rendering
          canvas.width  = renderVP.width;
          canvas.height = renderVP.height;
          // CSS scales it to fill the wrapper (see canvas { width: 100%; height: auto })

          wrapper.appendChild(canvas);
          container.appendChild(wrapper);

          await page.render({ canvasContext: ctx, viewport: renderVP }).promise;

          var textContent = await page.getTextContent();
          // Store unscaled dimensions + raw items for search highlighting
          pageData[pageNum] = {
            unscaledW: unscaledW,
            unscaledH: unscaledH,
            textItems: textContent.items
          };

          var textLayerDiv = document.createElement('div');
          textLayerDiv.className = 'textLayer';
          textLayerDiv.setAttribute('data-page', String(pageNum));
          wrapper.appendChild(textLayerDiv);

          // ResizeObserver gives us the true CSS pixel width of the canvas AFTER layout.
          // This is the only reliable way to know the display scale in a WebView,
          // because window.innerWidth may not match the actual rendered element width.
          (function(canvas, textLayerDiv, textItems, unscaledW, unscaledH) {
            var observer = new ResizeObserver(function(entries) {
              var w = entries[0].contentRect.width;
              if (w > 0) {
                buildTextLayer(textLayerDiv, textItems, unscaledW, unscaledH, w);
              }
            });
            observer.observe(canvas);
          })(canvas, textLayerDiv, textContent.items, unscaledW, unscaledH);

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
  onSelection,
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
      } else if (data.type === 'textSelection') {
        onSelection?.({
          documentId: fileUri,
          pageIndex: (data.page || 1) - 1,
          blockIndex: 0,
          text: data.text,
          startIndex: data.anchorOffset || 0,
          endIndex: data.focusOffset || data.text.length,
        });
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
