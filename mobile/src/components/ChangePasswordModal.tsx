import React from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../styles/theme';
import { settingsStyles as styles } from '../styles/Settings.styles';

interface ChangePasswordModalProps {
  visible: boolean;
  currentValue: string;
  newValue: string;
  confirmValue: string;
  onCurrentChange: (val: string) => void;
  onNewChange: (val: string) => void;
  onConfirmChange: (val: string) => void;
  onClose: () => void;
  onSave: () => void;
}

/**
 * Modal para que el usuario pueda cambiar su contraseña.
 * Requiere la contraseña actual, una nueva contraseña y su confirmación.
 */
export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  visible,
  currentValue,
  newValue,
  confirmValue,
  onCurrentChange,
  onNewChange,
  onConfirmChange,
  onClose,
  onSave
}) => {
  const { t } = useTranslation();

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('settings.changePass', 'Cambiar Contraseña')}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.colors.text.secondary} />
            </TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            <Text style={styles.modalLabel}>{t('settings.currentPassword', 'Contraseña Actual')}</Text>
            <TextInput 
              style={styles.modalInput} 
              value={currentValue} 
              onChangeText={onCurrentChange} 
              secureTextEntry 
            />
            
            <Text style={styles.modalLabel}>{t('settings.newPassword', 'Nueva Contraseña')}</Text>
            <TextInput 
              style={styles.modalInput} 
              value={newValue} 
              onChangeText={onNewChange} 
              secureTextEntry 
            />
            
            <Text style={styles.modalLabel}>{t('settings.confirmPassword', 'Confirmar Contraseña')}</Text>
            <TextInput 
              style={styles.modalInput} 
              value={confirmValue} 
              onChangeText={onConfirmChange} 
              secureTextEntry 
            />
          </View>
          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.modalBtnSecondary} onPress={onClose}>
              <Text style={styles.modalBtnSecondaryText}>{t('settings.cancel', 'Cancelar')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalBtnPrimary} onPress={onSave}>
              <Text style={styles.modalBtnPrimaryText}>{t('settings.save', 'Guardar')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
