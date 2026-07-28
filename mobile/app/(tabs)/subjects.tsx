import React, { useMemo, useState, useCallback, useEffect, Profiler } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, ScrollView, Modal, Pressable, InteractionManager, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter, useFocusEffect } from 'expo-router';
import { globalStyles } from '../../src/styles/globalStyles';
import { theme } from '../../src/styles/theme';
import { subjectsStyles as styles } from '../../src/styles/Subjects.styles';
import { AutoUploadIndicator } from '../../src/components/ui/AutoUploadIndicator';
import { OfflineIndicator } from '../../src/components/ui/OfflineIndicator';
import { ExplanationOverlay } from '../../src/components/evaluation/ExplanationOverlay';
import { useSubjects, ACTIVITY_CONFIG } from '../../src/hooks/useSubjects';
import { ScheduleGrid, ScheduleModal } from '../../src/components/subjects/ScheduleGrid';
import { SCALE_MAX } from '../../src/utils/grades';
import { useGroupedSubjects } from '../../src/hooks/useGroupedSubjects';
import { SubjectCard } from '../../src/components/subjects/SubjectCard';
import { SubjectGridSection } from '../../src/components/subjects/SubjectGridSection';
import { openCourseLink } from '../../src/utils/linking';
import { ZyrenIngestionModal } from '../../src/components/subjects/ZyrenIngestionModal';
import { CreateSubjectModal } from '../../src/components/dashboard/CreateSubjectModal';
import { MomentumService } from '../../src/services/MomentumService';
import { useDataStore } from '../../src/store/useDataStore';
import { updateSubject, updateCourseCounters } from '../../src/services/api/subjects';
import { FilterDropdown } from '../../src/components/ui/FilterDropdown';
import { OptionSelectorModal, SelectorOption } from '../../src/components/ui/OptionSelectorModal';
import { ExpandableSearchBar } from '../../src/components/common/ExpandableSearchBar';

const MomentumCard = ({ score }: { score: number }) => {
  const isDanger = score < 0.5;
  return (
    <View style={[
      styles.miniCard,
      isDanger && styles.miniCardInRisk,
    ]}>
      <Text style={isDanger ? styles.miniCardTitleRisk : styles.miniCardTitle}>MOMENTUM</Text>
      <Text style={isDanger ? styles.miniCardValueRisk : styles.miniCardValue}>
        {isDanger ? '⚠' : '🔥'} {Math.round(score * 100)}%
      </Text>
    </View>
  );
};

let moduleEvalTime = performance.now();
let firstRenderTime = 0;

