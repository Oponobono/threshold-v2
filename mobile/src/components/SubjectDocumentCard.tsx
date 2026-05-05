import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../styles/theme';
import { documentListStyles as styles } from '../styles/SubjectDocumentsList.styles';

export interface SubjectDocumentCardProps {
  doc: any;
  index: number;
  isSelected: boolean;
  selectionMode: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onDelete: () => void;
}

/**
 * SubjectDocumentCard.tsx
 *
 * Componente funcional que renderiza la información de un documento individual
 * en la lista de documentos (`SubjectDocumentsList`). Reacciona al estado de selección
 * múltiple cambiando su estilo y añadiendo un check de selección.
 * Detecta automáticamente si es PDF o Imagen por la extensión de su URI local.
 *
 * @param doc - Objeto con la información y metadatos del documento.
 * @param index - Posición del documento en la lista para un nombre alternativo.
 * @param isSelected - Si está activo en el modo de selección múltiple.
 * @param selectionMode - Si el usuario activó la herramienta de selección global.
 * @param onPress - Callback de toque (abre visor de doc o selecciona).
 * @param onLongPress - Activa el modo de selección múltiple global.
 * @param onDelete - Inicia el flujo individual para eliminar el documento.
 */
export const SubjectDocumentCard: React.FC<SubjectDocumentCardProps> = ({
  doc,
  index,
  isSelected,
  selectionMode,
  onPress,
  onLongPress,
  onDelete,
}) => {
  const { t } = useTranslation();
  const isPdf = doc.local_uri?.endsWith('.pdf');

  return (
    <TouchableOpacity 
      style={[styles.documentCard, isSelected && styles.documentCardSelected]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      {selectionMode && (
        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
          {isSelected && <Ionicons name="checkmark" size={14} color="white" />}
        </View>
      )}
      <View style={styles.iconContainer}>
        <MaterialCommunityIcons 
          name={isPdf ? "file-pdf-box" : "image-outline"} 
          size={32} 
          color={isPdf ? (theme.colors.text.error || '#FF3B30') : theme.colors.primary} 
        />
      </View>
      <View style={styles.infoContainer}>
        <Text style={styles.docName} numberOfLines={1}>
          {doc.name || `${t('subjects.scannedDocument') || 'Documento Escaneado'} ${index + 1}`}
        </Text>
        <Text style={styles.docDate}>
          {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : (t('common.recent') || 'Reciente')}
        </Text>
      </View>
      {!selectionMode && (
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Ionicons name="open-outline" size={20} color={theme.colors.text.secondary} />
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation?.(); onDelete(); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={20} color={theme.colors.text.secondary} />
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
};
