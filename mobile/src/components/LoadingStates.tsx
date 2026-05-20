import React from 'react';
import { View, ScrollView, StyleSheet, FlatList } from 'react-native';
import { Skeleton, SkeletonCard, SkeletonListItem, SkeletonText, SkeletonGrid } from './SkeletonLoader';
import { theme } from '../styles/theme';

/**
 * LoadingState para Dashboard
 * Muestra placeholders skeleton mientras se cargan subjects, assessments, etc.
 */
export const DashboardLoadingState: React.FC = () => {
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header con usuario */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Skeleton width="40%" height={16} borderRadius={4} style={{ marginBottom: 8 }} />
          <Skeleton width="60%" height={20} borderRadius={4} />
        </View>
        <Skeleton width={44} height={44} borderRadius={22} />
      </View>

      {/* Sección de Predicciones */}
      <View style={styles.section}>
        <Skeleton width="50%" height={18} borderRadius={4} style={{ marginBottom: 12 }} />
        <View style={{ gap: 10 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} variant="small" />
          ))}
        </View>
      </View>

      {/* Sección de Subjects/Asignaturas */}
      <View style={styles.section}>
        <Skeleton width="40%" height={18} borderRadius={4} style={{ marginBottom: 12 }} />
        <FlatList
          data={Array.from({ length: 4 })}
          horizontal
          scrollEnabled={false}
          renderItem={({ index }) => (
            <View
              key={index}
              style={{
                width: 160,
                marginRight: 12,
                marginBottom: 8,
              }}
            >
              <Skeleton width="100%" height={140} borderRadius={12} />
              <Skeleton width="80%" height={12} borderRadius={4} style={{ marginTop: 8 }} />
            </View>
          )}
        />
      </View>

      {/* Sección de Metrics */}
      <View style={styles.section}>
        <Skeleton width="50%" height={18} borderRadius={4} style={{ marginBottom: 12 }} />
        <View style={{ gap: 12 }}>
          {Array.from({ length: 2 }).map((_, i) => (
            <View key={i} style={styles.metricRow}>
              <View style={{ flex: 1 }}>
                <Skeleton width="50%" height={12} borderRadius={4} style={{ marginBottom: 8 }} />
                <Skeleton width="70%" height={16} borderRadius={4} />
              </View>
              <Skeleton width={60} height={20} borderRadius={4} />
            </View>
          ))}
        </View>
      </View>

      {/* Sección de Horario */}
      <View style={styles.section}>
        <Skeleton width="45%" height={18} borderRadius={4} style={{ marginBottom: 12 }} />
        <View style={{ gap: 12 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonListItem key={i} />
          ))}
        </View>
      </View>

      <View style={{ height: 20 }} />
    </ScrollView>
  );
};

/**
 * LoadingState para Galería
 */
export const GalleryLoadingState: React.FC = () => (
  <View style={styles.container}>
    <View style={styles.section}>
      <Skeleton width="40%" height={18} borderRadius={4} style={{ marginBottom: 12 }} />
      <SkeletonGrid count={6} />
    </View>
  </View>
);

/**
 * LoadingState para Flashcards
 */
export const FlashcardsLoadingState: React.FC = () => (
  <View style={styles.container}>
    <View style={styles.section}>
      <Skeleton width="50%" height={18} borderRadius={4} style={{ marginBottom: 12 }} />
      <View style={{ gap: 12 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} variant="large" />
        ))}
      </View>
    </View>
  </View>
);

/**
 * LoadingState para Recordings
 */
export const RecordingsLoadingState: React.FC = () => (
  <View style={styles.container}>
    <View style={styles.section}>
      <View style={{ gap: 12 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonListItem key={i} />
        ))}
      </View>
    </View>
  </View>
);

/**
 * LoadingState para Schedules/Calendario
 */
export const SchedulesLoadingState: React.FC = () => (
  <View style={styles.container}>
    <View style={styles.section}>
      <Skeleton width="50%" height={18} borderRadius={4} style={{ marginBottom: 12 }} />
      <View style={{ gap: 12 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} variant="small" />
        ))}
      </View>
    </View>
  </View>
);

/**
 * LoadingState compacta para módales
 */
export const ModalLoadingState: React.FC<{ type?: 'list' | 'grid' }> = ({
  type = 'list',
}) => {
  return (
    <View style={{ padding: 16 }}>
      {type === 'list' ? (
        <View style={{ gap: 12 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonListItem key={i} />
          ))}
        </View>
      ) : (
        <SkeletonGrid count={4} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: 10,
  },
});
