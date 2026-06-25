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
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useSettingsLogic } from '../src/hooks/useSettingsLogic';
import { useBackupLogic } from '../src/hooks/useBackupLogic';
import { EditProfileModal } from '../src/components/modals/EditProfileModal';
import { ChangePasswordModal } from '../src/components/modals/ChangePasswordModal';
import { DeleteAccountModal } from '../src/components/modals/DeleteAccountModal';
import { WeeklySummaryPicker } from '../src/components/settings/WeeklySummaryPicker';
import { LocalAIEngineSection } from '../src/components/settings/LocalAIEngineSection';
import { OfflineIndicator } from '../src/components/ui/OfflineIndicator';
import type { WeeklyDigestConfig } from '../src/services/notificationService';
import { cancelAllDeadlineNotifications, cancelWeeklyDigest, scheduleWeeklyDigest } from '../src/services/notificationService';
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
} from '../src/components/settings';

/**
 * Componente auxiliar para renderizar la cabecera de cada sección de configuración.
 * Muestra un título principal, una descripción y un ícono representativo.
 *
 * @param {string} title - El título de la sección.
 * @param {string} desc - Una breve descripción de lo que contiene la sección.
 * @param {string} icon - Nombre del ícono de Ionicons a mostrar.
 * @param {Function} [onIconPress] - Función opcional al presionar el ícono.
 * @param {string} [iconColor] - Color opcional para sobrescribir el color por defecto del ícono.
 * @param {number} [iconSize] - Tamaño opcional para el ícono.
 */
