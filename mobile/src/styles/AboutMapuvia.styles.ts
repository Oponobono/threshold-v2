import { StyleSheet } from 'react-native';

export const aboutMapuviaStyles = StyleSheet.create({
  section: {
    paddingHorizontal: 28,
    paddingTop: 60,
    paddingBottom: 64,
  },
  lastSection: {
    paddingBottom: 80,
  },
  sectionEyebrow: {
    fontSize: 11,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: '#8A8A8E',
    marginBottom: 12,
  },
  sectionBody: {
    fontSize: 16,
    lineHeight: 26,
    color: '#555555',
    textAlign: 'justify',
  },
  accentDark: {
    color: '#1A1A1A',
    fontWeight: '600',
  },
  inlineLogo: {
    width: 130,
    height: 26,
    marginBottom: 20,
    opacity: 0.85,
  },
  mapuviaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  mapuviaLogo: {
    width: 130,
    height: 26,
    opacity: 0.85,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 56,
    opacity: 0.8,
  },
  footerLogoLabs: {
    width: 80,
    height: 14,
  },
  footerYear: {
    fontSize: 10,
    color: '#8A8A8E',
    marginLeft: 4,
  },
});
