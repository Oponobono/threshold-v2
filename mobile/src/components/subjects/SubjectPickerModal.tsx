import React from 'react';
import { Modal, TouchableOpacity, View, Text, ScrollView } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { Subject } from '../../services/api';

export interface SubjectPickerModalProps {
  visible: boolean;
  subjects: Subject[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onClose: () => void;
}

/**
 * SubjectPickerModal.tsx
 *
 * Modal tipo "Bottom Sheet" (Hoja inferior) que presenta una lista scrolleable
 * de materias registradas para que el usuario pueda seleccionar o vincular
 * algún archivo (foto, documento, grabación) a una de ellas de manera rápida.
 * Soporta la deselección seleccionando la opción "Sin Materia".
 *
 * @param visible - Estado del modal (abierto/cerrado).
 * @param subjects - Arreglo de objetos `Subject` recuperados del backend.
 * @param selectedId - ID de la materia actualmente pre-seleccionada, si aplica.
 * @param onSelect - Callback de asignación que se dispara al tocar un item (retorna ID numérico o null).
 * @param onClose - Método para cerrar el modal de selección.
 */
export const SubjectPickerModal: React.FC<SubjectPickerModalProps> = ({
  visible, subjects, selectedId, onSelect, onClose,
}) => {
  const { t } = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={{
          backgroundColor: theme.colors.card,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingTop: 12,
          paddingBottom: 32,
          paddingHorizontal: 20,
          maxHeight: '60%',
        }}>
          <View style={{ width: 40, height: 4, backgroundColor: theme.colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 }} />
          <Text style={{ fontSize: 17, fontWeight: '700', color: theme.colors.text.primary, marginBottom: 16 }}>
            {t('subjects.selectSubject') || 'Asignar materia'}
          </Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            <TouchableOpacity
              style={{
                flexDirection: 'row', alignItems: 'center',
                paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, marginBottom: 6,
                backgroundColor: selectedId === null ? `${theme.colors.primary}15` : theme.colors.background,
                borderWidth: 1, borderColor: selectedId === null ? theme.colors.primary : theme.colors.border,
              }}
              onPress={() => { onSelect(null); onClose(); }}
            >
              <Ionicons name="albums-outline" size={20} color={theme.colors.text.secondary} style={{ marginRight: 12 }} />
              <Text style={{ color: theme.colors.text.secondary, fontSize: 15, fontStyle: 'italic' }}>
                {t('subjects.noSubjectSelected') || '— Sin Materia —'}
              </Text>
              {selectedId === null && (
                <Ionicons name="checkmark" size={18} color={theme.colors.primary} style={{ marginLeft: 'auto' }} />
              )}
            </TouchableOpacity>
            {subjects.map(sub => (
              <TouchableOpacity
                key={sub.id}
                style={{
                  flexDirection: 'row', alignItems: 'center',
                  paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, marginBottom: 6,
                  backgroundColor: String(selectedId) === String(sub.id) ? `${sub.color || theme.colors.primary}20` : theme.colors.background,
                  borderWidth: 1, borderColor: String(selectedId) === String(sub.id) ? (sub.color || theme.colors.primary) : theme.colors.border,
                }}
                onPress={() => { onSelect(sub.id ? Number(sub.id) : null); onClose(); }}
              >
                <View style={{
                  width: 28, height: 28, borderRadius: 8,
                  backgroundColor: sub.color || theme.colors.primary,
                  justifyContent: 'center', alignItems: 'center', marginRight: 12,
                }}>
                  <MaterialCommunityIcons name={(sub.icon as any) || 'book-outline'} size={16} color="#fff" />
                </View>
                <Text style={{ color: theme.colors.text.primary, fontSize: 15, fontWeight: '500', flex: 1 }}>
                  {sub.name}
                </Text>
                {String(selectedId) === String(sub.id) && (
                  <Ionicons name="checkmark" size={18} color={sub.color || theme.colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};
