import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
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
import { forgotPasswordStyles } from '../src/styles/ForgotPassword.styles';
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
      <SafeAreaView style={forgotPasswordStyles.safeArea}>
        <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={forgotPasswordStyles.container}
          contentContainerStyle={forgotPasswordStyles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <TouchableOpacity style={forgotPasswordStyles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color="#1A1A1A" />
            <Text style={forgotPasswordStyles.backText}>{t('login.forgotPassword.backToLogin')}</Text>
          </TouchableOpacity>

          {/* Lock Icon */}
          <View style={forgotPasswordStyles.iconContainer}>
            <View style={forgotPasswordStyles.iconCircle}>
              <Ionicons name="lock-closed-outline" size={36} color="#C5A059" />
            </View>
          </View>

          {/* Title */}
          <Text style={forgotPasswordStyles.title}>
            {step === 'email'
              ? t('login.forgotPassword.title')
              : t('login.forgotPassword.step2Title')}
          </Text>
          <Text style={forgotPasswordStyles.subtitle}>
            {step === 'email'
              ? t('login.forgotPassword.subtitle')
              : t('login.forgotPassword.step2Subtitle', { email })}
          </Text>

          {/* Step 1: Email */}
          {step === 'email' && (
            <View style={forgotPasswordStyles.form}>
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
            <View style={forgotPasswordStyles.form}>
              {/* OTP Code Input */}
              <View style={forgotPasswordStyles.otpSection}>
                <Text style={forgotPasswordStyles.otpLabel}>{t('login.forgotPassword.codePlaceholder')}</Text>
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
                style={forgotPasswordStyles.resendBtn}
                onPress={handleResendCode}
                disabled={isSending}
              >
                <Text style={forgotPasswordStyles.resendText}>
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
