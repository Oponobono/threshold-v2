import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { settingsStyles as styles } from '../../styles/Settings.styles';
import { useReminderSettings } from '../../hooks/useReminderSettings';
import type { ReminderEntityType, ReminderProfileName, CategorySetting } from '../../hooks/useReminderSettings';

const OFFSETS = [5, 15, 30, 60, 120, 1440];

const CATEGORY_ICONS: Record<ReminderEntityType, string> = {
  assessment: 'calendar-check-outline',
  schedule: 'time-outline',
  flashcard_deck: 'layers-outline',
  calendar_event: 'calendar-outline',
  grading_period: 'bar-chart-outline',
};

interface Props {
  visible: boolean;
  onClose: () => void;
  reminderCtx: ReturnType<typeof useReminderSettings>;
}

export const PersonalizeRemindersModal: React.FC<Props> = ({ visible, onClose, reminderCtx }) => {
  const { t } = useTranslation();
  const [expandedCategory, setExpandedCategory] = useState<ReminderEntityType | null>(null);

  const toggleExpand = (entityType: ReminderEntityType) => {
    setExpandedCategory(prev => prev === entityType ? null : entityType);
  };

  const handleProfileChange = (cat: CategorySetting, profile: ReminderProfileName) => {
    if (profile === reminderCtx.globalProfile) {
      reminderCtx.resetCategoryToGlobal(cat.entityType);
    } else {
      reminderCtx.customizeCategory(cat.entityType, profile);
    }
  };

  const toggleOffset = (cat: CategorySetting, offset: number) => {
    const newOffsets = cat.customOffsets.includes(offset)
      ? cat.customOffsets.filter(o => o !== offset)
      : [...cat.customOffsets, offset].sort((a, b) => a - b);
    
    reminderCtx.setCustomOffsets(cat.entityType, newOffsets);
  };

  const renderProfileSelector = (
    currentProfile: ReminderProfileName,
    onSelect: (p: ReminderProfileName) => void,
    isGlobal: boolean = false
  ) => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
      {(['minimal', 'standard', 'persistent', 'custom'] as ReminderProfileName[]).map((profile) => {
        const active = currentProfile === profile;
        return (
          <TouchableOpacity
            key={profile}
            onPress={() => onSelect(profile)}
            style={{
              flex: 1,
              minWidth: isGlobal ? 70 : '45%',
              paddingVertical: isGlobal ? 10 : 8,
              paddingHorizontal: 8,
              borderRadius: 8,
              backgroundColor: active ? theme.colors.primary : theme.colors.background,
              borderWidth: 1,
              borderColor: active ? theme.colors.primary : theme.colors.border,
              alignItems: 'center',
            }}
          >
            <Text style={{
              fontSize: isGlobal ? 12 : 11,
              fontWeight: active ? '600' : '400',
              color: active ? '#fff' : theme.colors.text.secondary,
            }}>
              {reminderCtx.getProfileLabelName(profile)}
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
            <Text style={styles.modalTitle}>{t('reminders.globalProfile', 'Perfil de recordatorios')}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.colors.text.primary} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={[styles.modalBody, { paddingBottom: 40 }]}>
            {/* Global Settings */}
            <View style={{ marginBottom: 24 }}>
              <Text style={styles.sectionDesc}>
                {t('reminders.globalProfileDesc', 'Define el comportamiento por defecto de todas las notificaciones.')}
              </Text>
              {renderProfileSelector(reminderCtx.globalProfile, reminderCtx.updateGlobalProfile, true)}
            </View>

            <View style={{ height: 1, backgroundColor: theme.colors.border, marginBottom: 24 }} />

            {/* Category Settings */}
            <Text style={[styles.sectionTitle, { fontSize: 16, marginBottom: 8 }]}>
              {t('reminders.personalizeCategories', 'Excepciones por categoría')}
            </Text>
            <Text style={[styles.sectionDesc, { marginBottom: 16 }]}>
              {t('reminders.personalizeDesc', 'Cada categoría puede tener su propio perfil.')}
            </Text>

            {reminderCtx.effectiveCategories.map((cat) => {
              const icon = CATEGORY_ICONS[cat.entityType] || 'ellipse-outline';
              const isExpanded = expandedCategory === cat.entityType;
              const isCustomized = !cat.inheritsFromGlobal;

              return (
                <View key={cat.entityType} style={{ marginBottom: 12 }}>
                  <TouchableOpacity
                    onPress={() => toggleExpand(cat.entityType)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 14,
                      paddingHorizontal: 16,
                      backgroundColor: theme.colors.card,
                      borderRadius: isExpanded ? 12 : 12,
                      borderBottomLeftRadius: isExpanded ? 0 : 12,
                      borderBottomRightRadius: isExpanded ? 0 : 12,
                      borderWidth: 1,
                      borderColor: isExpanded ? theme.colors.primary : theme.colors.border,
                      borderBottomWidth: isExpanded ? 0 : 1,
                    }}
                  >
                    <Ionicons 
                      name={icon as any} 
                      size={20} 
                      color={isExpanded ? theme.colors.primary : theme.colors.text.secondary} 
                      style={{ marginRight: 12 }} 
                    />

                    <View style={{ flex: 1 }}>
                      <Text style={[styles.settingTitle, { fontSize: 14, color: isExpanded ? theme.colors.primary : theme.colors.text.primary }]}>
                        {reminderCtx.getCategoryLabel(cat.entityType)}
                      </Text>
                      {!cat.enabled ? (
                        <Text style={[styles.settingDesc, { fontSize: 11, color: '#FF3B30', marginTop: 2 }]}>
                          {t('reminders.disabled', 'Desactivado')}
                        </Text>
                      ) : isCustomized ? (
                        <Text style={[styles.settingDesc, { fontSize: 11, color: theme.colors.primary, marginTop: 2 }]}>
                          {reminderCtx.getProfileLabelName(cat.effectiveProfile)}
                        </Text>
                      ) : (
                        <Text style={[styles.settingDesc, { fontSize: 11, marginTop: 2 }]}>
                          {t('common.default', 'Por defecto')}
                        </Text>
                      )}
                    </View>

                    <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={18} color={theme.colors.text.secondary} />
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={{
                      backgroundColor: theme.colors.card,
                      borderWidth: 1,
                      borderColor: theme.colors.primary,
                      borderTopWidth: 0,
                      borderBottomLeftRadius: 12,
                      borderBottomRightRadius: 12,
                      padding: 16,
                      paddingTop: 8,
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <Text style={[styles.settingTitle, { fontSize: 14 }]}>{t('common.enable', 'Habilitar recordatorios')}</Text>
                        <Switch
                          value={cat.enabled}
                          onValueChange={(v) => reminderCtx.setCategoryEnabled(cat.entityType, v)}
                          trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                          thumbColor={theme.colors.white}
                        />
                      </View>

                      {cat.enabled && (
                        <>
                          <Text style={[styles.subSectionTitle, { marginBottom: 4, fontSize: 13 }]}>
                            {t('reminders.profile', 'Perfil específico')}
                          </Text>
                          {renderProfileSelector(cat.effectiveProfile, (p) => handleProfileChange(cat, p))}

                          {cat.effectiveProfile === 'custom' && (
                            <View style={{ marginTop: 16 }}>
                              <Text style={[styles.subSectionTitle, { marginBottom: 8, fontSize: 13 }]}>
                                {t('reminders.offsets', 'Tiempos exactos de aviso')}
                              </Text>
                              {OFFSETS.map((offset) => {
                                const active = cat.customOffsets.includes(offset);
                                const label = offset < 60
                                  ? t('reminders.offsetMinutes', { count: offset })
                                  : t('reminders.offsetHours', { count: Math.floor(offset / 60) });
                                
                                return (
                                  <TouchableOpacity
                                    key={offset}
                                    onPress={() => toggleOffset(cat, offset)}
                                    style={{
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      paddingVertical: 10,
                                      borderBottomWidth: 1,
                                      borderColor: theme.colors.border,
                                    }}
                                  >
                                    <Text style={{ fontSize: 13, color: active ? theme.colors.text.primary : theme.colors.text.secondary }}>
                                      {label}
                                    </Text>
                                    {active && <Ionicons name="checkmark" size={18} color={theme.colors.primary} />}
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          )}

                          {isCustomized && (
                            <TouchableOpacity
                              onPress={() => reminderCtx.resetCategoryToGlobal(cat.entityType)}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                paddingVertical: 12,
                                marginTop: 16,
                                backgroundColor: theme.colors.background,
                                borderRadius: 8,
                                borderWidth: 1,
                                borderColor: theme.colors.border,
                                borderStyle: 'dashed',
                              }}
                            >
                              <Ionicons name="refresh-outline" size={16} color={theme.colors.text.secondary} style={{ marginRight: 6 }} />
                              <Text style={[styles.settingDesc, { fontSize: 12 }]}>
                                {t('reminders.resetToGlobal', 'Restablecer perfil global')}
                              </Text>
                            </TouchableOpacity>
                          )}
                        </>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};
