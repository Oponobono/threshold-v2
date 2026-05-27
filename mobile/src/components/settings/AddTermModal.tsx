import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { settingsStyles as styles } from '../../styles/Settings.styles';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (term: string) => void;
}

export const AddTermModal: React.FC<Props> = ({ visible, onClose, onSave }) => {
  const { t } = useTranslation();
  const [termName, setTermName] = useState('');

  const handleSave = () => {
    if (!termName.trim()) return;
    onSave(termName.trim());
    setTermName('');
    onClose();
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('academic.addTerm')}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.colors.text.primary} />
            </TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            <Text style={styles.modalLabel}>{t('academic.termName', 'Nombre del período')}</Text>
            <TextInput
              style={styles.modalInput}
              value={termName}
              onChangeText={setTermName}
              placeholder={t('academic.termPlaceholder')}
              placeholderTextColor={theme.colors.text.secondary}
              autoFocus
            />
          </View>
          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.modalBtnSecondary} onPress={onClose}>
              <Text style={styles.modalBtnSecondaryText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalBtnPrimary} onPress={handleSave}>
              <Text style={styles.modalBtnPrimaryText}>{t('common.save')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
