import { StyleSheet } from 'react-native';
import { theme } from './theme';

export const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 40,
    paddingTop: 12,
    maxHeight: '90%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  // ── Sheet header ──────────────────────────────────────────────────────────
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text.primary,
    letterSpacing: -0.3,
  },
  sheetSubtitle: {
    marginTop: 3,
    fontSize: 12,
    color: theme.colors.text.secondary,
    lineHeight: 17,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  // ── Field section ─────────────────────────────────────────────────────────
  fieldSection: {
    marginBottom: 16,
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    flex: 1,
  },
  fieldIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.colors.inputBackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  fieldHint: {
    marginTop: 2,
    fontSize: 11,
    color: theme.colors.text.secondary,
    lineHeight: 15,
  },
  fieldRight: {
    marginLeft: 12,
  },
  fieldContent: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  // ── Input ────────────────────────────────────────────────────────────────
  input: {
    fontSize: 15,
    color: theme.colors.text.primary,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  // ── Weight ───────────────────────────────────────────────────────────────
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  weightInput: {
    flex: 1,
    backgroundColor: theme.colors.inputBackground,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text.primary,
    textAlign: 'center',
  },
  weightUnit: {
    width: 40,
    height: 46,
    borderRadius: 10,
    backgroundColor: theme.colors.inputBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weightUnitText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text.secondary,
  },
  // ── Stepper ──────────────────────────────────────────────────────────────
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepperLabel: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    fontWeight: '600',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.inputBackground,
    borderRadius: 12,
    padding: 4,
  },
  stepperBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text.primary,
    minWidth: 32,
    textAlign: 'center',
  },
  // ── Save button ───────────────────────────────────────────────────────────
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.full,
    paddingVertical: 16,
    marginTop: 8,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text.white,
    letterSpacing: -0.2,
  },
});
