import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { settingsStyles as styles } from '../../styles/Settings.styles';
import { alertRef } from '../ui/CustomAlert';

interface SubjectOverride {
  subjectId: number;
  subjectName: string;
  threshold: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  subjects: { id: number; name: string; color?: string }[];
  defaultThreshold: string;
  onSave: (overrides: SubjectOverride[]) => void;
}

export const ManageOverridesModal: React.FC<Props> = ({ visible, onClose, subjects, defaultThreshold, onSave }) => {
  const { t } = useTranslation();
  const [overrides, setOverrides] = useState<SubjectOverride[]>(
    subjects.map(s => ({ subjectId: s.id, subjectName: s.name, threshold: defaultThreshold }))
  );

  const handleThresholdChange = (subjectId: number, value: string) => {
    setOverrides(prev => prev.map(o => o.subjectId === subjectId ? { ...o, threshold: value } : o));
  };

  const handleSave = () => {
    const valid = overrides.every(o => {
      const num = Number(o.threshold);
      return !isNaN(num) && num >= 0 && num <= 100;
    });
    if (!valid) {
      alertRef.show({ title: t('common.error'), message: 'Los umbrales deben ser números entre 0 y 100', type: 'warning' });
      return;
    }
    onSave(overrides);
    onClose();
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { maxHeight: '80%' }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('academic.manageOverrides')}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.colors.text.primary} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody}>
            <Text style={styles.modalDesc}>{t('academic.overrideDesc', 'Define un umbral de aprobación distinto para cada materia.')}</Text>
            {overrides.map((o) => (
              <View key={o.subjectId} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingTitle}>{o.subjectName}</Text>
                </View>
                <TextInput
                  style={[styles.thresholdInput, { marginTop: 0 }]}
                  value={o.threshold}
                  onChangeText={(v) => handleThresholdChange(o.subjectId, v)}
                  keyboardType="numeric"
                  maxLength={3}
                />
              </View>
            ))}
          </ScrollView>
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
