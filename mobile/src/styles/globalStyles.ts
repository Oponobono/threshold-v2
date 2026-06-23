import { Platform, StyleSheet } from 'react-native';
import { theme } from './theme';

export const globalStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shadow: Platform.OS === 'web' ? {
    // Web shadow using boxShadow
    ...{
      boxShadow: `0 2px 10px rgba(${parseInt(theme.colors.primary.slice(1, 3), 16)}, ${parseInt(theme.colors.primary.slice(3, 5), 16)}, ${parseInt(theme.colors.primary.slice(5, 7), 16)}, 0.05)`,
    } as any,
  } : {
    // Native shadow
    shadowColor: theme.colors.primary,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  textLink: {
    color: theme.colors.text.link,
    fontSize: theme.typography.sizes.sm,
    fontWeight: '600',
  },
  separatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: theme.spacing.md,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border,
  },
  separatorText: {
    marginHorizontal: theme.spacing.md,
    color: theme.colors.text.secondary,
    fontSize: theme.typography.sizes.sm,
  },
  // --- New Utility Classes ---
  // Layout
  flex1: { flex: 1 },
  flexShrink1: { flexShrink: 1 },
  flexGrow1: { flexGrow: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  centerVertical: { justifyContent: 'center' },
  centerHorizontal: { alignItems: 'center' },
  alignStart: { alignItems: 'flex-start' },
  alignEnd: { alignItems: 'flex-end' },
  justifyBetween: { justifyContent: 'space-between' },
  justifyEnd: { justifyContent: 'flex-end' },
  
  // Flex Direction
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  rowBetweenCenter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowEnd: { flexDirection: 'row', justifyContent: 'flex-end' },
  
  // Margins
  mb4: { marginBottom: 4 },
  mb8: { marginBottom: 8 },
  mb12: { marginBottom: 12 },
  mb16: { marginBottom: 16 },
  mb24: { marginBottom: 24 },
  mb32: { marginBottom: 32 },
  mt8: { marginTop: 8 },
  mt16: { marginTop: 16 },
  mt24: { marginTop: 24 },
  mr4: { marginRight: 4 },
  mr8: { marginRight: 8 },
  ml8: { marginLeft: 8 },
  
  // Text Align
  textCenter: { textAlign: 'center' },
  textRight: { textAlign: 'right' },
  textLeft: { textAlign: 'left' },
  
  // Common visual
  circle: { borderRadius: theme.borderRadius.full, justifyContent: 'center', alignItems: 'center' },
  
  // --- Standardized App Headers ---
  standardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: 18,
    backgroundColor: theme.colors.background,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: theme.colors.text.primary,
    letterSpacing: -0.7,
  },
});
