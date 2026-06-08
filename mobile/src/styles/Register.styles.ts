import { StyleSheet, TextStyle } from 'react-native';
import { theme } from './theme';

export const registerStyles = StyleSheet.create({

  stepIndicator: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: '600',
    color: theme.colors.text.secondary,
    letterSpacing: 0.5,
  },

  progressBarContainer: {
    height: 3,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    marginBottom: theme.spacing.sm,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
  },

  // ── Bento Card ──────────────────────────────────────────────
  bentoCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: '#F0F2F5',
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  bentoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    gap: 6,
  },
  bentoCardLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text.primary,
    letterSpacing: 0.1,
    flex: 1,
  },

  // ── AI Badge ──────────────────────────────────────────────
  aiBadge: {
    backgroundColor: theme.colors.primary,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  aiBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
  },

  // ── Avatar (centrado) ──────────────────────────────────────
  avatarCenter: {
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    gap: 10,
  },
  avatarTouchable: {
    position: 'relative',
    width: 80,
    height: 80,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  avatarInitials: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitialsText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 1,
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.white,
  },
  avatarUsername: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text.primary,
    letterSpacing: -0.3,
    textAlign: 'center',
    maxWidth: 220,
  } as TextStyle,
  avatarUsernamePlaceholder: {
    fontSize: 20,
    fontWeight: '400',
    color: theme.colors.text.placeholder,
    letterSpacing: -0.3,
    textAlign: 'center',
  } as TextStyle,
  removePhotoText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.danger,
    fontWeight: '600',
    textAlign: 'center',
  },
  uploadingText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.primary,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: theme.spacing.xs,
  },

  // ── Goal Grid (2×2) ───────────────────────────────────────
  goalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  goalButton: {
    width: '47%',
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  goalButtonText: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.text.secondary,
    fontWeight: '500',
    textAlign: 'center',
  },
  goalButtonTextActive: {
    color: '#fff',
    fontWeight: '700',
  },

  // ── Chips (languages) ─────────────────────────────────────
  chipSectionLabel: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 4,
  },
  chipSectionHint: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.sm,
    lineHeight: 16,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    width: '30%',
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  chipDisabled: {
    opacity: 0.38,
  },
  chipText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text.secondary,
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  chipTextDisabled: {
    color: theme.colors.text.placeholder,
  },

  // ── Segmented control ─────────────────────────────────────
  segmentedControl: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
    overflow: 'hidden',
    backgroundColor: theme.colors.background,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  segmentButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  segmentText: {
    color: theme.colors.text.secondary,
    fontWeight: '500',
    fontSize: theme.typography.sizes.sm,
  },
  segmentTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  segmentSubText: {
    color: theme.colors.text.secondary,
    fontSize: 10,
    marginTop: 2,
  },

  // ── Compact threshold row ─────────────────────────────────
  thresholdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  thresholdLabel: {
    flex: 1,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text.secondary,
    fontWeight: '500',
    marginRight: theme.spacing.md,
  },
  thresholdInput: {
    width: 72,
    height: 44,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    textAlign: 'center',
    fontSize: theme.typography.sizes.lg,
    fontWeight: '700',
    color: theme.colors.text.primary,
    backgroundColor: theme.colors.background,
  },

  // ── Password match indicator ──────────────────────────────
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    marginBottom: theme.spacing.sm,
    paddingHorizontal: 4,
  },
  matchText: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: '500',
  },

  // ── Password requirements card ────────────────────────────
  reqCard: {
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  reqTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.sm,
  },
  reqItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  reqText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.text.secondary,
    marginLeft: 8,
  },
  reqTextFulfilled: {
    color: '#34C759',
  },
  reqTextError: {
    color: theme.colors.danger,
  },

  // ── Legacy ───────────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    marginTop: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    borderStyle: 'dashed',
  },
  emptyStateText: {
    marginTop: theme.spacing.sm,
    color: theme.colors.text.placeholder,
    fontSize: theme.typography.sizes.sm,
    textAlign: 'center',
  },
});