const SectionHeader = ({ title, desc, icon, onIconPress, iconColor, iconSize }: { title: string; desc: string; icon: string; onIconPress?: () => void; iconColor?: string; iconSize?: number }) => (
  <View style={styles.sectionHeader}>
    <View style={{ flex: 1 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionDesc}>{desc}</Text>
    </View>
    {onIconPress ? (
      <TouchableOpacity onPress={onIconPress} style={{ padding: 4 }}>
        <Ionicons name={icon as any} size={iconSize || 18} color={iconColor || theme.colors.text.secondary} />
      </TouchableOpacity>
    ) : (
      <Ionicons name={icon as any} size={iconSize || 18} color={iconColor || theme.colors.text.secondary} />
    )}
  </View>
);

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
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

export default function SettingsScreen() {
  const [scalesExpanded, setScalesExpanded] = useState(true);
  const [showWeeklyPicker, setShowWeeklyPicker] = useState(false);
  const [weeklyConfig, setWeeklyConfig] = useState<WeeklyDigestConfig | null>(null);
  const [isZyrenInfoVisible, setIsZyrenInfoVisible] = useState(false);
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
    notifDeadline,
    setNotifDeadline,
    notifWeekly,
    setNotifWeekly,
    notifEmail,
    setNotifEmail,
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
          <SectionHeader title={t('academic.title')} desc={t('academic.desc')} icon="settings-outline" />

          {/* Terms / Semesters */}
          <Text style={styles.subSectionTitle}>{t('academic.termsSemesters')}</Text>
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
            onPress={() => setScalesExpanded(prev => !prev)}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}
          >
            <Text style={styles.subSectionTitle}>{t('academic.gradingScales')}</Text>
            <Ionicons name={scalesExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={theme.colors.text.secondary} />
          </TouchableOpacity>
          {scalesExpanded && (
            <>
          {isLoadingSystems ? (
            <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 12 }} />
          ) : gradingSystems.map(system => (
            <View key={system.id} style={styles.scaleRow}>
              <View style={{ flex: 1 }}>
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
        </View>

        {/* ─────────────────────────────────────────── */}
        {/* ── LANGUAGE ── */}
        {/* ─────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader
            title={t('settings.language')}
            desc={t('settings.languageDesc')}
            icon="language-outline"
          />
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
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
        </View>

        {/* ─────────────────────────────────────────── */}
        {/* ── LOCAL AI ENGINE ── */}
        {/* ─────────────────────────────────────────── */}
        <LocalAIEngineSection />

        {/* ─────────────────────────────────────────── */}
        {/* ── NOTIFICATIONS ── */}
        {/* ─────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader title={t('notifications.title')} desc={t('notifications.desc')} icon="notifications-outline" />
          <SettingRow
            title={t('notifications.deadlineAlerts')} desc={t('notifications.deadlineAlertsDesc')}
            right={<Switch value={notifDeadline} onValueChange={(v) => { setNotifDeadline(v); AsyncStorage.setItem('notif_deadline', String(v)); if (!v) cancelAllDeadlineNotifications(); alertRef.show({ title: v ? t('settings.notifDeadlineEnabled') : t('settings.notifDeadlineDisabled'), message: v ? t('settings.notifDeadlineEnabledMsg') : t('settings.notifDeadlineDisabledMsg'), type: v ? 'success' : 'info', buttons: [{ text: t('common.ok') }] }); }} trackColor={{ false: theme.colors.border, true: theme.colors.primary }} thumbColor={theme.colors.white} />}
          />
          <SettingRow
            title={t('notifications.weeklyDigest')}
            desc={weeklyConfig
              ? t('notifications.weeklyDigestDescFmt', {
                  day: t(`notifications.day.${DAYS[weeklyConfig.dayOfWeek]}`),
                  time: `${weeklyConfig.hour.toString().padStart(2, '0')}:${weeklyConfig.minute.toString().padStart(2, '0')}`,
                })
              : t('notifications.weeklyDigestDesc')}
            right={<Switch value={notifWeekly} onValueChange={(v) => { if (v) setShowWeeklyPicker(true); else { setNotifWeekly(false); AsyncStorage.setItem('notif_weekly', 'false'); cancelWeeklyDigest(); alertRef.show({ title: t('settings.notifWeeklyDisabled'), message: t('settings.notifWeeklyDisabledMsg'), type: 'info', buttons: [{ text: t('common.ok') }] }); } }} trackColor={{ false: theme.colors.border, true: theme.colors.primary }} thumbColor={theme.colors.white} />}
          />
          <SettingRow
            title={t('notifications.emailNotif')} desc={t('notifications.emailNotifDesc')}
            right={<Switch value={notifEmail} onValueChange={(v) => { setNotifEmail(v); alertRef.show({ title: v ? t('settings.notifEmailEnabled') : t('settings.notifEmailDisabled'), message: v ? t('settings.notifEmailEnabledMsg') : t('settings.notifEmailDisabledMsg'), type: v ? 'success' : 'info', buttons: [{ text: t('common.ok') }] }); }} trackColor={{ false: theme.colors.border, true: theme.colors.primary }} thumbColor={theme.colors.white} />}
          />
        </View>

        {/* ─────────────────────────────────────────── */}
        {/* ── BACKUP & SYNC ── */}
        {/* ─────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader title={t('backup.title')} desc={t('backup.desc')} icon="cloud-outline" />

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
        </View>

        {/* ─────────────────────────────────────────── */}
        {/* ── SECURITY & ACCOUNT ── */}
        {/* ─────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader title={t('account.securityTitle')} desc={t('account.securityDesc')} icon="shield-outline" />
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
              <TouchableOpacity style={[styles.actionButton, styles.outlinePill]} onPress={handleSignOut}>
                <Text style={styles.outlinePillText}>{t('account.signOutBtn')}</Text>
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
        </View>

        {/* ─────────────────────────────────────────── */}
        {/* ── INTEGRATIONS ── */}
        {/* ─────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader title={t('integrations.title')} desc={t('integrations.desc')} icon="extension-puzzle-outline" />
          <SettingRow
            title={t('integrations.calendarSync')} desc={t('integrations.calendarSyncDesc')}
            right={<Switch value={calendarSync} onValueChange={setCalendarSync} trackColor={{ false: theme.colors.border, true: theme.colors.primary }} thumbColor={theme.colors.white} />}
          />
          <Text style={styles.subSectionTitle}>{t('integrations.linkedLms')}</Text>
          {lmsAccounts.length === 0 && (
            <Text style={[styles.settingDesc, { fontStyle: 'italic', marginBottom: 8 }]}>
              {t('integrations.noAccounts')}
            </Text>
          )}
          {lmsAccounts.map((lms, i) => (
            <View key={lms.id || i} style={styles.lmsRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingTitle}>{lms.platform}</Text>
                <Text style={styles.settingDesc}>{t('account.connectedAs', { user: lms.username })}</Text>
              </View>
              <TouchableOpacity
                style={styles.outlinePill}
                onPress={() => {
                  const name = lms.platform;
                  alertRef.show({
                    title: t('integrations.remove'),
                    message: t('settings.unlinkConfirm', { name }),
                    type: 'confirm',
                    buttons: [
                      { text: t('common.cancel'), style: 'cancel' },
                      { text: t('integrations.remove'), style: 'destructive', onPress: () => handleRemoveLms(i) },
                    ]
                  });
                }}
              >
                <Text style={styles.outlinePillText}>{t('integrations.remove')}</Text>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={[styles.darkPill, { alignSelf: 'flex-end', marginTop: 8 }]} onPress={() => setIsAddLmsVisible(true)}>
            <Text style={styles.darkPillText}>{t('integrations.addLms')}</Text>
          </TouchableOpacity>
        </View>

        {/* ─────────────────────────────────────────── */}
        {/* ── COLLABORATION ── */}
        {/* ─────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader title={t('settings.collaboration')} desc={t('settings.collaborationDesc')} icon="people-outline" />
          
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
        </View>

        {/* ─────────────────────────────────────────── */}
        {/* ── DATA EXPORT & RESET ── */}
        {/* ─────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader title={t('integrations.dataExport')} desc={t('integrations.dataExportDesc')} icon="document-text-outline" />
          <View style={styles.exportRow}>
            <TouchableOpacity style={[styles.exportBtn, { flex: 1 }]} onPress={() => setIsExportDataVisible(true)}>
              <Text style={styles.exportBtnText}>{t('integrations.exportCsv')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.exportBtn, styles.exportBtnOutline, { flex: 1 }]} onPress={() => setIsExportDataVisible(true)}>
              <Text style={styles.exportBtnOutlineText}>{t('integrations.exportPdf')}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.subSectionTitle}>{t('settings.resetOptions')}</Text>
          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingTitle}>{t('settings.resetAll')}</Text>
              <Text style={styles.settingDesc}>{t('settings.resetDesc')}</Text>
            </View>
            <TouchableOpacity
              style={[styles.darkPill, { backgroundColor: '#FF2D55', marginLeft: 12 }]}
              onPress={() => alertRef.show({
                title: t('settings.resetAll'),
                message: t('settings.resetDesc'),
                type: 'confirm',
                buttons: [
                  { text: t('common.cancel'), style: 'cancel' },
                  { text: t('settings.reset'), style: 'destructive', onPress: async () => {
                    alertRef.show({ title: t('common.success'), message: t('settings.dataResetComplete'), type: 'success' });
                  }},
                ]
              })}
            >
              <Text style={styles.darkPillText}>{t('settings.reset')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ─────────────────────────────────────────── */}
        {/* ── ABOUT & HELP ── */}
        {/* ─────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader 
            title={t('about.helpTitle')} 
            desc={t('about.helpDesc')} 
            icon="information-circle-outline" 
            onIconPress={() => router.push('/about')}
            iconColor="#C5A059"
            iconSize={26}
          />
          <SettingRow
            title={t('about.faq')} desc=""
            right={<TouchableOpacity onPress={() => setIsFaqVisible(true)}><Text style={styles.openText}>{t('about.open')}</Text></TouchableOpacity>}
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
            right={<TouchableOpacity style={styles.darkPill} onPress={() => setIsFeedbackVisible(true)}><Text style={styles.darkPillText}>{t('about.send')}</Text></TouchableOpacity>}
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

      <WeeklySummaryPicker
        visible={showWeeklyPicker}
        initialConfig={weeklyConfig ?? undefined}
        onSave={(config) => {
          setWeeklyConfig(config);
          setNotifWeekly(true);
          AsyncStorage.setItem('notif_weekly', 'true');
          AsyncStorage.setItem('weekly_config', JSON.stringify(config));
          scheduleWeeklyDigest(config);
        }}
        onClose={() => setShowWeeklyPicker(false)}
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

    </SafeAreaView>
  );
}


