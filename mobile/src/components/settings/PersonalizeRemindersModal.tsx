// ── PersonalizeRemindersModal (proyección UI del contrato ReminderPreferences)
// La UI renderiza directamente el contrato device-local (MMKV) vía
// useReminderPreferences. Cada cambio persiste de inmediato
// (service.set → MMKV → coordinator.resync → reconcile → OS).
// No existe capa de traducción de perfiles (minimal/standard/persistent/custom).

import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, Modal, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { SettingsTimePickerModal } from './SettingsTimePickerModal';
import { theme } from '../../styles/theme';
import { settingsStyles as styles } from '../../styles/Settings.styles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReminderPreferences } from '../../hooks/useReminderPreferences';
import type { ReminderCategoryName } from '../../services/reminders/ReminderPreferences';
import {
  OFFSET_PRESETS,
  formatOffsetLabel,
} from '../../services/reminders/ReminderPreferencesPresentation';
import type { TranslateFn } from '../../services/reminders/ReminderPreferencesPresentation';
import { alertRef } from '../ui/CustomAlert';

interface Props {
  visible: boolean;
  onClose: () => void;
  ctx: ReturnType<typeof useReminderPreferences>;
}

export const PersonalizeRemindersModal: React.FC<Props> = ({ visible, onClose, ctx }) => {
  const { t } = useTranslation();
  const translate: TranslateFn = (key, options) => t(key, options);
  const insets = useSafeAreaInsets();

  const [expandedCategory, setExpandedCategory] = useState<ReminderCategoryName | null>(null);
  const [showDefaultOffset, setShowDefaultOffset] = useState(false);
  const [showCheckTime, setShowCheckTime] = useState(false);
  const [showQuietStart, setShowQuietStart] = useState(false);
  const [showQuietEnd, setShowQuietEnd] = useState(false);

  const { prefs, categories } = ctx;
  const masterEnabled = prefs.notificationsEnabled;

  const setCategoryEnabled = (name: ReminderCategoryName, enabled: boolean) => {
    ctx.update({ categories: { [name]: { enabled } } });
  };

  const toggleCategoryOffset = (name: ReminderCategoryName, currentOffsets: number[] | null, offset: number | null) => {
    if (offset === null) {
      ctx.update({ categories: { [name]: { offsets: null } } });
      return;
    }
    const current = currentOffsets ?? [];
    let newOffsets: number[];
    if (current.includes(offset)) {
      newOffsets = current.filter(x => x !== offset);
      if (newOffsets.length === 0) return; // Prevenir deseleccionar el último
    } else {
      newOffsets = [...current, offset];
    }
    ctx.update({ categories: { [name]: { offsets: newOffsets } } });
  };

  const setDefaultOffset = (offset: number | null) => {
    if (offset != null) {
      ctx.update({ defaultOffset: offset });
    }
    setShowDefaultOffset(false);
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

  const renderOffsetChips = (
    current: number,
    onSelect: (offset: number) => void,
  ) => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
      {OFFSET_PRESETS.map((offset) => {
        const active = current === offset;
        return (
          <TouchableOpacity
            key={offset}
            onPress={() => onSelect(offset)}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: active ? theme.colors.primary : theme.colors.border,
              backgroundColor: active ? theme.colors.primary : theme.colors.background,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: active ? '600' : '400',
                color: active ? '#fff' : theme.colors.text.secondary,
              }}
            >
              {formatOffsetLabel(offset, translate)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderMultiOffsetChips = (
    currentOffsets: number[],
    onToggle: (offset: number | null) => void,
    defaultActive: boolean,
  ) => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
      <TouchableOpacity
        onPress={() => onToggle(null)}
        style={{
          paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1,
          borderColor: defaultActive ? theme.colors.primary : theme.colors.border,
          backgroundColor: defaultActive ? theme.colors.primary : theme.colors.background,
        }}
      >
        <Text style={{ fontSize: 12, fontWeight: defaultActive ? '600' : '400', color: defaultActive ? '#fff' : theme.colors.text.secondary }}>
          {defaultActive ? `✓ ${t('reminders.offsetDefault', 'Predeterminado')}` : t('reminders.offsetDefault', 'Predeterminado')}
        </Text>
      </TouchableOpacity>
      
      {OFFSET_PRESETS.map((offset) => {
        const active = currentOffsets.includes(offset);
        return (
          <TouchableOpacity
            key={offset}
            onPress={() => onToggle(offset)}
            style={{
              paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1,
              borderColor: active ? theme.colors.primary : theme.colors.border,
              backgroundColor: active ? theme.colors.primary : theme.colors.background,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: active ? '600' : '400', color: active ? '#fff' : theme.colors.text.secondary }}>
              {active ? '✓ ' : ''}{formatOffsetLabel(offset, translate)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

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
            {/* ── Master switch ── */}
            <View style={[styles.settingRow, { marginBottom: 4 }]}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.settingTitle}>{t('reminders.masterSwitch', 'Notificaciones')}</Text>
                <Text style={styles.settingDesc}>
                  {t('reminders.masterSwitchDesc', 'Activa o desactiva todos los recordatorios')}
                </Text>
              </View>
              <Switch
                value={masterEnabled}
                onValueChange={(v) => ctx.update({ notificationsEnabled: v })}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor={theme.colors.white}
              />
            </View>

            {!masterEnabled && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#FF950015',
                  padding: 12,
                  borderRadius: 8,
                  marginBottom: 12,
                }}
              >
                <Ionicons name="warning" size={16} color="#FF9500" style={{ marginRight: 8 }} />
                <Text style={{ flex: 1, fontSize: 12, color: '#FF9500' }}>
                  {t('reminders.masterOffHint', 'Los recordatorios están desactivados. No se programarán avisos.')}
                </Text>
              </View>
            )}

            <View style={{ height: 1, backgroundColor: theme.colors.border, marginVertical: 20 }} />

            {/* ── Categorías ── */}
            <Text style={[styles.sectionTitle, { fontSize: 16, marginBottom: 4 }]}>
              {t('reminders.categorySection', 'Recordatorios')}
            </Text>
            <Text style={[styles.sectionDesc, { marginBottom: 16 }]}>
              {t('reminders.categorySectionDesc', 'Avisos por tipo de contenido. Cada categoría tiene su propia anticipación.')}
            </Text>

            {categories.map((cat) => {
              const isExpanded = expandedCategory === cat.name;
              return (
                <View key={cat.name} style={{ marginBottom: 12, opacity: masterEnabled ? 1 : 0.5 }}>
                  <View
                    style={{
                      backgroundColor: theme.colors.card,
                      borderRadius: isExpanded ? 12 : 12,
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
                        onPress={() => setExpandedCategory(prev => (prev === cat.name ? null : cat.name))}
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
                          ) : cat.checkTime != null ? (
                            <Text style={[styles.settingDesc, { fontSize: 11, color: theme.colors.text.secondary, marginTop: 2 }]}>
                              {t('reminders.dailyReview', { value: cat.offsetLabel, defaultValue: 'Repaso diario a las {{value}}' })}
                            </Text>
                          ) : (
                            <Text style={[styles.settingDesc, { fontSize: 11, color: theme.colors.text.secondary, marginTop: 2 }]}>
                              {t('reminders.offsetBefore', { value: cat.offsetLabel, defaultValue: 'Avisar {{value}}' })}
                            </Text>
                          )}
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12 }}
                        onPress={() => setExpandedCategory(prev => (prev === cat.name ? null : cat.name))}
                        disabled={!masterEnabled}
                      >
                        <Text style={[styles.outlinePillText, { fontSize: 12 }]}>{cat.offsetLabel}</Text>
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
                    <View
                      style={{
                        backgroundColor: theme.colors.card,
                        borderWidth: 1,
                        borderColor: theme.colors.primary,
                        borderTopWidth: 0,
                        borderBottomLeftRadius: 12,
                        borderBottomRightRadius: 12,
                        padding: 16,
                        paddingTop: 8,
                      }}
                    >
                      {cat.checkTime != null ? (
                        <>
                          <Text style={styles.settingDesc}>
                            {t('reminders.checkTimeDesc', { defaultValue: 'Recibe un aviso diario cuando tengas repasos pendientes.' })}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 }}>
                            <Text style={styles.settingTitle}>{t('reminders.checkTimeTitle', 'Hora del aviso')}</Text>
                            <TouchableOpacity
                              style={[styles.outlinePill, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}
                              onPress={() => setShowCheckTime(prev => !prev)}
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
                              onSave={(time) => {
                                setCheckTime(time);
                                setShowCheckTime(false);
                              }}
                            />
                          )}
                        </>
                      ) : (
                        <>
                          <Text style={[styles.subSectionTitle, { marginBottom: 2, fontSize: 13 }]}>
                            {t('reminders.offsetTitle', '¿Cuánto antes avisar?')}
                          </Text>
                          {renderMultiOffsetChips(
                            cat.offsets || [],
                            (offset) => toggleCategoryOffset(cat.name, cat.hasCustomOffsets ? cat.offsets : null, offset),
                            !cat.hasCustomOffsets,
                          )}
                        </>
                      )}
                    </View>
                  )}
                </View>
              );
            })}

            <View style={{ height: 1, backgroundColor: theme.colors.border, marginVertical: 20 }} />

            {/* ── Preferencias ── */}
            <Text style={[styles.sectionTitle, { fontSize: 16, marginBottom: 4 }]}>
              {t('reminders.preferencesSection', 'Preferencias')}
            </Text>
            <Text style={[styles.sectionDesc, { marginBottom: 16 }]}>
              {t('reminders.preferencesSectionDesc', 'Configuración global de los recordatorios.')}
            </Text>

            {/* Anticipación predeterminada */}
            <View style={[styles.settingRow, { marginBottom: 4 }]}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.settingTitle}>{t('reminders.defaultOffsetTitle', 'Anticipación predeterminada')}</Text>
                <Text style={styles.settingDesc}>
                  {t('reminders.defaultOffsetDesc', 'Se aplica a las categorías sin anticipación propia')}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.outlinePill, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}
                onPress={() => setShowDefaultOffset(prev => !prev)}
              >
                <Ionicons name="time-outline" size={13} color={theme.colors.text.secondary} />
                <Text style={styles.outlinePillText}>{formatOffsetLabel(prefs.defaultOffset, translate)}</Text>
              </TouchableOpacity>
            </View>
            {showDefaultOffset && (
              <View style={{ marginBottom: 16 }}>
                {renderOffsetChips(prefs.defaultOffset, setDefaultOffset as any)}
              </View>
            )}

            {/* Horario de silencio */}
            <View style={[styles.settingRow, { marginBottom: 4 }]}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.settingTitle}>{t('reminders.quietHoursTitle', 'Horario de silencio')}</Text>
                <Text style={styles.settingDesc}>
                  {t('reminders.quietHoursDesc', 'No se generan recordatorios dentro de esta ventana')}
                </Text>
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
                    onPress={() => setShowQuietStart(prev => !prev)}
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
                    onSave={(time) => {
                      setQuietTime('start', time);
                      setShowQuietStart(false);
                    }}
                  />
                )}

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 }}>
                  <Text style={styles.settingTitle}>{t('reminders.quietHoursEnd', 'Fin')}</Text>
                  <TouchableOpacity
                    style={[styles.outlinePill, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}
                    onPress={() => setShowQuietEnd(prev => !prev)}
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
                    onSave={(time) => {
                      setQuietTime('end', time);
                      setShowQuietEnd(false);
                    }}
                  />
                )}
              </View>
            )}

            {/* Restaurar valores predeterminados */}
            <TouchableOpacity
              onPress={handleReset}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 12,
                marginTop: 20,
                backgroundColor: theme.colors.background,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: theme.colors.border,
                borderStyle: 'dashed',
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
    </Modal>
  );
};
