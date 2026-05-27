import React, { useRef, useState, useEffect } from 'react';
import { View, Modal, TouchableOpacity, Image, FlatList, Dimensions, Share, Platform, ActivityIndicator, Text, TextInput } from 'react-native';
import { useCustomAlert } from '../ui/CustomAlert';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { deletePhoto, extractTextFromImage, updatePhoto } from '../../services/api';
import * as FileSystem from 'expo-file-system/legacy';
import * as Clipboard from 'expo-clipboard';
import { theme } from '../../styles/theme';
import { styles } from '../../styles/ImageViewerModal.styles';
import { ZoomableImage } from '../ui/ZoomableImage';

const { width } = Dimensions.get('window');

interface PhotoItem {
  id?: number;
  local_uri: string;
  cloud_url?: string | null;
}

interface ImageViewerModalProps {
  isVisible: boolean;
  photos: PhotoItem[];
  initialIndex?: number;
  onClose: () => void;
  onPhotoDeleted: (id: number) => void;
  onOCRSaved?: () => void;
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
  onPhotoDeleted,
  onOCRSaved,
}) => {
  const { t } = useTranslation();
  const { showAlert } = useCustomAlert();
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedText, setExtractedText] = useState<string | null>(null);

  // Solo en el primer render visible: ir al initialIndex
  useEffect(() => {
    if (isVisible && photos.length > 0) {
      const index = Math.min(initialIndex, photos.length - 1);
      setCurrentIndex(index);
      
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index,
          animated: false,
        });
      }, 100);
    }
  }, [isVisible, initialIndex, photos.length]);

  // Si la longitud de fotos cambia (por ejemplo, se borró una foto)
  useEffect(() => {
    if (isVisible && photos.length > 0) {
      if (currentIndex >= photos.length) {
        const newIndex = photos.length - 1;
        setCurrentIndex(newIndex);
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({
            index: newIndex,
            animated: true,
          });
        }, 100);
      }
    }
  }, [photos.length, currentIndex, isVisible]);

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

      // Guardar OCR en la BD para que el asistente IA pueda acceder a él
      if (currentPhoto.id) {
        try {
          await updatePhoto(currentPhoto.id, { ocr_text: text });
          console.log(`[ImageViewerModal] OCR guardado para foto ${currentPhoto.id}`);
          // Notificar al padre que el OCR fue guardado para que refresque los datos
          onOCRSaved?.();
        } catch (err: any) {
          console.warn('[ImageViewerModal] Error guardando OCR:', err.message);
          // El OCR se muestra de todas formas aunque falle el guardado en BD
        }
      }
    } catch (error: any) {
      showAlert({ title: t('common.ocrError') || 'Error OCR', message: error.message, type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async (photoId: number) => {
    showAlert({
      title: t('gallery.deletePhotoTitle'),
      message: t('gallery.deletePhotoConfirm'),
      type: 'confirm',
      buttons: [
        { text: t('common.cancel') || 'Cancelar', style: 'cancel' },
        { 
          text: t('common.delete') || 'Eliminar', 
          style: 'destructive',
          onPress: async () => {
            try {
              console.log(`[ImageViewerModal] Iniciando borrado de Foto ID: ${photoId}`);
              const photo = photos.find(p => p.id === photoId);
              
              await deletePhoto(photoId);
              
              // Eliminar archivo físico para liberar espacio
              if (photo?.local_uri) {
                try {
                  console.log(`[ImageViewerModal] Intentando borrar archivo físico: ${photo.local_uri}`);
                  const fileInfo = await FileSystem.getInfoAsync(photo.local_uri);
                  if (fileInfo.exists) {
                    await FileSystem.deleteAsync(photo.local_uri);
                    console.log('[ImageViewerModal] Archivo físico borrado.');
                  } else {
                    console.log('[ImageViewerModal] Archivo físico no encontrado localmente.');
                  }
                } catch (fsError) {
                  console.warn('[ImageViewerModal] Error al borrar archivo físico:', fsError);
                }
              }

              console.log('[ImageViewerModal] Borrado exitoso, cerrando visor si es necesario.');
              onPhotoDeleted(photoId);
              if (photos.length <= 1) {
                onClose(); // Cerrar si no quedan más fotos
              }
            } catch (error: any) {
              console.error('[ImageViewerModal] ERROR AL BORRAR FOTO:', error);
              showAlert({ title: t('common.error'), message: t('gallery.deletePhotoError') + ` (${error.message})`, type: 'error' });
            }
          }
        }
      ]
    });
  };


  const ImageWithFallback = ({ item }: { item: PhotoItem }) => {
    const [sourceUri, setSourceUri] = useState(item.local_uri || item.cloud_url || '');
    
    return (
      <View style={styles.imageContainer}>
        <ZoomableImage 
          uri={sourceUri}
          resizeMode="contain"
        />
      </View>
    );
  };

  const renderItem = ({ item }: { item: PhotoItem }) => (
    <ImageWithFallback item={item} />
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


