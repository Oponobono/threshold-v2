import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { getAllScheduledNotificationsAsync } from 'expo-notifications';
import type { NotificationRequest, NotificationTrigger } from 'expo-notifications';
import { theme } from '../../styles/theme';
import { settingsStyles as styles } from '../../styles/Settings.styles';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export const ActiveRemindersModal: React.FC<Props> = ({ visible, onClose }) => {
  const { t } = useTranslation();
  const [scheduled, setScheduled] = useState<NotificationRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      (async () => {
        try {
          const all = await getAllScheduledNotificationsAsync();
          setScheduled(all);
        } catch {
          setScheduled([]);
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [visible]);

  const getDateLabel = (trigger: NotificationTrigger | null): string => {
    if (!trigger) return t('reminders.noDate', 'Sin fecha');
    const date = 'date' in trigger ? trigger.date : null;
    if (!date) return t('reminders.noDate', 'Sin fecha');
    const d = new Date(date);
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    if (diff < 0) return t('reminders.pastDue', 'Vencido');
    if (diff < 60000) return t('reminders.lessThanMinute', 'En menos de 1 min');
    if (diff < 3600000) return t('reminders.minutesAway', { count: Math.round(diff / 60000) });
    if (diff < 86400000) return t('reminders.hoursAway', { count: Math.round(diff / 3600000) });
    return d.toLocaleDateString();
  };

  const getTriggerDate = (trigger: NotificationTrigger | null): Date | null => {
    if (!trigger) return null;
    return 'date' in trigger ? new Date(trigger.date) : null;
  };

  const groupByDate = () => {
    const groups: Record<string, NotificationRequest[]> = {};
    scheduled.forEach(n => {
      const d = getTriggerDate(n.trigger);
      const key = d ? d.toDateString() : 'unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(n);
    });
    return groups;
  };

  const groups = groupByDate();

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { maxHeight: '90%', paddingBottom: 0 }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('reminders.activeReminders', 'Recordatorios activos')}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.colors.text.primary} />
            </TouchableOpacity>
          </View>
          
          {loading ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
            </View>
          ) : (
            <ScrollView style={[styles.modalBody, { paddingBottom: 40 }]}>
              {scheduled.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                  <Ionicons name="notifications-outline" size={40} color={theme.colors.text.secondary} style={{ opacity: 0.5 }} />
                  <Text style={[styles.settingDesc, { marginTop: 12, textAlign: 'center' }]}>
                    {t('reminders.noActive', 'No tienes recordatorios próximos.')}
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={[styles.sectionDesc, { marginBottom: 20 }]}>
                    {t('reminders.activeCount', { count: scheduled.length })}
                  </Text>

                  {Object.entries(groups).map(([dateKey, notifications]) => (
                    <View key={dateKey} style={{ marginBottom: 24 }}>
                      <Text style={[styles.subSectionTitle, { marginBottom: 8, fontSize: 13, color: theme.colors.text.secondary, textTransform: 'capitalize' }]}>
                        {dateKey === 'unknown' ? t('reminders.unscheduled', 'Sin programar') : dateKey}
                      </Text>
                      {notifications.map((n, i) => (
                        <View key={n.identifier || i} style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingVertical: 12,
                          borderBottomWidth: i === notifications.length - 1 ? 0 : 1,
                          borderColor: theme.colors.border,
                        }}>
                          <Ionicons 
                            name="time-outline" 
                            size={16} 
                            color={theme.colors.text.secondary} 
                            style={{ marginRight: 12, marginTop: 2, alignSelf: 'flex-start' }} 
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.settingTitle, { fontSize: 14 }]} numberOfLines={1}>
                              {n.content.title || t('reminders.reminder', 'Recordatorio')}
                            </Text>
                            {n.content.body && (
                              <Text style={[styles.settingDesc, { fontSize: 12, marginTop: 2 }]} numberOfLines={2}>
                                {n.content.body}
                              </Text>
                            )}
                          </View>
                          <Text style={[styles.settingDesc, { fontSize: 11, marginLeft: 12, color: theme.colors.primary }]}>
                            {getDateLabel(n.trigger)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ))}
                </>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};
