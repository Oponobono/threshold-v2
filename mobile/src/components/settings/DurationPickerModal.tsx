// ── DurationPickerModal ───────────────────────────────────────────────────
// Modal para seleccionar una duración custom (offset de recordatorio).
// Emite siempre en MINUTOS para mantener el contrato de ReminderPreferences.
// El rollover visual (horas, días, semanas) es solo capa de presentación.

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
  ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { globalStyles } from '../../styles/globalStyles';
import { settingsStyles } from '../../styles/Settings.styles';

type TimeUnit = 'minutes' | 'hours' | 'days' | 'weeks';

const UNIT_MULTIPLIERS: Record<TimeUnit, number> = {
  minutes: 1,
  hours: 60,
  days: 1440,
  weeks: 10080,
};

/** Max total minutes (4 semanas). Sincronizado con MAX_OFFSET_MINUTES en ReminderPreferences. */
const MAX_TOTAL_MINUTES = 40320;

const QUICK_SELECTS: Array<{ label: string; value: number; unit: TimeUnit }> = [
  { label: '5 min', value: 5, unit: 'minutes' },
  { label: '15 min', value: 15, unit: 'minutes' },
  { label: '30 min', value: 30, unit: 'minutes' },
  { label: '1 hora', value: 1, unit: 'hours' },
  { label: '1 día', value: 1, unit: 'days' },
];

const UNITS: Array<{ key: TimeUnit; label: string }> = [
  { key: 'minutes', label: 'Min' },
  { key: 'hours', label: 'Horas' },
  { key: 'days', label: 'Días' },
  { key: 'weeks', label: 'Semanas' },
];

export interface DurationPickerModalProps {
  visible: boolean;
  title?: string;
  /** offsets ya activos en esta categoría (para validar duplicados en la UI) */
  existingOffsets?: number[];
  onClose: () => void;
  /** emite siempre en minutos totales */
  onSave: (minutes: number) => void;
}

function toMinutes(value: number, unit: TimeUnit): number {
  return value * UNIT_MULTIPLIERS[unit];
}

