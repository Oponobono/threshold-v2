import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';

export type AIContextItemType = 'document' | 'photo' | 'recording' | 'video';

export interface AIContextItemData {
  id: string;
  label: string;
  uri?: string;
  thumbnailUrl?: string;
  type: AIContextItemType;
  /** true si el item tiene texto procesado (transcript/OCR) en la BD — listo para el contexto IA */
  hasText?: boolean;
  rawItem?: any;
}

interface AIContextItemProps {
  item: AIContextItemData;
  isSelected: boolean;
  onToggle: (id: string) => void;
}

const ICON_MAP: Record<AIContextItemType, { icon: string; color: string; bg: string }> = {
  document: { icon: 'file-document-outline', color: '#6C63FF', bg: '#6C63FF20' },
  photo:    { icon: 'image-outline',          color: '#0EA5E9', bg: '#0EA5E920' },
  recording:{ icon: 'microphone',             color: '#10B981', bg: '#10B98120' },
  video:    { icon: 'youtube',                color: '#EF4444', bg: '#EF444420' },
};

/**
 * AIContextItem.tsx
 *
 * Tarjeta individual (Card) para un archivo elegible dentro del flujo de IA.
 * Renderiza visualmente el contenido del archivo dependiendo de su tipo:
 * las fotos y videos muestran una miniatura (`thumbnailUrl` o `uri`), mientras que
 * los audios y documentos muestran iconos vectoriales.
 * Actúa como un botón toggleable (checkbox).
 *
 * @param item - Objeto con la información estructurada del archivo (ID, título, URI, tipo).
 * @param isSelected - Si el archivo fue marcado para ser enviado como contexto.
 * @param onToggle - Función de callback que se dispara al presionar la tarjeta.
 */
export const AIContextItem: React.FC<AIContextItemProps> = ({ item, isSelected, onToggle }) => {
  const meta = ICON_MAP[item.type];

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={() => onToggle(item.id)}
      style={{
        width: 110,
        marginRight: 12,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: isSelected ? theme.colors.primary : theme.colors.border,
        backgroundColor: isSelected ? `${theme.colors.primary}10` : theme.colors.card,
        overflow: 'hidden',
      }}
    >
      {/* Thumbnail / Icono */}
      <View style={{ height: 76, alignItems: 'center', justifyContent: 'center', backgroundColor: meta.bg }}>
        {item.uri && item.type === 'photo' ? (
          <Image
            source={{ uri: item.uri }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
        ) : item.thumbnailUrl && item.type === 'video' ? (
          <Image
            source={{ uri: item.thumbnailUrl }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
        ) : (
          <MaterialCommunityIcons name={meta.icon as React.ComponentProps<typeof MaterialCommunityIcons>['name']} size={32} color={meta.color} />
        )}
      </View>

      {/* Etiqueta */}
      <View style={{ padding: 8 }}>
        <Text
          numberOfLines={2}
          style={{ fontSize: 11, color: theme.colors.text.primary, fontWeight: '600', lineHeight: 15 }}
        >
          {item.label}
        </Text>
      </View>

      {/* Checkbox */}
      <View
        style={{
          position: 'absolute',
          top: 6,
          right: 6,
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: isSelected ? theme.colors.primary : 'rgba(255,255,255,0.85)',
          borderWidth: isSelected ? 0 : 1.5,
          borderColor: theme.colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
      </View>
    </TouchableOpacity>
  );
};
