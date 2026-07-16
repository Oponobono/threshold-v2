import React, { useEffect, useState, type MutableRefObject } from 'react';
import { ScrollView, StyleSheet, View, Text, useWindowDimensions } from 'react-native';
import type { DocumentModel } from '../../../domain/document/DocumentModel';
import { CodeHighlighter } from '../../../components/ui/CodeHighlighter';
import { theme } from '../../../styles/theme';
import type { DocumentRenderer, OnDocumentReady, OnPageChange, ScrollToPageRef } from '../../../domain/document/DocumentRenderer';

export class NativeTextRenderer implements DocumentRenderer {
  supports(model: DocumentModel): boolean {
    const format = model.pages[0]?.content?.metadata?.format?.toLowerCase() || '';
    return format === 'txt' || format === 'text/plain' || format === 'json' || format === 'application/json' || format === 'md' || format === 'markdown';
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
      <NativeTextRendererContent
        model={model}
        onPageChange={onPageChange}
        scrollToPageRef={scrollToPageRef}
        onDocumentReady={onDocumentReady}
      />
    );
  }
}

interface NativeTextRendererContentProps {
  model: DocumentModel;
  onPageChange?: OnPageChange;
  scrollToPageRef?: ScrollToPageRef;
  onDocumentReady?: OnDocumentReady;
}

function NativeTextRendererContent({ 
  model, 
  onPageChange,
  scrollToPageRef,
  onDocumentReady
}: NativeTextRendererContentProps) {
  const [content, setContent] = useState<string>('');
  const [language, setLanguage] = useState<string>('plaintext');
  const { width } = useWindowDimensions();

  useEffect(() => {
    if (!model.pages || model.pages.length === 0) return;
    
    // For TXT/JSON we will just render everything in one continuous ScrollView for now
    const allText = model.pages.map(page => 
      page.content.textBlocks.map(b => b.content).join('\n\n')
    ).join('\n\n');
    
    setContent(allText);
    
    const metadata = model.pages[0]?.content.metadata as any;
    const isJson = metadata?.format === 'json' || model.title.toLowerCase().endsWith('.json');
    const isMd = model.title.toLowerCase().endsWith('.md');
    
    setLanguage(isJson ? 'json' : isMd ? 'markdown' : 'plaintext');

    // Notify DocumentWorkspace that the document is ready (1 page visually, even if model has many)
    if (onDocumentReady) {
      setTimeout(() => onDocumentReady(1), 100);
    }
  }, [model, onDocumentReady]);

  // Handle scroll events to update current page if we wanted pagination, 
  // but for raw text we keep it simple as 1 page in the UI for now.

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.content}
    >
      <CodeHighlighter code={content} language={language} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
});
