import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, Image, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useCustomAlert } from './CustomAlert';
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
 * Modal que utiliza la aplicación de cámara nativa del sistema (vía ImagePicker)
 * para capturar fotografías con máxima compatibilidad y estabilidad en Android.
 * Evita los problemas de pantalla negra de CameraView al delegar la captura al OS.
 *
 * @param isVisible - Controla si el modal está montado y visible.
 * @param onClose - Callback para cerrar y limpiar el estado.
 * @param subjects - Lista de materias disponibles para asignar la foto.
 * @param onSave - Callback opcional disparado con la URI y el ID de materia tras guardar.
 * @param initialSubjectId - Materia pre-seleccionada al abrir.
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
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(initialSubjectId || null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Al abrir el modal, si no hay imagen, podemos intentar abrir la cámara automáticamente
  // o mostrar una pantalla de bienvenida con el botón.
  useEffect(() => {
    if (isVisible && !capturedImage) {
      // Opcional: abrir cámara automáticamente
      // takePicture();
    }
  }, [isVisible]);

  const takePicture = async () => {
    try {
      // Pedir permisos de cámara explícitamente
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        showAlert({ 
          title: t('common.error'), 
          message: t('dashboard.quickAddMenu.errors.cameraPermission') || 'Se requiere permiso de cámara', 
          type: 'error' 
        });
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setCapturedImage(result.assets[0].uri);
      }
    } catch (err) {
      console.error('[PhotoCaptureModal] Error launching camera:', err);
      showAlert({ 
        title: t('common.error'), 
        message: t('subjects.errorTakingPhoto') || 'No se pudo abrir la cámara nativa.', 
        type: 'error' 
      });
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
      showAlert({ 
        title: t('common.error'), 
        message: t('dashboard.documentScannerModal.selectSubjectError') || 'Selecciona una materia', 
        type: 'warning' 
      });
      return;
    }

    try {
      setIsProcessing(true);
      await createPhoto({
        subject_id: selectedSubjectId,
        local_uri: capturedImage,
      });
      if (onSave) onSave(capturedImage, selectedSubjectId);
      showAlert({ 
        title: t('common.success'), 
        message: t('dashboard.quickAddMenu.takePhoto.success') || 'Foto guardada correctamente', 
        type: 'success' 
      });
      resetAndClose();
    } catch (error) {
      showAlert({ 
        title: t('common.error'), 
        message: t('dashboard.quickAddMenu.takePhoto.error') || 'Error al guardar la foto', 
        type: 'error' 
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const resetAndClose = () => {
    setCapturedImage(null);
    setSelectedSubjectId(initialSubjectId || null);
    setIsProcessing(false);
    onClose();
  };

  const isSaveDisabled = !selectedSubjectId || isProcessing;

  return (
    <Modal visible={isVisible} animationType="slide" onRequestClose={resetAndClose} hardwareAccelerated={true}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={resetAndClose} style={styles.closeBtn}>
            <Ionicons name="close" size={28} color={theme.colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {capturedImage ? t('common.preview') || 'Vista Previa' : t('dashboard.quickAddMenu.takePhotoLabel') || 'Capturar'}
          </Text>
          <View style={{ width: 44 }} />
        </View>

        {!capturedImage ? (
          <View style={[styles.camera, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }]}>
            <View style={{ alignItems: 'center', paddingHorizontal: 30 }}>
              <View style={{ 
                width: 100, 
                height: 100, 
                borderRadius: 50, 
                backgroundColor: 'rgba(255,255,255,0.1)', 
                justifyContent: 'center', 
                alignItems: 'center',
                marginBottom: 24
              }}>
                <Ionicons name="camera" size={50} color={theme.colors.primary} />
              </View>
              
              <Text style={{ 
                color: 'white', 
                fontSize: 22, 
                fontWeight: '700', 
                textAlign: 'center',
                marginBottom: 12
              }}>
                {t('dashboard.quickAddMenu.takePhotoLabel') || 'Capturar Foto'}
              </Text>
              
              <Text style={{ 
                color: '#aaa', 
                fontSize: 15, 
                textAlign: 'center', 
                lineHeight: 22,
                marginBottom: 40
              }}>
                Usaremos la cámara nativa de tu dispositivo para asegurar la mejor calidad y estabilidad.
              </Text>

              <TouchableOpacity 
                style={[styles.primaryBtn, { width: '100%', flex: 0 }]} 
                onPress={takePicture}
                activeOpacity={0.8}
              >
                <Ionicons name="camera" size={20} color="white" style={{ marginRight: 8 }} />
                <Text style={styles.primaryBtnText}>Abrir Cámara</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.secondaryBtn, { width: '100%', flex: 0, marginTop: 16 }]} 
                onPress={pickImage}
                activeOpacity={0.8}
              >
                <Ionicons name="images" size={20} color={theme.colors.text.primary} style={{ marginRight: 8 }} />
                <Text style={styles.secondaryBtnText}>Elegir de la Galería</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.previewContainer}>
            <Image source={{ uri: capturedImage }} style={styles.previewImage} resizeMode="contain" />
            
            <View style={[styles.actionSheet, { paddingBottom: Platform.OS === 'ios' ? 44 : 52 }]}>
              <Text style={styles.sheetTitle}>{t('dashboard.documentScannerModal.save') || 'Guardar en materia'}</Text>
              
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
                  disabled={isSaveDisabled}
                  style={[styles.primaryBtn, isSaveDisabled && styles.primaryBtnDisabled]}
                >
                  {isProcessing ? <ActivityIndicator color="white" /> : <Text style={styles.primaryBtnText}>{t('common.save') || 'Confirmar'}</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
};
