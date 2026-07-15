import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { documentSelectionToolbarStyles as styles } from '../../styles/DocumentSelectionToolbar.styles';
import { theme } from '../../styles/theme';
import type { TextSelectionEvent } from './PdfRenderer';

interface DocumentSelectionToolbarProps {
  selection: TextSelectionEvent | null;
  onCopy: () => void;
  onShare: () => void;
  onClose: () => void;
}

export function DocumentSelectionToolbar({
  selection,
  onCopy,
  onShare,
  onClose,
}: DocumentSelectionToolbarProps) {
  if (!selection) return null;

  const previewText =
    selection.text.length > 80
      ? selection.text.slice(0, 80) + '...'
      : selection.text;

  return (
    <View style={styles.container}>
      <View style={styles.preview}>
        <Text style={styles.previewText} numberOfLines={2}>
          {previewText}
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={onCopy}>
          <Ionicons name="copy-outline" size={18} color={theme.colors.primary} />
          <Text style={styles.actionText}>Copiar</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity style={styles.actionBtn} onPress={onShare}>
          <Ionicons name="share-outline" size={18} color={theme.colors.primary} />
          <Text style={styles.actionText}>Compartir</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity style={styles.actionBtn} onPress={onClose}>
          <Ionicons name="close-outline" size={18} color={theme.colors.text.secondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
