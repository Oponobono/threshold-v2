import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  AssessmentCategory,
  deleteCategory,
  getCategoriesBySubject,
} from '../services/api/assessmentCategories';
import { useCustomAlert } from '../components/ui/CustomAlert';

const CATEGORY_ACCENT_COLORS = [
  '#1A1A1A', '#444444', '#666666', '#888888', '#AAAAAA',
];

export function accentForIndex(index: number) {
  return CATEGORY_ACCENT_COLORS[index % CATEGORY_ACCENT_COLORS.length];
}

export function useCategories() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ subjectId?: string; subjectName?: string }>();
  const subjectId = params.subjectId ? Number(params.subjectId) : null;
  const subjectName = params.subjectName ?? t('categories.screenTitle');
  const { showAlert } = useCustomAlert();

  const [categories, setCategories] = useState<AssessmentCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<AssessmentCategory | null>(null);

  const load = useCallback(async () => {
    if (!subjectId) return;
    setIsLoading(true);
    try {
      const data = await getCategoriesBySubject(subjectId);
      setCategories(data);
    } catch (e: any) {
      showAlert({ title: t('common.error'), message: e.message, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [subjectId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = () => {
    setEditing(null);
    setModalVisible(true);
  };

  const handleEdit = (cat: AssessmentCategory) => {
    setEditing(cat);
    setModalVisible(true);
  };

  const handleDelete = (cat: AssessmentCategory) => {
    showAlert({
      title: t('categories.deleteTitle'),
      message: t('categories.deleteConfirm', { name: cat.name }),
      type: 'confirm',
      buttons: [
        { text: t('common.cancel'), style: 'cancel' as const },
        {
          text: t('common.delete'),
          style: 'destructive' as const,
          onPress: async () => {
            try {
              await deleteCategory(cat.id);
              setCategories(prev => prev.filter(c => c.id !== cat.id));
            } catch (e: any) {
              showAlert({ title: t('common.error'), message: e.message, type: 'error' });
            }
          },
        },
      ],
    });
  };

  const handleSaved = () => {
    setModalVisible(false);
    load();
  };

  const handleCloseModal = () => setModalVisible(false);

  return {
    subjectId,
    subjectName,
    categories,
    isLoading,
    modalVisible,
    editing,
    router,
    handleAdd,
    handleEdit,
    handleDelete,
    handleSaved,
    handleCloseModal,
  };
}
