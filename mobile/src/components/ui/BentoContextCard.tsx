import React from 'react';
import {
  View, Text, TouchableOpacity, Image,
  StyleSheet,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { AIContextItemData } from '../ai/AIContextItem';
import { AnimatedWaveform } from '../animated/AnimatedWaveform';
import { s, CELL_W, CELL_H, FULL_W, FULL_H } from '../../styles/BentoContextCard.styles';

const PRIMARY = '#7B72FF';

const META = {
  document:  { color: '#8B7FFF', label: 'PDF',   icon: 'file-document-outline', lib: 'mci' },
  photo:     { color: '#38BDF8', label: 'FOTO',  icon: 'image-outline',         lib: 'mci' },
  recording: { color: '#34D399', label: 'AUDIO', icon: 'microphone',            lib: 'mci' },
  video:     { color: '#F87171', label: 'VIDEO', icon: 'logo-youtube',          lib: 'ion' },
} as const;

const TypeBadge: React.FC<{ type: keyof typeof META; hasText?: boolean }> = ({ type, hasText }) => {
  const m = META[type];
  return (
    <View style={[s.badge, { backgroundColor: `${m.color}1E` }]}>
      {m.lib === 'mci'
        ? <MaterialCommunityIcons name={m.icon as any} size={10} color={m.color} />
        : <Ionicons name={m.icon as any} size={10} color={m.color} />}
      <Text style={[s.badgeText, { color: m.color }]}>{m.label}</Text>
      {!hasText && <Text style={[s.badgeText, { color: m.color }]}>•</Text>}
    </View>
  );
};

export interface BentoContextCardProps {
  item: AIContextItemData;
  isSelected: boolean;
  onToggle: (id: string) => void;
  span: 'full' | 'half';
}

export const BentoContextCard: React.FC<BentoContextCardProps> = ({
  item, isSelected, onToggle, span,
}) => {
  const m = META[item.type];
  const cardW = span === 'full' ? FULL_W : CELL_W;
  const cardH = span === 'full' ? FULL_H : CELL_H;

  if (item.type === 'photo' && item.uri) {
    return (
      <TouchableOpacity
        activeOpacity={0.82}
        onPress={() => onToggle(item.id)}
        style={[s.card, { width: cardW, height: cardH, borderColor: isSelected ? PRIMARY : 'rgba(255,255,255,0.08)' },
          isSelected && s.cardSelected]}
      >
        <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        <View style={s.mediaGradient}>
          <TypeBadge type="photo" hasText={item.hasText} />
          <Text numberOfLines={1} style={s.mediaTitle}>{item.label}</Text>
        </View>
        <Checkmark selected={isSelected} />
      </TouchableOpacity>
    );
  }

  if (item.type === 'video' && item.thumbnailUrl) {
    return (
      <TouchableOpacity
        activeOpacity={0.82}
        onPress={() => onToggle(item.id)}
        style={[s.card, { width: cardW, height: cardH, borderColor: isSelected ? PRIMARY : 'rgba(255,255,255,0.08)' },
          isSelected && s.cardSelected]}
      >
        <Image source={{ uri: item.thumbnailUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
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

  if (item.type === 'recording') {
    const waveHeight = span === 'full' ? 24 : 18;
    return (
      <TouchableOpacity
        activeOpacity={0.82}
        onPress={() => onToggle(item.id)}
        style={[s.card, s.contentCard, { width: cardW, height: cardH, borderColor: isSelected ? PRIMARY : 'rgba(255,255,255,0.08)' },
          isSelected && s.cardSelected]}
      >
        <TypeBadge type="recording" hasText={item.hasText} />
        <View style={{ flex: 1, justifyContent: 'center', paddingVertical: 4 }}>
          <AnimatedWaveform color={m.color} height={waveHeight} />
        </View>
        <Text numberOfLines={2} style={s.cardTitle}>{item.label}</Text>
        <Checkmark selected={isSelected} />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={() => onToggle(item.id)}
      style={[s.card, s.contentCard, { width: cardW, height: cardH, borderColor: isSelected ? PRIMARY : 'rgba(255,255,255,0.08)' },
        isSelected && s.cardSelected]}
    >
      <TypeBadge type={item.type} hasText={item.hasText} />
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
