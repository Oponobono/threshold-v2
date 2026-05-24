import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

const Sub: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text style={styles.sub}>{children}</Text>
);

const Sup: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text style={styles.sup}>{children}</Text>
);

const F: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text style={styles.formulaText}>{children}</Text>
);

const FormulaCard: React.FC<{ title: string; formula: React.ReactNode }> = ({ title, formula }) => (
  <View style={styles.formulaCard}>
    <Text style={styles.formulaTitle}>{title}</Text>
    <F>{formula}</F>
  </View>
);


const MetricItem: React.FC<{ icon: string; color: string; label: string; formula: React.ReactNode }> = ({ icon, color, label, formula }) => (
  <View style={styles.metricItem}>
    <Ionicons name={icon as any} size={16} color={color} style={styles.metricIcon} />
    <View style={styles.metricContent}>
      <Text style={styles.metricLabel}>{label}</Text>
      <F>{formula}</F>
    </View>
  </View>
);

const DotRow: React.FC<{ label: string; color: string }> = ({ label, color }) => (
  <View style={styles.qualityRow}>
    <View style={[styles.qualityDot, { backgroundColor: color }]} />
    <Text style={styles.qualityLabel}>{label}</Text>
  </View>
);

const QualityRow: React.FC<{ label: string; color: string }> = ({ label, color }) => (
  <View style={styles.qualityRow}>
    <View style={[styles.qualityDot, { backgroundColor: color }]} />
    <Text style={styles.qualityLabel}>{label}</Text>
  </View>
);

const TypeRow: React.FC<{ icon: string; color: string; label: string }> = ({ icon, color, label }) => (
  <View style={styles.typeRow}>
    <Ionicons name={icon as any} size={16} color={color} style={styles.typeIcon} />
    <Text style={styles.typeLabel}>{label}</Text>
  </View>
);

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
            <FormulaCard title="Retención" formula={<F>R(t) = e<Sup>−t ∕ 36</Sup></F>} />
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
          <DotRow color="#10B981" label={t('about.masteryExcellent')} />
          <DotRow color="#3B82F6" label={t('about.masteryGood')} />
          <DotRow color="#F97316" label={t('about.masteryFair')} />
          <DotRow color="#EF4444" label={t('about.masteryLow')} />
          <DotRow color="#7C3AED" label={t('about.masteryCritical')} />
        </View>
        <View style={styles.atomicBox}>
          <Ionicons name="diamond-outline" size={18} color="#C5A059" />
          <Text style={styles.atomicText}>{t('about.atomicCards')}</Text>
        </View>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: 28,
    paddingTop: 60,
    paddingBottom: 72,
  },
  sectionEyebrow: {
    fontSize: 11,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: '#8A8A8E',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 44,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: -1.5,
    lineHeight: 46,
    marginBottom: 20,
  },
  sectionBody: {
    fontSize: 16,
    lineHeight: 26,
    color: '#555555',
    marginBottom: 32,
  },

  // Feature Block
  featureBlock: {
    marginBottom: 8,
  },
  featureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  featureDesc: {
    fontSize: 14,
    lineHeight: 22,
    color: '#666666',
    marginBottom: 16,
  },

  // Metrics
  metricList: {
    gap: 10,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  metricIcon: {
    marginTop: 2,
  },
  metricContent: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 13,
    lineHeight: 19,
    color: '#444444',
    marginBottom: 4,
  },

  // Delta
  deltaRow: {
    flexDirection: 'column',
    gap: 4,
    marginTop: 12,
    paddingHorizontal: 4,
  },
  deltaUp: {
    fontSize: 12,
    color: '#10B981',
  },
  deltaStable: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  deltaDown: {
    fontSize: 12,
    color: '#EF4444',
  },

  // Divider
  divider: {
    height: 0.5,
    backgroundColor: 'rgba(0,0,0,0.06)',
    marginVertical: 36,
  },

  // Engines row
  engineRow: {
    gap: 12,
    marginBottom: 20,
  },
  engineCard: {
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 14,
    padding: 12,
    borderLeftWidth: 3,
  },
  engineName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  engineDesc: {
    fontSize: 13,
    lineHeight: 19,
    color: '#555555',
    marginBottom: 10,
  },

  // Formula Card
  formulaCard: {
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginTop: 6,
  },
  formulaTitle: {
    fontSize: 10,
    color: '#8A8A8E',
    letterSpacing: 1,
    marginBottom: 1,
  },
  formulaText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#C5A059',
    fontFamily: 'monospace',
  },

  // Subscript / Superscript
  sub: {
    fontSize: 9,
    fontWeight: '600',
    color: '#C5A059',
    fontFamily: 'monospace',
    lineHeight: 10,
  },
  sup: {
    fontSize: 9,
    fontWeight: '600',
    color: '#C5A059',
    fontFamily: 'monospace',
    lineHeight: 10,
  },

  // Quality
  qualityTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#444444',
    marginBottom: 10,
    marginTop: 16,
  },
  qualityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  qualityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  qualityLabel: {
    fontSize: 13,
    color: '#555555',
    flex: 1,
  },

  // Type rows
  typeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  typeIcon: {
    marginTop: 2,
  },
  typeLabel: {
    fontSize: 13,
    lineHeight: 19,
    color: '#555555',
    flex: 1,
  },

  // Code box
  codeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(197, 160, 89, 0.08)',
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },
  codeText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#444444',
    flex: 1,
  },
  codeDetail: {
    fontSize: 12,
    lineHeight: 18,
    color: '#888888',
    marginTop: 6,
    marginLeft: 26,
    fontStyle: 'italic',
  },

  // Mastery
  masteryList: {
    marginTop: 8,
    marginBottom: 16,
  },

  // Atomic box
  atomicBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(197, 160, 89, 0.08)',
    borderRadius: 10,
    padding: 12,
  },
  atomicText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#444444',
    flex: 1,
  },
});
