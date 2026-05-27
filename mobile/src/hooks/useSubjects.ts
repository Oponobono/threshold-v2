import { useState, useEffect, useCallback } from 'react';
import { InteractionManager } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useDataStore } from '../store/useDataStore';
import { Subject } from '../services/api/types';
import { updateSubject } from '../services/api';
import { alertRef } from '../components/ui/CustomAlert';
import { SCALE_MAX } from '../utils/grades';

export const getStatusColor = (minNeeded: number, target: number) => {
  const maxScale = target <= 5 ? 5 : target <= 10 ? 10 : 100;
  if (minNeeded > maxScale) return '#FF2D55';
  if (minNeeded > target) return '#FF9500';
  return '#34C759';
};

export const getStatus = (minNeeded: number, target: number, t: any) => {
  const maxScale = target <= 5 ? 5 : target <= 10 ? 10 : 100;
  if (minNeeded > maxScale) return t('subjects.statusImpossible') || 'Inalcanzable';
  if (minNeeded > target) return t('subjects.statusAtRisk') || 'Exigente / En Riesgo';
  return t('subjects.statusSafe') || 'Seguro / Alcanzable';
};

const PILL_COLORS = ['#5856D6', '#FF9500', '#34C759', '#FF2D55', '#AF52DE', '#FF3B30'];

export function getPillColor(s: any, index: number): string {
  return s.color || PILL_COLORS[index % PILL_COLORS.length];
}

export function useSubjects(t: any) {
  const { subjects, assessments, loadAllData, refreshSubjects } = useDataStore();

  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [search, setSearch] = useState('');
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [overlayText, setOverlayText] = useState('');

  const [currentGrade, setCurrentGrade] = useState('');
  const [requiredPass, setRequiredPass] = useState('60');
  const [remainingWeight, setRemainingWeight] = useState('');
  const [minNeeded, setMinNeeded] = useState<number | null>(null);
  const [maxAchievable, setMaxAchievable] = useState<number | null>(null);

  useEffect(() => {
    if (subjects.length > 0) {
      setSelectedSubject(prev => {
        if (!prev) return subjects[0];
        const updated = subjects.find(s => s.id === prev.id);
        return updated ?? prev;
      });
    }
  }, [subjects]);

  useEffect(() => {
    if (selectedSubject) {
      const raw = selectedSubject.avg_score || 0;
      const avg = raw > SCALE_MAX * 2 ? (raw / 100) * SCALE_MAX : raw;
      setCurrentGrade(avg ? String(Math.round(avg)) : '');
      setRequiredPass(selectedSubject.target_grade ? String(selectedSubject.target_grade) : '60');
      setRemainingWeight('');
      setMinNeeded(null);
    }
  }, [selectedSubject]);

  useFocusEffect(
    useCallback(() => {
      InteractionManager.runAfterInteractions(() => {
        loadAllData();
      });
    }, [loadAllData])
  );

  const handleSimulate = () => {
    const cg = parseFloat(currentGrade || (selectedSubject?.avg_score?.toString() || '0'));
    const rp = parseFloat(requiredPass || (selectedSubject?.target_grade?.toString() || '60'));
    const rw = parseFloat(remainingWeight);

    if (isNaN(cg) || isNaN(rp) || isNaN(rw) || rw <= 0) {
      alertRef.show({ title: t('common.error'), message: t('common.enterValidNumbers'), type: 'error' });
      return;
    }

    const doneWeight = 100 - rw;
    const result = (rp - (cg * doneWeight) / 100) / (rw / 100);

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
      await updateSubject(selectedSubject.id, { target_grade: rp });
      refreshSubjects();
      alertRef.show({
        title: t('common.success') || 'Éxito',
        message: t('subjects.targetSaved') || 'Objetivo guardado correctamente.',
        type: 'success',
      });
    } catch (error: any) {
      alertRef.show({ title: t('common.error'), message: error.message, type: 'error' });
    }
  };

  const filteredSubjects = subjects.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.code && s.code.toLowerCase().includes(search.toLowerCase())) ||
    (s.professor && s.professor.toLowerCase().includes(search.toLowerCase()))
  );

  const subjectAssessments = selectedSubject
    ? assessments.filter(a => a.subject_id === selectedSubject.id)
    : [];

  return {
    subjects, filteredSubjects, assessments, subjectAssessments,
    selectedSubject, setSelectedSubject,
    search, setSearch,
    overlayVisible, setOverlayVisible,
    overlayText, setOverlayText,
    currentGrade, setCurrentGrade,
    requiredPass, setRequiredPass,
    remainingWeight, setRemainingWeight,
    minNeeded, maxAchievable,
    handleSimulate, handleReset, handleSaveTarget,
  };
}
