import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { globalStyles } from '../../styles/globalStyles';
import { galleryStyles } from '../../styles/Gallery.styles';
import { OfflineIndicator } from '../ui/OfflineIndicator';

interface GalleryHeaderProps {
  isSearchOpen: boolean;
  onToggleSearch: () => void;
  onOpenScanner: () => void;
  onOpenCamera: () => void;
  t: any;
}

export const GalleryHeader: React.FC<GalleryHeaderProps> = ({
  isSearchOpen,
  onToggleSearch,
  onOpenScanner,
  onOpenCamera,
  t,
}) => {
  return (
    <View style={[galleryStyles.header, isSearchOpen && { paddingBottom: 8 }]}>
      <View style={{ flex: 1 }}>
        <View style={globalStyles.row}>
          <Ionicons name="images-outline" size={20} color={theme.colors.primary} style={globalStyles.mr8} />
          <Text style={galleryStyles.logoText}>{t('gallery.title') || 'Galería'}</Text>
        </View>
        <OfflineIndicator />
      </View>
      <View style={globalStyles.row}>
        <TouchableOpacity style={galleryStyles.iconBtn} onPress={onToggleSearch}>
          <Feather name={isSearchOpen ? 'x' : 'search'} size={18} color={theme.colors.text.secondary} />
        </TouchableOpacity>
        <TouchableOpacity style={[galleryStyles.scanBtn, { marginLeft: 8 }]} onPress={onOpenScanner}>
          <Ionicons name="scan-outline" size={16} color={theme.colors.text.primary} style={{ marginRight: 4 }} />
          <Text style={galleryStyles.scanText}>{t('gallery.scan') || 'Escanear'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={galleryStyles.iconBtn} onPress={onOpenCamera}>
          <Ionicons name="camera-outline" size={20} color={theme.colors.text.secondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
};
