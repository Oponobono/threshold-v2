import { useState, useRef, useEffect } from 'react';
import { Animated, Easing, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { setItemAsync, getItemAsync, deleteItemAsync } from 'expo-secure-store';
import { alertRef } from '../components/ui/CustomAlert';
import { 
  loginUser, 
  trackGuestVisit, 
  reactivateAccount, 
  enrollBiometric, 
  biometricLogin 
} from '../services/api';
import { 
  isBiometricAvailable, 
  hasBiometricTokenStored, 
  enrollBiometricToken, 
  authenticateWithBiometrics, 
  revokeBiometricToken 
} from '../services/biometricService';
import { getBackupPreferences, BACKUP_PREFS } from '../services/backup/backupService';
import { downloadCloudItems } from '../services/backup/downloadService';
import { storageService } from '../services/storageService';
import { preloadAllUserData, PreloadProgress } from '../services/dataPreloader';

/**
 * Hook personalizado que maneja toda la lógica de autenticación de la pantalla de Login.
 * Gestiona el inicio de sesión tradicional, reactivación de cuentas, enrolamiento
 * y uso de biométricos (Touch ID / Face ID), así como el acceso de invitado.
 */
export const useLoginAuth = () => {
  const { t, i18n } = useTranslation();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isBiometricLoading, setIsBiometricLoading] = useState(false);
  const [biometricReady, setBiometricReady] = useState(false);
  const [syncProgress, setSyncProgress] = useState<PreloadProgress | null>(null);
  const [isSyncLoading, setIsSyncLoading] = useState(false);
  const lastGuestToggleAtRef = useRef(0);

  // Animaciones para el slogan
  const sloganOpacity = useRef(new Animated.Value(1)).current;
  const sloganTranslateY = useRef(new Animated.Value(0)).current;

  // Cargar preferencias al iniciar
  useEffect(() => {
    const initialize = async () => {
      try {
        // Restore remembered email
        const savedEmail = await getItemAsync('remembered_email');
        if (savedEmail) {
          setEmail(savedEmail);
          setRememberMe(true);
        }

        // Check biometric availability
        const available = await isBiometricAvailable();
        const hasToken = await hasBiometricTokenStored();
        setBiometricReady(available && hasToken);
      } catch (error) {
        console.log('Error en initialize login:', error);
      }
    };
    initialize();
  }, [i18n]);

  const animateSloganOut = () => {
    Animated.parallel([
      Animated.timing(sloganOpacity, { toValue: 0, duration: 350, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(sloganTranslateY, { toValue: -15, duration: 350, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]).start();
  };

  const animateSloganIn = () => {
    Animated.parallel([
      Animated.timing(sloganOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(sloganTranslateY, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start();
  };

  /**
   * Dispara la descarga automática en background si el usuario la tiene habilitada.
   * Se llama en cada login exitoso sin bloquear la navegación.
   */
  const navigateAfterSync = () => {
    setIsSyncLoading(true);
    setSyncProgress({ phase: 'profile', label: 'Sincronizando datos...', current: 0, total: 1 });
    preloadAllUserData(setSyncProgress)
      .then((result) => {
        if (!result.success) {
          console.warn('[Preloader] Precarga fallida:', result.error);
        }
      })
      .catch((err) => {
        console.warn('[Preloader] Error inesperado:', err);
      })
      .finally(() => {
        setIsSyncLoading(false);
        setSyncProgress(null);
        triggerAutoDownloadIfEnabled();
        router.replace('/(tabs)');
      });
  };

  const triggerAutoDownloadIfEnabled = () => {
    getBackupPreferences().then((prefs) => {
      if (prefs.autoDownload) {
        downloadCloudItems().then(() => {
          storageService.saveSecure(BACKUP_PREFS.LAST_DOWNLOAD, new Date().toISOString());
        }).catch((err) => {
          console.warn('[Backup] Auto-descarga fallida en login:', err);
        });
      }
    }).catch(() => {});
  };

  const handleLogin = async () => {
    if (!email || !password) {
      alertRef.show({ title: t('common.error'), message: t('login.errors.missingCredentials'), type: 'error' });
      return;
    }

    setIsLoading(true);
    animateSloganOut();

    try {
      const loginData = await loginUser(email, password);

      if (loginData.status === 'pending_deletion') {
        setIsLoading(false);
        const daysRemaining = loginData.days_remaining;
        const deletionDate = new Date(loginData.deletion_date);
        
        alertRef.show({
          title: t('login.accountPendingDeletion'),
          message: t('login.pendingDeletionMsg', { days: daysRemaining, date: deletionDate.toLocaleDateString(i18n.language) }),
          type: 'confirm',
          buttons: [
            { text: t('login.cancelBtn'), style: 'cancel', onPress: animateSloganIn },
            {
              text: t('login.recoverBtn'),
              style: 'default',
              onPress: async () => {
                try {
                  await reactivateAccount(loginData.user.id.toString());
                  const sessionToken = `dummy-token-${Date.now()}`;
                  if (Platform.OS === 'web') {
                    localStorage.setItem('app_session_token', sessionToken);
                    localStorage.setItem('app_user_email', email);
                    localStorage.setItem('app_user_id', loginData.user.id.toString());
                  } else {
                    await setItemAsync('app_session_token', sessionToken);
                    await setItemAsync('app_user_email', email);
                    await setItemAsync('app_user_id', loginData.user.id.toString());
                  }
                  alertRef.show({ title: t('common.success'), message: t('login.accountRecovered'), type: 'success' });
                  navigateAfterSync();
                } catch (error: any) {
                  alertRef.show({ title: t('common.error'), message: error.message, type: 'error' });
                }
              }
            }
          ]
        });
        return;
      }

      if (rememberMe) {
        await setItemAsync('remembered_email', email);
      } else {
        await deleteItemAsync('remembered_email');
      }

      const available = await isBiometricAvailable();
      const hasToken = await hasBiometricTokenStored();
      const userId = loginData?.user?.id?.toString();

      if (available && !hasToken && userId) {
        alertRef.show({
          title: t('biometric.enableTitle'),
          message: t('biometric.promptEnrollQuestion'),
          type: 'confirm',
          buttons: [
            { text: t('biometric.notNow'), style: 'cancel', onPress: () => {
                navigateAfterSync();
              }
            },
            {
              text: t('biometric.enable'),
              onPress: async () => {
                const token = await enrollBiometricToken(email);
                if (token) {
                  try {
                    await enrollBiometric(userId, token);
                    setBiometricReady(true);
                  } catch {
                    await revokeBiometricToken();
                    alertRef.show({ title: t('biometric.touchId'), message: t('biometric.serverConfigError'), type: 'error' });
                  }
                }
                navigateAfterSync();
              },
            },
          ]
        });
      } else {
        navigateAfterSync();
      }
    } catch (error: any) {
      alertRef.show({ title: t('login.errors.loginTitle'), message: error.message, type: 'error' });
      setIsLoading(false);
      animateSloganIn();
    }
  };

  const handleGuestToggle = (value: boolean) => {
    const now = Date.now();
    if (now - lastGuestToggleAtRef.current < 300) return;
    lastGuestToggleAtRef.current = now;

    setIsGuest(value);
    if (value) {
      router.replace('/(tabs)');
      void trackGuestVisit();
    }
  };

  const handleTouchId = async () => {
    if (!biometricReady) {
      alertRef.show({
        title: t('biometric.notConfiguredTitle'),
        message: t('biometric.notConfigured'),
        type: 'warning'
      });
      return;
    }

    setIsBiometricLoading(true);
    try {
      const result = await authenticateWithBiometrics();

      if (!result.success) {
        if (result.reason !== 'cancelled') {
          alertRef.show({ title: t('biometric.touchId'), message: t('biometric.verificationFailed'), type: 'error' });
        }
        setIsBiometricLoading(false);
        return;
      }

      await biometricLogin(result.token);
      navigateAfterSync();
    } catch (error: any) {
      alertRef.show({ title: t('common.error'), message: error.message || t('biometric.loginFailed'), type: 'error' });
      setIsBiometricLoading(false);
      
      if (error.message && error.message.includes('fallida')) {
        await revokeBiometricToken();
        setBiometricReady(false);
      }
    }
  };

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'en' ? 'es' : 'en');
  };

  return {
    email,
    setEmail,
    password,
    setPassword,
    rememberMe,
    setRememberMe,
    isGuest,
    isLoading,
    isBiometricLoading,
    biometricReady,
    syncProgress,
    isSyncLoading,
    sloganOpacity,
    sloganTranslateY,
    handleLogin,
    handleGuestToggle,
    handleTouchId,
    toggleLanguage,
    t,
    i18n,
    router
  };
};
