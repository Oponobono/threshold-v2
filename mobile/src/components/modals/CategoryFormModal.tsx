import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '../../styles/theme';
import { styles } from '../../styles/CategoryFormModal.styles';
import {
  AssessmentCategory,
  createCategory,
  updateCategory,
} from '../../services/api/assessmentCategories';
import { useCustomAlert } from '../ui/CustomAlert';

interface CategoryFormModalProps {
  visible: boolean;
  subjectId: string;
  editing: AssessmentCategory | null;
  onClose: () => void;
  onSaved: () => void;
}

export const CategoryFormModal: React.FC<CategoryFormModalProps> = ({
  visible,
  subjectId,
  editing,
  onClose,
  onSaved,
}) => {
  const { t } = useTranslation();
  const { showAlert } = useCustomAlert();
  const insets = useSafeAreaInsets();

  // ── Form state ──────────────────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [weight, setWeight] = useState('');
  const [hasWeight, setHasWeight] = useState(false);
  const [dropLowest, setDropLowest] = useState(false);
  const [dropCount, setDropCount] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

  // ── Slide-up animation ──────────────────────────────────────────────────────
  const slideAnim = useRef(new Animated.Value(500)).current;

  useEffect(() => {
    if (visible) {
      // Populate form
      if (editing) {
        setName(editing.name);
        const w = editing.weight;
        setHasWeight(w != null && w > 0);
        setWeight(w != null ? String(w) : '');
        const d = editing.drop_lowest ?? 0;
        setDropLowest(d > 0);
        setDropCount(d > 0 ? d : 1);
      } else {
        setName('');
        setWeight('');
        setHasWeight(false);
        setDropLowest(false);
        setDropCount(1);
      }

      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 22,
        stiffness: 180,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 500,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, editing, slideAnim]);

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!name.trim()) {
      showAlert({ title: t('common.error', 'Error'), message: t('categories.nameRequired', 'El nombre es requerido.'), type: 'warning' });
      return;
    }

    const payload: Partial<AssessmentCategory> = {
      name: name.trim(),
      weight: hasWeight && weight ? parseFloat(weight) : undefined,
      drop_lowest: dropLowest ? dropCount : 0,
    };

    setIsSaving(true);
    try {
      if (editing) {
        await updateCategory(editing.id, payload);
      } else {
        await createCategory(subjectId, payload);
      }
      onSaved();
    } catch (e: any) {
      showAlert({ title: t('common.error', 'Error'), message: e.message, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Dim background */}
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        {/* Sheet */}
        <Animated.View 
          style={[
            styles.sheet, 
            { 
              transform: [{ translateY: slideAnim }],
              paddingBottom: Math.max(40, insets.bottom + 20)
            }
          ]}
        >
          {/* Handle bar */}
          <View style={styles.handle} />

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header */}
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>
                  {editing
                    ? t('categories.editTitle')
                    : t('categories.createTitle')}
                </Text>
                <Text style={styles.sheetSubtitle}>
                  {t('categories.formSubtitle')}
                </Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <Ionicons name="close" size={18} color={theme.colors.text.secondary} />
              </TouchableOpacity>
            </View>

            {/* ─── Name field ─────────────────────────────────────────────────── */}
            <FieldSection
              icon="pricetag-outline"
              label={t('categories.nameLabel')}
              hint={t('categories.nameHint')}
            >
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder={t('categories.namePlaceholder')}
                placeholderTextColor={theme.colors.text.placeholder}
                autoCapitalize="words"
                returnKeyType="next"
                maxLength={60}
              />
            </FieldSection>

            {/* ─── Weight toggle + field ───────────────────────────────────────── */}
            <FieldSection
              icon="speedometer-outline"
              label={t('categories.weightLabel')}
              hint={t('categories.weightHint')}
              right={
                <Switch
                  value={hasWeight}
                  onValueChange={setHasWeight}
                  trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                  thumbColor={theme.colors.white}
                />
              }
            >
              {hasWeight && (
                <View style={styles.weightRow}>
                  <TextInput
                    style={[styles.input, styles.weightInput]}
                    value={weight}
                    onChangeText={(v) => {
                      // Only allow numbers and one decimal point
                      const clean = v.replace(/[^0-9.]/g, '');
                      setWeight(clean);
                    }}
                    placeholder="0"
                    placeholderTextColor={theme.colors.text.placeholder}
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                    maxLength={5}
                  />
                  <View style={styles.weightUnit}>
                    <Text style={styles.weightUnitText}>%</Text>
                  </View>
                </View>
              )}
            </FieldSection>

            {/* ─── Drop lowest toggle + stepper ────────────────────────────────── */}
            <FieldSection
              icon="arrow-down-circle-outline"
              label={t('categories.dropLowestLabel')}
              hint={t('categories.dropLowestHint')}
              right={
                <Switch
                  value={dropLowest}
                  onValueChange={setDropLowest}
                  trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                  thumbColor={theme.colors.white}
                />
              }
            >
              {dropLowest && (
                <View style={styles.stepperRow}>
                  <Text style={styles.stepperLabel}>
                    {t('categories.dropCountLabel')}
                  </Text>
                  <View style={styles.stepper}>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => setDropCount(Math.max(1, dropCount - 1))}
                    >
                      <Ionicons name="remove" size={18} color={theme.colors.text.primary} />
                    </TouchableOpacity>
                    <Text style={styles.stepperValue}>{dropCount}</Text>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => setDropCount(Math.min(10, dropCount + 1))}
                    >
                      <Ionicons name="add" size={18} color={theme.colors.text.primary} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </FieldSection>

            {/* ─── Save button ─────────────────────────────────────────────────── */}
            <TouchableOpacity
              style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={isSaving}
            >
              <Ionicons
                name={isSaving ? 'hourglass-outline' : 'checkmark'}
                size={18}
                color={theme.colors.text.white}
              />
              <Text style={styles.saveBtnText}>
{isSaving
                    ? t('common.saving')
                    : editing
                      ? t('common.saveChanges')
                      : t('categories.create')}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ─── Reusable field section ───────────────────────────────────────────────────
interface FieldSectionProps {
  icon: string;
  label: string;
  hint?: string;
  right?: React.ReactNode;
  children?: React.ReactNode;
}

const FieldSection: React.FC<FieldSectionProps> = ({ icon, label, hint, right, children }) => (
  <View style={styles.fieldSection}>
    <View style={styles.fieldHeader}>
      <View style={styles.fieldLabelRow}>
        <View style={styles.fieldIconWrap}>
          <Ionicons name={icon as any} size={14} color={theme.colors.text.secondary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.fieldLabel}>{label}</Text>
          {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
        </View>
      </View>
      {right && <View style={styles.fieldRight}>{right}</View>}
    </View>
    {children && <View style={styles.fieldContent}>{children}</View>}
  </View>
);
