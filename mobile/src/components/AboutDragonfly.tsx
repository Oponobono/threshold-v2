import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { DragonflyIcon } from './DragonflyIcon';

/**
 * Sección que describe el símbolo de la libélula, 
 * representativo de la filosofía de diseño detrás de Threshold.
 */
export const AboutDragonfly: React.FC = () => {
  const { t } = useTranslation();

  return (
    <LinearGradient
      colors={['#EFEFEA', '#EAEADF', '#E2E2D6']}
      style={styles.section}
    >
      <Text style={styles.sectionEyebrow}>{t('about.theSymbol', 'El símbolo')}</Text>

      <View style={styles.dragonflyStage}>
        <View style={styles.glowGold} />
        <DragonflyIcon size={110} color="#C5A059" />
      </View>

      <Text style={styles.sectionTitleLg}>{t('about.theDragonfly', 'La Libélula')}</Text>
      <Text style={styles.sectionBody}>
        Elegida por MAPUVIA Labs como emblema de Threshold, la{' '}
        <Text style={styles.accentGold}>{t('about.dragonflyLower', 'libélula')}</Text>{' '}
        representa agilidad, precisión y visión panorámica de 360°.
        Así como este insecto percibe su entorno completo de un solo vistazo,
        Threshold le otorga al estudiante una perspectiva integral de su progreso académico,
        permitiéndole adaptarse y avanzar sin fricciones.
      </Text>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: 28,
    paddingTop: 60,
    paddingBottom: 64,
  },
  sectionEyebrow: {
    fontSize: 11,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: '#8A8A8E',
    marginBottom: 12,
  },
  sectionTitleLg: {
    fontSize: 44,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: -1.5,
    lineHeight: 46,
    marginBottom: 20,
    textAlign: 'center',
  },
  sectionBody: {
    fontSize: 16,
    lineHeight: 26,
    color: '#555555',
    textAlign: 'justify',
  },
  accentGold: {
    color: '#C5A059',
    fontWeight: '600',
  },
  dragonflyStage: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 32,
    position: 'relative',
  },
  glowGold: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(197, 160, 89, 0.12)',
  },
});
