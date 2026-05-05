import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { subjectDetailStyles as styles } from '../styles/SubjectDetail.styles';

interface SubjectStatCardProps {
  icon: string;
  label: string;
  value: string;
  note: string;
  color: string;
}

/**
 * SubjectStatCard.tsx
 *
 * Componente visual tipo "tarjeta" utilizado en el dashboard de una materia para
 * mostrar una estadística rápida (ej. porcentaje completado, promedio actual).
 * Renderiza un ícono con fondo translúcido, un valor central grande y notas adicionales.
 *
 * @param icon - Nombre del ícono de Ionicons a mostrar.
 * @param label - Título o etiqueta de la estadística (ej. "Promedio").
 * @param value - Valor principal a destacar (ej. "4.5").
 * @param note - Nota secundaria o texto de tendencia.
 * @param color - Color base hexadecimal que teñirá el ícono y su fondo.
 */
export const SubjectStatCard: React.FC<SubjectStatCardProps> = ({
  icon,
  label,
  value,
  note,
  color,
}) => {
  return (
    <View style={styles.statCard}>
      <View style={styles.statHeader}>
        <View style={[styles.statIcon, { backgroundColor: `${color}18` }]}>
          <Ionicons name={icon as any} size={16} color={color} />
        </View>
        <Text style={styles.statLabel} numberOfLines={2}>{label}</Text>
      </View>
      <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.statNote} numberOfLines={2}>{note}</Text>
    </View>
  );
};
