import { StyleSheet } from 'react-native';
import { theme } from './theme';
import { globalStyles } from './globalStyles';

export const knowledgeHealthCardStyles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...globalStyles.shadow as any,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 18,
  },
  title: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: '700',
    color: theme.colors.text.primary,
    letterSpacing: -0.3,
  },
  estadoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  estadoInfo: {
    flex: 1,
    gap: 2,
  },
  levelText: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  estadoDesc: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: '500',
    color: theme.colors.text.secondary,
  },
  estadoMeta: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: '400',
    color: theme.colors.text.secondary,
    opacity: 0.7,
    marginTop: 2,
  },
  ringPercent: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -1,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 14,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  metricCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  metricLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricLabel: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: '600',
    color: theme.colors.text.secondary,
  },
  metricValue: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: '800',
  },
  metricDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: theme.colors.border,
    marginHorizontal: 8,
  },
  subjectsRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  subjectCol: {
    flex: 1,
    gap: 2,
  },
  subjectLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2,
  },
  subjectLabel: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: '600',
    color: theme.colors.text.secondary,
  },
  subjectName: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  subjectDetail: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: '600',
  },
  subjectDivider: {
    width: 1,
    backgroundColor: theme.colors.border,
    marginHorizontal: 10,
  },
  metaText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text.secondary,
    fontWeight: '500',
    textAlign: 'center',
  },
  footerText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.text.secondary,
    lineHeight: 18,
    textAlign: 'center',
  },
});
