import React from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const IONICON_NAMES = new Set([
  'book-outline',
  'time-outline',
  'calendar-outline',
  'images-outline',
  'school',
  'grid-outline',
  'clipboard-outline',
  'flask-outline',
  'language-outline',
  'chatbubble-outline',
]);

interface SubjectIconProps {
  iconName?: string | null;
  color: string;
  size?: number;
}

/**
 * SubjectIcon.tsx
 *
 * Componente utilitario para renderizar un icono dinámico basado en un nombre (string).
 * Verifica si el nombre proporcionado pertenece a la librería `Ionicons` (lista predefinida),
 * y si no, recurre por defecto a `MaterialCommunityIcons`.
 *
 * @param iconName - Nombre del icono (ej. 'book-outline', 'school'). Por defecto: 'book-outline'.
 * @param color - Color del icono.
 * @param size - Tamaño del icono en píxeles. Por defecto: 26.
 */
export const SubjectIcon: React.FC<SubjectIconProps> = ({ iconName, color, size = 26 }) => {
  const name = iconName || 'book-outline';
  if (IONICON_NAMES.has(name)) {
    return <Ionicons name={name as any} size={size} color={color} />;
  }
  return <MaterialCommunityIcons name={name as any} size={size} color={color} />;
};
