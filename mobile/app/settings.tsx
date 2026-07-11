import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, Image, TextInput, ActivityIndicator, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { globalStyles } from '../src/styles/globalStyles';
import { theme } from '../src/styles/theme';
import { settingsStyles as styles } from '../src/styles/Settings.styles';
import { alertRef } from '../src/components/ui/CustomAlert';
import * as Clipboard from 'expo-clipboard';

import { useSettingsLogic } from '../src/hooks/useSettingsLogic';
import { useBackupLogic } from '../src/hooks/useBackupLogic';
import { useReminderSettings } from '../src/hooks/useReminderSettings';
import type { ReminderProfileName } from '../src/hooks/useReminderSettings';
import { EditProfileModal } from '../src/components/modals/EditProfileModal';
import { ChangePasswordModal } from '../src/components/modals/ChangePasswordModal';
import { DeleteAccountModal } from '../src/components/modals/DeleteAccountModal';
import { LocalAIEngineSection } from '../src/components/settings/LocalAIEngineSection';
import { OfflineIndicator } from '../src/components/ui/OfflineIndicator';
import {
  AddTermModal,
  ManageOverridesModal,
  AddCustomScaleModal,
  TwoFactorModal,
  AddLmsModal,
  ExportDataModal,
  FaqModal,
  SendFeedbackModal,
  CreateGroupModal,
  ZyrenInfoModal,
  ActiveRemindersModal,
  PersonalizeRemindersModal,
} from '../src/components/settings';

/**
 * Componente auxiliar para renderizar una fila de configuración individual.
 * Contiene un título, una descripción opcional y un elemento derecho (ej. Switch, botón).
 *
 * @param {string} title - El título de la configuración.
 * @param {string} [desc] - Descripción opcional de la configuración.
 * @param {React.ReactNode} right - Elemento React a renderizar a la derecha (Switch, botón, etc).
 */
const SettingRow = ({ title, desc, right }: { title: string; desc?: string; right: React.ReactNode }) => (
  <View style={styles.settingRow}>
    <View style={{ flex: 1, paddingRight: 12 }}>
      <Text style={styles.settingTitle}>{title}</Text>
      {desc ? <Text style={styles.settingDesc}>{desc}</Text> : null}
    </View>
    {right}
  </View>
);

/**
 * Pantalla principal de Configuración (SettingsScreen)
 *
 * Muestra el perfil del usuario, preferencias académicas, notificaciones,
 * opciones de seguridad, integraciones LMS, colaboración (grupos) y manejo
 * general de la cuenta. Toda la lógica de estado y peticiones a la API
 * se ha extraído al hook `useSettingsLogic`.
 */
