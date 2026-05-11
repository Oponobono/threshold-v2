import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, Image, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { globalStyles } from '../src/styles/globalStyles';
import { theme } from '../src/styles/theme';
import { settingsStyles as styles } from '../src/styles/Settings.styles';
import { alertRef } from '../src/components/CustomAlert';
import * as Clipboard from 'expo-clipboard';

import { useSettingsLogic } from '../src/hooks/useSettingsLogic';
import { EditProfileModal } from '../src/components/EditProfileModal';
import { ChangePasswordModal } from '../src/components/ChangePasswordModal';
import { DeleteAccountModal } from '../src/components/DeleteAccountModal';

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
export default function SettingsScreen() {
  const {
    t,
    router,
    profile,
    profileName,
    profileEmail,
    profileAvatarUri,
    threshold,
    setThreshold,
    activeScale,
    setActiveScale,
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
    SCALES,
    LMS_ACCOUNTS,
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
    handleSignOut,
    handleToggleBiometric,
    handleDeleteAccount,
    handleOpenEditProfile,
    handleSaveProfile,
    handleSavePassword,
    handleDeletePasswordVerify,
    handleConfirmDeletion,
    handleCloseDeleteModal,
    handleJoinGroup,
    handleLeaveGroup,
    appLanguage,
    handleChangeLanguage,
  } = useSettingsLogic();

  return (
    <SafeAreaView style={globalStyles.safeArea}>
      {/* ── HEADER ── */}
      <View style={styles.header}>
        <View style={globalStyles.row}>
          <Ionicons name="school" size={20} color={theme.colors.primary} style={{ marginRight: 6 }} />
          <Text style={styles.logoText}>Threshold</Text>
        </View>
        <View style={globalStyles.row}>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => router.replace('/(tabs)')}>
            <Text style={styles.cancelText}>{t('settings.cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveBtn}>
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
            <Text style={styles.profileName}>{profileName}</Text>
            <Text style={styles.profileEmail}>{profileEmail}</Text>
            {!!profile?.university && <Text style={styles.profileEmail}>{profile.university}</Text>}
            {!!profile?.share_pin && (
              <TouchableOpacity 
                style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}
                onPress={async () => {
                  await Clipboard.setStringAsync(profile.share_pin!);
                  alertRef.show({ title: t('common.success'), message: 'PIN copiado al portapapeles', type: 'success' });
                }}
              >
                <MaterialCommunityIcons name="link-variant" size={14} color={theme.colors.primary} />
                <Text style={[styles.profileEmail, { color: theme.colors.primary, marginLeft: 4, fontWeight: '600' }]}>
                  PIN: {profile.share_pin}
                </Text>
                <Ionicons name="copy-outline" size={12} color={theme.colors.primary} style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            )}
          </View>
          <View style={{ gap: 6, alignItems: 'flex-end' }}>
            <TouchableOpacity style={styles.editBtn} onPress={handleOpenEditProfile}>
              <Text style={styles.editBtnText}>{t('settings.edit')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setIsChangePasswordVisible(true)}>
              <Text style={styles.changePwText}>{t('settings.changePass')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ─────────────────────────────────────────── */}
        {/* ── ACADEMIC PREFERENCES ── */}
        {/* ─────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader title={t('settings.academicPrefs')} desc={t('settings.academicPrefsDesc')} icon="settings-outline" />

          {/* Terms / Semesters */}
          <Text style={styles.subSectionTitle}>{t('settings.termsSemesters')}</Text>
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
              <Text style={styles.settingDesc}>{t('settings.manageTerms')}</Text>
            </View>
            <View style={styles.actionRowButtonWrap}>
              <TouchableOpacity style={styles.darkPill}>
                <Text style={styles.darkPillText}>{t('settings.addTerm')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Min Grade */}
          <Text style={styles.subSectionTitle}>{t('settings.minGrade')}</Text>
          <View style={styles.thresholdRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingDesc}>{t('settings.defaultThreshold')}</Text>
              <TextInput
                style={styles.thresholdInput}
                value={threshold}
                onChangeText={setThreshold}
                keyboardType="numeric"
                maxLength={3}
              />
            </View>
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              <Text style={styles.settingDesc}>{t('settings.perSubject')}</Text>
              <TouchableOpacity style={styles.outlinePill}>
                <Text style={styles.outlinePillText}>{t('settings.manageOverrides')}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={[styles.actionRow, { marginTop: 8 }]}>
            <View style={styles.actionRowTextWrap}>
              <Text style={styles.settingDesc}>{t('settings.resetThreshold')}</Text>
            </View>
            <View style={styles.actionRowButtonWrap}>
              <TouchableOpacity style={styles.darkPill} onPress={() => setThreshold('50')}>
                <Text style={styles.darkPillText}>{t('settings.resetTo50')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Grading Scales */}
          <Text style={styles.subSectionTitle}>{t('settings.gradingScales')}</Text>
          {SCALES.map(scale => (
            <View key={scale.key} style={styles.scaleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingTitle}>{scale.label}</Text>
                <Text style={styles.settingDesc}>{scale.desc}</Text>
              </View>
              {activeScale === scale.key ? (
                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeText}>{t('settings.active')}</Text>
                </View>
              ) : (
                <TouchableOpacity onPress={() => setActiveScale(scale.key)}>
                  <Text style={styles.selectText}>{t('settings.select')}</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
          <TouchableOpacity style={[styles.darkPill, { alignSelf: 'center', marginTop: 8 }]}>
            <Text style={styles.darkPillText}>{t('settings.addCustomScale')}</Text>
          </TouchableOpacity>
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
        {/* ── NOTIFICATIONS ── */}
        {/* ─────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader title={t('settings.notifications')} desc={t('settings.notifDesc')} icon="notifications-outline" />
          <SettingRow
            title={t('settings.deadlineAlerts')} desc={t('settings.deadlineAlertsDesc')}
            right={<Switch value={notifDeadline} onValueChange={setNotifDeadline} trackColor={{ false: theme.colors.border, true: theme.colors.primary }} thumbColor={theme.colors.white} />}
          />
          <SettingRow
            title={t('settings.weeklyDigest')} desc={t('settings.weeklyDigestDesc')}
            right={<Switch value={notifWeekly} onValueChange={setNotifWeekly} trackColor={{ false: theme.colors.border, true: theme.colors.primary }} thumbColor={theme.colors.white} />}
          />
          <SettingRow
            title={t('settings.emailNotif')} desc={t('settings.emailNotifDesc')}
            right={<Switch value={notifEmail} onValueChange={setNotifEmail} trackColor={{ false: theme.colors.border, true: theme.colors.primary }} thumbColor={theme.colors.white} />}
          />
        </View>

        {/* ─────────────────────────────────────────── */}
        {/* ── BACKUP & SYNC ── */}
        {/* ─────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader title={t('settings.backupSync')} desc={t('settings.backupSyncDesc')} icon="cloud-outline" />
          <Text style={styles.settingTitle}>{t('settings.cloudAccount')}</Text>
          <Text style={[styles.settingDesc, { color: theme.colors.primary }]}>
            {t('settings.connectedTo')} ({t('settings.backupEmail')})
          </Text>
          <View style={[styles.actionRow, { marginTop: 8 }]}>
            <View style={styles.actionRowTextWrap}>
              <Text style={styles.settingDesc}>{t('settings.lastBackup')}  {t('settings.lastBackupSample')}</Text>
            </View>
            <View style={styles.actionRowButtonWrap}>
              <TouchableOpacity style={styles.darkPill}>
                <Ionicons name="sync-outline" size={14} color="#fff" style={{ marginRight: 4 }} />
                <Text style={styles.darkPillText}>{t('settings.syncNow')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ─────────────────────────────────────────── */}
        {/* ── SECURITY & ACCOUNT ── */}
        {/* ─────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader title={t('settings.security')} desc={t('settings.securityDesc')} icon="shield-outline" />
          <SettingRow
            title={t('settings.biometric')} desc={t('settings.biometricDesc')}
            right={<Switch value={biometric} onValueChange={handleToggleBiometric} trackColor={{ false: theme.colors.border, true: theme.colors.primary }} thumbColor={theme.colors.white} />}
          />
          <SettingRow
            title={t('settings.twoFactor')} desc={t('settings.twoFactorDesc')}
            right={<TouchableOpacity style={[styles.actionButton, styles.outlinePill]}><Text style={styles.outlinePillText}>{t('settings.manage')}</Text></TouchableOpacity>}
          />
          <SettingRow
            title={t('settings.signOut')} desc={t('settings.signOutDesc')}
            right={
              <TouchableOpacity style={[styles.actionButton, styles.outlinePill]} onPress={handleSignOut}>
                <Text style={styles.outlinePillText}>{t('settings.signOutBtn')}</Text>
              </TouchableOpacity>
            }
          />
          <SettingRow
            title={t('settings.deleteAccount')} desc=""
            right={
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#FF2D55' }]}
                onPress={handleDeleteAccount}
              >
                <Text style={styles.darkPillText}>{t('settings.deleteBtn')}</Text>
              </TouchableOpacity>
            }
          />
        </View>

        {/* ─────────────────────────────────────────── */}
        {/* ── INTEGRATIONS ── */}
        {/* ─────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader title={t('settings.integrations')} desc={t('settings.integrationsDesc')} icon="extension-puzzle-outline" />
          <SettingRow
            title={t('settings.calendarSync')} desc={t('settings.calendarSyncDesc')}
            right={<Switch value={calendarSync} onValueChange={setCalendarSync} trackColor={{ false: theme.colors.border, true: theme.colors.primary }} thumbColor={theme.colors.white} />}
          />
          <Text style={styles.subSectionTitle}>{t('settings.linkedLms')}</Text>
          {LMS_ACCOUNTS.map((lms, i) => (
            <View key={i} style={styles.lmsRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingTitle}>{lms.name}</Text>
                <Text style={styles.settingDesc}>{t('settings.connectedAs', { user: lms.user })}</Text>
              </View>
              <TouchableOpacity style={styles.outlinePill}>
                <Text style={styles.outlinePillText}>{t('settings.remove')}</Text>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={[styles.darkPill, { alignSelf: 'flex-end', marginTop: 8 }]}>
            <Text style={styles.darkPillText}>{t('settings.addLms')}</Text>
          </TouchableOpacity>
        </View>

        {/* ─────────────────────────────────────────── */}
        {/* ── COLLABORATION ── */}
        {/* ─────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader title={t('settings.collaboration')} desc={t('settings.collaborationDesc', 'Conecta con tus compañeros y comparte mazos')} icon="people-outline" />
          
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
              <Text style={styles.darkPillText}>{isJoiningGroup ? t('settings.joining', 'Uniendo...') : t('settings.joinBtn', 'Unirse')}</Text>
            </TouchableOpacity>
          </View>

          {userGroups.length > 0 && (
            <>
              <Text style={[styles.subSectionTitle, { marginTop: 16 }]}>{t('settings.myGroups', 'Mis grupos')} ({userGroups.length})</Text>
              {userGroups.map((group, i) => (
                <View key={i} style={styles.lmsRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingTitle}>{t('settings.groupPin', 'Grupo PIN:')} {group.group_pin_id}</Text>
                    <Text style={styles.settingDesc}>{t('settings.role', 'Rol:')} {group.role} • {t('settings.joinedOn', 'Unido el')} {new Date(group.joined_at!).toLocaleDateString()}</Text>
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
          <SectionHeader title={t('settings.dataExport')} desc={t('settings.dataExportDesc')} icon="document-text-outline" />
          <View style={styles.exportRow}>
            <TouchableOpacity style={[styles.exportBtn, { flex: 1 }]}>
              <Text style={styles.exportBtnText}>{t('settings.exportCsv')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.exportBtn, styles.exportBtnOutline, { flex: 1 }]}>
              <Text style={styles.exportBtnOutlineText}>{t('settings.exportPdf')}</Text>
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
              onPress={() => alertRef.show({ title: t('settings.resetAll'), message: t('settings.resetDesc'), type: 'confirm' })}
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
            title={t('settings.aboutHelp')} 
            desc={t('settings.aboutHelpDesc')} 
            icon="information-circle-outline" 
            onIconPress={() => router.push('/about')}
            iconColor="#C5A059"
            iconSize={26}
          />
          <SettingRow
            title={t('settings.faq')} desc=""
            right={<TouchableOpacity><Text style={styles.openText}>{t('settings.open')}</Text></TouchableOpacity>}
          />
          <SettingRow
            title={t('settings.sendFeedback')} desc=""
            right={<TouchableOpacity style={styles.darkPill}><Text style={styles.darkPillText}>{t('settings.send')}</Text></TouchableOpacity>}
          />
          <View style={[styles.settingRow, { marginTop: 4 }]}>
            <Text style={styles.settingDesc}>{t('settings.appVersion')}</Text>
            <Text style={styles.versionText}>{t('settings.version')}</Text>
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
        onNameChange={setEditName}
        onLastnameChange={setEditLastname}
        onUsernameChange={setEditUsername}
        onUniversityChange={setEditUniversity}
        onMajorChange={setEditMajor}
        onSemesterChange={setEditSemester}
        onStudyGoalChange={setEditStudyGoal}
        onPinChange={setEditPin}
        onClose={() => setIsEditProfileVisible(false)}
        onSave={handleSaveProfile}
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

    </SafeAreaView>
  );
}


