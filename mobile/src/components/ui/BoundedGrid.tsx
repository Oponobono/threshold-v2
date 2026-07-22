import React from 'react';
import { View, Text, FlatList, StyleSheet, ScrollView } from 'react-native';
import { theme } from '../../styles/theme';

interface BoundedGridProps<T> {
  data: T[];
  renderItem: ({ item, index }: { item: T; index: number }) => React.ReactElement;
  keyExtractor: (item: T, index: number) => string;
  numColumns?: number;
  maxHeight?: number;
  gap?: number;
  ListEmptyComponent?: React.ReactElement;
  title?: string;
  contextText?: string;
  headerAction?: React.ReactNode;
}

export function BoundedGrid<T>({
  data,
  renderItem,
  keyExtractor,
  numColumns = 2,
  maxHeight = 320,
  gap = 8,
  ListEmptyComponent,
  title,
  contextText,
  headerAction,
}: BoundedGridProps<T>) {

  return (
    <View style={styles.container}>
      {(title || headerAction) && (
        <View style={styles.header}>
          <View style={styles.titleRow}>
            {title && <Text style={styles.title}>{title}</Text>}
            {contextText && <Text style={styles.contextText}>{contextText}</Text>}
          </View>
          {headerAction && <View>{headerAction}</View>}
        </View>
      )}

      {data.length === 0 ? (
        ListEmptyComponent
      ) : (
        <View style={styles.gridWrapper}>
          <ScrollView
            style={{ maxHeight }}
            nestedScrollEnabled={true}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 4 }}
          >
          <View style={{ flexDirection: 'column', gap }}>
            {Array.from({ length: Math.ceil(data.length / numColumns) }).map((_, rowIndex) => (
              <View key={`row-${rowIndex}`} style={{ flexDirection: 'row', gap }}>
                {Array.from({ length: numColumns }).map((_, colIndex) => {
                  const itemIndex = rowIndex * numColumns + colIndex;
                  const item = data[itemIndex];
                  if (!item) {
                    return <View key={`empty-${colIndex}`} style={{ flex: 1 }} />;
                  }
                  return (
                    <React.Fragment key={keyExtractor(item, itemIndex)}>
                      {renderItem({ item, index: itemIndex })}
                    </React.Fragment>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  title: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: '800',
    color: theme.colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  contextText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text.secondary,
    fontWeight: '500',
  },
  gridWrapper: {
    borderWidth: 1,
    borderColor: theme.colors.text.secondary,
    borderRadius: 16,
    padding: 12,
    overflow: 'hidden',
  },
});
