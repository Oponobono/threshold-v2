import { useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  useWindowDimensions,
  type ViewToken,
  type ListRenderItemInfo,
} from 'react-native';
import type { DocumentRenderer, OnPageChange, ScrollToPageRef } from '../../domain/document/DocumentRenderer';
import type { DocumentModel, DocumentPage } from '../../domain/document/DocumentModel';
import { theme } from '../../styles/theme';

export class PdfRenderer implements DocumentRenderer {
  render(
    model: DocumentModel,
    onPageChange?: OnPageChange,
    scrollToPageRef?: ScrollToPageRef,
  ): unknown {
    return (
      <PdfRendererContent
        model={model}
        onPageChange={onPageChange}
        scrollToPageRef={scrollToPageRef}
      />
    );
  }
}

interface PdfRendererContentProps {
  model: DocumentModel;
  onPageChange?: OnPageChange;
  scrollToPageRef?: ScrollToPageRef;
}

function PdfRendererContent({ model, onPageChange, scrollToPageRef }: PdfRendererContentProps) {
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<DocumentPage>>(null);

  // Expose imperative scroll to workspace
  useEffect(() => {
    if (!scrollToPageRef) return;
    scrollToPageRef.current = (page: number) => {
      listRef.current?.scrollToIndex({ index: page, animated: true });
    };
    return () => {
      if (scrollToPageRef) scrollToPageRef.current = null;
    };
  }, [scrollToPageRef]);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        onPageChange?.(viewableItems[0].index);
      }
    },
    [onPageChange],
  );

  const renderPage = ({ item }: ListRenderItemInfo<DocumentPage>) => (
    <View style={[styles.page, { width }]}>
      {item.content.textBlocks.map((block, i) => {
        const role = block.role ?? 'paragraph';
        return (
          <Text
            key={i}
            selectable
            style={[
              styles.baseText,
              role === 'heading' && styles.heading,
              role === 'subheading' && styles.subheading,
            ]}
          >
            {block.content}
          </Text>
        );
      })}
    </View>
  );

  return (
    <FlatList<DocumentPage>
      ref={listRef}
      data={model.pages as DocumentPage[]}
      renderItem={renderPage}
      keyExtractor={item => String(item.pageIndex)}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
      initialNumToRender={2}
      maxToRenderPerBatch={3}
      windowSize={5}
      onScrollToIndexFailed={({ index }) => {
        // Fallback: scroll to end then retry
        listRef.current?.scrollToEnd({ animated: false });
        setTimeout(() => {
          listRef.current?.scrollToIndex({ index, animated: true });
        }, 100);
      }}
    />
  );
}

const styles = StyleSheet.create({
  page: {
    padding: 20,
    paddingBottom: 40,
  },
  baseText: {
    fontSize: 14,
    lineHeight: 22,
    color: theme.colors.text.primary,
    marginBottom: 8,
  },
  heading: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text.primary,
    marginTop: 20,
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  subheading: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginTop: 14,
    marginBottom: 6,
  },
});
