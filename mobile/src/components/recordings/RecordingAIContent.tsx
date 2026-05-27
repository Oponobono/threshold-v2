import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { detailStyles } from '../../styles/RecordingDetailScreen.styles';
import { localStyles, markdownStyles } from '../../styles/RecordingAIContent.styles';
import { useTranslation } from 'react-i18next';
import { AITabType } from './RecordingAITabs';
import { AnimatedRegenerateButton } from '../animated/AnimatedRegenerateButton';

interface RecordingAIContentProps {
  activeTab: AITabType;
  onTabPress: (tab: AITabType) => void;
  screenWidth: number;
  isTranscribing: boolean;
  transcription: string | null;
  isSummarizing: boolean;
  summary: string | null;
  onCopy: (text: string | null) => void;
  onStartTranscriptionFlow: () => void;
  onStartSummaryFlow: () => void;
}

/**
 * RecordingAIContent.tsx
 *
 * Componente que muestra los resultados generados por IA (Transcripciones o Resúmenes)
 * para un archivo multimedia específico (Audio o Video). Utiliza `react-native-markdown-display`
 * para dar formato avanzado a la respuesta del LLM. Contiene controles para cambiar entre la
 * pestaña de Transcripción y la pestaña de Resumen.
 *
 * @param activeTab - Pestaña actual seleccionada ('transcription' | 'summary').
 * @param onTabPress - Callback para cambiar la pestaña activa.
 * @param screenWidth - Ancho disponible en pantalla (útil para layouts reactivos).
 * @param isTranscribing - Indica si Groq (Whisper) está procesando la transcripción.
 * @param transcription - Texto completo de la transcripción devuelta.
 * @param isSummarizing - Indica si el LLM está sintetizando el resumen.
 * @param summary - Texto en formato Markdown con el resumen generado.
 * @param onCopy - Permite copiar al portapapeles cualquier bloque de texto.
 * @param onStartTranscriptionFlow - Callback que dispara la petición de OCR/Whisper.
 * @param onStartSummaryFlow - Callback que dispara la petición del resumen estructurado.
 */
export const RecordingAIContent: React.FC<RecordingAIContentProps> = ({
  activeTab,
  onTabPress,
  isTranscribing,
  isSummarizing,
  transcription,
  summary,
  onCopy,
  onStartTranscriptionFlow,
  onStartSummaryFlow,
}) => {
  const { t } = useTranslation();
  const [regenerateCount, setRegenerateCount] = useState(1);
  
  const canGenerateSummary = activeTab === 'summary' && !transcription;

  const renderContent = () => {
    if (activeTab === 'transcription') {
      if (transcription) {
        return (
          <View>
            <Markdown style={markdownStyles}>
              {transcription}
            </Markdown>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
              <AnimatedRegenerateButton 
                 count={regenerateCount} 
                 onRegenerate={() => {
                   setRegenerateCount(0);
                   onStartTranscriptionFlow();
                 }} 
              />
              <TouchableOpacity
                onPress={() => onCopy(transcription)}
                style={[detailStyles.copyBtn, { marginTop: 0, alignSelf: 'auto', paddingVertical: 8 }]}
              >
                <Ionicons name="copy-outline" size={18} color={theme.colors.primary} />
                <Text style={detailStyles.copyBtnText}>
                  {t('common.copy', { defaultValue: 'Copiar' }) === 'common.copy' ? 'Copiar' : t('common.copy', { defaultValue: 'Copiar' })}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      }
      
      if (isTranscribing) {
        return (
          <View style={localStyles.centerContent}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[detailStyles.loadingText, { marginTop: 12 }]}>
              {t('dashboard.audioRecorderModal.ai.loading') || 'Procesando...'}
            </Text>
          </View>
        );
      }

      return (
        <View style={localStyles.centerContent}>
          <TouchableOpacity 
            onPress={onStartTranscriptionFlow} 
            style={localStyles.actionButton}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="text-recognition" size={24} color="white" />
            <Text style={localStyles.actionButtonText}>{t('recordings.startTranscription', 'Iniciar transcripción')}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Summary Tab
    if (summary) {
      return (
        <View>
          <Markdown style={markdownStyles}>
            {summary}
          </Markdown>
          <TouchableOpacity
            onPress={() => onCopy(summary)}
            style={[detailStyles.copyBtn, { marginTop: 16, alignSelf: 'flex-end' }]}
          >
            <Ionicons name="copy-outline" size={18} color={theme.colors.primary} />
            <Text style={detailStyles.copyBtnText}>
              {t('common.copy', { defaultValue: 'Copiar' }) === 'common.copy' ? 'Copiar' : t('common.copy', { defaultValue: 'Copiar' })}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (isSummarizing) {
      return (
        <View style={localStyles.centerContent}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[detailStyles.loadingText, { marginTop: 12 }]}>
            {t('dashboard.audioRecorderModal.ai.loading') || 'Procesando...'}
          </Text>
        </View>
      );
    }

    if (canGenerateSummary) {
      return (
        <View style={localStyles.centerContent}>
          <Ionicons name="information-circle-outline" size={36} color={theme.colors.text.placeholder} />
          <Text style={[detailStyles.transcriptionHint, { marginTop: 12, textAlign: 'center' }]}>
            {t('dashboard.audioRecorderModal.ai.summaryHint') || 'Primero genera la transcripción para poder crear un resumen.'}
          </Text>
        </View>
      );
    }

    return (
      <View style={localStyles.centerContent}>
        <TouchableOpacity 
          onPress={onStartSummaryFlow} 
          style={localStyles.actionButton}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="lightbulb-on-outline" size={24} color="white" />
          <Text style={localStyles.actionButtonText}>{t('recordings.startSummary', 'Iniciar resumen')}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={{ marginTop: 12 }}>
      {/* ── Unified Header Bar ─────────────────────────────── */}
      <View style={localStyles.headerBar}>
        <View style={localStyles.headerTitleContainer}>
          <Text style={localStyles.headerTitle}>
            {activeTab === 'transcription' ? t('dashboard.audioRecorderModal.tabs.transcription', 'Transcripción') : t('dashboard.audioRecorderModal.tabs.summary', 'Resumen IA')}
          </Text>
        </View>

        {/* Tab toggles */}
        <TouchableOpacity
          onPress={() => onTabPress('transcription')}
          style={[
            localStyles.tabToggle,
            activeTab === 'transcription' && localStyles.tabToggleActive
          ]}
        >
          <Ionicons
            name="text-outline"
            size={22}
            color={activeTab === 'transcription' ? theme.colors.primary : theme.colors.text.secondary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => onTabPress('summary')}
          style={[
            localStyles.tabToggle,
            { borderRightWidth: 0 },
            activeTab === 'summary' && localStyles.tabToggleActive
          ]}
        >
          <MaterialCommunityIcons
            name="lightbulb-outline"
            size={22}
            color={activeTab === 'summary' ? theme.colors.primary : theme.colors.text.secondary}
          />
        </TouchableOpacity>
      </View>

      {/* ── Content Card ────────────────────────────────────── */}
      <View style={detailStyles.aiCard}>
        {renderContent()}
      </View>
    </View>
  );
};
