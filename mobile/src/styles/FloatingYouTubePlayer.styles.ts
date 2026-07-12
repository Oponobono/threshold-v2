import { StyleSheet, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PLAYER_WIDTH = SCREEN_WIDTH * 0.75;
const PLAYER_HEIGHT = (PLAYER_WIDTH * 9) / 16;

export { PLAYER_WIDTH, PLAYER_HEIGHT };

export const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: PLAYER_WIDTH,
    backgroundColor: '#141416',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.55,
    shadowRadius: 20,
    zIndex: 99999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  accentBar: {
    height: 2,
    backgroundColor: '#C5A059',
    width: '100%',
  },
  header: {
    height: 46,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1F',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerContent: {
    flex: 1,
    gap: 2,
    overflow: 'hidden',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.8,
    color: '#FF0000',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 12,
    fontWeight: '500',
    color: '#F5F5F0',
    letterSpacing: 0.1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 8,
  },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  playerWrapper: {
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
  },
});
