import React, { useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, Animated, Easing, Image, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { globalStyles } from '../src/styles/globalStyles';
import { loginStyles } from '../src/styles/Login.styles';
import { theme } from '../src/styles/theme';
import { CustomInput } from '../src/components/CustomInput';
import { CustomButton } from '../src/components/CustomButton';
import { FeatureCarousel } from '../src/components/FeatureCarousel';
import { MapuviaFooter } from '../src/components/MapuviaFooter';
import { useLoginAuth } from '../src/hooks/useLoginAuth';

/**
 * Pantalla principal de autenticación (LoginScreen)
 *
 * Sirve de orquestador visual para el inicio de sesión.
 * La lógica de estado, llamadas a la API y enrolamiento biométrico
 * ha sido abstraída al hook `useLoginAuth`.
 */
export default function LoginScreen() {
  const {
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
  } = useLoginAuth();



  return (
    <SafeAreaView style={[globalStyles.safeArea, { backgroundColor: '#F9F9F7' }]}>
      <ScrollView 
        style={[globalStyles.container, { backgroundColor: '#F9F9F7' }]} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: theme.spacing.xl }}
      >
        {/* Tonalidad y Cambio de Idioma */}
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingTop: theme.spacing.md }}>
          <TouchableOpacity onPress={toggleLanguage}>
            <Text style={[globalStyles.textLink, { color: '#8A8A8E' }]}>{i18n.language.toUpperCase()}</Text>
          </TouchableOpacity>
        </View>

        {/* Brand Header (Transición desde Splash) */}
        <View style={loginStyles.brandHeaderContainer}>
          <View style={loginStyles.titleRow}>
            <Image 
              source={require('../src/images/logo_threshold.png')} 
              style={[loginStyles.brandLogo, { width: 66, height: 66 }]}
              resizeMode="contain"
            />
            <Text style={loginStyles.brandAppName}>hreshold</Text>
          </View>
          
          {/* Eslogan animado independiente */}
          <Animated.View style={{ opacity: sloganOpacity, transform: [{ translateY: sloganTranslateY }] }}>
            <Text style={loginStyles.brandSlogan}>BEYOND THE LIMIT</Text>
          </Animated.View>
        </View>

        {/* Carousel Section */}
        <FeatureCarousel />

        {/* Form Section */}
        <View style={loginStyles.formContainer}>
          <View style={loginStyles.formHeaderContainer}>
            <Text style={loginStyles.formHeaderTitle}>
              {t('login.formTitle')}
            </Text>
            <Text style={loginStyles.formHeaderSubtitle}>
              {t('login.formSubtitle')}
            </Text>
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

          <View style={loginStyles.optionsRow}>
            <TouchableOpacity 
              style={loginStyles.checkboxContainer}
              onPress={() => setRememberMe(!rememberMe)}
              activeOpacity={0.7}
            >
              <View style={[
                {
                  width: 20, 
                  height: 20, 
                  borderRadius: 6, 
                  borderWidth: 1, 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  marginRight: 8
                },
                rememberMe 
                  ? { backgroundColor: '#C5A059', borderColor: '#C5A059' } 
                  : { backgroundColor: 'transparent', borderColor: '#E0E0E0' }
              ]}>
                {rememberMe && <Feather name="check" size={14} color="#FFF" />}
              </View>
              <Text style={[loginStyles.checkboxText, { color: '#1A1A1A', fontWeight: '300', marginLeft: 0 }]}>{t('login.rememberMe')}</Text>
            </TouchableOpacity>

            <TouchableOpacity>
              <Text style={[globalStyles.textLink, { color: '#8A8A8E', fontWeight: '400' }]}>{t('login.forgot')}</Text>
            </TouchableOpacity>
          </View>

          {/* Fila principal de autenticación: Ingresar + Touch ID */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: theme.spacing.md }}>
            {/* Botón de login: ocupa ~75% */}
            <View style={{ flex: 3 }}>
              <CustomButton 
                title={t('login.enterDashboard')} 
                onPress={handleLogin} 
                loading={isLoading}
              />
            </View>

            {/* Botón Touch ID: icono solo, misma altura */}
            <TouchableOpacity
              style={[
                loginStyles.touchIdIconButton,
                biometricReady ? { borderColor: '#C5A059' } : { opacity: 0.45 },
              ]}
              activeOpacity={0.7}
              onPress={handleTouchId}
              disabled={isBiometricLoading || isLoading}
            >
              {isBiometricLoading ? (
                <Feather name="loader" size={24} color={biometricReady ? '#C5A059' : theme.colors.text.secondary} />
              ) : (
                <Ionicons
                  name="finger-print-outline"
                  size={30}
                  color={biometricReady ? '#C5A059' : theme.colors.text.secondary}
                />
              )}
            </TouchableOpacity>
          </View>

          <CustomButton 
            title={t('login.createAccount')} 
            onPress={() => router.push('/register')} 
            variant="outline"
            style={{ marginBottom: 0 }}
          />

          <View style={loginStyles.guestRow}>
            <View>
              <Text style={loginStyles.guestTitle}>{t('login.continueGuest')}</Text>
              <Text style={loginStyles.guestSubtitle}>{t('login.guestSubtitle')}</Text>
            </View>
            <Switch 
              value={isGuest} 
              onValueChange={handleGuestToggle}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor={theme.colors.white}
            />
          </View>

        </View>

        {/* Footer */}
        <View style={{ marginTop: 0 }}>
          <Text style={loginStyles.footerText}>
            {t('login.footerText')}
          </Text>
          <MapuviaFooter />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
