import React, { useRef, useState, useEffect } from 'react';
import { View, Modal, TouchableOpacity, Image, FlatList, Dimensions, Share, ActionSheetIOS, Platform, ActivityIndicator, Text, ScrollView, TextInput } from 'react-native';
import { useCustomAlert } from './CustomAlert';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { deletePhoto, extractTextFromImage } from '../services/api';
import * as FileSystem from 'expo-file-system/legacy';
import * as Clipboard from 'expo-clipboard';
import { theme } from '../styles/theme';
import { styles } from '../styles/ImageViewerModal.styles';

const { width, height } = Dimensions.get('window');

interface PhotoItem {
  id?: number;
  local_uri: string;
}

interface ImageViewerModalProps {
  isVisible: boolean;
  photos: PhotoItem[];
  initialIndex?: number;
  onClose: () => void;
  onPhotoDeleted: (id: number) => void;
}

/**
 * ImageViewerModal.tsx
 *
 * Modal de pantalla completa para visualizar imágenes en un carrusel deslizable (FlatList).
 * Permite al usuario deslizar horizontalmente entre fotos. Incluye controles superiores
 * para compartir nativamente la foto, extraer su texto mediante OCR (Inteligencia Artificial),
 * y eliminarla. Si se detecta texto (OCR), se despliega un panel inferior interactivo.
 *
 * @param isVisible - Define si el modal visor de fotos está abierto o no.
 * @param photos - Arreglo de fotos con sus URIs locales para ser visualizadas.
 * @param initialIndex - Índice de la foto desde la cual iniciar el carrusel.
 * @param onClose - Función ejecutada al cerrar el modal visor.
 * @param onPhotoDeleted - Callback invocado exitosamente al borrar una foto de la galería.
 */
export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  isVisible,
  photos,
  initialIndex = 0,
  onClose,
  onPhotoDeleted
}) => {
  const { t } = useTranslation();
  const { showAlert } = useCustomAlert();
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedText, setExtractedText] = useState<string | null>(null);

  useEffect(() => {
    if (isVisible && photos.length > 0) {
      const index = Math.min(initialIndex, photos.length - 1);
      setCurrentIndex(index);
      
      // Asegurar que la lista se desplace al índice correcto al abrir
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index,
          animated: false,
        });
      }, 100);
    }
  }, [isVisible, initialIndex, photos.length]);

  const handleShare = async (uri: string) => {
    try {
      await Share.share({
        url: uri, // works well on iOS for local files
        message: t('subjects.photoShareMessage') || 'Mira esta foto',
      });
    } catch (error: any) {
      showAlert({ title: t('common.error'), message: error.message, type: 'error' });
    }
  };

  const handleOCR = async () => {
    const currentPhoto = photos[currentIndex];
    if (!currentPhoto) return;
    try {
      setIsProcessing(true);
      const base64Data = await FileSystem.readAsStringAsync(currentPhoto.local_uri, {
        encoding: 'base64',
      });
      const text = await extractTextFromImage(base64Data);
      
      if (!text || text.trim() === '') {
        showAlert({ title: t('common.notice') || 'Aviso', message: t('common.errors.noTextDetected') || 'No se detectó texto en la imagen.', type: 'info' });
        return;
      }

      setExtractedText(text);
    } catch (error: any) {
      showAlert({ title: t('common.ocrError') || 'Error OCR', message: error.message, type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async (photoId: number) => {
    showAlert({
      title: t('common.delete') || 'Eliminar',
      message: t('subjects.deletePhotoConfirm') || '¿Estás seguro de que quieres eliminar esta foto?',
      type: 'confirm',
      buttons: [
        { text: t('common.cancel') || 'Cancelar', style: 'cancel' },
        { 
          text: t('common.delete') || 'Eliminar', 
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePhoto(photoId);
              onPhotoDeleted(photoId);
              if (photos.length <= 1) {
                onClose(); // Cerrar si no quedan más fotos
              }
            } catch (error) {
              showAlert({ title: t('common.error'), message: t('subjects.deletePhotoError') || 'Error al eliminar', type: 'error' });
            }
          }
        }
      ]
    });
  };


  const renderItem = ({ item }: { item: PhotoItem }) => (
    <View style={styles.imageContainer}>
      <Image source={{ uri: item.local_uri }} style={styles.image} resizeMode="contain" />
    </View>
  );

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  return (
    <Modal visible={isVisible} transparent={true} animationType="fade" onRequestClose={() => {
      if (extractedText) setExtractedText(null);
      else onClose();
    }}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.iconButton}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity onPress={handleOCR} style={styles.iconButton} disabled={isProcessing}>
              {isProcessing ? <ActivityIndicator color="#C5A059" /> : <MaterialCommunityIcons name="text-recognition" size={24} color="#C5A059" />}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleShare(photos[currentIndex]?.local_uri)} style={styles.iconButton}>
              <Ionicons name="share-outline" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => photos[currentIndex]?.id && handleDelete(photos[currentIndex].id!)} style={styles.iconButton}>
              <Ionicons name="trash-outline" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
        
        <FlatList
          ref={flatListRef}
          data={photos}
          keyExtractor={(item, index) => item.id ? item.id.toString() : index.toString()}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          renderItem={renderItem}
          initialScrollIndex={initialIndex}
          getItemLayout={(data, index) => ({ length: width, offset: width * index, index })}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              flatListRef.current?.scrollToIndex({ index: info.index, animated: false });
            }, 500);
          }}
        />

        {/* Panel Inferior para Texto Extraído */}
        {extractedText && (
          <View style={[styles.ocrOverlay, { paddingBottom: Platform.OS === 'ios' ? 44 : 48 }]}>
            <View style={styles.ocrHeader}>
              <Text style={styles.ocrTitle}>{t('dashboard.documentScannerModal.transcribedText') || 'Texto Extraído'}</Text>
              <TouchableOpacity onPress={() => setExtractedText(null)}>
                <Ionicons name="close" size={24} color={theme.colors.text.secondary} />
              </TouchableOpacity>
            </View>
            
            <TextInput 
              style={[styles.ocrScroll, styles.ocrText, { textAlignVertical: 'top' }]}
              multiline={true}
              value={extractedText}
              onChangeText={setExtractedText}
            />
            
            <TouchableOpacity 
              style={styles.ocrCopyButton}
              onPress={async () => {
                await Clipboard.setStringAsync(extractedText);
                showAlert({ title: t('common.success') || 'Copiado', message: t('common.copiedToClipboard') || 'Texto copiado al portapapeles', type: 'success' });
              }}
            >
              <Ionicons name="copy-outline" size={20} color={theme.colors.white} style={{ marginRight: 8 }} />
              <Text style={styles.ocrCopyText}>{t('common.copyText') || 'Copiar Texto'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
};


