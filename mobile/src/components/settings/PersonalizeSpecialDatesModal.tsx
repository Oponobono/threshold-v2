/**
 * PersonalizeSpecialDatesModal.tsx
 *
 * Modal de configuración de notificaciones para fechas especiales y festivos.
 * Permite al usuario activar/desactivar y configurar la hora independiente de:
 * 1. Días festivos oficiales de Colombia (Ley Emiliani).
 * 2. Fechas importantes y conmemorativas (cívicas, internacionales, religiosas, etc.).
 *
 * Persistencia en MMKV mediante SpecialDatesNotificationPreferencesService y
 * reprogramación reactiva mediante SpecialDatesNotificationScheduler.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SettingsTimePickerModal } from './SettingsTimePickerModal';
import { theme } from '../../styles/theme';
import { settingsStyles as styles } from '../../styles/Settings.styles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSpecialDatesNotificationPreferencesService } from '../../services/calendar/SpecialDatesNotificationPreferencesService';
import { syncSpecialDatesNotifications } from '../../services/calendar/SpecialDatesNotificationScheduler';
import type { SpecialDatesNotificationPreferences } from '../../services/calendar/SpecialDatesNotificationPreferences';
import { alertRef } from '../ui/CustomAlert';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export const PersonalizeSpecialDatesModal: React.FC<Props> = ({ visible, onClose }) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const service = getSpecialDatesNotificationPreferencesService();

  const [prefs, setPrefs] = useState<SpecialDatesNotificationPreferences>(() =>
    service.getPreferences()
  );
  const [showHolidaysTimePicker, setShowHolidaysTimePicker] = useState(false);
  const [showCommemTimePicker, setShowCommemTimePicker] = useState(false);

  useEffect(() => {
    if (visible) {
      setPrefs(service.getPreferences());
    }
  }, [visible]);

  const updatePreferences = (patch: Partial<SpecialDatesNotificationPreferences>) => {
    const updated = service.setPreferences(patch);
    setPrefs(updated);
    syncSpecialDatesNotifications(updated).catch((err) => {
      console.warn('[PersonalizeSpecialDatesModal] Error al reprogramar notificaciones:', err);
    });
  };

  const handleResetDefaults = () => {
    alertRef.show({
      title: t('specialDates.resetTitle', 'Restaurar valores predeterminados'),
      message: t(
        'specialDates.resetBody',
        'Se reestablecerán las notificaciones de festivos y fechas conmemorativas a las 08:00 AM.'
      ),
      type: 'confirm',
      buttons: [
        { text: t('common.cancel', 'Cancelar'), style: 'cancel' },
        {
          text: t('common.restore', 'Restaurar'),
          style: 'destructive',
          onPress: () => {
            const defaults = service.reset();
            setPrefs(defaults);
            syncSpecialDatesNotifications(defaults).catch(() => {});
          },
        },
      ],
    });
  };

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.bottomSheetModalOverlay}>
        <View
          style={[
            styles.bottomSheetModalContent,
            { maxHeight: '90%', paddingBottom: 0, paddingHorizontal: 20 },
          ]}
        >
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.modalTitle}>
                {t('specialDates.notificationsTitle', 'Fechas Especiales y Festivos')}
              </Text>
              <Text style={[styles.sectionDesc, { marginTop: 2 }]}>
                {t(
                  'specialDates.notificationsDesc',
                  'Avisos matutinos para días feriados de Colombia y efemérides'
                )}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={24} color={theme.colors.text.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={[styles.modalBody, { marginBottom: 0 }]}
            contentContainerStyle={{ paddingBottom: (insets.bottom || 16) + 24 }}
            showsVerticalScrollIndicator={false}
          >
            {/* ── CARD 1: Festivos en Colombia ── */}
            <View
              style={{
                backgroundColor: theme.colors.card,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: '#E11D4830',
                padding: 16,
                marginBottom: 16,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 10 }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      backgroundColor: '#E11D4818',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    <MaterialCommunityIcons name="flag-variant" size={22} color="#E11D48" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.settingTitle, { fontSize: 15, color: theme.colors.text.primary }]}>
                      {t('specialDates.holidaysTitle', 'Festivos en Colombia')}
                    </Text>
                    <Text style={[styles.settingDesc, { fontSize: 12, marginTop: 2 }]}>
                      {t(
                        'specialDates.holidaysDesc',
                        'Avisos matutinos en días no laborables y puentes de la Ley Emiliani'
                      )}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={prefs.holidaysEnabled}
                  onValueChange={(v) => updatePreferences({ holidaysEnabled: v })}
                  trackColor={{ false: theme.colors.border, true: '#E11D48' }}
                  thumbColor={theme.colors.white}
                />
              </View>

              {prefs.holidaysEnabled && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: 14,
                    paddingTop: 12,
                    borderTopWidth: 1,
                    borderTopColor: theme.colors.border,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="time-outline" size={16} color={theme.colors.text.secondary} />
                    <Text style={[styles.settingTitle, { fontSize: 13, fontWeight: '500' }]}>
                      {t('specialDates.notificationTime', 'Hora del aviso')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.outlinePill,
                      {
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        borderColor: '#E11D4850',
                        backgroundColor: '#E11D4810',
                      },
                    ]}
                    onPress={() => setShowHolidaysTimePicker(true)}
                  >
                    <Text style={[styles.outlinePillText, { color: '#E11D48', fontWeight: '700' }]}>
                      {prefs.holidaysTime}
                    </Text>
                    <Ionicons name="chevron-forward" size={14} color="#E11D48" />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* ── CARD 2: Fechas importantes y conmemorativas ── */}
            <View
              style={{
                backgroundColor: theme.colors.card,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: '#2563EB30',
                padding: 16,
                marginBottom: 16,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 10 }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      backgroundColor: '#2563EB18',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    <MaterialCommunityIcons name="star-circle-outline" size={22} color="#2563EB" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.settingTitle, { fontSize: 15, color: theme.colors.text.primary }]}>
                      {t('specialDates.commemorationsTitle', 'Fechas Conmemorativas')}
                    </Text>
                    <Text style={[styles.settingDesc, { fontSize: 12, marginTop: 2 }]}>
                      {t(
                        'specialDates.commemorationsDesc',
                        'Efemérides cívicas, internacionales, académicas y culturales'
                      )}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={prefs.commemorationsEnabled}
                  onValueChange={(v) => updatePreferences({ commemorationsEnabled: v })}
                  trackColor={{ false: theme.colors.border, true: '#2563EB' }}
                  thumbColor={theme.colors.white}
                />
              </View>

              {prefs.commemorationsEnabled && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: 14,
                    paddingTop: 12,
                    borderTopWidth: 1,
                    borderTopColor: theme.colors.border,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="time-outline" size={16} color={theme.colors.text.secondary} />
                    <Text style={[styles.settingTitle, { fontSize: 13, fontWeight: '500' }]}>
                      {t('specialDates.notificationTime', 'Hora del aviso')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.outlinePill,
                      {
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        borderColor: '#2563EB50',
                        backgroundColor: '#2563EB10',
                      },
                    ]}
                    onPress={() => setShowCommemTimePicker(true)}
                  >
                    <Text style={[styles.outlinePillText, { color: '#2563EB', fontWeight: '700' }]}>
                      {prefs.commemorationsTime}
                    </Text>
                    <Ionicons name="chevron-forward" size={14} color="#2563EB" />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* ── Callout informativo con estilo sobrio ── */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                backgroundColor: theme.colors.primary + '10',
                padding: 14,
                borderRadius: 12,
                marginBottom: 20,
                borderWidth: 1,
                borderColor: theme.colors.primary + '20',
              }}
            >
              <Ionicons
                name="information-circle-outline"
                size={20}
                color={theme.colors.primary}
                style={{ marginRight: 10, marginTop: 1 }}
              />
              <Text
                style={{
                  flex: 1,
                  fontSize: 12,
                  lineHeight: 18,
                  color: theme.colors.text.secondary,
                }}
              >
                {t(
                  'specialDates.infoCallout',
                  'Los avisos se programan con la antelación configurada y respetan las categorías de fechas activas en tu calendario de Threshold.'
                )}
              </Text>
            </View>

            {/* ── Botón Restaurar valores por defecto ── */}
            <TouchableOpacity
              onPress={handleResetDefaults}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 12,
                backgroundColor: theme.colors.background,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: theme.colors.border,
                borderStyle: 'dashed',
              }}
            >
              <Ionicons
                name="refresh-outline"
                size={16}
                color={theme.colors.text.secondary}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.settingDesc, { fontSize: 12, color: theme.colors.text.secondary }]}>
                {t('common.restoreDefaults', 'Restaurar valores predeterminados')}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>

      {/* Time Picker para Festivos */}
      {showHolidaysTimePicker && (
        <SettingsTimePickerModal
          visible={showHolidaysTimePicker}
          initialTime={prefs.holidaysTime}
          title={t('specialDates.holidaysTimeTitle', 'Hora de aviso de festivos')}
          description={t(
            'specialDates.holidaysTimeDesc',
            'Recibe un aviso matutino el día del festivo oficial en Colombia.'
          )}
          onClose={() => setShowHolidaysTimePicker(false)}
          onSave={(time) => {
            updatePreferences({ holidaysTime: time });
            setShowHolidaysTimePicker(false);
          }}
        />
      )}

      {/* Time Picker para Conmemoraciones */}
      {showCommemTimePicker && (
        <SettingsTimePickerModal
          visible={showCommemTimePicker}
          initialTime={prefs.commemorationsTime}
          title={t('specialDates.commemTimeTitle', 'Hora de aviso de conmemoraciones')}
          description={t(
            'specialDates.commemTimeDesc',
            'Recibe un aviso con las efemérides y fechas conmemorativas del día.'
          )}
          onClose={() => setShowCommemTimePicker(false)}
          onSave={(time) => {
            updatePreferences({ commemorationsTime: time });
            setShowCommemTimePicker(false);
          }}
        />
      )}
    </Modal>
  );
};
