import { StyleSheet } from 'react-native';
import { theme } from './theme';

export const documentWorkspaceStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
  },

  // Search
  searchBarContainer: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },

  // HUD
  hud: {
    backgroundColor: theme.colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  progressTrack: {
    height: 3,
    backgroundColor: theme.colors.border,
  },
  progressFill: {
    height: 3,
    backgroundColor: theme.colors.primary,
  },
  hudRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },

  // Nav buttons
  navBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: `${theme.colors.primary}15`,
  },
  navBtnDisabled: {
    backgroundColor: 'transparent',
  },
  navBtnText: {
    fontSize: 22,
    color: theme.colors.primary,
    lineHeight: 26,
  },
  navBtnTextDisabled: {
    color: theme.colors.border,
  },

  // Page counter
  pageCounter: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
  },
  pageText: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    fontVariant: ['tabular-nums'],
  },

  // TOC button
  tocBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  tocBtnText: {
    fontSize: 18,
    color: theme.colors.text.secondary,
  },

  // Jump modal
  backdrop: {
    flex: 1,
  },
  jumpModal: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  jumpSheet: {
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 16,
  },
  jumpLabel: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    marginBottom: 10,
    textAlign: 'center',
  },
  jumpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  jumpInput: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    paddingHorizontal: 8,
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text.primary,
    textAlign: 'center',
    backgroundColor: theme.colors.background,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
  jumpOf: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    fontVariant: ['tabular-nums'],
  },
  jumpGoBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  jumpGoBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  // TOC
  tocSheet: {
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '65%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 12,
  },
  tocHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  tocTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  tocClose: {
    fontSize: 16,
    color: theme.colors.text.secondary,
  },
  tocItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 11,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  tocItemActive: {
    backgroundColor: `${theme.colors.primary}18`,
  },
  tocItemNum: {
    fontSize: 11,
    color: theme.colors.text.secondary,
    fontVariant: ['tabular-nums'],
    minWidth: 22,
    textAlign: 'right',
    marginTop: 2,
  },
  tocItemTitle: {
    fontSize: 14,
    color: theme.colors.text.primary,
    flex: 1,
    lineHeight: 20,
  },
  tocItemTitleActive: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
});
