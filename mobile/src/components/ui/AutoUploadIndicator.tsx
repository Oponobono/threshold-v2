import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBackupLogic } from '../../hooks/useBackupLogic';
import { theme } from '../../styles/theme';

interface AutoUploadIndicatorProps {
  size?: number;
  color?: string;
}

/**
 * Indicador visual que muestra si la auto-subida está activada
 * Se usa en los headers de Materias, Galería y Multimedia
 */
export const AutoUploadIndicator: React.FC<AutoUploadIndicatorProps> = ({
  size = 18,
  color = theme.colors.success || '#34C759',
}) => {
  const { prefs } = useBackupLogic();
  const [isAutoUploadEnabled, setIsAutoUploadEnabled] = useState(false);

  useEffect(() => {
    setIsAutoUploadEnabled(prefs.enabled === true);
  }, [prefs.enabled]);

  if (!isAutoUploadEnabled) {
    return null;
  }

  return (
    <View
      style={{
        marginLeft: 8,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Ionicons
        name="cloud-upload"
        size={size}
        color={color}
        style={{ opacity: 1 }}
      />
    </View>
  );
};
