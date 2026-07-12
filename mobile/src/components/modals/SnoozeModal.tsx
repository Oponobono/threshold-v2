/**
 * SnoozeModal.tsx
 * 
 * Modal flotante para seleccionar el período de aplazamiento de tarjetas vencidas.
 * Diseño minimalista alineado con la filosofía de aprendizaje de la app.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { styles } from '../../styles/SnoozeModal.styles';
import { SNOOZE_OPTIONS, SnoozeOption } from '../../hooks/useDueCardSnooze';
import { useTranslation } from 'react-i18next';

interface SnoozeModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (option: SnoozeOption) => void;
  isLoading?: boolean;
}

const { height } = Dimensions.get('window');

export const SnoozeModal: React.FC<SnoozeModalProps> = ({
  visible,
  onClose,
  onSelect,
  isLoading = false,
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(height)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: height,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  const handleSelect = (option: SnoozeOption) => {
    onSelect(option);
    // El padre es responsable de cerrar el modal
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Overlay semi-transparente */}
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      />

      {/* Modal flotante */}
      <Animated.View
        style={[
          styles.container,
          {
            transform: [{ translateY: slideAnim }],
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        <View style={styles.content}>
          <ScrollView 
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ flexGrow: 1 }}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>{t('flashcards.snoozeTitle', '¿Aplazar la revisión?')}</Text>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="x" size={24} color={theme.colors.text.primary} />
              </TouchableOpacity>
            </View>

            {/* Descripción */}
            <Text style={styles.description}>
              {t('flashcards.snoozeDescription', 'Elige cuándo quieres que aparezca la revisión nuevamente. Esto mantiene tu momentum de aprendizaje.')}
            </Text>

            {/* Opciones de snooze */}
            <View style={styles.optionsContainer}>
              {SNOOZE_OPTIONS.map((option, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.optionButton, index < SNOOZE_OPTIONS.length - 1 && styles.optionButtonBorder]}
                  onPress={() => handleSelect(option)}
                  disabled={isLoading}
                  activeOpacity={0.7}
                >
                  <View style={styles.optionContent}>
                    <View style={styles.optionLeft}>
                      <View style={styles.iconContainer}>
                        <MaterialCommunityIcons
                          name={option.icon as any}
                          size={22}
                          color={theme.colors.primary}
                        />
                      </View>
                      <View style={styles.optionText}>
                        <Text style={styles.optionLabel}>{t(option.labelKey)}</Text>
                        <Text style={styles.optionDescription}>{t(option.descriptionKey)}</Text>
                      </View>
                    </View>
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={20}
                      color={theme.colors.text.secondary}
                    />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Footer pedagogical note - Sticky */}
          <View style={styles.footer}>
            <MaterialCommunityIcons
              name="lightbulb-on-outline"
              size={16}
              color={theme.colors.warning}
            />
            <Text style={styles.footerText}>
              {t('flashcards.snoozeScience', 'Los períodos están diseñados según ciencia del aprendizaje espaciado.')}
            </Text>
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
};
