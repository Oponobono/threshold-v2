import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { settingsStyles as styles } from '../../styles/Settings.styles';
import { alertRef } from '../CustomAlert';

interface GradeBand {
  label: string;
  min: string;
  max: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (name: string, passingValue: number, minValue: number, maxValue: number) => void;
}

export const AddCustomScaleModal: React.FC<Props> = ({ visible, onClose, onSave }) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [minValue, setMinValue] = useState('0');
  const [maxValue, setMaxValue] = useState('100');
  const [passingValue, setPassingValue] = useState('50');

  const handleSave = () => {
    if (!name.trim()) {
      alertRef.show({ title: t('common.error'), message: 'Ingresa un nombre para la escala', type: 'warning' });
      return;
    }
    const min = Number(minValue);
    const max = Number(maxValue);
    const pass = Number(passingValue);
    if (isNaN(min) || isNaN(max) || isNaN(pass) || min >= max) {
      alertRef.show({ title: t('common.error'), message: 'Valores inválidos. El mínimo debe ser menor al máximo.', type: 'warning' });
      return;
    }
    if (pass < min || pass > max) {
      alertRef.show({ title: t('common.error'), message: 'El valor de aprobación debe estar entre el mínimo y el máximo.', type: 'warning' });
      return;
    }
    onSave(name.trim(), pass, min, max);
    setName('');
    onClose();
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('academic.addCustomScale')}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.colors.text.primary} />
            </TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            <Text style={styles.modalLabel}>{t('common.name')}</Text>
            <TextInput style={styles.modalInput} value={name} onChangeText={setName} placeholder="Ej: Escala personalizada" placeholderTextColor={theme.colors.text.secondary} />
            <Text style={styles.modalLabel}>{t('academic.minGrade')}</Text>
            <TextInput style={styles.modalInput} value={minValue} onChangeText={setMinValue} keyboardType="numeric" />
            <Text style={styles.modalLabel}>{t('academic.maxGrade', 'Valor máximo')}</Text>
            <TextInput style={styles.modalInput} value={maxValue} onChangeText={setMaxValue} keyboardType="numeric" />
            <Text style={styles.modalLabel}>{t('academic.defaultThreshold')}</Text>
            <TextInput style={styles.modalInput} value={passingValue} onChangeText={setPassingValue} keyboardType="numeric" />
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