export const DurationPickerModal: React.FC<DurationPickerModalProps> = ({
  visible,
  title,
  existingOffsets = [],
  onClose,
  onSave,
}) => {
  const { t } = useTranslation();
  const inputRef = useRef<TextInput>(null);

  const [inputValue, setInputValue] = useState('15');
  const [unit, setUnit] = useState<TimeUnit>('minutes');

  useEffect(() => {
    if (visible) {
      setInputValue('15');
      setUnit('minutes');
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [visible]);

  const parsedValue = parseInt(inputValue, 10);
  const totalMinutes = isNaN(parsedValue) || parsedValue <= 0 ? 0 : toMinutes(parsedValue, unit);
  const isDuplicate = existingOffsets.includes(totalMinutes);
  const exceedsMax = totalMinutes > MAX_TOTAL_MINUTES;
  const isValid = totalMinutes > 0 && !isDuplicate && !exceedsMax;

  const handleQuickSelect = (qs: typeof QUICK_SELECTS[number]) => {
    setInputValue(String(qs.value));
    setUnit(qs.unit);
  };

  const handleSave = () => {
    if (isValid) onSave(totalMinutes);
  };

  const handleValueChange = (text: string) => {
    setInputValue(text.replace(/[^0-9]/g, ''));
  };

  const errorText = exceedsMax
    ? t('reminders.offsetExceedsMax', 'Máximo: 4 semanas')
    : isDuplicate
    ? t('reminders.offsetDuplicate', 'Ya tienes ese recordatorio')
    : null;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          <Text style={settingsStyles.modalTitle}>
            {title ?? t('reminders.addReminderTitle', 'Nuevo recordatorio')}
          </Text>
          <Text style={[settingsStyles.modalDesc, { marginTop: 6, marginBottom: 20 }]}>
            {t('reminders.addReminderDesc', '¿Cuánto antes quieres recibir el aviso?')}
          </Text>

          {/* Quick selects */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickSelectRow}
          >
            {QUICK_SELECTS.map((qs) => {
              const mins = toMinutes(qs.value, qs.unit);
              const active = parsedValue === qs.value && unit === qs.unit;
              const isAlreadyUsed = existingOffsets.includes(mins);
              return (
                <TouchableOpacity
                  key={qs.label}
                  onPress={() => handleQuickSelect(qs)}
                  disabled={isAlreadyUsed}
                  style={[
                    styles.quickSelectChip,
                    active && styles.quickSelectChipActive,
                    isAlreadyUsed && styles.quickSelectChipDisabled,
                  ]}
                >
                  <Text
                    style={[
                      styles.quickSelectChipText,
                      active && styles.quickSelectChipTextActive,
                    ]}
                  >
                    {qs.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Input + unit selector */}
          <View style={styles.inputRow}>
            <View style={styles.valueInputWrapper}>
              <TextInput
                ref={inputRef}
                style={[styles.valueInput, !!errorText && styles.valueInputError]}
                value={inputValue}
                onChangeText={handleValueChange}
                keyboardType="number-pad"
                maxLength={3}
                selectTextOnFocus
                placeholder="15"
                placeholderTextColor={theme.colors.text.secondary + '60'}
              />
            </View>

            <View style={styles.unitSelector}>
              {UNITS.map((u) => {
                const active = u.key === unit;
                return (
                  <TouchableOpacity
                    key={u.key}
                    onPress={() => setUnit(u.key)}
                    style={[styles.unitChip, active && styles.unitChipActive]}
                  >
                    <Text style={[styles.unitChipText, active && styles.unitChipTextActive]}>
                      {u.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {errorText ? (
            <Text style={styles.errorText}>{errorText}</Text>
          ) : (
            totalMinutes > 0 && (
              <Text style={styles.previewText}>
                {totalMinutes} {t('reminders.minutes', 'min')} {t('reminders.beforeEvent', 'antes del evento')}
              </Text>
            )
          )}

          <View style={[settingsStyles.modalFooter, { marginTop: 24 }]}>
            <TouchableOpacity onPress={onClose} style={settingsStyles.modalBtnSecondary}>
              <Text style={settingsStyles.modalBtnSecondaryText}>{t('common.cancel', 'Cancelar')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              disabled={!isValid}
              style={[
                settingsStyles.modalBtnPrimary,
                !isValid && { backgroundColor: theme.colors.border, opacity: 0.7 },
              ]}
            >
              <Text style={[settingsStyles.modalBtnPrimaryText, !isValid && { color: theme.colors.text.secondary }]}>
                {t('common.add', 'Agregar')}
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
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  modalContent: {
    backgroundColor: theme.colors.background,
    width: '100%',
    maxWidth: 360,
    borderRadius: theme.borderRadius.xl,
    padding: 24,
    ...globalStyles.shadow,
  },
  quickSelectRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 4,
    marginBottom: 20,
  },
  quickSelectChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  quickSelectChipActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary + '20',
  },
  quickSelectChipDisabled: {
    opacity: 0.35,
  },
  quickSelectChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.colors.text.secondary,
  },
  quickSelectChipTextActive: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  valueInputWrapper: {
    width: 90,
  },
  valueInput: {
    height: 64,
    backgroundColor: theme.colors.inputBackground,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    fontSize: 36,
    fontWeight: '700',
    color: theme.colors.text.primary,
    textAlign: 'center',
    padding: 0,
  },
  valueInputError: {
    borderColor: '#FF3B30',
  },
  unitSelector: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'flex-start',
    paddingTop: 6,
  },
  unitChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  unitChipActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  unitChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.text.secondary,
  },
  unitChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    marginBottom: 4,
    marginTop: -4,
  },
  previewText: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    marginBottom: 4,
    marginTop: -4,
    fontStyle: 'italic',
  },
});
