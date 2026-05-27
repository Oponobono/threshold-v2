import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { AutoUploadIndicator } from '../ui/AutoUploadIndicator';

const FILTERS = ['all', 'recording', 'video'] as const;
type FilterValue = (typeof FILTERS)[number];

const LABELS: Record<FilterValue, string> = {
  all: 'recordings.filterAll',
  recording: 'recordings.filterAudio',
  video: 'recordings.filterVideo',
};

const ICONS: Record<FilterValue, keyof typeof Ionicons.glyphMap> = {
  all: 'layers-outline',
  recording: 'mic-outline',
  video: 'logo-youtube',
};

interface Props {
  activeFilter: FilterValue;
  onFilterChange: (f: FilterValue) => void;
}

export const RecordingsFilterPills: React.FC<Props> = ({ activeFilter, onFilterChange }) => {
  const { t } = useTranslation();
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: theme.colors.card,
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: 10,
        gap: 8,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
        alignItems: 'center',
      }}
    >
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {FILTERS.map((f) => {
          const isActive = activeFilter === f;
          return (
            <TouchableOpacity
              key={f}
              onPress={() => onFilterChange(f)}
              activeOpacity={0.72}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                paddingHorizontal: 13,
                paddingVertical: 7,
                borderRadius: 20,
                borderWidth: 1.5,
                borderColor: isActive ? theme.colors.text.primary : theme.colors.border,
                backgroundColor: isActive ? theme.colors.text.primary : 'transparent',
              }}
            >
              <Ionicons
                name={ICONS[f]}
                size={13}
                color={isActive ? theme.colors.white : theme.colors.text.secondary}
              />
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: isActive ? '700' : '500',
                  color: isActive ? theme.colors.white : theme.colors.text.secondary,
                  letterSpacing: -0.1,
                }}
              >
                {t(LABELS[f])}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={{ flex: 1 }} />
      <AutoUploadIndicator size={18} />
    </View>
  );
};
