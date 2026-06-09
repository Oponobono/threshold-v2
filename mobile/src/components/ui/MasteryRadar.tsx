import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { VictoryPolarAxis, VictoryChart, VictoryTheme, VictoryArea } from 'victory-native';
import { theme } from '../../styles/theme';
import { getMasteryAnalytics } from '../../services/api/analytics';
import { useTranslation } from 'react-i18next';

interface MasteryRadarProps {
  userId: string;
  subjectId: string | 'all';
  onPress?: () => void;
}

export const MasteryRadar: React.FC<MasteryRadarProps> = ({ userId, subjectId, onPress }) => {
  const { t } = useTranslation();
  const [masteryData, setMasteryData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMastery = async () => {
      try {
        setLoading(true);
        const data = await getMasteryAnalytics(userId, subjectId);
        setMasteryData(data);
      } catch (err) {
        console.warn('Error fetching mastery:', err);
      } finally {
        setLoading(false);
      }
    };
    if (userId != null) {
      fetchMastery();
    }
  }, [userId, subjectId]);

  if (loading) {
    return <ActivityIndicator size="small" color={theme.colors.primary} style={{ padding: 20 }} />;
  }

  if (!masteryData || !masteryData.radar || masteryData.radar.length === 0) {
    return (
      <View style={{ padding: 20, alignItems: 'center' }}>
        <Text style={{ color: theme.colors.text.secondary }}>{t('analytics.noMasteryData', 'No hay datos suficientes para mostrar el dominio.')}</Text>
      </View>
    );
  }

  // Prepara datos para Victory sanitizando valores inválidos
  const avg = typeof masteryData.averageMastery === 'number' && !isNaN(masteryData.averageMastery) ? masteryData.averageMastery : 0;

  let chartData = masteryData.radar
    .filter((item: any) => typeof item.value === 'number' && !isNaN(item.value))
    .map((item: any) => ({
      x: item.name,
      y: item.value,
    }));

  if (chartData.length === 0) {
    return (
      <View style={{ padding: 20, alignItems: 'center' }}>
        <Text style={{ color: theme.colors.text.secondary }}>{t('analytics.noMasteryData', 'No hay datos suficientes para mostrar el dominio.')}</Text>
      </View>
    );
  }

  // Si todos los valores son 0, Victory calcula dominio [0,0] → 0/0 = NaN → crash SVG
  if (chartData.every((d: any) => d.y === 0)) {
    return (
      <View style={{ padding: 20, alignItems: 'center' }}>
        <Text style={{ color: theme.colors.text.secondary }}>{t('analytics.noMasteryData', 'No hay datos suficientes para mostrar el dominio.')}</Text>
      </View>
    );
  }

  while (chartData.length < 3) {
    chartData.push({ x: '', y: 0 });
  }

  return (
    <View style={{ alignItems: 'center' }}>
      <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={{ width: '100%', alignItems: 'center' }}>
      <Text style={{ fontSize: theme.typography.sizes.md, fontWeight: '700', color: theme.colors.text.primary, marginBottom: 8 }}>
        {t('analytics.totalMastery', 'Dominio Total:')} {Math.round(avg)}%
      </Text>

      <View pointerEvents="none">
        <VictoryChart polar domain={{ y: [0, 100] }} theme={VictoryTheme.material} height={250} padding={30}>
          <VictoryPolarAxis 
            style={{ 
              axis: { stroke: "none" }, 
              grid: { stroke: "grey", strokeDasharray: "4, 8", opacity: 0.2 }, 
              tickLabels: { fontSize: 9, padding: 10, fill: theme.colors.text.secondary } 
            }} 
          />
          <VictoryPolarAxis dependentAxis 
            style={{ 
              axis: { stroke: "none" }, 
              tickLabels: { fill: "none" }, 
              grid: { stroke: "grey", strokeDasharray: "4, 8", opacity: 0.2 } 
            }} 
            domain={[0, 100]} 
          />
          <VictoryArea
            data={chartData}
            style={{
              data: { fill: theme.colors.primary, fillOpacity: 0.2, stroke: theme.colors.primary, strokeWidth: 2 }
            }}
          />
        </VictoryChart>
      </View>

      {masteryData.strongestArea && (
        <Text style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.primary, marginTop: 4 }}>
          💪 <Text style={{ fontWeight: 'bold' }}>{t('analytics.strength', 'Fortaleza:')}</Text> {masteryData.strongestArea.name} ({Math.round(masteryData.strongestArea.value)}%)
        </Text>
      )}
      
      {masteryData.weakestArea && (
        <Text style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.primary, marginTop: 4 }}>
          📚 <Text style={{ fontWeight: 'bold' }}>{t('analytics.needsAttention', 'Necesita atención:')}</Text> {masteryData.weakestArea.name} ({Math.round(masteryData.weakestArea.value)}%)
        </Text>
      )}

      {masteryData.recommendation && (
        <Text style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary, marginTop: 12, textAlign: 'center', paddingHorizontal: 20, fontStyle: 'italic' }}>
          {'"'}{masteryData.recommendation}{'"'}
        </Text>
      )}
      </TouchableOpacity>
    </View>
  );
};
