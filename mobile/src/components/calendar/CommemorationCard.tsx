/**
 * CommemorationCard.tsx
 *
 * Tarjeta de mención honorífica y festivos nacionales para la agenda del día.
 *
 * Características:
 * 1. Destaca los festivos oficiales de Colombia con acento visual coral/rose.
 * 2. Muestra menciones honoríficas y efemérides reconocidas en Colombia con su base.
 * 3. Si hay múltiples conmemoraciones o sub-items (ej. Semana Santa), ofrece un
 *    acordeón desplegable único para explorar los detalles sin saturar la pantalla.
 * 4. No duplica títulos cuando coinciden la fecha litúrgica y el festivo cívico.
 */

import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SpecialDayRecord, SpecialDateItem, SpecialDateBasis } from '../../domain/calendar/types';
import { selectDayHeadline } from '../../domain/calendar/commemorations/engine/presentationPriority';
import { theme } from '../../styles/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface CommemorationCardProps {
  record: SpecialDayRecord | null;
}

interface CategoryIconInfo {
  name: string;
  color: string;
  family: 'material' | 'ionicons';
}

function getBasisLabel(basis: SpecialDateBasis): string {
  switch (basis) {
    case 'ley':
      return 'Ley / Oficial';
    case 'religiosa':
      return 'Religiosa';
    case 'onu':
      return 'ONU / UNESCO';
    case 'gremial':
      return 'Gremial';
    case 'tradicion':
      return 'Tradición';
    case 'comercial':
      return 'Cultural';
    default:
      return '';
  }
}

function getCategoryIcon(item: SpecialDateItem): CategoryIconInfo {
  let color = '#D97706';
  if (item.isHoliday) {
    color = '#E11D48'; // Rose/Coral festivo
  } else if (item.category === 'religiosa') {
    color = '#8B5CF6';
  } else if (item.category === 'nacional') {
    color = '#2563EB';
  } else if (item.category === 'educacion') {
    color = '#059669';
  } else if (item.category === 'internacional') {
    color = '#0284C7';
  }

  // Si la conmemoración tiene un ícono representativo específico, usarlo
  if (item.icon) {
    const family = item.iconFamily ?? 'material';
    return { name: item.icon, color, family };
  }

  // Fallback general por categoría usando MaterialCommunityIcons (cálidos, no genéricos)
  if (item.isHoliday) {
    return { name: 'flag-variant', color, family: 'material' };
  }
  switch (item.category) {
    case 'religiosa':
      return { name: 'church', color, family: 'material' };
    case 'nacional':
      return { name: 'star-circle', color, family: 'material' };
    case 'educacion':
      return { name: 'school', color, family: 'material' };
    case 'internacional':
      return { name: 'earth', color, family: 'material' };
    default:
      return { name: 'calendar-heart', color, family: 'material' };
  }
}

const RenderSpecialIcon: React.FC<{ iconInfo: CategoryIconInfo; size: number; style?: any }> = ({
  iconInfo,
  size,
  style,
}) => {
  if (iconInfo.family === 'ionicons') {
    return <Ionicons name={iconInfo.name as any} size={size} color={iconInfo.color} style={style} />;
  }
  return <MaterialCommunityIcons name={iconInfo.name as any} size={size} color={iconInfo.color} style={style} />;
};

