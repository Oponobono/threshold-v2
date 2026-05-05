import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../styles/theme';
import { detailStyles as styles } from '../styles/RecordingDetailScreen.styles';
import { useTranslation } from 'react-i18next';

export type AITabType = 'transcription' | 'summary';

interface RecordingAITabsProps {
  activeTab: AITabType;
  onTabPress: (tab: AITabType) => void;
  onSummaryPress: () => void;
  hasTranscription: boolean;
  hasSummary: boolean;
}

/**
 * RecordingAITabs.tsx
 *
 * Fila de botones o pestañas para alternar entre "Transcripción" y "Resumen".
 * Bloquea el botón de resumen si la transcripción no existe, informando al usuario
 * que primero debe transcribir el material para resumirlo.
 *
 * @param activeTab - Cual pestaña está siendo visualizada.
 * @param onTabPress - Callback de navegación entre pestañas.
 * @param onSummaryPress - Se ejecuta si el usuario presiona "Resumen" sin tenerlo generado.
 * @param hasTranscription - Boolean que indica si el documento base (transcripción) ya existe.
 * @param hasSummary - Boolean que indica si el resumen ya fue generado previamente.
 */
export const RecordingAITabs: React.FC<RecordingAITabsProps> = ({
  activeTab,
  onTabPress,
  onSummaryPress,
  hasTranscription,
  hasSummary,
}) => {
  const { t } = useTranslation();

  return (
    <View style={styles.tabRow}>
      <TouchableOpacity 
        style={[styles.tabIcon, activeTab === 'transcription' && styles.tabIconActive]}
        onPress={() => onTabPress('transcription')}
      >
        <Ionicons 
          name="text-outline" 
          size={24} 
          color={activeTab === 'transcription' ? theme.colors.primary : theme.colors.text.secondary} 
        />
        <Text style={styles.tabLabel}>
          {t('dashboard.audioRecorderModal.ai.tabTranscription')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.tabIcon, activeTab === 'summary' && styles.tabIconActive]}
        onPress={() => {
          if (!hasSummary && hasTranscription) onSummaryPress();
          else onTabPress('summary');
        }}
        disabled={!hasTranscription && !hasSummary}
      >
        <MaterialCommunityIcons 
          name="lightbulb-outline" 
          size={24} 
          color={activeTab === 'summary' ? theme.colors.primary : theme.colors.text.secondary} 
        />
        <Text style={styles.tabLabel}>
          {t('dashboard.audioRecorderModal.ai.tabSummary')}
        </Text>
      </TouchableOpacity>
    </View>
  );
};
