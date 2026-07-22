import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, ActivityIndicator, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { theme } from '../../styles/theme';
import { settingsStyles as styles } from '../../styles/Settings.styles';
import { gradesStyles } from '../../styles/Grades.styles';
import { globalStyles } from '../../styles/globalStyles';

import { CsvTemplateGenerator } from '../../services/import/CsvTemplateGenerator';
import { CsvImporter } from '../../services/import/CsvImporter';
import { PreviewBuilder } from '../../services/import/PreviewBuilder';
import { AcademicImportExecutor } from '../../services/import/AcademicImportExecutor';
import { AcademicImportModel, AcademicImportPreview, AcademicImportResult } from '../../services/import/types';
import { BusinessValidator } from '../../services/import/validators/BusinessValidator';
import { DuplicateValidator } from '../../services/import/validators/DuplicateValidator';
import { useDataStore } from '../../store/useDataStore';

interface Props {
  visible: boolean;
  onClose: () => void;
  userId: string | null;
}

export const AcademicImportModal: React.FC<Props> = ({ visible, onClose, userId }) => {
  const { t } = useTranslation();
  const { loadAllData } = useDataStore(); // To refresh after import

  const [step, setStep] = useState<'idle' | 'preview' | 'loading' | 'success'>('idle');
  const [model, setModel] = useState<AcademicImportModel | null>(null);
  const [preview, setPreview] = useState<AcademicImportPreview | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [result, setResult] = useState<AcademicImportResult | null>(null);

  const handleGenerateTemplate = async () => {
    try {
      const language = t('common.language', 'es') as 'es' | 'en';
      const template = CsvTemplateGenerator.generateTemplate(language, ',');
      const fileUri = FileSystem.cacheDirectory + 'Threshold_Academic_Import_Template.csv';
      await FileSystem.writeAsStringAsync(fileUri, template, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: t('academicImport.shareTemplate', 'Descargar Plantilla CSV'),
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        Alert.alert('Error', 'Compartir no está disponible en este dispositivo.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const handlePickFile = async () => {
    try {
      setErrorText(null);
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/csv'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const file = result.assets[0];
      setStep('loading');

      const content = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.UTF8 });
      
      const parsedModel = CsvImporter.parse(content, ',');
      const businessValidation = BusinessValidator.validate(parsedModel);
      const dbErrors = await DuplicateValidator.validate(parsedModel);
      
      const allErrors = [...businessValidation.errors, ...dbErrors];
      const buildPreview = PreviewBuilder.build(parsedModel, businessValidation.warnings, allErrors);

      setModel(parsedModel);
      setPreview(buildPreview);
      setStep('preview');
    } catch (err: any) {
      setStep('idle');
      setErrorText(err.message || 'Error al procesar el archivo CSV.');
    }
  };

  const handleConfirm = async () => {
    if (!userId) {
      Alert.alert('Error', 'Usuario no autenticado.');
      return;
    }
    if (!model || !preview) return;
    if (preview.errors.length > 0) {
       Alert.alert('Error', 'Hay errores que deben corregirse antes de importar.');
       return;
    }

    try {
      setStep('loading');
      const importResult = await AcademicImportExecutor.execute(userId, model);
      setResult(importResult);
      await loadAllData(); // Refresh UI lists
      setStep('success');
    } catch (err: any) {
      setStep('preview'); // Vuelve al preview
      setErrorText(err.message || 'Error al importar datos en base de datos.');
    }
  };

  const resetAndClose = () => {
    setStep('idle');
    setModel(null);
    setPreview(null);
    setErrorText(null);
    onClose();
  };

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={resetAndClose}>
      <View style={styles.bottomSheetModalOverlay}>
        <View style={[styles.bottomSheetModalContent, { maxHeight: '90%', paddingBottom: 0, paddingHorizontal: 20 }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('academicImport.title', 'Importación Académica')}</Text>
            <TouchableOpacity onPress={resetAndClose}>
              <Ionicons name="close" size={24} color={theme.colors.text.primary} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={[styles.modalBody, { paddingBottom: 40 }]}>
            {step === 'loading' && (
              <View style={{ alignItems: 'center', marginVertical: 40 }}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={{ marginTop: 16, color: theme.colors.text.secondary }}>
                  {t('common.loading', 'Procesando...')}
                </Text>
              </View>
            )}

            {step === 'idle' && (
              <View style={{ gap: 24, marginTop: 16 }}>
                <View style={{
                  backgroundColor: theme.colors.background,
                  padding: 16,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                    <Ionicons name="document-text" size={24} color={theme.colors.primary} />
                    <Text style={{ fontSize: 16, fontWeight: '600', color: theme.colors.text.primary }}>
                      {t('academicImport.step1', 'Paso 1: Obtén la plantilla')}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 14, color: theme.colors.text.secondary, marginBottom: 16, lineHeight: 20 }}>
                    {t('academicImport.templateDesc', 'Descarga la plantilla CSV y llénala con tu información histórica. No modifiques las columnas.')}
                  </Text>
                  <TouchableOpacity
                    onPress={handleGenerateTemplate}
                    style={[{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: theme.borderRadius.full,
                      borderWidth: 1,
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.inputBackground,
                      alignSelf: 'flex-start'
                    }]}
                  >
                    <Ionicons name="download-outline" size={20} color={theme.colors.text.primary} style={{ marginRight: 8 }} />
                    <Text style={{ color: theme.colors.text.primary, fontWeight: '600' }}>
                      {t('academicImport.downloadTemplate', 'Descargar Plantilla CSV')}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={{
                  backgroundColor: theme.colors.background,
                  padding: 16,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                    <Ionicons name="cloud-upload" size={24} color={theme.colors.primary} />
                    <Text style={{ fontSize: 16, fontWeight: '600', color: theme.colors.text.primary }}>
                      {t('academicImport.step2', 'Paso 2: Sube el archivo')}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 14, color: theme.colors.text.secondary, marginBottom: 16, lineHeight: 20 }}>
                    {t('academicImport.uploadDesc', 'Selecciona el archivo CSV rellenado. Validaremos los datos antes de importar.')}
                  </Text>
                  <TouchableOpacity
                    onPress={handlePickFile}
                    style={[{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: theme.borderRadius.full,
                      backgroundColor: theme.colors.primary,
                      alignSelf: 'flex-start'
                    }]}
                  >
                    <Ionicons name="folder-open-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={{ color: '#fff', fontWeight: '600' }}>
                      {t('academicImport.selectFile', 'Seleccionar CSV')}
                    </Text>
                  </TouchableOpacity>
                </View>
                
                {errorText && (
                  <View style={{ backgroundColor: 'rgba(239,68,68,0.1)', padding: 12, borderRadius: 8 }}>
                    <Text style={{ color: '#ef4444', fontSize: 13, lineHeight: 18 }}>{errorText}</Text>
                  </View>
                )}
              </View>
            )}

            {step === 'preview' && preview && (
              <View style={{ gap: 16, marginTop: 8 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: theme.colors.text.primary, marginBottom: 8 }}>
                  {t('academicImport.previewTitle', 'Resumen de Importación')}
                </Text>

                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                  <View style={{ flex: 1, backgroundColor: theme.colors.card, padding: 12, borderRadius: 8, alignItems: 'center' }}>
                    <Text style={{ fontSize: 24, fontWeight: '700', color: theme.colors.primary }}>{preview.statistics.totalCourses}</Text>
                    <Text style={{ fontSize: 12, color: theme.colors.text.secondary }}>{t('common.courses', 'Cursos')}</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: theme.colors.card, padding: 12, borderRadius: 8, alignItems: 'center' }}>
                    <Text style={{ fontSize: 24, fontWeight: '700', color: theme.colors.primary }}>{preview.statistics.totalSubjects}</Text>
                    <Text style={{ fontSize: 12, color: theme.colors.text.secondary }}>{t('common.subjects', 'Materias')}</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: theme.colors.card, padding: 12, borderRadius: 8, alignItems: 'center' }}>
                    <Text style={{ fontSize: 24, fontWeight: '700', color: theme.colors.primary }}>{preview.statistics.totalAssessments}</Text>
                    <Text style={{ fontSize: 12, color: theme.colors.text.secondary }}>{t('common.assessments', 'Notas')}</Text>
                  </View>
                </View>

                {preview.warnings.length > 0 && (
                  <View style={{ backgroundColor: 'rgba(234,179,8,0.1)', padding: 12, borderRadius: 8, marginBottom: 16 }}>
                    <Text style={{ color: '#eab308', fontWeight: '600', marginBottom: 4 }}>
                      {t('academicImport.warnings', 'Advertencias:')}
                    </Text>
                    {preview.warnings.slice(0, 5).map((warn, i) => (
                      <Text key={i} style={{ color: '#ca8a04', fontSize: 13, marginBottom: 4 }}>• [Fila {warn.row}] {warn.message}</Text>
                    ))}
                    {preview.warnings.length > 5 && (
                      <Text style={{ color: '#ca8a04', fontSize: 13, marginTop: 4 }}>...y {preview.warnings.length - 5} más</Text>
                    )}
                  </View>
                )}

                {preview.errors.length > 0 && (
                  <View style={{ backgroundColor: 'rgba(239,68,68,0.1)', padding: 12, borderRadius: 8, marginBottom: 16 }}>
                    <Text style={{ color: '#ef4444', fontWeight: '600', marginBottom: 4 }}>
                      {t('academicImport.errors', 'Errores (Bloqueantes):')}
                    </Text>
                    {preview.errors.slice(0, 5).map((err, i) => (
                      <Text key={i} style={{ color: '#b91c1c', fontSize: 13, marginBottom: 4 }}>• [Fila {err.row}] {err.message}</Text>
                    ))}
                    {preview.errors.length > 5 && (
                      <Text style={{ color: '#b91c1c', fontSize: 13, marginTop: 4 }}>...y {preview.errors.length - 5} más</Text>
                    )}
                  </View>
                )}

                {errorText && (
                  <View style={{ backgroundColor: 'rgba(239,68,68,0.1)', padding: 12, borderRadius: 8, marginBottom: 16 }}>
                    <Text style={{ color: '#ef4444', fontSize: 13, lineHeight: 18 }}>{errorText}</Text>
                  </View>
                )}

                <TouchableOpacity
                  onPress={handleConfirm}
                  disabled={preview.errors.length > 0}
                  style={[globalStyles.buttonPrimary, preview.errors.length > 0 && { opacity: 0.5 }]}
                >
                  <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>
                    {t('academicImport.confirm', 'Confirmar Importación')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setStep('idle')}
                  style={[globalStyles.buttonSecondary, { marginTop: 8 }]}
                >
                  <Text style={{ color: theme.colors.text.primary, fontWeight: '600' }}>
                    {t('common.cancel', 'Cancelar')}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {step === 'success' && (
              <View style={{ alignItems: 'center', marginVertical: 40 }}>
                <Ionicons name="checkmark-circle" size={64} color="#10b981" style={{ marginBottom: 16 }} />
                <Text style={{ fontSize: 20, fontWeight: '700', color: theme.colors.text.primary, marginBottom: 8 }}>
                  {t('academicImport.success', '¡Importación Exitosa!')}
                </Text>
                <Text style={{ fontSize: 14, color: theme.colors.text.secondary, textAlign: 'center', marginBottom: 24 }}>
                  {t('academicImport.successDesc', 'Tus calificaciones han sido registradas en tu perfil.')}
                </Text>
                <TouchableOpacity
                  onPress={resetAndClose}
                  style={globalStyles.buttonPrimary}
                >
                  <Text style={{ color: '#fff', fontWeight: '600' }}>{t('common.done', 'Finalizar')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};
