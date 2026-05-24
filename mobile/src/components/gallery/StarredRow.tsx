import React from 'react';
import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { galleryStyles } from '../../styles/Gallery.styles';
import { GalleryPhoto } from '../../types/gallery';

interface StarredRowProps {
  starred: GalleryPhoto[];
  onPress: (photos: GalleryPhoto[], index: number) => void;
  onStar: (photo: GalleryPhoto) => void;
  formatDate: (d?: string) => string;
}

export const StarredRow: React.FC<StarredRowProps> = ({ starred, onPress, onStar, formatDate }) => {
  if (starred.length === 0) return null;

  return (
    <View style={galleryStyles.section}>
      <View style={galleryStyles.sectionHeaderRow}>
        <Text style={galleryStyles.sectionTitle}>Favoritas</Text>
        <Text style={galleryStyles.sectionMeta}>{starred.length} fotos</Text>
      </View>
      <FlatList
        horizontal
        data={starred}
        keyExtractor={(item) => `star-${item.id}`}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={galleryStyles.starredRow}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={galleryStyles.starredCard}
            activeOpacity={0.85}
            onPress={() => {
              const idx = starred.findIndex((p) => p.id === item.id);
              onPress(starred, idx >= 0 ? idx : 0);
            }}
          >
            <Image
              source={{ uri: item.local_uri }}
              style={galleryStyles.starredImage}
              contentFit="cover"
              transition={200}
            />
            <Text style={galleryStyles.starredSubject} numberOfLines={1}>{item.subject_name}</Text>
            <Text style={galleryStyles.starredDate}>{formatDate(item.created_at)}</Text>
            <TouchableOpacity
              style={galleryStyles.starBtn}
              onPress={() => onStar(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="star" size={14} color="#FFD700" />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};
