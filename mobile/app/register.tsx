import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { setItemAsync } from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';
import { globalStyles } from '../src/styles/globalStyles';
import { loginStyles } from '../src/styles/Login.styles';
import { registerStyles as localStyles } from '../src/styles/Register.styles';
import { theme } from '../src/styles/theme';
import { CustomInput } from '../src/components/ui/CustomInput';
import { CustomButton } from '../src/components/ui/CustomButton';
import { MapuviaFooter } from '../src/components/ui/MapuviaFooter';
import { registerUser } from '../src/services/api';
import { uploadFileToUploadthing } from '../src/services/uploadthing/storage';
import { alertRef } from '../src/components/ui/CustomAlert';
import { fetchGradingSystems, type GradingSystem } from '../src/services/api/grading';

const TOTAL_STEPS = 2;

/**
 * Pantalla de Registro de Usuario (RegisterScreen).
 * Flujo de 2 pasos tipo Bento Grid ultra-minimalista.
 * Paso 1: Perfil + Objetivos académicos (foto opcional, nombre, apellido, usuario, semestre, objetivo principal, idioma de referencia)
 * Paso 2: Escala académica + Credenciales de acceso
 */
export default function RegisterScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Animations
  const slideAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(1 / TOTAL_STEPS)).current;

  // === Paso 1: Perfil ===
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [lastname, setLastname] = useState('');
  const [username, setUsername] = useState('');
  const [semester, setSemester] = useState('');
  const [studyGoal, setStudyGoal] = useState<string>('');
  const [referenceLanguage, setReferenceLanguage] = useState<string>('');

  // === Paso 2: Escala académica + Contexto + Credenciales ===
  const [gradingSystems, setGradingSystems] = useState<GradingSystem[]>([]);
  const [isLoadingSystems, setIsLoadingSystems] = useState(false);
  const [selectedSystemId, setSelectedSystemId] = useState<number | null>(null);
  const [approvalThreshold, setApprovalThreshold] = useState('3.0');
  const [major, setMajor] = useState('');
  const [university, setUniversity] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Derived legacy field for backward-compat with current API
  const selectedSystem = gradingSystems.find(s => s.id === selectedSystemId) ?? null;

  // Animations
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: step / TOTAL_STEPS,
      duration: 350,
      useNativeDriver: false,
    }).start();
  }, [step, progressAnim]);

  // Load grading systems from API
  useEffect(() => {
    const loadSystems = async () => {
      setIsLoadingSystems(true);
      try {
        const systems = await fetchGradingSystems();
        setGradingSystems(systems);
        if (systems.length > 0) {
          // Default to Colombia 0-5.0 if available, otherwise first in list
          const col = systems.find(s => s.code === 'COL_0_5') ?? systems[0];
          setSelectedSystemId(col.id);
          setApprovalThreshold(String(col.passing_value));
        }
      } catch {
        // Fallback silencioso: si la API falla, el paso 2 mostrará estado vacío
      } finally {
        setIsLoadingSystems(false);
      }
    };
    loadSystems();
  }, []);

  const changeStep = (newStep: number) => {
    const direction = newStep > step ? 400 : -400;
    slideAnim.setValue(direction);
    setStep(newStep);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 70,
      friction: 12,
    }).start();
  };

  // === Foto de perfil ===
  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setProfilePhoto(result.assets[0].uri);
    }
  };

  // === Avatar con iniciales (fallback) ===
  const getInitials = () => {
    const n = name.trim().charAt(0).toUpperCase();
    const l = lastname.trim().charAt(0).toUpperCase();
    return n || l ? `${n}${l}` : '?';
  };

  // === Validaciones ===
  const isStep1Valid =
    name.trim().length > 0 &&
    lastname.trim().length > 0 &&
    username.trim().length > 0;

  const isEmailValid = (mail: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail);
  const reqs = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    number: /\d/.test(password),
    special: /[@$!%*?&]/.test(password),
  };
  const isPasswordValid = Object.values(reqs).every(Boolean);
  const isStep2Valid =
    selectedSystemId !== null &&
    !isNaN(parseFloat(approvalThreshold)) &&
    isEmailValid(email) &&
    isPasswordValid &&
    password === confirmPassword;

  const handleNext = () => {
    if (step < TOTAL_STEPS) {
      changeStep(step + 1);
    } else {
      handleRegister();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      changeStep(step - 1);
    } else {
      router.back();
    }
  };

  const handleRegister = async () => {
    setIsLoading(true);
    try {
      // Subir foto de perfil a Uploadthing si el usuario eligió una
      let profileImageUrl: string | undefined;
      if (profilePhoto) {
        const uploadResult = await uploadFileToUploadthing(
          profilePhoto,
          `profile_${Date.now()}.jpg`,
          'image/jpeg'
        );
        profileImageUrl = uploadResult.url;
      }

      await registerUser({
        email,
        password,
        name,
        lastname,
        username,
        active_grading_version_id: selectedSystem?.active_version_id ?? null,
        major,
        university,
        semester,
        study_goal: studyGoal,
        reference_language: referenceLanguage,
        profile_image: profileImageUrl,
      });

      // Persist chosen language so login screen picks it up
      const langToSave = referenceLanguage === 'en' ? 'en' : 'es';
      await setItemAsync('app_language', langToSave);
      i18n.changeLanguage(langToSave);

      alertRef.show({
        title: t('common.success'),
        message: t('register.success.accountCreated'),
        type: 'success',
      });
      router.replace('/(tabs)');
    } catch (error: any) {
      alertRef.show({
        title: t('common.error'),
        message: error?.message || t('register.errors.generic'),
        type: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // === Sub-componentes ===
  const RequirementItem = ({ fulfilled, text }: { fulfilled: boolean; text: string }) => (
    <View style={localStyles.reqItem}>
      <Feather
        name={fulfilled ? 'check-circle' : 'x-circle'}
        size={14}
        color={fulfilled ? theme.colors.success : theme.colors.danger}
      />
      <Text style={[localStyles.reqText, fulfilled ? localStyles.reqTextFulfilled : localStyles.reqTextError]}>
        {text}
      </Text>
    </View>
  );

  const SystemButton = ({ system }: { system: GradingSystem }) => {
    const isActive = selectedSystemId === system.id;
    return (
      <TouchableOpacity
        style={[localStyles.segmentButton, isActive && localStyles.segmentButtonActive]}
        onPress={() => {
          setSelectedSystemId(system.id);
          setApprovalThreshold(String(system.passing_value));
        }}
      >
        <Text style={[localStyles.segmentText, isActive && localStyles.segmentTextActive]} numberOfLines={1}>
          {system.min_value}–{system.max_value}
        </Text>
        <Text style={[localStyles.segmentSubText, isActive && localStyles.segmentTextActive]} numberOfLines={1}>
          {system.name}
        </Text>
      </TouchableOpacity>
    );
  };

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
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Header ── */}
          <View style={loginStyles.headerContainer}>
            <TouchableOpacity
              onPress={handleBack}
              style={{ flexDirection: 'row', alignItems: 'center', zIndex: 10 }}
            >
              <Ionicons name="arrow-back" size={24} color={theme.colors.primary} />
            </TouchableOpacity>
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: -1,
              }}
            >
              <Ionicons name="school-outline" size={22} color={theme.colors.primary} />
            </View>
            <Text style={localStyles.stepIndicator}>
              {step}/{TOTAL_STEPS}
            </Text>
          </View>

          {/* ── Progress Bar ── */}
          <View style={localStyles.progressBarContainer}>
            <Animated.View
              style={[
                localStyles.progressBarFill,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>

          {/* ── Contenido animado ── */}
          <Animated.View style={{ transform: [{ translateX: slideAnim }], marginTop: theme.spacing.md }}>

            {/* ════════════════════════════════════════
                PASO 1 — Perfil + Objetivos
            ════════════════════════════════════════ */}
            {step === 1 && (
              <View>
                <View style={loginStyles.formHeaderContainer}>
                  <Text style={loginStyles.formHeaderTitle}>{t('register.step1.title')}</Text>
                  <Text style={loginStyles.formHeaderSubtitle}>{t('register.step1.subtitle')}</Text>
                </View>

                {/* ── Avatar Card ── */}
                <View style={localStyles.bentoCard}>
                  <View style={localStyles.bentoCardHeader}>
                    <Feather name="user" size={15} color={theme.colors.text.secondary} />
                    <Text style={localStyles.bentoCardLabel}>{t('register.step1.profilePhoto')}</Text>
                  </View>
                  <View style={localStyles.avatarCenter}>
                    <TouchableOpacity style={localStyles.avatarTouchable} onPress={handlePickPhoto}>
                      {profilePhoto ? (
                        <Image source={{ uri: profilePhoto }} style={localStyles.avatarImage} />
                      ) : (
                        <View style={localStyles.avatarInitials}>
                          <Text style={localStyles.avatarInitialsText}>{getInitials()}</Text>
                        </View>
                      )}
                      <View style={localStyles.avatarEditBadge}>
                        <Feather name="camera" size={12} color="#fff" />
                      </View>
                    </TouchableOpacity>
                    <Text
                      style={username.trim() ? localStyles.avatarUsername : localStyles.avatarUsernamePlaceholder}
                      numberOfLines={1}
                    >
                      {username.trim() || t('register.step1.usernamePlaceholder')}
                    </Text>
                    {profilePhoto && (
                      <TouchableOpacity onPress={() => setProfilePhoto(null)}>
                        <Text style={localStyles.removePhotoText}>{t('register.step1.removePhoto')}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* ── Identidad Card ── */}
                <View style={localStyles.bentoCard}>
                  <View style={localStyles.bentoCardHeader}>
                    <Feather name="edit-3" size={15} color={theme.colors.text.secondary} />
                    <Text style={localStyles.bentoCardLabel}>{t('register.step1.identityCard')}</Text>
                  </View>
                  <CustomInput
                    label={t('register.step1.firstNameLabel')}
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                  />
                  <CustomInput
                    label={t('register.step1.lastNameLabel')}
                    value={lastname}
                    onChangeText={setLastname}
                    autoCapitalize="words"
                  />
                  <CustomInput
                    label={t('register.step1.usernameLabel')}
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                  />
                </View>

                {/* ── Contexto Académico Card ── */}
                <View style={localStyles.bentoCard}>
                  <View style={localStyles.bentoCardHeader}>
                    <Feather name="book-open" size={15} color={theme.colors.text.secondary} />
                    <Text style={localStyles.bentoCardLabel}>{t('register.step1.academicCard')}</Text>
                  </View>
                  <CustomInput
                    label={t('register.step1.semesterLabel')}
                    value={semester}
                    onChangeText={setSemester}
                  />
                  <CustomInput
                    label={t('register.step1.majorLabel')}
                    value={major}
                    onChangeText={setMajor}
                  />
                  <CustomInput
                    label={t('register.step1.universityLabel')}
                    value={university}
                    onChangeText={setUniversity}
                  />
                </View>

                {/* ── Objetivos IA Card ── */}
                <View style={localStyles.bentoCard}>
                  <View style={localStyles.bentoCardHeader}>
                    <Feather name="zap" size={15} color={theme.colors.text.secondary} />
                    <Text style={localStyles.bentoCardLabel}>{t('register.step1.goalsCard')}</Text>
                    <View style={localStyles.aiBadge}>
                      <Text style={localStyles.aiBadgeText}>IA</Text>
                    </View>
                  </View>

                  <Text style={localStyles.chipSectionLabel}>{t('register.step1.studyGoalLabel')}</Text>
                  <Text style={[localStyles.chipSectionHint, { marginBottom: theme.spacing.sm }]}>{t('register.step1.studyGoalHint')}</Text>
                  <View style={localStyles.goalGrid}>
                    {['survive', 'pass', 'excel', 'top'].map((goal) => (
                      <TouchableOpacity
                        key={goal}
                        style={[localStyles.goalButton, studyGoal === goal && localStyles.goalButtonActive]}
                        onPress={() => setStudyGoal(goal)}
                      >
                        <Text style={[localStyles.goalButtonText, studyGoal === goal && localStyles.goalButtonTextActive]}>
                          {t(`register.goals.${goal}`)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={{ marginTop: theme.spacing.lg }}>
                    <Text style={localStyles.chipSectionLabel}>{t('register.step1.languageLabel')}</Text>
                    <Text style={[localStyles.chipSectionHint, { marginBottom: theme.spacing.sm }]}>{t('register.step1.languageHint')}</Text>
                    <View style={localStyles.chipContainer}>
                      {['es', 'en', 'zh', 'pt', 'fr', 'de'].map((lang) => {
                        const enabled = lang === 'es' || lang === 'en';
                        return (
                          <TouchableOpacity
                            key={lang}
                            style={[
                              localStyles.chip,
                              referenceLanguage === lang && localStyles.chipActive,
                              !enabled && localStyles.chipDisabled,
                            ]}
                            onPress={() => enabled && setReferenceLanguage(lang)}
                            activeOpacity={enabled ? 0.7 : 1}
                          >
                            <Text style={[
                              localStyles.chipText,
                              referenceLanguage === lang && localStyles.chipTextActive,
                              !enabled && localStyles.chipTextDisabled,
                            ]}>
                              {t(`register.languages.${lang}`)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </View>

                <CustomButton
                  title={t('register.actions.continue')}
                  onPress={handleNext}
                  disabled={!isStep1Valid}
                  style={{ marginTop: theme.spacing.sm, marginBottom: theme.spacing.md }}
                />
              </View>
            )}

            {/* ════════════════════════════════════════
                PASO 2 — Escala + Credenciales
            ════════════════════════════════════════ */}
            {step === 2 && (
              <View>
                <View style={loginStyles.formHeaderContainer}>
                  <Text style={loginStyles.formHeaderTitle}>{t('register.step2.title')}</Text>
                  <Text style={loginStyles.formHeaderSubtitle}>{t('register.step2.subtitle')}</Text>
                </View>

                {/* ── Escala académica Card ── */}
                <View style={localStyles.bentoCard}>
                  <View style={localStyles.bentoCardHeader}>
                    <Feather name="bar-chart-2" size={15} color={theme.colors.text.secondary} />
                    <Text style={localStyles.bentoCardLabel}>{t('register.step2.gradingCard')}</Text>
                  </View>
                  <Text style={localStyles.chipSectionLabel}>{t('register.step2.gradingScaleLabel')}</Text>
                  {isLoadingSystems ? (
                    <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 12 }} />
                  ) : (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
                    >
                      {gradingSystems.map(system => (
                        <SystemButton key={system.id} system={system} />
                      ))}
                    </ScrollView>
                  )}
                  {selectedSystem && (
                    <Text style={localStyles.chipSectionHint}>
                      {t('register.approvalWithValues', { passing: selectedSystem.passing_value, max: selectedSystem.max_value })}
                    </Text>
                  )}
                  <View style={localStyles.thresholdRow}>
                    <Text style={localStyles.thresholdLabel}>{t('register.step2.approvalThresholdLabel')}</Text>
                    <TextInput
                      style={localStyles.thresholdInput}
                      value={approvalThreshold}
                      onChangeText={setApprovalThreshold}
                      keyboardType="numeric"
                      maxLength={6}
                      textAlign="center"
                    />
                  </View>
                </View>

                {/* ── Credenciales Card ── */}
                <View style={localStyles.bentoCard}>
                  <View style={localStyles.bentoCardHeader}>
                    <Feather name="lock" size={15} color={theme.colors.text.secondary} />
                    <Text style={localStyles.bentoCardLabel}>{t('register.step2.credentialsCard')}</Text>
                  </View>
                  <CustomInput
                    label={t('login.emailLabel')}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={setEmail}
                  />
                  <CustomInput
                    label={t('login.passwordLabel')}
                    secureTextEntry
                    isPassword
                    value={password}
                    onChangeText={setPassword}
                  />
                  <CustomInput
                    label={t('register.confirmPasswordLabel')}
                    secureTextEntry
                    isPassword
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                  />

                  {/* Indicador de coincidencia de contraseñas */}
                  {confirmPassword.length > 0 && (
                    <View style={localStyles.matchRow}>
                      <Feather
                        name={password === confirmPassword ? 'check-circle' : 'x-circle'}
                        size={14}
                        color={password === confirmPassword ? theme.colors.success : theme.colors.danger}
                      />
                      <Text style={[
                        localStyles.matchText,
                        { color: password === confirmPassword ? theme.colors.success : theme.colors.danger },
                      ]}>
                        {password === confirmPassword ? t('register.passwordMatch') : t('register.passwordMismatch')}
                      </Text>
                    </View>
                  )}

                  {/* Requisitos de contraseña */}
                  <View style={localStyles.reqCard}>
                    <Text style={localStyles.reqTitle}>{t('register.reqTitle')}</Text>
                    <RequirementItem fulfilled={reqs.length} text={t('register.reqLength')} />
                    <RequirementItem fulfilled={reqs.upper} text={t('register.reqUpper')} />
                    <RequirementItem fulfilled={reqs.number} text={t('register.reqNumber')} />
                    <RequirementItem fulfilled={reqs.special} text={t('register.reqSpecial')} />
                  </View>
                </View>

                <CustomButton
                  title={t('register.step2.finishBtn')}
                  onPress={handleNext}
                  loading={isLoading}
                  disabled={!isStep2Valid || isLoading}
                  style={{ marginTop: theme.spacing.sm, marginBottom: theme.spacing.lg }}
                />
              </View>
            )}
          </Animated.View>

          {/* ── Footer ── */}
          <View style={{ marginTop: theme.spacing.md }}>
            <MapuviaFooter />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
