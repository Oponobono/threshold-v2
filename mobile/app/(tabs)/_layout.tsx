import React, { useRef, useEffect } from 'react';
import { Platform, BackHandler, View } from 'react-native';
import { Tabs, useNavigation } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../src/styles/theme';
import { useDataStore } from '../../src/store/useDataStore';
import { useProgressiveDataLoading } from '../../src/hooks/useProgressiveDataLoading';
import { Toast, toastRef } from '../../src/components/Toast';

export default function TabLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  
  // 🚀 Carga progresiva: caché primero, luego servidor
  useProgressiveDataLoading();

  // 🔒 Double Back to Exit Pattern
  // Mantiene referencia a la última vez que se presionó atrás
  const backPressedTimeRef = useRef<number>(0);
  const backTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      const now = Date.now();
      const timeSinceLastPress = now - backPressedTimeRef.current;
      const DOUBLE_BACK_TIMEOUT = 2000; // 2 segundos

      // Si se presionó hace menos de 2 segundos, cerrar la app
      if (timeSinceLastPress < DOUBLE_BACK_TIMEOUT) {
        // Limpiar timeout si existía
        if (backTimeoutRef.current) {
          clearTimeout(backTimeoutRef.current);
          backTimeoutRef.current = null;
        }
        // Cerrar la app
        BackHandler.exitApp();
        return true;
      }

      // Primera presión: mostrar toast sutil
      backPressedTimeRef.current = now;
      toastRef.current?.show(
        t('common.doubleBackToExit') || 'Presiona atrás de nuevo para salir',
        2000
      );

      // Resetear el contador después de 2 segundos
      backTimeoutRef.current = setTimeout(() => {
        backPressedTimeRef.current = 0;
        backTimeoutRef.current = null;
      }, DOUBLE_BACK_TIMEOUT);

      // Retornar true para prevenir el comportamiento por defecto
      return true;
    });

    return () => {
      backHandler.remove();
      if (backTimeoutRef.current) {
        clearTimeout(backTimeoutRef.current);
      }
    };
  }, [t]);
  
  // La carga de datos se maneja con useProgressiveDataLoading() arriba
  
  // Calculate bottom padding factoring in the system navigation bar (Android/iOS)
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 28 : 16);
  const tabHeight = 60 + bottomPadding;

  return (
    <View style={{ flex: 1 }}>
      <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.text.secondary,
        tabBarStyle: {
          backgroundColor: theme.colors.background,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
          height: tabHeight,
          paddingTop: 8,
          paddingBottom: bottomPadding,
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
        tabBarIconStyle: {
          marginBottom: 2,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('dashboard.tabs.dashboard'),
          tabBarIcon: ({ color, size }) => (
            <Feather name="grid" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="subjects"
        options={{
          title: t('dashboard.tabs.subjects'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="book-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: t('dashboard.tabs.calendar'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="grades"
        options={{
          title: t('dashboard.tabs.grades'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bar-chart-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="gallery"
        options={{
          title: t('dashboard.tabs.gallery'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="images-outline" size={size} color={color} />
          ),
        }}
      />
      </Tabs>
      {/* Toast: renderizado DESPUÉS de Tabs para aparecer encima de todo */}
      <Toast ref={toastRef} />
    </View>
  );
}
