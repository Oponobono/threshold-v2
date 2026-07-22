import React from 'react';
import { View, Text, TouchableOpacity, Pressable } from 'react-native';
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
      <TouchableOpacity activeOpacity={0.92} onPress={onPress} style={[cHCardStyles.card, cHCardStyles.cardAllGlobal, isActive && cHCardStyles.cardActiveGlobal]}>
        {/* Header: Vista Global + Health Score */}
        <View style={cHCardStyles.topRow}>
          <View style={[cHCardStyles.platformBadge, { backgroundColor: theme.colors.primary + '15', borderColor: theme.colors.primary + '30', borderWidth: 1 }]}>
            <Ionicons name="layers-outline" size={13} color={theme.colors.primary} />
            <Text style={[cHCardStyles.platformText, { color: theme.colors.primary }]}>Panel Principal</Text>
          </View>
          <TouchableOpacity
            style={cHCardStyles.momentumBadge}
            onPress={() => {
            const level = vm.health >= 90 ? 'excellent' : vm.health >= 70 ? 'good' : vm.health >= 50 ? 'fair' : vm.health >= 25 ? 'poor' : 'critical';
            setTooltipText(t(`dashboard.heroTooltips.globalHealth.${level}`));
          }}
          >
            <MaterialCommunityIcons name="brain" size={12} color={healthColor} />
            <Text style={[cHCardStyles.momentumText, { color: healthColor }]}>{vm.health}%</Text>
          </TouchableOpacity>
        </View>

        {/* Title */}
        <View style={{ marginBottom: 6 }}>
          <Text style={cHCardStyles.courseName}>
            Resumen Académico
          </Text>
        </View>

        {/* Progreso Global */}
        <View style={{ height: 44, marginVertical: 8 }}>
          {vm.globalProgress.total > 0 ? (
            <Animated.View layout={Layout.springify().damping(14).stiffness(140)}>
              <View style={cHCardStyles.progressBarBg}>
                <View style={[cHCardStyles.progressBarFill, { width: `${vm.globalProgress.percentage}%` as any, backgroundColor: theme.colors.primary }]} />
              </View>
              <Text style={cHCardStyles.classesText}>
                {vm.globalProgress.completed} / {vm.globalProgress.total} clases en total
              </Text>
              <Text style={cHCardStyles.remainingText}>
                Progreso académico global
              </Text>
            </Animated.View>
          ) : <View style={{ height: 44 }} />}
        </View>

        

        {/* Divider */}
        <View style={[cHCardStyles.divider, { backgroundColor: theme.colors.border }]} />

        {/* Ecosystem */}
        <View style={cHCardStyles.globalEcosystemRow}>
          <View style={cHCardStyles.ecosystemItem}>
            <Ionicons name="school-outline" size={13} color={theme.colors.text.secondary} />
            <Text style={cHCardStyles.ecosystemText}>{vm.courseCount} cursos</Text>
          </View>
          <View style={cHCardStyles.ecosystemItem}>
            <Ionicons name="book-outline" size={13} color={theme.colors.text.secondary} />
            <Text style={cHCardStyles.ecosystemText}>{vm.subjectCount} materias</Text>
          </View>
        </View>

        {/* Recent Activity - Top 2 */}
        {vm.recentActivity.length > 0 ? (
          <Animated.View layout={Layout.springify().damping(14).stiffness(140)} style={cHCardStyles.recentActivitySection}>
            <Text style={cHCardStyles.recentActivityHeader}>Más activas</Text>
            {vm.recentActivity.map((item, i) => (
              <View key={i} style={cHCardStyles.activityItem}>
                <View style={[cHCardStyles.activityDot, { backgroundColor: i === 0 ? theme.colors.primary : theme.colors.text.placeholder }]} />
                <Text style={cHCardStyles.activityName} numberOfLines={1}>{item.name}</Text>
                <Text style={cHCardStyles.activityTime}>{item.lastActivity}</Text>
              </View>
            ))}
          </Animated.View>
        ) : <View style={{ height: 70 }} />}

        {/* Smart Exam Badge */}
        {vm.upcomingExam ? (
          <Animated.View layout={Layout.springify().damping(14).stiffness(140)} style={[cHCardStyles.examBadge, {
            backgroundColor: vm.upcomingExam.isOverdue ? '#FF2D5518'
              : vm.upcomingExam.isUrgent ? '#FF950018'
              : theme.colors.primary + '10',
          }]}>
            <Ionicons
              name={vm.upcomingExam.isOverdue ? 'alert-circle-outline' : vm.upcomingExam.isUrgent ? 'warning-outline' : 'calendar-outline'}
              size={14}
              color={vm.upcomingExam.isOverdue ? '#FF2D55' : vm.upcomingExam.isUrgent ? '#FF9500' : theme.colors.primary}
            />
            <Text style={[cHCardStyles.examText, {
              color: vm.upcomingExam.isOverdue ? '#FF2D55' : vm.upcomingExam.isUrgent ? '#FF9500' : theme.colors.primary,
            }]} numberOfLines={1}>
              {vm.upcomingExam.isOverdue ? 'Pendiente de calificar' : vm.upcomingExam.name}
            </Text>
            <Text style={[cHCardStyles.examCountdown, {
              color: vm.upcomingExam.isOverdue ? '#FF2D55' : vm.upcomingExam.isUrgent ? '#FF9500' : theme.colors.primary,
            }]}>
              {vm.upcomingExam.isOverdue
                ? `${Math.abs(vm.upcomingExam.daysLeft)}d`
                : formatExamCountdown(vm.upcomingExam.daysLeft)}
            </Text>
          </Animated.View>
        ) : null}
      </TouchableOpacity>

      <ExplanationOverlay
        visible={tooltipText !== null}
        explanation={tooltipText}
        onDismiss={() => setTooltipText(null)}
      />
    </View>
  );
});
