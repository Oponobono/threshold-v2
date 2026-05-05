import React from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../styles/theme';
import { settingsStyles as styles } from '../styles/Settings.styles';
import { UserProfile } from '../services/api';

interface EditProfileModalProps {
  visible: boolean;
  profile: UserProfile | null;
  editName: string;
  editLastname: string;
  editUsername: string;
  editUniversity: string;
  editPin: string;
  onNameChange: (val: string) => void;
  onLastnameChange: (val: string) => void;
  onUsernameChange: (val: string) => void;
  onUniversityChange: (val: string) => void;
  onPinChange: (val: string) => void;
  onClose: () => void;
  onSave: () => void;
}

/**
 * Modal para editar la información del perfil del usuario (nombre, apellido, nombre de usuario, universidad).
 * También permite crear un PIN único (de lectura obligatoria) si el usuario no tiene uno asignado.
 */
export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  visible,
  profile,
  editName,
  editLastname,
  editUsername,
  editUniversity,
  editPin,
  onNameChange,
  onLastnameChange,
  onUsernameChange,
  onUniversityChange,
  onPinChange,
  onClose,
  onSave
}) => {
  const { t } = useTranslation();

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('settings.editProfile', 'Editar Perfil')}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.colors.text.secondary} />
            </TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            <Text style={styles.modalLabel}>{t('register.firstName', 'Nombre')}</Text>
            <TextInput style={styles.modalInput} value={editName} onChangeText={onNameChange} />
            
            <Text style={styles.modalLabel}>{t('register.lastName', 'Apellido')}</Text>
            <TextInput style={styles.modalInput} value={editLastname} onChangeText={onLastnameChange} />
            
            <Text style={styles.modalLabel}>{t('register.username', 'Nombre de Usuario')}</Text>
            <TextInput style={styles.modalInput} value={editUsername} onChangeText={onUsernameChange} />
            
            <Text style={styles.modalLabel}>{t('register.university', 'Universidad')}</Text>
            <TextInput style={styles.modalInput} value={editUniversity} onChangeText={onUniversityChange} />

            {/* PIN de usuario: solo asignable una vez */}
            <Text style={styles.modalLabel}>{t('settings.sharePin')}</Text>
            {profile?.share_pin ? (
              <View style={[styles.modalInput, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.colors.inputBackground }]}>
                <Text style={{ fontSize: 20, fontWeight: '800', letterSpacing: 4, color: theme.colors.primary }}>
                  {profile.share_pin}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="lock-closed" size={14} color={theme.colors.text.secondary} />
                  <Text style={{ fontSize: 11, color: theme.colors.text.secondary }}>{t('settings.fixed')}</Text>
                </View>
              </View>
            ) : (
              <>
                <TextInput
                  style={styles.modalInput}
                  value={editPin}
                  onChangeText={onPinChange}
                  placeholder={t('settings.pinPlaceholderCreate')}
                  autoCapitalize="characters"
                  maxLength={8}
                />
                <Text style={{ fontSize: 11, color: theme.colors.text.secondary, marginTop: -8, marginBottom: 4 }}>
                  {t('settings.pinFixedWarning', '⚠️ Una vez guardado, el PIN no puede modificarse.')}
                </Text>
              </>
            )}
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
