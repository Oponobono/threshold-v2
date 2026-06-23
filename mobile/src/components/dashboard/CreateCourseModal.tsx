import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, Pressable, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { dashboardStyles as styles } from '../../styles/Dashboard.styles';
import { theme } from '../../styles/theme';
import { alertRef } from '../ui/CustomAlert';
import { createCourse } from '../../services/api';
import { useDataStore } from '../../store/useDataStore';

interface CreateCourseModalProps {
  visible: boolean;
  onClose: () => void;
}

const PLATFORM_OPTIONS = [
  { name: 'Platzi', icon: 'rocket-outline' },
  { name: 'Udemy', icon: 'play-circle-outline' },
  { name: 'Coursera', icon: 'school-outline' },
  { name: 'YouTube', icon: 'youtube' },
  { name: 'Otro', icon: 'book-outline' },
] as const;

export const CreateCourseModal = ({ visible, onClose }: CreateCourseModalProps) => {
  const { t } = useTranslation();
  const { loadAllData } = useDataStore();
  
  const [isSaving, setIsSaving] = useState(false);
  const [courseName, setCourseName] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState('Platzi');

  const resetForm = () => {
    setCourseName('');
    setSelectedPlatform('Platzi');
    setIsSaving(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSave = async () => {
    if (!courseName.trim()) {
      alertRef.show({ title: t('common.error') || 'Error', message: 'El nombre del curso es requerido', type: 'warning' });
      return;
    }

    try {
      setIsSaving(true);
      await createCourse({
        name: courseName.trim(),
        platform: selectedPlatform,
      });

      await loadAllData(true);
      handleClose();
    } catch (error: any) {
      alertRef.show({ title: t('common.error') || 'Error', message: error?.message || 'Fallo al crear curso', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <Pressable style={styles.sheetBackdrop} onPress={handleClose}>
        <Pressable style={styles.sheetContent} onPress={() => null}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{'Nuevo Curso'}</Text>
          <Text style={styles.sheetSubtitle}>{'Agrupa módulos o materias bajo un mismo curso'}</Text>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flexShrink: 1 }} contentContainerStyle={{ paddingBottom: 10 }}>
            <Text style={styles.sheetLabel}>{'Nombre del curso'}</Text>
            <TextInput
              value={courseName}
              onChangeText={setCourseName}
              style={styles.sheetInput}
              placeholder={'Ej. React Native Pro'}
              placeholderTextColor={theme.colors.text.placeholder}
            />

            <Text style={styles.sheetLabel}>{'Plataforma'}</Text>
            <View style={[styles.optionsRow, { flexWrap: 'wrap', gap: 10 }]}>
              {PLATFORM_OPTIONS.map((plat) => (
                <TouchableOpacity
                  key={plat.name}
                  style={[
                    {
                      paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
                      backgroundColor: theme.colors.card,
                      borderWidth: 1, borderColor: theme.colors.border,
                      flexDirection: 'row', alignItems: 'center', gap: 6,
                    },
                    selectedPlatform === plat.name && {
                      backgroundColor: theme.colors.primary + '20',
                      borderColor: theme.colors.primary,
                    }
                  ]}
                  onPress={() => setSelectedPlatform(plat.name)}
                >
                  <MaterialCommunityIcons 
                    name={plat.icon} 
                    size={16} 
                    color={selectedPlatform === plat.name ? theme.colors.primary : theme.colors.text.secondary} 
                  />
                  <Text style={{
                    color: selectedPlatform === plat.name ? theme.colors.primary : theme.colors.text.secondary,
                    fontWeight: selectedPlatform === plat.name ? '600' : '400',
                  }}>
                    {plat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={styles.sheetActions}>
            <TouchableOpacity style={[styles.sheetCancelBtn, { flex: 1 }]} onPress={handleClose}>
              <Text style={styles.sheetCancelText}>{t('common.cancel') || 'Cancelar'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sheetSaveBtn, { flex: 1 }, isSaving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={isSaving}
            >
              <Text style={styles.sheetSaveText}>
                {isSaving ? 'Guardando...' : 'Crear Curso'}
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};
