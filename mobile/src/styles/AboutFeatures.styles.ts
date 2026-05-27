import { StyleSheet } from 'react-native';

export const aboutFeaturesStyles = StyleSheet.create({
  section: {
    paddingHorizontal: 28,
    paddingTop: 60,
    paddingBottom: 72,
  },
  sectionEyebrow: {
    fontSize: 11,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: '#8A8A8E',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 44,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: -1.5,
    lineHeight: 46,
    marginBottom: 20,
  },
  sectionBody: {
    fontSize: 16,
    lineHeight: 26,
    color: '#555555',
    marginBottom: 32,
  },

  // Feature Block
  featureBlock: {
    marginBottom: 8,
  },
  featureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  featureDesc: {
    fontSize: 14,
    lineHeight: 22,
    color: '#666666',
    marginBottom: 16,
  },

  // Metrics
  metricList: {
    gap: 10,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  metricIcon: {
    marginTop: 2,
  },
  metricContent: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 13,
    lineHeight: 19,
    color: '#444444',
    marginBottom: 4,
  },

  // Delta
  deltaRow: {
    flexDirection: 'column',
    gap: 4,
    marginTop: 12,
    paddingHorizontal: 4,
  },
  deltaUp: {
    fontSize: 12,
    color: '#10B981',
  },
  deltaStable: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  deltaDown: {
    fontSize: 12,
    color: '#EF4444',
  },

  // Divider
  divider: {
    height: 0.5,
    backgroundColor: 'rgba(0,0,0,0.06)',
    marginVertical: 36,
  },

  // Engines row
  engineRow: {
    gap: 12,
    marginBottom: 20,
  },
  engineCard: {
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 14,
    padding: 12,
    borderLeftWidth: 3,
  },
  engineName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  engineDesc: {
    fontSize: 13,
    lineHeight: 19,
    color: '#555555',
    marginBottom: 10,
  },

  // Formula Card
  formulaCard: {
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginTop: 6,
  },
  formulaTitle: {
    fontSize: 10,
    color: '#8A8A8E',
    letterSpacing: 1,
    marginBottom: 1,
  },
  formulaText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#C5A059',
    fontFamily: 'monospace',
  },

  // Subscript / Superscript
  sub: {
    fontSize: 9,
    fontWeight: '600',
    color: '#C5A059',
    fontFamily: 'monospace',
    lineHeight: 10,
  },
  sup: {
    fontSize: 9,
    fontWeight: '600',
    color: '#C5A059',
    fontFamily: 'monospace',
    lineHeight: 10,
  },

  // Quality
  qualityTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#444444',
    marginBottom: 10,
    marginTop: 16,
  },
  qualityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  qualityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  qualityLabel: {
    fontSize: 13,
    color: '#555555',
    flex: 1,
  },

  // Type rows
  typeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  typeIcon: {
    marginTop: 2,
  },
  typeLabel: {
    fontSize: 13,
    lineHeight: 19,
    color: '#555555',
    flex: 1,
  },

  // Code box
  codeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(197, 160, 89, 0.08)',
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },
  codeText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#444444',
    flex: 1,
  },
  codeDetail: {
    fontSize: 12,
    lineHeight: 18,
    color: '#888888',
    marginTop: 6,
    marginLeft: 26,
    fontStyle: 'italic',
  },

  // Mastery
  masteryList: {
    marginTop: 8,
    marginBottom: 16,
  },

  // Atomic box
  atomicBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(197, 160, 89, 0.08)',
    borderRadius: 10,
    padding: 12,
  },
  atomicText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#444444',
    flex: 1,
  },
});
