import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';
import { globalStyles } from '../styles/globalStyles';
import { subjectDetailStyles as styles } from '../styles/SubjectDetail.styles';
import { SubjectIcon } from './SubjectIcon';

interface SubjectHeroCardProps {
  color?: string | null;
  iconName?: string | null;
  title: string;
  subtitle: string;
  meta: string;
  progress?: number;
  avgScore?: number;
  displayLabel?: string | null;
  displayColor?: string | null;
  gpaEquivalent?: number | null;
  onDelete?: () => void;
  onPress?: () => void;
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
  progress,
  avgScore,
  displayLabel,
  displayColor,
  gpaEquivalent,
  onDelete,
  onPress,
}) => {
  const Container = onPress ? TouchableOpacity : View;
  return (
    <Container 
      style={[styles.heroCard, { padding: 12, borderRadius: 16 }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.8 : 1}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
          <View style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            backgroundColor: color || '#5856D6',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <SubjectIcon iconName={iconName} color="#fff" size={20} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.heroTitle, { fontSize: 16, marginBottom: 0 }]} numberOfLines={1}>
              {title}
            </Text>
            <Text style={[styles.heroSubtitle, { fontSize: 12, opacity: 0.8 }]} numberOfLines={1}>
              {subtitle}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 8, fontWeight: '800', color: theme.colors.text.secondary, textTransform: 'uppercase', marginBottom: -2 }}>
              Promedio
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
              <Text style={{ fontSize: 18, fontWeight: '900', color: displayColor || theme.colors.text.primary }}>
                {avgScore?.toFixed(1) || '0.0'}
              </Text>
              {displayLabel && (
                <Text style={{ fontSize: 12, fontWeight: '700', color: displayColor || theme.colors.primary, opacity: 0.8 }}>
                  ≈ {displayLabel}
                </Text>
              )}
            </View>
          </View>

          {onDelete && (
            <TouchableOpacity 
              onPress={onDelete} 
              style={{ padding: 4 }}
            >
              <Ionicons name="trash-outline" size={16} color="#FF2D55" />
            </TouchableOpacity>
          )}

          {onPress && (
            <View style={{ marginLeft: -2, marginRight: -4, opacity: 0.5 }}>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.text.primary} />
            </View>
          )}
        </View>
      </View>

      {/* Progress & Meta Row (Very compact) */}
      <View style={{ marginTop: 4 }}>
        <View style={{ height: 3, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 1.5, overflow: 'hidden', marginBottom: 6 }}>
          <View 
            style={{ 
              height: '100%', 
              width: `${Math.min(progress || 0, 100)}%`, 
              backgroundColor: color || theme.colors.primary,
              borderRadius: 1.5
            }} 
          />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[styles.heroMeta, { fontSize: 10 }]}>{meta}</Text>
          <Text style={{ fontSize: 9, fontWeight: '800', color: theme.colors.text.secondary }}>
            {Math.round(progress || 0)}% COMPLETADO
          </Text>
        </View>
      </View>
    </Container>
  );
};
