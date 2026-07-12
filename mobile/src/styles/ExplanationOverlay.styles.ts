import { StyleSheet, Dimensions } from 'react-native';
import { theme } from './theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export const s = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 9999,
    elevation: 9999,
    pointerEvents: 'box-none',
  },
  floatingBox: {
    width: '100%',
    maxHeight: SCREEN_HEIGHT * 0.8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 9999,
  },
  scroll: {
    maxHeight: SCREEN_HEIGHT * 0.65,
  },
  explanationBox: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    backgroundColor: 'rgba(235, 245, 255, 0.98)', // Fondo azul muy claro casi opaco
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 122, 255, 0.25)',
  },
  explanationTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.info,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  explanationText: {
    fontSize: 14,
    color: theme.colors.text.primary,
    lineHeight: 21,
    fontWeight: '500',
  },
  tapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 4,
    opacity: 0.6,
  },
  tapHintText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.text.placeholder,
    textTransform: 'uppercase',
  },
});
