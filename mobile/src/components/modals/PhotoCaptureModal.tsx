import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, Image, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useCustomAlert } from '../ui/CustomAlert';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { dashboardStyles } from '../../styles/Dashboard.styles';
import { Subject, createPhoto } from '../../services/api';
import { styles } from '../../styles/PhotoCaptureModal.styles';

interface PhotoCaptureModalProps {
  isVisible: boolean;
  onClose: () => void;
  subjects: Subject[];
  onSave?: (uri: string, subjectId: string) => void;
  initialSubjectId?: string | number;
}

/**
 * PhotoCaptureModal.tsx
 *
 * Interfaz de cámara integrada (Custom UI).
 * Permite capturar fotos directamente desde la app con selector de materia y acceso a galería.
 */
export const PhotoCaptureModal: React.FC<PhotoCaptureModalProps> = ({
  isVisible,
  onClose,
  subjects,
  onSave,
  initialSubjectId
}) => {
  const { t } = useTranslation();
  const { showAlert } = useCustomAlert();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(initialSubjectId ? String(initialSubjectId) : null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [cameraKey, setCameraKey] = useState(0);

  // Solicitar permiso automáticamente al abrir si no está otorgado
  useEffect(() => {
    if (isVisible && permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [isVisible, permission]);

  // Si se otorga el permiso mientras el modal está abierto, forzamos un refresco para evitar pantalla negra
  useEffect(() => {
    if (permission?.granted && isVisible) {
      setCameraKey(prev => prev + 1);
    }
  }, [permission?.granted]);

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
        });
        setCapturedImages([...capturedImages, photo.uri]);
        setSelectedImageIndex(capturedImages.length);
      } catch (err) {
        showAlert({ title: t('common.error'), message: t('subjects.errorTakingPhoto') || 'Error', type: 'error' });
      }
    }
  };

  const pickImage = async () => {
    try {
      const MAX_PHOTOS = 10;
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        allowsMultipleSelection: true,
        selectionLimit: MAX_PHOTOS,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newImages = result.assets.map(asset => asset.uri);
        const updatedImages = [...capturedImages, ...newImages];
        setCapturedImages(updatedImages);
        setSelectedImageIndex(updatedImages.length - 1);
      }
    } catch (err) {
      showAlert({ title: t('common.error'), message: t('common.error') || 'Error', type: 'error' });
    }
  };

  const handleSave = async () => {
    if (capturedImages.length === 0 || !selectedSubjectId) {
      showAlert({ title: t('common.error'), message: t('dashboard.documentScannerModal.selectSubjectError') || 'Error', type: 'warning' });
      return;
    }

    try {
      setIsProcessing(true);
      let successCount = 0;

      const photosDir = `${FileSystem.documentDirectory}Threshold/photos/`;
      const dirInfo = await FileSystem.getInfoAsync(photosDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(photosDir, { intermediates: true });
      }

      // Copiar cada foto a un directorio permanente
      const permanentUris: string[] = [];
      for (const imageUri of capturedImages) {
        const ext = imageUri.includes('.png') ? '.png' : '.jpg';
        const permName = `photo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}${ext}`;
        const permUri = `${photosDir}${permName}`;
        try {
          await FileSystem.copyAsync({ from: imageUri, to: permUri });
          permanentUris.push(permUri);
          console.log('[PhotoCaptureModal] Foto copiada a:', permUri);
        } catch (copyErr) {
          console.warn('[PhotoCaptureModal] Error copiando foto, usando URI original:', copyErr);
          permanentUris.push(imageUri);
        }
      }
      
      // Generar un group_id si hay múltiples fotos para mostrarlas agrupadas en la galería
      const groupId = capturedImages.length > 1 ? `grp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}` : null;

      for (const permUri of permanentUris) {
        try {
          await createPhoto({
            subject_id: String(selectedSubjectId),
            local_uri: permUri,
            group_id: groupId,
          });
          successCount++;
        } catch (photoError) {
          console.warn('[PhotoCaptureModal] Error saving photo:', photoError);
        }
      }
      
      if (successCount > 0) {
        if (onSave) onSave(permanentUris[0], selectedSubjectId);
        showAlert({ 
          title: t('common.success'), 
          message: t('dashboard.quickAddMenu.takePhoto.success') || `${successCount} foto(s) guardada(s)`, 
          type: 'success' 
        });
        resetAndClose();
      } else {
        showAlert({ title: t('common.error'), message: t('dashboard.quickAddMenu.takePhoto.error') || 'Error', type: 'error' });
      }
    } catch (error) {
      showAlert({ title: t('common.error'), message: t('dashboard.quickAddMenu.takePhoto.error') || 'Error', type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  const resetAndClose = () => {
    setCapturedImages([]);
    setSelectedImageIndex(null);
    setSelectedSubjectId(initialSubjectId ? String(initialSubjectId) : null);
    setIsProcessing(false);
    setFlashEnabled(false);
    onClose();
  };

  // UI de Permisos dentro del mismo flujo si no están otorgados
  if (isVisible && permission && !permission.granted) {
    return (
      <Modal visible={isVisible} animationType="slide" hardwareAccelerated={true}>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={64} color={theme.colors.primary} style={{ marginBottom: 20 }} />
          <Text style={styles.permissionText}>{t('dashboard.quickAddMenu.errors.cameraPermission') || 'Se requiere acceso a la cámara'}</Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>{t('common.grantPermission') || 'Dar Permiso'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={{ marginTop: 20 }}>
            <Text style={{ color: theme.colors.text.secondary }}>{t('common.cancel') || 'Cancelar'}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={isVisible} animationType="slide" onRequestClose={resetAndClose} hardwareAccelerated={true}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={resetAndClose} style={styles.closeBtn}>
            <Ionicons name="close" size={28} color={theme.colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {capturedImages.length > 0 ? t('common.preview') || 'Vista Previa' : t('dashboard.quickAddMenu.takePhotoLabel') || 'Tomar Foto'}
          </Text>
          <View style={{ width: 44 }} />
        </View>

        {!capturedImages.length ? (
          <View style={styles.camera}>
            <CameraView 
              key={cameraKey}
              style={StyleSheet.absoluteFillObject} 
              facing="back" 
              ref={cameraRef} 
              enableTorch={flashEnabled} 
            />
            <View style={[styles.cameraOverlay, { position: 'absolute', bottom: 0, left: 0, right: 0 }]}>
              <View style={styles.captureButtonContainer}>
                
                {/* Botón de Galería al lado del obturador */}
                <TouchableOpacity onPress={pickImage} style={styles.sideButton}>
                  <Ionicons name="images-outline" size={28} color="white" />
                </TouchableOpacity>

                {/* Obturador central */}
                <TouchableOpacity style={styles.captureButtonOuter} onPress={takePicture}>
                  <View style={styles.captureButtonInner} />
                </TouchableOpacity>

                {/* Flash */}
                <TouchableOpacity onPress={() => setFlashEnabled(!flashEnabled)} style={styles.sideButton}>
                  <Ionicons name={flashEnabled ? "flash" : "flash-off"} size={24} color="white" />
                </TouchableOpacity>

              </View>
            </View>
          </View>
        ) : (
          <View style={styles.previewContainer}>
            {/* Vista de fotos capturadas */}
            {selectedImageIndex !== null && capturedImages[selectedImageIndex] && (
              <Image source={{ uri: capturedImages[selectedImageIndex] }} style={styles.previewImage} resizeMode="contain" />
            )}
            
            {/* Galeria de miniaturas */}
            {capturedImages.length > 0 && (
              <View style={{ backgroundColor: theme.colors.inputBackground, padding: 12, borderRadius: 12, marginHorizontal: 16, marginTop: 12, marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.text.primary }}>
                    {capturedImages.length} {t('common.photos') || 'fotos'}
                  </Text>
                  <TouchableOpacity 
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                    onPress={pickImage}
                  >
                    <Ionicons name="add-circle-outline" size={20} color={theme.colors.primary} />
                    <Text style={{ color: theme.colors.primary, fontWeight: '600', fontSize: 12 }}>{t('common.add') || 'Agregar'}</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {capturedImages.map((uri, idx) => (
                    <View key={idx} style={{ position: 'relative' }}>
                      <TouchableOpacity
                        onPress={() => setSelectedImageIndex(idx)}
                        style={[
                          { width: 70, height: 70, borderRadius: 8, overflow: 'hidden', borderWidth: 2 },
                          selectedImageIndex === idx 
                            ? { borderColor: theme.colors.primary } 
                            : { borderColor: theme.colors.border }
                        ]}
                      >
                        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          const newImages = capturedImages.filter((_, i) => i !== idx);
                          setCapturedImages(newImages);
                          setSelectedImageIndex(newImages.length > 0 ? Math.min(selectedImageIndex || 0, newImages.length - 1) : null);
                        }}
                        style={{ position: 'absolute', top: -8, right: -8, backgroundColor: theme.colors.primary, borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Ionicons name="close" size={16} color="white" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            )}
            
            <View style={[styles.actionSheet, { paddingBottom: Platform.OS === 'ios' ? 44 : 52 }]}>
              <Text style={styles.sheetTitle}>{t('dashboard.documentScannerModal.save') || 'Guardar'}</Text>
              
              <View style={styles.subjectGrid}>
                {subjects.map(s => (
                  <TouchableOpacity 
                    key={s.id} 
                    style={[
                      styles.subjectItem, 
                      String(selectedSubjectId) === String(s.id) && { 
                        backgroundColor: s.color ? s.color + '30' : theme.colors.primary + '20', 
                        borderColor: s.color || undefined,
                        borderWidth: 2
                      }
                    ]}
                    onPress={() => setSelectedSubjectId(String(s.id))}
                  >
                    <View style={[dashboardStyles.subjectBadge, { backgroundColor: s.color || '#CCC', marginRight: 0, marginBottom: 4 }]}>
                      <MaterialCommunityIcons name={(s.icon as any) || 'book-outline'} size={18} color={theme.colors.text.primary} />
                    </View>
                    <Text style={styles.subjectName} numberOfLines={1}>{s.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.saveActions}>
                <TouchableOpacity onPress={() => setCapturedImages([])} style={styles.secondaryBtn}>
                  <Text style={styles.secondaryBtnText}>{t('common.retake') || 'Limpiar'}</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={handleSave} 
                  disabled={capturedImages.length === 0 || !selectedSubjectId || isProcessing}
                  style={[styles.primaryBtn, (capturedImages.length === 0 || !selectedSubjectId || isProcessing) && styles.primaryBtnDisabled]}
                >
                  {isProcessing ? <ActivityIndicator color="white" /> : <Text style={styles.primaryBtnText}>{t('common.save') || 'Guardar'}</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
};
