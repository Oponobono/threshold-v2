import React, { useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Animated, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { globalStyles } from '../src/styles/globalStyles';
import { loginStyles } from '../src/styles/Login.styles';
import { registerStyles as localStyles } from '../src/styles/Register.styles';
import { theme } from '../src/styles/theme';
import { CustomInput } from '../src/components/CustomInput';
import { CustomButton } from '../src/components/CustomButton';
import { MapuviaFooter } from '../src/components/MapuviaFooter';
import { registerUser } from '../src/services/api';
import { alertRef } from '../src/components/CustomAlert';

const TOTAL_STEPS = 4;

/**
 * Pantalla de Registro de Usuario (RegisterScreen).
 * Implementa un flujo progresivo (wizard) de 4 pasos para recolectar
 * los datos del nuevo usuario, validarlos en tiempo real y registrar la cuenta
 * mediante llamadas a la API de Threshold.
 */
export default function RegisterScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Form Data
  const [name, setName] = useState('');
  const [lastname, setLastname] = useState('');
  const [username, setUsername] = useState('');
  
  const [gradingScale, setGradingScale] = useState('0-5.0');
  const [approvalThreshold, setApprovalThreshold] = useState('3.0');

  const [major, setMajor] = useState('');
  const [university, setUniversity] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Animations
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(1 / TOTAL_STEPS)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: step / TOTAL_STEPS,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [step]);

  /**
   * Cambia el paso actual del formulario de registro usando
   * una transición de fundido cruzado (fade out/fade in).
   *
   * @param {number} newStep - El número del nuevo paso a renderizar.
   */
  const changeStep = (newStep: number) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setStep(newStep);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    });
  };

  // Validations per step
  const isStep1Valid = name.trim().length > 0 && lastname.trim().length > 0 && username.trim().length > 0;
  
  const isStep2Valid = gradingScale && !isNaN(parseFloat(approvalThreshold));

  const isStep3Valid = true; // Optional

  const isEmailValid = (mail: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail);
  const reqs = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    number: /\d/.test(password),
    special: /[@$!%*?&]/.test(password),
  };
  const isPasswordValid = Object.values(reqs).every(Boolean);
  const isStep4Valid = isEmailValid(email) && isPasswordValid && password === confirmPassword;

  /**
   * Avanza al siguiente paso del formulario o invoca el registro final si ya se
   * encuentra en el último paso.
   */
  const handleNext = () => {
    if (step < TOTAL_STEPS) {
      changeStep(step + 1);
    } else {
      handleRegister();
    }
  };

  /**
   * Retrocede al paso anterior del formulario. Si el usuario se encuentra en el primer
   * paso, devuelve la navegación a la pantalla previa (ej. login).
   */
  const handleBack = () => {
    if (step > 1) {
      changeStep(step - 1);
    } else {
      router.back();
    }
  };

  /**
   * Compila todos los datos del formulario de registro y realiza la
   * petición al backend para crear la cuenta de usuario.
   */
  const handleRegister = async () => {
    setIsLoading(true);
    try {
      const response = await registerUser({
        email,
        password,
        name,
        lastname,
        username,
        grading_scale: gradingScale,
        approval_threshold: parseFloat(approvalThreshold),
        major,
        university
      });
      alertRef.show({ title: t('common.success'), message: t('register.success.accountCreated'), type: 'success' });
      router.replace('/(tabs)');
    } catch (error: any) {
      alertRef.show({ title: t('common.error'), message: error?.message || t('register.errors.generic'), type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Renderiza la barra de progreso animada ubicada en la cabecera.
   */
  const renderProgressBar = () => (
    <View style={localStyles.progressBarContainer}>
      <Animated.View style={[
        localStyles.progressBarFill, 
        { 
          width: progressAnim.interpolate({
            inputRange: [0, 1],
            outputRange: ['0%', '100%']
          })
        }
      ]} />
    </View>
  );

  /**
   * Renderiza un ítem individual de validación de requisitos de contraseña.
   *
   * @param {boolean} fulfilled - Indica si el requerimiento de contraseña está satisfecho.
   * @param {string} text - El texto del requerimiento a mostrar.
   */
  const RequirementItem = ({ fulfilled, text }: { fulfilled: boolean; text: string }) => (
    <View style={localStyles.reqItem}>
      <Feather 
        name={fulfilled ? 'check-circle' : 'circle'} 
        size={16} 
        color={fulfilled ? '#34C759' : theme.colors.text.placeholder} 
      />
      <Text style={[localStyles.reqText, fulfilled && localStyles.reqTextFulfilled]}>
        {text}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={globalStyles.safeArea}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView 
          style={globalStyles.container} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: theme.spacing.xl }}
        >
          {/* Header Section */}
          <View style={loginStyles.headerContainer}>
            <TouchableOpacity onPress={handleBack} style={{ flexDirection: 'row', alignItems: 'center', zIndex: 10 }}>
              <Ionicons name="arrow-back" size={24} color={theme.colors.primary} />
            </TouchableOpacity>
            <View style={{ position: 'absolute', left: 0, right: 0, alignItems: 'center', justifyContent: 'center', zIndex: -1 }}>
              <Ionicons name="school-outline" size={24} color={theme.colors.primary} />
            </View>
          </View>

          {renderProgressBar()}

          <Animated.View style={{ opacity: fadeAnim, marginTop: theme.spacing.md }}>
            
            {step === 1 && (
              <View>
                <View style={loginStyles.formHeaderContainer}>
                  <Text style={loginStyles.formHeaderTitle}>{t('register.step1.title')}</Text>
                  <Text style={loginStyles.formHeaderSubtitle}>
                    {t('register.step1.subtitle')}
                  </Text>
                </View>

                <View style={[loginStyles.formContainer, { marginTop: theme.spacing.lg }]}>
                  <CustomInput
                    label={t('register.step1.firstNameLabel')}
                    placeholder={t('register.step1.firstNamePlaceholder')}
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                  />
                  <CustomInput
                    label={t('register.step1.lastNameLabel')}
                    placeholder={t('register.step1.lastNamePlaceholder')}
                    value={lastname}
                    onChangeText={setLastname}
                    autoCapitalize="words"
                  />
                  <CustomInput
                    label={t('register.step1.usernameLabel')}
                    placeholder={t('register.step1.usernamePlaceholder')}
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                  />
                  
                  <CustomButton 
                    title={t('register.actions.continue')} 
                    onPress={handleNext} 
                    disabled={!isStep1Valid}
                    style={{ marginTop: theme.spacing.md }}
                  />
                </View>
              </View>
            )}

            {step === 2 && (
              <View>
                <View style={loginStyles.formHeaderContainer}>
                  <Text style={loginStyles.formHeaderTitle}>{t('register.step2.title')}</Text>
                  <Text style={loginStyles.formHeaderSubtitle}>
                    {t('register.step2.subtitle')}
                  </Text>
                </View>

                <View style={[loginStyles.formContainer, { marginTop: theme.spacing.lg }]}>
                  <Text style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary, marginBottom: theme.spacing.xs }}>{t('register.step2.gradingScaleLabel')}</Text>
                  <View style={localStyles.segmentedControl}>
                    {['0-5.0', '0-10', '0-100'].map((scale) => (
                      <TouchableOpacity 
                        key={scale}
                        style={[localStyles.segmentButton, gradingScale === scale && localStyles.segmentButtonActive]}
                        onPress={() => setGradingScale(scale)}
                      >
                        <Text style={[localStyles.segmentText, gradingScale === scale && localStyles.segmentTextActive]}>
                          {scale}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <CustomInput
                    label={t('register.step2.approvalThresholdLabel')}
                    placeholder={`${t('register.examplePrefix')} ${gradingScale === '0-5.0' ? '3.0' : gradingScale === '0-10' ? '6.0' : '60'}`}
                    value={approvalThreshold}
                    onChangeText={setApprovalThreshold}
                    keyboardType="numeric"
                  />
                  
                  <CustomButton 
                    title={t('register.actions.continue')} 
                    onPress={handleNext} 
                    disabled={!isStep2Valid}
                    style={{ marginTop: theme.spacing.md }}
                  />
                </View>
              </View>
            )}

            {step === 3 && (
              <View>
                <View style={loginStyles.formHeaderContainer}>
                  <Text style={loginStyles.formHeaderTitle}>{t('register.step3.title')}</Text>
                  <Text style={loginStyles.formHeaderSubtitle}>
                    {t('register.step3.subtitle')}
                  </Text>
                </View>

                <View style={[loginStyles.formContainer, { marginTop: theme.spacing.lg }]}>
                  <CustomInput
                    label={t('register.step3.majorLabel')}
                    placeholder={t('register.step3.majorPlaceholder')}
                    value={major}
                    onChangeText={setMajor}
                  />
                  <CustomInput
                    label={t('register.step3.universityLabel')}
                    placeholder={t('register.step3.universityPlaceholder')}
                    value={university}
                    onChangeText={setUniversity}
                  />
                  
                  {!major && !university && (
                    <View style={localStyles.emptyState}>
                      <Feather name="book-open" size={32} color={theme.colors.border} />
                      <Text style={localStyles.emptyStateText}>
                        {t('register.step3.emptyState')}
                      </Text>
                    </View>
                  )}

                  <CustomButton 
                    title={major || university ? t('register.actions.continue') : t('register.actions.skipAndContinue')} 
                    onPress={handleNext} 
                    disabled={!isStep3Valid}
                    style={{ marginTop: theme.spacing.xl }}
                  />
                </View>
              </View>
            )}

            {step === 4 && (
              <View>
                <View style={loginStyles.formHeaderContainer}>
                  <Text style={loginStyles.formHeaderTitle}>{t('register.step4.title')}</Text>
                  <Text style={loginStyles.formHeaderSubtitle}>
                    {t('register.step4.subtitle')}
                  </Text>
                </View>

                <View style={[loginStyles.formContainer, { marginTop: theme.spacing.md }]}>
                  <CustomInput 
                    label={t('login.emailLabel')} 
                    placeholder={t('login.emailPlaceholder')} 
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={setEmail}
                  />
                  
                  <CustomInput 
                    label={t('login.passwordLabel')} 
                    placeholder={t('login.passwordPlaceholder')} 
                    secureTextEntry
                    isPassword
                    value={password}
                    onChangeText={setPassword}
                  />

                  <CustomInput 
                    label={t('register.confirmPasswordLabel')} 
                    placeholder={t('register.confirmPasswordPlaceholder')} 
                    secureTextEntry
                    isPassword
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                  />

                  {/* Requirements Card */}
                  <View style={localStyles.reqCard}>
                    <Text style={localStyles.reqTitle}>{t('register.reqTitle')}</Text>
                    <RequirementItem fulfilled={reqs.length} text={t('register.reqLength')} />
                    <RequirementItem fulfilled={reqs.upper} text={t('register.reqUpper')} />
                    <RequirementItem fulfilled={reqs.number} text={t('register.reqNumber')} />
                    <RequirementItem fulfilled={reqs.special} text={t('register.reqSpecial')} />
                  </View>

                  <CustomButton 
                    title={t('register.step4.finishBtn')} 
                    onPress={handleNext} 
                    loading={isLoading}
                    style={{ marginTop: theme.spacing.sm, marginBottom: theme.spacing.lg }}
                    disabled={!isStep4Valid || isLoading}
                  />

                </View>
              </View>
            )}

          </Animated.View>

          {/* Footer en Registro */}
          <View style={{ marginTop: theme.spacing.md }}>
            <MapuviaFooter />
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}



