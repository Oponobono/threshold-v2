import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { thresholdStyles as styles } from '../../styles/SubjectThreshold.styles';
import { getStatusColor, getStatusIcon, getStatusLabel, darkenColor } from '../../utils/subjectThresholdHelpers';

interface SubjectThresholdProps {
  securedPercent: number;
  finalNeededText: string;
  subjectColor?: string;
  status?: 'safe' | 'caution' | 'risk';
  objectiveGrade?: number | null;
  onPressInfo?: () => void;
}

/**
 * SubjectThreshold.tsx
 *
 * "Threshold" (Umbral) es la métrica principal de la aplicación.
 * Este componente renderiza una tarjeta visual (Bento) detallando qué porcentaje
 * de la materia ya tiene "asegurado" el estudiante frente a lo que aún necesita
 * sacar en el examen final para aprobar.
 * Renderiza una barra de progreso inteligente y un "Status Pill" de riesgo.
 *
 * @param securedPercent - Porcentaje numérico (0 a 100) ya ganado matemáticamente.
 * @param finalNeededText - Texto computado que dicta la nota exacta que falta en el corte final.
 * @param subjectColor - Color temático de la materia, o verde por defecto.
 * @param status - Nivel de riesgo académico evaluado por el motor (safe, caution, risk).
 */
export const SubjectThreshold: React.FC<SubjectThresholdProps> = ({
  securedPercent,
  finalNeededText,
  subjectColor,
  status = 'safe',
  objectiveGrade,
  onPressInfo,
}) => {
  const { t } = useTranslation();
  const clampedPct = Math.max(0, Math.min(100, Math.round(securedPercent)));
  const statusColor = getStatusColor(status);
  const accentColor = subjectColor || statusColor;
  const darkAccentColor = darkenColor(accentColor, 40);

  const renderHighlightedText = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(\d+(?:\.\d+)?%?)/g);
    return parts.map((part, index) => {
      if (/^\d+(?:\.\d+)?%?$/.test(part)) {
        return (
          <Text key={index} style={{ color: darkAccentColor, fontWeight: '800' }}>
            {part}
          </Text>
        );
      }
      return part;
    });
  };

  const buildNeededText = () => {
    let text = finalNeededText;
    if (objectiveGrade) {
      text += t('subjects.thresholdReach') + objectiveGrade;
    }
    return text;
  };

  return (
    <View style={styles.card}>
      {/* Top row: label + status pill + info button */}
      <View style={styles.topRow}>
        <View style={styles.labelGroup}>
          <Text style={styles.eyebrow}>THRESHOLD</Text>
        </View>

        <View style={styles.rightControls}>
          <View style={[styles.statusPill, { backgroundColor: `${statusColor}26` }]}>
            <MaterialCommunityIcons name={getStatusIcon(status) as any} size={13} color={statusColor} />
            <Text style={[styles.statusPillText, { color: statusColor }]}>
              {getStatusLabel(status, t)}
            </Text>
          </View>

          <TouchableOpacity
            onPress={onPressInfo}
            style={styles.infoButton}
          >
            <MaterialCommunityIcons name="information-outline" size={16} color={theme.colors.text.secondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Main score area — horizontal, needed gets more space */}
      <View style={styles.scoreRow}>
        {/* Left: percentage badge */}
        <View style={styles.percentBlock}>
          <Text style={[styles.percentValue, { color: darkAccentColor }]}>
            {clampedPct}
            <Text style={styles.percentSign}>%</Text>
          </Text>
          <Text style={styles.percentLabel}>{t('subjects.secured')}</Text>
        </View>

        {/* Right: what's needed */}
        <View style={styles.neededBlock}>
          <View style={styles.neededHeaderRow}>
            <View style={[styles.neededIconWrap, { backgroundColor: `${accentColor}59` }]}>
              <MaterialCommunityIcons name="target" size={16} color={darkAccentColor} />
            </View>
            <Text style={styles.neededTitle}>{t('subjects.neededLabel')}</Text>
          </View>
          <Text style={[styles.neededValue, { color: theme.colors.text.primary }]}>
            {renderHighlightedText(buildNeededText())}
          </Text>
        </View>
      </View>

      {/* Progress track */}
      <View style={styles.trackWrap}>
        <View style={styles.track}>
          <View
            style={[
               styles.fill,
              {
                width: `${clampedPct}%`,
                backgroundColor: accentColor,
              },
            ]}
          />
          <View style={styles.midMarker} />
        </View>
        <View style={styles.trackLabels}>
          <Text style={styles.trackLabel}>0%</Text>
          <Text style={styles.trackLabel}>50%</Text>
          <Text style={styles.trackLabel}>100%</Text>
        </View>
      </View>
    </View>
  );
};
