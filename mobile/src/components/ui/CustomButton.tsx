import React from 'react';
import { TouchableOpacity, Text, StyleSheet, TouchableOpacityProps, ActivityIndicator } from 'react-native';
import { theme } from '../../styles/theme';
import { customButtonStyles as styles } from '../../styles/CustomButton.styles';

interface CustomButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'outline';
  loading?: boolean;
}

/**
 * CustomButton.tsx
 *
 * Componente de botón reutilizable que envuelve un `TouchableOpacity`.
 * Provee dos variantes visuales ('primary' y 'outline') e incluye soporte
 * integrado para estado de carga (`loading`), renderizando un `ActivityIndicator`
 * y deshabilitando la interacción automáticamente.
 *
 * @param title - Texto a mostrar dentro del botón.
 * @param variant - Estilo visual del botón ('primary' por defecto o 'outline').
 * @param loading - Si es `true`, deshabilita el botón y muestra un spinner.
 */
export const CustomButton: React.FC<CustomButtonProps> = ({ 
  title, 
  variant = 'primary', 
  loading = false, 
  style, 
  ...props 
}) => {
  const isPrimary = variant === 'primary';
  
  return (
    <TouchableOpacity
      style={[
        styles.button,
        isPrimary ? styles.primaryButton : styles.outlineButton,
        props.disabled && styles.disabled,
        style
      ]}
      disabled={props.disabled || loading}
      activeOpacity={0.8}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? theme.colors.text.white : theme.colors.text.primary} />
      ) : (
        <Text style={[
          styles.text,
          isPrimary ? styles.primaryText : styles.outlineText
        ]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};
