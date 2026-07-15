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
} from '../../domain/document/DocumentRenderer';
import type { DocumentModel } from '../../domain/document/DocumentModel';

export class NativePdfRenderer implements DocumentRenderer {
  render(
    model: DocumentModel,
    onPageChange?: OnPageChange,
    scrollToPageRef?: ScrollToPageRef,
    onDocumentReady?: OnDocumentReady,
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
      />
    );
  }
}

interface NativePdfRendererContentProps {
  fileUri: string;
  onPageChange?: OnPageChange;
  scrollToPageRef?: ScrollToPageRef;
  onDocumentReady?: OnDocumentReady;
}

function buildHtml(base64: string, bgColor: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=4.0, user-scalable=yes" />
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: ${bgColor}; }
    #pdf-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 8px 0;
      gap: 8px;
    }
    canvas {
      max-width: 100%;
      height: auto;
      display: block;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    }
    #page-markers span {
      position: absolute;
      opacity: 0;
      pointer-events: none;
    }
  </style>
</head>
<body>
  <div id="pdf-container"></div>
  <script>
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    var totalPages = 0;
    var lastReportedPage = 0;

    function postMsg(obj) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(obj));
      }
    }

    function getCurrentPage() {
      var canvases = document.querySelectorAll('canvas[data-page]');
      if (!canvases.length) return 1;
      var mid = window.scrollY + window.innerHeight / 2;
      var current = 1;
      canvases.forEach(function(c) {
        if (c.offsetTop <= mid) {
          current = parseInt(c.getAttribute('data-page'), 10);
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

    async function renderPDF(base64Data) {
      try {
        var binary = window.atob(base64Data);
        var len = binary.length;
        var bytes = new Uint8Array(len);
        for (var i = 0; i < len; i++) {
          bytes[i] = binary.charCodeAt(i);
        }

        var loadingTask = pdfjsLib.getDocument({ data: bytes });
        var pdf = await loadingTask.promise;
        totalPages = pdf.numPages;
        postMsg({ type: 'ready', totalPages: totalPages });
        
        // Hide loading indicator instantly so user sees pages as they appear
        postMsg({ type: 'loaded' });

        var container = document.getElementById('pdf-container');

        for (var pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          var page = await pdf.getPage(pageNum);
          var viewport = page.getViewport({ scale: window.devicePixelRatio || 1.5 });

          var canvas = document.createElement('canvas');
          canvas.setAttribute('data-page', String(pageNum));
          var ctx = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          container.appendChild(canvas);

          await page.render({ canvasContext: ctx, viewport: viewport }).promise;

          // Allow the WebView UI thread to breathe and paint the page
          await new Promise(resolve => setTimeout(resolve, 10));

          // After each page render, report progress
          postMsg({ type: 'pageRendered', page: pageNum, total: totalPages });
        }
      } catch (e) {
        postMsg({ type: 'error', message: e.message });
      }
    }

    renderPDF('${base64}');
  </script>
</body>
</html>`;
}

function NativePdfRendererContent({
  fileUri,
  onPageChange,
  scrollToPageRef,
  onDocumentReady,
}: NativePdfRendererContentProps) {
  const [loading, setLoading] = useState(true);
  const [html, setHtml] = useState<string | null>(null);
  const webViewRef = useRef<WebView>(null);

  // Expose imperative scroll: inject JS to scroll to the canvas matching the page
  useEffect(() => {
    if (!scrollToPageRef) return;
    scrollToPageRef.current = (page: number) => {
      const js = `
        (function() {
          var c = document.querySelector('canvas[data-page="${page + 1}"]');
          if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' });
          true;
        })();
      `;
      webViewRef.current?.injectJavaScript(js);
    };
    return () => {
      if (scrollToPageRef) scrollToPageRef.current = null;
    };
  }, [scrollToPageRef]);

  useEffect(() => {
    async function loadPdf() {
      try {
        const base64 = await FileSystem.readAsStringAsync(fileUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        setHtml(buildHtml(base64, theme.colors.background));
      } catch (e) {
        console.error('[NativePdfRenderer] Failed to read file:', e);
      }
    }

    if (Platform.OS !== 'ios') {
      loadPdf();
    }
  }, [fileUri]);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'ready') {
        onDocumentReady?.(data.totalPages);
      } else if (data.type === 'pageChange') {
        onPageChange?.(data.page - 1); // 0-indexed
      } else if (data.type === 'loaded') {
        setLoading(false);
      } else if (data.type === 'error') {
        console.error('[PDF.js]', data.message);
        setLoading(false);
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
        source={{ html }}
        style={styles.webview}
        allowFileAccess
        allowUniversalAccessFromFileURLs
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
