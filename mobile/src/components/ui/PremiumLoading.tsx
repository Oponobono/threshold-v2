import React from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { globalStyles } from '../../styles/globalStyles';
import { styles } from '../../styles/PremiumLoading.styles';

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
