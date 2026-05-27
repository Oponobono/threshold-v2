import React from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { globalStyles } from '../../src/styles/globalStyles';
import { theme } from '../../src/styles/theme';
import { subjectsStyles as styles } from '../../src/styles/Subjects.styles';
import { SubjectHeroCard } from '../../src/components/subjects/SubjectHeroCard';
import { AutoUploadIndicator } from '../../src/components/ui/AutoUploadIndicator';
import { ExplanationOverlay } from '../../src/components/evaluation/ExplanationOverlay';
import { useSubjects } from '../../src/hooks/useSubjects';
import { SubjectPills } from '../../src/components/subjects/SubjectPills';
import { GradeCalculator } from '../../src/components/subjects/GradeCalculator';
import { AssessmentsSection } from '../../src/components/subjects/AssessmentsSection';
import { SCALE_MAX } from '../../src/utils/grades';

export default function SubjectsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const g = useSubjects(t);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={globalStyles.safeArea}>
      <View style={styles.header}>
        <View style={globalStyles.row}>
          <Ionicons name="book-outline" size={20} color={theme.colors.primary} style={globalStyles.mr8} />
          <Text style={styles.headerTitle}>{t('subjects.title') || 'Materias'}</Text>
          <AutoUploadIndicator size={18} />
        </View>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={theme.colors.text.secondary} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('subjects.searchPlaceholder')}
            placeholderTextColor={theme.colors.text.secondary}
            value={g.search}
            onChangeText={g.setSearch}
          />
        </View>
        <TouchableOpacity style={styles.filterBtn}>
          <Feather name="sliders" size={18} color={theme.colors.text.primary} />
        </TouchableOpacity>
      </View>

      <SubjectPills
        subjects={g.filteredSubjects}
        selectedSubject={g.selectedSubject}
        onSelect={g.setSelectedSubject}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {g.selectedSubject ? (
          <View style={styles.section}>
            <SubjectHeroCard
              color={g.selectedSubject.color}
              iconName={g.selectedSubject.icon}
              title={g.selectedSubject.name}
              subtitle={g.selectedSubject.professor || t('subjects.noProfessor')}
              meta={`${g.selectedSubject.credits || 0} ${t('subjects.credits')}`}
              progress={g.selectedSubject.completion_percent || 0}
              avgScore={(g.selectedSubject.avg_score ?? 0) > SCALE_MAX * 2 ? ((g.selectedSubject.avg_score ?? 0) / 100) * SCALE_MAX : (g.selectedSubject.avg_score ?? 0)}
              displayLabel={g.selectedSubject.display_label}
              displayColor={g.selectedSubject.display_color}
              gpaEquivalent={g.selectedSubject.gpa_equivalent}
              onPress={() => router.push(`/subjects/${g.selectedSubject!.id}`)}
            />
          </View>
        ) : (
          <View style={[globalStyles.center, { paddingVertical: 40 }]}>
            <MaterialCommunityIcons name="book-open-variant" size={48} color="rgba(255,255,255,0.1)" />
            <Text style={[{ color: theme.colors.text.secondary }, globalStyles.mt16]}>
              {t('subjects.selectSubjectToView', 'Selecciona una materia para ver detalles')}
            </Text>
          </View>
        )}

        <GradeCalculator
          selectedSubject={g.selectedSubject}
          currentGrade={g.currentGrade}
          requiredPass={g.requiredPass}
          remainingWeight={g.remainingWeight}
          minNeeded={g.minNeeded}
          maxAchievable={g.maxAchievable}
          onCurrentGradeChange={g.setCurrentGrade}
          onRequiredPassChange={g.setRequiredPass}
          onRemainingWeightChange={g.setRemainingWeight}
          onSimulate={g.handleSimulate}
          onReset={g.handleReset}
          onSaveTarget={g.handleSaveTarget}
          onInfoPress={() => {
            g.setOverlayText('**Calculadora de Salvavidas**\n\nEsta herramienta utiliza álgebra simple para responder la pregunta: *"¿Cuánto necesito sacar en el examen final para pasar?"*\n\nSi la nota necesaria es mayor a tu meta (ej. necesitas 4.15 para lograr 4.0), se pondrá en color naranja porque es un reto exigente.\n\nNo usa tendencias históricas como el simulador global, es solo un cálculo exacto.');
            g.setOverlayVisible(true);
          }}
          t={t}
        />

        {g.selectedSubject && (
          <AssessmentsSection
            subject={g.selectedSubject}
            assessments={g.subjectAssessments}
            t={t}
          />
        )}
      </ScrollView>

      <ExplanationOverlay
        visible={g.overlayVisible}
        explanation={g.overlayText}
        onDismiss={() => g.setOverlayVisible(false)}
      />
    </SafeAreaView>
  );
}
