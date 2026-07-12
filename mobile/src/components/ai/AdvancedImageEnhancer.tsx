import React, { useState, forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, LayoutChangeEvent, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { advancedImageEnhancerStyles } from '../../styles/AdvancedImageEnhancer.styles';
import { Canvas, Image, useImage, ColorMatrix, useCanvasRef } from '@shopify/react-native-skia';
import * as FileSystem from 'expo-file-system/legacy';
import { useTranslation } from 'react-i18next';

interface FilterOption {
  id: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  matrix?: number[];
}

const FILTERS: FilterOption[] = [
  { id: 'original', name: 'Original', icon: 'image-outline' },
  { 
    id: 'magic', 
    name: 'Magic Text', 
    icon: 'color-wand-outline',
    matrix: [
      1.5, 0, 0, 0, -0.2,
      0, 1.5, 0, 0, -0.2,
      0, 0, 1.5, 0, -0.2,
      0, 0, 0, 1, 0
    ]
  },
  { 
    id: 'bw', 
    name: 'B/N OCR', 
    icon: 'document-text-outline',
    matrix: [
      3.0, 3.0, 3.0, 0, -3.0,
      3.0, 3.0, 3.0, 0, -3.0,
      3.0, 3.0, 3.0, 0, -3.0,
      0, 0, 0, 1, 0
    ]
  },
  { 
    id: 'grayscale', 
    name: 'Escala de Grises', 
    icon: 'contrast-outline',
    matrix: [
      0.2126, 0.7152, 0.0722, 0, 0,
      0.2126, 0.7152, 0.0722, 0, 0,
      0.2126, 0.7152, 0.0722, 0, 0,
      0, 0, 0, 1, 0
    ]
  },
];

interface AdvancedImageEnhancerProps {
  imageUri: string;
  onFilterChange: (filterId: string) => void;
}

export interface AdvancedImageEnhancerRef {
  exportProcessedImage: () => Promise<string | null>;
  exportBase64: () => Promise<string | null>;
}

export const AdvancedImageEnhancer = forwardRef<AdvancedImageEnhancerRef, AdvancedImageEnhancerProps>(function AdvancedImageEnhancer({
  imageUri,
  onFilterChange,
  },
  ref
) {
  const { t } = useTranslation();
  const [activeFilter, setActiveFilter] = useState('original');
  const [renderKey, setRenderKey] = useState(0);
  const skImage = useImage(imageUri);
  const canvasRef = useCanvasRef();
  const [canvasSize, setCanvasSize] = useState({ width: 300, height: 400 });

  const translatedFilters = FILTERS.map(f => ({
    ...f,
    name: t(`modals.filters.${f.id}`, f.name)
  }));

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        setRenderKey(prev => prev + 1);
      }
    });
    return () => {
      subscription.remove();
    };
  }, []);

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setCanvasSize({ width, height });
    }
  };

  const handleFilterSelect = (id: string) => {
    setActiveFilter(id);
    onFilterChange(id);
  };

  const selectedFilter = translatedFilters.find(f => f.id === activeFilter);

  useImperativeHandle(ref, () => ({
    exportProcessedImage: async () => {
      try {
        if (!canvasRef.current) return imageUri;
        
        const imageSnapshot = canvasRef.current.makeImageSnapshot();
        if (!imageSnapshot) return imageUri;

        const base64Data = imageSnapshot.encodeToBase64();
        const tempUri = FileSystem.cacheDirectory + `filtered_${Date.now()}.png`;
        
        await FileSystem.writeAsStringAsync(tempUri, base64Data, {
          encoding: FileSystem.EncodingType.Base64,
        });

        return tempUri;
      } catch (error) {
        console.error("Error al exportar imagen filtrada", error);
        return imageUri;
      }
    },
    exportBase64: async () => {
      try {
        if (!canvasRef.current) return null;
        const imageSnapshot = canvasRef.current.makeImageSnapshot();
        if (!imageSnapshot) return null;
        return imageSnapshot.encodeToBase64();
      } catch (error) {
        console.error("Error al exportar base64", error);
        return null;
      }
    }
  }));

  return (
    <View style={advancedImageEnhancerStyles.container}>
      <View style={advancedImageEnhancerStyles.previewContainer} onLayout={handleLayout}>
        {!skImage ? (
          <ActivityIndicator size="large" color="white" style={advancedImageEnhancerStyles.loader} />
        ) : (
          <Canvas key={renderKey} style={advancedImageEnhancerStyles.canvas} ref={canvasRef}>
            <Image
              image={skImage}
              fit="contain"
              x={0}
              y={0}
              width={canvasSize.width}
              height={canvasSize.height}
            >
              {selectedFilter?.matrix && (
                <ColorMatrix matrix={selectedFilter.matrix} />
              )}
            </Image>
          </Canvas>
        )}
        
        {activeFilter !== 'original' && (
          <View style={advancedImageEnhancerStyles.activeFilterBadge}>
            <Text style={advancedImageEnhancerStyles.activeFilterText}>
              {t('modals.filters.prefix', 'Filtro: ')}{selectedFilter?.name}
            </Text>
          </View>
        )}
      </View>

      <View style={advancedImageEnhancerStyles.filtersContainer}>
        <Text style={advancedImageEnhancerStyles.filtersTitle}>{t('modals.filters.smartEnhancements', 'Mejoras Inteligentes')}</Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={advancedImageEnhancerStyles.filtersScroll}
        >
          {translatedFilters.map((filter) => {
            const isActive = activeFilter === filter.id;
            return (
              <TouchableOpacity
                key={filter.id}
                style={[advancedImageEnhancerStyles.filterBtn, isActive && advancedImageEnhancerStyles.filterBtnActive]}
                onPress={() => handleFilterSelect(filter.id)}
              >
                <View style={[advancedImageEnhancerStyles.filterIconContainer, isActive && advancedImageEnhancerStyles.filterIconContainerActive]}>
                  <Ionicons name={filter.icon} size={24} color={isActive ? theme.colors.primary : theme.colors.text.secondary} />
                </View>
                <Text style={[advancedImageEnhancerStyles.filterText, isActive && advancedImageEnhancerStyles.filterTextActive]}>{filter.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
});
