import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import DateTimePicker from '@react-native-community/datetimepicker';
import { theme } from '../../styles/theme';
import { settingsStyles as styles } from '../../styles/Settings.styles';
import { alertRef } from '../CustomAlert';
import type { WeeklyDigestConfig } from '../../services/notificationService';

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

interface Props {
  visible: boolean;
  initialConfig?: WeeklyDigestConfig;
  onSave: (config: WeeklyDigestConfig) => void;
  onClose: () => void;
}

export const WeeklySummaryPicker: React.FC<Props> = ({ visible, initialConfig, onSave, onClose }) => {
  const { t } = useTranslation();
  const [dayOfWeek, setDayOfWeek] = useState(initialConfig?.dayOfWeek ?? 1);
  const [hour, setHour] = useState(initialConfig?.hour ?? 9);
  const [minute, setMinute] = useState(initialConfig?.minute ?? 0);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const handleSave = () => {
    onSave({ dayOfWeek, hour, minute });
    alertRef.show({
      title: 'Resumen semanal activado',
      message: 'Recibirás un resumen semanal de tu rendimiento académico.',
      type: 'success',
      buttons: [{ text: 'OK' }],
    });
    onClose();
  };

  const timeLabel = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('notifications.weeklyDigestConfig', 'Configurar resumen semanal')}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.colors.text.primary} />
            </TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            <Text style={styles.modalLabel}>{t('notifications.weeklyDay', 'Día de la semana')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 20 }}>
              {DAYS.map((day, index) => {
                const isActive = dayOfWeek === index;
                return (
                  <TouchableOpacity
                    key={day}
                    onPress={() => setDayOfWeek(index)}
                    activeOpacity={0.72}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: 20,
                      borderWidth: 1.5,
                      borderColor: isActive ? theme.colors.primary : theme.colors.border,
                      backgroundColor: isActive ? `${theme.colors.primary}15` : 'transparent',
                    }}
                  >
                    <Text style={{
                      fontSize: 13,
                      fontWeight: isActive ? '700' : '500',
                      color: isActive ? theme.colors.primary : theme.colors.text.secondary,
                    }}>
                      {t(`notifications.day.${day}`)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={styles.modalLabel}>{t('notifications.weeklyTime', 'Hora del día')}</Text>
            <TouchableOpacity
              onPress={() => setShowTimePicker(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: theme.colors.inputBackground,
                borderRadius: 12,
                padding: 14,
                borderWidth: 1,
                borderColor: theme.colors.border,
                marginBottom: 8,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '600', color: theme.colors.text.primary }}>{timeLabel}</Text>
              <Ionicons name="time-outline" size={20} color={theme.colors.text.secondary} />
            </TouchableOpacity>
            {showTimePicker && (
              <DateTimePicker
                value={new Date(2000, 0, 1, hour, minute)}
                mode="time"
                is24Hour
                display="spinner"
                onChange={(_, date) => {
                  if (date) {
                    setHour(date.getHours());
                    setMinute(date.getMinutes());
                  }
                  setShowTimePicker(false);
                }}
              />
            )}
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