export const CommemorationCard: React.FC<CommemorationCardProps> = React.memo(({ record }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleAccordion = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(prev => !prev);
  }, []);

  if (!record || record.items.length === 0) {
    return null;
  }

  const { isHoliday, items } = record;
  // El titular lo decide la misma política que usa el programador de notificaciones:
  // el festivo oficial manda siempre; si no hay, gana la conmemoración de mayor jerarquía.
  const primaryItem = selectDayHeadline(items) ?? items[0];
  const secondaryItems = items.filter((item) => item !== primaryItem);
  const hasSubItems = Boolean(primaryItem.subItems && primaryItem.subItems.length > 0);
  const hasExpandableContent = secondaryItems.length > 0 || hasSubItems;

  const iconInfo = getCategoryIcon(primaryItem);

  return (
    <View style={[styles.card, isHoliday && styles.holidayCard]}>
      {/* Encabezado Principal */}
      <View style={styles.headerRow}>
        <View style={[styles.iconContainer, isHoliday && styles.holidayIconContainer]}>
          <RenderSpecialIcon iconInfo={iconInfo} size={18} />
        </View>

        <View style={styles.headerTextWrapper}>
          <View style={styles.badgeRow}>
            {isHoliday && (
              <View style={styles.holidayBadge}>
                <Text style={styles.holidayBadgeText}>🇨🇴 Festivo Nacional</Text>
              </View>
            )}
            {primaryItem.status === 'needs-review' && (
              <View style={styles.reviewBadge}>
                <Text style={styles.reviewBadgeText}>⚠️ En revisión</Text>
              </View>
            )}
            <View style={styles.basisBadge}>
              <Text style={styles.basisBadgeText}>{getBasisLabel(primaryItem.basis)}</Text>
            </View>
            {primaryItem.authority ? (
              <View style={[styles.basisBadge, { backgroundColor: '#F1F5F9' }]}>
                <Text style={[styles.basisBadgeText, { color: '#475569' }]} numberOfLines={1}>
                  {primaryItem.authority}
                </Text>
              </View>
            ) : null}
          </View>

          <Text style={[styles.title, isHoliday && styles.holidayTitle]}>
            {primaryItem.name}
          </Text>

          {primaryItem.note ? (
            <Text style={styles.noteText}>{primaryItem.note}</Text>
          ) : null}
        </View>
      </View>

      {/* Botón de Acordeón si hay múltiples conmemoraciones o sub-items de Semana Santa */}
      {hasExpandableContent && (
        <TouchableOpacity
          style={styles.expandButton}
          onPress={toggleAccordion}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`${isExpanded ? 'Ocultar' : 'Ver'} más detalles de conmemoración`}
        >
          <Text style={styles.expandButtonText}>
            {isExpanded
              ? 'Ocultar detalles'
              : secondaryItems.length > 0
              ? `Ver ${secondaryItems.length + 1} celebraciones de este día`
              : 'Ver celebraciones del día'}
          </Text>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={theme.colors.text.secondary}
          />
        </TouchableOpacity>
      )}

      {/* Lista Desplegable Expandida */}
      {isExpanded && (
        <View style={styles.expandedContent}>
          {/* Sub-items litúrgicos o del evento primario (ej. Semana Santa) */}
          {hasSubItems && (
            <View style={styles.subItemsBlock}>
              <Text style={styles.subSectionTitle}>Conmemoraciones litúrgicas:</Text>
              {primaryItem.subItems!.map((sub, idx) => (
                <View key={`sub-${idx}`} style={styles.subItemRow}>
                  <View style={styles.subItemDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.subItemTitle}>{sub.title}</Text>
                    {sub.description ? (
                      <Text style={styles.subItemDesc}>{sub.description}</Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Conmemoraciones secundarias del mismo día */}
          {secondaryItems.map((secItem) => {
            const secIcon = getCategoryIcon(secItem);
            return (
              <View key={secItem.id} style={styles.secondaryItemCard}>
                <View style={styles.secondaryHeaderRow}>
                  <RenderSpecialIcon iconInfo={secIcon} size={15} style={{ marginRight: 6 }} />
                  <Text style={styles.secondaryTitle}>{secItem.name}</Text>
                  {secItem.status === 'needs-review' ? (
                    <View style={[styles.reviewBadge, { marginLeft: 'auto' }]}>
                      <Text style={styles.reviewBadgeText}>⚠️ En revisión</Text>
                    </View>
                  ) : (
                    <View style={[styles.basisBadge, { marginLeft: 'auto' }]}>
                      <Text style={styles.basisBadgeText}>{getBasisLabel(secItem.basis)}</Text>
                    </View>
                  )}
                </View>
                {secItem.note ? (
                  <Text style={styles.secondaryNote}>{secItem.note}</Text>
                ) : null}
                {secItem.subItems && secItem.subItems.length > 0 && (
                  <View style={{ marginTop: 6, gap: 4 }}>
                    {secItem.subItems.map((s, i) => (
                      <View key={`sec-sub-${i}`} style={styles.subItemRow}>
                        <View style={styles.subItemDot} />
                        <Text style={styles.subItemTitle}>{s.title}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
});

CommemorationCard.displayName = 'CommemorationCard';

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  holidayCard: {
    backgroundColor: '#FFF1F2', // Soft rose/coral festivo
    borderColor: '#FECDD3',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: theme.colors.inputBackground,
    borderWidth: 0.5,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  holidayIconContainer: {
    backgroundColor: '#FFE4E6',
    borderColor: '#FDA4AF',
  },
  headerTextWrapper: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  holidayBadge: {
    backgroundColor: '#FFE4E6',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: '#FDA4AF',
  },
  holidayBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#BE123C',
    letterSpacing: 0.2,
  },
  basisBadge: {
    backgroundColor: theme.colors.inputBackground,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: theme.colors.border,
  },
  basisBadgeText: {
    fontSize: 9.5,
    fontWeight: '600',
    color: theme.colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  reviewBadge: {
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: '#FDE68A',
  },
  reviewBadgeText: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#92400E',
    letterSpacing: 0.2,
  },
  title: {
    fontSize: 13.5,
    fontWeight: '600',
    color: theme.colors.text.primary,
    letterSpacing: -0.2,
  },
  holidayTitle: {
    color: '#9F1239',
    fontWeight: '700',
  },
  noteText: {
    fontSize: 11.5,
    color: theme.colors.text.secondary,
    marginTop: 3,
    lineHeight: 16,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    marginTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0, 0, 0, 0.08)',
  },
  expandButtonText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: theme.colors.text.secondary,
  },
  expandedContent: {
    marginTop: 10,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0, 0, 0, 0.08)',
    gap: 10,
  },
  subItemsBlock: {
    paddingLeft: 4,
    gap: 6,
  },
  subSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  subItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  subItemDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#8B5CF6',
    marginTop: 6,
  },
  subItemTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.text.primary,
    lineHeight: 16,
  },
  subItemDesc: {
    fontSize: 11,
    color: theme.colors.text.secondary,
    marginTop: 1,
  },
  secondaryItemCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    padding: 10,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(0, 0, 0, 0.06)',
  },
  secondaryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  secondaryTitle: {
    fontSize: 12.5,
    fontWeight: '600',
    color: theme.colors.text.primary,
    flexShrink: 1,
  },
  secondaryNote: {
    fontSize: 11,
    color: theme.colors.text.secondary,
    marginTop: 3,
    lineHeight: 15,
  },
});
