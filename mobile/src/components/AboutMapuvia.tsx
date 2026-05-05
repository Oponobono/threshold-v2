import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';

/**
 * Sección que describe a MAPUVIA Labs (la filial investigadora)
 * y a MAPUVIA (la casa matriz), incluyendo el pie de página de copyright.
 */
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
          source={require('../images/logos_mapuvia/logotipo_mapuvia_labs.png')}
          style={styles.inlineLogo}
          resizeMode="contain"
        />
        <Text style={styles.sectionBody}>
          MAPUVIA Labs es la división de investigación y desarrollo (I+D) de MAPUVIA, enfocada
          exclusivamente en la creación de software científico y académico. Opera como una incubadora 
          especializada en transformar la educación y la investigación en{' '}
          <Text style={styles.accentDark}>{t('about.tangibleTech', 'tecnología tangible')}</Text>.
        </Text>
      </LinearGradient>

      <LinearGradient
        colors={['#D7DEE4', '#E8ECEF', '#F4F6F8']}
        style={[styles.section, styles.lastSection]}
      >
        <Text style={styles.sectionEyebrow}>{t('about.headquarters', 'La casa matriz')}</Text>
        <View style={styles.mapuviaHeader}>
          <Image
            source={require('../images/logos_mapuvia/logotipo_mapuvia_labs.png')}
            style={styles.mapuviaLogo}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.sectionBody}>
          Matriz corporativa de innovación tecnológica. MAPUVIA se dedica al desarrollo de 
          servicios digitales y software general, creando ecosistemas que impulsan el progreso
          de personas y organizaciones en su cotidianidad.
        </Text>

        <View style={styles.footer}>
          <Image
            source={require('../images/logos_mapuvia/logotipo_mapuvia_labs.png')}
            style={styles.footerLogoLabs}
            resizeMode="contain"
          />
          <Text style={styles.footerYear}>© 2026</Text>
        </View>
      </LinearGradient>
    </>
  );
};

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: 28,
    paddingTop: 60,
    paddingBottom: 64,
  },
  lastSection: {
    paddingBottom: 80,
  },
  sectionEyebrow: {
    fontSize: 11,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: '#8A8A8E',
    marginBottom: 12,
  },
  sectionBody: {
    fontSize: 16,
    lineHeight: 26,
    color: '#555555',
    textAlign: 'justify',
  },
  accentDark: {
    color: '#1A1A1A',
    fontWeight: '600',
  },
  inlineLogo: {
    width: 130,
    height: 26,
    marginBottom: 20,
    opacity: 0.85,
  },
  mapuviaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  mapuviaLogo: {
    width: 130,
    height: 26,
    opacity: 0.85,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 56,
    opacity: 0.8,
  },
  footerLogoLabs: {
    width: 80,
    height: 14,
  },
  footerYear: {
    fontSize: 10,
    color: '#8A8A8E',
    marginLeft: 4,
  },
});
