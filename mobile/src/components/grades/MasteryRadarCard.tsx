import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { globalStyles } from '../../styles/globalStyles';
import { theme } from '../../styles/theme';
import { gradesStyles } from '../../styles/Grades.styles';
import { MasteryRadar } from '../MasteryRadar';

interface MasteryRadarCardProps {
  userId: number;
  selectedSubjectId: number | null;
  onPressInfo: () => void;
  onExpand?: () => void;
  t: any;
}

export const MasteryRadarCard: React.FC<MasteryRadarCardProps> = ({
  userId,
  selectedSubjectId,
  onPressInfo,
  onExpand,
  t,
}) => {
  return (
    <View style={gradesStyles.card}>
      <View style={[globalStyles.rowBetweenCenter, globalStyles.mb16]}>
        <Text style={gradesStyles.sectionTitle}>
          {t('grades.mastery', 'Dominio de Aprendizaje')}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <TouchableOpacity onPress={onPressInfo} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="information-circle-outline" size={20} color={theme.colors.text.secondary} />
          </TouchableOpacity>
        </View>
      </View>
      <MasteryRadar
        userId={userId}
        subjectId={selectedSubjectId || 'all'}
        onPress={onExpand}
      />
    </View>
  );
};
