import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { documentListStyles as styles } from '../../styles/SubjectDocumentsList.styles';

export interface SubjectDocumentCardProps {
  doc: any;
  index: number;
  isSelected: boolean;
  selectionMode: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onDelete: () => void;
  onShare: () => void;
  onExtractOCR?: () => void;
  isExtractingOCR?: boolean;
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
  onShare,
  onExtractOCR,
  isExtractingOCR,
}) => {
  const { t } = useTranslation();
  const isPdf = doc.local_uri?.endsWith('.pdf');
  const hasOCR = !!(doc.ocr_text && doc.ocr_text.length > 0);

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
        {/* OCR Status Indicator */}
        <View 
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 16,
            height: 16,
            borderRadius: 8,
            backgroundColor: hasOCR ? theme.colors.success || '#34C759' : theme.colors.warning || '#FF9500',
            borderWidth: 2,
            borderColor: 'white',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Ionicons 
            name={hasOCR ? "checkmark-done" : "alert"} 
            size={10} 
            color="white" 
          />
        </View>
      </View>
      <View style={styles.infoContainer}>
        <Text style={styles.docName} numberOfLines={1}>
          {doc.name || `${t('documents.item') || 'Documento Escaneado'} ${index + 1}`}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <Text style={styles.docDate}>
            {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : (t('common.recent') || 'Reciente')}
          </Text>
          {(doc.cloud_url || doc.is_backed_up === 1) && (
            <Ionicons name="cloud-done" size={14} color={theme.colors.success || '#34C759'} />
          )}
        </View>
        {!hasOCR && (
          <Text style={{ fontSize: 11, color: theme.colors.warning || '#FF9500', marginTop: 4 }}>
            {t('common.ocrPending') || 'Sin OCR - Extrae texto'}
          </Text>
        )}
      </View>
      {!selectionMode && (
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          {!hasOCR && onExtractOCR && (
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation?.(); onExtractOCR(); }}
              disabled={isExtractingOCR}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {isExtractingOCR ? (
                <Ionicons name="hourglass" size={20} color={theme.colors.primary} />
              ) : (
                <MaterialCommunityIcons name="file-document-edit-outline" size={20} color={theme.colors.primary} />
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation?.(); onShare(); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="open-outline" size={20} color={theme.colors.text.secondary} />
          </TouchableOpacity>
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
