import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';
import { subjectDetailStyles as styles } from '../styles/SubjectDetail.styles';
import { SubjectIcon } from './SubjectIcon';

interface SubjectHeroCardProps {
  color?: string | null;
  iconName?: string | null;
  title: string;
  subtitle: string;
  meta: string;
  onDelete?: () => void;
}

/**
 * SubjectHeroCard.tsx
 *
 * Componente principal (Hero) que encabeza el dashboard de una materia.
 * Renderiza una tarjeta grande con color temático, ícono de la asignatura,
 * nombre, profesor (subtítulo) y un texto meta (ej. información de créditos).
 * Opcionalmente incluye un botón de papelera para desencadenar la eliminación de la materia.
 *
 * @param color - Color principal de la materia (hex).
 * @param iconName - Nombre del ícono que representa la materia.
 * @param title - Nombre principal de la materia.
 * @param subtitle - Texto secundario, comúnmente el nombre del profesor.
 * @param meta - Metadatos adicionales de la materia a mostrar abajo.
 * @param onDelete - (Opcional) Callback si el usuario desea borrar la materia.
 */
export const SubjectHeroCard: React.FC<SubjectHeroCardProps> = ({
  color,
  iconName,
  title,
  subtitle,
  meta,
  onDelete,
}) => {
  return (
    <View style={styles.heroCard}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <View style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          backgroundColor: color || '#DDE7FF',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <SubjectIcon iconName={iconName} color={theme.colors.white} />
        </View>

        {onDelete && (
          <TouchableOpacity 
            onPress={onDelete} 
            style={{ 
              backgroundColor: theme.colors.background, 
              width: 40,
              height: 40,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: theme.colors.border,
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Ionicons name="trash-outline" size={20} color={theme.colors.text.secondary} />
          </TouchableOpacity>
        )}
      </View>

      <View>
        <Text style={styles.heroTitle} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.heroSubtitle} numberOfLines={1}>
          {subtitle}
        </Text>
        <Text style={styles.heroMeta}>{meta}</Text>
      </View>
    </View>
  );
};
