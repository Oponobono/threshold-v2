import React, { useState } from 'react';
import { Modal, View, ScrollView, Dimensions, FlatList, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LineChart } from 'react-native-chart-kit';
import { globalStyles } from '../../src/styles/globalStyles';
import { theme } from '../../src/styles/theme';
import { gradesStyles } from '../../src/styles/Grades.styles';
import { useGrades } from '../../src/hooks/useGrades';
import { ExplanationOverlay } from '../../src/components/evaluation/ExplanationOverlay';
import { MasteryRadarCard } from '../../src/components/grades/MasteryRadarCard';
import { MasteryRadar } from '../../src/components/ui/MasteryRadar';
import { GradesHeader } from '../../src/components/grades/GradesHeader';
import { FilterBar } from '../../src/components/grades/FilterBar';
import { SubjectFilterBar } from '../../src/components/grades/SubjectFilterBar';
import { PerformanceCard } from '../../src/components/grades/PerformanceCard';
import { AssessmentItem } from '../../src/components/grades/AssessmentItem';
import { ProjectionSimulator } from '../../src/components/grades/ProjectionSimulator';
import { ActionCard } from '../../src/components/grades/ActionCard';

export default function GradesScreen() {
  const { t } = useTranslation();
  const chartWidth = Math.max(240, Dimensions.get('window').width - theme.spacing.lg * 2 - theme.spacing.lg * 2 - 2);
  const g = useGrades(t);
  const [expandedChart, setExpandedChart] = useState<'mastery' | 'projection' | null>(null);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={globalStyles.safeArea}>
      <GradesHeader
        isExportingPdf={g.isExportingPdf}
        onDownloadReport={g.handleDownloadReport}
        t={t}
      />

      <FilterBar t={t} />

      <SubjectFilterBar
        subjects={g.subjects}
        selectedSubjectId={g.selectedSubjectId as string | null}
        onSelectSubject={g.setSelectedSubjectId as (id: string | null) => void}
        t={t}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={gradesStyles.scroll}>
        <PerformanceCard
          displayGPA={g.displayGPA}
          displayProjectedGPA={g.displayProjectedGPA}
          displayDelta={g.displayDelta}
          selectedSubjectId={g.selectedSubjectId as string | null}
          selectedSubject={g.selectedSubject}
          globalGpaLetter={g.globalGpaLetter}
          globalProjectedLetter={g.globalProjectedLetter}
          activeSystem={g.activeSystem}
          globalGPA={null}
          gradedAssessments={g.gradedAssessments}
          onPressInfo={() => {
            g.setOverlayText(t('grades.performanceOverlay'));
            g.setOverlayVisible(true);
          }}
          t={t}
        />

        {g.userId != null && (
          <MasteryRadarCard
            userId={g.userId as string}
            selectedSubjectId={g.selectedSubjectId as string | null}
            onPressInfo={() => {
              g.setOverlayText(t('grades.masteryOverlay'));
              g.setOverlayVisible(true);
            }}
            onExpand={() => setExpandedChart('mastery')}
            t={t}
          />
        )}

        <View style={gradesStyles.section}>
          <View style={gradesStyles.sectionHeaderRow}>
            <Text style={gradesStyles.sectionTitle}>{t('grades.assessments')}</Text>
            <View style={globalStyles.row}>
              <View style={gradesStyles.sectionActions}>
                <View style={gradesStyles.addBtn}>
                  <Text style={gradesStyles.addBtnText}>{t('grades.add')}</Text>
                </View>
                <View style={[gradesStyles.addBtn, gradesStyles.bulkBtn]}>
                  <Text style={[gradesStyles.addBtnText, { color: theme.colors.text.primary }]}>{t('grades.bulk')}</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={[gradesStyles.card, { padding: 0, overflow: 'hidden' }]}>
            {g.filteredAssessments.length === 0 ? (
              <View style={gradesStyles.emptyAssessments}>
                <Ionicons name="document-text-outline" size={32} color={theme.colors.text.secondary} style={{ opacity: 0.5, marginBottom: 8 }} />
                <Text style={{ color: theme.colors.text.secondary, fontSize: 13 }}>{t('subjects.noAssessments')}</Text>
              </View>
            ) : (
              <FlatList
                data={g.filteredAssessments}
                keyExtractor={(item, index) => item.id ? item.id.toString() : index.toString()}
                scrollEnabled={false}
                removeClippedSubviews={true}
                maxToRenderPerBatch={10}
                initialNumToRender={6}
                windowSize={5}
                renderItem={({ item: a, index }) => (
                  <AssessmentItem
                    assessment={a}
                    index={index}
                    isLast={index === g.filteredAssessments.length - 1}
                    subject={g.subjects.find(s => s.id === a.subject_id)}
                    t={t}
                  />
                )}
              />
            )}
          </View>
        </View>

        <ProjectionSimulator
          simScore={g.simScore}
          simPossible={g.simPossible}
          projectedGpa={g.projectedGpa}
          trendSeries={g.trendSeries}
          chartWidth={chartWidth}
          termGpa={g.termGpa}
          gradedAssessmentsLength={g.gradedAssessments.length}
          historicalGpasLength={g.historicalGpas.length}
          onScoreChange={g.setSimScore}
          onPossibleChange={g.setSimPossible}
          onRunSim={g.handleRunSimulation}
          onReset={g.handleResetSim}
          onPressInfo={() => {
            g.setOverlayText(t('grades.projectionOverlay'));
            g.setOverlayVisible(true);
          }}
          onExpand={() => setExpandedChart('projection')}
          t={t}
        />

        <ActionCard
          title={t('grades.bulkImport')}
          description={t('grades.bulkImportDesc')}
          buttonLabel={t('grades.importCsv')}
          buttonIcon="cloud-upload-outline"
          onPress={() => {}}
        />

        <ActionCard
          title={t('grades.gpaReport')}
          description={t('grades.gpaReportDesc')}
          buttonLabel={g.isExportingPdf ? t('grades.generating') : t('grades.exportPdf')}
          buttonIcon="cloud-download-outline"
          onPress={g.handleDownloadReport}
        />
      </ScrollView>

      {/* Expanded chart modals */}
      {expandedChart === 'mastery' && g.userId != null && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setExpandedChart(null)}>
          <View style={{
            flex: 1, backgroundColor: 'rgba(0,0,0,0.85)',
            justifyContent: 'center', alignItems: 'center', padding: 24,
          }}>
            <TouchableOpacity
              style={{ position: 'absolute', top: 60, right: 24, zIndex: 10 }}
              onPress={() => setExpandedChart(null)}
            >
              <Ionicons name="close-circle" size={32} color="#fff" />
            </TouchableOpacity>
            <MasteryRadar userId={g.userId} subjectId={(g.selectedSubjectId as string | null) || 'all'} />
          </View>
        </Modal>
      )}

      {expandedChart === 'projection' && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setExpandedChart(null)}>
          <View style={{
            flex: 1, backgroundColor: 'rgba(0,0,0,0.85)',
            justifyContent: 'center', alignItems: 'center', padding: 24,
          }}>
            <TouchableOpacity
              style={{ position: 'absolute', top: 60, right: 24, zIndex: 10 }}
              onPress={() => setExpandedChart(null)}
            >
              <Ionicons name="close-circle" size={32} color="#fff" />
            </TouchableOpacity>
            <View style={{ backgroundColor: '#EEF4FA', borderRadius: 16, padding: 16 }}>
              <LineChart
                data={{
                  labels: g.trendSeries.map((_, i) => {
                    if (i === g.trendSeries.length - 1) return t('grades.projectedLabel');
                    if (g.gradedAssessments.length === 0) return '';
                    if (g.gradedAssessments.length === 1) return i === 0 ? '0' : '1';
                    const startIndex = g.gradedAssessments.length - g.historicalGpas.length;
                    return `${startIndex + i + 1}`;
                  }),
                  datasets: [{
                    data: g.trendSeries,
                    color: () => theme.colors.primary,
                    strokeWidth: 2.8,
                  }],
                }}
                width={Math.min(Dimensions.get('window').width - 64, 500)}
                height={280}
                withDots={true}
                getDotColor={(_, index) =>
                  (index === g.trendSeries.length - 1 && g.projectedGpa) ? '#FF9500' : theme.colors.primary
                }
                withShadow={false}
                withVerticalLabels={true}
                withHorizontalLabels={true}
                withInnerLines={true}
                withOuterLines={true}
                bezier={true}
                fromZero={false}
                yAxisSuffix=""
                yAxisInterval={1}
                chartConfig={{
                  backgroundColor: '#EEF4FA',
                  backgroundGradientFrom: '#EEF4FA',
                  backgroundGradientTo: '#EEF4FA',
                  decimalPlaces: 1,
                  color: () => theme.colors.primary,
                  labelColor: () => theme.colors.text.secondary,
                  style: { borderRadius: 16, paddingRight: 20 },
                  propsForDots: { r: "6", strokeWidth: "2", stroke: '#EEF4FA' },
                  propsForBackgroundLines: { strokeWidth: 1, strokeDasharray: "4", stroke: theme.colors.border || '#e0e0e0' },
                  propsForLabels: { fontSize: 12 },
                }}
                style={{ borderRadius: 16 }}
              />
            </View>
          </View>
        </Modal>
      )}

      <ExplanationOverlay
        visible={g.overlayVisible}
        explanation={g.overlayText}
        onDismiss={() => g.setOverlayVisible(false)}
      />
    </SafeAreaView>
  );
}
