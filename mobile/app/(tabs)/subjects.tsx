import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, InteractionManager, FlatList } from 'react-native';
import { alertRef } from '../../src/components/CustomAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect, useRouter } from 'expo-router';
import { globalStyles } from '../../src/styles/globalStyles';
import { theme } from '../../src/styles/theme';
import { subjectsStyles as styles } from '../../src/styles/Subjects.styles';
import { updateSubject } from '../../src/services/api';
import { SubjectHeroCard } from '../../src/components/SubjectHeroCard';
import { Subject } from '../../src/services/api/types';
import { useDataStore } from '../../src/store/useDataStore';
import { AutoUploadIndicator } from '../../src/components/AutoUploadIndicator';
import { ExplanationOverlay } from '../../src/components/evaluation/ExplanationOverlay';



const getStatusColor = (minNeeded: number, target: number) => {
  const maxScale = target <= 5 ? 5 : target <= 10 ? 10 : 100;
  if (minNeeded > maxScale) return '#FF2D55'; // Impossible
  if (minNeeded > target) return '#FF9500'; // Hard
  return '#34C759'; // Safe
};

const getStatus = (minNeeded: number, target: number, t: any) => {
  const maxScale = target <= 5 ? 5 : target <= 10 ? 10 : 100;
  if (minNeeded > maxScale) return t('subjects.statusImpossible') || 'Inalcanzable';
  if (minNeeded > target) return t('subjects.statusAtRisk') || 'Exigente / En Riesgo';
  return t('subjects.statusSafe') || 'Seguro / Alcanzable';
};

