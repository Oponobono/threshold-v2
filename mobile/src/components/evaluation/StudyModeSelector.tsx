/**
 * StudyModeSelector.tsx
 *
 * Selector visual de modo de generación con IA.
 * Muestra 4 opciones: Flashcards, ECAES (Selección múltiple), V/F, Mixto.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { theme } from '../../styles/theme';
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
  { mode: 'flashcard', icon: '🃏', label: 'Flashcards', description: 'Frente y reverso clásico', color: '#5C6BC0', bg: '#EDE7F6' },
  { mode: 'multiple_choice', icon: '🎯', label: 'ECAES', description: '4 opciones, 1 correcta', color: '#00897B', bg: '#E0F2F1' },
  { mode: 'boolean', icon: '⚖️', label: 'V / F', description: 'Verdadero o Falso', color: '#F57C00', bg: '#FFF3E0' },
  { mode: 'mixed', icon: '🔀', label: 'Mixto', description: 'Combina todos los tipos', color: '#D81B60', bg: '#FCE4EC' },
];

interface Props {
  selected: StudyMode;
  onSelect: (mode: StudyMode) => void;
}

export const StudyModeSelector: React.FC<Props> = ({ selected, onSelect }) => (
  <View>
    <Text style={s.sectionTitle}>Tipo de estudio</Text>
    <View style={s.grid}>
      {MODES.map((cfg) => {
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

const s = StyleSheet.create({
  sectionTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.text.primary, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  modeCard: {
    width: '47.5%', backgroundColor: theme.colors.inputBackground,
    borderRadius: 16, padding: 14, borderWidth: 1.5,
    borderColor: theme.colors.border, alignItems: 'center', gap: 4,
  },
  modeIcon: { fontSize: 26 },
  modeLabel: { fontSize: 13, fontWeight: '700', color: theme.colors.text.primary },
  modeDesc: { fontSize: 11, color: theme.colors.text.secondary, textAlign: 'center' },
  activeDot: { width: 6, height: 6, borderRadius: 3, marginTop: 2 },
});
