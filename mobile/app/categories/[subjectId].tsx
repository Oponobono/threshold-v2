import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { theme } from '../../src/styles/theme';
import { globalStyles } from '../../src/styles/globalStyles';
import {
  AssessmentCategory,
  deleteCategory,
  getCategoriesBySubject,
} from '../../src/services/api/assessmentCategories';
import { CategoryFormModal } from '../../src/components/CategoryFormModal';
import { useCustomAlert } from '../../src/components/CustomAlert';

// ─── Pill colours cycling through muted neutrals ───────────────────────────
const CATEGORY_ACCENT_COLORS = [
  '#1A1A1A',
  '#444444',
  '#666666',
  '#888888',
  '#AAAAAA',
];

function accentForIndex(index: number) {
  return CATEGORY_ACCENT_COLORS[index % CATEGORY_ACCENT_COLORS.length];
}

// ─── Empty state ─────────────────────────────────────────────────────────────
const EmptyCategories = ({ onAdd }: { onAdd: () => void }) => {
  const { t } = useTranslation();
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIconCircle}>
        <Ionicons name="layers-outline" size={28} color={theme.colors.text.secondary} />
      </View>
      <Text style={styles.emptyTitle}>{t('categories.emptyTitle', 'Sin categorías')}</Text>
      <Text style={styles.emptySubtitle}>
        {t(
          'categories.emptySubtitle',
          'Agrupa tus evaluaciones por tipo (Exámenes, Tareas, Parciales) y asígnales un peso porcentual.',
        )}
      </Text>
      <TouchableOpacity style={styles.emptyAction} onPress={onAdd}>
        <Ionicons name="add" size={16} color={theme.colors.text.white} />
        <Text style={styles.emptyActionText}>{t('categories.addFirst', 'Crear primera categoría')}</Text>
      </TouchableOpacity>
    </View>
  );
};

// ─── Category bento card ──────────────────────────────────────────────────────
interface CategoryCardProps {
  category: AssessmentCategory;
  index: number;
  onEdit: (cat: AssessmentCategory) => void;
  onDelete: (cat: AssessmentCategory) => void;
}

