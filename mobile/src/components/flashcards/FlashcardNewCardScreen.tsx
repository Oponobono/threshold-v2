/**
 * FlashcardNewCardScreen.tsx  (actualizado)
 *
 * Sub-pantalla de creación manual de ítems de evaluación.
 * Paso 1: El usuario elige el tipo (flashcard | multiple_choice | boolean).
 * Paso 2: Formulario dinámico según el tipo seleccionado.
 */
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { flashcardsStyles as s } from '../../styles/FlashcardsModal.styles';
import { FlashcardDeck, createEvaluationItem } from '../../services/api';
import { EvaluationItemType, CardDirection } from '../../services/api/types';
import { useCustomAlert } from '../ui/CustomAlert';

interface Props {
  activeDeck: FlashcardDeck | null;
  onBack: () => void;
  onCardCreated: () => void;
}

type Step = 'selectType' | 'fillForm';

const TYPE_OPTIONS = [
  { type: 'flashcard' as EvaluationItemType, icon: '🃏', labelKey: 'flashcards.title', label: 'Flashcard', descKey: 'flashcards.typeFlashcardDesc', color: '#5C6BC0', bg: '#EDE7F6' },
  { type: 'multiple_choice' as EvaluationItemType, icon: '🎯', label: 'ECAES', descKey: 'flashcards.typeMCDesc', color: '#00897B', bg: '#E0F2F1' },
  { type: 'boolean' as EvaluationItemType, icon: '⚖️', label: 'V / F', descKey: 'flashcards.typeBoolDesc', color: '#F57C00', bg: '#FFF3E0' },
];

