import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { settingsStyles as styles } from '../../styles/Settings.styles';
import { alertRef } from '../ui/CustomAlert';

interface Props {
  visible: boolean;
  onClose: () => void;
  onEnable: () => Promise<void>;
  onDisable: () => Promise<void>;
  isEnabled: boolean;
}

export const TwoFactorModal: React.FC<Props> = ({ visible, onClose, onEnable, onDisable, isEnabled }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    setLoading(true);
    try {
      if (isEnabled) {
        await onDisable();
        alertRef.show({ title: t('common.success'), message: t('account.twoFactorDisabled'), type: 'success' });
      } else {
        await onEnable();
        alertRef.show({ title: t('common.success'), message: t('account.twoFactorEnabled'), type: 'success' });
      }
      onClose();
    } catch (error: any) {
      alertRef.show({ title: t('common.error'), message: error.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('account.twoFactor')}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.colors.text.primary} />
            </TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <Ionicons name="shield-checkmark" size={64} color={isEnabled ? '#34C759' : theme.colors.text.secondary} />
            </View>
            <Text style={styles.modalDesc}>
              {isEnabled
                ? t('account.twoFactorActive')
                : t('account.twoFactorInactive')}
            </Text>
          </View>
          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.modalBtnSecondary} onPress={onClose}>
              <Text style={styles.modalBtnSecondaryText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtnPrimary, isEnabled && { backgroundColor: '#FF2D55' }, loading && { opacity: 0.6 }]}
              onPress={handleToggle}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.modalBtnPrimaryText}>
                  {isEnabled ? t('account.disable', 'Desactivar') : t('account.enable', 'Activar')}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
