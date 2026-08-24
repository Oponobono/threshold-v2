// -- PersonalizeRemindersModal (proyección UI del contrato ReminderPreferences)
// La UI renderiza directamente el contrato device-local (MMKV) vía
// useReminderPreferences. Cada cambio persiste de inmediato
// (service.set ? MMKV ? coordinator.resync ? reconcile ? OS).
// No existe capa de traducción de perfiles (minimal/standard/persistent/custom).

import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { SettingsTimePickerModal } from './SettingsTimePickerModal';
import { DurationPickerModal } from './DurationPickerModal';
import { theme } from '../../styles/theme';
import { settingsStyles as styles } from '../../styles/Settings.styles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReminderPreferences } from '../../hooks/useReminderPreferences';
import type { ReminderCategoryName } from '../../services/reminders/ReminderPreferences';
import {
  formatOffsetLabel,
} from '../../services/reminders/ReminderPreferencesPresentation';
import type { TranslateFn } from '../../services/reminders/ReminderPreferencesPresentation';
import { alertRef } from '../ui/CustomAlert';
import { toastRef } from '../ui/Toast';

interface Props {
  visible: boolean;
  onClose: () => void;
  ctx: ReturnType<typeof useReminderPreferences>;
}

type OffsetCategoryName = 'assessment' | 'schedule' | 'calendar_event';

const OFFSET_CATEGORY_LABELS: Record<OffsetCategoryName, string> = {
  assessment: 'inicio del examen o entrega',
  schedule: 'inicio de la clase',
  calendar_event: 'inicio del evento',
};

