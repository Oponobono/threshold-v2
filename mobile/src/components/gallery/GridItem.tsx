import React, { useState, useCallback, memo } from 'react';
import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { globalStyles } from '../../styles/globalStyles';
import { galleryStyles } from '../../styles/Gallery.styles';
import { GalleryPhoto } from '../../types/gallery';
import { alertRef } from '../ui/CustomAlert';

interface GridItemProps {
  item: GalleryPhoto[];
  onPress: (photo: GalleryPhoto, group: GalleryPhoto[]) => void;
  onStar: (photo: GalleryPhoto) => void;
  onDelete: (group: GalleryPhoto[]) => void;
  onOcrPress?: (ocrText: string) => void;
  formatDate: (d?: string) => string;
  colWidth: number;
  t: any;
}

const PhotoWithFallback = memo(function PhotoWithFallback({
  uri,
  cloudUri,
  style,
  contentFit,
  transition,
}: {
  uri: string;
  cloudUri?: string | null;
  style: any;
  contentFit?: any;
  transition?: number;
}) {
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
      contentFit={contentFit}
      transition={transition}
      onError={handleError}
    />
  );
});

export const GridItem = memo(function GridItem({
  item,
  onPress,
  onStar,
  onDelete,
  onOcrPress,
  formatDate,
  colWidth,
  t,
}: GridItemProps) {
  const firstItem = item[0];
  const [activeIndex, setActiveIndex] = useState(0);

  const handleScroll = (event: any) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const index = event.nativeEvent.contentOffset.x / slideSize;
    setActiveIndex(Math.round(index));
  };

  const showMenu = () => {
    alertRef.show({
      title: firstItem.subject_name || t('common.options'),
      type: 'confirm',
      buttons: [
        { text: t('common.delete'), style: 'destructive', onPress: () => onDelete(item) },
        { text: t('common.cancel'), style: 'cancel' },
      ],
    });
  };

  return (
    <View style={[galleryStyles.gridCard, { width: colWidth }]}>
      <View style={galleryStyles.gridImageContainer}>
        <FlatList
          data={item}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          keyExtractor={(p) => p.id?.toString() || Math.random().toString()}
          renderItem={({ item: p }) => (
            <TouchableOpacity activeOpacity={0.88} onPress={() => onPress(p, item)} style={{ width: colWidth, height: 110 }}>
              <PhotoWithFallback
                uri={p.local_uri}
                cloudUri={p.cloud_url}
                style={galleryStyles.gridImageFull}
                contentFit="cover"
                transition={200}
              />
            </TouchableOpacity>
          )}
        />
        {item.length > 1 && (
          <View style={galleryStyles.dotsRow}>
            {item.map((_, i) => (
              <View
                key={i}
                style={[
                  galleryStyles.dot,
                  { backgroundColor: i === activeIndex ? theme.colors.white : 'rgba(255,255,255,0.5)' },
                ]}
              />
            ))}
          </View>
        )}
        {item[activeIndex]?.ocr_text ? (
          <View style={galleryStyles.ocrOverlay}>
            <MaterialCommunityIcons name="text-recognition" size={10} color={theme.colors.primary} />
            <Text style={galleryStyles.ocrOverlayText}>OCR</Text>
          </View>
        ) : null}
        <TouchableOpacity
          onPress={() => onStar(item[activeIndex])}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={galleryStyles.starOverlayBtn}
        >
          <Ionicons
            name={item[activeIndex]?.es_favorita ? 'star' : 'star-outline'}
            size={14}
            color={item[activeIndex]?.es_favorita ? '#FFD700' : '#fff'}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={showMenu}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={galleryStyles.gridMenuBtn}
        >
          <Ionicons name="ellipsis-vertical" size={14} color="#fff" />
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={galleryStyles.gridInfo}
        onPress={() => item[activeIndex]?.ocr_text && onOcrPress?.(item[activeIndex].ocr_text)}
        disabled={!item[activeIndex]?.ocr_text}
        activeOpacity={item[activeIndex]?.ocr_text ? 0.7 : 1}
      >
        <View style={[globalStyles.rowCenter, globalStyles.mb4, { gap: 4 }]}>
          <View style={[galleryStyles.subjectDot, { backgroundColor: firstItem.subject_color || theme.colors.primary }]} />
          <Text style={galleryStyles.gridSubject} numberOfLines={1}>{firstItem.subject_name}</Text>
        </View>
        <Text style={galleryStyles.gridDate}>{formatDate(firstItem.created_at)}</Text>
        {item[activeIndex]?.ocr_text ? (
          <Text style={galleryStyles.gridOcr} numberOfLines={2}>{item[activeIndex].ocr_text}</Text>
        ) : null}
      </TouchableOpacity>
    </View>
  );
});
