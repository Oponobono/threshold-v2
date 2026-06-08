import { StyleSheet } from 'react-native';
import { theme } from './theme';

export const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ffffff',
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
  logoContainer: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  circle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${theme.colors.primary}08`, // Muy sutil
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  pulse: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    zIndex: 1,
  },
  text: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.text.secondary,
    letterSpacing: 3,
    marginBottom: 20,
  },
  barTrack: {
    width: 140,
    height: 2,
    backgroundColor: '#F0F0F0',
    borderRadius: 1,
    overflow: 'hidden',
  },
  barFill: {
    position: 'absolute',
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 1,
  }
});
