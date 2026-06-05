import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, Dimensions } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import YoutubeIframe from 'react-native-youtube-iframe';
import { theme } from '../../styles/theme';
import { GridMediaItem } from '../../types/RecordingsGrid.types';
import { AnimatedWaveform } from '../animated/AnimatedWaveform';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = 200;
const MEDIUM_SIZE = (SCREEN_WIDTH - 20 * 2 - 8) / 2; // two columns with gap
const RADIUS = 24;

/**
 * Calcula la luminancia relativa de un color hexadecimal.
 * Retorna true si el color es claro (luminancia > 0.5)
 */
function isLightColor(hexColor: string): boolean {
  if (!hexColor || !hexColor.startsWith('#')) return false;
  
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // Luminancia relativa: (0.299 * R + 0.587 * G + 0.114 * B) / 255
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}

/**
 * Obtiene un color con buen contraste para iconos.
 * Si el color proporcionado es muy claro, retorna un color oscuro.
 */
function getIconColor(subjectColor: string | undefined): string {
  const defaultColor = theme.colors.primary; // #000000
  
  if (!subjectColor || !subjectColor.trim()) {
    return defaultColor;
  }
  
  // Si el color es muy claro, usar negro para contraste
  if (isLightColor(subjectColor)) {
    return defaultColor; // #000000 tiene buen contraste sobre colores claros
  }
  
  return subjectColor;
}

/**
 * RecordingGridCards.tsx
 *
 * Agrupa los componentes visuales de las tarjetas utilizadas en la cuadrícula
 * interactiva estilo "Bento" para visualizar grabaciones de audio y videos de YouTube.
 * Exporta tres funciones/componentes principales:
 * - `HeroCard`: Tarjeta de tamaño completo para el elemento más reciente.
 * - `MediumCard`: Tarjeta cuadrada intermedia para las posiciones 2 y 3.
 * - `SmallCard`: Fila compacta para el resto del historial cronológico.
 * Tienen la capacidad de incrustar `YoutubeIframe` para reproducir video in-situ.
 */
