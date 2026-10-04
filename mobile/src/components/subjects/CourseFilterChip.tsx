import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing, StyleSheet } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';

interface CourseFilterChipProps {
  /** Nombre del curso activo, o undefined/null si es "Todos" */
  selectedCourseName?: string | null;
  /** Número de materias en el curso activo (o total si no hay filtro) */
  subjectCount?: number;
  /** Abre la hoja de selección */
  onPress: () => void;
  /** Limpia el filtro activo */
  onClear: () => void;
}

/**
 * Filter chip persistente para el selector de cursos.
 * Siempre visible; muestra estado activo con fondo tonal + botón × de 44 dp.
 * Sigue el lenguaje de superficies tonales (bento) de la pantalla Materias.
 */
export const CourseFilterChip: React.FC<CourseFilterChipProps> = ({
  selectedCourseName,
  subjectCount,
  onPress,
  onClear,
}) => {
  const isActive = !!selectedCourseName;
  const fillAnim = useRef(new Animated.Value(isActive ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue: isActive ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [isActive, fillAnim]);

  const bgColor = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#EEF2FF', '#4F46E5'], // Indigo-50 inactivo, Indigo-600 activo
  });

  const borderColor = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#C7D2FE', '#4338CA'], // Indigo-200 inactivo, Indigo-700 activo
  });

  const textColor = isActive ? '#FFFFFF' : '#3730A3'; // Blanco activo, Indigo-800 inactivo
  const iconColor = isActive ? '#FFFFFF' : '#4F46E5'; // Blanco activo, Indigo-600 inactivo

  const label = selectedCourseName ?? 'Todos los cursos';
  const accessibilityLabel = isActive
    ? `Filtro de curso activo: ${label}, ${subjectCount ?? 0} materias. Botón para cambiar curso.`
    : 'Filtro de curso: Todos los cursos. Botón para seleccionar un curso.';

  return (
    <View style={styles.row}>
      <Animated.View style={[styles.chip, { backgroundColor: bgColor, borderColor }]}>
        <TouchableOpacity
          style={styles.chipTouchable}
          onPress={onPress}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityHint="Abre el selector de cursos"
        >
          <View style={styles.chipContentCenter}>
            <MaterialCommunityIcons
              name="layers-outline"
              size={14}
              color={iconColor}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.chipLabel, { color: textColor }]} numberOfLines={1}>
              {label}
            </Text>
            {typeof subjectCount === 'number' && (
              <View style={[styles.badge, isActive ? styles.badgeActive : styles.badgeInactive]}>
                <Text style={[styles.badgeText, { color: isActive ? '#4F46E5' : '#FFFFFF' }]}>
                  {subjectCount}
                </Text>
              </View>
            )}
            <Feather
              name="chevron-down"
              size={14}
              color={iconColor}
              style={{ marginLeft: 6 }}
            />
          </View>
        </TouchableOpacity>
      </Animated.View>

      {isActive && (
        <TouchableOpacity
          style={styles.clearBtn}
          onPress={onClear}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={`Quitar filtro de curso ${label}`}
        >
          <Feather name="x" size={14} color="#FFFFFF" />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '100%',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  chip: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: 20,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  chipTouchable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipContentCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 1,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.1,
    flexShrink: 1,
  },
  badge: {
    marginLeft: 6,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeActive: {
    backgroundColor: '#FFFFFF',
  },
  badgeInactive: {
    backgroundColor: '#4F46E5',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '900',
    lineHeight: 12,
  },
  clearBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EF4444', 
    borderWidth: 1.5,
    borderColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
});
