import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  return (
    <View style={[gradesStyles.card, gradesStyles.bulkCard]}>
      <View style={gradesStyles.actionCardContent}>
        <View style={gradesStyles.actionCardHeader}>
          <Text style={gradesStyles.sectionTitle}>{title}</Text>
          <TouchableOpacity style={gradesStyles.smallBadgeBtn} onPress={onPress}>
            <Ionicons name={buttonIcon as any} size={14} color={theme.colors.text.primary} />
            <Text style={gradesStyles.smallBadgeText}>{buttonLabel}</Text>
          </TouchableOpacity>
        </View>
        <Text style={gradesStyles.descText}>{description}</Text>
        <TouchableOpacity>
          <Text style={gradesStyles.chooseFileText}>Ver más</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
