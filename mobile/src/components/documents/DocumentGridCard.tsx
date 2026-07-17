import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { documentsStyles as styles } from '../../styles/DocumentsScreen.styles';
import { theme } from '../../styles/theme';
import type { DocumentWithSubject } from '../../services/database/repositories/DocumentRepository';

interface Props {
  doc: DocumentWithSubject;
  onPress: () => void;
  onDelete?: () => void;
}

function getFormatInfo(uri: string): { icon: string; color: string } {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.pdf')) return { icon: 'file-pdf-box', color: '#FF3B30' };
  if (lower.endsWith('.xlsx') || lower.endsWith('.xlsm') || lower.endsWith('.xls') || lower.endsWith('.csv'))
    return { icon: 'file-excel-box', color: '#107C41' };
  if (lower.endsWith('.doc') || lower.endsWith('.docx')) return { icon: 'file-word-box', color: '#2B579A' };
  if (lower.endsWith('.ppt') || lower.endsWith('.pptx')) return { icon: 'file-powerpoint-box', color: '#D24726' };
  if (lower.endsWith('.json')) return { icon: 'code-braces-box', color: '#F7DF1E' };
  if (lower.endsWith('.txt')) return { icon: 'text-box', color: '#00ACC1' };
  return { icon: 'file-document-outline', color: theme.colors.text.secondary };
}

export const DocumentGridCard: React.FC<Props> = ({ doc, onPress, onDelete }) => {
  const formatInfo = getFormatInfo(doc.local_uri || '');
  const date = doc.created_at ? new Date(doc.created_at).toLocaleDateString() : '';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.iconContainer, { backgroundColor: formatInfo.color + '18' }]}>
        <MaterialCommunityIcons name={formatInfo.icon as any} size={24} color={formatInfo.color} />
      </View>
      <View style={styles.infoContainer}>
        <Text style={styles.docName} numberOfLines={1}>{doc.name || 'Documento'}</Text>
        <Text style={styles.docMeta} numberOfLines={1}>
          {date}{doc.ocr_text ? ' · Con texto' : ''}
        </Text>
      </View>
      {onDelete && (
        <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="trash-outline" size={18} color={theme.colors.text.secondary} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};
