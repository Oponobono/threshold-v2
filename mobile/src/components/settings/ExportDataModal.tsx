import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { settingsStyles as styles } from '../../styles/Settings.styles';
import { alertRef } from '../ui/CustomAlert';

interface Props {
  visible: boolean;
  onClose: () => void;
  onExportCsv: () => Promise<void>;
  onExportPdf: () => Promise<void>;
}

export const ExportDataModal: React.FC<Props> = ({ visible, onClose, onExportCsv, onExportPdf }) => {
  const { t } = useTranslation();
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);

  const handleExport = async (format: 'csv' | 'pdf') => {
    setExporting(format);
    try {
      if (format === 'csv') {
        await onExportCsv();
      } else {
        await onExportPdf();
      }
      alertRef.show({ title: t('common.success'), message: `Datos exportados como ${format.toUpperCase()}`, type: 'success' });
      onClose();
    } catch (error: any) {
      alertRef.show({ title: t('common.error'), message: error.message || `Error exportando ${format.toUpperCase()}`, type: 'error' });
    } finally {
      setExporting(null);
    }
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('integrations.dataExport')}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.colors.text.primary} />
            </TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            <Text style={styles.modalDesc}>{t('integrations.dataExportDesc')}</Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <TouchableOpacity
                style={[styles.exportBtn, { flex: 1 }, exporting === 'csv' && { opacity: 0.6 }]}
                onPress={() => handleExport('csv')}
                disabled={!!exporting}
              >
                {exporting === 'csv' ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.exportBtnText}>CSV</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.exportBtn, styles.exportBtnOutline, { flex: 1 }, exporting === 'pdf' && { opacity: 0.6 }]}
                onPress={() => handleExport('pdf')}
                disabled={!!exporting}
              >
                {exporting === 'pdf' ? (
                  <ActivityIndicator size="small" color={theme.colors.text.primary} />
                ) : (
                  <Text style={styles.exportBtnOutlineText}>PDF</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.modalBtnSecondary} onPress={onClose}>
              <Text style={styles.modalBtnSecondaryText}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