export function HeroCard({
  item,
  subjectColor,
  isPlaying,
  onPlay,
  onStop,
  onDelete,
  onPress,
}: {
  item: GridMediaItem;
  subjectColor?: string;
  isPlaying: boolean;
  onPlay: (uri: string, id: string) => void;
  onStop: () => void;
  onDelete: (id: string) => void;
  onPress: (item: GridMediaItem) => void;
}) {
  const { t } = useTranslation();
  const accent = subjectColor || theme.colors.primary;
  const iconColor = getIconColor(subjectColor);
  const isVideo = item.type === 'video';
  const [isInlinePlaying, setIsInlinePlaying] = useState(false);

  // DEBUG: Log accent color
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[HeroCard] "${item.name}": subjectColor="${subjectColor}" → iconColor="${iconColor}" (isLight=${isLightColor(subjectColor || '')})`);
  }

  // If inline playing, show just the video player
  if (isVideo && isInlinePlaying && item.video_id) {
    return (
      <View
        style={{
          borderRadius: RADIUS,
          overflow: 'hidden',
          height: HERO_HEIGHT,
          marginBottom: 12,
          backgroundColor: '#000',
        }}
      >
        <YoutubeIframe
          height={HERO_HEIGHT}
          play={true}
          videoId={item.video_id}
          initialPlayerParams={{
            preventFullScreen: true,
          }}
        />
        {/* Close inline playback button overlay */}
        <TouchableOpacity
          onPress={() => setIsInlinePlaying(false)}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            backgroundColor: 'rgba(0,0,0,0.6)',
            width: 32,
            height: 32,
            borderRadius: 16,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Ionicons name="close" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => onPress(item)}
      style={{
        borderRadius: RADIUS,
        overflow: 'hidden',
        height: HERO_HEIGHT,
        marginBottom: 12,
        backgroundColor: accent,
      }}
    >
      {/* Background: video thumbnail or gradient overlay */}
      {isVideo && item.thumbnail_url ? (
        <Image
          source={{ uri: item.thumbnail_url }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          resizeMode="cover"
        />
      ) : null}

      {/* Dark overlay */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: isVideo && item.thumbnail_url ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.25)',
        }}
      />

      {/* Content */}
      <View style={{ flex: 1, padding: 20, justifyContent: 'space-between' }}>
        {/* Top row: badge + delete */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: 'rgba(255,255,255,0.22)',
              borderRadius: 20,
              paddingHorizontal: 10,
              paddingVertical: 4,
            }}
          >
            {isVideo ? (
              <MaterialCommunityIcons name="youtube" size={14} color="#fff" />
            ) : (
              <Ionicons name="mic" size={14} color="#fff" />
            )}
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600', letterSpacing: 0.5 }}>
              {isVideo ? (t('common.video') || 'VIDEO') : (t('common.audio') || 'AUDIO')}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => onDelete(item.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{
              backgroundColor: 'rgba(255,255,255,0.18)',
              borderRadius: 20,
              padding: 6,
            }}
          >
            <Ionicons name="trash-outline" size={16} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Bottom: waveform or play icon + title */}
        <View>
          {!isVideo && (
            <View style={{ marginBottom: 8 }}>
              <AnimatedWaveform color="rgba(255,255,255,0.75)" height={32} />
            </View>
          )}
          {isVideo && (
            <View style={{ alignItems: 'flex-start', marginBottom: 8 }}>
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  if (item.video_id) setIsInlinePlaying(true);
                  else onPress(item);
                }}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: 'rgba(255,255,255,0.9)',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Ionicons name="play" size={22} color={iconColor} style={{ marginLeft: 2 }} />
              </TouchableOpacity>
            </View>
          )}

          {!isVideo && (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                if (isPlaying) onStop();
                else if (item.uri) onPlay(item.uri, item.id);
              }}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: 'rgba(255,255,255,0.9)',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={18}
                color={iconColor}
                style={!isPlaying ? { marginLeft: 2 } : undefined}
              />
            </TouchableOpacity>
          )}

          <Text
            style={{ color: '#fff', fontSize: 16, fontWeight: '700', lineHeight: 20 }}
            numberOfLines={2}
          >
            {item.name}
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 }}>{item.date}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export function MediumCard({
  item,
  subjectColor,
  isPlaying,
  onPlay,
  onStop,
  onDelete,
  onPress,
}: {
  item: GridMediaItem;
  subjectColor?: string;
  isPlaying: boolean;
  onPlay: (uri: string, id: string) => void;
  onStop: () => void;
  onDelete: (id: string) => void;
  onPress: (item: GridMediaItem) => void;
}) {
  const accent = subjectColor || theme.colors.primary;
  const iconColor = getIconColor(subjectColor);
  const isVideo = item.type === 'video';

  // Ensure accent is always valid
  const bgColor = accent && accent.trim() ? accent : theme.colors.primary;

  // DEBUG: Log accent color
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[MediumCard] "${item.name}": subjectColor="${subjectColor}" → iconColor="${iconColor}" (isLight=${isLightColor(subjectColor || '')})`);
  }

  return (
    <TouchableOpacity
      activeOpacity={0.87}
      onPress={() => onPress(item)}
      style={{
        width: MEDIUM_SIZE,
        height: MEDIUM_SIZE,
        borderRadius: RADIUS,
        backgroundColor: theme.colors.card,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}
    >
      {isVideo && item.thumbnail_url ? (
        <>
          <Image
            source={{ uri: item.thumbnail_url }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            resizeMode="cover"
          />
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.35)',
            }}
          />
        </>
      ) : null}

      <View style={{ flex: 1, padding: 14, justifyContent: 'space-between' }}>
        {/* Top: icon + delete */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              backgroundColor: isVideo && item.thumbnail_url ? 'rgba(255,255,255,0.2)' : `${bgColor}18`,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            {isVideo ? (
              <Ionicons name="play-circle" size={22} color={isVideo && item.thumbnail_url ? '#fff' : iconColor} />
            ) : (
              <Ionicons name="mic" size={20} color={iconColor} />
            )}
          </View>

          <TouchableOpacity
            onPress={() => onDelete(item.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name="trash-outline"
              size={15}
              color={isVideo && item.thumbnail_url ? 'rgba(255,255,255,0.7)' : theme.colors.text.secondary}
            />
          </TouchableOpacity>
        </View>

        {/* Bottom: name + date */}
        <View>
          {!isVideo && (
            <View style={{ marginBottom: 6 }}>
              <AnimatedWaveform color={`${iconColor}40`} height={24} />
            </View>
          )}
          {!isVideo && (
            <TouchableOpacity
              onPress={() => {
                if (isPlaying) onStop();
                else if (item.uri) onPlay(item.uri, item.id);
              }}
              style={{ marginBottom: 6 }}
            >
              <Ionicons
                name={isPlaying ? 'pause-circle' : 'play-circle'}
                size={28}
                color={iconColor}
              />
            </TouchableOpacity>
          )}
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: isVideo && item.thumbnail_url ? '#fff' : theme.colors.text.primary,
              lineHeight: 17,
            }}
            numberOfLines={2}
          >
            {item.name}
          </Text>
          <Text
            style={{
              fontSize: 11,
              color: isVideo && item.thumbnail_url ? 'rgba(255,255,255,0.65)' : theme.colors.text.secondary,
              marginTop: 2,
            }}
          >
            {item.date}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export function SmallCard({
  item,
  subjectColor,
  isPlaying,
  onPlay,
  onStop,
  onDelete,
  onPress,
  isLast,
}: {
  item: GridMediaItem;
  subjectColor?: string;
  isPlaying: boolean;
  onPlay: (uri: string, id: string) => void;
  onStop: () => void;
  onDelete: (id: string) => void;
  onPress: (item: GridMediaItem) => void;
  isLast?: boolean;
}) {
  const { t } = useTranslation();
  const accent = subjectColor || theme.colors.primary;
  const iconColor = getIconColor(subjectColor);
  const isVideo = item.type === 'video';
  const isMissing = item.missingFile;

  // Ensure accent is always valid
  const bgColor = accent && accent.trim() ? accent : theme.colors.primary;

  // DEBUG: Log accent color
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[SmallCard] "${item.name}": subjectColor="${subjectColor}" → iconColor="${iconColor}" (isLight=${isLightColor(subjectColor || '')})`);
  }

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={() => !isMissing && onPress(item)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: theme.colors.border,
        opacity: isMissing ? 0.6 : 1,
      }}
    >
      {/* Icon pill */}
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: `${bgColor}15`,
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: 12,
        }}
      >
        {isVideo ? (
          <Ionicons name="play-circle" size={22} color={iconColor} />
        ) : (
          <Ionicons name="mic" size={20} color={iconColor} />
        )}
      </View>

      {/* Text */}
      <View style={{ flex: 1 }}>
        <Text
          style={{ fontSize: 14, fontWeight: '600', color: theme.colors.text.primary }}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        {!isVideo && (
          <View style={{ marginTop: 2, marginBottom: 4, height: 16 }}>
            <AnimatedWaveform color={`${iconColor}40`} height={16} />
          </View>
        )}
        {isMissing && (
          <Text style={{ fontSize: 11, color: theme.colors.text.error, marginTop: 1 }}>
            {t('common.errors.fileNotFound') || '⚠ Archivo no encontrado'}
          </Text>
        )}
        {item.isStreaming && (
          <Text style={{ fontSize: 11, color: theme.colors.primary, marginTop: 1 }}>
            ☁️ Reproduciendo desde la nube
          </Text>
        )}
        <Text style={{ fontSize: 12, color: theme.colors.text.secondary, marginTop: 1 }}>
          {item.date}
        </Text>
      </View>

      {/* Actions */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {!isVideo && !isMissing && (
          <TouchableOpacity
            onPress={() => {
              if (isPlaying) onStop();
              else if (item.uri) onPlay(item.uri, item.id);
            }}
            style={{ padding: 6 }}
          >
            <Ionicons
              name={isPlaying ? 'pause-circle' : 'play-circle'}
              size={26}
              color={iconColor}
            />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => onDelete(item.id)} style={{ padding: 6 }}>
          <Ionicons name="trash-outline" size={18} color={theme.colors.text.secondary} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}
