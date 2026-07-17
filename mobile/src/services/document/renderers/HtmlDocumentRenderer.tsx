import React, { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import type { DocumentModel } from '../../../domain/document/DocumentModel';
import type { DocumentSource } from '../../../domain/document/DocumentSource';
import type {
  DocumentRenderer,
  OnDocumentReady,
  OnPageChange,
  ScrollToPageRef,
} from '../../../domain/document/DocumentRenderer';
import { theme } from '../../../styles/theme';

export class HtmlDocumentRenderer implements DocumentRenderer {
  supports(model: DocumentModel): boolean {
    const format = model.pages[0]?.content?.metadata?.format?.toLowerCase() || '';
    return format === 'docx' || format === 'doc';
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
    source?: DocumentSource,
  ): unknown {
    return (
      <HtmlRendererContent
        model={model}
        source={source}
        onDocumentReady={onDocumentReady}
      />
    );
  }
}

interface HtmlRendererContentProps {
  model: DocumentModel;
  source?: DocumentSource;
  onDocumentReady?: OnDocumentReady;
}

function HtmlRendererContent({ model, source, onDocumentReady }: HtmlRendererContentProps) {
  const [html, setHtml] = useState<string | null>(null);
  const readyNotified = useRef(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const mammoth = await import('mammoth');

        let arrayBuffer: ArrayBuffer;

        if (source) {
          const raw = await source.openRead();
          if (raw instanceof ReadableStream) {
            const reader = raw.getReader();
            const chunks: Uint8Array[] = [];
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              chunks.push(value);
            }
            const total = chunks.reduce((s, c) => s + c.length, 0);
            const merged = new Uint8Array(total);
            let offset = 0;
            for (const chunk of chunks) {
              merged.set(chunk, offset);
              offset += chunk.length;
            }
            arrayBuffer = merged.buffer;
          } else {
            arrayBuffer = raw;
          }
        } else {
          const text = model.pages
            .map((p) => p.content.textBlocks.map((b) => b.content).join('\n\n'))
            .join('\n\n');
          arrayBuffer = new TextEncoder().encode(text).buffer;
        }

        const result = await mammoth.convertToHtml({ arrayBuffer });

        if (!cancelled) {
          setHtml(result.value || '<p>Sin contenido</p>');
        }
      } catch {
        if (!cancelled) {
          const fallback = model.pages
            .map((p) => p.content.textBlocks.map((b) => b.content).join('\n\n'))
            .join('\n\n');
          setHtml(`<pre>${escapeHtml(fallback)}</pre>`);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [model, source]);

  const handleLoad = useCallback(() => {
    if (!readyNotified.current) {
      readyNotified.current = true;
      onDocumentReady?.(1);
    }
  }, [onDocumentReady]);

  if (!html) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <WebView
      source={{ html: HTML_TEMPLATE(html) }}
      style={styles.webview}
      onLoadEnd={handleLoad}
      originWhitelist={['*']}
      scrollEnabled
      nestedScrollEnabled
      contentMode="mobile"
    />
  );
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const HTML_TEMPLATE = (content: string) => `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=800, initial-scale=0.4, user-scalable=yes, minimum-scale=0.2, maximum-scale=3.0">
<style>
  * { box-sizing: border-box; }
  html {
    overflow-x: hidden;
    -webkit-text-size-adjust: none;
  }
  body {
    margin: 0;
    padding: 20px 24px;
    background: #FFFFFF;
    font-family: 'Calibri', 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
    font-size: 15px;
    line-height: 1.5;
    color: #1A1A1A;
    word-wrap: break-word;
    overflow-wrap: break-word;
    max-width: 100%;
    overflow-x: hidden;
  }
  h1, h2, h3, h4, h5, h6 {
    color: #1A1A1A;
    margin-top: 1em;
    margin-bottom: 0.4em;
    font-weight: 600;
  }
  h1 { font-size: 1.8em; }
  h2 { font-size: 1.4em; }
  h3 { font-size: 1.15em; }
  p { margin: 0.4em 0; }
  ul, ol { padding-left: 1.5em; margin: 0.4em 0; }
  li { margin: 0.15em 0; }
  table {
    border-collapse: collapse;
    width: 100%;
    margin: 0.8em 0;
    table-layout: fixed;
  }
  th, td {
    border: 1px solid #CCC;
    padding: 6px 8px;
    text-align: left;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }
  th { background: #F0F0F0; font-weight: 600; color: #1A1A1A; }
  td { background: #FFFFFF; color: #1A1A1A; }
  blockquote {
    border-left: 3px solid #CCC;
    margin: 0.5em 0;
    padding: 0.5em 1em;
    color: #555;
    background: #F8F8F8;
  }
  code {
    background: #F0F0F0;
    padding: 2px 5px;
    border-radius: 3px;
    font-size: 0.9em;
    color: #1A1A1A;
    word-break: break-all;
  }
  pre {
    background: #F5F5F5;
    padding: 12px;
    border-radius: 4px;
    overflow-x: auto;
    color: #1A1A1A;
    white-space: pre-wrap;
    word-break: break-word;
  }
  img { max-width: 100%; height: auto; }
  a { color: #0563C1; word-break: break-all; }
  strong { color: #1A1A1A; font-weight: 600; }
  em { color: #333; font-style: italic; }
</style>
</head>
<body>${content}</body>
</html>`;

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  webview: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});
