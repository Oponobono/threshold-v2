import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Modal, Pressable } from 'react-native';
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

const GOLD = '#C5A059';

export const ActiveRemindersModal: React.FC<Props> = ({ visible, onClose }) => {
  const { t } = useTranslation();
  const [scheduled, setScheduled] = useState<NotificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [infoVisible, setInfoVisible] = useState(false);

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
      <View style={styles.bottomSheetModalOverlay}>
        <View style={[styles.bottomSheetModalContent, { maxHeight: '90%', paddingBottom: 0, paddingHorizontal: 20 }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { flex: 1 }]}>{t('reminders.activeReminders', 'Recordatorios activos')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <TouchableOpacity
                onPress={() => setInfoVisible(true)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="information-circle" size={22} color={GOLD} />
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={24} color={theme.colors.text.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Info tooltip modal ── */}
          <Modal
            transparent
            visible={infoVisible}
            animationType="fade"
            onRequestClose={() => setInfoVisible(false)}
          >
            <Pressable
              style={{
                flex: 1,
                backgroundColor: 'rgba(0,0,0,0.45)',
                justifyContent: 'center',
                alignItems: 'center',
                paddingHorizontal: 20,
              }}
              onPress={() => setInfoVisible(false)}
            >
              <Pressable
                style={{
                  backgroundColor: theme.colors.white,
                  borderRadius: 16,
                  padding: 24,
                  width: '100%',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.18,
                  shadowRadius: 16,
                  elevation: 12,
                }}
                onPress={() => {}}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                  <View style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: `${GOLD}18`,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 10,
                  }}>
                    <Ionicons name="notifications-outline" size={18} color={GOLD} />
                  </View>
                  <Text style={{
                    fontSize: 16,
                    fontWeight: '700',
                    color: theme.colors.text.primary,
                    flex: 1,
                  }}>
                    {t('reminders.infoTitle', '¿Cómo funcionan los recordatorios?')}
                  </Text>
                </View>

                <Text style={{
                  fontSize: 13,
                  color: theme.colors.text.secondary,
                  lineHeight: 20,
                  marginBottom: 10,
                }}>
                  {t(
                    'reminders.infoBody1',
                    'Los recordatorios se crean automáticamente. Tú no necesitas configurarlos aquí de forma manual.',
                  )}
                </Text>
                <Text style={{
                  fontSize: 13,
                  color: theme.colors.text.secondary,
                  lineHeight: 20,
                  marginBottom: 10,
                }}>
                  {t(
                    'reminders.infoBody2',
                    'Cuando agregas una evaluación, un evento en el calendario o un horario de clase, el motor de Threshold programa los avisos automáticamente según el perfil que hayas configurado (Mínimo, Estándar, Persistente).',
                  )}
                </Text>
                <Text style={{
                  fontSize: 13,
                  color: theme.colors.text.secondary,
                  lineHeight: 20,
                }}>
                  {t(
                    'reminders.infoBody3',
                    'Esta pantalla es solo una ventana de observabilidad para que puedas ver cuándo y cuántos avisos tiene el sistema programados para ti.',
                  )}
                </Text>

                <TouchableOpacity
                  onPress={() => setInfoVisible(false)}
                  style={{
                    marginTop: 20,
                    backgroundColor: GOLD,
                    borderRadius: 10,
                    paddingVertical: 11,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>
                    {t('common.understood', 'Entendido')}
                  </Text>
                </TouchableOpacity>
              </Pressable>
            </Pressable>
          </Modal>
          
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
