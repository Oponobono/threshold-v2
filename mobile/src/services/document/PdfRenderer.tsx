import { useRef, useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  useWindowDimensions,
  type ViewToken,
  type ListRenderItemInfo,
} from 'react-native';
import type { DocumentRenderer, OnPageChange, ScrollToPageRef, OnTextSelection } from '../../domain/document/DocumentRenderer';
import type { DocumentModel, DocumentPage } from '../../domain/document/DocumentModel';
import { pdfRendererStyles as styles } from '../../styles/PdfRenderer.styles';

export interface TextSelectionEvent {
  readonly documentId: string;
  readonly pageIndex: number;
  readonly blockIndex: number;
  readonly text: string;
  readonly startIndex: number;
  readonly endIndex: number;
}

export interface PdfRendererProps {
  model: DocumentModel;
  onPageChange?: OnPageChange;
  scrollToPageRef?: ScrollToPageRef;
  onSelection?: OnTextSelection;
  highlightedBlockId?: string;
}

export class PdfRenderer implements DocumentRenderer {
  render(
    model: DocumentModel,
    onPageChange?: OnPageChange,
    scrollToPageRef?: ScrollToPageRef,
    onDocumentReady?: undefined,
    onSelection?: OnTextSelection,
    highlightedBlockId?: string,
  ): unknown {
    return (
      <PdfRendererContent
        model={model}
        onPageChange={onPageChange}
        scrollToPageRef={scrollToPageRef}
        onSelection={onSelection}
        highlightedBlockId={highlightedBlockId}
      />
    );
  }
}

function PdfRendererContent({
  model,
  onPageChange,
  scrollToPageRef,
  onSelection,
  highlightedBlockId,
}: PdfRendererProps) {
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<DocumentPage>>(null);
  const [selectedBlock, setSelectedBlock] = useState<{
    pageIndex: number;
    blockIndex: number;
  } | null>(null);

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

  const handleBlockLongPress = useCallback(
    (pageIndex: number, blockIndex: number, text: string, startIndex: number, endIndex: number) => {
      setSelectedBlock({ pageIndex, blockIndex });
      onSelection?.({
        documentId: model.documentId,
        pageIndex,
        blockIndex,
        text,
        startIndex,
        endIndex,
      });
    },
    [model.documentId, onSelection],
  );

  const handleBlockPress = useCallback(() => {
    if (selectedBlock) {
      setSelectedBlock(null);
    }
  }, [selectedBlock]);

  const renderPage = ({ item }: ListRenderItemInfo<DocumentPage>) => (
    <View style={[styles.page, { width }]}>
      {item.content.textBlocks.map((block, i) => {
        const role = block.role ?? 'paragraph';
        const isSelected =
          selectedBlock?.pageIndex === item.pageIndex &&
          selectedBlock?.blockIndex === i;
        const isHighlighted = block.id === highlightedBlockId;

        return (
          <Pressable
            key={block.id || i}
            onLongPress={() =>
              handleBlockLongPress(
                item.pageIndex,
                i,
                block.content,
                block.startIndex,
                block.endIndex,
              )
            }
            onPress={handleBlockPress}
          >
            <Text
              selectable
              style={[
                styles.baseText,
                role === 'heading' && styles.heading,
                role === 'subheading' && styles.subheading,
                isSelected && styles.selectedBlock,
                isHighlighted && styles.highlightedBlock,
              ]}
            >
              {block.content}
            </Text>
          </Pressable>
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
        listRef.current?.scrollToEnd({ animated: false });
        setTimeout(() => {
          listRef.current?.scrollToIndex({ index, animated: true });
        }, 100);
      }}
    />
  );
}
