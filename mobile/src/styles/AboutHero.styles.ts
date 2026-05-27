import { StyleSheet } from 'react-native';

export const aboutHeroStyles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    paddingBottom: 80,
    paddingHorizontal: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  glowRing: {
    position: 'absolute',
    top: 80,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(197, 160, 89, 0.08)',
  },
  heroEyebrow: {
    fontSize: 11,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: '#8A8A8E',
    marginBottom: 10,
  },
  heroLogoLabs: {
    width: 160,
    height: 32,
    opacity: 0.9,
  },
  fadeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
  },
});
