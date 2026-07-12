import { StyleSheet } from 'react-native';
import { theme } from './theme';

export const styles = StyleSheet.create({
  premiumLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingLogoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  loadingLogoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${theme.colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  loadingPulse: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${theme.colors.primary}30`,
    zIndex: 1,
    transform: [{ scale: 1.5 }],
    opacity: 0.5,
  },
  premiumLoadingText: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text.secondary,
    letterSpacing: 4,
    marginBottom: 20,
  },
  loadingBarTrack: {
    width: 200,
    height: 4,
    backgroundColor: `${theme.colors.primary}20`,
    borderRadius: 2,
    overflow: 'hidden',
  },
  loadingBarFill: {
    width: '40%',
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
  },
});
