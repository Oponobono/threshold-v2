import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { documentSelectionToolbarStyles as styles } from '../../styles/DocumentSelectionToolbar.styles';
import { theme } from '../../styles/theme';
import { HIGHLIGHT_COLORS, type HighlightColor } from '../../domain/document/DocumentHighlight';
import type { TextSelectionEvent } from './PdfRenderer';

interface DocumentSelectionToolbarProps {
  selection: TextSelectionEvent | null;
  onCopy: () => void;
  onShare: () => void;
  onHighlight: (color: HighlightColor) => void;
  onClose: () => void;
  onDelete?: () => void;
  bottomInset: number;
  mode?: 'create' | 'edit';
}

export function DocumentSelectionToolbar({
  selection,
  onCopy,
  onShare,
  onHighlight,
  onClose,
  onDelete,
  bottomInset,
  mode = 'create',
}: DocumentSelectionToolbarProps) {
  const [colorPickerVisible, setColorPickerVisible] = useState(mode === 'edit');

  if (!selection) return null;

  const previewText =
    selection.text.length > 80
      ? selection.text.slice(0, 80) + '...'
      : selection.text;

  return (
    <View style={[styles.container, { paddingBottom: bottomInset || 12 }]}>
      <View style={styles.preview}>
        <Text style={styles.previewText} numberOfLines={2}>
          {previewText}
        </Text>
      </View>

      {colorPickerVisible && (
        <View style={styles.colorRow}>
          {HIGHLIGHT_COLORS.map(c => (
            <TouchableOpacity
              key={c.color}
              style={[styles.colorDot, { backgroundColor: c.hex.replace(/[\d.]+\)$/, '1)') }]}
              onPress={() => {
                onHighlight(c.color);
                setColorPickerVisible(false);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            />
          ))}
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={onCopy}>
          <Ionicons name="copy-outline" size={18} color={theme.colors.primary} />
          <Text style={styles.actionText}>Copiar</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={onShare}>
          <Ionicons name="share-outline" size={18} color={theme.colors.primary} />
          <Text style={styles.actionText}>Compartir</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => setColorPickerVisible(v => !v)}
        >
          <Ionicons name="color-fill-outline" size={18} color={theme.colors.primary} />
          <Text style={styles.actionText}>{mode === 'edit' ? 'Color' : 'Resaltar'}</Text>
        </TouchableOpacity>

        {mode === 'edit' && onDelete && (
          <TouchableOpacity style={styles.actionBtn} onPress={onDelete}>
            <Ionicons name="trash-outline" size={18} color={theme.colors.error} />
            <Text style={[styles.actionText, { color: theme.colors.error }]}>Eliminar</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.actionBtn} onPress={onClose}>
          <Ionicons name="close-outline" size={18} color={theme.colors.text.secondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
