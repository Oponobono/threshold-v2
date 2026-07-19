import { useState, useEffect, useMemo } from 'react';
import { Platform, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { setItemAsync, getItemAsync } from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { alertRef } from '../components/ui/CustomAlert';
import { uploadFileToUploadthing } from '../services/uploadthing/storage';
import { downloadProfileImage, getLocalProfileImageUri } from '../services/profileImageCache';
import { fetchGradingSystems, type GradingSystem } from '../services/api/grading';
import { DEFAULT_GRADING_SYSTEMS } from '../services/api/gradingDefaults';
import {
  getCurrentUserProfile,
  getCurrentUserProfileSync,
  signOut,
  type UserProfile,
  type Subject,
  updateUserProfile,
  updateUserPassword,
  removeBiometricToken,
  enrollBiometric,
  requestAccountDeletion,
  getDeletionDataCount,
  joinGroup,
  getUserGroups,
  leaveGroup,
  createGroup,
  type GroupMembership
} from '../services/api';
import {
  enrollBiometricToken,
  revokeBiometricToken,
  hasBiometricTokenStored
} from '../services/biometricService';
import { getSubjects } from '../services/api/subjects';
import {
  getGradingPeriods,
  createGradingPeriod,
  deleteGradingPeriod,
  getThresholdOverrides,
  saveThresholdOverrides,
  createCustomGradingSystem,
  getTwoFactorStatus,
  enableTwoFactor as apiEnableTwoFactor,
  disableTwoFactor as apiDisableTwoFactor,
  getLmsAccounts as apiGetLmsAccounts,
  addLmsAccount as apiAddLmsAccount,
  removeLmsAccount as apiRemoveLmsAccount,
  exportDataCsv,
  exportDataPdf,
  sendFeedback as apiSendFeedback,
} from '../services/api/settings';

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
  const [isAddTermVisible, setIsAddTermVisible] = useState(false);
  const [isManageOverridesVisible, setIsManageOverridesVisible] = useState(false);
  const [isAddCustomScaleVisible, setIsAddCustomScaleVisible] = useState(false);
  const [isTwoFactorVisible, setIsTwoFactorVisible] = useState(false);
  const [isAddLmsVisible, setIsAddLmsVisible] = useState(false);
  const [isExportDataVisible, setIsExportDataVisible] = useState(false);
  const [isFaqVisible, setIsFaqVisible] = useState(false);
  const [isFeedbackVisible, setIsFeedbackVisible] = useState(false);

  // Edit Profile State
  const [editName, setEditName] = useState('');
  const [editLastname, setEditLastname] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editUniversity, setEditUniversity] = useState('');
  const [editMajor, setEditMajor] = useState('');
  const [editSemester, setEditSemester] = useState('');
  const [editStudyGoal, setEditStudyGoal] = useState('');
  const [editPin, setEditPin] = useState('');
  const [editProfileImage, setEditProfileImage] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

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
  const [isCreateGroupVisible, setIsCreateGroupVisible] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  // Dynamic loaded data
  const [gradingPeriods, setGradingPeriods] = useState<any[]>([]);
  const [thresholdOverrides, setThresholdOverrides] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [lmsAccounts, setLmsAccounts] = useState<any[]>([]);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  // Constants — merge translation defaults with DB grading periods
  const defaultTerms = t('academic.termOptions', { returnObjects: true }) as string[];
  const TERMS = useMemo(() => {
    const dbTerms = gradingPeriods.map(p => p.name);
    const all = [...new Set([...defaultTerms, ...dbTerms])];
    return all.length > 0 ? all : defaultTerms;
  }, [defaultTerms, gradingPeriods]);
  const [activeTermIndex, setActiveTermIndex] = useState(0);

  // LMS accounts now come from API (lmsAccounts state, loaded in useEffect)

  useEffect(() => {
    const loadProfile = async () => {
      const cached = await getCurrentUserProfileSync();
      if (cached) {
        setProfile(cached);
        if (cached.approval_threshold !== null && cached.approval_threshold !== undefined) {
          setThreshold(String(cached.approval_threshold));
        }
        if (cached.profile_image) {
          downloadProfileImage(cached.profile_image).then(localUri => {
            if (localUri) setLocalProfileImageUri(localUri);
          });
        }
      }

      const userProfile = await getCurrentUserProfile();
      setProfile(userProfile);

      if (userProfile?.profile_image) {
        const localUri = await downloadProfileImage(userProfile.profile_image);
        if (localUri) {
          setLocalProfileImageUri(localUri);
        }
      } else {
        setLocalProfileImageUri(null);
      }

      const hasBiometric = await hasBiometricTokenStored();
      setBiometric(hasBiometric);

      if (userProfile?.approval_threshold !== null && userProfile?.approval_threshold !== undefined) {
        setThreshold(String(userProfile.approval_threshold));
      }

      // Grading Systems – defaults instantáneos, personalizadas en background
      const defaultIds = new Set(DEFAULT_GRADING_SYSTEMS.map(s => s.id));
      const allSystems = [...DEFAULT_GRADING_SYSTEMS];
      const usedCodes = new Set(allSystems.map(s => s.code));
      setGradingSystems(allSystems);
      setIsLoadingSystems(false);

      fetchGradingSystems().then(apiSystems => {
        const customSystems = (apiSystems || []).filter(s => {
          if (!s.is_custom) return false;
          if (usedCodes.has(s.code)) return false;
          return true;
        });
        if (customSystems.length > 0) {
          let nextId = Math.max(...DEFAULT_GRADING_SYSTEMS.map(s => s.id)) + 1;
          const remapped = customSystems.map(s => defaultIds.has(s.id) ? { ...s, id: nextId++ } : s);
          setGradingSystems(prev => [...prev, ...remapped]);
        }
      }).catch(err => {
        console.warn('[useSettingsLogic] No se pudieron cargar escalas personalizadas:', err);
      });

      let currentSystemId: number | null = null;
      if (userProfile?.active_grading_version_id) {
        const sys = allSystems.find(s => String(s.active_version_id) === userProfile.active_grading_version_id);
        if (sys) currentSystemId = sys.id;
      }

      if (!currentSystemId && userProfile?.grading_scale) {
        const scaleMap: Record<string, string> = {
          '0-5.0': 'COL_0_5',
          '0-10': 'ES_0_10',
          '0-100': '0_100_PCT',
          'A-F': 'US_LETTER',
        };
        const mappedCode = scaleMap[userProfile.grading_scale];
        if (mappedCode) {
          const sys = allSystems.find(s => s.code === mappedCode);
          if (sys) currentSystemId = sys.id;
        }
      }

      if (currentSystemId) {
        setSelectedSystemId(currentSystemId);
      } else if (allSystems.length > 0) {
        setSelectedSystemId(allSystems[0].id);
      }


      const groups = await getUserGroups();
      setUserGroups(groups || []);

      // Load dynamic settings data
      try {
        const [periods, overrides, lms, twoFactor, userSubjects] = await Promise.all([
          getGradingPeriods().catch(() => []),
          getThresholdOverrides().catch(() => []),
          apiGetLmsAccounts().catch(() => []),
          getTwoFactorStatus().catch(() => ({ enabled: false })),
          getSubjects().catch(() => []),
        ]);
        setGradingPeriods(periods);
        setThresholdOverrides(overrides);
        setLmsAccounts(lms);
        setTwoFactorEnabled((twoFactor as any)?.enabled || false);
        setSubjects(userSubjects || []);
      } catch (e) {
        console.warn('Failed to load some settings data', e);
      }

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
    setEditProfileImage(null);
    setIsEditProfileVisible(true);
  };

  const handlePickProfilePhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alertRef.show({ title: t('common.error'), message: t('settings.galleryPermissionRequired'), type: 'warning' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    setIsUploadingPhoto(true);
    try {
      const uri = result.assets[0].uri;
      const { width, height } = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        Image.getSize(uri, (w, h) => resolve({ width: w, height: h }), reject);
      });
      const size = Math.min(width, height);
      const cropped = await ImageManipulator.manipulateAsync(
        uri,
        [{ crop: { originX: (width - size) / 2, originY: (height - size) / 2, width: size, height: size } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );
      const uploadResult = await uploadFileToUploadthing(cropped.uri);
      setEditProfileImage(uploadResult.url);
    } catch (error: any) {
      alertRef.show({ title: t('common.error'), message: error.message || t('settings.photoUploadError'), type: 'error' });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleRemoveProfilePhoto = () => {
    alertRef.show({
      title: t('common.confirm'),
      message: t('settings.deletePhotoConfirm'),
      type: 'confirm',
      buttons: [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => setEditProfileImage('__remove__') },
      ],
    });
  };

  /**
   * Valida y guarda los cambios realizados en el modal de edición de perfil.
   * Valida que el PIN (si se está configurando por primera vez) tenga al menos 4 caracteres.
   */
  const handleSaveProfile = async () => {
    if (!profile?.share_pin && editPin.trim()) {
      const pinClean = editPin.trim().toUpperCase();
      if (pinClean.length < 4) {
        alertRef.show({ title: t('common.error'), message: t('settings.pinMinLength'), type: 'warning' });
        return;
      }
    }
      let active_version_id: number | null = null;
      if (selectedSystemId) {
        const sys = gradingSystems.find(s => s.id === selectedSystemId);
        if (sys) active_version_id = sys.active_version_id;
      }

    try {
      const thresholdNum = Number(threshold);
      const profileImagePayload = editProfileImage === '__remove__'
        ? { profile_image: null }
        : editProfileImage
          ? { profile_image: editProfileImage }
          : {};
      await updateUserProfile({
        name: editName,
        lastname: editLastname,
        username: editUsername,
        university: editUniversity,
        major: editMajor,
        semester: editSemester,
        study_goal: editStudyGoal,
        active_grading_version_id: active_version_id,
        ...(!isNaN(thresholdNum) ? { approval_threshold: thresholdNum } : {}),
        ...(!profile?.share_pin && editPin.trim() ? { share_pin: editPin.trim().toUpperCase() } : {}),
        ...profileImagePayload,
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

      const payload: any = { active_grading_version_id: active_version_id };
      const thresholdNum = Number(threshold);
      if (!isNaN(thresholdNum)) {
        payload.approval_threshold = thresholdNum;
      }

      await updateUserProfile(payload);
      
      const userProfile = await getCurrentUserProfile();
      setProfile(userProfile);
      
      alertRef.show({ title: t('common.success'), message: t('settings.configSaved'), type: 'success' });
    } catch (error: any) {
      alertRef.show({ title: t('common.error'), message: error.message || t('settings.configSaveError'), type: 'error' });
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
        message: t('settings.typeConfirmExact', { username: confirmText }), 
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
        message: t('account.deletionScheduled', { date: deletionDate.toLocaleDateString() }),
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
      alertRef.show({ title: t('common.error'), message: t('settings.enterPin'), type: 'warning' });
      return;
    }
    
    setIsJoiningGroup(true);
    try {
      await joinGroup(pinToJoin.trim().toUpperCase());
      setPinToJoin('');
      const groups = await getUserGroups();
      setUserGroups(groups || []);
      alertRef.show({ title: t('common.success'), message: t('settings.joinedGroup'), type: 'success' });
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
        alertRef.show({ title: t('common.success'), message: t('settings.leftGroup'), type: 'success' });
      } catch (error: any) {
        alertRef.show({ title: t('common.error'), message: error.message, type: 'error' });
      }
    };

    alertRef.show({
      title: t('settings.leaveGroupTitle'),
      message: t('settings.leaveGroupConfirm', { pin: group_pin_id }),
      type: 'confirm',
      buttons: [
        { text: t('settings.cancel'), style: 'cancel' },
        { text: t('settings.leave'), style: 'destructive', onPress: onConfirm },
      ]
    });
  };

  const handleCreateGroup = async (name: string, pin: string, isPublic: boolean, password: string) => {
    setIsCreatingGroup(true);
    try {
      await createGroup({ group_pin_id: pin, name, is_public: isPublic, password: password || undefined });
      setIsCreateGroupVisible(false);
      const groups = await getUserGroups();
      setUserGroups(groups || []);
      alertRef.show({ title: t('common.success'), message: t('settings.groupCreated', 'Grupo creado correctamente'), type: 'success' });
    } catch (error: any) {
      alertRef.show({ title: t('common.error'), message: error.message, type: 'error' });
    } finally {
      setIsCreatingGroup(false);
    }
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

  const [localProfileImageUri, setLocalProfileImageUri] = useState<string | null>(null);

  useEffect(() => {
    getLocalProfileImageUri().then(uri => {
      if (uri) setLocalProfileImageUri(uri);
    });
  }, [profile?.profile_image]);

  const fullName = useMemo(() => {
    const first = profile?.name?.trim() || '';
    const last = profile?.lastname?.trim() || '';
    return `${first} ${last}`.trim();
  }, [profile]);

  const profileName = fullName || profile?.username || t('account.profileName');
  const profileEmail = profile?.email || t('account.profileEmail');
  const profileAvatarUri = localProfileImageUri || profile?.profile_image || `https://ui-avatars.com/api/?name=${encodeURIComponent(profileName)}&background=EDEEF2&color=111111&bold=true`;

  return {
    t,
    router,
    profile,
    profileName,
    profileEmail,
    profileAvatarUri,
    localProfileImageUri,
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
    setEditProfileImage,
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

    // Dynamic data for modals
    gradingPeriods,
    thresholdOverrides,
    subjects,
    lmsAccounts,
    twoFactorEnabled,

    // New modal states
    isAddTermVisible, setIsAddTermVisible,
    isManageOverridesVisible, setIsManageOverridesVisible,
    isAddCustomScaleVisible, setIsAddCustomScaleVisible,
    isTwoFactorVisible, setIsTwoFactorVisible,
    isAddLmsVisible, setIsAddLmsVisible,
    isExportDataVisible, setIsExportDataVisible,
    isFaqVisible, setIsFaqVisible,
    isFeedbackVisible, setIsFeedbackVisible,

    // New modal handlers — REAL API calls
    handleAddTerm: async (term: string) => {
      try {
        await createGradingPeriod(term);
        const periods = await getGradingPeriods();
        setGradingPeriods(periods);
        alertRef.show({ title: t('common.success'), message: t('settings.periodAdded', { term }), type: 'success' });
      } catch (error: any) {
        alertRef.show({ title: t('common.error'), message: error.message, type: 'error' });
      }
    },
    handleDeleteTerm: async (id: string, name: string) => {
      try {
        await deleteGradingPeriod(id);
        const periods = await getGradingPeriods();
        setGradingPeriods(periods);
        alertRef.show({ title: t('common.success'), message: t('settings.periodDeleted', { name }), type: 'success' });
      } catch (error: any) {
        alertRef.show({ title: t('common.error'), message: error.message, type: 'error' });
      }
    },
    handleSaveOverrides: async (overrides: any[]) => {
      try {
        await saveThresholdOverrides(overrides);
        const updated = await getThresholdOverrides();
        setThresholdOverrides(updated);
        alertRef.show({ title: t('common.success'), message: t('settings.exceptionsSaved'), type: 'success' });
      } catch (error: any) {
        alertRef.show({ title: t('common.error'), message: error.message, type: 'error' });
      }
    },
    handleAddCustomScale: async (name: string, passingValue: number, minValue: number, maxValue: number) => {
      try {
        const result = await createCustomGradingSystem({ name, min_value: minValue, max_value: maxValue, passing_value: passingValue });
        setGradingSystems(prev => {
          const existingIds = new Set(prev.map(s => s.id));
          if (existingIds.has(result.id)) {
            const maxId = Math.max(...prev.map(s => s.id)) + 1;
            return [...prev, { ...result, id: maxId }];
          }
          return [...prev, result];
        });
        alertRef.show({ title: t('common.success'), message: t('settings.scaleCreated', { name }), type: 'success' });
      } catch (error: any) {
        alertRef.show({ title: t('common.error'), message: error.message, type: 'error' });
      }
    },
    handleTwoFactorEnable: async () => {
      try {
        const result = await apiEnableTwoFactor();
        setTwoFactorEnabled(result.enabled);
        alertRef.show({ title: t('common.success'), message: t('account.twoFactorEnabled'), type: 'success' });
      } catch (error: any) {
        alertRef.show({ title: t('common.error'), message: error.message || t('account.twoFactorEnableError'), type: 'error' });
      }
    },
    handleTwoFactorDisable: async () => {
      try {
        const result = await apiDisableTwoFactor();
        setTwoFactorEnabled(result.enabled);
        alertRef.show({ title: t('common.success'), message: t('account.twoFactorDisabled'), type: 'success' });
      } catch (error: any) {
        alertRef.show({ title: t('common.error'), message: error.message || t('account.twoFactorDisableError'), type: 'error' });
      }
    },
    handleAddLms: async (platform: string, url: string, username: string) => {
      try {
        const account = await apiAddLmsAccount(platform, url, username);
        setLmsAccounts(prev => [...prev, account]);
        alertRef.show({ title: t('common.success'), message: t('settings.lmsLinked', { platform }), type: 'success' });
      } catch (error: any) {
        alertRef.show({ title: t('common.error'), message: error.message, type: 'error' });
      }
    },
    handleRemoveLms: async (index: number) => {
      try {
        const account = lmsAccounts[index];
        if (account?.id) await apiRemoveLmsAccount(account.id);
        setLmsAccounts(prev => prev.filter((_, i) => i !== index));
        alertRef.show({ title: t('common.success'), message: t('settings.lmsUnlinked'), type: 'success' });
      } catch (error: any) {
        alertRef.show({ title: t('common.error'), message: error.message, type: 'error' });
      }
    },
    handleExportCsv: async () => {
      try {
        const blob = await exportDataCsv();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'threshold_export.csv'; a.click();
        URL.revokeObjectURL(url);
      } catch (error: any) {
        throw error;
      }
    },
    handleExportPdf: async () => {
      try {
        const blob = await exportDataPdf();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'threshold_export.pdf'; a.click();
        URL.revokeObjectURL(url);
      } catch (error: any) {
        throw error;
      }
    },
    handleSendFeedback: async (message: string) => {
      try {
        await apiSendFeedback(message);
      } catch (error: any) {
        throw error;
      }
    },
  };
};
