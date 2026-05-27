import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { galleryStyles } from '../../styles/Gallery.styles';
import { AutoUploadIndicator } from '../ui/AutoUploadIndicator';
import { FilterTab } from '../../types/gallery';

interface FilterTabsProps {
  filterTab: FilterTab;
  totalPhotoCount: number;
  onSelectTab: (tab: FilterTab) => void;
  t: any;
}

const TABS: FilterTab[] = ['all', 'starred', 'ocr'];

export const FilterTabs: React.FC<FilterTabsProps> = ({
  filterTab,
  totalPhotoCount,
  onSelectTab,
  t,
}) => {
  return (
    <View style={[galleryStyles.tabRow, { alignItems: 'center' }]}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[galleryStyles.tab, filterTab === tab && galleryStyles.tabActive]}
            onPress={() => onSelectTab(tab)}
          >
            <Text style={[galleryStyles.tabText, filterTab === tab && galleryStyles.tabTextActive]}>
              {tab === 'all' ? (t('gallery.all') || 'Todas') :
               tab === 'starred' ? (t('gallery.starred') || 'Favoritas') : 'OCR'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ flex: 1 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={galleryStyles.itemCount}>{totalPhotoCount} {t('gallery.items') || 'fotos'}</Text>
        <AutoUploadIndicator size={18} />
      </View>
    </View>
  );
};
