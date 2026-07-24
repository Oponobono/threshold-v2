import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { galleryStyles } from '../../styles/Gallery.styles';
import { AutoUploadIndicator } from '../ui/AutoUploadIndicator';

interface GalleryFilterPillsProps {
  filterStarred: boolean;
  filterOcr: boolean;
  onFilterChange: (starred: boolean, ocr: boolean) => void;
  totalPhotoCount: number;
  t: any;
}

export const FilterTabs: React.FC<GalleryFilterPillsProps> = ({
  filterStarred,
  filterOcr,
  onFilterChange,
  totalPhotoCount,
  t,
}) => {
  const isAll = !filterStarred && !filterOcr;

  return (
    <View style={[galleryStyles.tabRow, { alignItems: 'center' }]}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TouchableOpacity
          style={[galleryStyles.tab, isAll && galleryStyles.tabActive]}
          onPress={() => onFilterChange(false, false)}
        >
          <Text style={[galleryStyles.tabText, isAll && galleryStyles.tabTextActive]}>
            {t('gallery.all') || 'Todas'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[galleryStyles.tab, filterStarred && galleryStyles.tabActive]}
          onPress={() => onFilterChange(!filterStarred, filterOcr)}
        >
          <Text style={[galleryStyles.tabText, filterStarred && galleryStyles.tabTextActive]}>
            {t('gallery.starred') || 'Favoritas'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[galleryStyles.tab, filterOcr && galleryStyles.tabActive]}
          onPress={() => onFilterChange(filterStarred, !filterOcr)}
        >
          <Text style={[galleryStyles.tabText, filterOcr && galleryStyles.tabTextActive]}>
            OCR
          </Text>
        </TouchableOpacity>
      </View>
      <View style={{ flex: 1 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={galleryStyles.itemCount}>{totalPhotoCount} {t('gallery.items') || 'fotos'}</Text>
        <AutoUploadIndicator size={18} />
      </View>
    </View>
  );
};
