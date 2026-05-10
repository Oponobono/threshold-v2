import React from 'react';
import { Modal, Pressable, View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { dashboardStyles as styles } from '../../styles/Dashboard.styles';

interface MetricDetailModalProps {
  metric: { title: string; value: string; subtext: string; icon: string; color: string } | null;
  onClose: () => void;
}

export const MetricDetailModal: React.FC<MetricDetailModalProps> = ({ metric, onClose }) => {
  const { t } = useTranslation();
  if (!metric) return null;

  return (
    <Modal visible animationType="fade" transparent>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <View style={[styles.sheetContent, { marginHorizontal: 20, marginBottom: 'auto', marginTop: 'auto', borderRadius: 32 }]}>
          <View style={styles.sheetHandle} />
          <View style={{ alignItems: 'center', paddingVertical: 10 }}>
            <View style={[styles.iconBox, { backgroundColor: metric.color + '20', width: 60, height: 60, borderRadius: 20, marginBottom: 16 }]}>
              <Ionicons name={metric.icon as any} size={30} color={metric.color} />
            </View>
            <Text style={[styles.sectionTitle, { marginBottom: 4 }]}>{metric.title}</Text>
            <Text style={[styles.cardValue, { fontSize: 22, textAlign: 'center', paddingHorizontal: 10 }]}>{metric.value}</Text>
            <Text style={[styles.greetingSubtext, { marginTop: 8 }]}>{metric.subtext}</Text>
            <TouchableOpacity style={[styles.sheetSaveBtn, { width: '100%', marginTop: 32 }]} onPress={onClose}>
              <Text style={styles.sheetSaveText}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
};
