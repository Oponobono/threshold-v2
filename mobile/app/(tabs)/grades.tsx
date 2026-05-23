import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, Dimensions, TextInput, TouchableOpacity, InteractionManager, FlatList } from 'react-native';
import { alertRef } from '../../src/components/CustomAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LineChart } from 'react-native-chart-kit';
import { globalStyles } from '../../src/styles/globalStyles';
import { theme } from '../../src/styles/theme';
import { gradesStyles as styles } from '../../src/styles/Grades.styles';
import { normalizeGrade, parseWeight, SCALE_MAX } from '../../src/utils/grades';

import { useFocusEffect } from 'expo-router';
import { useDataStore } from '../../src/store/useDataStore';
import { useSubjectGrades } from '../../src/hooks/useSubjectGrades';
import { MasteryRadar } from '../../src/components/MasteryRadar';
import { getUserId, getCurrentUserProfile } from '../../src/services/api/auth';
import { downloadReport, getGlobalGPAAnalytics } from '../../src/services/api/analytics';

const GRADE_COLORS = (pct: number) => {
  if (pct >= 80) return '#34C759';
  if (pct >= 65) return '#FF9500';
  return '#FF2D55';
};

export default function GradesScreen() {
  const { t } = useTranslation();
  const chartWidth = Math.max(240, Dimensions.get('window').width - theme.spacing.lg * 2 - theme.spacing.lg * 2 - 2);

  const { subjects, assessments, refreshAssessments } = useDataStore();
  
  // Fetch user profile for grading engine integration
  const [profile, setProfile] = React.useState<any>(null);
  React.useEffect(() => {
    getCurrentUserProfile().then(p => setProfile(p)).catch(() => {});
  }, []);

  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [globalGPA, setGlobalGPA] = useState<any>(null);
  const [isLoadingGlobalGPA, setIsLoadingGlobalGPA] = useState(false);

  React.useEffect(() => {
    getUserId().then(id => setUserId(id ? Number(id) : null));
  }, []);

  // Fetch global GPA analytics when viewing all subjects
  React.useEffect(() => {
    if (selectedSubjectId === null && userId) {
      setIsLoadingGlobalGPA(true);
      getGlobalGPAAnalytics()
        .then(data => setGlobalGPA(data))
        .catch(err => {
          console.warn('Failed to fetch global GPA:', err);
          setGlobalGPA(null);
        })
        .finally(() => setIsLoadingGlobalGPA(false));
    } else {
      setGlobalGPA(null);
    }
  }, [selectedSubjectId, userId]);

  const filteredAssessments = useMemo(() => {
    if (selectedSubjectId === null) return assessments;
    return assessments.filter(a => a.subject_id === selectedSubjectId);
  }, [assessments, selectedSubjectId]);

  // Get selected subject for grading engine
  const selectedSubject = useMemo(() => 
    subjects.find(s => s.id === selectedSubjectId) || null,
  [subjects, selectedSubjectId]);

  // Use backend-powered grading engine for all calculations
  const {
    averageGrade,
    projectedGrade: engineProjectedGrade,
    securedPercent,
    deliveredText,
    thresholdStatus,
  } = useSubjectGrades(filteredAssessments, selectedSubject, profile);

  // Evaluaciones que tienen una calificación real (for display purposes)
  const gradedAssessments = useMemo(() => 
    filteredAssessments.filter((a: any) => normalizeGrade(a) !== null),
  [filteredAssessments]);

  // Use averageGrade from engine (which calls backend) instead of local calculation
  const termGpa = averageGrade.toFixed(2);
  
  // Use global GPA if available (when viewing all subjects), otherwise use subject-specific calculations
  const displayGPA = selectedSubjectId === null && globalGPA ? globalGPA.currentAverage?.toFixed(2) : termGpa;
  const displayProjectedGPA = selectedSubjectId === null && globalGPA ? globalGPA.projectedGrade?.toFixed(2) : engineProjectedGrade.toFixed(2);
  const displayDelta = selectedSubjectId === null && globalGPA ? globalGPA.delta : null;

  const [isExportingPdf, setIsExportingPdf] = useState(false);
  
  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        // Forzar refresco de evaluaciones cada vez que el tab recibe foco
        refreshAssessments();
      });
      return () => task.cancel();
    }, [refreshAssessments])
  );

  const [simScore, setSimScore] = useState('');
  const [simPossible, setSimPossible] = useState('');
  const [projectedGpa, setProjectedGpa] = useState<string | null>(null);

  const handleRunSimulation = () => {
    const s = parseFloat(simScore);
    const p = parseFloat(simPossible);
    if (isNaN(s) || isNaN(p) || p === 0) {
      alertRef.show({ title: t('common.error'), message: t('common.enterValidScorePossible'), type: 'error' });
      return;
    }

    const N = gradedAssessments.length;
    const currentGpaVal = parseFloat(displayGPA) || 0;
    // Normalizar la nota simulada a la escala 0-5
    const simNormalized = (s / p) * SCALE_MAX;
    if (N === 0) {
      setProjectedGpa(simNormalized.toFixed(2));
    } else {
      const newGpa = ((currentGpaVal * N + simNormalized) / (N + 1)).toFixed(2);
      setProjectedGpa(newGpa);
    }
  };

  const handleResetSim = () => {
    setSimScore('');
    setSimPossible('');
    setProjectedGpa(null);
  };

  // ══════════════════════════════════════════════════════════════════════════
  // HISTORICAL TREND (from grading engine)
  // The engine calculates projectedGrade which incorporates historical data
  // ══════════════════════════════════════════════════════════════════════════
  const historicalGpas = useMemo(() => {
    const graded = [...gradedAssessments].sort((a: any, b: any) => {
      if (a.date && b.date) {
        try {
          const [da, ma, ya] = a.date.split('-');
          const [db, mb, yb] = b.date.split('-');
          return new Date(`${ya}-${ma}-${da}`).getTime() - new Date(`${yb}-${mb}-${db}`).getTime();
        } catch { return a.id - b.id; }
      }
      return a.id - b.id;
    });

    if (graded.length === 0) return [0, 0];

    let currentSum = 0;
    const points: number[] = [];
    graded.forEach((curr, idx) => {
      const val = normalizeGrade(curr) ?? 0;
      currentSum += val;
      points.push(currentSum / (idx + 1));
    });

    if (points.length === 1) return [0, points[0]];
    return points.slice(-10);
  }, [gradedAssessments]);

  // Use simulation projection if available, otherwise use engine's projected grade
  const trendSeries = projectedGpa 
    ? [...historicalGpas, Number(projectedGpa)]
    : [...historicalGpas, engineProjectedGrade];

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={globalStyles.safeArea}>
      <View style={styles.header}>
        <View style={globalStyles.row}>
          <Ionicons name="school-outline" size={20} color={theme.colors.primary} style={globalStyles.mr8} />
          <Text style={styles.logoText}>{t('grades.title') || 'Calificaciones'}</Text>
        </View>
        <View style={globalStyles.row}>
          <TouchableOpacity style={styles.termPill}>
            <Text style={styles.termText}>{t('grades.activeTerm')}</Text>
            <Ionicons name="chevron-down" size={14} color={theme.colors.text.primary} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={{ marginLeft: 10 }}
            onPress={async () => {
              const uid = await getUserId();
              if (!uid || isExportingPdf) return;
              setIsExportingPdf(true);
              try {
                await downloadReport(uid);
              } catch (e: any) {
                alertRef.show({ title: 'Error', message: e.message || 'No se pudo generar el informe', type: 'error' });
              } finally {
                setIsExportingPdf(false);
              }
            }}
            disabled={isExportingPdf}
          >
            <Ionicons name={isExportingPdf ? "hourglass-outline" : "cloud-download-outline"} size={22} color={theme.colors.text.secondary} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={{ marginLeft: 10 }}
            onPress={() => alertRef.show({ title: 'Próximamente', message: 'La sincronización en la nube estará disponible pronto.', type: 'info' })}
          >
            <Ionicons name="cloud-upload-outline" size={22} color={theme.colors.text.secondary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.filtersContainer}>
        <View style={styles.filterRow}>
          <TouchableOpacity 
            style={[styles.filterPill, { flex: 1, backgroundColor: theme.colors.inputBackground, borderWidth: 1, borderColor: theme.colors.border }]}
            onPress={() => alertRef.show({ title: 'Filtros', message: 'El rango de fechas estará disponible próximamente.', type: 'info' })}
          >
            <Text style={[styles.filterText, { color: theme.colors.text.primary }]}>{t('grades.dateRange')}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.applyBtn}
            onPress={() => alertRef.show({ title: 'Filtros aplicados', message: 'Mostrando todas las notas registradas.', type: 'success' })}
          >
            <Text style={styles.applyBtnText}>{t('grades.apply')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View>
        <FlatList
          horizontal
          data={subjects}
          keyExtractor={(item, index) => item.id ? item.id.toString() : index.toString()}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, gap: 8 }}
          removeClippedSubviews={true}
          maxToRenderPerBatch={8}
          initialNumToRender={5}
          windowSize={5}
          ListHeaderComponent={
            <TouchableOpacity 
              style={{ 
                paddingHorizontal: 16, 
                paddingVertical: 8, 
                borderRadius: 20, 
                backgroundColor: selectedSubjectId === null ? theme.colors.primary : theme.colors.inputBackground,
                borderWidth: 1,
                borderColor: selectedSubjectId === null ? theme.colors.primary : theme.colors.border
              }}
              onPress={() => setSelectedSubjectId(null)}
            >
              <Text style={{ 
                color: selectedSubjectId === null ? '#FFF' : theme.colors.text.primary, 
                fontWeight: '600', 
                fontSize: 13 
              }}>
                {t('common.all', 'Todas')}
              </Text>
            </TouchableOpacity>
          }
          renderItem={({ item: sub }) => (
            <TouchableOpacity 
              style={{ 
                paddingHorizontal: 16, 
                paddingVertical: 8, 
                borderRadius: 20, 
                backgroundColor: selectedSubjectId === sub.id ? (sub.color || theme.colors.primary) : theme.colors.inputBackground,
                borderWidth: 1,
                borderColor: selectedSubjectId === sub.id ? (sub.color || theme.colors.primary) : theme.colors.border
              }}
              onPress={() => setSelectedSubjectId(sub.id)}
            >
              <Text style={{ 
                color: selectedSubjectId === sub.id ? '#FFF' : theme.colors.text.primary, 
                fontWeight: '600', 
                fontSize: 13 
              }}>
                {sub.name}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>


      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          {/* Top Action Row */}
          <View style={[globalStyles.rowBetweenCenter, globalStyles.mb16]}>
            <Text style={styles.sectionTitle}>
              {t('grades.academicPerformance', 'Rendimiento general')}
            </Text>
            <TouchableOpacity 
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.inputBackground, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border }}
              onPress={() => alertRef.show({ title: 'Configuración', message: 'La escala actual se detecta automáticamente de tus notas. La edición manual estará disponible pronto.', type: 'info' })}
            >
              <Ionicons name="settings-outline" size={12} color={theme.colors.text.secondary} style={{ marginRight: 4 }} />
              <Text style={{ fontSize: 10, fontWeight: '700', color: theme.colors.text.secondary }}>
                {t('grades.editScale', 'ESCALA AUTO')}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={[globalStyles.rowCenter, { marginBottom: 20 }]}>
            <View style={[globalStyles.flex1, globalStyles.centerHorizontal]}>
              <Text numberOfLines={2} style={{ fontSize: 11, color: theme.colors.text.secondary, marginBottom: 8, fontWeight: '600', textTransform: 'uppercase', textAlign: 'center' }}>
                {t('grades.termGpa')}
              </Text>
              <Text style={{ fontSize: 44, fontWeight: '900', color: theme.colors.text.primary, letterSpacing: -1, lineHeight: 44 }}>
                {displayGPA}
              </Text>
            </View>
            <View style={{ width: 1, height: 50, backgroundColor: theme.colors.border }} />
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text numberOfLines={2} style={{ fontSize: 11, color: theme.colors.text.secondary, marginBottom: 8, fontWeight: '600', textTransform: 'uppercase', textAlign: 'center' }}>
                {selectedSubjectId === null ? t('grades.cumulative') : t('grades.projected')}
              </Text>
              <Text style={{ fontSize: 44, fontWeight: '900', color: displayDelta && displayDelta > 0 ? '#34C759' : (displayDelta && displayDelta < 0 ? '#FF2D55' : theme.colors.text.secondary), opacity: selectedSubjectId === null && !globalGPA ? 0.6 : 1, letterSpacing: -1, lineHeight: 44 }}>
                {selectedSubjectId === null && globalGPA ? (displayDelta ? displayDelta.toFixed(2) : '-') : displayProjectedGPA}
              </Text>
            </View>
          </View>

          <View style={{ alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 10, color: theme.colors.text.secondary, textTransform: 'uppercase', fontWeight: '700' }}>
              {selectedSubjectId === null && globalGPA ? t('grades.cumulative') : t('grades.projected')}: <Text style={{ color: theme.colors.text.primary }}>{displayProjectedGPA > 0 ? displayProjectedGPA : t('grades.insufficientData', 'Faltan evaluaciones')}</Text>
            </Text>
          </View>

          {/* Full-width elegant sparkline */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 32, gap: 4 }}>
            {gradedAssessments.length === 0 ? (
              Array.from({ length: 12 }).map((_, i) => (
                <View key={i} style={{ flex: 1, height: `${Math.random() * 40 + 20}%`, backgroundColor: theme.colors.text.secondary, opacity: 0.1, borderRadius: 2 }} />
              ))
            ) : (
              gradedAssessments.slice(-12).map((a: any, i, arr) => {
                const val = normalizeGrade(a) ?? 0;
                const h = Math.max(15, Math.min(100, (val / SCALE_MAX) * 100));
                const isLast = i === arr.length - 1;
                return (
                  <View 
                    key={i} 
                    style={{ 
                      flex: 1, 
                      height: `${h}%`, 
                      backgroundColor: isLast ? theme.colors.primary : theme.colors.primary + '40', 
                      borderRadius: 2 
                    }} 
                  />
                );
              })
            )}
          </View>
        </View>

        {/* --- LEARNING ENGINEERING RADAR --- */}
        {userId && (
          <View style={styles.card}>
            <View style={[globalStyles.rowBetweenCenter, globalStyles.mb16]}>
              <Text style={styles.sectionTitle}>
                {t('grades.mastery', 'Dominio de Aprendizaje')}
              </Text>
            </View>
            <MasteryRadar userId={userId} subjectId={selectedSubjectId || 'all'} />
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>{t('grades.assessments')}</Text>
            <View style={globalStyles.row}>
              <TouchableOpacity 
                style={styles.addBtn}
                onPress={() => alertRef.show({ title: 'Añadir nota', message: 'Por favor, usa el menú rápido en el Dashboard de Inicio para añadir notas.', type: 'info' })}
              >
                <Text style={styles.addBtnText}>{t('grades.add')}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.addBtn, styles.bulkBtn]}
                onPress={() => alertRef.show({ title: 'Importación masiva', message: 'La carga masiva estará disponible en la próxima actualización.', type: 'info' })}
              >
                <Text style={[styles.addBtnText, { color: theme.colors.text.primary }]}>{t('grades.bulk')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.card, { padding: 0, overflow: 'hidden' }]}>
            {filteredAssessments.length === 0 ? (
              <View style={{ padding: 32, alignItems: 'center' }}>
                <Ionicons name="document-text-outline" size={32} color={theme.colors.text.secondary} style={{ opacity: 0.5, marginBottom: 8 }} />
                <Text style={{ color: theme.colors.text.secondary, fontSize: 13 }}>{t('subjects.noAssessments', 'No hay evaluaciones')}</Text>
              </View>
            ) : (
              <FlatList
                data={filteredAssessments}
                keyExtractor={(item, index) => item.id ? item.id.toString() : index.toString()}
                scrollEnabled={false}
                removeClippedSubviews={true}
                maxToRenderPerBatch={10}
                initialNumToRender={6}
                windowSize={5}
                renderItem={({ item: a, index }) => {
                  const gradeVal = normalizeGrade(a as any);
                  const weight = parseWeight(a as any);
                  const pct = gradeVal !== null ? Math.round((gradeVal / SCALE_MAX) * 100) : null;
                  const subject = subjects.find(s => s.id === a.subject_id);
                  const color = subject?.color || '#5856D6';
                  const isLast = index === filteredAssessments.length - 1;
                  const isTask = a.type === 'task';
                  const isCompleted = (a as any).is_completed;
                  const isPending = (a as any)._isPending === true;

                  return (
                    <View style={{ padding: 16, borderBottomWidth: isLast ? 0 : 1, borderBottomColor: theme.colors.border, flexDirection: 'row', alignItems: 'center', gap: 14, opacity: isPending ? 0.6 : 1 }}>
                      <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: color + '20', justifyContent: 'center', alignItems: 'center' }}>
                        <MaterialCommunityIcons name={isTask ? 'check-circle' : 'file-document'} size={24} color={pct !== null ? GRADE_COLORS(pct) : theme.colors.text.secondary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                          <Text style={{ fontSize: 14, fontWeight: '700', color: theme.colors.text.primary }} numberOfLines={1}>
                            {a.name}
                          </Text>
                          {isPending && (
                            <View style={{ backgroundColor: theme.colors.warning, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                              <Text style={{ fontSize: 9, fontWeight: '600', color: '#FFF' }}>
                                {t('common.syncing', 'SINCRONIZANDO')}
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={{ fontSize: 11, color: theme.colors.text.secondary, fontWeight: '500' }} numberOfLines={1}>
                          {subject?.name || 'Materia'}
                          <Text style={{ opacity: 0.5 }}> • </Text>
                          {weight > 0 ? `${weight}%` : (a.weight || t('grades.eval', 'Evaluación'))}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                        {pct !== null ? (
                          <>
                            <Text style={{ fontSize: 16, fontWeight: '800', color: GRADE_COLORS(pct) }}>
                              {gradeVal!.toFixed(1)}/{SCALE_MAX}
                            </Text>
                            <Text style={{ fontSize: 11, color: theme.colors.text.secondary, fontWeight: '600', marginTop: 1, textTransform: 'uppercase' }}>
                              {pct}%
                            </Text>
                          </>
                        ) : (
                          <Text style={{ fontSize: 12, color: isTask && isCompleted ? '#34C759' : theme.colors.text.secondary, fontWeight: '600' }}>
                            {isTask ? (isCompleted ? t('common.done', 'Entregada') : t('subjects.pending', 'Pendiente')) : t('subjects.pending', 'Sin nota')}
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                }}
              />
            )}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.projectionHeaderRow}>
            <Text style={styles.sectionTitle}>{t('grades.projectionsSim')}</Text>
          </View>
          <Text style={styles.descText}>{t('grades.projectionsDesc')}</Text>

          <View style={styles.simInputRow}>
            <View style={styles.simInputWrapper}>
              <Text style={styles.simInputLabel}>{t('grades.scoreLabel')}</Text>
              <TextInput
                style={styles.simInput}
                placeholder="0"
                placeholderTextColor={theme.colors.text.placeholder}
                keyboardType="numeric"
                value={simScore}
                onChangeText={setSimScore}
              />
            </View>
            <View style={styles.simInputWrapper}>
              <Text style={styles.simInputLabel}>{t('grades.possibleLabel')}</Text>
              <TextInput
                style={styles.simInput}
                placeholder="0"
                placeholderTextColor={theme.colors.text.placeholder}
                keyboardType="numeric"
                value={simPossible}
                onChangeText={setSimPossible}
              />
            </View>
            <TouchableOpacity style={styles.simAddBtn} onPress={handleRunSimulation}>
              <Ionicons name="add" size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.simChartCard}>
            <LineChart
              data={{
                labels: trendSeries.map(() => ''),
                datasets: [
                  {
                    data: trendSeries,
                    color: () => theme.colors.text.primary,
                    strokeWidth: 2.8,
                  },
                ],
              }}
              width={chartWidth}
              height={140}
              withDots={false}
              withShadow={false}
              withVerticalLabels={false}
              withHorizontalLabels={false}
              withInnerLines={false}
              withOuterLines={false}
              bezier={false}
              fromZero={false}
              chartConfig={{
                backgroundColor: theme.colors.inputBackground,
                backgroundGradientFrom: theme.colors.inputBackground,
                backgroundGradientTo: theme.colors.inputBackground,
                decimalPlaces: 2,
                color: () => theme.colors.text.primary,
                labelColor: () => theme.colors.text.secondary,
                propsForBackgroundLines: {
                  strokeWidth: 0,
                },
                propsForLabels: {
                  fontSize: 0,
                },
              }}
              style={styles.simChart}
            />
          </View>

          <View style={styles.currentProjectionCentered}>
            <Text style={styles.currentProjectionLine} numberOfLines={1}>
              <Text style={styles.currentProjectionLabel}>{t('grades.currentProjection')} </Text>
              <Text style={styles.currentProjectionValue}>{termGpa}</Text>
            </Text>
          </View>

          {projectedGpa && (
            <View style={styles.simSummary}>
              <Text style={styles.simSummaryText}>{t('grades.simSummary')}</Text>
              <Text style={styles.projGpaText}>
                {t('grades.projectedTermGpa')} <Text style={{ color: '#34C759', fontWeight: '900' }}>{projectedGpa}</Text>
              </Text>
            </View>
          )}

          <View style={styles.simActions}>
            <TouchableOpacity style={styles.simActionPrimary} onPress={handleRunSimulation}>
              <Text style={styles.simActionPrimaryText}>{t('grades.run')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.simActionSecondary} onPress={handleResetSim}>
              <Text style={styles.simActionSecondaryText}>{t('grades.reset')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.card, styles.bulkCard]}>
          <View style={{ flexDirection: 'column', flex: 1, gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.sectionTitle}>{t('grades.bulkImport')}</Text>
              <TouchableOpacity style={styles.smallBadgeBtn}>
                <Ionicons name="cloud-upload-outline" size={14} color={theme.colors.text.primary} />
                <Text style={styles.smallBadgeText}>{t('grades.importCsv', 'Importar CSV')}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.descText}>{t('grades.bulkImportDesc')}</Text>
            <TouchableOpacity>
              <Text style={styles.chooseFileText}>{t('grades.chooseFile')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.card, styles.bulkCard]}>
          <View style={{ flexDirection: 'column', flex: 1, gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.sectionTitle}>{t('grades.gpaReport')}</Text>
              <TouchableOpacity 
                style={styles.smallBadgeBtn}
                disabled={isExportingPdf}
                onPress={async () => {
                  const uid = await getUserId();
                  if (!uid || isExportingPdf) return;
                  setIsExportingPdf(true);
                  try {
                    await downloadReport(uid);
                  } catch (e: any) {
                    alertRef.show({ title: 'Error', message: e.message || 'No se pudo generar el informe', type: 'error' });
                  } finally {
                    setIsExportingPdf(false);
                  }
                }}
              >
                <Ionicons name="cloud-download-outline" size={14} color={theme.colors.text.primary} />
                <Text style={styles.smallBadgeText}>
                  {isExportingPdf ? 'Generando...' : 'Exportar PDF'}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.descText}>{t('grades.gpaReportDesc')}</Text>
            <TouchableOpacity>
              <Text style={styles.chooseFileText}>{t('grades.preview')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}