export default function SettingsScreen() {
  const [academicExpanded, setAcademicExpanded] = useState(false);
  const [gradeScalesExpanded, setGradeScalesExpanded] = useState(false);
  const [backupExpanded, setBackupExpanded] = useState(false);
  const [languageExpanded, setLanguageExpanded] = useState(false);
  const [remindersExpanded, setRemindersExpanded] = useState(true);
  const [securityExpanded, setSecurityExpanded] = useState(false);
  const [collaborationExpanded, setCollaborationExpanded] = useState(false);
  const [isZyrenInfoVisible, setIsZyrenInfoVisible] = useState(false);
  const [isActiveRemindersVisible, setIsActiveRemindersVisible] = useState(false);
  const [isPersonalizeRemindersVisible, setIsPersonalizeRemindersVisible] = useState(false);
  const {
    t,
    router,
    profile,
    profileName,
    profileEmail,
    profileAvatarUri,
    threshold,
    setThreshold,
    gradingSystems,
    selectedSystemId,
    setSelectedSystemId,
    isLoadingSystems,
    biometric,
    calendarSync,
    setCalendarSync,
    userGroups,
    TERMS,
    activeTermIndex,
    setActiveTermIndex,
    isEditProfileVisible,
    setIsEditProfileVisible,
    editName,
    setEditName,
    editLastname,
    setEditLastname,
    editUsername,
    setEditUsername,
    editUniversity,
    setEditUniversity,
    editMajor,
    setEditMajor,
    editSemester,
    setEditSemester,
    editStudyGoal,
    setEditStudyGoal,
    editPin,
    setEditPin,
    editProfileImage,
    isUploadingPhoto,
    handlePickProfilePhoto,
    handleRemoveProfilePhoto,
    isChangePasswordVisible,
    setIsChangePasswordVisible,
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    isDeleteAccountVisible,
    deleteStep,
    setDeleteStep,
    deletePassword,
    setDeletePassword,
    deleteConfirmText,
    setDeleteConfirmText,
    deletionDataCount,
    isLoadingDeletion,
    pinToJoin,
    setPinToJoin,
    isJoiningGroup,
    isCreateGroupVisible, setIsCreateGroupVisible,
    isCreatingGroup,
    handleCreateGroup,
    handleSignOut,
    handleToggleBiometric,
    handleDeleteAccount,
    handleOpenEditProfile,
    handleSaveProfile,
    handleSaveSettings,
    handleSavePassword,
    handleDeletePasswordVerify,
    handleConfirmDeletion,
    handleCloseDeleteModal,
    handleJoinGroup,
    handleLeaveGroup,
    appLanguage,
    handleChangeLanguage,
    isAddTermVisible, setIsAddTermVisible,
    isManageOverridesVisible, setIsManageOverridesVisible,
    isAddCustomScaleVisible, setIsAddCustomScaleVisible,
    isTwoFactorVisible, setIsTwoFactorVisible,
    isAddLmsVisible, setIsAddLmsVisible,
    isExportDataVisible, setIsExportDataVisible,
    isFaqVisible, setIsFaqVisible,
    isFeedbackVisible, setIsFeedbackVisible,
    handleAddTerm,
    handleSaveOverrides,
    handleAddCustomScale,
    handleTwoFactorEnable,
    handleTwoFactorDisable,
    handleAddLms,
    handleRemoveLms,
    handleExportCsv,
    handleExportPdf,
    handleSendFeedback,
    subjects,
    lmsAccounts,
    twoFactorEnabled,
  } = useSettingsLogic();

  const reminderCtx = useReminderSettings();

  const {
    prefs: backupPrefs,
    updatePref: updateBackupPref,
    stats: backupStats,
    cloudItemsCount,
    isUploading,
    handleBackupNow,
    isDownloading,
    handleDownloadNow,
    isBackupRunning,
    pendingCount,
    totalCount,
    backedCount,
    scheduledConfig,
    handleToggleScheduled,
    handleSaveScheduledTime,
    handleSetScheduledType,
  } = useBackupLogic();

  const [showScheduledTimePicker, setShowScheduledTimePicker] = useState(false);
  const scheduledTimeDate = new Date();
  scheduledTimeDate.setHours(scheduledConfig.hour, scheduledConfig.minute, 0, 0);
  const scheduledTimeLabel = `${String(scheduledConfig.hour).padStart(2, '0')}:${String(scheduledConfig.minute).padStart(2, '0')}`;

  return (
    <SafeAreaView style={globalStyles.safeArea}>
      {/* ── HEADER ── */}
      <View style={styles.header}>
        <View style={globalStyles.row}>
          <Ionicons name="school" size={20} color={theme.colors.primary} style={{ marginRight: 6 }} />
          <Text style={styles.logoText}>Threshold</Text>
        </View>
        <View style={globalStyles.row}>
          <OfflineIndicator />
          <TouchableOpacity style={styles.cancelBtn} onPress={() => router.replace('/(tabs)')}>
            <Text style={styles.cancelText}>{t('settings.cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSaveSettings}>
            <Text style={styles.saveBtnText}>{t('settings.save')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── PROFILE CARD ── */}
        <View style={styles.profileCard}>
          <Image
            source={{ uri: profileAvatarUri }}
            style={styles.profileAvatar}
          />
          <View style={{ flex: 1 }}>
            {/* Fila Superior: Nombre/Email y Botón Editar */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.profileName}>{profileName}</Text>
                <Text style={styles.profileEmail}>{profileEmail}</Text>
                {!!profile?.university && <Text style={styles.profileEmail}>{profile.university}</Text>}
              </View>
              <TouchableOpacity style={styles.editBtn} onPress={handleOpenEditProfile}>
                <Text style={styles.editBtnText}>{t('settings.edit')}</Text>
              </TouchableOpacity>
            </View>

            {/* Fila Inferior: PIN y Cambiar Contraseña (Alineados) */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
              {!!profile?.share_pin ? (
                <TouchableOpacity 
                  style={{ flexDirection: 'row', alignItems: 'center' }}
                  onPress={async () => {
                    await Clipboard.setStringAsync(profile.share_pin!);
                    alertRef.show({ title: t('common.success'), message: t('common.copiedToClipboard'), type: 'success' });
                  }}
                >
                  <MaterialCommunityIcons name="link-variant" size={14} color={theme.colors.primary} />
                  <Text style={[styles.profileEmail, { color: theme.colors.primary, marginLeft: 4, fontWeight: '600' }]}>
                    {t('settings.groupPin')} {profile.share_pin}
                  </Text>
                  <Ionicons name="copy-outline" size={12} color={theme.colors.primary} style={{ marginLeft: 6 }} />
                </TouchableOpacity>
              ) : <View />}

              <TouchableOpacity onPress={() => setIsChangePasswordVisible(true)}>
                <Text style={styles.changePwText}>{t('account.changePass')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ─────────────────────────────────────────── */}
        {/* ── ACADEMIC PREFERENCES ── */}
        {/* ─────────────────────────────────────────── */}
        <View style={styles.section}>
          <TouchableOpacity
            onPress={() => setAcademicExpanded(prev => !prev)}
            style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}
          >
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="settings-outline" size={18} color={theme.colors.text.secondary} />
                <Text style={styles.sectionTitle}>{t('academic.title')}</Text>
              </View>
              <Text style={styles.sectionDesc}>{t('academic.desc')}</Text>
              {!academicExpanded && (() => {
                const active = gradingSystems.find(s => s.id === selectedSystemId);
                return (
                  <View style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6, marginTop: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={[styles.settingDesc, { fontWeight: '600' }]}>{t('academic.minGrade')}:</Text>
                      <Text style={[styles.settingDesc, { color: theme.colors.primary, fontWeight: '700' }]}>{threshold}</Text>
                    </View>
                    {active && (
                      <View style={styles.activeBadge}>
                        <Text style={styles.activeBadgeText}>{active.is_custom ? active.name : t(active.name)}</Text>
                      </View>
                    )}
                  </View>
                );
              })()}
            </View>
            <Ionicons name={academicExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={theme.colors.text.secondary} style={{ marginTop: 2 }} />
          </TouchableOpacity>

          {academicExpanded && (
            <>
          {/* Terms / Semesters */}
          <Text style={[styles.subSectionTitle, { marginTop: 16 }]}>{t('academic.termsSemesters')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.termsRow}>
            {TERMS.map((term, index) => (
              <TouchableOpacity
                key={term}
                style={[styles.termChip, activeTermIndex === index && styles.termChipActive]}
                onPress={() => setActiveTermIndex(index)}
              >
                <Text style={[styles.termChipText, activeTermIndex === index && styles.termChipTextActive]}>{term}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.actionRow}>
            <View style={styles.actionRowTextWrap}>
              <Text style={styles.settingDesc}>{t('academic.manageTerms')}</Text>
            </View>
            <View style={styles.actionRowButtonWrap}>
              <TouchableOpacity style={styles.darkPill} onPress={() => setIsAddTermVisible(true)}>
                <Text style={styles.darkPillText}>{t('academic.addTerm')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Min Grade */}
          <Text style={styles.subSectionTitle}>{t('academic.minGrade')}</Text>
          <View style={styles.thresholdRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingDesc}>{t('academic.defaultThreshold')}</Text>
              <TextInput
                style={styles.thresholdInput}
                value={threshold}
                onChangeText={setThreshold}
                keyboardType="numeric"
                maxLength={3}
              />
            </View>
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              <Text style={styles.settingDesc}>{t('academic.perSubject')}</Text>
              <TouchableOpacity style={styles.outlinePill} onPress={() => setIsManageOverridesVisible(true)}>
                <Text style={styles.outlinePillText}>{t('academic.manageOverrides')}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={[styles.actionRow, { marginTop: 8 }]}>
            <View style={styles.actionRowTextWrap}>
              <Text style={styles.settingDesc}>{t('academic.resetThreshold')}</Text>
            </View>
            <View style={styles.actionRowButtonWrap}>
              <TouchableOpacity style={styles.darkPill} onPress={() => setThreshold('50')}>
                <Text style={styles.darkPillText}>{t('academic.resetTo50')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Grading Scales */}
          <TouchableOpacity
            onPress={() => setGradeScalesExpanded(prev => !prev)}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 4 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
              <Text style={styles.subSectionTitle}>{t('academic.gradingScales')}</Text>
              {!gradeScalesExpanded && (() => {
                const active = gradingSystems.find(s => s.id === selectedSystemId);
                return active ? (
                  <View style={[styles.activeBadge, { marginBottom: 0 }]}>
                    <Text style={styles.activeBadgeText}>{active.is_custom ? active.name : t(active.name)}</Text>
                  </View>
                ) : null;
              })()}
            </View>
            <Ionicons name={gradeScalesExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={theme.colors.text.secondary} />
          </TouchableOpacity>
          {gradeScalesExpanded && (
            <>
              {isLoadingSystems ? (
                <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 12 }} />
              ) : gradingSystems.map(system => (
                <View key={system.id} style={[styles.scaleRow, { flexWrap: 'wrap' }]}>
                  <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                    <Text style={styles.settingTitle}>{system.is_custom ? system.name : t(system.name)}</Text>
                    <Text style={styles.settingDesc}>{t('settings.approvalFormat', { min: system.min_value, max: system.max_value, passing: system.passing_value })}</Text>
                  </View>
                  {selectedSystemId === system.id ? (
                    <View style={styles.activeBadge}>
                      <Text style={styles.activeBadgeText}>{t('academic.active')}</Text>
                    </View>
                  ) : (
                    <TouchableOpacity onPress={() => {
                      setSelectedSystemId(system.id);
                      setThreshold(String(system.passing_value));
                    }}>
                      <Text style={styles.selectText}>{t('academic.select')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              <TouchableOpacity style={[styles.darkPill, { alignSelf: 'center', marginTop: 8 }]} onPress={() => setIsAddCustomScaleVisible(true)}>
                <Text style={styles.darkPillText}>{t('academic.addCustomScale')}</Text>
              </TouchableOpacity>
            </>
          )}
          </>
          )}
        </View>

        {/* ─────────────────────────────────────────── */}
        {/* ── LANGUAGE ── */}
        {/* ─────────────────────────────────────────── */}
        <View style={styles.section}>
          <TouchableOpacity
            onPress={() => setLanguageExpanded(prev => !prev)}
            style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}
          >
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="language-outline" size={18} color={theme.colors.text.secondary} />
                <Text style={styles.sectionTitle}>{t('settings.language')}</Text>
              </View>
              <Text style={styles.sectionDesc}>{t('settings.languageDesc')}</Text>
              {!languageExpanded && (
                <View style={[styles.activeBadge, { alignSelf: 'flex-start', marginTop: 6 }]}>
                  <Text style={styles.activeBadgeText}>
                    {appLanguage === 'es' ? t('settings.languageEs') : t('settings.languageEn')}
                  </Text>
                </View>
              )}
            </View>
            <Ionicons name={languageExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={theme.colors.text.secondary} style={{ marginTop: 2 }} />
          </TouchableOpacity>

          {languageExpanded && (
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
            {(['es', 'en'] as const).map((lang) => {
              const isActive = appLanguage === lang;
              return (
                <TouchableOpacity
                  key={lang}
                  style={[
                    styles.darkPill,
                    { flex: 1, justifyContent: 'center', paddingVertical: 10 },
                    isActive
                      ? { backgroundColor: theme.colors.primary }
                      : {
                          backgroundColor: 'transparent',
                          borderWidth: 1,
                          borderColor: theme.colors.border,
                        },
                  ]}
                  onPress={() => handleChangeLanguage(lang)}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.darkPillText,
                      !isActive && { color: theme.colors.text.primary },
                    ]}
                  >
                    {lang === 'es' ? t('settings.languageEs') : t('settings.languageEn')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          )}
        </View>

        {/* ─────────────────────────────────────────── */}
        {/* ── LOCAL AI ENGINE ── */}
        {/* ─────────────────────────────────────────── */}
        <LocalAIEngineSection />

        {/* ─────────────────────────────────────────── */}
        {/* ── RECORDATORIOS ── */}
        {/* ─────────────────────────────────────────── */}
        <View style={styles.section}>
          <TouchableOpacity
            onPress={() => setRemindersExpanded(prev => !prev)}
            style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}
          >
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="notifications" size={18} color={theme.colors.primary} />
                <Text style={styles.sectionTitle}>{t('notifications.title')}</Text>
              </View>
              <Text style={styles.sectionDesc}>{t('notifications.desc')}</Text>
            </View>
            <Ionicons name={remindersExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={theme.colors.text.secondary} style={{ marginTop: 2 }} />
          </TouchableOpacity>

          {remindersExpanded && (
            <>
              {!reminderCtx.health.permissionGranted && (
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF950015', padding: 12, borderRadius: 8, marginBottom: 12 }}>
                  <Ionicons name="warning" size={16} color="#FF9500" style={{ marginRight: 8 }} />
                  <Text style={{ flex: 1, fontSize: 12, color: '#FF9500' }}>
                    {t('reminders.healthNoPermission', 'Permisos de sistema desactivados')}
                  </Text>
                </View>
              )}

              <SettingRow
                title={t('reminders.globalProfile', 'Perfil de recordatorios')}
                desc={reminderCtx.getProfileLabelName(reminderCtx.globalProfile)}
                right={
                  <TouchableOpacity style={[styles.outlinePill, { minWidth: 90, justifyContent: 'center' }]} onPress={() => setIsPersonalizeRemindersVisible(true)}>
                    <Text style={[styles.outlinePillText, { textAlign: 'center' }]}>{t('common.manage', 'Gestionar')}</Text>
                  </TouchableOpacity>
                }
              />

              <SettingRow
                title={t('reminders.activeReminders', 'Recordatorios activos')}
                desc={t('reminders.activeCount', { count: reminderCtx.health.scheduledCount })}
                right={
                  <TouchableOpacity style={[styles.outlinePill, { minWidth: 90, justifyContent: 'center', flexDirection: 'row', alignItems: 'center', flexWrap: 'nowrap' }]} onPress={() => setIsActiveRemindersVisible(true)}>
                    <Ionicons name="eye-outline" size={14} color={theme.colors.text.secondary} style={{ marginRight: 4 }} />
                    <Text style={[styles.outlinePillText, { textAlign: 'center' }]} numberOfLines={1}>{t('common.view', 'Ver')}</Text>
                  </TouchableOpacity>
                }
              />
            </>
          )}
        </View>

        {/* ─────────────────────────────────────────── */}
        {/* ── PRODUCTIVIDAD ── */}
        {/* ─────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="timer-outline" size={18} color={theme.colors.text.secondary} />
                <Text style={styles.sectionTitle}>{t('productivity.title', 'Productividad')}</Text>
              </View>
              <Text style={styles.sectionDesc}>{t('productivity.desc', 'Resumen semanal y hábitos')}</Text>
            </View>
            <Ionicons name="chevron-down" size={18} color={theme.colors.text.secondary} style={{ marginTop: 2 }} />
          </View>
          <SettingRow
            title={t('notifications.weeklyDigest')}
            desc={t('productivity.weeklyDigestComingSoon', 'Disponible próximamente')}
            right={
              <View style={[styles.activeBadge, { opacity: 0.5 }]}>
                <Text style={[styles.activeBadgeText, { fontSize: 10 }]}>{t('common.comingSoon', 'Próximamente')}</Text>
              </View>
            }
          />
        </View>

        {/* ─────────────────────────────────────────── */}
        {/* ── BACKUP & SYNC ── */}
        {/* ─────────────────────────────────────────── */}
        <View style={styles.section}>
          <TouchableOpacity
            onPress={() => setBackupExpanded(prev => !prev)}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8 }}
          >
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="cloud-outline" size={18} color={theme.colors.text.secondary} />
                <Text style={styles.sectionTitle}>{t('backup.title')}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: backupPrefs.enabled ? '#34C759' : '#FF9500' }} />
                <Text style={styles.sectionDesc}>
                  {backupPrefs.enabled
                    ? t('backup.backupActive', 'Backup activado')
                    : t('backup.backupDisabled', 'Backup desactivado')}
                </Text>
                {backupPrefs.enabled && scheduledConfig.enabled && (
                  <View style={[styles.activeBadge, { paddingHorizontal: 6, paddingVertical: 2 }]}>
                    <Text style={[styles.activeBadgeText, { fontSize: 9 }]}>
                      {t('backup.autoBadge', 'Auto')}
                    </Text>
                  </View>
                )}
              </View>
            </View>
            <Ionicons name={backupExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={theme.colors.text.secondary} />
          </TouchableOpacity>

          {backupExpanded && (
            <>
          {/* ── Toggle principal ── */}
          <SettingRow
            title={t('backup.enableCloud')}
            desc={t('backup.enableCloudDesc')}
            right={
              <Switch
                value={backupPrefs.enabled}
                onValueChange={(v) => updateBackupPref('enabled', v)}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor={theme.colors.white}
              />
            }
          />

          {backupPrefs.enabled && (
            <>
              {/* ── Auto-upload toggle ── */}
              <SettingRow
                title={t('backup.autoUpload')}
                desc={t('backup.autoUploadDesc')}
                right={
                  <Switch
                    value={backupPrefs.autoUpload}
                    onValueChange={(v) => updateBackupPref('autoUpload', v)}
                    trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                    thumbColor={theme.colors.white}
                  />
                }
              />

              {/* ── Auto-download toggle ── */}
              <SettingRow
                title={t('backup.autoDownload')}
                desc={t('backup.autoDownloadDesc')}
                right={
                  <Switch
                    value={backupPrefs.autoDownload}
                    onValueChange={(v) => updateBackupPref('autoDownload', v)}
                    trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                    thumbColor={theme.colors.white}
                  />
                }
              />

              {/* ── Toggles por tipo ── */}
              <SettingRow
                title={t('backup.photos')}
                desc={t('backup.inCloud', { backed: backupStats.photos.backed, total: backupStats.photos.total })}
                right={
                  <Switch
                    value={backupPrefs.includePhotos}
                    onValueChange={(v) => updateBackupPref('includePhotos', v)}
                    trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                    thumbColor={theme.colors.white}
                  />
                }
              />
              <SettingRow
                title={t('backup.audio')}
                desc={t('backup.inCloud', { backed: backupStats.audio.backed, total: backupStats.audio.total })}
                right={
                  <Switch
                    value={backupPrefs.includeAudio}
                    onValueChange={(v) => updateBackupPref('includeAudio', v)}
                    trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                    thumbColor={theme.colors.white}
                  />
                }
              />
              <SettingRow
                title={t('backup.docs')}
                desc={t('backup.inCloud', { backed: backupStats.docs.backed, total: backupStats.docs.total })}
                right={
                  <Switch
                    value={backupPrefs.includeDocs}
                    onValueChange={(v) => updateBackupPref('includeDocs', v)}
                    trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                    thumbColor={theme.colors.white}
                  />
                }
              />
              <SettingRow
                title={t('backup.transcripts')}
                desc={t('backup.inCloud', { backed: backupStats.transcripts.backed, total: backupStats.transcripts.total })}
                right={
                  <Switch
                    value={backupPrefs.includeTranscripts}
                    onValueChange={(v) => updateBackupPref('includeTranscripts', v)}
                    trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                    thumbColor={theme.colors.white}
                  />
                }
              />
              <SettingRow
                title={t('backup.assessmentFiles', 'Soportes de Evaluaciones')}
                desc={t('backup.inCloud', { backed: backupStats.assessmentFiles?.backed || 0, total: backupStats.assessmentFiles?.total || 0 })}
                right={
                  <Switch
                    value={backupPrefs.includeAssessmentFiles}
                    onValueChange={(v) => updateBackupPref('includeAssessmentFiles', v)}
                    trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                    thumbColor={theme.colors.white}
                  />
                }
              />
              <SettingRow
                title={t('backup.flashcardDecks')}
                desc={t('backup.inCloud', { backed: backupStats.flashcardDecks.backed, total: backupStats.flashcardDecks.total })}
                right={<View />}
              />
              <SettingRow
                title={t('backup.aiChats')}
                desc={t('backup.inCloud', { backed: backupStats.aiChats.backed, total: backupStats.aiChats.total })}
                right={<View />}
              />

              {/* ── Estado general ── */}
              {totalCount > 0 && (
                <View style={{ paddingVertical: 12, marginTop: 8 }}>
                  <Text style={[styles.settingDesc, { fontWeight: '600', textAlign: 'center' }]}>
                    {t('backup.itemsBackedUp', { count: backedCount, total: totalCount })}
                    {pendingCount > 0 && t('backup.pendingCount', { count: pendingCount })}
                    {cloudItemsCount > 0 && t('backup.cloudCount', { count: cloudItemsCount })}
                  </Text>
                </View>
              )}

              {/* ── Botones de acción (Elegancia minimalista) ── */}
              <View style={styles.backupButtonContainer}>
                {/* Fila 1: Datos y Multimedia */}
                <TouchableOpacity
                  style={[styles.backupButton, styles.backupButtonOutline, isBackupRunning && { opacity: 0.6 }]}
                  onPress={() => handleBackupNow('datos')}
                  disabled={isBackupRunning}
                >
                  <Ionicons name="document-text-outline" size={16} color={theme.colors.text.primary} />
                  <Text style={styles.backupButtonText}>{t('backup.backupData', 'Datos')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.backupButton, styles.backupButtonOutline, isBackupRunning && { opacity: 0.6 }]}
                  onPress={() => handleBackupNow('multimedia')}
                  disabled={isBackupRunning}
                >
                  <Ionicons name="image-outline" size={16} color={theme.colors.text.primary} />
                  <Text style={styles.backupButtonText}>{t('backup.backupMedia', 'Multimedia')}</Text>
                </TouchableOpacity>

                {/* Fila 2: Respaldar Todo y Descargar */}
                <TouchableOpacity
                  style={[styles.backupButton, styles.backupButtonPrimary, isBackupRunning && { opacity: 0.6 }]}
                  onPress={() => handleBackupNow('ambos')}
                  disabled={isBackupRunning}
                >
                  {isUploading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="cloud-upload" size={16} color="#fff" />
                  )}
                  <Text style={styles.backupButtonTextLight}>{t('backup.backupAll', 'Respaldar')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.backupButton, styles.backupButtonSecondary, isBackupRunning && { opacity: 0.6 }]}
                  onPress={() => handleDownloadNow('ambos')}
                  disabled={isBackupRunning}
                >
                  {isDownloading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="cloud-download" size={16} color="#fff" />
                  )}
                  <Text style={styles.backupButtonTextLight}>{t('backup.downloadAll', 'Descargar Todo')}</Text>
                </TouchableOpacity>
              </View>

              {/* ── Backup Automático Programado ── */}
              <View style={styles.scheduledSection}>
                {/* Header row: título + switch */}
                <View style={[styles.settingRow, { borderBottomWidth: scheduledConfig.enabled ? 1 : 0 }]}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={styles.settingTitle}>{t('backup.scheduled', 'Backup Automático')}</Text>
                    <Text style={styles.settingDesc}>
                      {scheduledConfig.enabled
                        ? `${t('backup.scheduledAt', 'Programado a las')} ${scheduledTimeLabel} · ${scheduledConfig.type === 'datos' ? 'Datos' : scheduledConfig.type === 'multimedia' ? 'Multimedia' : 'Ambos'}`
                        : t('backup.scheduledDesc', 'Activa para respaldar automáticamente')}
                    </Text>
                  </View>
                  <Switch
                    value={scheduledConfig.enabled}
                    onValueChange={handleToggleScheduled}
                    trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                    thumbColor={theme.colors.white}
                  />
                </View>

                {scheduledConfig.enabled && (
                  <>
                    {/* Selector de hora — título y pill en la misma línea */}
                    <TouchableOpacity
                      onPress={() => setShowScheduledTimePicker(true)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingVertical: 10,
                        borderBottomWidth: 1,
                        borderBottomColor: theme.colors.border + '80',
                      }}
                    >
                      <Text style={styles.settingTitle}>{t('backup.scheduleTime', 'Hora del Backup')}</Text>
                      <View style={[styles.outlinePill, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                        <Ionicons name="time-outline" size={13} color={theme.colors.text.secondary} />
                        <Text style={styles.outlinePillText}>{scheduledTimeLabel}</Text>
                        <Ionicons name="chevron-forward" size={11} color={theme.colors.text.secondary} />
                      </View>
                    </TouchableOpacity>
                    {showScheduledTimePicker && (
                      <DateTimePicker
                        value={scheduledTimeDate}
                        mode="time"
                        is24Hour
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(_event: any, date?: Date) => {
                          setShowScheduledTimePicker(Platform.OS === 'ios');
                          if (date) handleSaveScheduledTime(date.getHours(), date.getMinutes());
                        }}
                      />
                    )}

                    {/* Selector de tipo — distribuido en ancho completo */}
                    <View style={{ paddingTop: 12 }}>
                      <Text style={[styles.settingTitle, { marginBottom: 4 }]}>{t('backup.backupType', 'Tipo de respaldo')}</Text>
                      <Text style={[styles.settingDesc, { marginBottom: 10 }]}>{t('backup.includedItems', 'Ítems a respaldar')}</Text>
                      <View style={styles.scheduledTypeRow}>
                        {(['datos', 'multimedia', 'ambos'] as const).map((opt) => {
                          const active = scheduledConfig.type === opt;
                          const labels = {
                            datos: t('backup.dataOnly', 'Datos'),
                            multimedia: t('backup.mediaOnly', 'Multimedia'),
                            ambos: t('backup.both', 'Ambos'),
                          };
                          const icons = {
                            datos: 'document-text-outline' as const,
                            multimedia: 'image-outline' as const,
                            ambos: 'cloud-upload' as const,
                          };
                          return (
                            <TouchableOpacity
                              key={opt}
                              onPress={() => handleSetScheduledType(opt)}
                              style={[
                                styles.scheduledTypeBtn,
                                {
                                  backgroundColor: active ? theme.colors.primary : 'transparent',
                                  borderColor: active ? theme.colors.primary : theme.colors.border,
                                },
                              ]}
                            >
                              <Ionicons
                                name={icons[opt]}
                                size={13}
                                color={active ? '#fff' : theme.colors.text.secondary}
                              />
                              <Text
                                style={[
                                  styles.outlinePillText,
                                  { fontWeight: active ? '700' : '500', color: active ? '#fff' : theme.colors.text.secondary },
                                ]}
                              >
                                {labels[opt]}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  </>
                )}
              </View>
            </>
          )}

          {!backupPrefs.enabled && (
            <Text style={[styles.settingDesc, { marginTop: 8, fontStyle: 'italic' }]}>
              {t('backup.disabled')}
            </Text>
          )}
          </>
          )}
        </View>

        {/* ─────────────────────────────────────────── */}
        {/* ── SECURITY & ACCOUNT ── */}
        {/* ─────────────────────────────────────────── */}
        <View style={styles.section}>
          <TouchableOpacity
            onPress={() => setSecurityExpanded(prev => !prev)}
            style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}
          >
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="shield-outline" size={18} color={theme.colors.text.secondary} />
                <Text style={styles.sectionTitle}>{t('account.securityTitle')}</Text>
              </View>
              <Text style={styles.sectionDesc}>{t('account.securityDesc')}</Text>
              {!securityExpanded && (
                <TouchableOpacity
                  style={[styles.darkPill, { backgroundColor: theme.colors.text.primary, alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 20 }]}
                  onPress={handleSignOut}
                >
                  <Ionicons name="log-out-outline" size={14} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={styles.darkPillText}>{t('account.signOutBtn')}</Text>
                </TouchableOpacity>
              )}
            </View>
            <Ionicons name={securityExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={theme.colors.text.secondary} style={{ marginTop: 2 }} />
          </TouchableOpacity>

          {securityExpanded && (
            <>
          <SettingRow
            title={t('account.biometric')} desc={t('account.biometricDesc')}
            right={<Switch value={biometric} onValueChange={handleToggleBiometric} trackColor={{ false: theme.colors.border, true: theme.colors.primary }} thumbColor={theme.colors.white} />}
          />
          <SettingRow
            title={t('account.twoFactor')} desc={t('account.twoFactorDesc')}
            right={<TouchableOpacity style={[styles.actionButton, styles.outlinePill]} onPress={() => setIsTwoFactorVisible(true)}><Text style={styles.outlinePillText}>{t('account.manage')}</Text></TouchableOpacity>}
          />
          <SettingRow
            title={t('account.signOut')} desc={t('account.signOutDesc')}
            right={
              <TouchableOpacity style={[styles.actionButton, styles.darkPill]} onPress={handleSignOut}>
                <Ionicons name="log-out-outline" size={14} color="#fff" style={{ marginRight: 4 }} />
                <Text style={styles.darkPillText}>{t('account.signOutBtn')}</Text>
              </TouchableOpacity>
            }
          />
          <SettingRow
            title={t('account.deleteAccount')} desc=""
            right={
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#FF2D55' }]}
                onPress={handleDeleteAccount}
              >
                <Text style={styles.darkPillText}>{t('account.deleteBtn')}</Text>
              </TouchableOpacity>
            }
          />
            </>
          )}
        </View>

        {/* ─────────────────────────────────────────── */}
        {/* ── INTEGRATIONS ── */}
        {/* ─────────────────────────────────────────── */}
        <View style={[styles.section, { opacity: 0.5 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="extension-puzzle-outline" size={18} color={theme.colors.text.secondary} />
                <Text style={[styles.sectionTitle, { color: theme.colors.text.secondary }]}>{t('integrations.title')}</Text>
              </View>
              <Text style={styles.sectionDesc}>{t('integrations.desc')}</Text>
            </View>
            <Ionicons name="chevron-down" size={18} color={theme.colors.text.secondary} style={{ marginTop: 2 }} />
          </View>
        </View>

        {/* ─────────────────────────────────────────── */}
        {/* ── COLLABORATION ── */}
        {/* ─────────────────────────────────────────── */}
        <View style={styles.section}>
          <TouchableOpacity
            onPress={() => setCollaborationExpanded(prev => !prev)}
            style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}
          >
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="people-outline" size={18} color={theme.colors.text.secondary} />
                <Text style={styles.sectionTitle}>{t('settings.collaboration')}</Text>
              </View>
              {!collaborationExpanded ? (
                <Text style={[styles.sectionDesc, { marginTop: 4 }]}>{t('settings.collaborationDesc')}</Text>
              ) : null}
            </View>
            <Ionicons name={collaborationExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={theme.colors.text.secondary} style={{ marginTop: 2 }} />
          </TouchableOpacity>
          {collaborationExpanded && (
            <>
          <Text style={styles.subSectionTitle}>{t('settings.joinGroup')}</Text>
          <View style={[styles.settingRow, { alignItems: 'center' }]}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <TextInput 
                style={[styles.modalInput, { marginBottom: 0, paddingVertical: 8 }]}
                placeholder={t('settings.pinPlaceholderJoin')}
                value={pinToJoin}
                onChangeText={setPinToJoin}
                autoCapitalize="characters"
                maxLength={6}
              />
            </View>
            <TouchableOpacity 
              style={[styles.darkPill, isJoiningGroup && { opacity: 0.6 }]}
              onPress={handleJoinGroup}
              disabled={isJoiningGroup}
            >
              <Text style={styles.darkPillText}>{isJoiningGroup ? t('settings.joining') : t('settings.joinBtn')}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={[styles.darkPill, { alignSelf: 'flex-start', marginTop: 12 }]} onPress={() => setIsCreateGroupVisible(true)}>
            <Ionicons name="add-circle-outline" size={16} color={theme.colors.text.inverse} style={{ marginRight: 4 }} />
            <Text style={styles.darkPillText}>{t('settings.createGroupBtn')}</Text>
          </TouchableOpacity>

          {userGroups.length > 0 && (
            <>
              <Text style={[styles.subSectionTitle, { marginTop: 16 }]}>{t('settings.myGroups')} ({userGroups.length})</Text>
              {userGroups.map((group, i) => (
                <View key={i} style={styles.lmsRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingTitle}>{group.name || group.group_pin_id}</Text>
                    <Text style={styles.settingDesc}>
                      {t('settings.groupPin')} {group.group_pin_id} • {t('settings.role')} {group.role} • {t('settings.joinedOn')} {new Date(group.joined_at!).toLocaleDateString()}
                    </Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.outlinePill}
                    onPress={() => handleLeaveGroup(group.group_pin_id)}
                  >
                    <Text style={styles.outlinePillText}>{t('settings.logout')}</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}
          </>
          )}
        </View>

        {/* ─────────────────────────────────────────── */}
        {/* ── DATA EXPORT & RESET ── */}
        {/* ─────────────────────────────────────────── */}
        <View style={[styles.section, { opacity: 0.5 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="document-text-outline" size={18} color={theme.colors.text.secondary} />
                <Text style={[styles.sectionTitle, { color: theme.colors.text.secondary }]}>{t('integrations.dataExport')}</Text>
              </View>
              <Text style={styles.sectionDesc}>{t('integrations.dataExportDesc')}</Text>
            </View>
            <Ionicons name="chevron-down" size={18} color={theme.colors.text.secondary} style={{ marginTop: 2 }} />
          </View>
        </View>

        {/* ─────────────────────────────────────────── */}
        {/* ── DEVELOPER CONSOLE ── */}
        {/* ─────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="code-slash" size={18} color="#C5A059" />
                <Text style={styles.sectionTitle}>Developer</Text>
              </View>
              <Text style={styles.sectionDesc}>Sync console, validator, asset pipeline, test harness</Text>
            </View>
          </View>
          <SettingRow
            title="Developer Console" desc="Sync, validator, assets, test harness, replay"
            right={
              <TouchableOpacity style={styles.darkPill} onPress={() => router.push('/developer')}>
                <Ionicons name="terminal-outline" size={14} color="#fff" style={{ marginRight: 4 }} />
                <Text style={styles.darkPillText}>Open</Text>
              </TouchableOpacity>
            }
          />
        </View>

        {/* ── ABOUT & HELP ── */}
        {/* ─────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.sectionTitle}>{t('about.helpTitle')}</Text>
              </View>
              <Text style={styles.sectionDesc}>{t('about.helpDesc')}</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/about')} style={{ padding: 4 }}>
              <Ionicons name="information-circle-outline" size={26} color="#C5A059" />
            </TouchableOpacity>
          </View>
          <SettingRow
            title={t('about.faq')} desc=""
            right={
              <TouchableOpacity style={styles.darkPill} onPress={() => setIsFaqVisible(true)}>
                <Text style={styles.darkPillText}>{t('about.open')}</Text>
              </TouchableOpacity>
            }
          />
          <SettingRow
            title={t('settings.zyrenAITitle')}
            desc={t('settings.zyrenAIDesc')}
            right={
              <TouchableOpacity style={styles.darkPill} onPress={() => setIsZyrenInfoVisible(true)}>
                <Ionicons name="sparkles" size={14} color="#fff" style={{ marginRight: 4 }} />
                <Text style={styles.darkPillText}>{t('common.info')}</Text>
              </TouchableOpacity>
            }
          />
          <SettingRow
            title={t('about.sendFeedback')} desc=""
            right={
              <TouchableOpacity style={styles.darkPill} onPress={() => setIsFeedbackVisible(true)}>
                <Text style={styles.darkPillText}>{t('about.send')}</Text>
              </TouchableOpacity>
            }
          />
          <View style={[styles.settingRow, { marginTop: 4 }]}>
            <Text style={styles.settingDesc}>{t('about.appVersion')}</Text>
            <Text style={styles.versionText}>{t('about.version')}</Text>
          </View>
        </View>

      </ScrollView>

      {/* ── MODALS ── */}
      <EditProfileModal
        visible={isEditProfileVisible}
        profile={profile}
        editName={editName}
        editLastname={editLastname}
        editUsername={editUsername}
        editUniversity={editUniversity}
        editMajor={editMajor}
        editSemester={editSemester}
        editStudyGoal={editStudyGoal}
        editPin={editPin}
        editProfileImage={editProfileImage}
        onNameChange={setEditName}
        onLastnameChange={setEditLastname}
        onUsernameChange={setEditUsername}
        onUniversityChange={setEditUniversity}
        onMajorChange={setEditMajor}
        onSemesterChange={setEditSemester}
        onStudyGoalChange={setEditStudyGoal}
        onPinChange={setEditPin}
        onPickPhoto={handlePickProfilePhoto}
        onRemovePhoto={handleRemoveProfilePhoto}
        onClose={() => setIsEditProfileVisible(false)}
        onSave={handleSaveProfile}
        isUploadingPhoto={isUploadingPhoto}
      />

      <ChangePasswordModal
        visible={isChangePasswordVisible}
        currentValue={currentPassword}
        newValue={newPassword}
        confirmValue={confirmPassword}
        onCurrentChange={setCurrentPassword}
        onNewChange={setNewPassword}
        onConfirmChange={setConfirmPassword}
        onClose={() => setIsChangePasswordVisible(false)}
        onSave={handleSavePassword}
      />

      <DeleteAccountModal
        visible={isDeleteAccountVisible}
        step={deleteStep}
        passwordValue={deletePassword}
        confirmTextValue={deleteConfirmText}
        expectedConfirmText={profile?.username || 'ELIMINAR'}
        deletionDataCount={deletionDataCount}
        isLoading={isLoadingDeletion}
        onPasswordChange={setDeletePassword}
        onConfirmTextChange={setDeleteConfirmText}
        onClose={handleCloseDeleteModal}
        onStepChange={setDeleteStep}
        onVerifyPassword={handleDeletePasswordVerify}
        onFinalConfirm={handleConfirmDeletion}
      />

      {/* ── NUEVOS MODALES ── */}
      <AddTermModal
        visible={isAddTermVisible}
        onClose={() => setIsAddTermVisible(false)}
        onSave={handleAddTerm}
      />

      <ManageOverridesModal
        visible={isManageOverridesVisible}
        onClose={() => setIsManageOverridesVisible(false)}
        subjects={subjects as any}
        defaultThreshold={threshold}
        onSave={handleSaveOverrides}
      />

      <AddCustomScaleModal
        visible={isAddCustomScaleVisible}
        onClose={() => setIsAddCustomScaleVisible(false)}
        onSave={handleAddCustomScale}
      />

      <TwoFactorModal
        visible={isTwoFactorVisible}
        onClose={() => setIsTwoFactorVisible(false)}
        onEnable={handleTwoFactorEnable}
        onDisable={handleTwoFactorDisable}
        isEnabled={twoFactorEnabled}
      />

      <AddLmsModal
        visible={isAddLmsVisible}
        onClose={() => setIsAddLmsVisible(false)}
        onSave={handleAddLms}
      />

      <ExportDataModal
        visible={isExportDataVisible}
        onClose={() => setIsExportDataVisible(false)}
        onExportCsv={handleExportCsv}
        onExportPdf={handleExportPdf}
      />

      <FaqModal
        visible={isFaqVisible}
        onClose={() => setIsFaqVisible(false)}
      />

      <SendFeedbackModal
        visible={isFeedbackVisible}
        onClose={() => setIsFeedbackVisible(false)}
        onSubmit={handleSendFeedback}
      />

      <CreateGroupModal
        visible={isCreateGroupVisible}
        isCreating={isCreatingGroup}
        onClose={() => setIsCreateGroupVisible(false)}
        onCreate={handleCreateGroup}
      />

      <ZyrenInfoModal
        visible={isZyrenInfoVisible}
        onClose={() => setIsZyrenInfoVisible(false)}
      />

      <ActiveRemindersModal
        visible={isActiveRemindersVisible}
        onClose={() => setIsActiveRemindersVisible(false)}
      />

      <PersonalizeRemindersModal
        visible={isPersonalizeRemindersVisible}
        onClose={() => setIsPersonalizeRemindersVisible(false)}
        reminderCtx={reminderCtx}
      />

    </SafeAreaView>
  );
}


