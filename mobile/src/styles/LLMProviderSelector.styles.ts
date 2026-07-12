import { StyleSheet } from 'react-native';

export const PRIMARY = '#7B72FF';
export const ACCENT_GROQ = '#00C896';
export const ACCENT_GEMINI = '#4285F4';
export const BORDER = 'rgba(255,255,255,0.08)';
export const TXT_PRI = '#F0F0F8';
export const TXT_SEC = 'rgba(240,240,248,0.45)';
export const SELECTED_BG = `${PRIMARY}20`;
export const CARD_BG = 'rgba(255,255,255,0.04)';

export const s = StyleSheet.create({
  container: {
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: TXT_PRI,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: TXT_SEC,
    marginBottom: 16,
  },
  cardsContainer: {
    gap: 12,
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: BORDER,
    borderLeftWidth: 5,
    padding: 16,
    marginBottom: 12,
    position: 'relative',
  },
  cardSelected: {
    backgroundColor: SELECTED_BG,
    borderColor: PRIMARY,
  },
  checkmark: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  cardTitleContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: TXT_PRI,
    marginBottom: 2,
  },
  cardDescription: {
    fontSize: 12,
    color: TXT_SEC,
  },
  cardContent: {
    gap: 12,
  },
  advantagesSection: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: TXT_SEC,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  advantageItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletPoint: {
    color: PRIMARY,
    fontSize: 14,
    marginTop: -1,
  },
  advantageText: {
    fontSize: 13,
    color: TXT_PRI,
    flex: 1,
  },
  limitsSection: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  limitsLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  // Modo compacto
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: CARD_BG,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 12,
  },
  compactLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: TXT_SEC,
  },
  compactButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  compactButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: 'transparent',
  },
  compactButtonActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  compactButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: TXT_SEC,
  },
  compactButtonTextActive: {
    color: '#FFF',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: TXT_SEC,
  },
  savingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
