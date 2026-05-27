import React from 'react';
import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { aboutFeaturesStyles as styles } from '../../styles/AboutFeatures.styles';
import { Sub, Sup, F } from './Formula';
import { FormulaCard } from './FormulaCard';
import { MetricItem } from './MetricItem';
import { QualityRow } from './QualityRow';
import { TypeRow } from './TypeRow';

export const AboutFeatures: React.FC = () => {
  const { t } = useTranslation();

  return (
    <LinearGradient colors={['#FAFAF5', '#F4F4EC', '#EDEDE3']} style={styles.section}>
      <Text style={styles.sectionEyebrow}>{t('about.featuresEyebrow')}</Text>
      <Text style={styles.sectionTitle}>{t('about.featuresTitle')}</Text>
      <Text style={styles.sectionBody}>{t('about.featuresSubtitle')}</Text>

      {/* ── Grade Projection Engine ── */}
      <View style={styles.featureBlock}>
        <View style={styles.featureHeader}>
          <Ionicons name="calculator-outline" size={22} color="#C5A059" />
          <Text style={styles.featureTitle}>{t('about.gradeEngine')}</Text>
        </View>
        <Text style={styles.featureDesc}>{t('about.gradeEngineDesc')}</Text>
        <View style={styles.metricList}>
          <MetricItem
            icon="stats-chart" color="#3B82F6"
            label={t('about.pa')}
            formula={<F>PA = Σ(Nota<Sub>i</Sub> × Peso<Sub>i</Sub>) ÷ Σ(Peso<Sub>i</Sub>)</F>}
          />
          <MetricItem
            icon="trending-up" color="#8B5CF6"
            label={t('about.ema')}
            formula={<F>EMA<Sub>t</Sub> = 0.35·Nota<Sub>t</Sub> + 0.65·EMA<Sub>t−1</Sub></F>}
          />
          <MetricItem
            icon="eye-outline" color="#10B981"
            label={t('about.np')}
            formula={<F>NP = (PA × %Evaluado) + (EMA × %Restante)</F>}
          />
          <MetricItem
            icon="swap-horizontal" color="#F97316"
            label={t('about.delta')}
            formula={<F>Δ = NP − PA</F>}
          />
        </View>
        <View style={styles.deltaRow}>
          <Text style={styles.deltaUp}>{t('about.deltaUp')}</Text>
          <Text style={styles.deltaStable}>{t('about.deltaStable')}</Text>
          <Text style={styles.deltaDown}>{t('about.deltaDown')}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* ── Spaced Repetition ── */}
      <View style={styles.featureBlock}>
        <View style={styles.featureHeader}>
          <Ionicons name="time-outline" size={22} color="#C5A059" />
          <Text style={styles.featureTitle}>{t('about.spacedRepetition')}</Text>
        </View>
        <Text style={styles.featureDesc}>{t('about.spacedRepetitionDesc')}</Text>

        <View style={styles.engineRow}>
          <View style={[styles.engineCard, { borderLeftColor: '#3B82F6' }]}>
            <Text style={styles.engineName}>SM-2</Text>
            <Text style={styles.engineDesc}>{t('about.sm2')}</Text>
            <FormulaCard title="Intervalo" formula={<F>I(n) = I(n−1) × EF</F>} />
            <FormulaCard title="Ease Factor" formula={<F>EF′ = EF + 0.1 − (5−q)(0.08 + (5−q)·0.02)</F>} />
          </View>
          <View style={[styles.engineCard, { borderLeftColor: '#8B5CF6' }]}>
            <Text style={styles.engineName}>FSRS</Text>
            <Text style={styles.engineDesc}>{t('about.fsrs')}</Text>
            <FormulaCard title={t('about.retention')} formula={<F>R(t) = e<Sup>−t ∕ 36</Sup></F>} />
            <FormulaCard title="Nuevo Intervalo" formula={<F>I′ = S × 9 × (1 − R<Sub>obj</Sub>)</F>} />
          </View>
        </View>

        <Text style={styles.qualityTitle}>{t('about.qualityMap')}</Text>
        <QualityRow color="#00D9FF" label={t('about.immediate')} />
        <QualityRow color="#10B981" label={t('about.fluent')} />
        <QualityRow color="#F97316" label={t('about.effort')} />
        <QualityRow color="#EF4444" label={t('about.struggle')} />
        <QualityRow color="#7C3AED" label={t('about.incorrect')} />
      </View>

      <View style={styles.divider} />

      {/* ── Flashcard Types & Code Support ── */}
      <View style={styles.featureBlock}>
        <View style={styles.featureHeader}>
          <Ionicons name="layers-outline" size={22} color="#C5A059" />
          <Text style={styles.featureTitle}>{t('about.flashcardTypes')}</Text>
        </View>
        <Text style={styles.featureDesc}>{t('about.flashcardTypesDesc')}</Text>
        <TypeRow icon="book-outline" color="#3B82F6" label={t('about.typeFlashcard')} />
        <TypeRow icon="checkbox-outline" color="#8B5CF6" label={t('about.typeMultipleChoice')} />
        <TypeRow icon="toggle-outline" color="#10B981" label={t('about.typeBoolean')} />
        <View style={styles.codeBox}>
          <Ionicons name="code-slash" size={18} color="#C5A059" />
          <Text style={styles.codeText}>{t('about.codeSupport')}</Text>
        </View>
        <Text style={styles.codeDetail}>{t('about.codeSupportDetail')}</Text>
      </View>

      <View style={styles.divider} />

      {/* ── Learning Analytics ── */}
      <View style={styles.featureBlock}>
        <View style={styles.featureHeader}>
          <Ionicons name="analytics-outline" size={22} color="#C5A059" />
          <Text style={styles.featureTitle}>{t('about.analytics')}</Text>
        </View>
        <Text style={styles.featureDesc}>{t('about.analyticsDesc')}</Text>
        <FormulaCard title="Mastery" formula={
          <F>Dominio = Aciertos × 0.40 + Consistencia × 0.30 + Velocidad × 0.30</F>
        } />
        <View style={styles.masteryList}>
          <QualityRow color="#10B981" label={t('about.masteryExcellent')} />
          <QualityRow color="#3B82F6" label={t('about.masteryGood')} />
          <QualityRow color="#F97316" label={t('about.masteryFair')} />
          <QualityRow color="#EF4444" label={t('about.masteryLow')} />
          <QualityRow color="#7C3AED" label={t('about.masteryCritical')} />
        </View>
        <View style={styles.atomicBox}>
          <Ionicons name="diamond-outline" size={18} color="#C5A059" />
          <Text style={styles.atomicText}>{t('about.atomicCards')}</Text>
        </View>
      </View>
    </LinearGradient>
  );
};
