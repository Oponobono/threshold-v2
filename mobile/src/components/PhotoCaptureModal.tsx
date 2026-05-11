import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, Image, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useCustomAlert } from './CustomAlert';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../styles/theme';
import { dashboardStyles } from '../styles/Dashboard.styles';
import { Subject, createPhoto } from '../services/api';
import { styles } from '../styles/PhotoCaptureModal.styles';

interface PhotoCaptureModalProps {
  isVisible: boolean;
  onClose: () => void;
  subjects: Subject[];
  onSave?: (uri: string, subjectId: number) => void;
  initialSubjectId?: number;
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
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(initialSubjectId || null);
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
        setCapturedImage(photo.uri);
      } catch (err) {
        showAlert({ title: t('common.error'), message: t('subjects.errorTakingPhoto') || 'Error', type: 'error' });
      }
    }
  };

  const pickImage = async () => {
    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setCapturedImage(result.assets[0].uri);
      }
    } catch (err) {
      showAlert({ title: t('common.error'), message: t('common.error') || 'Error', type: 'error' });
    }
  };

  const handleSave = async () => {
    if (!capturedImage || !selectedSubjectId) {
      showAlert({ title: t('common.error'), message: t('dashboard.documentScannerModal.selectSubjectError') || 'Error', type: 'warning' });
      return;
    }

    try {
      setIsProcessing(true);
      await createPhoto({
        subject_id: selectedSubjectId,
        local_uri: capturedImage,
      });
      if (onSave) onSave(capturedImage, selectedSubjectId);
      showAlert({ title: t('common.success'), message: t('dashboard.quickAddMenu.takePhoto.success') || 'Éxito', type: 'success' });
      resetAndClose();
    } catch (error) {
      showAlert({ title: t('common.error'), message: t('dashboard.quickAddMenu.takePhoto.error') || 'Error', type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  const resetAndClose = () => {
    setCapturedImage(null);
    setSelectedSubjectId(initialSubjectId || null);
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
            {capturedImage ? t('common.preview') || 'Vista Previa' : t('dashboard.quickAddMenu.takePhotoLabel') || 'Tomar Foto'}
          </Text>
          <View style={{ width: 44 }} />
        </View>

        {!capturedImage ? (
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
            <Image source={{ uri: capturedImage }} style={styles.previewImage} resizeMode="contain" />
            
            <View style={[styles.actionSheet, { paddingBottom: Platform.OS === 'ios' ? 44 : 52 }]}>
              <Text style={styles.sheetTitle}>{t('dashboard.documentScannerModal.save') || 'Guardar'}</Text>
              
              <View style={styles.subjectGrid}>
                {subjects.map(s => (
                  <TouchableOpacity 
                    key={s.id} 
                    style={[
                      styles.subjectItem, 
                      selectedSubjectId === s.id && { 
                        backgroundColor: s.color ? s.color + '40' : undefined, 
                        borderColor: s.color || undefined,
                        borderWidth: 2
                      }
                    ]}
                    onPress={() => setSelectedSubjectId(s.id)}
                  >
                    <View style={[dashboardStyles.subjectBadge, { backgroundColor: s.color || '#CCC', marginRight: 0, marginBottom: 4 }]}>
                      <MaterialCommunityIcons name={(s.icon as any) || 'book-outline'} size={18} color={theme.colors.text.primary} />
                    </View>
                    <Text style={styles.subjectName} numberOfLines={1}>{s.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.saveActions}>
                <TouchableOpacity onPress={() => setCapturedImage(null)} style={styles.secondaryBtn}>
                  <Text style={styles.secondaryBtnText}>{t('common.retake') || 'Reintentar'}</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={handleSave} 
                  disabled={!selectedSubjectId || isProcessing}
                  style={[styles.primaryBtn, (!selectedSubjectId || isProcessing) && styles.primaryBtnDisabled]}
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