export default function SubjectsScreen() {
  if (firstRenderTime === 0) {
    firstRenderTime = performance.now();
  }
  
  const { t, i18n } = useTranslation();
  const router = useRouter();
  
  const startUseSubjects = performance.now();
  const g = useSubjects(t);
  const endUseSubjects = performance.now();
  const courses = useDataStore(s => s.courses);
  const loadAllData = useDataStore(s => s.loadAllData);
  const refreshSubjects = useDataStore(s => s.refreshSubjects);
  const refreshCourses = useDataStore(s => s.refreshCourses);
  const { groupedSections, toggleCourse, collapsedCourses, aggregatedMomentumScore } = useGroupedSubjects(courses, g.filteredSubjects);


  // Carga inicial: los datos ya están en el store gracias al BootstrapManager.
  // No llamamos a loadAllData() aquí para evitar colapsar el bridge.
  
  useEffect(() => {
    const commitTime = performance.now();
    console.log(`[PerfProfile] Module Eval -> First Render: ${(firstRenderTime - moduleEvalTime).toFixed(1)} ms`);
    console.log(`[PerfProfile] First Render -> Commit: ${(commitTime - firstRenderTime).toFixed(1)} ms`);
    console.log(`[PerfProfile] useSubjects() duration: ${(endUseSubjects - startUseSubjects).toFixed(1)} ms`);
  }, []);

  useFocusEffect(
    useCallback(() => {
      const focusTime = performance.now();
      console.log(`[PerfProfile] Focus acquired at: ${(focusTime - firstRenderTime).toFixed(1)} ms since first render`);
      g.loadActivityFeed().then(() => {
        console.log(`[PerfProfile] ActivityFeed loaded: ${(performance.now() - focusTime).toFixed(1)} ms after focus`);
      });
    }, [g.loadActivityFeed])
  );

  const [zyrenModalVisible, setZyrenModalVisible] = useState(false);
  const [zyrenSubject, setZyrenSubject] = useState<{
    id: string;
    name: string;
    courseId?: string | null;
    courseName?: string;
    milestone?: string;
    color?: string;
    icon?: string;
  } | null>(null);

  const [isCreationMenuVisible, setIsCreationMenuVisible] = useState(false);
  const [isCreateSubjectModalVisible, setIsCreateSubjectModalVisible] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [courseModalVisible, setCourseModalVisible] = useState(false);
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const handleProfile = useCallback((id: string, phase: string, actualDuration: number) => {
    if (phase === 'mount') {
      console.log(`[PerfProfile] Deferred section '${id}' mount time: ${actualDuration.toFixed(1)} ms`);
    }
  }, []);

  useEffect(() => {
    InteractionManager.runAfterInteractions(() => {
      setIsReady(true);
    });
  }, []);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
    g.setSearch('');
  }, [g.setSearch]);

  const handleClassComplete = useCallback((subject: any, courseName: string) => {
    setZyrenSubject({
      id: subject.id,
      name: subject.name,
      courseId: subject.course_id,
      courseName,
      milestone: subject.next_micro_milestone || subject.next_milestone,
      color: subject.color,
      icon: subject.icon,
    });
    setZyrenModalVisible(true);

    const newCompleted = (subject.completed_lessons || 0) + 1;
    updateSubject(subject.id, { completed_lessons: newCompleted })
      .then(() => refreshSubjects())
      .then(() => {
        if (subject.course_id) {
          return updateCourseCounters(subject.course_id)
            .then(() => refreshCourses())
            .then(() => MomentumService.boostMomentum(subject.course_id).catch(console.warn));
        }
      })
      .catch((e) => {
        console.warn('[handleClassComplete] Error persisting completed_lessons:', e);
      });
  }, [refreshSubjects, refreshCourses]);

  const getCoursePlatform = useCallback((courseId?: string | null): string | undefined => {
    if (!courseId) return undefined;
    return courses.find(c => c.id === courseId)?.platform;
  }, [courses]);

  const handleContinueClass = useCallback(async (url: string, platform?: string, subject?: any, courseName?: string) => {
    await openCourseLink(url, platform, {
      subjectId: subject?.id,
      courseId: subject?.course_id,
      onVideoEnd: () => {
        if (subject) {
          handleClassComplete(subject, courseName || '');
        }
      }
    });
  }, [handleClassComplete]);

  const overallGpa = useMemo(() => {
    const scored = g.enrichedSubjects.filter(s => (s.avg_score ?? 0) > 0);
    if (scored.length === 0) return 0;
    const sum = scored.reduce((acc, s) => {
      const raw = s.avg_score ?? 0;
      return acc + (raw > SCALE_MAX * 2 ? (raw / 100) * SCALE_MAX : raw);
    }, 0);
    return sum / scored.length;
  }, [g.enrichedSubjects]);

  const approvedCount = useMemo(() => {
    return g.enrichedSubjects.filter(s => {
      const raw = s.avg_score ?? 0;
      if (raw === 0) return false;
      const avg = raw > SCALE_MAX * 2 ? (raw / 100) * SCALE_MAX : raw;
      const threshold = s.target_grade ?? 3.0;
      return avg >= threshold;
    }).length;
  }, [g.enrichedSubjects]);

  const coursesForPills = useMemo(() => {
    return groupedSections
      .filter(s => s.courseId !== 'independent' && s.courseId)
      .map(s => ({ id: s.courseId as string, name: s.courseName, platform: s.coursePlatform }));
  }, [groupedSections]);

  const displayedSubjects = useMemo(() => {
    if (selectedCourseId === null) return g.filteredSubjects;
    const section = groupedSections.find(s => (s.courseId ?? 'independent') === selectedCourseId);
    return section?.data ?? [];
  }, [selectedCourseId, groupedSections, g.filteredSubjects]);

  const selectedCourseName = useMemo(() => {
    if (!selectedCourseId) return '';
    return groupedSections.find(s => (s.courseId ?? 'independent') === selectedCourseId)?.courseName ?? '';
  }, [selectedCourseId, groupedSections]);

  const courseOptions: SelectorOption[] = useMemo(() => {
    return coursesForPills.map(c => ({ id: c.id, name: c.name }));
  }, [coursesForPills]);

  const handleSubjectPress = useCallback((s: any) => {
    router.push(`/subjects/${s.id}`);
  }, [router]);

  const handleContinueSubject = useCallback((s: any) => {
    if (s.external_url) {
      handleContinueClass(s.external_url, getCoursePlatform(s.course_id), s, s.courseName || selectedCourseName);
    }
  }, [handleContinueClass, getCoursePlatform, selectedCourseName]);

  const handleCompleteSubject = useCallback((s: any) => {
    handleClassComplete(s, s.courseName || selectedCourseName);
  }, [handleClassComplete, selectedCourseName]);

  const handleCreateSubject = useCallback(() => {
    setIsCreationMenuVisible(true);
  }, []);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={globalStyles.safeArea}>
      <View style={styles.header}>
        <View style={[globalStyles.row, { justifyContent: 'space-between', flex: 1 }]}>
          <View>
            <View style={globalStyles.row}>
              <Ionicons name="book-outline" size={18} color={theme.colors.primary} style={globalStyles.mr8} />
              <Text style={styles.headerTitle}>{t('subjects.title') || 'Materias'}</Text>
              <AutoUploadIndicator size={16} />
            </View>
            <OfflineIndicator />
          </View>
          <View style={globalStyles.row}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => isSearchOpen ? closeSearch() : setIsSearchOpen(true)}
            >
              <Feather name={isSearchOpen ? 'x' : 'search'} size={18} color={theme.colors.text.secondary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.addBtn} onPress={() => setIsCreationMenuVisible(true)}>
              <Ionicons name="add" size={20} color={theme.colors.text.inverse} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {isSearchOpen && (
        <ExpandableSearchBar
          value={g.search}
          onChangeText={g.setSearch}
          placeholder={t('subjects.searchPlaceholder')}
          autoFocus
          onClear={() => g.setSearch('')}
        />
      )}

      <FlatList
        data={[]}
        keyExtractor={(_, index) => `item-${index}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll]}
        renderItem={() => null}
        ListEmptyComponent={
          g.filteredSubjects.length === 0 ? (
            <View style={[globalStyles.center, { paddingVertical: 48 }]}>
              <MaterialCommunityIcons name="book-open-variant" size={40} color="rgba(255,255,255,0.1)" />
              <Text style={[{ color: theme.colors.text.secondary }, { marginTop: 12 }]}>
                {g.search ? t('subjects.noResults', 'Sin resultados') : t('subjects.noSubjects', 'Agrega tu primera materia')}
              </Text>
              {!g.search && (
                <TouchableOpacity
                  style={[{ marginTop: 16 }, styles.addBtn, { width: 'auto', paddingHorizontal: 16, borderRadius: 20, flexDirection: 'row', gap: 6 }]}
                  onPress={() => setIsCreationMenuVisible(true)}
                >
                  <Ionicons name="add" size={16} color={theme.colors.text.inverse} />
                  <Text style={{ color: theme.colors.text.inverse, fontWeight: '700', fontSize: 13 }}>{t('subjects.newSubject', 'Nueva materia')}</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null
        }
        ListFooterComponent={isReady && g.subjects.length > 0 ? (
          <Profiler id="ScheduleGrid" onRender={handleProfile}>
            <ScheduleGrid onPress={() => setScheduleModalVisible(true)} />
          </Profiler>
        ) : null}
        ListHeaderComponent={
          g.subjects.length > 0 ? (
            <>
              {/* ── Hero: Resumen del semestre ── */}
              {isReady && (
                <Profiler id="Hero" onRender={handleProfile}>
                  <View style={styles.semesterHero}>
                <View style={styles.gpaAmbientGlow} />
                <View style={styles.heroArc1} />
                <View style={styles.heroArc2} />
                <View style={styles.heroArc3} />

                <View style={styles.heroContentRow}>
                  <View style={styles.gpaContainer}>
                    <View style={styles.semesterGpaCircle}>
                      <Text style={styles.semesterGpaValue}>{overallGpa.toFixed(1)}</Text>
                      <Text style={styles.semesterGpaLabel}>{t('subjects.semesterGpa')}</Text>
                    </View>
                  </View>

                  <View style={styles.miniGridContainer}>
                    <View style={styles.miniCard}>
                      <Text style={styles.miniCardTitle}>{t('subjects.totalSubjects', { defaultValue: 'MATERIAS' })}</Text>
                      <Text style={styles.miniCardValue}>{g.subjects.length}</Text>
                    </View>

                    <View style={styles.miniCard}>
                      <Text style={styles.miniCardTitle}>{t('subjects.semesterCredits', { defaultValue: 'CRÉDITOS' })}</Text>
                      <Text style={styles.miniCardValue}>
                        {g.totalCredits}
                        <Text style={styles.miniCardSub}>cr</Text>
                      </Text>
                    </View>

                    <View style={styles.miniCard}>
                      <Text style={styles.miniCardTitle}>{t('subjects.semesterApproved', { defaultValue: 'APROBADAS' })}</Text>
                      <Text style={styles.miniCardValue}>{approvedCount}</Text>
                    </View>

                    <MomentumCard score={aggregatedMomentumScore} />
                  </View>
                </View>

                <View style={styles.heroEngineRow}>
                  <View style={styles.heroEngineChip}>
                    <Text style={styles.heroEngineIcon}>⚡</Text>
                    <Text style={styles.heroEngineText}>
                      {g.dueDecksToday > 0
                        ? `${g.dueDecksToday} mazo${g.dueDecksToday !== 1 ? 's' : ''} para hoy`
                        : 'Sin repasos pendientes'}
                    </Text>
                  </View>
                  {g.studyStreak > 0 && (
                    <>
                      <Text style={styles.heroEngineSep}>·</Text>
                      <View style={styles.heroEngineChip}>
                        <Text style={styles.heroEngineIcon}>🔥</Text>
                        <Text style={styles.heroEngineText}>Racha: {g.studyStreak} día{g.studyStreak !== 1 ? 's' : ''}</Text>
                      </View>
                    </>
                  )}
                  </View>
                </View>
                </Profiler>
              )}

              {/* ── Atención necesaria: lista compacta ── */}
              {g.criticalSubjects.length > 0 && (
                <View style={styles.criticalSection}>
                  <View style={styles.criticalHeader}>
                    <Text style={styles.criticalIcon}>⚠</Text>
                    <Text style={styles.criticalTitle}>Atención necesaria</Text>
                    <Text style={styles.criticalCount}>({g.criticalSubjects.length})</Text>
                  </View>
                  <View style={styles.criticalList}>
                    {g.criticalSubjects.map((subject, idx) => {
                      const raw = subject.avg_score ?? 0;
                      const avg = raw > SCALE_MAX * 2 ? (raw / 100) * SCALE_MAX : raw;
                      const color = subject.color || '#FF2D55';
                      return (
                        <TouchableOpacity
                          key={subject.id || idx}
                          style={styles.criticalRow}
                          activeOpacity={0.7}
                          onPress={() => router.push(`/subjects/${subject.id}`)}
                        >
                          <View style={[styles.criticalDot, { backgroundColor: color }]} />
                          <Text style={styles.criticalRowName} numberOfLines={1}>{subject.name}</Text>
                          <Text style={styles.criticalRowScore}>{avg.toFixed(1)}</Text>
                          <View style={styles.criticalRowAction}>
                            <Text style={styles.criticalRowActionText}>{t('subjects.reviewAction')}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* ── Actividad reciente ── */}
              {isReady && g.recentActivity.length > 0 && (
                <Profiler id="Timeline" onRender={handleProfile}>
                  <View style={styles.timelineSection}>
                  <View style={styles.timelineHeader}>
                    <Text style={styles.timelineTitle}>{t('subjects.recentActivityTitle')}</Text>
                  </View>
                  <View style={styles.timelineCard}>
                    <ScrollView style={{ maxHeight: 170 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                      {g.recentActivity.map((item, idx, arr) => {
                        const config = ACTIVITY_CONFIG[item.type];
                        return (
                          <View key={item.id || idx} style={[styles.timelineItem, idx < arr.length - 1 && { position: 'relative' }]}>
                            <View style={[styles.timelineDot, { backgroundColor: item.subjectColor, justifyContent: 'center', alignItems: 'center' }]}>
                              <Ionicons name={config.icon as any} size={8} color="#FFFFFF" />
                            </View>
                            {idx < arr.length - 1 && <View style={styles.timelineLine} />}
                            <View style={styles.timelineContent}>
                              <Text style={styles.timelineName} numberOfLines={1}>{item.title}</Text>
                              <Text style={styles.timelineMeta}>
                                <Text style={{ color: config.color, fontWeight: '600' }}>{config.label}</Text> • {item.subjectName}
                              </Text>
                              {item.subtitle ? <Text style={[styles.timelineMeta, { marginTop: 1 }]} numberOfLines={1}>{item.subtitle}</Text> : null}
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                              <Text style={styles.timelineTime}>{item.relativeTime}</Text>
                              <Text style={[styles.timelineTime, { marginTop: 2, fontWeight: '400', fontSize: 8, opacity: 0.7 }]}>
                                {new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short' }).format(item.date)}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </ScrollView>
                  </View>
                  </View>
                </Profiler>
              )}

              {/* ── Bounded Subjects Grid ── */}
              <SubjectGridSection
                subjects={displayedSubjects}
                courseName={selectedCourseName}
                subHeader={
                  coursesForPills.length > 0 ? (
                    <View style={{ flexDirection: 'row' }}>
                      <FilterDropdown
                        label={t('dashboard.course', { defaultValue: 'Curso' })}
                        value={selectedCourseName}
                        iconName="folder"
                        onPress={() => setCourseModalVisible(true)}
                        isActive={!!selectedCourseId}
                      />
                    </View>
                  ) : undefined
                }
                onSubjectPress={handleSubjectPress}
                onContinue={handleContinueSubject}
                onComplete={handleCompleteSubject}
                onCreateSubject={handleCreateSubject}
              />
            </>
          ) : null
        }
      />

      {isReady && (
        <Profiler id="Modals" onRender={handleProfile}>
          <>
            <ExplanationOverlay
            visible={g.overlayVisible}
            explanation={g.overlayText}
            onDismiss={() => g.setOverlayVisible(false)}
          />

          <CreateSubjectModal
            visible={isCreateSubjectModalVisible}
            onClose={() => {
              setIsCreateSubjectModalVisible(false);
              loadAllData(true);
              refreshCourses();
            }}
          />

          <Modal visible={isCreationMenuVisible} transparent animationType="fade" onRequestClose={() => setIsCreationMenuVisible(false)}>
            <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} onPress={() => setIsCreationMenuVisible(false)}>
              <Pressable style={{ backgroundColor: theme.colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 }} onPress={() => null}>
                <View style={{ width: 36, height: 3, backgroundColor: theme.colors.border, borderRadius: 1.5, alignSelf: 'center', marginBottom: 16 }} />
                <Text style={{ fontSize: 18, fontWeight: '700', color: theme.colors.text.primary, marginBottom: 14 }}>¿Qué deseas crear?</Text>

                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: theme.colors.background, borderRadius: 12, marginBottom: 10 }}
                  onPress={() => { setIsCreationMenuVisible(false); setTimeout(() => setIsCreateSubjectModalVisible(true), 300); }}
                >
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.primary + '15', justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
                    <Ionicons name="book" size={20} color={theme.colors.primary} />
                  </View>
                  <View>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: theme.colors.text.primary }}>Nueva Materia / Módulo</Text>
                    <Text style={{ fontSize: 13, color: theme.colors.text.secondary, marginTop: 2 }}>Para clases individuales de tu Universidad</Text>
                  </View>
                </TouchableOpacity>
              </Pressable>
            </Pressable>
          </Modal>

          {zyrenSubject && (
            <ZyrenIngestionModal
              visible={zyrenModalVisible}
              onClose={() => setZyrenModalVisible(false)}
              courseName={zyrenSubject.courseName || ''}
              subjectName={zyrenSubject.name}
              subjectId={zyrenSubject.id}
              subjectColor={zyrenSubject.color}
              subjectIcon={zyrenSubject.icon}
              currentMilestone={zyrenSubject.milestone}
            />
          )}

          <OptionSelectorModal
            visible={courseModalVisible}
            title={t('subjects.selectCourse', { defaultValue: 'Seleccionar curso' })}
            options={courseOptions}
            selectedId={selectedCourseId}
            onSelect={setSelectedCourseId}
            onClose={() => setCourseModalVisible(false)}
            clearLabel={t('subjects.clearCourse', { defaultValue: 'Quitar filtro de curso' })}
          />

          <ScheduleModal
            visible={scheduleModalVisible}
            onClose={() => setScheduleModalVisible(false)}
          />
          </>
        </Profiler>
      )}
    </SafeAreaView>
  );
}
