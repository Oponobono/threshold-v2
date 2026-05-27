import React from 'react';
import { View, Text, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { aboutMapuviaStyles as styles } from '../../styles/AboutMapuvia.styles';

export const AboutMapuvia: React.FC = () => {
  const { t } = useTranslation();

  return (
    <>
      <LinearGradient
        colors={['#E2E2D6', '#DFE4E8', '#D7DEE4']}
        style={styles.section}
      >
        <Text style={styles.sectionEyebrow}>{t('about.theSubsidiary', 'La filial')}</Text>
        <Image
          source={require('../../images/logos_mapuvia/logotipo_mapuvia_labs.png')}
          style={styles.inlineLogo}
          resizeMode="contain"
        />
        <Text style={styles.sectionBody}>
          {t('about.mapuviaDesc1')}{' '}
          {t('about.mapuviaDesc2')}{' '}
          <Text style={styles.accentDark}>{t('about.tangibleTech')}</Text>.
        </Text>
      </LinearGradient>

      <LinearGradient
        colors={['#D7DEE4', '#E8ECEF', '#F4F6F8']}
        style={[styles.section, styles.lastSection]}
      >
        <Text style={styles.sectionEyebrow}>{t('about.headquarters', 'La casa matriz')}</Text>
        <View style={styles.mapuviaHeader}>
          <Image
            source={require('../../images/logos_mapuvia/logotipo_mapuvia_labs.png')}
            style={styles.mapuviaLogo}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.sectionBody}>
          {t('about.mapuviaDesc3')}
        </Text>

        <View style={styles.footer}>
          <Image
            source={require('../../images/logos_mapuvia/logotipo_mapuvia_labs.png')}
            style={styles.footerLogoLabs}
            resizeMode="contain"
          />
          <Text style={styles.footerYear}>© 2026</Text>
        </View>
      </LinearGradient>
    </>
  );
};