export const PersonalizeRemindersModal: React.FC<Props> = ({ visible, onClose, ctx }) => {
  const { t } = useTranslation();
  const translate: TranslateFn = (key, options) => t(key, options);
  const insets = useSafeAreaInsets();

  const [expandedCategory, setExpandedCategory] = useState<ReminderCategoryName | null>(null);
  const [showCheckTime, setShowCheckTime] = useState(false);
  const [showQuietStart, setShowQuietStart] = useState(false);
  const [showQuietEnd, setShowQuietEnd] = useState(false);
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const [durationPickerCategory, setDurationPickerCategory] = useState<OffsetCategoryName | null>(null);

  const { prefs, categories } = ctx;
  const masterEnabled = prefs.notificationsEnabled;

  const setCategoryEnabled = (name: ReminderCategoryName, enabled: boolean) => {
    ctx.update({ categories: { [name]: { enabled } } });
  };

  const setCheckTime = (time: string) => {
    ctx.update({ categories: { flashcard_deck: { checkTime: time } } });
  };

  const setQuietEnabled = (enabled: boolean) => {
    ctx.update({ quietHours: { enabled } });
  };

  const setQuietTime = (field: 'start' | 'end', time: string) => {
    ctx.update({ quietHours: { [field]: time } });
  };

  const handleReset = () => {
    alertRef.show({
      title: t('reminders.resetDefaultsTitle', 'Restaurar valores predeterminados'),
      message: t(
        'reminders.resetDefaultsBody',
        'Se restaurarán las anticipaciones de todas las categorías y el horario de silencio. Los cambios se aplican de inmediato.',
      ),
      type: 'confirm',
      buttons: [
        { text: t('common.cancel', 'Cancelar'), style: 'cancel' },
        { text: t('reminders.resetDefaultsConfirm', 'Restaurar'), style: 'destructive', onPress: () => ctx.reset() },
      ],
    });
  };

  // -- Helpers para categorías de offset ----------------------------------

  const getCatOffsets = (name: OffsetCategoryName): number[] | null => {
    const cat = prefs.categories[name];
    return (cat as { offsets: number[] | null }).offsets;
  };

  const isCustomMode = (name: OffsetCategoryName): boolean => getCatOffsets(name) !== null;

  const enableCustomMode = (name: OffsetCategoryName) => {
    ctx.update({ categories: { [name]: { offsets: [prefs.defaultOffset] } } });
  };

  const disableCustomMode = (name: OffsetCategoryName) => {
    ctx.update({ categories: { [name]: { offsets: null } } });
  };

  const toggleAtStart = (name: OffsetCategoryName, currentOffsets: number[]) => {
    const hasZero = currentOffsets.includes(0);
    const newOffsets = hasZero
      ? currentOffsets.filter(o => o !== 0)
      : [0, ...currentOffsets.filter(o => o > 0)];
    applyNewOffsets(name, newOffsets);
  };

  const removeCustomOffset = (name: OffsetCategoryName, offset: number, currentOffsets: number[]) => {
    applyNewOffsets(name, currentOffsets.filter(o => o !== offset));
  };

  const addCustomOffset = (name: OffsetCategoryName, minutes: number) => {
    const current = getCatOffsets(name) ?? [];
    if (current.includes(minutes)) return;
    applyNewOffsets(name, [...current, minutes].sort((a, b) => a - b));
  };

  const applyNewOffsets = (name: OffsetCategoryName, newOffsets: number[]) => {
    if (newOffsets.length === 0) {
      ctx.update({ categories: { [name]: { enabled: false, offsets: [] } } });
      toastRef.current?.show?.(t('reminders.categoryAutoDisabled', 'Categoría desactivada: no quedan recordatorios.'));
    } else {
      ctx.update({ categories: { [name]: { offsets: newOffsets } } });
    }
  };

  const openDurationPicker = (name: OffsetCategoryName) => {
    setDurationPickerCategory(name);
    setShowDurationPicker(true);
  };

  // -- Renderizado panel expandido de categoría de offset ------------------
  const renderOffsetCategoryExpanded = (name: OffsetCategoryName) => {
    const custom = isCustomMode(name);
    const currentOffsets = getCatOffsets(name);
    const effectiveOffsets = currentOffsets ?? [prefs.defaultOffset];
    const hasZero = effectiveOffsets.includes(0);
    const customOffsets = effectiveOffsets.filter(o => o > 0);
    const canAddMore = customOffsets.length < 3;
    const eventLabel = OFFSET_CATEGORY_LABELS[name];

    return (
      <View
        style={{
          backgroundColor: theme.colors.card,
          borderWidth: 1,
          borderColor: theme.colors.primary,
          borderTopWidth: 0,
          borderBottomLeftRadius: 12,
          borderBottomRightRadius: 12,
          padding: 16,
          paddingTop: 12,
        }}
      >
        {/* Predeterminado / Personalizar */}
        <View style={{ flexDirection: 'row', marginBottom: 14 }}>
          <TouchableOpacity
            onPress={() => disableCustomMode(name)}
            style={{
              flex: 1, paddingVertical: 7, alignItems: 'center',
              borderRadius: 8, borderWidth: 1, marginRight: 6,
              borderColor: !custom ? theme.colors.primary : theme.colors.border,
              backgroundColor: !custom ? theme.colors.primary + '18' : 'transparent',
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: !custom ? '700' : '400', color: !custom ? theme.colors.primary : theme.colors.text.secondary }}>
              {t('reminders.modeDefault', 'Predeterminado')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => !custom && enableCustomMode(name)}
            style={{
              flex: 1, paddingVertical: 7, alignItems: 'center',
              borderRadius: 8, borderWidth: 1,
              borderColor: custom ? theme.colors.primary : theme.colors.border,
              backgroundColor: custom ? theme.colors.primary + '18' : 'transparent',
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: custom ? '700' : '400', color: custom ? theme.colors.primary : theme.colors.text.secondary }}>
              {t('reminders.modeCustom', 'Personalizar')}
            </Text>
          </TouchableOpacity>
        </View>

        {!custom ? (
          <Text style={[styles.settingDesc, { fontSize: 12, textAlign: 'center', marginTop: 4 }]}>
            {t('reminders.defaultOffsetHint', {
              value: formatOffsetLabel(prefs.defaultOffset, translate),
              defaultValue: 'Avisará {{value}} (configuración global)',
            })}
          </Text>
        ) : (
          <>
            {/* Toggle "Al inicio" */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingTitle, { fontSize: 13 }]}>
                  {t('reminders.atStartLabel', `Al ${eventLabel}`)}
                </Text>
                <Text style={[styles.settingDesc, { fontSize: 11 }]}>
                  {t('reminders.atStartDesc', 'Aviso en el momento exacto de inicio')}
                </Text>
              </View>
              <Switch
                value={hasZero}
                onValueChange={() => toggleAtStart(name, currentOffsets ?? [])}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor={theme.colors.white}
              />
            </View>

            {/* Pre-avisos custom */}
            <Text style={[styles.settingDesc, { fontSize: 11, marginBottom: 8 }]}>
              {t('reminders.customAlertsLabel', 'Pre-avisos')} ({customOffsets.length}/3)
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {customOffsets.map((offset) => (
                <View
                  key={offset}
                  style={{
                    flexDirection: 'row', alignItems: 'center',
                    backgroundColor: theme.colors.primary + '15',
                    borderRadius: 20, borderWidth: 1,
                    borderColor: theme.colors.primary + '50',
                    paddingVertical: 5, paddingLeft: 12, paddingRight: 8, gap: 6,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.primary }}>
                    {formatOffsetLabel(offset, translate)}
                  </Text>
                  <TouchableOpacity
                    onPress={() => removeCustomOffset(name, offset, currentOffsets ?? [])}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={16} color={theme.colors.primary + 'AA'} />
                  </TouchableOpacity>
                </View>
              ))}

              {canAddMore && (
                <TouchableOpacity
                  onPress={() => openDurationPicker(name)}
                  style={{
                    flexDirection: 'row', alignItems: 'center',
                    borderRadius: 20, borderWidth: 1,
                    borderColor: theme.colors.border, borderStyle: 'dashed',
                    paddingVertical: 5, paddingHorizontal: 12, gap: 4,
                  }}
                >
                  <Ionicons name="add" size={14} color={theme.colors.text.secondary} />
                  <Text style={{ fontSize: 12, color: theme.colors.text.secondary }}>
                    {t('reminders.addAlert', 'Agregar')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}
      </View>
    );
  };

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.bottomSheetModalOverlay}>
        <View style={[styles.bottomSheetModalContent, { maxHeight: '90%', paddingBottom: 0, paddingHorizontal: 20 }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { flex: 1 }]}>{t('reminders.configTitle', 'Configuración de recordatorios')}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.colors.text.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={[styles.modalBody, { marginBottom: 0 }]}
            contentContainerStyle={{ paddingBottom: (insets.bottom || 16) + 16 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Master switch */}
            <View style={[styles.settingRow, { marginBottom: 4 }]}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.settingTitle}>{t('reminders.masterSwitch', 'Notificaciones')}</Text>
                <Text style={styles.settingDesc}>{t('reminders.masterSwitchDesc', 'Activa o desactiva todos los recordatorios')}</Text>
              </View>
              <Switch
                value={masterEnabled}
                onValueChange={(v) => ctx.update({ notificationsEnabled: v })}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor={theme.colors.white}
              />
            </View>

            {!masterEnabled && (
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF950015', padding: 12, borderRadius: 8, marginBottom: 12 }}>
                <Ionicons name="warning" size={16} color="#FF9500" style={{ marginRight: 8 }} />
                <Text style={{ flex: 1, fontSize: 12, color: '#FF9500' }}>
                  {t('reminders.masterOffHint', 'Los recordatorios están desactivados. No se programarán avisos.')}
                </Text>
              </View>
            )}

            <View style={{ height: 1, backgroundColor: theme.colors.border, marginVertical: 20 }} />

            {/* Categorías */}
            <Text style={[styles.sectionTitle, { fontSize: 16, marginBottom: 4 }]}>{t('reminders.categorySection', 'Recordatorios')}</Text>
            <Text style={[styles.sectionDesc, { marginBottom: 16 }]}>{t('reminders.categorySectionDesc', 'Configura los avisos por tipo de contenido.')}</Text>

            {categories.map((cat) => {
              const isExpanded = expandedCategory === cat.name;
              const isOffsetCategory = cat.name !== 'flashcard_deck';

              return (
                <View key={cat.name} style={{ marginBottom: 12, opacity: masterEnabled ? 1 : 0.5 }}>
                  <View
                    style={{
                      backgroundColor: theme.colors.card,
                      borderRadius: 12,
                      borderBottomLeftRadius: isExpanded ? 0 : 12,
                      borderBottomRightRadius: isExpanded ? 0 : 12,
                      borderWidth: 1,
                      borderColor: isExpanded ? theme.colors.primary : theme.colors.border,
                      borderBottomWidth: isExpanded ? 0 : 1,
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <TouchableOpacity
                        style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                        onPress={() => setExpandedCategory((prev) => (prev === cat.name ? null : cat.name))}
                        disabled={!masterEnabled}
                      >
                        <Ionicons
                          name={cat.icon as any}
                          size={20}
                          color={isExpanded ? theme.colors.primary : theme.colors.text.secondary}
                          style={{ marginRight: 12 }}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.settingTitle, { fontSize: 14, color: isExpanded ? theme.colors.primary : theme.colors.text.primary }]}>
                            {cat.label}
                          </Text>
                          {!cat.enabled ? (
                            <Text style={[styles.settingDesc, { fontSize: 11, color: '#FF3B30', marginTop: 2 }]}>
                              {t('reminders.disabled', 'Desactivado')}
                            </Text>
                          ) : (
                            <Text style={[styles.settingDesc, { fontSize: 11, color: theme.colors.text.secondary, marginTop: 2 }]}>
                              {cat.checkTime != null
                                ? t('reminders.dailyReview', { value: cat.offsetLabel, defaultValue: 'Repaso diario a las {{value}}' })
                                : t('reminders.offsetBefore', { value: cat.offsetLabel, defaultValue: '{{value}}' })}
                            </Text>
                          )}
                        </View>
                      </TouchableOpacity>
                      <Switch
                        value={cat.enabled}
                        onValueChange={(v) => setCategoryEnabled(cat.name, v)}
                        trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                        thumbColor={theme.colors.white}
                      />
                    </View>
                  </View>

                  {isExpanded && masterEnabled && (
                    isOffsetCategory
                      ? renderOffsetCategoryExpanded(cat.name as OffsetCategoryName)
                      : (
                        <View
                          style={{
                            backgroundColor: theme.colors.card,
                            borderWidth: 1, borderColor: theme.colors.primary,
                            borderTopWidth: 0, borderBottomLeftRadius: 12, borderBottomRightRadius: 12,
                            padding: 16, paddingTop: 8,
                          }}
                        >
                          <Text style={styles.settingDesc}>{t('reminders.checkTimeDesc', 'Recibe un aviso diario cuando tengas repasos pendientes.')}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 }}>
                            <Text style={styles.settingTitle}>{t('reminders.checkTimeTitle', 'Hora del aviso')}</Text>
                            <TouchableOpacity
                              style={[styles.outlinePill, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}
                              onPress={() => setShowCheckTime((prev) => !prev)}
                            >
                              <Ionicons name="time-outline" size={13} color={theme.colors.text.secondary} />
                              <Text style={styles.outlinePillText}>{cat.offsetLabel}</Text>
                            </TouchableOpacity>
                          </View>
                          {showCheckTime && (
                            <SettingsTimePickerModal
                              visible={showCheckTime}
                              initialTime={cat.offsetLabel}
                              title={t('reminders.checkTimeTitle', 'Hora del aviso')}
                              description={t('reminders.checkTimeDesc', 'Recibe un aviso diario cuando tengas repasos pendientes.')}
                              onClose={() => setShowCheckTime(false)}
                              onSave={(time) => { setCheckTime(time); setShowCheckTime(false); }}
                            />
                          )}
                        </View>
                      )
                  )}
                </View>
              );
            })}

            <View style={{ height: 1, backgroundColor: theme.colors.border, marginVertical: 20 }} />

            {/* Anticipación predeterminada */}
            <Text style={[styles.sectionTitle, { fontSize: 16, marginBottom: 4 }]}>{t('reminders.preferencesSection', 'Preferencias')}</Text>
            <Text style={[styles.sectionDesc, { marginBottom: 16 }]}>{t('reminders.preferencesSectionDesc', 'Configuración global aplicada a categorías en modo Predeterminado.')}</Text>

            <View style={[styles.settingRow, { marginBottom: 12 }]}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.settingTitle}>{t('reminders.defaultOffsetTitle', 'Anticipación predeterminada')}</Text>
                <Text style={styles.settingDesc}>{t('reminders.defaultOffsetDesc', 'Se aplica a las categorías sin anticipación propia')}</Text>
              </View>
              <TouchableOpacity
                onPress={() => { setDurationPickerCategory(null); setShowDurationPicker(true); }}
                style={[styles.outlinePill, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}
              >
                <Ionicons name="time-outline" size={13} color={theme.colors.text.secondary} />
                <Text style={styles.outlinePillText}>{formatOffsetLabel(prefs.defaultOffset, translate)}</Text>
              </TouchableOpacity>
            </View>

            <View style={{ height: 1, backgroundColor: theme.colors.border, marginVertical: 4 }} />

            {/* Horario de silencio */}
            <View style={[styles.settingRow, { marginBottom: 4, marginTop: 16 }]}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.settingTitle}>{t('reminders.quietHoursTitle', 'Horario de silencio')}</Text>
                <Text style={styles.settingDesc}>{t('reminders.quietHoursDesc', 'No se generan recordatorios dentro de esta ventana')}</Text>
              </View>
              <Switch
                value={prefs.quietHours.enabled}
                onValueChange={setQuietEnabled}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor={theme.colors.white}
              />
            </View>

            {prefs.quietHours.enabled && (
              <View style={{ marginTop: 8, marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 }}>
                  <Text style={styles.settingTitle}>{t('reminders.quietHoursStart', 'Inicio')}</Text>
                  <TouchableOpacity
                    style={[styles.outlinePill, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}
                    onPress={() => setShowQuietStart((prev) => !prev)}
                  >
                    <Text style={styles.outlinePillText}>{prefs.quietHours.start}</Text>
                  </TouchableOpacity>
                </View>
                {showQuietStart && (
                  <SettingsTimePickerModal
                    visible={showQuietStart}
                    initialTime={prefs.quietHours.start}
                    title={t('reminders.quietHoursStartTitle', 'Inicio del silencio')}
                    description={t('reminders.quietHoursStartDesc', 'A partir de esta hora no recibirás recordatorios.')}
                    onClose={() => setShowQuietStart(false)}
                    onSave={(time) => { setQuietTime('start', time); setShowQuietStart(false); }}
                  />
                )}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 }}>
                  <Text style={styles.settingTitle}>{t('reminders.quietHoursEnd', 'Fin')}</Text>
                  <TouchableOpacity
                    style={[styles.outlinePill, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}
                    onPress={() => setShowQuietEnd((prev) => !prev)}
                  >
                    <Text style={styles.outlinePillText}>{prefs.quietHours.end}</Text>
                  </TouchableOpacity>
                </View>
                {showQuietEnd && (
                  <SettingsTimePickerModal
                    visible={showQuietEnd}
                    initialTime={prefs.quietHours.end}
                    title={t('reminders.quietHoursEndTitle', 'Fin del silencio')}
                    description={t('reminders.quietHoursEndDesc', 'A partir de esta hora se reanudarán los recordatorios.')}
                    onClose={() => setShowQuietEnd(false)}
                    onSave={(time) => { setQuietTime('end', time); setShowQuietEnd(false); }}
                  />
                )}
              </View>
            )}

            {/* Restaurar */}
            <TouchableOpacity
              onPress={handleReset}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                paddingVertical: 12, marginTop: 20,
                backgroundColor: theme.colors.background,
                borderRadius: 8, borderWidth: 1,
                borderColor: theme.colors.border, borderStyle: 'dashed',
              }}
            >
              <Ionicons name="refresh-outline" size={16} color="#FF3B30" style={{ marginRight: 6 }} />
              <Text style={[styles.settingDesc, { fontSize: 12, color: '#FF3B30' }]}>
                {t('reminders.resetDefaults', 'Restaurar valores predeterminados')}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>

      {/* DurationPickerModal para pre-avisos custom y anticipación predeterminada */}
      {showDurationPicker && (
        <DurationPickerModal
          visible={showDurationPicker}
          title={
            durationPickerCategory
              ? t('reminders.addReminderTitle', 'Nuevo recordatorio')
              : t('reminders.defaultOffsetTitle', 'Anticipación predeterminada')
          }
          existingOffsets={durationPickerCategory ? (getCatOffsets(durationPickerCategory) ?? []) : []}
          onClose={() => { setShowDurationPicker(false); setDurationPickerCategory(null); }}
          onSave={(minutes) => {
            if (durationPickerCategory) {
              addCustomOffset(durationPickerCategory, minutes);
            } else {
              ctx.update({ defaultOffset: minutes });
            }
            setShowDurationPicker(false);
            setDurationPickerCategory(null);
          }}
        />
      )}
    </Modal>
  );
};

