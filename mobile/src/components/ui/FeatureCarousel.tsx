import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { theme } from '../../styles/theme';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { featureCarouselStyles as styles } from '../../styles/FeatureCarousel.styles';

const { width } = Dimensions.get('window');
const PAGE_WIDTH = width - theme.spacing.lg * 2;
const AUTO_SLIDE_INTERVAL = 4000;

/**
 * FeatureCarousel.tsx
 *
 * Carrusel de presentación de funcionalidades usado en la pantalla de onboarding/login.
 * Muestra las características principales de la app en grupos de 3 por página con
 * deslizamiento horizontal y avance automático cada 4 segundos. El timer se pausa
 * al arrastrar manualmente y se reinicia al soltar.
 * Los textos se obtienen del sistema de internacionalización (i18n).
 */
export const FeatureCarousel = () => {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const allFeatures = [
    {
      id: '1',
      title: t('features.bento.title'),
      description: t('features.bento.desc'),
      icon: 'grid',
    },
    {
      id: '2',
      title: t('features.gpa.title'),
      description: t('features.gpa.desc'),
      icon: 'trending-up',
    },
    {
      id: '3',
      title: t('features.photo.title'),
      description: t('features.photo.desc'),
      icon: 'camera',
    },
    {
      id: '4',
      title: t('features.schedule.title'),
      description: t('features.schedule.desc'),
      icon: 'calendar',
    },
    {
      id: '5',
      title: t('features.tasks.title'),
      description: t('features.tasks.desc'),
      icon: 'check-square',
    },
    {
      id: '6',
      title: t('features.gallery.title'),
      description: t('features.gallery.desc'),
      icon: 'image',
    },
    {
      id: '7',
      title: t('features.cloud.title'),
      description: t('features.cloud.desc'),
      icon: 'cloud',
    },
    {
      id: '8',
      title: t('features.security.title'),
      description: t('features.security.desc'),
      icon: 'shield',
    },
    {
      id: '9',
      title: t('features.custom.title'),
      description: t('features.custom.desc'),
      icon: 'sliders',
    },
  ];

  const pages = [];
  for (let i = 0; i < allFeatures.length; i += 3) {
    pages.push(allFeatures.slice(i, i + 3));
  }

  const startAutoSlide = () => {
    stopAutoSlide();
    timeoutRef.current = setTimeout(() => {
      let nextPage = currentPage + 1;
      if (nextPage >= pages.length) {
        nextPage = 0;
      }
      scrollViewRef.current?.scrollTo({
        x: nextPage * PAGE_WIDTH,
        animated: true,
      });
      setCurrentPage(nextPage);
    }, AUTO_SLIDE_INTERVAL);
  };

  const stopAutoSlide = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  useEffect(() => {
    startAutoSlide();
    return stopAutoSlide;
  }, [currentPage]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const pageIndex = Math.round(offsetX / PAGE_WIDTH);
    if (pageIndex !== currentPage && pageIndex >= 0 && pageIndex < pages.length) {
      setCurrentPage(pageIndex);
    }
  };

  const handleScrollBeginDrag = () => {
    stopAutoSlide();
  };

  const handleScrollEndDrag = () => {
    startAutoSlide();
  };

  return (
    <View style={styles.carouselContainer}>
      <ScrollView 
        ref={scrollViewRef}
        horizontal 
        showsHorizontalScrollIndicator={false}
        pagingEnabled
        snapToInterval={PAGE_WIDTH}
        decelerationRate="fast"
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEndDrag}
        scrollEventThrottle={16}
      >
        {pages.map((pageFeatures, index) => (
          <View key={`page-${index}`} style={[styles.pageContainer, { width: PAGE_WIDTH }]}>
            {pageFeatures.map((feature) => (
              <View key={feature.id} style={styles.featureCard}>
                <View style={styles.iconContainer}>
                  <Feather name={feature.icon as React.ComponentProps<typeof Feather>['name']} size={24} color={theme.colors.primary} />
                </View>
                <View style={styles.textContainer}>
                  <Text style={styles.featureTitle} numberOfLines={1}>{feature.title}</Text>
                  <Text style={styles.featureDesc} numberOfLines={2}>{feature.description}</Text>
                </View>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>

      <View style={styles.paginationRow}>
        <View style={styles.dotsContainer}>
          {pages.map((_, index) => (
            <View 
              key={`dot-${index}`} 
              style={[
                styles.dot, 
                currentPage === index ? styles.activeDot : null,
                currentPage === index ? { width: 16 } : null
              ]} 
            />
          ))}
        </View>
        <Text style={styles.swipeText}>
          {currentPage === pages.length - 1 ? t('features.swipeToStart') : t('features.swipeToExplore')}
        </Text>
      </View>
    </View>
  );
};
