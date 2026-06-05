import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { AIContextItem, AIContextItemData, AIContextItemType } from './AIContextItem';

const SECTION_META: Record<
  AIContextItemType,
  { label: string; icon: string; iconSet: 'ion' | 'mci'; color: string }
> = {
  document:  { label: 'Documentos PDF',      icon: 'file-document-outline', iconSet: 'mci', color: '#6C63FF' },
  photo:     { label: 'Fotos',               icon: 'images-outline',        iconSet: 'ion', color: '#0EA5E9' },
  recording: { label: 'Grabaciones de Audio', icon: 'mic-outline',          iconSet: 'ion', color: '#10B981' },
  video:     { label: 'Videos de YouTube',   icon: 'logo-youtube',          iconSet: 'ion', color: '#EF4444' },
};

interface AIContextCarouselProps {
  type: AIContextItemType;
  items: AIContextItemData[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
}

/**
 * AIContextCarousel.tsx
 *
 * Carrusel horizontal deslizable que agrupa archivos por tipo (ej. documentos, fotos, audios).
 * Es utilizado dentro del modal de Inteligencia Artificial para que el usuario pueda
 * seleccionar rápidamente qué información desea enviar como "contexto" al LLM.
 * Incluye un botón para seleccionar/deseleccionar todos los elementos de la categoría.
 *
 * @param type - Tipo de archivo (document, photo, recording, video).
 * @param items - Lista de archivos a renderizar en este carrusel.
 * @param selectedIds - Conjunto (Set) de IDs que están actualmente seleccionados.
 * @param onToggle - Función para alternar la selección de un solo ítem.
 * @param onSelectAll - Función para marcar o desmarcar todos los ítems de esta categoría.
 */
export const AIContextCarousel: React.FC<AIContextCarouselProps> = ({
  type,
  items,
  selectedIds,
  onToggle,
  onSelectAll,
}) => {
  if (items.length === 0) return null;

  const meta = SECTION_META[type];
  const allSelected = items.length > 0 && items.every(i => selectedIds.has(i.id));
  const someSelected = items.some(i => selectedIds.has(i.id));

  return (
    <View style={{ marginBottom: 24 }}>
      {/* Header de sección */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{
            width: 30, height: 30, borderRadius: 10,
            backgroundColor: `${meta.color}20`,
            alignItems: 'center', justifyContent: 'center',
          }}>
            {meta.iconSet === 'mci'
              ? <MaterialCommunityIcons name={meta.icon as React.ComponentProps<typeof MaterialCommunityIcons>['name']} size={16} color={meta.color} />
              : <Ionicons name={meta.icon as React.ComponentProps<typeof Ionicons>['name']} size={16} color={meta.color} />}
          </View>
          <View>
            <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.text.primary }}>
              {meta.label}
            </Text>
            <Text style={{ fontSize: 11, color: theme.colors.text.secondary }}>
              {items.length} {items.length === 1 ? 'archivo' : 'archivos'}
            </Text>
          </View>
        </View>

        {/* Seleccionar todo */}
        <TouchableOpacity
          onPress={onSelectAll}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 4,
            paddingHorizontal: 10, paddingVertical: 5,
            borderRadius: 20, borderWidth: 1,
            borderColor: allSelected ? theme.colors.primary : theme.colors.border,
            backgroundColor: allSelected ? `${theme.colors.primary}15` : 'transparent',
          }}
        >
          <Ionicons
            name={allSelected ? 'checkmark-circle' : (someSelected ? 'remove-circle-outline' : 'ellipse-outline')}
            size={14}
            color={allSelected || someSelected ? theme.colors.primary : theme.colors.text.secondary}
          />
          <Text style={{
            fontSize: 11, fontWeight: '600',
            color: allSelected || someSelected ? theme.colors.primary : theme.colors.text.secondary,
          }}>
            {allSelected ? 'Todo seleccionado' : 'Seleccionar todo'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ScrollView horizontal — más compatible que FlatList dentro de un ScrollView padre */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 2 }}
      >
        {items.map(item => (
          <AIContextItem
            key={item.id}
            item={item}
            isSelected={selectedIds.has(item.id)}
            onToggle={onToggle}
          />
        ))}
      </ScrollView>
    </View>
  );
};
