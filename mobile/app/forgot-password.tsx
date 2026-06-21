import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { CustomInput } from '../src/components/ui/CustomInput';
import { CustomButton } from '../src/components/ui/CustomButton';
import { alertRef } from '../src/components/ui/CustomAlert';
import { forgotPassword, resetPassword } from '../src/services/api';

type Step = 'email' | 'reset';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [step, setStep] = useState<Step>('email');

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // ── Paso 1: solicitar código OTP ─────────────────────────────────────────
  const handleSendCode = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      alertRef.show({ title: t('common.error'), message: t('login.forgotPassword.emailLabel') + ' es requerido', type: 'error' });
      return;
    }

    setIsSending(true);
    try {
      await forgotPassword(trimmedEmail);
      alertRef.show({ title: '✉️', message: t('login.forgotPassword.codeSent'), type: 'success' });
      setStep('reset');
    } catch (err: any) {
      alertRef.show({ title: t('common.error'), message: err.message, type: 'error' });
    } finally {
      setIsSending(false);
    }
  };

  // ── Paso 2: verificar código y cambiar contraseña ────────────────────────
  const handleResetPassword = async () => {
    if (!code.trim() || !newPassword || !confirmPassword) {
      alertRef.show({ title: t('common.error'), message: t('common.requiredFields') || 'Completa todos los campos', type: 'error' });
      return;
    }
    if (newPassword !== confirmPassword) {
      alertRef.show({ title: t('common.error'), message: t('login.forgotPassword.passwordMismatch'), type: 'error' });
      return;
    }

    setIsResetting(true);
    try {
      await resetPassword(email.trim().toLowerCase(), code.trim(), newPassword);
      alertRef.show({
        title: t('common.success'),
        message: t('login.forgotPassword.success'),
        type: 'success',
        buttons: [{ text: 'OK', onPress: () => router.replace('/login') }],
      });
    } catch (err: any) {
      alertRef.show({ title: t('common.error'), message: err.message, type: 'error' });
    } finally {
      setIsResetting(false);
    }
  };

  const handleResendCode = async () => {
    setIsSending(true);
    try {
      await forgotPassword(email.trim().toLowerCase());
      alertRef.show({ title: '✉️', message: t('login.forgotPassword.codeSent'), type: 'success' });
    } catch (err: any) {
      alertRef.show({ title: t('common.error'), message: err.message, type: 'error' });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color="#1A1A1A" />
            <Text style={styles.backText}>{t('login.forgotPassword.backToLogin')}</Text>
          </TouchableOpacity>

          {/* Lock Icon */}
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <Ionicons name="lock-closed-outline" size={36} color="#C5A059" />
            </View>
          </View>

          {/* Title */}
          <Text style={styles.title}>
            {step === 'email'
              ? t('login.forgotPassword.title')
              : t('login.forgotPassword.step2Title')}
          </Text>
          <Text style={styles.subtitle}>
            {step === 'email'
              ? t('login.forgotPassword.subtitle')
              : t('login.forgotPassword.step2Subtitle', { email })}
          </Text>

          {/* Step 1: Email */}
          {step === 'email' && (
            <View style={styles.form}>
              <CustomInput
                label={t('login.forgotPassword.emailLabel')}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                value={email}
                onChangeText={setEmail}
              />
              <CustomButton
                title={isSending ? t('login.forgotPassword.sending') : t('login.forgotPassword.sendCode')}
                onPress={handleSendCode}
                loading={isSending}
                style={{ marginTop: 8 }}
              />
            </View>
          )}

          {/* Step 2: Code + New Password */}
          {step === 'reset' && (
            <View style={styles.form}>
              {/* OTP Code Input */}
              <View style={styles.otpSection}>
                <Text style={styles.otpLabel}>{t('login.forgotPassword.codePlaceholder')}</Text>
                <CustomInput
                  label="Código de 6 dígitos"
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChangeText={setCode}
                />
              </View>

              <CustomInput
                label={t('login.forgotPassword.newPasswordLabel')}
                secureTextEntry
                isPassword
                value={newPassword}
                onChangeText={setNewPassword}
              />
              <CustomInput
                label={t('login.forgotPassword.confirmPasswordLabel')}
                secureTextEntry
                isPassword
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />

              <CustomButton
                title={isResetting ? t('login.forgotPassword.resending') : t('login.forgotPassword.resetBtn')}
                onPress={handleResetPassword}
                loading={isResetting}
                style={{ marginTop: 8 }}
              />

              {/* Reenviar código */}
              <TouchableOpacity
                style={styles.resendBtn}
                onPress={handleResendCode}
                disabled={isSending}
              >
                <Text style={styles.resendText}>
                  {isSending
                    ? t('login.forgotPassword.resending')
                    : t('login.forgotPassword.resendCode')}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F9F9F7',
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 8,
    gap: 4,
    alignSelf: 'flex-start',
  },
  backText: {
    fontSize: 15,
    color: '#8A8A8E',
    fontWeight: '400',
  },
  iconContainer: {
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 24,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(197, 160, 89, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(197, 160, 89, 0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  form: {
    gap: 4,
  },
  otpSection: {
    marginBottom: 4,
  },
  otpLabel: {
    fontSize: 12,
    color: '#8A8A8E',
    letterSpacing: 3,
    fontFamily: 'monospace',
    textAlign: 'center',
    marginBottom: 4,
  },
  resendBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  resendText: {
    fontSize: 14,
    color: '#C5A059',
    fontWeight: '500',
  },
});
