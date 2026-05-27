import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { globalStyles } from '../../styles/globalStyles';

interface PremiumLoadingProps {
  text?: string;
}

/**
 * PremiumLoading.tsx
 *
 * Pantalla de carga a pantalla completa que se sobrepone mientras la app
 * realiza tareas intensivas o transiciones mayores (ej. procesamiento IA de Groq/Gemini, 
 * renderizado pesado inicial, o validaciones criptográficas biométricas).
 * Presenta un diseño premium, "limpio", con el logo corporativo con un pulso animado.
 *
 * @param text - Texto personalizado a mostrar (ej. "CARGANDO...", "ANALIZANDO...").
 */
export const PremiumLoading: React.FC<PremiumLoadingProps> = ({ text = 'CARGANDO' }) => {
  return (
    <SafeAreaView style={[globalStyles.safeArea, { backgroundColor: '#fff' }]}>
      <View style={styles.premiumLoadingContainer}>
        <View style={styles.loadingLogoContainer}>
          <View style={styles.loadingLogoCircle}>
            <Ionicons name="leaf-outline" size={32} color={theme.colors.primary} />
          </View>
          <View style={styles.loadingPulse} />
        </View>
        <Text style={styles.premiumLoadingText}>{text}</Text>
        <View style={styles.loadingBarTrack}>
          <View style={styles.loadingBarFill} />
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  premiumLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingLogoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  loadingLogoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${theme.colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  loadingPulse: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${theme.colors.primary}30`,
    zIndex: 1,
    transform: [{ scale: 1.5 }],
    opacity: 0.5,
  },
  premiumLoadingText: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text.secondary,
    letterSpacing: 4,
    marginBottom: 20,
  },
  loadingBarTrack: {
    width: 200,
    height: 4,
    backgroundColor: `${theme.colors.primary}20`,
    borderRadius: 2,
    overflow: 'hidden',
  },
  loadingBarFill: {
    width: '40%',
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
  },
});