// ─── Main Screen ───────────────────────────────────────────────
export default function SubjectsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  
  const { subjects, assessments, loadAllData, refreshSubjects } = useDataStore();

  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [search, setSearch] = useState('');

  const [overlayVisible, setOverlayVisible] = useState(false);
  const [overlayText, setOverlayText] = useState('');

  // Keep selected subject in sync when subjects array updates
  useEffect(() => {
    if (subjects.length > 0) {
      setSelectedSubject(prev => {
        if (!prev) return subjects[0];
        const updated = subjects.find(s => s.id === prev.id);
        return updated ?? prev;
      });
    }
  }, [subjects]);

  // Request a background refresh when returning to this tab
  useFocusEffect(
    useCallback(() => {
      InteractionManager.runAfterInteractions(() => {
        loadAllData(); // Will quickly return if already loaded, but triggers state update if needed
      });
    }, [loadAllData])
  );



  // Calculator state
  const [currentGrade, setCurrentGrade] = useState('');
  const [requiredPass, setRequiredPass] = useState('60');
  const [remainingWeight, setRemainingWeight] = useState('');
  const [minNeeded, setMinNeeded] = useState<number | null>(null);
  const [maxAchievable, setMaxAchievable] = useState<number | null>(null);

  // Pre-llenar calculador cuando cambia la materia
  useEffect(() => {
    if (selectedSubject) {
      // Usar el promedio actual como nota actual
      setCurrentGrade(selectedSubject.avg_score ? String(Math.round(selectedSubject.avg_score)) : '');
      // Usar el target_grade como nota requerida, sino usar 60 por defecto
      setRequiredPass(selectedSubject.target_grade ? String(selectedSubject.target_grade) : '60');
      setRemainingWeight('');
      setMinNeeded(null);
    }
  }, [selectedSubject]);

  const handleSimulate = () => {
    const cg = parseFloat(currentGrade || (selectedSubject?.avg_score?.toString() || '0'));
    const rp = parseFloat(requiredPass || (selectedSubject?.target_grade?.toString() || '60'));
    const rw = parseFloat(remainingWeight);

    if (isNaN(cg) || isNaN(rp) || isNaN(rw) || rw <= 0) {
      alertRef.show({ title: t('common.error'), message: t('common.enterValidNumbers'), type: 'error' });
      return;
    }

    const doneWeight = 100 - rw;
    // Calculate required grade
    const result = (rp - (cg * doneWeight) / 100) / (rw / 100);
    
    // Calculate maximum achievable grade (if we get perfect 5.0 in remaining weight)
    const maxScale = rp <= 5 ? 5 : rp <= 10 ? 10 : 100;
    const max = (cg * doneWeight / 100) + (maxScale * rw / 100);
    
    setMinNeeded(Number(result.toFixed(2)));
    setMaxAchievable(Number(max.toFixed(2)));
  };

  const handleReset = () => {
    setCurrentGrade(selectedSubject?.avg_score ? selectedSubject.avg_score.toFixed(1) : '');
    setRequiredPass(selectedSubject?.target_grade ? String(selectedSubject.target_grade) : '60');
    setRemainingWeight('');
    setMinNeeded(null);
    setMaxAchievable(null);
  };

  const handleSaveTarget = async () => {
    if (!selectedSubject) return;
    const rp = requiredPass ? parseFloat(requiredPass) : null;
    if (rp === null || isNaN(rp)) {
      alertRef.show({ title: t('common.error'), message: t('common.enterValidNumbers'), type: 'error' });
      return;
    }

    try {
      await updateSubject(selectedSubject.id, { target_grade: rp });
      
      // Actualizar DB y luego refrescar estado global en background
      await updateSubject(selectedSubject.id, { target_grade: rp });
      refreshSubjects(); // Update global store
      
      alertRef.show({ 
        title: t('common.success') || 'Éxito', 
        message: t('subjects.targetSaved') || 'Objetivo guardado correctamente.', 
        type: 'success' 
      });
    } catch (error: any) {
      alertRef.show({ title: t('common.error'), message: error.message, type: 'error' });
    }
  };

  const filtered = subjects.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.code && s.code.toLowerCase().includes(search.toLowerCase())) ||
    (s.professor && s.professor.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={globalStyles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View style={globalStyles.row}>
          <Ionicons name="book-outline" size={20} color={theme.colors.primary} style={globalStyles.mr8} />
          <Text style={styles.headerTitle}>{t('subjects.title') || 'Materias'}</Text>
          <AutoUploadIndicator size={18} />
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={theme.colors.text.secondary} />
          <TextInput 
            style={styles.searchInput} 
            placeholder={t('subjects.searchPlaceholder')}
            placeholderTextColor={theme.colors.text.secondary}
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <TouchableOpacity style={styles.filterBtn}>
          <Feather name="sliders" size={18} color={theme.colors.text.primary} />
        </TouchableOpacity>
      </View>

      {/* Subject Pills Selection */}
      <View>
        <FlatList
          horizontal
          data={filtered}
          keyExtractor={(item, index) => item.id ? item.id.toString() : index.toString()}
          showsHorizontalScrollIndicator={false}
          style={styles.pillsScroll}
          contentContainerStyle={{ paddingRight: 20 }}
          removeClippedSubviews={true}
          maxToRenderPerBatch={8}
          initialNumToRender={5}
          windowSize={5}
          renderItem={({ item: s, index: idx }) => {
            const colors = ['#5856D6', '#FF9500', '#34C759', '#FF2D55', '#AF52DE', '#FF3B30'];
            const color = colors[idx % colors.length];
            const isActive = selectedSubject?.id === s.id;
            
            return (
              <TouchableOpacity 
                style={[styles.pill, isActive && styles.pillActive]}
                onPress={() => setSelectedSubject(s)}
                activeOpacity={0.7}
              >
                <View style={[styles.pillColor, { backgroundColor: s.color || color }]} />
                <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
                  {s.name}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {selectedSubject ? (
          <View style={styles.section}>
            <SubjectHeroCard 
              color={selectedSubject.color}
              iconName={selectedSubject.icon}
              title={selectedSubject.name}
              subtitle={selectedSubject.professor || t('subjects.noProfessor')}
              meta={`${selectedSubject.credits || 0} ${t('subjects.credits')}`}
              progress={selectedSubject.completion_percent || 0}
              avgScore={selectedSubject.avg_score || 0}
              displayLabel={selectedSubject.display_label}
              displayColor={selectedSubject.display_color}
              gpaEquivalent={selectedSubject.gpa_equivalent}
              onPress={() => router.push(`/subjects/${selectedSubject.id}`)}
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


        {/* ── CALCULATOR: MINIMUM GRADE TO PASS ── */}
        <View style={styles.calcCard}>
          <TouchableOpacity activeOpacity={0.8} onPress={() => {
            setOverlayText('**Calculadora de Salvavidas**\n\nEsta herramienta utiliza álgebra simple para responder la pregunta: *"¿Cuánto necesito sacar en el examen final para pasar?"*\n\nSi la nota necesaria es mayor a tu meta (ej. necesitas 4.15 para lograr 4.0), se pondrá en color naranja porque es un reto exigente.\n\nNo usa tendencias históricas como el simulador global, es solo un cálculo exacto.');
            setOverlayVisible(true);
          }}>
            <View style={styles.calcHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.calcTitle}>{t('subjects.minGradeTitle')}</Text>
                <Ionicons name="information-circle-outline" size={16} color={theme.colors.text.placeholder} />
              </View>
              <Text style={styles.calcSubject}>{selectedSubject?.name || t('subjects.selectSubject') || 'Selecciona una materia'}</Text>
            </View>
          </TouchableOpacity>

          {!selectedSubject ? (
            <View style={[globalStyles.center, { paddingVertical: 32 }]}>
              <MaterialCommunityIcons name="lightbulb-outline" size={40} color="rgba(255,255,255,0.1)" />
              <Text style={[{ color: theme.colors.text.secondary, marginTop: 12, fontSize: theme.typography.sizes.sm }, globalStyles.textCenter]}>
                {t('subjects.selectSubjectToCalculate') || 'Selecciona una materia para simular calificaciones'}
              </Text>
            </View>
          ) : (
            <>
              {/* Labels row */}
              <View style={styles.calcLabelsRow}>
                {[
                  t('subjects.currentGrade'),
                  t('subjects.requiredPass'),
                  t('subjects.remainingWeight'),
                ].map((label, i) => (
                  <View key={i} style={styles.calcLabelBox}>
                    <Text style={styles.calcInputLabel}>{label}</Text>
                  </View>
                ))}
              </View>

              {/* Inputs row */}
              <View style={styles.calcInputsRow}>
                {[
                  { value: currentGrade, setter: setCurrentGrade, placeholder: selectedSubject?.avg_score ? selectedSubject.avg_score.toFixed(1) : '0' },
                  { value: requiredPass, setter: setRequiredPass, placeholder: selectedSubject?.target_grade ? `${selectedSubject.target_grade}` : '60' },
                  { value: remainingWeight, setter: setRemainingWeight, placeholder: '%' },
                ].map((field, i) => (
                  <View key={i} style={styles.calcInputBox}>
                    <TextInput
                      style={styles.calcInput}
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

              <Text style={styles.calcHint}>{t('subjects.minAvgNeeded')}</Text>

              {/* Result */}
              {minNeeded !== null && (
                <>
                  <Text style={[styles.calcResult, { color: getStatusColor(minNeeded, parseFloat(requiredPass || '60')) }]}>
                    {minNeeded}
                  </Text>
                  <Text style={[styles.calcStatus, { color: getStatusColor(minNeeded, parseFloat(requiredPass || '60')) }]}>
                    {getStatus(minNeeded, parseFloat(requiredPass || '60'), t)}
                  </Text>

                  {/* Show max achievable when impossible */}
                  {maxAchievable !== null && minNeeded > (parseFloat(requiredPass || '60') <= 5 ? 5 : parseFloat(requiredPass || '60') <= 10 ? 10 : 100) && (
                    <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.colors.border }}>
                      <Text style={[styles.calcHint, { color: '#FF9500', marginBottom: 4 }]}>
                        {t('subjects.maxAchievable', 'Máximo alcanzable')}
                      </Text>
                      <Text style={[styles.calcResult, { color: '#FF9500', fontSize: 18 }]}>
                        {maxAchievable}
                      </Text>
                    </View>
                  )}

                  {/* Status bar */}
                  <View style={styles.statusBar}>
                    <View style={[styles.statusSegment, { backgroundColor: '#FF2D55', borderTopLeftRadius: 3, borderBottomLeftRadius: 3 }]} />
                    <View style={[styles.statusSegment, { backgroundColor: '#FF9500' }]} />
                    <View style={[styles.statusSegment, { backgroundColor: '#34C759', borderTopRightRadius: 3, borderBottomRightRadius: 3 }]} />
                  </View>
                  <View style={styles.statusLegend}>
                    <Text style={[styles.legendText, { color: '#FF2D55' }]}>● {t('subjects.failRisk')}</Text>
                    <Text style={[styles.legendText, { color: '#FF9500' }]}>● {t('subjects.borderline')}</Text>
                    <Text style={[styles.legendText, { color: '#34C759' }]}>● {t('subjects.safe')}</Text>
                  </View>
                </>
              )}

              {/* Action buttons */}
              <View style={styles.calcActions}>
                <TouchableOpacity style={[styles.calcBtn, { flex: 1.2 }]} onPress={handleSimulate}>
                  <Text style={styles.calcBtnText}>{t('subjects.simulate')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.calcBtn, styles.calcBtnSecondary]} onPress={handleSaveTarget}>
                  <Text style={styles.calcBtnSecText}>{t('subjects.saveThreshold')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.calcBtnReset} onPress={handleReset}>
                  <Text style={styles.calcBtnSecText}>{t('subjects.reset')}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* ── ASSESSMENTS ── */}
        {selectedSubject && (
          <View style={styles.assessCard}>
            {(() => {
              const subjectAssessments = assessments.filter(a => a.subject_id === selectedSubject?.id);
              
              return (
                <>
                  <View style={[styles.assessHeader, { marginBottom: 16 }]}>
                    <View style={[globalStyles.rowCenter, { gap: 10 }]}>
                      <View style={{ backgroundColor: theme.colors.primaryTransparent.light, padding: 6, borderRadius: 8 }}>
                        <MaterialCommunityIcons name="clipboard-check-outline" size={18} color={theme.colors.primary} />
                      </View>
                      <View>
                        <Text style={[styles.assessTitle, { marginBottom: 2 }]}>{t('subjects.academicTracking', 'Seguimiento académico')}</Text>
                        <View style={[globalStyles.rowCenter, { gap: 4 }]}>
                          {subjectAssessments.length > 0 ? (
                            <>
                              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.success }} />
                              <Text style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary, fontWeight: '600' }}>
                                {subjectAssessments.length} {t('subjects.registered', 'notas registradas')}
                              </Text>
                            </>
                          ) : (
                            <>
                              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.text.secondary }} />
                              <Text style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary, fontWeight: '600' }}>
                                {t('subjects.noDataTracking', 'Sin registros para mostrar')}
                              </Text>
                            </>
                          )}
                        </View>
                      </View>
                    </View>
                  </View>

                  {subjectAssessments.length === 0 ? (
                    <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                      <MaterialCommunityIcons name="clipboard-text-outline" size={40} color="rgba(0,0,0,0.1)" style={{ marginBottom: 12 }} />
                      <Text style={{ color: theme.colors.text.secondary, marginTop: 4, fontSize: 13, textAlign: 'center', paddingHorizontal: 16 }}>
                        {t('subjects.noAssessmentsMsg', 'Agrega evaluaciones para visualizar tu progreso académico')}
                      </Text>
                    </View>
                  ) : (
                    <>
                      <FlatList
                        data={subjectAssessments}
                        keyExtractor={(item, index) => item.id ? item.id.toString() : index.toString()}
                        style={styles.assessList}
                        scrollEnabled={false}
                        removeClippedSubviews={true}
                        maxToRenderPerBatch={8}
                  initialNumToRender={5}
                  windowSize={5}
                  renderItem={({ item: a, index }) => {
                    const iconMap: Record<string, string> = {
                      'task': 'clipboard-check-outline',
                      'exam': 'file-document-outline',
                      'quiz': 'help-circle-outline',
                      'grade': 'medal-outline',
                    };
                    const icon = iconMap[a.type as string] || 'school-outline';
                    const score = a.score ?? a.grade_value;
                    const colors = ['#5856D6', '#FF9500', '#34C759', '#FF2D55'];
                    const color = colors[index % colors.length];

                    return (
                      <TouchableOpacity style={styles.assessRow} activeOpacity={0.6}>
                        <View style={styles.assessIcon}>
                          <MaterialCommunityIcons name={icon as any} size={18} color={color} />
                        </View>
                        <View style={styles.assessBody}>
                          <Text style={styles.assessName} numberOfLines={1}>{a.name}</Text>
                          <Text style={styles.assessMeta}>{a.date || 'Sin fecha'}</Text>
                        </View>
                        <View style={styles.assessRight}>
                          <Text style={[styles.assessScore, { color: a.display_color || color }]}>
                            {score !== null && score !== undefined ? score : '—'}
                          </Text>
                          {a.display_label && (
                            <View style={{ backgroundColor: (a.display_color || color) + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 4 }}>
                              <Text style={{ fontSize: 10, fontWeight: '700', color: a.display_color || color }}>
                                ≈ {a.display_label}
                              </Text>
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  }}
                />

                {/* Performance sparkline (dynamic based on last 6 assessments) */}
                <View style={styles.sparklineContainer}>
                  <Text style={styles.sparklineLabel}>{t('subjects.performanceTrend')}</Text>
                  <View style={styles.sparklineWrapper}>
                    {/* Y Axis Labels */}
                    <View style={styles.sparklineYAxis}>
                      <Text style={[styles.yAxisLabel, { top: -6 }]}>5.0</Text>
                      <Text style={[styles.yAxisLabel, { top: 18 }]}>3.0</Text>
                      <Text style={[styles.yAxisLabel, { bottom: -6 }]}>0.0</Text>
                    </View>
                    
                    <View style={[styles.sparkline, styles.sparklineMain]}>
                      {subjectAssessments.filter(a => (a.score !== null && a.score !== undefined) || (a.grade_value !== null && a.grade_value !== undefined)).slice(-6).map((a, i, arr) => {
                        const score = a.score ?? a.grade_value ?? 0;
                        // Determine scale (5 or 100)
                        const scale = score <= 5 ? 5 : 100;
                        const barHeight = (score / scale) * 60;
                        const isLast = i === arr.length - 1;
                        const colors = ['#5856D6', '#FF9500', '#34C759', '#FF2D55'];
                        const color = colors[subjectAssessments.indexOf(a) % colors.length];
                        
                        return (
                          <View 
                            key={a.id || i} 
                            style={[
                              styles.sparkBar, 
                              { 
                                height: Math.max(barHeight, 2), 
                                backgroundColor: isLast ? color : color + '99'
                              }
                            ]} 
                          />
                        );
                      })}
                    </View>
                  </View>
                </View>
                    </>
                  )}
                </>
              );
            })()}
          </View>
        )}

      </ScrollView>

      <ExplanationOverlay 
        visible={overlayVisible} 
        explanation={overlayText} 
        onDismiss={() => setOverlayVisible(false)} 
      />
    </SafeAreaView>
  );
}