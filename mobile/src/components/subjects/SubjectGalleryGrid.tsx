import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { theme } from '../../styles/theme';
import { subjectDetailStyles as styles } from '../../styles/SubjectDetail.styles';

interface SubjectGalleryGridProps {
  photos: any[];
  subjectName?: string;
  onOpenScanner: () => void;
  onTakePhoto: () => void;
  onOpenViewer: (index: number) => void;
}

/**
 * SubjectGalleryGrid.tsx
 *
 * Componente que muestra una cuadrícula dinámica estilo "Bento" con las fotos escaneadas
 * para una materia específica. Se adapta visualmente dependiendo de si hay 0, 1, 2, 3 o 4+ fotos.
 * Contiene botones rápidos para abrir el escáner de documentos o ver la galería completa.
 *
 * @param photos - Array de objetos de fotos pertenecientes a la materia.
 * @param subjectName - Nombre de la materia (usado en el pie de página de la galería).
 * @param onOpenScanner - Función para abrir el modal de captura/escaneo de fotos.
 * @param onTakePhoto - Alias para tomar fotos de forma rápida desde el pie.
 * @param onOpenViewer - Función para abrir la imagen seleccionada en pantalla completa.
 */
const PhotoWithFallback = ({ uri, cloudUri, style, resizeMode }: { uri: string; cloudUri?: string | null; style: any; resizeMode?: any }) => {
  const [sourceUri, setSourceUri] = useState(uri);
  const [triedCloud, setTriedCloud] = useState(false);

  const handleError = useCallback(() => {
    if (!triedCloud && cloudUri) {
      setSourceUri(cloudUri);
      setTriedCloud(true);
    }
  }, [triedCloud, cloudUri]);

  return (
    <Image
      source={{ uri: sourceUri }}
      style={style}
      resizeMode={resizeMode}
      onError={handleError}
    />
  );
};

export const SubjectGalleryGrid: React.FC<SubjectGalleryGridProps> = ({
  photos,
  subjectName,
  onOpenScanner,
  onTakePhoto,
  onOpenViewer,
}) => {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <View style={styles.sectionBlock}>
      <View style={styles.sectionHeaderRow}>
        <View>
          <Text style={styles.sectionTitle}>{t('gallery.subjectGalleryTitle')}</Text>
          <Text style={styles.sectionHint}>{t('gallery.subjectGalleryHint')}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity style={styles.galleryIconBtn} onPress={onOpenScanner}>
            <Ionicons name="scan-outline" size={18} color={theme.colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.galleryIconBtn} onPress={() => router.push('/gallery')}>
            <Ionicons name="images-outline" size={18} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.galleryCard}>
        {photos.length === 0 ? (
          <View style={styles.emptyStateCard}>
            <Ionicons name="camera-outline" size={28} color={theme.colors.text.secondary} />
            <Text style={styles.emptyStateTitle}>{t('gallery.subjectEmptyTitle')}</Text>
            <Text style={styles.emptyStateText}>{t('gallery.subjectEmptyText')}</Text>
          </View>
        ) : photos.length === 1 ? (
          <View style={styles.galleryGridSingle}>
            <TouchableOpacity style={{ flex: 1 }} onPress={() => onOpenViewer(0)}>
              <PhotoWithFallback uri={photos[0].local_uri} cloudUri={photos[0].cloud_url} style={styles.galleryImageFull} resizeMode="cover" />
            </TouchableOpacity>
          </View>
        ) : photos.length === 2 ? (
          <View style={styles.galleryGridTwo}>
            {photos.slice(0, 2).map((p, i) => (
              <TouchableOpacity key={i} style={styles.galleryImageHalf} onPress={() => onOpenViewer(i)}>
                <PhotoWithFallback uri={p.local_uri} cloudUri={p.cloud_url} style={styles.galleryImageFull} resizeMode="cover" />
              </TouchableOpacity>
            ))}
          </View>
        ) : photos.length === 3 ? (
          <View style={styles.galleryGridThree}>
            <TouchableOpacity style={styles.galleryImageLeft} onPress={() => onOpenViewer(0)}>
              <PhotoWithFallback uri={photos[0].local_uri} cloudUri={photos[0].cloud_url} style={styles.galleryImageFull} resizeMode="cover" />
            </TouchableOpacity>
            <View style={styles.galleryGridThreeRight}>
              <TouchableOpacity style={styles.galleryImageQuarter} onPress={() => onOpenViewer(1)}>
                <PhotoWithFallback uri={photos[1].local_uri} cloudUri={photos[1].cloud_url} style={styles.galleryImageFull} resizeMode="cover" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.galleryImageQuarter} onPress={() => onOpenViewer(2)}>
                <PhotoWithFallback uri={photos[2].local_uri} cloudUri={photos[2].cloud_url} style={styles.galleryImageFull} resizeMode="cover" />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.galleryGridFour}>
            <View style={styles.galleryGridFourRow}>
              <TouchableOpacity style={styles.galleryImageQuad} onPress={() => onOpenViewer(0)}>
                <PhotoWithFallback uri={photos[0].local_uri} cloudUri={photos[0].cloud_url} style={styles.galleryImageFull} resizeMode="cover" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.galleryImageQuad} onPress={() => onOpenViewer(1)}>
                <PhotoWithFallback uri={photos[1].local_uri} cloudUri={photos[1].cloud_url} style={styles.galleryImageFull} resizeMode="cover" />
              </TouchableOpacity>
            </View>
            <View style={styles.galleryGridFourRow}>
              <TouchableOpacity style={styles.galleryImageQuad} onPress={() => onOpenViewer(2)}>
                <PhotoWithFallback uri={photos[2].local_uri} cloudUri={photos[2].cloud_url} style={styles.galleryImageFull} resizeMode="cover" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.galleryImageQuad} onPress={() => onOpenViewer(3)}>
                <PhotoWithFallback uri={photos[3].local_uri} cloudUri={photos[3].cloud_url} style={styles.galleryImageFull} resizeMode="cover" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.galleryFooter}>
          <View>
            <Text style={styles.galleryFooterTitle}>{subjectName || t('gallery.fallbackSubject')}</Text>
            <Text style={styles.galleryFooterText}>
              {photos.length === 0 
                ? t('gallery.photoCount_zero') 
                : photos.length === 1 
                  ? t('gallery.photoCount_one') 
                  : t('gallery.photoCount', { count: photos.length })}
            </Text>
          </View>
          <TouchableOpacity style={styles.galleryFooterAction} onPress={onTakePhoto}>
            <Ionicons name="camera" size={22} color={theme.colors.white} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};
