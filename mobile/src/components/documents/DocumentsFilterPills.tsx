import React from 'react';
import { View, ScrollView, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { documentsStyles as styles } from '../../styles/DocumentsScreen.styles';

const FORMAT_LABELS: Record<string, string> = {
  pdf: 'PDF',
  doc: 'DOC',
  xls: 'XLS',
  ppt: 'PPT',
  txt: 'TXT',
  json: 'JSON',
};

interface Props {
  courses: { id: string; name: string }[];
  subjects: { id: string; name: string }[];
  availableFormats: string[];
  activeCourseFilter: string;
  activeSubjectFilter: string;
  activeFormatFilter: string;
  onCourseFilterChange: (id: string) => void;
  onSubjectFilterChange: (id: string) => void;
  onFormatFilterChange: (format: string) => void;
}

export const DocumentsFilterPills: React.FC<Props> = ({
  courses, subjects, availableFormats,
  activeCourseFilter, activeSubjectFilter, activeFormatFilter,
  onCourseFilterChange, onSubjectFilterChange, onFormatFilterChange,
}) => {
  const { t } = useTranslation();
  return (
    <View style={styles.pillsRow}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsContent} style={styles.pillsScroll}>
        <TouchableOpacity
          onPress={() => { onCourseFilterChange('all'); onSubjectFilterChange('all'); }}
          activeOpacity={0.72}
          style={[styles.pill, activeCourseFilter === 'all' && activeSubjectFilter === 'all' && styles.pillActive]}
        >
          <Text style={[styles.pillText, activeCourseFilter === 'all' && activeSubjectFilter === 'all' && styles.pillTextActive]}>
            {t('common.all') || 'Todos'}
          </Text>
        </TouchableOpacity>
        {courses.map((c) => (
          <TouchableOpacity
            key={c.id}
            onPress={() => { onCourseFilterChange(c.id); onSubjectFilterChange('all'); }}
            activeOpacity={0.72}
            style={[styles.pill, activeCourseFilter === c.id && styles.pillActive]}
          >
            <Text style={[styles.pillText, activeCourseFilter === c.id && styles.pillTextActive]}>
              {c.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {subjects.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsContent} style={[styles.pillsScroll, { marginTop: 6 }]}>
          <TouchableOpacity
            onPress={() => onSubjectFilterChange('all')}
            activeOpacity={0.72}
            style={[styles.pill, activeSubjectFilter === 'all' && styles.pillActive]}
          >
            <Text style={[styles.pillText, activeSubjectFilter === 'all' && styles.pillTextActive]}>
              {t('common.all') || 'Todas'}
            </Text>
          </TouchableOpacity>
          {subjects.map((s) => (
            <TouchableOpacity
              key={s.id}
              onPress={() => onSubjectFilterChange(s.id)}
              activeOpacity={0.72}
              style={[styles.pill, activeSubjectFilter === s.id && styles.pillActive]}
            >
              <Text style={[styles.pillText, activeSubjectFilter === s.id && styles.pillTextActive]}>
                {s.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {availableFormats.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsContent} style={[styles.pillsScroll, { marginTop: 6 }]}>
          <TouchableOpacity
            onPress={() => onFormatFilterChange('all')}
            activeOpacity={0.72}
            style={[styles.pill, activeFormatFilter === 'all' && styles.pillActive]}
          >
            <Text style={[styles.pillText, activeFormatFilter === 'all' && styles.pillTextActive]}>
              {t('common.all') || 'Todos'}
            </Text>
          </TouchableOpacity>
          {availableFormats.map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => onFormatFilterChange(f)}
              activeOpacity={0.72}
              style={[styles.pill, activeFormatFilter === f && styles.pillActive]}
            >
              <Text style={[styles.pillText, activeFormatFilter === f && styles.pillTextActive]}>
                {FORMAT_LABELS[f] || f.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
};
