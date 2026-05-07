import React, { useState } from 'react';
import { View, Text, ScrollView, Dimensions, TextInput, TouchableOpacity } from 'react-native';
import { alertRef } from '../../src/components/CustomAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LineChart } from 'react-native-chart-kit';
import { globalStyles } from '../../src/styles/globalStyles';
import { theme } from '../../src/styles/theme';
import { gradesStyles as styles } from '../../src/styles/Grades.styles';
import { getAllAssessments, getSubjects } from '../../src/services/api';
import { Assessment, Subject } from '../../src/services/api/types';
import { useFocusEffect } from 'expo-router';

const GRADE_COLORS = (pct: number) => {
  if (pct >= 80) return '#34C759';
  if (pct >= 65) return '#FF9500';
  return '#FF2D55';
};

export default function GradesScreen() {
  const { t } = useTranslation();
  const chartWidth = Math.max(240, Dimensions.get('window').width - theme.spacing.xl * 2 - theme.spacing.lg * 2 - 2);

  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [termGpa, setTermGpa] = useState('0.00');

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [assessData, subjData] = await Promise.all([
        getAllAssessments(),
        getSubjects()
      ]);
      setAssessments(assessData || []);
      setSubjects(subjData || []);

      // Calculate GPA (simple average for now)
      const graded = assessData.filter((a: any) => 
        (a.grade_value !== null && a.grade_value !== undefined) || 
        (a.score !== null && a.score !== undefined)
      );
      if (graded.length > 0) {
        const sum = graded.reduce((acc: number, curr: any) => {
          const val = curr.grade_value ?? (curr.out_of > 0 ? (curr.score / curr.out_of) * 5.0 : 0);
          return acc + val;
        }, 0);
        setTermGpa((sum / graded.length).toFixed(2));
      }
    } catch (error) {
      console.error('Error loading grades data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [])
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

    const addedPct = (s / p) * 100;
    const newGpa = ((3.78 * 3 + (addedPct / 25)) / 4).toFixed(2);
    setProjectedGpa(newGpa);
  };

  const handleResetSim = () => {
    setSimScore('');
    setSimPossible('');
    setProjectedGpa(null);
  };

  const trendSeries = [
    2.92,
    3.08,
    3.01,
    3.17,
    3.24,
    3.15,
    3.27,
    projectedGpa ? Number(projectedGpa) : 3.3,
  ];

  const comparisonSeries = [
    2.96,
    3.02,
    3.12,
    3.2,
    3.16,
    3.23,
    3.21,
    3.29,
  ];

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={globalStyles.safeArea}>
      <View style={styles.header}>
        <View style={globalStyles.row}>
          <Ionicons name="school" size={20} color={theme.colors.primary} style={{ marginRight: 6 }} />
          <Text style={styles.logoText}>Threshold</Text>
        </View>
        <TouchableOpacity style={styles.termPill}>
          <Text style={styles.termText}>{t('grades.activeTerm')}</Text>
          <Ionicons name="chevron-down" size={14} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <View style={globalStyles.row}>
          <TouchableOpacity style={{ marginLeft: 10 }}>
            <Ionicons name="download-outline" size={22} color={theme.colors.text.secondary} />
          </TouchableOpacity>
          <TouchableOpacity style={{ marginLeft: 10 }}>
            <Ionicons name="cloud-upload-outline" size={22} color={theme.colors.text.secondary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.filtersContainer}>
        <View style={styles.filterRow}>
          <TouchableOpacity style={[styles.filterPill, { flex: 1 }]}>
            <Text style={styles.filterText} numberOfLines={1}>{t('grades.filterSubject')}</Text>
            <Ionicons name="chevron-down" size={12} color={theme.colors.text.secondary} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filterPill, { flex: 1 }]}>
            <Text style={styles.filterText} numberOfLines={1}>{t('grades.filterAssessment')}</Text>
            <Ionicons name="chevron-down" size={12} color={theme.colors.text.secondary} />
          </TouchableOpacity>
        </View>
        <View style={styles.filterRow}>
          <TouchableOpacity style={[styles.filterPill, { flex: 1 }]}>
            <Text style={styles.filterText}>{t('grades.dateRange')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.applyBtn}>
            <Text style={styles.applyBtnText}>{t('grades.apply')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <View style={styles.gpaRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.gpaLabel}>{t('grades.termGpa')}</Text>
              <Text style={styles.gpaValue}>{termGpa}</Text>
            </View>
            <View style={styles.divider} />
            <View style={{ flex: 1, paddingLeft: 16 }}>
              <Text style={styles.gpaLabel}>{t('grades.cumulative')}</Text>
              <Text style={styles.gpaValue}>{termGpa}</Text>
            </View>
            <View style={styles.miniSparkline}>
              {assessments.length === 0 ? (
                [40, 40, 40, 40, 40, 40].map((h, i) => (
                  <View key={i} style={[styles.miniBar, { height: `${h}%`, opacity: 0.2 }]} />
                ))
              ) : (
                assessments.filter(a => a.score !== null || a.grade_value !== null).slice(-6).map((a: any, i) => {
                  const score = a.score ?? a.grade_value ?? 0;
                  const outOf = a.out_of ?? 5;
                  const h = Math.max(20, Math.min(100, (score / outOf) * 100));
                  return (
                    <View key={i} style={[styles.miniBar, { height: `${h}%` }]} />
                  );
                })
              )}
            </View>
          </View>
          <Text style={styles.scaleText}>{t('grades.gradingScale')}</Text>
          <View style={styles.projectedRow}>
            <Text style={styles.projectedText}>{t('grades.projected')} </Text>
            <Text style={[styles.projectedText, { fontWeight: '800', color: '#34C759' }]}>3.84</Text>
          </View>
          <TouchableOpacity>
            <Text style={styles.editScaleText}>⚙ {t('grades.editScale')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>{t('grades.assessments')}</Text>
            <View style={globalStyles.row}>
              <TouchableOpacity style={styles.addBtn}>
                <Text style={styles.addBtnText}>{t('grades.add')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.addBtn, styles.bulkBtn]}>
                <Text style={[styles.addBtnText, { color: theme.colors.text.primary }]}>{t('grades.bulk')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {assessments.length === 0 ? (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Text style={{ color: theme.colors.text.secondary }}>{t('subjects.noAssessments')}</Text>
            </View>
          ) : assessments.map((a: any) => {
            const score = a.score || 0;
            const outOf = a.out_of || 5;
            const pct = Math.round((score / outOf) * 100);
            const subject = subjects.find(s => s.id === a.subject_id);
            const color = subject?.color || '#5856D6';

            return (
              <View key={a.id} style={styles.assessCard}>
                <View style={styles.assessTop}>
                  <View style={[styles.assessIconBox, { backgroundColor: color + '20' }]}>
                    <MaterialCommunityIcons name={a.type === 'exam' ? 'file-document' : 'help-circle'} size={22} color={color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.assessName}>{a.name}</Text>
                    <View style={styles.tagsRow}>
                      <View style={[styles.tag, { backgroundColor: color + '20' }]}>
                        <Text style={[styles.tagText, { color: color }]}>{subject?.name || 'Materia'}</Text>
                      </View>
                      <View style={[styles.tag, { backgroundColor: theme.colors.inputBackground }]}>
                        <Text style={styles.tagText}>{a.type || 'Evaluación'}</Text>
                      </View>
                      <Text style={styles.dateText}>{a.date || ''}</Text>
                    </View>
                    <Text style={styles.weightText}>
                      {t('grades.weight')} {a.weight || a.percentage + '%' || '—'} · {t('grades.outOf')} {outOf} {t('grades.pts')}
                    </Text>
                  </View>
                  <View style={styles.scoreBadge}>
                    <Text style={[styles.scoreText, { color: GRADE_COLORS(pct) }]}>
                      {score} / {outOf}
                    </Text>
                    <Text style={[styles.scorePct, { color: GRADE_COLORS(pct) }]}>{pct}%</Text>
                  </View>
                </View>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: GRADE_COLORS(pct) }]} />
                </View>
              </View>
            );
          })}
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
                    data: comparisonSeries,
                    color: () => '#9A9A9A',
                    strokeWidth: 1.8,
                  },
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
              <Text style={styles.currentProjectionValue}>3.63</Text>
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


