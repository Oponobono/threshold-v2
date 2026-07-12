import { StyleSheet, Dimensions } from 'react-native';

const { width: SW } = Dimensions.get('window');
const PAD  = 20;
const GAP  = 8;
const COLS = 3;

export const CELL_W = (SW - PAD * 2 - GAP * (COLS - 1)) / COLS;
export const FULL_W = SW - PAD * 2;
export const CELL_H = CELL_W;
export const FULL_H = CELL_W * 0.80;

const PRIMARY = '#7B72FF';

export const s = StyleSheet.create({
  card: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1.5,
    backgroundColor: '#1C1C2A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 4,
  },
  cardSelected: {
    backgroundColor: '#1E1E38',
    shadowColor: PRIMARY,
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 10,
  },
  contentCard: {
    padding: 11,
    justifyContent: 'space-between',
  },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    alignSelf: 'flex-start',
    paddingHorizontal: 6, paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 8, fontWeight: '800', letterSpacing: 0.5,
  },
  mediaGradient: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 8, paddingVertical: 7,
    backgroundColor: 'rgba(0,0,0,0.6)',
    gap: 2,
  },
  mediaTitle: {
    fontSize: 10, fontWeight: '600', color: '#F2F2F7',
  },
  playBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(248,113,113,0.88)',
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 10, fontWeight: '600', color: '#F0F0F8',
    lineHeight: 14, letterSpacing: -0.1,
  },
  check: {
    position: 'absolute', top: 8, right: 8,
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
  },
});
