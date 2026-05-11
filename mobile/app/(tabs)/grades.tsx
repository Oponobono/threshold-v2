import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Dimensions, TextInput, TouchableOpacity, InteractionManager, FlatList } from 'react-native';
import { alertRef } from '../../src/components/CustomAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LineChart } from 'react-native-chart-kit';
import { globalStyles } from '../../src/styles/globalStyles';
import { theme } from '../../src/styles/theme';
import { gradesStyles as styles } from '../../src/styles/Grades.styles';


import { useFocusEffect } from 'expo-router';
import { useDataStore } from '../../src/store/useDataStore';

const GRADE_COLORS = (pct: number) => {
  if (pct >= 80) return '#34C759';
  if (pct >= 65) return '#FF9500';
  return '#FF2D55';
};

export default function GradesScreen() {
  const { t } = useTranslation();
  const chartWidth = Math.max(240, Dimensions.get('window').width - theme.spacing.xl * 2 - theme.spacing.lg * 2 - 2);

  const { subjects, assessments, loadAllData } = useDataStore();

  const [termGpa, setTermGpa] = useState('0.00');
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);

  const filteredAssessments = useMemo(() => {
    if (selectedSubjectId === null) return assessments;
    return assessments.filter(a => a.subject_id === selectedSubjectId);
  }, [assessments, selectedSubjectId]);

  React.useEffect(() => {
    const graded = filteredAssessments.filter((a: any) => 
      (a.grade_value !== null && a.grade_value !== undefined) || 
      (a.score !== null && a.score !== undefined)
    );
    if (graded.length > 0) {
      let maxVal = Math.max(...graded.map((a: any) => Number(a.grade_value) || 0));
      let inferredScale = 5.0;
      if (maxVal > 10) inferredScale = 100.0;
      else if (maxVal > 5) inferredScale = 10.0;

      const sum = graded.reduce((acc: number, curr: any) => {
        if (curr.grade_value !== null && curr.grade_value !== undefined) {
           return acc + Number(curr.grade_value);
        }
        const outOf = curr.out_of && curr.out_of > 0 ? curr.out_of : inferredScale;
        return acc + ((curr.score || 0) / outOf) * inferredScale;
      }, 0);
      setTermGpa((sum / graded.length).toFixed(2));
    } else {
      setTermGpa('0.00');
    }
  }, [filteredAssessments]);

  useFocusEffect(
    React.useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        loadAllData();
      });
      return () => task.cancel();
    }, [loadAllData])
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

    let maxScale = 5.0;
    const currentGpaVal = parseFloat(termGpa) || 0;
    if (currentGpaVal > 10) maxScale = 100.0;
    else if (currentGpaVal > 5) maxScale = 10.0;

    const N = filteredAssessments.filter(a => a.score !== null || a.grade_value !== null).length;
    if (N === 0) {
      setProjectedGpa(((s / p) * maxScale).toFixed(2));
    } else {
      const newGpa = ((currentGpaVal * N + ((s / p) * maxScale)) / (N + 1)).toFixed(2);
      setProjectedGpa(newGpa);
    }
  };

  const handleResetSim = () => {
    setSimScore('');
    setSimPossible('');
    setProjectedGpa(null);
  };

  const historicalGpas = useMemo(() => {
    const graded = filteredAssessments.filter((a: any) => 
      (a.grade_value !== null && a.grade_value !== undefined) || 
      (a.score !== null && a.score !== undefined)
    ).sort((a: any, b: any) => {
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
    
    let maxVal = Math.max(...graded.map((a: any) => Number(a.grade_value) || 0));
    let inferredScale = 5.0;
    if (maxVal > 10) inferredScale = 100.0;
    else if (maxVal > 5) inferredScale = 10.0;

    let currentSum = 0;
    const points: number[] = [];
    graded.forEach((curr, idx) => {
      let val = 0;
      if (curr.grade_value !== null && curr.grade_value !== undefined) {
         val = Number(curr.grade_value);
      } else {
         const outOf = curr.out_of && curr.out_of > 0 ? curr.out_of : inferredScale;
         val = ((curr.score || 0) / outOf) * inferredScale;
      }
      currentSum += val;
      points.push(currentSum / (idx + 1));
    });

    if (points.length === 1) return [0, points[0]];
    return points.slice(-10);
  }, [filteredAssessments]);

  const trendSeries = projectedGpa 
    ? [...historicalGpas, Number(projectedGpa)] 
    : historicalGpas;

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
            onPress={() => alertRef.show({ title: 'Próximamente', message: 'La descarga de reportes estará disponible pronto.', type: 'info' })}
          >
            <Ionicons name="download-outline" size={22} color={theme.colors.text.secondary} />
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
                {termGpa}
              </Text>
            </View>
            <View style={{ width: 1, height: 50, backgroundColor: theme.colors.border }} />
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text numberOfLines={2} style={{ fontSize: 11, color: theme.colors.text.secondary, marginBottom: 8, fontWeight: '600', textTransform: 'uppercase', textAlign: 'center' }}>
                {t('grades.cumulative')}
              </Text>
              <Text style={{ fontSize: 44, fontWeight: '900', color: theme.colors.text.secondary, opacity: 0.6, letterSpacing: -1, lineHeight: 44 }}>
                {termGpa}
              </Text>
            </View>
          </View>

          <View style={{ alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 10, color: theme.colors.text.secondary, textTransform: 'uppercase', fontWeight: '700' }}>
              {t('grades.projected', 'Proyectado')}: <Text style={{ color: theme.colors.text.primary }}>{t('grades.insufficientData', 'Faltan evaluaciones')}</Text>
            </Text>
          </View>

          {/* Full-width elegant sparkline */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 32, gap: 4 }}>
            {filteredAssessments.length === 0 ? (
              Array.from({ length: 12 }).map((_, i) => (
                <View key={i} style={{ flex: 1, height: `${Math.random() * 40 + 20}%`, backgroundColor: theme.colors.text.secondary, opacity: 0.1, borderRadius: 2 }} />
              ))
            ) : (
              filteredAssessments.filter(a => a.score !== null || a.grade_value !== null).slice(-12).map((a: any, i, arr) => {
                const score = a.score ?? a.grade_value ?? 0;
                const outOf = a.out_of ?? 5;
                const h = Math.max(15, Math.min(100, (score / outOf) * 100));
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
                scrollEnabled={false} // Since it's inside a ScrollView
                removeClippedSubviews={true}
                maxToRenderPerBatch={10}
                initialNumToRender={6}
                windowSize={5}
                renderItem={({ item: a, index }) => {
                  const score = a.grade_value !== null && a.grade_value !== undefined ? a.grade_value : (a.score || 0);
                  const outOf = a.out_of || (a.grade_value !== null && a.grade_value !== undefined ? 5 : 5);
                  const pct = Math.round((score / outOf) * 100);
                  const subject = subjects.find(s => s.id === a.subject_id);
                  const color = subject?.color || '#5856D6';
                  const isLast = index === filteredAssessments.length - 1;

                  return (
                    <View style={{ padding: 16, borderBottomWidth: isLast ? 0 : 1, borderBottomColor: theme.colors.border, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                      <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: color + '20', justifyContent: 'center', alignItems: 'center' }}>
                        <MaterialCommunityIcons name={a.type === 'exam' ? 'file-document' : 'check-circle'} size={24} color={theme.colors.text.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: theme.colors.text.primary, marginBottom: 2 }} numberOfLines={1}>
                          {a.name}
                        </Text>
                        <Text style={{ fontSize: 11, color: theme.colors.text.secondary, fontWeight: '500' }} numberOfLines={1}>
                          {subject?.name || 'Materia'} 
                          <Text style={{ opacity: 0.5 }}> • </Text> 
                          {a.percentage ? `${a.percentage}%` : (a.weight || t('grades.eval', 'Evaluación'))}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: GRADE_COLORS(pct) }}>
                          {pct}%
                        </Text>
                        <Text style={{ fontSize: 11, color: theme.colors.text.secondary, fontWeight: '600', marginTop: 1, textTransform: 'uppercase' }}>
                          {score} / {outOf}
                        </Text>
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
          <View style={styles.bulkCardInner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>{t('grades.bulkImport')}</Text>
              <Text style={styles.descText}>{t('grades.bulkImportDesc')}</Text>
              <TouchableOpacity>
                <Text style={styles.chooseFileText}>{t('grades.chooseFile')}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.importBtn}>
              <Ionicons name="cloud-upload" size={18} color="#fff" />
              <Text style={styles.importBtnText}>{t('grades.importCsv')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.card, styles.bulkCard]}>
          <View style={styles.bulkCardInner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>{t('grades.gpaReport')}</Text>
              <Text style={styles.descText}>{t('grades.gpaReportDesc')}</Text>
              <TouchableOpacity>
                <Text style={styles.chooseFileText}>{t('grades.preview')}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={[styles.importBtn, { backgroundColor: '#FF9500' }]}>
              <Ionicons name="print-outline" size={18} color="#fff" />
              <Text style={styles.importBtnText}>{t('grades.exportPrint')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}