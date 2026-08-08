import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { globalStyles } from '../../styles/globalStyles';
import { settingsStyles } from '../../styles/Settings.styles';

export interface SettingsTimePickerModalProps {
  visible: boolean;
  initialTime: string; // "HH:mm"
  title?: string;
  description?: string;
  onClose: () => void;
  onSave: (time: string) => void;
}

export const SettingsTimePickerModal: React.FC<SettingsTimePickerModalProps> = ({
  visible,
  initialTime,
  title,
  description,
  onClose,
  onSave,
}) => {
  const { t } = useTranslation();
  const [hour, setHour] = useState('');
  const [minute, setMinute] = useState('');
  
  const hourInputRef = useRef<TextInput>(null);
  const minuteInputRef = useRef<TextInput>(null);

  // Inicializar estado cuando el modal se abre
  useEffect(() => {
    if (visible) {
      if (initialTime && initialTime.includes(':')) {
        const [h, m] = initialTime.split(':');
        setHour(h ?? '');
        setMinute(m ?? '');
      } else {
        setHour('');
        setMinute('');
      }
      // Pequeño delay para enfocar el input de hora al abrir el modal
      setTimeout(() => {
        hourInputRef.current?.focus();
      }, 100);
    }
  }, [visible, initialTime]);

  const handleHourChange = (text: string) => {
    const numericText = text.replace(/[^0-9]/g, '');
    setHour(numericText);
    
    // Auto avanzar si hay 2 caracteres y es una hora válida
    if (numericText.length === 2 && parseInt(numericText, 10) >= 0 && parseInt(numericText, 10) <= 23) {
      minuteInputRef.current?.focus();
    }
  };

  const handleMinuteChange = (text: string) => {
    const numericText = text.replace(/[^0-9]/g, '');
    setMinute(numericText);
  };

  const isHourValid = hour.length === 2 && parseInt(hour, 10) >= 0 && parseInt(hour, 10) <= 23;
  const isMinuteValid = minute.length === 2 && parseInt(minute, 10) >= 0 && parseInt(minute, 10) <= 59;
  const isValid = isHourValid && isMinuteValid;

  const handleSave = () => {
    if (isValid) {
      onSave(`${hour}:${minute}`);
    }
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          <Text style={settingsStyles.modalTitle}>
            {title || t('reminders.checkTimeTitle', 'Hora del aviso')}
          </Text>
          <Text style={[settingsStyles.modalDesc, { marginTop: 8, marginBottom: 24 }]}>
            {description || t('reminders.checkTimeDesc', 'Recibe un aviso diario cuando tengas repasos pendientes.')}
          </Text>

          <View style={styles.timePickerContainer}>
            <View style={styles.inputWrapper}>
              <TextInput
                ref={hourInputRef}
                style={[
                  styles.timeInput,
                  hour.length > 0 && hour.length === 2 && !isHourValid ? styles.timeInputInvalid : null
                ]}
                value={hour}
                onChangeText={handleHourChange}
                keyboardType="number-pad"
                maxLength={2}
                placeholder="00"
                placeholderTextColor={theme.colors.text.secondary + '60'}
                selectTextOnFocus
              />
              <Text style={styles.inputLabel}>{t('common.hour', 'Hora')}</Text>
            </View>

            <Text style={styles.timeSeparator}>:</Text>

            <View style={styles.inputWrapper}>
              <TextInput
                ref={minuteInputRef}
                style={[
                  styles.timeInput,
                  minute.length > 0 && minute.length === 2 && !isMinuteValid ? styles.timeInputInvalid : null
                ]}
                value={minute}
                onChangeText={handleMinuteChange}
                keyboardType="number-pad"
                maxLength={2}
                placeholder="00"
                placeholderTextColor={theme.colors.text.secondary + '60'}
                selectTextOnFocus
              />
              <Text style={styles.inputLabel}>{t('common.minute', 'Minutos')}</Text>
            </View>
          </View>

          <View style={[settingsStyles.modalFooter, { marginTop: 32 }]}>
            <TouchableOpacity onPress={onClose} style={settingsStyles.modalBtnSecondary}>
              <Text style={settingsStyles.modalBtnSecondaryText}>{t('common.cancel', 'Cancelar')}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={handleSave} 
              disabled={!isValid}
              style={[
                settingsStyles.modalBtnPrimary, 
                !isValid && { backgroundColor: theme.colors.border, opacity: 0.7 }
              ]}
            >
              <Text style={[settingsStyles.modalBtnPrimaryText, !isValid && { color: theme.colors.text.secondary }]}>
                {t('common.save', 'Guardar')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  modalContent: {
    backgroundColor: theme.colors.background,
    width: '100%',
    maxWidth: 340,
    borderRadius: theme.borderRadius.xl,
    padding: 24,
    ...globalStyles.shadow,
  },
  timePickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  inputWrapper: {
    alignItems: 'center',
    width: 80,
  },
  timeInput: {
    width: '100%',
    height: 70,
    backgroundColor: theme.colors.inputBackground,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    fontSize: 40,
    fontWeight: '700',
    color: theme.colors.text.primary,
    textAlign: 'center',
    textAlignVertical: 'center',
    padding: 0,
  },
  timeInputInvalid: {
    borderColor: '#FF3B30',
  },
  timeSeparator: {
    fontSize: 40,
    fontWeight: '700',
    color: theme.colors.text.secondary,
    paddingBottom: 24,
    opacity: 0.5,
  },
  inputLabel: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text.secondary,
  },
});
