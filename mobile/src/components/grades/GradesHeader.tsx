import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { globalStyles } from '../../styles/globalStyles';
import { gradesStyles } from '../../styles/Grades.styles';

interface GradesHeaderProps {
  isExportingPdf: boolean;
  onDownloadReport: () => void;
  t: any;
}

export const GradesHeader: React.FC<GradesHeaderProps> = ({ isExportingPdf, onDownloadReport, t }) => {
  return (
    <View style={gradesStyles.header}>
      <View style={globalStyles.row}>
        <Ionicons name="school-outline" size={20} color={theme.colors.primary} style={globalStyles.mr8} />
        <Text style={gradesStyles.logoText}>{t('grades.title') || 'Calificaciones'}</Text>
      </View>
      <View style={globalStyles.row}>
        <TouchableOpacity style={gradesStyles.termPill}>
          <Text style={gradesStyles.termText}>{t('grades.activeTerm')}</Text>
          <Ionicons name="chevron-down" size={14} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={gradesStyles.headerActionBtn}
          onPress={onDownloadReport}
          disabled={isExportingPdf}
        >
          <Ionicons
            name={isExportingPdf ? "hourglass-outline" : "cloud-download-outline"}
            size={22}
            color={theme.colors.text.secondary}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={gradesStyles.headerActionBtn}
          onPress={() => {}}
        >
          <Ionicons name="cloud-upload-outline" size={22} color={theme.colors.text.secondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
};
