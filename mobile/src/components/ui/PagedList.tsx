import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { View, FlatList, StyleSheet, Dimensions, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { theme } from '../../styles/theme';

interface PagedListProps<T> {
  items: T[];
  renderItem: (info: { item: T; index: number; globalIndex: number }) => React.ReactElement;
  pageSize?: number;
  ListEmptyComponent?: React.ReactElement | null;
  currentPage?: number;
  onPageChange?: (page: number) => void;
}

export function PagedList<T>({
  items,
  renderItem,
  pageSize = 10,
  ListEmptyComponent = null,
  currentPage,
  onPageChange,
}: PagedListProps<T>) {
  const [internalPage, setInternalPage] = useState(0);
  const activePage = currentPage !== undefined ? currentPage : internalPage;
  
  const flatListRef = useRef<FlatList>(null);
  const [layoutWidth, setLayoutWidth] = useState(0);

  const pages = useMemo(() => {
    if (!items || items.length === 0) return [];
    const result = [];
    for (let i = 0; i < items.length; i += pageSize) {
      result.push(items.slice(i, i + pageSize));
    }
    return result;
  }, [items, pageSize]);

  const totalPages = pages.length;

  useEffect(() => {
    if (currentPage !== undefined && currentPage !== internalPage) {
      setInternalPage(currentPage);
      if (layoutWidth > 0 && totalPages > 0 && currentPage >= 0 && currentPage < totalPages) {
        // Use timeout to ensure FlatList has rendered the item before scrolling
        setTimeout(() => {
          flatListRef.current?.scrollToOffset({ offset: currentPage * layoutWidth, animated: true });
        }, 50);
      }
    }
  }, [currentPage, layoutWidth, totalPages]);

  const handleMomentumScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffsetX = e.nativeEvent.contentOffset.x;
    const w = e.nativeEvent.layoutMeasurement.width;
    
    if (w > 0) {
      const newPage = Math.round(contentOffsetX / w);
      if (newPage !== activePage && newPage >= 0 && newPage < totalPages) {
        if (currentPage === undefined) {
          setInternalPage(newPage);
        }
        if (onPageChange) {
          onPageChange(newPage);
        }
      }
    }
  }, [activePage, totalPages, currentPage, onPageChange]);

  const renderDots = () => {
    if (totalPages <= 1) return null;

    const maxDots = Math.min(totalPages, 5);
    let startPage = 0;
    let activeDotIndex = 0;

    if (totalPages <= 5) {
      startPage = 0;
      activeDotIndex = activePage;
    } else {
      if (activePage < 2) {
        startPage = 0;
        activeDotIndex = activePage;
      } else if (activePage >= totalPages - 2) {
        startPage = totalPages - 5;
        activeDotIndex = activePage - startPage;
      } else {
        startPage = activePage - 2;
        activeDotIndex = 2;
      }
    }

    const dots = Array.from({ length: maxDots }).map((_, i) => i + startPage);

    return (
      <View style={styles.paginationContainer}>
        {dots.map((pageIndex, i) => {
          const isActive = i === activeDotIndex;
          const isEdge = totalPages > 5 && (i === 0 || i === maxDots - 1);
          const dotSize = isActive ? 7 : (isEdge && pageIndex !== 0 && pageIndex !== totalPages - 1 ? 4 : 5);

          return (
            <View
              key={`dot-${pageIndex}`}
              style={[
                styles.dot,
                {
                  width: dotSize,
                  height: dotSize,
                  backgroundColor: isActive ? theme.colors.primary : theme.colors.border,
                },
              ]}
            />
          );
        })}
      </View>
    );
  };

  if (!items || items.length === 0) {
    return ListEmptyComponent;
  }

  return (
    <View 
      style={styles.container}
      onLayout={(e) => setLayoutWidth(e.nativeEvent.layout.width)}
    >
      {layoutWidth > 0 && (
        <FlatList
          ref={flatListRef}
          data={pages}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          keyExtractor={(_, index) => `page-${index}`}
          initialScrollIndex={activePage}
          getItemLayout={(_, index) => ({
            length: layoutWidth,
            offset: layoutWidth * index,
            index,
          })}
          renderItem={({ item: pageItems, index: pageIndex }) => {
            return (
              <View style={[styles.page, { width: layoutWidth }]}>
                {pageItems.map((item: T, localIndex: number) => {
                  const globalIndex = pageIndex * pageSize + localIndex;
                  return (
                    <View key={`item-${globalIndex}`}>
                      {renderItem({ item, index: localIndex, globalIndex })}
                    </View>
                  );
                })}
              </View>
            );
          }}
        />
      )}
      {renderDots()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  page: {
    // Width is set dynamically based on layoutWidth to support any container
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 8,
    gap: 8,
    minHeight: 32,
  },
  dot: {
    borderRadius: 4,
  },
});
