import React from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { globalStyles } from '../../styles/globalStyles';
import { subjectsStyles } from '../../styles/Subjects.styles';
import { getStatusColor, getStatus } from '../../hooks/useSubjects';

interface GradeCalculatorProps {
  selectedSubject: any;
  currentGrade: string;
  requiredPass: string;
  remainingWeight: string;
  minNeeded: number | null;
  maxAchievable: number | null;
  onCurrentGradeChange: (v: string) => void;
  onRequiredPassChange: (v: string) => void;
  onRemainingWeightChange: (v: string) => void;
  onSimulate: () => void;
  onReset: () => void;
  onSaveTarget: () => void;
  onInfoPress: () => void;
  t: any;
}

export const GradeCalculator: React.FC<GradeCalculatorProps> = ({
  selectedSubject,
  currentGrade,
  requiredPass,
  remainingWeight,
  minNeeded,
  maxAchievable,
  onCurrentGradeChange,
  onRequiredPassChange,
  onRemainingWeightChange,
  onSimulate,
  onReset,
  onSaveTarget,
  onInfoPress,
  t,
}) => {
  return (
    <View style={subjectsStyles.calcCard}>
      <TouchableOpacity activeOpacity={0.8} onPress={onInfoPress}>
        <View style={subjectsStyles.calcHeaderRow}>
          <View style={subjectsStyles.calcInfoRow}>
            <Text style={subjectsStyles.calcTitle}>{t('subjects.minGradeTitle')}</Text>
            <Ionicons name="information-circle-outline" size={16} color={theme.colors.text.placeholder} />
          </View>
          <Text style={subjectsStyles.calcSubject}>
            {selectedSubject?.name || t('subjects.selectSubject') || 'Selecciona una materia'}
          </Text>
        </View>
      </TouchableOpacity>

      {!selectedSubject ? (
        <View style={subjectsStyles.calcEmptyState}>
          <MaterialCommunityIcons name="lightbulb-outline" size={40} color="rgba(255,255,255,0.1)" />
          <Text style={subjectsStyles.calcEmptyText}>
            {t('subjects.selectSubjectToCalculate') || 'Selecciona una materia para simular calificaciones'}
          </Text>
        </View>
      ) : (
        <>
          <View style={subjectsStyles.calcLabelsRow}>
            {[
              t('subjects.currentGrade'),
              t('subjects.requiredPass'),
              t('subjects.remainingWeight'),
            ].map((label, i) => (
              <View key={i} style={subjectsStyles.calcLabelBox}>
                <Text style={subjectsStyles.calcInputLabel}>{label}</Text>
              </View>
            ))}
          </View>

          <View style={subjectsStyles.calcInputsRow}>
            {[
              { value: currentGrade, setter: onCurrentGradeChange, placeholder: selectedSubject?.avg_score ? selectedSubject.avg_score.toFixed(1) : '0' },
              { value: requiredPass, setter: onRequiredPassChange, placeholder: selectedSubject?.target_grade ? `${selectedSubject.target_grade}` : '60' },
              { value: remainingWeight, setter: onRemainingWeightChange, placeholder: '%' },
            ].map((field, i) => (
              <View key={i} style={subjectsStyles.calcInputBox}>
                <TextInput
                  style={subjectsStyles.calcInput}
                  keyboardType="numeric"
                  value={field.value}
                  onChangeText={field.setter}
                  placeholder={field.placeholder}
                  placeholderTextColor={theme.colors.text.placeholder}
                  maxLength={5}
                />
              </View>
            ))}
          </View>

          <Text style={subjectsStyles.calcHint}>{t('subjects.minAvgNeeded')}</Text>

          {minNeeded !== null && (
            <>
              <Text style={[subjectsStyles.calcResult, { color: getStatusColor(minNeeded, parseFloat(requiredPass || '60')) }]}>
                {minNeeded}
              </Text>
              <Text style={[subjectsStyles.calcStatus, { color: getStatusColor(minNeeded, parseFloat(requiredPass || '60')) }]}>
                {getStatus(minNeeded, parseFloat(requiredPass || '60'), t)}
              </Text>

              {maxAchievable !== null && minNeeded > (parseFloat(requiredPass || '60') <= 5 ? 5 : parseFloat(requiredPass || '60') <= 10 ? 10 : 100) && (
                <View style={subjectsStyles.calcMaxBox}>
                  <Text style={subjectsStyles.calcMaxLabel}>
                    {t('subjects.maxAchievable', 'Máximo alcanzable')}
                  </Text>
                  <Text style={subjectsStyles.calcMaxValue}>{maxAchievable}</Text>
                </View>
              )}

              <View style={subjectsStyles.statusBar}>
                <View style={[subjectsStyles.statusSegment, { backgroundColor: '#FF2D55', borderTopLeftRadius: 3, borderBottomLeftRadius: 3 }]} />
                <View style={[subjectsStyles.statusSegment, { backgroundColor: '#FF9500' }]} />
                <View style={[subjectsStyles.statusSegment, { backgroundColor: '#34C759', borderTopRightRadius: 3, borderBottomRightRadius: 3 }]} />
              </View>
              <View style={subjectsStyles.statusLegend}>
                <Text style={[subjectsStyles.legendText, { color: '#FF2D55' }]}>● {t('subjects.failRisk')}</Text>
                <Text style={[subjectsStyles.legendText, { color: '#FF9500' }]}>● {t('subjects.borderline')}</Text>
                <Text style={[subjectsStyles.legendText, { color: '#34C759' }]}>● {t('subjects.safe')}</Text>
              </View>
            </>
          )}

          <View style={subjectsStyles.calcActions}>
            <TouchableOpacity style={[subjectsStyles.calcBtn, { flex: 1.2 }]} onPress={onSimulate}>
              <Text style={subjectsStyles.calcBtnText}>{t('subjects.simulate')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[subjectsStyles.calcBtn, subjectsStyles.calcBtnSecondary]} onPress={onSaveTarget}>
              <Text style={subjectsStyles.calcBtnSecText}>{t('common.save')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={subjectsStyles.calcBtnReset} onPress={onReset}>
              <Text style={subjectsStyles.calcBtnSecText}>{t('subjects.reset')}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
};
