import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { SubjectSection, GridMediaItem } from '../../types/RecordingsGrid.types';
import { HeroCard, MediumCard, SmallCard } from '../recordings/RecordingGridCards';

/**
 * SubjectSectionView.tsx
 *
 * Agrupa cronológicamente los archivos multimedia (Audio/Video) de una única asignatura.
 * Aplica el diseño jerárquico tipo Bento:
 * - El archivo más reciente se muestra en un `HeroCard` (tamaño máximo).
 * - Los dos siguientes se muestran en `MediumCard` (fila dual horizontal).
 * - Los restantes colapsan en una lista con scroll interno (`SmallCard`).
 *
 * @param section - Objeto que contiene los detalles de la materia y su lista de multimedia.
 * @param playingId - ID del archivo de audio/video actualmente en reproducción.
 * @param onPlay - Función que solicita iniciar la reproducción en el reproductor nativo.
 * @param onStop - Función que detiene el stream del archivo nativo de inmediato.
 * @param onDelete - Solicita un borrado en base de datos.
 * @param onPress - Permite abrir la visualización de detalles o la pantalla de transcripción/chat.
 */
export function SubjectSectionView({
  section,
  playingId,
  onPlay,
  onStop,
  onDelete,
  onPress,
}: {
  section: SubjectSection;
  playingId: string | null;
  onPlay: (uri: string, id: string) => void;
  onStop: () => void;
  onDelete: (id: string) => void;
  onPress: (item: GridMediaItem) => void;
}) {
  const { t } = useTranslation();
  const now = Date.now();
  const sorted = [...section.items].sort(
    (a, b) =>
      new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime()
  );

  const hero = sorted[0] ?? null;
  const recent = sorted.slice(1, 3);
  const rest = sorted.slice(3);

  const accentColor = section.subjectColor || theme.colors.primary;
  
  // DEBUG: Log color information
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[SubjectSectionView] ${section.subjectName}: subjectColor="${section.subjectColor}" → accentColor="${accentColor}"`);
  }

  return (
    <View style={{ marginBottom: 28 }}>
      {/* Subject header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12,
        }}
      >
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: accentColor,
          }}
        />
        <Text
          style={{
            fontSize: 17,
            fontWeight: '700',
            color: theme.colors.text.primary,
            flex: 1,
          }}
        >
          {section.subjectName}
        </Text>
        <Text style={{ fontSize: 12, color: theme.colors.text.secondary }}>
          {section.items.length} {section.items.length === 1 ? (t('common.file') || 'archivo') : (t('common.files') || 'archivos')}
        </Text>
      </View>

      {/* Hero */}
      {hero && (
        <HeroCard
          item={hero}
          subjectColor={accentColor}
          isPlaying={playingId === hero.id}
          onPlay={onPlay}
          onStop={onStop}
          onDelete={onDelete}
          onPress={onPress}
        />
      )}

      {/* Medium cards row */}
      {recent.length > 0 && (
        <>
          <Text
            style={{
              fontSize: 12,
              fontWeight: '600',
              color: theme.colors.text.secondary,
              letterSpacing: 0.5,
              marginBottom: 8,
              textTransform: 'uppercase',
            }}
          >
            {t('common.recent') || 'Recientes'}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 8,
              marginBottom: 12,
            }}
          >
            {recent.map((item) => (
              <MediumCard
                key={item.id}
                item={item}
                subjectColor={accentColor}
                isPlaying={playingId === item.id}
                onPlay={onPlay}
                onStop={onStop}
                onDelete={onDelete}
                onPress={onPress}
              />
            ))}
          </View>
        </>
      )}

      {/* Small list */}
      {rest.length > 0 && (
        <View>
          <Text
            style={{
              fontSize: 12,
              fontWeight: '600',
              color: theme.colors.text.secondary,
              letterSpacing: 0.5,
              marginBottom: 8,
              textTransform: 'uppercase',
            }}
          >
            {t('common.previous') || 'Anteriores'}
          </Text>
          <View
            style={{
              backgroundColor: theme.colors.card,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: theme.colors.border,
              overflow: 'hidden',
            }}
          >
            <ScrollView
              nestedScrollEnabled={true}
              style={rest.length > 3 ? { maxHeight: 195 } : undefined}
              showsVerticalScrollIndicator={rest.length > 3}
            >
              {rest.map((item, index) => (
                <SmallCard
                  key={item.id}
                  item={item}
                  subjectColor={accentColor}
                  isPlaying={playingId === item.id}
                  onPlay={onPlay}
                  onStop={onStop}
                  onDelete={onDelete}
                  onPress={onPress}
                  isLast={index === rest.length - 1}
                />
              ))}
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );
}
