import React from 'react';
import { View, Text, TouchableOpacity, Pressable, Animated as RNAnimated } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import Animated, { Layout } from 'react-native-reanimated';
import { theme } from '../../styles/theme';
import { cHCardStyles, HERO_CARD_WIDTH, HERO_CARD_HEIGHT } from '../../styles/CourseHeroCard.styles';
import { AutoScrollText } from '../ui/AutoScrollText';
export { HERO_CARD_WIDTH };
import { PlatformMapper } from '../../presentation/heroes/mappers/PlatformMapper';
import { MemoryLevelMapper } from '../../presentation/heroes/mappers/MemoryLevelMapper';
import type { CourseHeroViewModel, GlobalHeroViewModel } from '../../types/heroViewModels';
import { openCourseLink } from '../../utils/linking';
import { formatExamCountdown } from '../../utils/date';
import { ExplanationOverlay } from '../evaluation/ExplanationOverlay';

const AnimatedSubtitle = ({ items, defaultText, style }: { items?: string[], defaultText: string, style: any }) => {
  const [index, setIndex] = React.useState(0);
  const opacity = React.useRef(new RNAnimated.Value(1)).current;

  React.useEffect(() => {
    if (!items || items.length <= 1) return;
    
    const interval = setInterval(() => {
      RNAnimated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setIndex((prev) => (prev + 1) % items.length);
        RNAnimated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [items, opacity]);

  const textToShow = items && items.length > 0 ? items[index] : defaultText;

  return (
    <RNAnimated.Text style={[style, { opacity }]} numberOfLines={1}>
      {textToShow}
    </RNAnimated.Text>
  );
};

interface CourseHeroCardProps {
  viewModel: CourseHeroViewModel;
  isActive: boolean;
  onPress: () => void;
  onContinue?: () => void;
  onEditPress?: () => void;
  onDeletePress?: () => void;
  onHeightChange?: (height: number) => void;
}

export const CourseHeroCard = React.memo(({ viewModel: vm, isActive, onPress, onContinue, onEditPress, onDeletePress, onHeightChange }: CourseHeroCardProps) => {
  const { t } = useTranslation();
  const platform = PlatformMapper.toVisual(vm.platform);
  const remaining = vm.totalClasses - vm.completedClasses;
  const isIndependent = vm.title === 'Materias Independientes';

  const [menuVisible, setMenuVisible] = React.useState(false);
  const [tooltipText, setTooltipText] = React.useState<string | null>(null);

  return (
    <View style={{ overflow: 'visible' }} onLayout={(e) => onHeightChange?.(e.nativeEvent.layout.height)}>
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={onPress}
        style={[cHCardStyles.card, isActive && cHCardStyles.cardActive]}
      >
        {/* Top Row: Platform badge + Momentum */}
        <View style={cHCardStyles.topRow}>
          {platform && !isIndependent ? (
            <View style={[cHCardStyles.platformBadge, { backgroundColor: platform.color + '18', borderColor: platform.color + '40' }]}>
              <MaterialCommunityIcons name={platform.icon as any} size={13} color={platform.color} />
              <Text style={[cHCardStyles.platformText, { color: platform.color }]}>{platform.label}</Text>
            </View>
          ) : isIndependent ? (
            <View style={[cHCardStyles.platformBadge, { backgroundColor: theme.colors.text.secondary + '18', borderColor: theme.colors.text.secondary + '40' }]}>
              <MaterialCommunityIcons name="bookshelf" size={13} color={theme.colors.text.secondary} />
              <Text style={[cHCardStyles.platformText, { color: theme.colors.text.secondary }]}>Sin Asignar</Text>
            </View>
          ) : <View />}

          {!isIndependent && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {vm.momentum > 0 && (
                <TouchableOpacity
                  style={cHCardStyles.momentumBadge}
                  onPress={() => {
                    const level = vm.momentum >= 90 ? 'excellent' : vm.momentum >= 70 ? 'good' : vm.momentum >= 50 ? 'fair' : vm.momentum >= 25 ? 'poor' : 'critical';
                    setTooltipText(t(`dashboard.heroTooltips.momentum.${level}`));
                  }}
                >
                  <Ionicons name="flame" size={12} color="#FF9500" />
                  <Text style={cHCardStyles.momentumText}>{vm.momentum}%</Text>
                </TouchableOpacity>
              )}
              {onEditPress || onDeletePress ? (
                <TouchableOpacity onPress={() => setMenuVisible(true)} style={{ padding: 4 }}>
                  <Ionicons name="ellipsis-vertical" size={16} color={theme.colors.text.secondary} />
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        </View>

        {/* Instructor — always 20px slot */}
        <View style={{ height: 20, overflow: 'hidden' }}>
          {vm.instructor && (
            <View style={cHCardStyles.instructorRow}>
              <Ionicons name="person-outline" size={12} color={theme.colors.text.placeholder} />
              <Text style={cHCardStyles.instructorText} numberOfLines={1}>{vm.instructor}</Text>
            </View>
          )}
        </View>

        {/* Course Name — always 32px slot */}
        <View style={{ height: 32, overflow: 'hidden' }}>
          <AutoScrollText
            text={vm.title}
            style={cHCardStyles.courseName}
            lineHeight={26}
          />
        </View>

        {/* Tags — always 28px slot */}
        <View style={{ height: 28, overflow: 'hidden' }}>
          {vm.tags && vm.tags.length > 0 && (
            <View style={cHCardStyles.tagsRow}>
              {vm.tags.map((tag, i) => (
                <View key={i} style={cHCardStyles.tagBadge}>
                  <Text style={cHCardStyles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Progress — always 54px slot */}
        <View style={{ height: 54, overflow: 'hidden' }}>
          {vm.totalClasses > 0 && (
            <View>
              <View style={cHCardStyles.progressBarBg}>
                <View style={[cHCardStyles.progressBarFill, { width: `${vm.progress}%` as any }]} />
              </View>
              <Text style={cHCardStyles.classesText}>
                {vm.completedClasses} / {vm.totalClasses} clases
              </Text>
              <Text style={cHCardStyles.remainingText}>
                {remaining} clases restantes
              </Text>
            </View>
          )}
        </View>

        {/* Knowledge — always 46px slot */}
        <View style={{ height: 46, overflow: 'hidden' }}>
          {vm.knowledge && (
            <TouchableOpacity
              style={cHCardStyles.knowledgeRow}
              onPress={() => {
                const level = vm.knowledge!.score >= 90 ? 'excellent' : vm.knowledge!.score >= 70 ? 'good' : vm.knowledge!.score >= 50 ? 'fair' : vm.knowledge!.score >= 25 ? 'poor' : 'critical';
                setTooltipText(t(`dashboard.heroTooltips.knowledge.${level}`));
              }}
            >
              <Text style={cHCardStyles.knowledgeLabel}>{vm.knowledge.subjectName}</Text>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: MemoryLevelMapper.toColor(vm.knowledge.memoryLevel) + '15',
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 100,
              }}>
                <Ionicons
                  name={vm.knowledge.memoryLevel === 'excellent' ? 'shield-checkmark' : vm.knowledge.memoryLevel === 'good' ? 'checkmark-circle' : vm.knowledge.memoryLevel === 'recovering' ? 'trending-up' : 'alert-circle'}
                  size={12}
                  color={MemoryLevelMapper.toColor(vm.knowledge.memoryLevel)}
                />
                <Text style={{ fontSize: 11, fontWeight: '700', color: MemoryLevelMapper.toColor(vm.knowledge.memoryLevel) }}>
                  {vm.knowledge.score}%
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Continue action — always rendered */}
        <TouchableOpacity
          style={cHCardStyles.continueRow}
          onPress={onContinue}
          activeOpacity={onContinue ? 0.7 : 1}
        >
          <Ionicons name="play-circle-outline" size={18} color={theme.colors.primary} />
          <Text style={cHCardStyles.continueText}>
            Continuar: {vm.continueTarget.label}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.colors.primary + '15', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 100 }}>
            <Ionicons
              name={vm.continueTarget.type === 'flashcard' ? 'albums-outline' : vm.continueTarget.type === 'exam' ? 'document-text-outline' : 'school-outline'}
              size={10}
              color={theme.colors.primary}
            />
            <Text style={{ fontSize: 10, fontWeight: '600', color: theme.colors.primary }}>
              {vm.continueTarget.type === 'class' ? 'clase' : vm.continueTarget.type}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={theme.colors.primary} />
        </TouchableOpacity>

        {/* Divider — always rendered */}
        <View style={cHCardStyles.divider} />

        {/* Stats — always rendered */}
        <View style={cHCardStyles.statsSimple}>
          <View style={cHCardStyles.statSimpleItem}>
            <Text style={cHCardStyles.statSimpleText}>
              {vm.subjectCount} {vm.subjectCount === 1 ? 'materia' : 'materias'}
            </Text>
          </View>
          {vm.creditCount !== undefined && vm.creditCount > 0 && (
            <View style={cHCardStyles.statSimpleItem}>
              <Text style={cHCardStyles.statSimpleText}>
                {vm.creditCount} créditos
              </Text>
            </View>
          )}
        </View>

        {/* mainUrl — always 24px slot */}
        <View style={{ height: 24, overflow: 'hidden' }}>
          {vm.mainUrl && (
            <TouchableOpacity
              style={cHCardStyles.mainUrlRow}
              onPress={() => openCourseLink(vm.mainUrl!, vm.platform)}
            >
              <Ionicons name="open-outline" size={12} color={theme.colors.primary} />
              <Text style={cHCardStyles.mainUrlText} numberOfLines={1}>Ir al curso original</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* certificateUrl — always 24px slot */}
        <View style={{ height: 24, overflow: 'hidden' }}>
          {vm.certificateUrl && (() => {
            let hostname = vm.certificateUrl;
            try { hostname = new URL(vm.certificateUrl).hostname.replace('www.', ''); } catch {}
            return (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="link-outline" size={12} color={theme.colors.text.placeholder} />
                <Text style={cHCardStyles.urlText} numberOfLines={1}>{hostname}</Text>
              </View>
            );
          })()}
        </View>
      </TouchableOpacity>

      {menuVisible && (
        <>
          <Pressable
            style={{
              position: 'absolute',
              top: -1000,
              left: -1000,
              width: 3000,
              height: 3000,
              zIndex: 20,
            }}
            onPress={() => setMenuVisible(false)}
          />
          <View style={{
            position: 'absolute', top: 50, right: 20, zIndex: 21,
            backgroundColor: theme.colors.card,
            borderRadius: 12,
            paddingVertical: 4,
            minWidth: 130,
            elevation: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
          }}>
            {onEditPress && (
              <>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 14 }}
                  onPress={() => { setMenuVisible(false); onEditPress(); }}
                >
                  <Ionicons name="pencil-outline" size={16} color={theme.colors.text.primary} />
                  <Text style={{ fontSize: 13, color: theme.colors.text.primary }}>Editar</Text>
                </TouchableOpacity>
                <View style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.05)' }} />
              </>
            )}
            {onDeletePress && (
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 14 }}
                onPress={() => { setMenuVisible(false); onDeletePress(); }}
              >
                <Ionicons name="trash-outline" size={16} color="#FF2D55" />
                <Text style={{ fontSize: 13, color: '#FF2D55' }}>Eliminar</Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      )}

      <ExplanationOverlay
        visible={tooltipText !== null}
        explanation={tooltipText}
        onDismiss={() => setTooltipText(null)}
      />
    </View>
  );
});

interface AllSubjectsHeroCardProps {
  viewModel: GlobalHeroViewModel;
  isActive: boolean;
  onPress: () => void;
  onHeightChange?: (height: number) => void;
}

export const AllSubjectsHeroCard = React.memo(({ viewModel: vm, isActive, onPress, onHeightChange }: AllSubjectsHeroCardProps) => {
  const { t } = useTranslation();
  const healthColor = vm.health >= 75 ? '#34C759'
    : vm.health >= 50 ? '#FF9500'
    : vm.health >= 25 ? '#FF6347'
    : '#FF2D55';

  const [tooltipText, setTooltipText] = React.useState<string | null>(null);

  return (
    <View style={{ overflow: 'visible' }} onLayout={(e) => onHeightChange?.(e.nativeEvent.layout.height)}>
      <TouchableOpacity activeOpacity={0.92} onPress={onPress} style={[cHCardStyles.cardGlobal, isActive && cHCardStyles.cardActiveGlobal]}>
        {/* Header: Panel Principal + Health Score */}
        <View style={cHCardStyles.globalHeaderBadgeRow}>
          <View style={cHCardStyles.globalPlatformBadge}>
            <Ionicons name="layers-outline" size={14} color="#4F46E5" />
            <Text style={cHCardStyles.globalPlatformText}>Panel Principal</Text>
          </View>
          <TouchableOpacity
            style={cHCardStyles.globalHealthBadge}
            onPress={() => {
              const level = vm.health >= 90 ? 'excellent' : vm.health >= 70 ? 'good' : vm.health >= 50 ? 'fair' : vm.health >= 25 ? 'poor' : 'critical';
              setTooltipText(t(`dashboard.heroTooltips.globalHealth.${level}`));
            }}
          >
            <MaterialCommunityIcons name="brain" size={14} color="#EA580C" />
            <Text style={cHCardStyles.globalHealthText}>{vm.health}%</Text>
          </TouchableOpacity>
        </View>

        {/* Title */}
        <View style={cHCardStyles.globalTitleRow}>
          <View style={cHCardStyles.globalTitleContainer}>
            <Text style={cHCardStyles.globalTitle}>Resumen Académico</Text>
            <Text style={cHCardStyles.globalSubtitle}>Tu progreso general en todos tus cursos</Text>
          </View>
        </View>

        {/* Progreso Global */}
        <View style={cHCardStyles.globalProgressCard}>
          <View style={cHCardStyles.globalProgressCircleContainer}>
            <Text style={cHCardStyles.globalProgressCircleText}>{vm.globalProgress.percentage}%</Text>
          </View>
          <View style={cHCardStyles.globalProgressInfo}>
            <Text style={cHCardStyles.globalProgressClassesText}>
              {vm.globalProgress.completed} / {vm.globalProgress.total} clases completadas
            </Text>
            <View style={cHCardStyles.globalProgressBarBg}>
              <View style={[cHCardStyles.globalProgressBarFill, { width: `${vm.globalProgress.percentage}%` as any }]} />
            </View>
            <Text style={cHCardStyles.globalProgressLabel}>Progreso académico global</Text>
          </View>
        </View>

        {/* Ecosystem */}
        <View style={cHCardStyles.globalEcosystemContainer}>
          <View style={cHCardStyles.globalEcosystemCard}>
            <View style={[cHCardStyles.globalEcosystemIconContainer, { backgroundColor: '#EEF2FF' }]}>
              <Ionicons name="cube-outline" size={14} color="#4F46E5" />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={cHCardStyles.globalEcosystemNumber}>{vm.courseCount} </Text>
              <Text style={cHCardStyles.globalEcosystemLabel}>cursos</Text>
            </View>
          </View>
          <View style={cHCardStyles.globalEcosystemCard}>
            <View style={[cHCardStyles.globalEcosystemIconContainer, { backgroundColor: '#DCFCE7' }]}>
              <Ionicons name="book-outline" size={14} color="#16A34A" />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={cHCardStyles.globalEcosystemNumber}>{vm.subjectCount} </Text>
              <Text style={cHCardStyles.globalEcosystemLabel}>materias</Text>
            </View>
          </View>
        </View>

        {/* Insights Section */}
        {vm.insights && vm.insights.length > 0 && (
          <View>
            <View style={cHCardStyles.globalActivityHeaderRow}>
              <Text style={cHCardStyles.globalActivityTitle}>Atención Requerida</Text>
              <Ionicons name="sparkles" size={12} color="#A78BFA" />
            </View>
            {vm.insights.slice(0, 2).map((item, i) => (
              <View key={i} style={cHCardStyles.globalActivityCard}>
                <View style={[cHCardStyles.globalActivityDot, { backgroundColor: item.color }]} />
                <View style={[cHCardStyles.globalActivityIconContainer, { backgroundColor: item.bgColor }]}>
                  <Ionicons name={item.icon as any} size={14} color={item.color} />
                </View>
                <View style={cHCardStyles.globalActivityTextContainer}>
                  <Text style={cHCardStyles.globalActivityName} numberOfLines={1}>{item.title}</Text>
                  <AnimatedSubtitle 
                    items={item.subtitles}
                    defaultText={item.subtitle}
                    style={cHCardStyles.globalActivityTime}
                  />
                </View>
              </View>
            ))}
          </View>
        )}
      </TouchableOpacity>

      <ExplanationOverlay
        visible={tooltipText !== null}
        explanation={tooltipText}
        onDismiss={() => setTooltipText(null)}
      />
    </View>
  );
});
