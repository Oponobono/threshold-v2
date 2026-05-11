import { useState, useRef, useEffect } from 'react';
import { Animated, Easing, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { setItemAsync, getItemAsync, deleteItemAsync } from 'expo-secure-store';
import { alertRef } from '../components/CustomAlert';
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

        // Restore persisted language preference
        const savedLanguage = await getItemAsync('app_language');
        if (savedLanguage === 'es' || savedLanguage === 'en') {
          i18n.changeLanguage(savedLanguage);
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
                  router.replace('/(tabs)');
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
          title: 'Activar Touch ID',
          message: '¿Deseas iniciar sesión con tu huella dactilar la próxima vez?',
          type: 'confirm',
          buttons: [
            { text: 'Ahora no', style: 'cancel', onPress: () => router.replace('/(tabs)') },
            {
              text: 'Activar',
              onPress: async () => {
                const token = await enrollBiometricToken(email);
                if (token) {
                  try {
                    await enrollBiometric(userId, token);
                    setBiometricReady(true);
                  } catch {
                    await revokeBiometricToken();
                    alertRef.show({ title: 'Touch ID', message: 'Hubo un error al guardar la configuración en el servidor.', type: 'error' });
                  }
                }
                router.replace('/(tabs)');
              },
            },
          ]
        });
      } else {
        router.replace('/(tabs)');
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
        title: 'Touch ID no configurado',
        message: 'Inicia sesión con tu correo y contraseña primero para activar esta función.',
        type: 'warning'
      });
      return;
    }

    setIsBiometricLoading(true);
    try {
      const result = await authenticateWithBiometrics();

      if (!result.success) {
        if (result.reason !== 'cancelled') {
          alertRef.show({ title: 'Touch ID', message: 'No se pudo verificar tu huella. Intenta de nuevo o usa tu contraseña.', type: 'error' });
        }
        setIsBiometricLoading(false);
        return;
      }

      await biometricLogin(result.token);
      router.replace('/(tabs)');
    } catch (error: any) {
      alertRef.show({ title: 'Error', message: error.message || 'No se pudo iniciar sesión con Touch ID.', type: 'error' });
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
