import { useState, useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { setItemAsync, getItemAsync } from 'expo-secure-store';
import { alertRef } from '../components/CustomAlert';
import { fetchGradingSystems, type GradingSystem } from '../services/api/grading';
import {
  getCurrentUserProfile,
  signOut,
  type UserProfile,
  updateUserProfile,
  updateUserPassword,
  removeBiometricToken,
  enrollBiometric,
  requestAccountDeletion,
  getDeletionDataCount,
  joinGroup,
  getUserGroups,
  leaveGroup,
  type GroupMembership
} from '../services/api';
import {
  enrollBiometricToken,
  revokeBiometricToken,
  hasBiometricTokenStored
} from '../services/biometricService';

/**
 * Claves para los tipos de escalas de calificación disponibles.
 */
type ScaleKey = 'af' | 'pct' | 'scale4' | 'custom';

/**
 * Hook centralizado que maneja toda la lógica de estado y negocio
 * de la pantalla de configuración de Threshold.
 * Incluye gestión de perfil, biometría, eliminación de cuenta, y grupos.
 *
 * @returns Un objeto con todos los estados y manejadores necesarios para `SettingsScreen`.
 */
export const useSettingsLogic = () => {
  const { t, i18n } = useTranslation();
  const router = useRouter();

  // Profile & Preferences State
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [threshold, setThreshold] = useState('50');
  
  // Dynamic Grading Systems State
  const [gradingSystems, setGradingSystems] = useState<GradingSystem[]>([]);
  const [selectedSystemId, setSelectedSystemId] = useState<number | null>(null);
  const [isLoadingSystems, setIsLoadingSystems] = useState(true);
  const [notifDeadline, setNotifDeadline] = useState(false);
  const [notifWeekly, setNotifWeekly] = useState(false);
  const [notifEmail, setNotifEmail] = useState(false);
  const [biometric, setBiometric] = useState(false);
  const [calendarSync, setCalendarSync] = useState(false);
  const [userGroups, setUserGroups] = useState<GroupMembership[]>([]);
  const [appLanguage, setAppLanguage] = useState<string>(i18n.language);

  // Modals Visibility
  const [isEditProfileVisible, setIsEditProfileVisible] = useState(false);
  const [isChangePasswordVisible, setIsChangePasswordVisible] = useState(false);
  const [isDeleteAccountVisible, setIsDeleteAccountVisible] = useState(false);

  // Edit Profile State
  const [editName, setEditName] = useState('');
  const [editLastname, setEditLastname] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editUniversity, setEditUniversity] = useState('');
  const [editMajor, setEditMajor] = useState('');
  const [editSemester, setEditSemester] = useState('');
  const [editStudyGoal, setEditStudyGoal] = useState('');
  const [editPin, setEditPin] = useState('');

  // Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Deletion State
  const [deleteStep, setDeleteStep] = useState<'confirm' | 'password' | 'data' | 'final'>('confirm');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletionDataCount, setDeletionDataCount] = useState<any>(null);
  const [isLoadingDeletion, setIsLoadingDeletion] = useState(false);

  // Group State
  const [pinToJoin, setPinToJoin] = useState('');
  const [isJoiningGroup, setIsJoiningGroup] = useState(false);

  // Constants
  const TERMS = t('academic.termOptions', { returnObjects: true }) as string[];
  const [activeTermIndex, setActiveTermIndex] = useState(0);

  const LMS_ACCOUNTS = t('integrations.lmsAccounts', { returnObjects: true }) as { name: string; user: string }[];

  useEffect(() => {
    const loadProfile = async () => {
      const userProfile = await getCurrentUserProfile();
      setProfile(userProfile);

      const hasBiometric = await hasBiometricTokenStored();
      setBiometric(hasBiometric);

      if (userProfile?.approval_threshold !== null && userProfile?.approval_threshold !== undefined) {
        setThreshold(String(userProfile.approval_threshold));
      }

      // Load Grading Systems
      try {
        const systems = await fetchGradingSystems();
        setGradingSystems(systems);
        setIsLoadingSystems(false);
        
        // Find user's current system based on active_grading_version_id or grading_scale fallback
        let currentSystemId: number | null = null;
        if (userProfile?.active_grading_version_id) {
          const sys = systems.find(s => s.active_version_id === userProfile.active_grading_version_id);
          if (sys) currentSystemId = sys.id;
        } 
        
        if (!currentSystemId && userProfile?.grading_scale) {
           const scaleMap: Record<string, string> = {
            '0-5.0': 'COL_0_5',
            '0-10': 'ES_0_10',
            '0-100': '0_100_PCT',
            'A-F': 'US_GPA_4'
           };
           const mappedCode = scaleMap[userProfile.grading_scale];
           if (mappedCode) {
             const sys = systems.find(s => s.code === mappedCode);
             if (sys) currentSystemId = sys.id;
           }
        }
        
        if (currentSystemId) {
          setSelectedSystemId(currentSystemId);
        } else if (systems.length > 0) {
          setSelectedSystemId(systems[0].id);
        }

      } catch (err) {
        console.warn('Failed to load grading systems', err);
        setIsLoadingSystems(false);
      }

      const groups = await getUserGroups();
      setUserGroups(groups || []);

      // Load persisted language
      const savedLanguage = await getItemAsync('app_language');
      if (savedLanguage === 'es' || savedLanguage === 'en') {
        setAppLanguage(savedLanguage);
      }
    };

    loadProfile();
  }, [t, i18n]);

  /**
   * Cierra la sesión activa del usuario y redirige a la pantalla de login.
   * Dependiendo de la plataforma (Web vs. Móvil), muestra un prompt nativo o personalizado.
   */
  const handleSignOut = () => {
    const onConfirm = async () => {
      await signOut();
      router.replace('/login');
    };

    if (Platform.OS === 'web') {
      if (confirm(t('account.signOutDesc'))) {
        onConfirm();
      }
    } else {
      alertRef.show({
        title: t('account.signOut'),
        message: t('account.signOutDesc'),
        type: 'confirm',
        buttons: [
          { text: t('settings.cancel'), style: 'cancel' },
          { text: t('account.signOutBtn'), style: 'destructive', onPress: onConfirm },
        ]
      });
    }
  };

  /**
   * Activa o desactiva la autenticación biométrica para la cuenta actual.
   *
   * @param {boolean} newValue - true para habilitar, false para deshabilitar.
   */
  const handleToggleBiometric = async (newValue: boolean) => {
    if (newValue) {
      if (!profile?.email) return;
      const token = await enrollBiometricToken(profile.email);
      if (token) {
        try {
          await enrollBiometric(profile.id?.toString() || '', token);
          setBiometric(true);
          alertRef.show({ title: t('common.success'), message: t('settings.biometricEnabled'), type: 'success' });
        } catch (error: any) {
          await revokeBiometricToken();
          setBiometric(false);
          alertRef.show({ title: t('common.error'), message: error.message || t('settings.errors.biometricEnableFailed'), type: 'error' });
        }
      } else {
        setBiometric(false);
      }
    } else {
      alertRef.show({
        title: t('settings.disableBiometric'),
        message: t('settings.disableBiometricDesc'),
        type: 'confirm',
        buttons: [
          { text: t('settings.cancel'), style: 'cancel', onPress: () => setBiometric(true) },
          { 
            text: t('account.deleteBtn'), 
            style: 'destructive', 
            onPress: async () => {
              try {
                await removeBiometricToken();
                await revokeBiometricToken();
                setBiometric(false);
                alertRef.show({ title: t('common.success'), message: t('settings.biometricDisabled'), type: 'success' });
              } catch (error: any) {
                setBiometric(true);
                alertRef.show({ title: t('common.error'), message: error.message || t('settings.errors.biometricDisableFailed'), type: 'error' });
              }
            } 
          },
        ]
      });
    }
  };

  /**
   * Inicia el flujo de eliminación de cuenta mostrando la primera alerta de confirmación.
   */
  const handleDeleteAccount = () => {
    alertRef.show({
      title: t('account.deleteAccount'),
      message: t('account.deleteAccountDesc'),
      type: 'confirm',
      buttons: [
        { text: t('settings.cancel'), style: 'cancel' },
        { 
          text: t('account.deleteBtn'), 
          style: 'destructive', 
          onPress: () => setIsDeleteAccountVisible(true)
        },
      ]
    });
  };

  /**
   * Prepara y abre el modal de edición de perfil con los datos actuales.
   */
  const handleOpenEditProfile = () => {
    setEditName(profile?.name || '');
    setEditLastname(profile?.lastname || '');
    setEditUsername(profile?.username || '');
    setEditUniversity(profile?.university || '');
    setEditMajor(profile?.major || '');
    setEditSemester(profile?.semester || '');
    setEditStudyGoal(profile?.study_goal || '');
    setEditPin(profile?.share_pin || '');
    setIsEditProfileVisible(true);
  };

  /**
   * Valida y guarda los cambios realizados en el modal de edición de perfil.
   * Valida que el PIN (si se está configurando por primera vez) tenga al menos 4 caracteres.
   */
  const handleSaveProfile = async () => {
    if (!profile?.share_pin && editPin.trim()) {
      const pinClean = editPin.trim().toUpperCase();
      if (pinClean.length < 4) {
        alertRef.show({ title: t('common.error'), message: 'El PIN debe tener al menos 4 caracteres.', type: 'warning' });
        return;
      }
    }
      let active_version_id: number | null = null;
      if (selectedSystemId) {
        const sys = gradingSystems.find(s => s.id === selectedSystemId);
        if (sys) active_version_id = sys.active_version_id;
      }

    try {
      await updateUserProfile({
        name: editName,
        lastname: editLastname,
        username: editUsername,
        university: editUniversity,
        major: editMajor,
        semester: editSemester,
        study_goal: editStudyGoal,
        active_grading_version_id: active_version_id,
        ...(!profile?.share_pin && editPin.trim() ? { share_pin: editPin.trim().toUpperCase() } : {}),
      });
      setIsEditProfileVisible(false);
      alertRef.show({ title: t('common.success'), message: t('account.profileUpdated'), type: 'success' });
      const userProfile = await getCurrentUserProfile();
      setProfile(userProfile);
    } catch (error: any) {
      alertRef.show({ title: t('common.error'), message: error.message || t('settings.errors.profileUpdateFailed'), type: 'error' });
    }
  };

  /**
   * Guarda las preferencias generales (sistema de calificación y threshold)
   */
  const handleSaveSettings = async () => {
    try {
      let active_version_id: number | null = null;

      if (selectedSystemId) {
        const sys = gradingSystems.find(s => s.id === selectedSystemId);
        if (sys) active_version_id = sys.active_version_id;
      }

      await updateUserProfile({ active_grading_version_id: active_version_id });
      
      const userProfile = await getCurrentUserProfile();
      setProfile(userProfile);
      
      alertRef.show({ title: t('common.success'), message: 'Configuraciones guardadas', type: 'success' });
    } catch (error: any) {
      alertRef.show({ title: t('common.error'), message: error.message || 'Error guardando configuraciones', type: 'error' });
    }
  };

  /**
   * Valida y actualiza la contraseña del usuario.
   */
  const handleSavePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      alertRef.show({ title: t('common.error'), message: t('account.fillAllFields'), type: 'warning' });
      return;
    }
    if (newPassword !== confirmPassword) {
      alertRef.show({ title: t('common.error'), message: t('account.passwordsDontMatch'), type: 'warning' });
      return;
    }
    try {
      await updateUserPassword(currentPassword, newPassword);
      setIsChangePasswordVisible(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      alertRef.show({ title: t('common.success'), message: t('account.passwordUpdated'), type: 'success' });
    } catch (error: any) {
      alertRef.show({ title: t('common.error'), message: error.message || t('settings.errors.passwordUpdateFailed'), type: 'error' });
    }
  };

  /**
   * Paso 2 de eliminación de cuenta: verifica la contraseña ingresada y
   * solicita al backend el conteo de datos que se perderán.
   */
  const handleDeletePasswordVerify = async () => {
    if (!deletePassword) {
      alertRef.show({ title: t('common.error'), message: t('common.errors.enterPassword'), type: 'warning' });
      return;
    }
    setIsLoadingDeletion(true);
    try {
      if (profile?.id) {
        const counts = await getDeletionDataCount(profile.id.toString());
        setDeletionDataCount(counts);
      }
      setDeleteStep('data');
    } catch (error: any) {
      alertRef.show({ title: t('common.error'), message: error.message, type: 'error' });
    } finally {
      setIsLoadingDeletion(false);
    }
  };

  /**
   * Paso 4 de eliminación de cuenta: valida la confirmación final de texto
   * y envía la solicitud definitiva al backend.
   */
  const handleConfirmDeletion = async () => {
    const confirmText = profile?.username || 'ELIMINAR';
    if (deleteConfirmText !== confirmText && deleteConfirmText !== 'ELIMINAR') {
      alertRef.show({ 
        title: t('common.error'), 
        message: `Debes escribir exactamente "${confirmText}" o "ELIMINAR"`, 
        type: 'warning' 
      });
      return;
    }

    setIsLoadingDeletion(true);
    try {
      await requestAccountDeletion(deletePassword);
      
      setIsDeleteAccountVisible(false);
      setDeleteStep('confirm');
      setDeletePassword('');
      setDeleteConfirmText('');
      
      const deletionDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      alertRef.show({
        title: t('common.success'),
        message: `Tu solicitud de eliminación ha sido registrada. Tu cuenta será completamente eliminada el ${deletionDate.toLocaleDateString()} si no la recuperas.`,
        type: 'success'
      });
      
      setTimeout(async () => {
        await signOut();
        router.replace('/login');
      }, 2000);
    } catch (error: any) {
      alertRef.show({ title: t('common.error'), message: error.message, type: 'error' });
    } finally {
      setIsLoadingDeletion(false);
    }
  };

  /**
   * Reinicia los estados y cierra el modal de eliminación de cuenta.
   */
  const handleCloseDeleteModal = () => {
    setIsDeleteAccountVisible(false);
    setDeleteStep('confirm');
    setDeletePassword('');
    setDeleteConfirmText('');
    setDeletionDataCount(null);
  };

  /**
   * Envía la solicitud para unirse a un grupo de colaboración utilizando el PIN ingresado.
   */
  const handleJoinGroup = async () => {
    if (!pinToJoin.trim()) {
      alertRef.show({ title: t('common.error'), message: 'Ingresa un PIN', type: 'warning' });
      return;
    }
    
    setIsJoiningGroup(true);
    try {
      await joinGroup(pinToJoin.trim().toUpperCase());
      setPinToJoin('');
      const groups = await getUserGroups();
      setUserGroups(groups || []);
      alertRef.show({ title: t('common.success'), message: 'Te has unido al grupo correctamente', type: 'success' });
    } catch (error: any) {
      alertRef.show({ title: t('common.error'), message: error.message, type: 'error' });
    } finally {
      setIsJoiningGroup(false);
    }
  };

  /**
   * Abandona un grupo colaborativo al que el usuario pertenece.
   *
   * @param {string} group_pin_id - El PIN del grupo a abandonar.
   */
  const handleLeaveGroup = async (group_pin_id: string) => {
    const onConfirm = async () => {
      try {
        await leaveGroup(group_pin_id);
        const groups = await getUserGroups();
        setUserGroups(groups || []);
        alertRef.show({ title: t('common.success'), message: 'Has salido del grupo correctamente', type: 'success' });
      } catch (error: any) {
        alertRef.show({ title: t('common.error'), message: error.message, type: 'error' });
      }
    };

    alertRef.show({
      title: 'Salir del grupo',
      message: `¿Estás seguro que deseas abandonar el grupo ${group_pin_id}?`,
      type: 'confirm',
      buttons: [
        { text: t('settings.cancel'), style: 'cancel' },
        { text: 'Salir', style: 'destructive', onPress: onConfirm },
      ]
    });
  };

  /**
   * Cambia el idioma de la aplicación y persiste la elección en SecureStore
   * para que se restaure automáticamente en futuros inicios de sesión.
   *
   * @param {string} lang - Código del idioma ('es' | 'en').
   */
  const handleChangeLanguage = async (lang: string) => {
    try {
      await setItemAsync('app_language', lang);
      await i18n.changeLanguage(lang);
      setAppLanguage(lang);
      alertRef.show({ title: t('common.success'), message: t('settings.languageSaved'), type: 'success' });
    } catch (error: any) {
      alertRef.show({ title: t('common.error'), message: error.message, type: 'error' });
    }
  };

  const fullName = useMemo(() => {
    const first = profile?.name?.trim() || '';
    const last = profile?.lastname?.trim() || '';
    return `${first} ${last}`.trim();
  }, [profile]);

  const profileName = fullName || profile?.username || t('account.profileName');
  const profileEmail = profile?.email || t('account.profileEmail');
  const profileAvatarUri = `https://ui-avatars.com/api/?name=${encodeURIComponent(profileName)}&background=EDEEF2&color=111111&bold=true`;

  return {
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
    handleSaveSettings,
    handleSavePassword,
    handleDeletePasswordVerify,
    handleConfirmDeletion,
    handleCloseDeleteModal,
    handleJoinGroup,
    handleLeaveGroup,
    appLanguage,
    handleChangeLanguage,
  };
};
