import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { gradesStyles } from '../../styles/Grades.styles';

interface ActionCardProps {
  title: string;
  description: string;
  buttonLabel: string;
  buttonIcon: string;
  onPress: () => void;
}

export const ActionCard: React.FC<ActionCardProps> = ({
  title,
  description,
  buttonLabel,
  buttonIcon,
  onPress,
}) => {
  const { t } = useTranslation();
  return (
    <View style={gradesStyles.card}>
      <View style={gradesStyles.actionCardContent}>
        <View style={gradesStyles.actionCardHeader}>
          <Text style={gradesStyles.sectionTitle}>{title}</Text>
        </View>
        <Text style={gradesStyles.descText}>{description}</Text>
        <TouchableOpacity style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center' }} onPress={onPress}>
          <Ionicons name={buttonIcon as any} size={16} color={theme.colors.primary} style={{ marginRight: 6 }} />
          <Text style={gradesStyles.chooseFileText}>{buttonLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