const CategoryCard: React.FC<CategoryCardProps> = ({ category, index, onEdit, onDelete }) => {
  const accent = accentForIndex(index);
  const dropCount = category.drop_lowest ?? 0;

  return (
    <View style={styles.card}>
      {/* Left accent bar */}
      <View style={[styles.cardAccent, { backgroundColor: accent }]} />

      <View style={styles.cardBody}>
        {/* Top row: name + actions */}
        <View style={styles.cardTopRow}>
          <View style={styles.cardIconWrap}>
            <Ionicons name="layers-outline" size={18} color={accent} />
          </View>
          <Text style={styles.cardName} numberOfLines={1}>
            {category.name}
          </Text>
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={styles.cardAction}
              onPress={() => onEdit(category)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="pencil-outline" size={16} color={theme.colors.text.secondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cardAction}
              onPress={() => onDelete(category)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="trash-outline" size={16} color={theme.colors.text.secondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Pills row */}
        <View style={styles.pillsRow}>
          {/* Weight pill */}
          {category.weight != null && (
            <View style={styles.pill}>
              <Ionicons name="speedometer-outline" size={11} color={theme.colors.text.secondary} />
              <Text style={styles.pillText}>{category.weight}% peso</Text>
            </View>
          )}

          {/* Drop lowest pill */}
          {dropCount > 0 && (
            <View style={[styles.pill, styles.pillWarning]}>
              <Ionicons name="arrow-down-circle-outline" size={11} color={theme.colors.warning} />
              <Text style={[styles.pillText, { color: theme.colors.warning }]}>
                Elimina {dropCount} peor{dropCount > 1 ? 'es' : ''}
              </Text>
            </View>
          )}

          {/* No-policy pill */}
          {dropCount === 0 && category.weight == null && (
            <View style={styles.pill}>
              <Ionicons name="checkmark-circle-outline" size={11} color={theme.colors.text.secondary} />
              <Text style={styles.pillText}>Sin reglas especiales</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function CategoriesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ subjectId?: string; subjectName?: string }>();
  const subjectId = params.subjectId ? Number(params.subjectId) : null;
  const subjectName = params.subjectName ?? t('categories.screenTitle', 'Categorías');

  const { showAlert } = useCustomAlert();

  const [categories, setCategories] = useState<AssessmentCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<AssessmentCategory | null>(null);

  // ── Load ────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!subjectId) return;
    setIsLoading(true);
    try {
      const data = await getCategoriesBySubject(subjectId);
      setCategories(data);
    } catch (e: any) {
      showAlert({ title: t('common.error', 'Error'), message: e.message, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [subjectId]);

  useEffect(() => { load(); }, [load]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
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
      title: t('categories.deleteTitle', 'Eliminar categoría'),
      message: t(
        'categories.deleteConfirm',
        `¿Eliminar "${cat.name}"? Las evaluaciones asignadas quedarán sin categoría.`,
      ).replace('{{name}}', cat.name),
      type: 'confirm',
      buttons: [
        { text: t('common.cancel', 'Cancelar'), style: 'cancel' },
        {
          text: t('common.delete', 'Eliminar'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCategory(cat.id);
              setCategories(prev => prev.filter(c => c.id !== cat.id));
            } catch (e: any) {
              showAlert({ title: t('common.error', 'Error'), message: e.message, type: 'error' });
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

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={globalStyles.safeArea}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={18} color={theme.colors.text.primary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{subjectName}</Text>
            <Text style={styles.headerSub}>{t('categories.screenSubtitle', 'Categorías de evaluación')}</Text>
          </View>
          <TouchableOpacity style={styles.headerAddBtn} onPress={handleAdd}>
            <Ionicons name="add" size={20} color={theme.colors.text.white} />
          </TouchableOpacity>
        </View>

        {/* Body */}
        {isLoading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
          >
            {/* Info banner */}
            <View style={styles.infoBanner}>
              <Ionicons name="information-circle-outline" size={15} color={theme.colors.text.secondary} />
              <Text style={styles.infoBannerText}>
                {t(
                  'categories.infoBanner',
                  'Las categorías agrupan evaluaciones y permiten definir pesos y reglas como "Eliminar la peor nota" antes de calcular tu promedio.',
                )}
              </Text>
            </View>

            {/* Content */}
            {categories.length === 0 ? (
              <EmptyCategories onAdd={handleAdd} />
            ) : (
              <View style={styles.listWrap}>
                <View style={styles.listHeader}>
                  <Text style={styles.listHeaderLabel}>
                    {t('categories.totalLabel', 'CATEGORÍAS')}
                  </Text>
                  <Text style={styles.listHeaderChip}>
                    {categories.length} {categories.length === 1 ? 'grupo' : 'grupos'}
                  </Text>
                </View>

                {categories.map((cat, i) => (
                  <CategoryCard
                    key={cat.id}
                    category={cat}
                    index={i}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}

                {/* Weight summary */}
                {categories.some(c => c.weight != null) && (
                  <WeightSummary categories={categories} />
                )}

                {/* Add more CTA */}
                <TouchableOpacity style={styles.addMoreBtn} onPress={handleAdd}>
                  <Ionicons name="add-circle-outline" size={18} color={theme.colors.text.secondary} />
                  <Text style={styles.addMoreText}>{t('categories.addMore', 'Agregar otra categoría')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>

      {/* Form modal */}
      <CategoryFormModal
        visible={modalVisible}
        subjectId={subjectId!}
        editing={editing}
        onClose={() => setModalVisible(false)}
        onSaved={handleSaved}
      />
    </>
  );
}

// ─── Weight summary bento card ────────────────────────────────────────────────
const WeightSummary = ({ categories }: { categories: AssessmentCategory[] }) => {
  const weightedCats = categories.filter(c => c.weight != null);
  const total = weightedCats.reduce((sum, c) => sum + (c.weight ?? 0), 0);
  const isBalanced = Math.abs(total - 100) < 0.01;

  return (
    <View style={[styles.summaryCard, isBalanced ? styles.summaryOk : styles.summaryWarn]}>
      <Ionicons
        name={isBalanced ? 'checkmark-circle' : 'alert-circle'}
        size={16}
        color={isBalanced ? theme.colors.success : theme.colors.warning}
      />
      <View style={{ flex: 1 }}>
        <Text style={styles.summaryText}>
          {isBalanced
            ? `Pesos balanceados · ${total}% total`
            : `Pesos suman ${total.toFixed(0)}% · Se esperan 100%`}
        </Text>
      </View>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
    gap: 12,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text.primary,
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 11,
    color: theme.colors.text.secondary,
    marginTop: 2,
  },
  headerAddBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 40,
    gap: 14,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    padding: 12,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    color: theme.colors.text.secondary,
    lineHeight: 17,
  },
  listWrap: {
    gap: 10,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  listHeaderLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.text.secondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  listHeaderChip: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.text.secondary,
    backgroundColor: theme.colors.inputBackground,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    overflow: 'hidden',
  },
  // ── Card ─────────────────────────────────────────────────────────────────────
  card: {
    flexDirection: 'row',
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  cardAccent: {
    width: 4,
  },
  cardBody: {
    flex: 1,
    padding: 14,
    gap: 10,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 4,
  },
  cardAction: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── Pills ─────────────────────────────────────────────────────────────────────
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  pillWarning: {
    backgroundColor: theme.colors.warningTransparent,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.text.secondary,
  },
  // ── Summary ───────────────────────────────────────────────────────────────────
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: theme.borderRadius.md,
    padding: 12,
    marginTop: 2,
  },
  summaryOk: {
    backgroundColor: theme.colors.successTransparent,
  },
  summaryWarn: {
    backgroundColor: theme.colors.warningTransparent,
  },
  summaryText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  // ── Add more ─────────────────────────────────────────────────────────────────
  addMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
  },
  addMoreText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text.secondary,
  },
  // ── Empty state ──────────────────────────────────────────────────────────────
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 24,
    gap: 12,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text.primary,
    letterSpacing: -0.2,
  },
  emptySubtitle: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 19,
  },
  emptyAction: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  emptyActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text.white,
  },
});
