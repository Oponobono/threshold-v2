import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, Pressable, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { dashboardStyles as styles } from '../../styles/Dashboard.styles';
import { theme } from '../../styles/theme';
import { alertRef } from '../ui/CustomAlert';
import { createCourse, updateCourse, type Course } from '../../services/api';
import { useDataStore } from '../../store/useDataStore';

interface CreateCourseModalProps {
  visible: boolean;
  onClose: () => void;
  editingCourse?: Course | null;
}

const PLATFORM_OPTIONS = [
  { name: 'Platzi', icon: 'rocket-outline' },
  { name: 'Udemy', icon: 'play-circle-outline' },
  { name: 'Coursera', icon: 'school-outline' },
  { name: 'YouTube', icon: 'youtube' },
  { name: 'Otro', icon: 'book-outline' },
] as const;

export const CreateCourseModal = ({ visible, onClose, editingCourse }: CreateCourseModalProps) => {
  const { t } = useTranslation();
  const { loadAllData } = useDataStore();
  
  const [isSaving, setIsSaving] = useState(false);
  const [courseName, setCourseName] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState('Platzi');
  const [customPlatform, setCustomPlatform] = useState('');
  const [mainUrl, setMainUrl] = useState('');
  const [instructor, setInstructor] = useState('');
  const [tags, setTags] = useState('');
  const [totalClasses, setTotalClasses] = useState('');

  const isKnownPlatform = (p: string) => PLATFORM_OPTIONS.some(opt => opt.name === p);

  React.useEffect(() => {
    if (visible && editingCourse) {
      const platform = editingCourse.platform || 'Platzi';
      if (isKnownPlatform(platform)) {
        setSelectedPlatform(platform);
        setCustomPlatform('');
      } else {
        setSelectedPlatform('Otro');
        setCustomPlatform(platform);
      }
      setCourseName(editingCourse.name || '');
      setMainUrl(editingCourse.main_url || '');
      setInstructor(editingCourse.instructor || '');
      setTags(editingCourse.tags || '');
      setTotalClasses(editingCourse.total_classes ? String(editingCourse.total_classes) : '');
    } else if (visible && !editingCourse) {
      setCourseName('');
      setSelectedPlatform('Platzi');
      setCustomPlatform('');
      setMainUrl('');
      setInstructor('');
      setTags('');
      setTotalClasses('');
    }
  }, [visible, editingCourse]);

  const resetForm = () => {
    setCourseName('');
    setSelectedPlatform('Platzi');
    setCustomPlatform('');
    setMainUrl('');
    setInstructor('');
    setTags('');
    setTotalClasses('');
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
      const totalClassesNum = totalClasses ? parseInt(totalClasses, 10) : undefined;
      const resolvedPlatform = selectedPlatform === 'Otro' && customPlatform.trim()
        ? customPlatform.trim() : selectedPlatform;
      if (editingCourse) {
        await updateCourse(editingCourse.id, {
          name: courseName.trim(),
          platform: resolvedPlatform,
          main_url: mainUrl.trim() || null,
          instructor: instructor.trim() || null,
          tags: tags.trim() || null,
          total_classes: totalClasses.trim() ? parseInt(totalClasses, 10) : null,
        } as any);
      } else {
        await createCourse({
          name: courseName.trim(),
          platform: resolvedPlatform,
          main_url: mainUrl.trim() || null,
          instructor: instructor.trim() || null,
          tags: tags.trim() || null,
          total_classes: totalClasses.trim() ? parseInt(totalClasses, 10) : null,
        } as any);
      }

      await loadAllData(true);
      handleClose();
    } catch (error: any) {
      alertRef.show({ title: t('common.error') || 'Error', message: error?.message || 'Fallo al guardar curso', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <Pressable style={styles.sheetBackdrop} onPress={handleClose}>
        <Pressable style={styles.sheetContent} onPress={() => null}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{editingCourse ? 'Editar Curso' : 'Nuevo Curso'}</Text>
          <Text style={styles.sheetSubtitle}>{editingCourse ? 'Actualiza los detalles de tu curso' : 'Agrupa módulos o materias bajo un mismo curso'}</Text>

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

            {selectedPlatform === 'Otro' && (
              <TextInput
                value={customPlatform}
                onChangeText={setCustomPlatform}
                style={[styles.sheetInput, { marginTop: 10 }]}
                placeholder={'Ej. Universidad Nacional, SENA, etc.'}
                placeholderTextColor={theme.colors.text.placeholder}
              />
            )}

            <Text style={[styles.sheetLabel, { marginTop: 12 }]}>{'Total de clases (opcional)'}</Text>
            <TextInput
              value={totalClasses}
              onChangeText={setTotalClasses}
              style={styles.sheetInput}
              placeholder={'Ej. 50'}
              placeholderTextColor={theme.colors.text.placeholder}
              keyboardType="number-pad"
            />

            <Text style={[styles.sheetLabel, { marginTop: 16 }]}>{'URL del curso (opcional)'}</Text>
            <TextInput
              value={mainUrl}
              onChangeText={setMainUrl}
              style={styles.sheetInput}
              placeholder={'https://platzi.com/cursos/react-native/'}
              placeholderTextColor={theme.colors.text.placeholder}
              autoCapitalize="none"
              keyboardType="url"
            />

            <Text style={[styles.sheetLabel, { marginTop: 12 }]}>{'Instructor (opcional)'}</Text>
            <TextInput
              value={instructor}
              onChangeText={setInstructor}
              style={styles.sheetInput}
              placeholder={'Ej. Juan Pérez'}
              placeholderTextColor={theme.colors.text.placeholder}
            />

            <Text style={[styles.sheetLabel, { marginTop: 12 }]}>{'Etiquetas (opcional)'}</Text>
            <TextInput
              value={tags}
              onChangeText={setTags}
              style={styles.sheetInput}
              placeholder={'Frontend, React, Mobile'}
              placeholderTextColor={theme.colors.text.placeholder}
            />
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
                {isSaving ? 'Guardando...' : (editingCourse ? 'Guardar Cambios' : 'Crear Curso')}
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};
