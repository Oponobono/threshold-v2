import React from 'react';
import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { aboutThresholdStyles as styles } from '../../styles/AboutThreshold.styles';

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
        {t('about.thresholdDesc1')}{' '}
        <Text style={styles.accentGold}>Threshold</Text>{' '}
        {t('about.thresholdDesc2')}
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
