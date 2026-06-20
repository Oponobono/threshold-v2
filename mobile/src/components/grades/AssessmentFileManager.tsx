import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { theme } from '../../styles/theme';
import { globalStyles } from '../../styles/globalStyles';
import { alertRef } from '../ui/CustomAlert';
import {
  uploadAssessmentFile,
  getAssessmentFiles,
  deleteAssessmentFile,
  type AssessmentFile,
} from '../../services/api/assessmentFiles';

interface AssessmentFileManagerProps {
  assessmentId: string;
  onFilesUpdated?: (files: AssessmentFile[]) => void;
}

export const AssessmentFileManager = ({ assessmentId, onFilesUpdated }: AssessmentFileManagerProps) => {
  const { t } = useTranslation();
  const [files, setFiles] = useState<AssessmentFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    loadFiles();
  }, [assessmentId]);

  const loadFiles = async () => {
    try {
      setIsLoading(true);
      const loadedFiles = await getAssessmentFiles(assessmentId);
      setFiles(loadedFiles);
    } catch (error) {
      console.error('[AssessmentFileManager] Error loading files:', error);
      // Fail silently - files might not exist yet
    } finally {
      setIsLoading(false);
    }
  };

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf', 
          'image/*', 
          'application/msword', 
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'text/plain'
        ],
        multiple: false,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      if (!file.uri) {
        alertRef.show({
          title: t('common.error'),
          message: t('assessments.fileError'),
          type: 'error',
        });
        return;
      }

      await handleUpload(file);
    } catch (error) {
      console.error('[AssessmentFileManager] Error picking file:', error);
      alertRef.show({
        title: t('common.error'),
        message: t('assessments.filePickError'),
        type: 'error',
      });
    }
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        alertRef.show({
          title: t('common.error'),
          message: t('common.cameraPermissionRequired') || 'Se requiere permiso de cámara',
          type: 'error',
        });
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (!asset.uri) return;
        
        const fileName = asset.uri.split('/').pop() || `photo_${Date.now()}.jpg`;
        await handleUpload({
          uri: asset.uri,
          name: fileName,
          size: asset.fileSize,
          mimeType: asset.mimeType || 'image/jpeg',
        });
      }
    } catch (error) {
      console.error('[AssessmentFileManager] Error taking photo:', error);
      alertRef.show({
        title: t('common.error'),
        message: t('assessments.filePickError'),
        type: 'error',
      });
    }
  };

  const handleUpload = async (file: { uri: string; name: string; size?: number; mimeType?: string }) => {
    try {
      setIsUploading(true);

      const uploadedFile = await uploadAssessmentFile(assessmentId, {
        file_name: file.name,
        file_type: file.mimeType || 'application/octet-stream',
        local_uri: file.uri,
        file_size: file.size,
      });

      setFiles([...files, uploadedFile]);
      onFilesUpdated?.([...files, uploadedFile]);

      alertRef.show({
        title: t('common.success'),
        message: t('assessments.fileUploadSuccess'),
        type: 'success',
      });
    } catch (error: any) {
      console.error('[AssessmentFileManager] Upload error:', error);
      alertRef.show({
        title: t('common.error'),
        message: error?.message || t('assessments.fileUploadError'),
        type: 'error',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteFile = (fileId: string) => {
    Alert.alert(
      t('assessments.deleteFileConfirm'),
      t('assessments.deleteFileConfirmMessage'),
      [
        { text: t('common.cancel'), onPress: () => {}, style: 'cancel' },
        {
          text: t('common.delete'),
          onPress: async () => {
            try {
              await deleteAssessmentFile(assessmentId, fileId);
              const updatedFiles = files.filter(f => f.id !== fileId);
              setFiles(updatedFiles);
              onFilesUpdated?.(updatedFiles);
              alertRef.show({
                title: t('common.success'),
                message: t('assessments.fileDeleted'),
                type: 'success',
              });
            } catch (error: any) {
              console.error('[AssessmentFileManager] Delete error:', error);
              alertRef.show({
                title: t('common.error'),
                message: error?.message || t('assessments.fileDeleteError'),
                type: 'error',
              });
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif'].includes(ext || '')) return 'image';
    if (ext === 'pdf') return 'document';
    return 'document-attach';
  };

  const getFileSizeLabel = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <View style={{ marginVertical: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: 8 }}>
          {t('assessments.attachedFiles')} ({files.length})
        </Text>
      </View>

      {isLoading && (
        <View style={{ padding: 16, alignItems: 'center' }}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      )}

      {!isLoading && files.length > 0 && (
        <FlatList
          scrollEnabled={false}
          data={files}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 10,
                paddingHorizontal: 12,
                backgroundColor: theme.colors.card,
                borderRadius: 8,
                marginBottom: 8,
              }}
            >
              <Ionicons
                name={getFileIcon(item.file_name)}
                size={20}
                color={theme.colors.primary}
                style={{ marginRight: 10 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '500' }} numberOfLines={1}>
                  {item.file_name}
                </Text>
                {item.file_size && (
                  <Text style={{ fontSize: 12, color: theme.colors.text.secondary, marginTop: 2 }}>
                    {getFileSizeLabel(item.file_size)}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                onPress={() => handleDeleteFile(item.id)}
                style={{ padding: 8, marginLeft: 8 }}
              >
                <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <TouchableOpacity
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 12,
            paddingHorizontal: 10,
            borderRadius: 8,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: theme.colors.primary,
            backgroundColor: theme.colors.card,
            opacity: isUploading ? 0.6 : 1,
          }}
          onPress={handlePickFile}
          disabled={isUploading}
        >
          {isUploading ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={18} color={theme.colors.primary} style={{ marginRight: 6 }} />
              <Text style={{ fontSize: 13, color: theme.colors.primary, fontWeight: '500' }}>
                {t('assessments.attachFile')}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 12,
            paddingHorizontal: 10,
            borderRadius: 8,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: theme.colors.primary,
            backgroundColor: theme.colors.card,
            opacity: isUploading ? 0.6 : 1,
          }}
          onPress={handleTakePhoto}
          disabled={isUploading}
        >
          {isUploading ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <>
              <Ionicons name="camera-outline" size={18} color={theme.colors.primary} style={{ marginRight: 6 }} />
              <Text style={{ fontSize: 13, color: theme.colors.primary, fontWeight: '500' }}>
                {t('dashboard.quickAddMenu.takePhotoLabel') || 'Tomar foto'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};
