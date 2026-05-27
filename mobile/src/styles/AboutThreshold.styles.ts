import { StyleSheet } from 'react-native';

export const aboutThresholdStyles = StyleSheet.create({
  section: {
    paddingHorizontal: 28,
    paddingTop: 60,
    paddingBottom: 64,
  },
  sectionEyebrow: {
    fontSize: 11,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: '#8A8A8E',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 52,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: -2,
    lineHeight: 54,
    marginBottom: 20,
  },
  sectionBody: {
    fontSize: 16,
    lineHeight: 26,
    color: '#555555',
    textAlign: 'justify',
  },
  accentGold: {
    color: '#C5A059',
    fontWeight: '600',
  },
  specRow: {
    flexDirection: 'row',
    marginTop: 36,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(0,0,0,0.06)',
    paddingTop: 24,
  },
  specItem: {
    flex: 1,
    alignItems: 'center',
  },
  specValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  specLabel: {
    fontSize: 11,
    color: '#8A8A8E',
    letterSpacing: 1,
  },
  specDivider: {
    width: 0.5,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
});
