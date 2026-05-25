import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { settingsStyles as styles } from '../../styles/Settings.styles';

interface Props {
  visible: boolean;
  isCreating: boolean;
  onClose: () => void;
  onCreate: (name: string, pin: string, isPublic: boolean, password: string) => void;
}

function generatePin(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let pin = '';
  for (let i = 0; i < 6; i++) {
    pin += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pin;
}

export const CreateGroupModal: React.FC<Props> = ({ visible, isCreating, onClose, onCreate }) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [pin, setPin] = useState(generatePin());
  const [isPublic, setIsPublic] = useState(true);
  const [password, setPassword] = useState('');

  const handleCreate = () => {
    onCreate(name.trim(), pin.toUpperCase(), isPublic, password);
  };

  const handleRegenerate = () => {
    setPin(generatePin());
  };

  const canCreate = name.trim().length > 0;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('settings.createGroup', 'Crear grupo')}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.colors.text.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            <Text style={styles.modalLabel}>{t('settings.groupName', 'Nombre del grupo')}</Text>
            <TextInput
              style={styles.modalInput}
              value={name}
              onChangeText={setName}
              placeholder={t('settings.groupNamePlaceholder', 'Ej: Matemáticas 101')}
              placeholderTextColor={theme.colors.text.placeholder}
              autoCapitalize="sentences"
            />

            <Text style={[styles.modalLabel, { marginTop: 16 }]}>{t('settings.groupPin', 'PIN del grupo')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TextInput
                style={[styles.modalInput, { flex: 1, textAlign: 'center', letterSpacing: 4, fontWeight: '800', fontSize: 18 }]}
                value={pin}
                onChangeText={setPin}
                autoCapitalize="characters"
                maxLength={6}
              />
              <TouchableOpacity onPress={handleRegenerate} style={{ padding: 8 }}>
                <Ionicons name="refresh-outline" size={22} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>

            <View style={[styles.settingRow, { marginTop: 16, paddingVertical: 0 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingTitle}>{t('settings.publicGroup', 'Grupo público')}</Text>
                <Text style={styles.settingDesc}>{t('settings.publicGroupDesc', 'Cualquier persona puede unirse con el PIN')}</Text>
              </View>
              <Switch
                value={isPublic}
                onValueChange={setIsPublic}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor={theme.colors.white}
              />
            </View>

            {!isPublic && (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.modalLabel}>{t('settings.groupPassword', 'Contraseña del grupo')}</Text>
                <TextInput
                  style={styles.modalInput}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t('settings.groupPasswordPlaceholder', 'Ingresa una contraseña')}
                  placeholderTextColor={theme.colors.text.placeholder}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>
            )}
          </View>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.modalBtnSecondary} onPress={onClose}>
              <Text style={styles.modalBtnSecondaryText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtnPrimary, (isCreating || !canCreate) && { opacity: 0.6 }]}
              onPress={handleCreate}
              disabled={isCreating || !canCreate}
            >
              <Text style={styles.modalBtnPrimaryText}>
                {isCreating ? t('settings.creating', 'Creando...') : t('settings.createBtn', 'Crear grupo')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
