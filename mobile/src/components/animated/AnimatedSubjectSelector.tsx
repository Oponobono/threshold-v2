import React, { useRef } from 'react';
import { Animated, Pressable, View, Text } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { Subject } from '../../services/api';

export interface AnimatedSubjectSelectorProps {
  subjectForId?: Subject;
  onSelect: () => void;
}

/**
 * AnimatedSubjectSelector.tsx
 *
 * Un botón selector visual que permite al usuario escoger o cambiar a qué materia
 * pertenece un elemento (por ejemplo, al guardar un enlace de YouTube).
 * Cuenta con una animación de llenado horizontal de fondo (`fillAnim`) que reacciona
 * al mantener presionado (`onPressIn` y `onPressOut`).
 *
 * @param subjectForId - Objeto de la materia actualmente seleccionada (opcional).
 * @param onSelect - Callback disparado cuando la animación se completa (abre un selector real).
 */
export const AnimatedSubjectSelector: React.FC<AnimatedSubjectSelectorProps> = ({
  subjectForId, onSelect
}) => {
  const { t } = useTranslation();
  const fillAnim = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    if (!subjectForId) return;
    Animated.timing(fillAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        onSelect();
        Animated.timing(fillAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();
      }
    });
  };

  const handlePressOut = () => {
    if (!subjectForId) return;
    Animated.timing(fillAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const widthInterpolation = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%']
  });

  return (
    <Pressable
      onPress={() => { if (!subjectForId) onSelect(); }}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={{
        width: '100%',
        backgroundColor: theme.colors.card,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: subjectForId?.color || theme.colors.border,
        overflow: 'hidden',
        marginBottom: 24,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
      }}
    >
      <Animated.View style={{
        position: 'absolute',
        left: 0, top: 0, bottom: 0,
        width: widthInterpolation,
        backgroundColor: subjectForId ? `${subjectForId.color}30` : 'transparent',
      }} />
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: 14, paddingHorizontal: 16,
      }}>
        {subjectForId ? (
          <View style={{
            width: 24, height: 24, borderRadius: 6,
            backgroundColor: subjectForId.color || theme.colors.primary,
            justifyContent: 'center', alignItems: 'center', position: 'absolute', left: 16,
          }}>
            <MaterialCommunityIcons name={(subjectForId.icon as any) || 'book-outline'} size={14} color="#fff" />
          </View>
        ) : (
          <Ionicons name="albums-outline" size={20} color={theme.colors.text.placeholder} style={{ position: 'absolute', left: 16 }} />
        )}
        <Text style={{
          color: subjectForId ? theme.colors.text.primary : theme.colors.text.placeholder,
          fontSize: 15, fontWeight: '600', textAlign: 'center',
        }}>
          {subjectForId?.name || (t('subjects.noSubjectSelected') || 'Sin materia asignada')}
        </Text>
        <Ionicons name="chevron-down" size={16} color={theme.colors.text.placeholder} style={{ position: 'absolute', right: 16 }} />
      </View>
    </Pressable>
  );
};