export const FlashcardNewCardScreen: React.FC<Props> = ({ activeDeck, onBack, onCardCreated }) => {
  const { t } = useTranslation();
  const { showAlert } = useCustomAlert();

  const [step, setStep] = useState<Step>('selectType');
  const [selectedType, setSelectedType] = useState<EvaluationItemType>('flashcard');
  const [isSaving, setIsSaving] = useState(false);

  // Flashcard fields
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [direction, setDirection] = useState<CardDirection>('forward');

  // Multiple choice fields
  const [mcQuestion, setMcQuestion] = useState('');
  const [mcOptions, setMcOptions] = useState(['', '', '', '']);
  const [mcCorrectIndex, setMcCorrectIndex] = useState(0);

  // Boolean fields
  const [boolQuestion, setBoolQuestion] = useState('');
  const [boolAnswer, setBoolAnswer] = useState(true);

  // Shared fields
  const [hint, setHint] = useState('');
  const [explanation, setExplanation] = useState('');

  const handleSave = async () => {
    if (!activeDeck) return;
    setIsSaving(true);
    try {
      let contentJson: object;

      if (selectedType === 'flashcard') {
        if (!front.trim() || !back.trim()) {
          showAlert({ title: t('flashcards.fieldsRequired'), message: t('flashcards.frontBackRequired'), type: 'warning' });
          return;
        }
        contentJson = { front: front.trim(), back: back.trim() };
      } else if (selectedType === 'multiple_choice') {
        if (!mcQuestion.trim()) {
          showAlert({ title: t('flashcards.questionRequired'), message: t('flashcards.questionRequiredMsg'), type: 'warning' });
          return;
        }
        const filledOptions = mcOptions.filter(o => o.trim());
        if (filledOptions.length < 2) {
          showAlert({ title: t('flashcards.optionsRequired'), message: t('flashcards.optionsRequiredMsg'), type: 'warning' });
          return;
        }
        contentJson = { question: mcQuestion.trim(), options: mcOptions.map(o => o.trim()), correctIndex: mcCorrectIndex };
      } else {
        if (!boolQuestion.trim()) {
          showAlert({ title: t('flashcards.statementRequired'), message: t('flashcards.statementRequiredMsg'), type: 'warning' });
          return;
        }
        contentJson = { question: boolQuestion.trim(), correctAnswer: boolAnswer };
      }

      await createEvaluationItem({
        deck_id: activeDeck.id,
        item_type: selectedType,
        content_json: contentJson,
        direction: selectedType === 'flashcard' ? direction : undefined,
        hint: hint.trim() || undefined,
        explanation: explanation.trim() || undefined,
      });

      onCardCreated();
    } catch (e: any) {
      showAlert({ title: t('common.error'), message: e.message, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Step 1: Select type ───────────────────────────────────────────────────
  if (step === 'selectType') {
    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={s.modalHeader}>
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={22} color={theme.colors.text.primary} />
          </TouchableOpacity>
          <Text style={s.modalTitle}>{t('flashcards.newQuestion')}</Text>
          <View style={{ width: 22 }} />
        </View>
        <Text style={s.deckSubMeta}>{activeDeck?.title}</Text>
        <Text style={ls.sectionLabel}>{t('flashcards.selectItemType')}</Text>
        <View style={ls.typeGrid}>
          {TYPE_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.type}
              style={[ls.typeCard, { borderColor: opt.color, backgroundColor: opt.bg }]}
              onPress={() => { setSelectedType(opt.type); setStep('fillForm'); }}
              activeOpacity={0.8}
            >
              <Text style={ls.typeIcon}>{opt.icon}</Text>
              <Text style={[ls.typeLabel, { color: opt.color }]}>{opt.label}</Text>
              <Text style={ls.typeDesc}>{t(opt.descKey)}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  // ── Step 2: Fill form ─────────────────────────────────────────────────────
  const cfg = TYPE_OPTIONS.find(o => o.type === selectedType)!;

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={s.modalHeader}>
        <TouchableOpacity onPress={() => setStep('selectType')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={22} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <Text style={s.modalTitle}>{cfg.icon} {cfg.label}</Text>
        <View style={{ width: 22 }} />
      </View>
      <Text style={s.deckSubMeta}>{activeDeck?.title}</Text>

      {/* ── Flashcard ── */}
      {selectedType === 'flashcard' && (
        <>
          <Text style={s.formLabel}>{t('flashcards.frontLabel')}</Text>
          <TextInput style={[s.input, ls.textarea]} value={front} onChangeText={setFront} multiline placeholder={t('flashcards.frontPlaceholder')} placeholderTextColor={theme.colors.text.placeholder} />
          <Text style={s.formLabel}>{t('flashcards.backLabel')}</Text>
          <TextInput style={[s.input, ls.textarea]} value={back} onChangeText={setBack} multiline placeholder={t('flashcards.backPlaceholder')} placeholderTextColor={theme.colors.text.placeholder} />

          <Text style={s.formLabel}>{t('flashcards.directionLabel')}</Text>
          <View style={ls.directionRow}>
            {(['forward', 'backward', 'bidirectional'] as CardDirection[]).map(dir => {
              const icons: Record<CardDirection, string> = { forward: '→', backward: '←', bidirectional: '↔' };
              const labels: Record<CardDirection, string> = { forward: t('flashcards.directionForward'), backward: t('flashcards.directionBackward'), bidirectional: t('flashcards.directionBidirectional') };
              const isActive = direction === dir;
              return (
                <TouchableOpacity
                  key={dir}
                  style={[ls.directionPill, isActive && ls.directionPillActive]}
                  onPress={() => setDirection(dir)}
                  activeOpacity={0.7}
                >
                  <Text style={[ls.directionIcon, isActive && ls.directionIconActive]}>{icons[dir]}</Text>
                  <Text style={[ls.directionLabel, isActive && ls.directionLabelActive]}>{labels[dir]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      {/* ── Multiple choice ── */}
      {selectedType === 'multiple_choice' && (
        <>
          <Text style={s.formLabel}>{t('flashcards.questionLabel')}</Text>
          <TextInput style={[s.input, ls.textarea]} value={mcQuestion} onChangeText={setMcQuestion} multiline placeholder={t('flashcards.questionPlaceholder')} placeholderTextColor={theme.colors.text.placeholder} />
          <Text style={s.formLabel}>{t('flashcards.optionsLabel')}</Text>
          {mcOptions.map((opt, i) => (
            <TouchableOpacity key={i} style={[ls.optionRow, mcCorrectIndex === i && ls.optionRowActive]} onPress={() => setMcCorrectIndex(i)} activeOpacity={0.8}>
              <View style={[ls.optionLabel, mcCorrectIndex === i && { backgroundColor: '#00897B' }]}>
                <Text style={ls.optionLabelText}>{String.fromCharCode(65 + i)}</Text>
              </View>
              <TextInput
                style={ls.optionInput}
                value={opt}
                onChangeText={(text) => { const arr = [...mcOptions]; arr[i] = text; setMcOptions(arr); }}
                placeholder={`${t('flashcards.optionPlaceholder')} ${String.fromCharCode(65 + i)}`}
                placeholderTextColor={theme.colors.text.placeholder}
              />
              {mcCorrectIndex === i && <Ionicons name="checkmark-circle" size={20} color="#00897B" />}
            </TouchableOpacity>
          ))}
        </>
      )}

      {/* ── Boolean ── */}
      {selectedType === 'boolean' && (
        <>
          <Text style={s.formLabel}>{t('flashcards.statementLabel')}</Text>
          <TextInput style={[s.input, ls.textarea]} value={boolQuestion} onChangeText={setBoolQuestion} multiline placeholder={t('flashcards.statementPlaceholder')} placeholderTextColor={theme.colors.text.placeholder} />
          <Text style={s.formLabel}>{t('flashcards.correctAnswerLabel')}</Text>
          <View style={ls.switchRow}>
            <Text style={[ls.switchLabel, !boolAnswer && { opacity: 0.4 }]}>✅ {t('flashcards.trueLabel')}</Text>
            <Switch value={boolAnswer} onValueChange={setBoolAnswer} trackColor={{ false: '#EF9A9A', true: '#81C784' }} />
            <Text style={[ls.switchLabel, boolAnswer && { opacity: 0.4 }]}>❌ {t('flashcards.falseLabel')}</Text>
          </View>
        </>
      )}

      {/* ── Shared optional fields ── */}
      <Text style={[s.formLabel, { marginTop: 20 }]}>{t('flashcards.hintLabel')}</Text>
      <TextInput style={[s.input, { height: 72, textAlignVertical: 'top' }]} value={hint} onChangeText={setHint} multiline placeholder={t('flashcards.hintPlaceholder')} placeholderTextColor={theme.colors.text.placeholder} />

      <Text style={s.formLabel}>{t('flashcards.explanationLabel')}</Text>
      <TextInput style={[s.input, { height: 80, textAlignVertical: 'top' }]} value={explanation} onChangeText={setExplanation} multiline placeholder={t('flashcards.explanationPlaceholder')} placeholderTextColor={theme.colors.text.placeholder} />

      <TouchableOpacity
        style={[s.newDeckBtn, { marginTop: 24 }, isSaving && { opacity: 0.6 }]}
        onPress={handleSave}
        disabled={isSaving}
      >
        <Text style={s.newDeckBtnText}>{isSaving ? t('flashcards.saving') : t('flashcards.saveItem')}</Text>
      </TouchableOpacity>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const ls = StyleSheet.create({
  sectionLabel: { fontSize: 14, fontWeight: '600', color: theme.colors.text.secondary, textAlign: 'center', marginBottom: 16, marginTop: 8 },
  typeGrid: { gap: 12 },
  typeCard: { borderRadius: 18, padding: 20, borderWidth: 2, alignItems: 'center', gap: 6 },
  typeIcon: { fontSize: 34 },
  typeLabel: { fontSize: 16, fontWeight: '800' },
  typeDesc: { fontSize: 12, color: theme.colors.text.secondary },
  textarea: { height: 90, textAlignVertical: 'top' },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.colors.inputBackground, borderRadius: 14, padding: 10, marginBottom: 8, borderWidth: 1.5, borderColor: theme.colors.border },
  optionRowActive: { borderColor: '#00897B', backgroundColor: '#E0F2F1' },
  optionLabel: { width: 30, height: 30, borderRadius: 8, backgroundColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  optionLabelText: { fontSize: 13, fontWeight: '800', color: '#fff' },
  optionInput: { flex: 1, fontSize: 14, color: theme.colors.text.primary },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 14, backgroundColor: theme.colors.inputBackground, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border },
  switchLabel: { fontSize: 15, fontWeight: '700', color: theme.colors.text.primary },
  directionRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  directionPill: { flex: 1, paddingVertical: 10, paddingHorizontal: 6, borderRadius: 12, borderWidth: 1.5, borderColor: theme.colors.border, alignItems: 'center', gap: 2, backgroundColor: theme.colors.inputBackground },
  directionPillActive: { borderColor: '#5C6BC0', backgroundColor: '#EDE7F6' },
  directionIcon: { fontSize: 18, color: theme.colors.text.secondary },
  directionIconActive: { color: '#5C6BC0' },
  directionLabel: { fontSize: 11, fontWeight: '600', color: theme.colors.text.secondary, textAlign: 'center' },
  directionLabelActive: { color: '#5C6BC0' },
});
