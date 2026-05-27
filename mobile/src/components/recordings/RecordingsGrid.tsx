import React from 'react';
import { View } from 'react-native';
import { SubjectSectionView } from '../subjects/SubjectSectionView';
import { GridMediaItem, SubjectSection } from '../../types/RecordingsGrid.types';

// Re-export types so that consumers like recordings.tsx don't break
export type { GridMediaItem, SubjectSection };

export interface RecordingsGridProps {
  sections: SubjectSection[];
  playingId: string | null;
  onPlay: (uri: string, id: string) => void;
  onStop: () => void;
  onDelete: (id: string) => void;
  onPress: (item: GridMediaItem) => void;
}

/**
 * RecordingsGrid.tsx
 *
 * Componente orquestador que toma un arreglo de secciones (materias) y renderiza un
 * `SubjectSectionView` por cada una de ellas. Actúa como el contenedor principal 
 * para la cuadrícula jerárquica (bento) de grabaciones multimedia (audios y videos).
 *
 * @param sections - Lista de grabaciones agrupadas por materia (o 'Sin clasificar').
 * @param playingId - ID del archivo multimedia actualmente en reproducción, si lo hay.
 * @param onPlay - Función para iniciar la reproducción de un archivo.
 * @param onStop - Función para detener la reproducción actual.
 * @param onDelete - Función para eliminar un archivo de la base de datos local y física.
 * @param onPress - Función para navegar al detalle (pantalla completa/transcripción) del archivo.
 */
export function RecordingsGrid({
  sections,
  playingId,
  onPlay,
  onStop,
  onDelete,
  onPress,
}: RecordingsGridProps) {
  if (sections.length === 0) return null;

  return (
    <View>
      {sections.map((section) => (
        <SubjectSectionView
          key={section.subjectName}
          section={section}
          playingId={playingId}
          onPlay={onPlay}
          onStop={onStop}
          onDelete={onDelete}
          onPress={onPress}
        />
      ))}
    </View>
  );
}
