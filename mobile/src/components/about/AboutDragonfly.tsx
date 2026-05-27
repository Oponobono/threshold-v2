import React from 'react';
import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { DragonflyIcon } from '../ui/DragonflyIcon';
import { aboutDragonflyStyles as styles } from '../../styles/AboutDragonfly.styles';

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
        {t('about.dragonflyDesc1')}{' '}
        <Text style={styles.accentGold}>{t('about.dragonflyLower')}</Text>{' '}
        {t('about.dragonflyDesc2')}
        {t('about.dragonflyDesc3')}
        {t('about.dragonflyDesc4')}
      </Text>
    </LinearGradient>
  );
};
