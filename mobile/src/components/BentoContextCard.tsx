import React from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, Dimensions,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { AIContextItemData } from './AIContextItem';
import { AnimatedWaveform } from './AnimatedWaveform';

// ─── Grid geometry — 3 columns ────────────────────────────────────────────────
const { width: SW } = Dimensions.get('window');
const PAD  = 20;   // horizontal padding on the grid container
const GAP  = 8;    // gap between columns
const COLS = 3;

export const CELL_W = (SW - PAD * 2 - GAP * (COLS - 1)) / COLS;  // 1x1 width
export const FULL_W = SW - PAD * 2;                               // 2x1 width
const CELL_H = CELL_W;           // square 1x1
const FULL_H = CELL_W * 0.80;   // wide hero: shorter than square

const PRIMARY = '#7B72FF';

const META = {
  document:  { color: '#8B7FFF', label: 'PDF',   icon: 'file-document-outline', lib: 'mci' },
  photo:     { color: '#38BDF8', label: 'FOTO',  icon: 'image-outline',         lib: 'mci' },
  recording: { color: '#34D399', label: 'AUDIO', icon: 'microphone',            lib: 'mci' },
  video:     { color: '#F87171', label: 'VIDEO', icon: 'logo-youtube',          lib: 'ion' },
} as const;

// AnimatedWaveform is imported from './AnimatedWaveform' — live-animated bars.

// ─── Type badge ───────────────────────────────────────────────────────────────
const TypeBadge: React.FC<{ type: keyof typeof META }> = ({ type }) => {
  const m = META[type];
  return (
    <View style={[s.badge, { backgroundColor: `${m.color}1E` }]}>
      {m.lib === 'mci'
        ? <MaterialCommunityIcons name={m.icon as any} size={10} color={m.color} />
        : <Ionicons name={m.icon as any} size={10} color={m.color} />}
      <Text style={[s.badgeText, { color: m.color }]}>{m.label}</Text>
    </View>
  );
};

// ─── Props ────────────────────────────────────────────────────────────────────
export interface BentoContextCardProps {
  item: AIContextItemData;
  isSelected: boolean;
  onToggle: (id: string) => void;
  span: 'full' | 'half';
}

// ─── Card ─────────────────────────────────────────────────────────────────────
export const BentoContextCard: React.FC<BentoContextCardProps> = ({
  item, isSelected, onToggle, span,
}) => {
  const m = META[item.type];
  const cardW = span === 'full' ? FULL_W : CELL_W;
  const cardH = span === 'full' ? FULL_H : CELL_H;

  // ── Photo ─────────────────────────────────────────────────────────────────
  if (item.type === 'photo' && item.uri) {
    return (
      <TouchableOpacity
        activeOpacity={0.82}
        onPress={() => onToggle(item.id)}
        style={[s.card, { width: cardW, height: cardH, borderColor: isSelected ? PRIMARY : 'rgba(255,255,255,0.08)' },
          isSelected && s.cardSelected]}
      >
        <ExpoImage source={{ uri: item.uri }} style={StyleSheet.absoluteFillObject} contentFit="cover" cachePolicy="memory-disk" />
        <View style={s.mediaGradient}>
          <TypeBadge type="photo" />
          <Text numberOfLines={1} style={s.mediaTitle}>{item.label}</Text>
        </View>
        <Checkmark selected={isSelected} />
      </TouchableOpacity>
    );
  }

  // ── Video with thumbnail ───────────────────────────────────────────────────
  if (item.type === 'video' && item.thumbnailUrl) {
    return (
      <TouchableOpacity
        activeOpacity={0.82}
        onPress={() => onToggle(item.id)}
        style={[s.card, { width: cardW, height: cardH, borderColor: isSelected ? PRIMARY : 'rgba(255,255,255,0.08)' },
          isSelected && s.cardSelected]}
      >
        <ExpoImage source={{ uri: item.thumbnailUrl }} style={StyleSheet.absoluteFillObject} contentFit="cover" cachePolicy="memory-disk" />
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.36)', alignItems: 'center', justifyContent: 'center' }]}>
          <View style={s.playBtn}>
            <Ionicons name="play" size={14} color="#fff" style={{ marginLeft: 1 }} />
          </View>
        </View>
        <View style={s.mediaGradient}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Ionicons name="logo-youtube" size={9} color="#F87171" />
            <Text numberOfLines={1} style={[s.mediaTitle, { flex: 1 }]}>{item.label}</Text>
          </View>
        </View>
        <Checkmark selected={isSelected} />
      </TouchableOpacity>
    );
  }

  // ── Recording (with static waveform) ──────────────────────────────────────
  if (item.type === 'recording') {
    const waveHeight = span === 'full' ? 24 : 18;
    return (
      <TouchableOpacity
        activeOpacity={0.82}
        onPress={() => onToggle(item.id)}
        style={[s.card, s.contentCard, { width: cardW, height: cardH, borderColor: isSelected ? PRIMARY : 'rgba(255,255,255,0.08)' },
          isSelected && s.cardSelected]}
      >
        <TypeBadge type="recording" />
        {/* Animated waveform — live oscillating bars */}
        <View style={{ flex: 1, justifyContent: 'center', paddingVertical: 4 }}>
          <AnimatedWaveform color={m.color} height={waveHeight} />
        </View>
        <Text numberOfLines={2} style={s.cardTitle}>{item.label}</Text>
        <Checkmark selected={isSelected} />
      </TouchableOpacity>
    );
  }

  // ── Document & Video-no-thumb (fallback) ───────────────────────────────────
  return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={() => onToggle(item.id)}
      style={[s.card, s.contentCard, { width: cardW, height: cardH, borderColor: isSelected ? PRIMARY : 'rgba(255,255,255,0.08)' },
        isSelected && s.cardSelected]}
    >
      <TypeBadge type={item.type} />
      <View style={{ flex: 1, alignItems: 'flex-end', justifyContent: 'center', paddingRight: 2 }}>
        {item.type === 'document'
          ? <MaterialCommunityIcons name="file-document-outline" size={28} color={`${m.color}30`} />
          : <Ionicons name="logo-youtube" size={28} color={`${m.color}30`} />}
      </View>
      <Text numberOfLines={2} style={s.cardTitle}>{item.label}</Text>
      <Checkmark selected={isSelected} />
    </TouchableOpacity>
  );
};

// ─── Checkmark indicator ──────────────────────────────────────────────────────
const Checkmark: React.FC<{ selected: boolean }> = ({ selected }) => (
  <View style={[
    s.check,
    selected
      ? { backgroundColor: PRIMARY, borderWidth: 0, shadowColor: PRIMARY, shadowOpacity: 0.9, shadowRadius: 8, elevation: 8 }
      : { backgroundColor: 'rgba(10,10,20,0.60)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)' },
  ]}>
    {selected && <Ionicons name="checkmark" size={11} color="#fff" />}
  </View>
);

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
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
