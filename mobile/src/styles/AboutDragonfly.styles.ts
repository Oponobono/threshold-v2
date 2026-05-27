import { StyleSheet } from 'react-native';

export const aboutDragonflyStyles = StyleSheet.create({
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
  sectionTitleLg: {
    fontSize: 44,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: -1.5,
    lineHeight: 46,
    marginBottom: 20,
    textAlign: 'center',
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
  dragonflyStage: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 32,
    position: 'relative',
  },
  glowGold: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(197, 160, 89, 0.12)',
  },
});
