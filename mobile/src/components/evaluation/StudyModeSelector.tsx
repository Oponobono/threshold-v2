/**
 * StudyModeSelector.tsx
 *
 * Selector visual de modo de generación con IA.
 * Muestra 4 opciones: Flashcards, ECAES (Selección múltiple), V/F, Mixto.
 */
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { s } from '../../styles/StudyModeSelector.styles';
import { StudyMode } from '../../services/api/types';

interface ModeConfig {
  mode: StudyMode;
  icon: string;
  label: string;
  description: string;
  color: string;
  bg: string;
}

const MODES: ModeConfig[] = [
  { mode: 'flashcard', icon: '🃏', label: 'Flashcards', description: 'Classic front and back', color: '#5C6BC0', bg: '#EDE7F6' },
  { mode: 'multiple_choice', icon: '🎯', label: 'ECAES', description: '4 options, 1 correct', color: '#00897B', bg: '#E0F2F1' },
  { mode: 'boolean', icon: '⚖️', label: 'V / F', description: 'True or False', color: '#F57C00', bg: '#FFF3E0' },
  { mode: 'mixed', icon: '🔀', label: 'Mixed', description: 'Combines all types', color: '#D81B60', bg: '#FCE4EC' },
];

interface Props {
  selected: StudyMode;
  onSelect: (mode: StudyMode) => void;
}

export const StudyModeSelector: React.FC<Props> = ({ selected, onSelect }) => {
  const { t } = useTranslation();
  const translatedModes = MODES.map(m => ({
    ...m,
    label: t(`evaluation.mode.${m.mode}`, m.label),
    description: t(`evaluation.mode.${m.mode}Desc`, m.description),
  }));
  return (
  <View>
    <Text style={s.sectionTitle}>{t('evaluation.studyType')}</Text>
    <View style={s.grid}>
      {translatedModes.map((cfg) => {
        const isActive = selected === cfg.mode;
        return (
          <TouchableOpacity
            key={cfg.mode}
            style={[s.modeCard, isActive && { borderColor: cfg.color, backgroundColor: cfg.bg }]}
            onPress={() => onSelect(cfg.mode)}
            activeOpacity={0.75}
          >
            <Text style={s.modeIcon}>{cfg.icon}</Text>
            <Text style={[s.modeLabel, isActive && { color: cfg.color }]}>{cfg.label}</Text>
            <Text style={s.modeDesc}>{cfg.description}</Text>
            {isActive && <View style={[s.activeDot, { backgroundColor: cfg.color }]} />}
          </TouchableOpacity>
        );
      })}
    </View>
  </View>
);
};
