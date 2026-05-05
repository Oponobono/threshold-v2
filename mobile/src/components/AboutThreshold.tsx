import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';

/**
 * Sección que describe el propósito de la aplicación Threshold
 * y muestra sus especificaciones técnicas de lanzamiento.
 */
export const AboutThreshold: React.FC = () => {
  const { t } = useTranslation();

  return (
    <LinearGradient
      colors={['#F9F9F7', '#F4F4F1', '#EFEFEA']}
      style={styles.section}
    >
      <Text style={styles.sectionEyebrow}>{t('about.theApp', 'La aplicación')}</Text>
      <Text style={styles.sectionTitle}>Threshold</Text>
      <Text style={styles.sectionBody}>
        Diseñada íntegramente por MAPUVIA Labs,{' '}
        <Text style={styles.accentGold}>Threshold</Text>{' '}
        nace para eliminar la fragmentación en la vida académica del estudiante. Calificaciones,
        horarios y apuntes en un solo lugar, siempre a la mano.
      </Text>
      
      <View style={styles.specRow}>
        <View style={styles.specItem}>
          <Text style={styles.specValue}>2026</Text>
          <Text style={styles.specLabel}>{t('about.launch', 'Lanzamiento')}</Text>
        </View>
        <View style={styles.specDivider} />
        <View style={styles.specItem}>
          <Text style={styles.specValue}>v1.0</Text>
          <Text style={styles.specLabel}>{t('about.version', 'Versión')}</Text>
        </View>
        <View style={styles.specDivider} />
        <View style={styles.specItem}>
          <Text style={styles.specValue}>{t('about.rd', 'I+D')}</Text>
          <Text style={styles.specLabel}>{t('about.origin', 'Origen')}</Text>
        </View>
      </View>
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
  sectionTitle: {
    fontSize: 52,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: -2,
    lineHeight: 54,
    marginBottom: 20,
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
  specRow: {
    flexDirection: 'row',
    marginTop: 36,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(0,0,0,0.06)',
    paddingTop: 24,
  },
  specItem: {
    flex: 1,
    alignItems: 'center',
  },
  specValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  specLabel: {
    fontSize: 11,
    color: '#8A8A8E',
    letterSpacing: 1,
  },
  specDivider: {
    width: 0.5,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
});
