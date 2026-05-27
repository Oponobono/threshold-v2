import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { settingsStyles as styles } from '../../styles/Settings.styles';
import { alertRef } from '../ui/CustomAlert';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (platform: string, url: string, username: string) => Promise<void>;
}

const PLATFORMS = ['Canvas', 'Moodle', 'Blackboard', 'Google Classroom', 'Schoology'];

export const AddLmsModal: React.FC<Props> = ({ visible, onClose, onSave }) => {
  const { t } = useTranslation();
  const [platform, setPlatform] = useState('');
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!platform || !url.trim() || !username.trim()) {
      alertRef.show({ title: t('common.error'), message: 'Completa todos los campos', type: 'warning' });
      return;
    }
    setSaving(true);
    try {
      await onSave(platform, url.trim(), username.trim());
      setPlatform('');
      setUrl('');
      setUsername('');
      onClose();
    } catch (error: any) {
      alertRef.show({ title: t('common.error'), message: error.message, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('integrations.addLms')}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.colors.text.primary} />
            </TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            <Text style={styles.modalLabel}>{t('integrations.platform', 'Plataforma')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {PLATFORMS.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.termChip, platform === p && styles.termChipActive]}
                  onPress={() => setPlatform(p)}
                >
                  <Text style={[styles.termChipText, platform === p && styles.termChipTextActive]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.modalLabel}>{t('integrations.instanceUrl', 'URL de la instancia')}</Text>
            <TextInput
              style={styles.modalInput}
              value={url}
              onChangeText={setUrl}
              placeholder="https://instancia.instructure.com"
              placeholderTextColor={theme.colors.text.secondary}
              autoCapitalize="none"
              keyboardType="url"
            />
            <Text style={styles.modalLabel}>{t('integrations.lmsUsername', 'Nombre de usuario')}</Text>
            <TextInput
              style={styles.modalInput}
              value={username}
              onChangeText={setUsername}
              placeholder="usuario"
              placeholderTextColor={theme.colors.text.secondary}
              autoCapitalize="none"
            />
          </View>
          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.modalBtnSecondary} onPress={onClose}>
              <Text style={styles.modalBtnSecondaryText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalBtnPrimary, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
              <Text style={styles.modalBtnPrimaryText}>{saving ? t('common.saving', 'Guardando...') : t('integrations.addLms')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
