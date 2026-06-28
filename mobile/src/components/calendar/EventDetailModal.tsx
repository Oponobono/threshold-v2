import React from 'react';
import { View, Text, TouchableOpacity, Modal, Animated, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../styles/theme';
import { modalStyles } from '../../styles/CalendarModals.styles';
import { useSlideAnimation } from '../../hooks/useSlideAnimation';

interface EventDetailModalProps {
  visible: boolean;
  onClose: () => void;
  event: any;
  t: any;
}

export const EventDetailModal: React.FC<EventDetailModalProps> = ({ visible, onClose, event, t }) => {
  const slideAnim = useSlideAnimation(visible, 600);
  const insets = useSafeAreaInsets();

  if (!event) return null;

  const eventTypeLabel = (type: string) => {
    switch (type) {
      case 'exam': return t('calendar.exam') || 'Examen';
      case 'task': return t('calendar.task') || 'Tarea';
      case 'class': return t('calendar.class') || 'Clase';
      case 'other': return t('calendar.other') || 'Otro';
      default: return type;
    }
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={modalStyles.overlay}
        activeOpacity={1}
        onPress={onClose}
      />
      <Animated.View
        style={[
          modalStyles.container,
          {
            transform: [{ translateY: slideAnim }],
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        <View style={modalStyles.content}>
          <ScrollView
            scrollEnabled={true}
            showsVerticalScrollIndicator={false}
          >
            <View style={modalStyles.header}>
              <Text style={modalStyles.title}>{t('calendar.eventDetail') || 'Detalle del evento'}</Text>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={24} color={theme.colors.text.primary} />
              </TouchableOpacity>
            </View>

            <View style={modalStyles.eventBody}>
              <View style={[modalStyles.eventTitleRow, { borderLeftColor: event.color || '#A2845E' }]}>
                <Text style={modalStyles.eventTitle}>{event.title}</Text>
              </View>

              <View style={modalStyles.detailRow}>
                <Ionicons name="bookmark-outline" size={16} color={theme.colors.text.secondary} />
                <Text style={modalStyles.detailText}>{eventTypeLabel(event.eventType)}</Text>
              </View>

              <View style={modalStyles.detailRow}>
                <Ionicons name="time-outline" size={16} color={theme.colors.text.secondary} />
                <Text style={modalStyles.detailText}>{event.time || t('calendar.allDay')}</Text>
              </View>

              {event.description ? (
                <View style={modalStyles.detailRow}>
                  <Ionicons name="document-text-outline" size={16} color={theme.colors.text.secondary} />
                  <Text style={modalStyles.detailText}>{event.description}</Text>
                </View>
              ) : null}

              {event.id && (
                <LinkedDecksSection eventId={String(event.id).replace('event-', '')} />
              )}
            </View>
          </ScrollView>

          <TouchableOpacity
            style={modalStyles.closeButton}
            onPress={onClose}
          >
            <Text style={modalStyles.closeButtonText}>{t('common.close')}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
};


// ─── LinkedDecksSection ───────────────────────────────────────────────────────
// Muestra TODOS los mazos vinculados a un examen (relación 1 examen → muchos mazos)
const LinkedDecksSection = ({ eventId }: { eventId: string }) => {
  const [decks, setDecks] = React.useState<{ id: string; title: string }[] | null>(null);

  React.useEffect(() => {
    if (!eventId) return;
    Promise.all([
      import('../../services/database').then(m => m.flashcardDeckRepository.getByLinkedEvent(eventId)),
      import('../../services/localFlashcardService').then(m => m.getLocalDecks()),
    ]).then(([sqliteDecks, localDecks]) => {
      // Mazos de SQLite vinculados a este evento
      const fromSqlite = (sqliteDecks || []).map((d: any) => ({ id: String(d.id), title: d.title }));
      // Mazos locales MMKV vinculados a este evento
      const fromLocal = (localDecks || [])
        .filter((ld: any) => String(ld.linked_event_id) === String(eventId))
        .map((ld: any) => ({ id: String(ld.id), title: ld.title }));
      // Merge sin duplicados
      const merged = [...fromSqlite];
      for (const ld of fromLocal) {
        if (!merged.find(d => d.id === ld.id)) merged.push(ld);
      }
      setDecks(merged);
    }).catch(() => setDecks([]));
  }, [eventId]);

  if (decks === null) {
    // Cargando
    return (
      <View style={[modalStyles.detailRow, { marginTop: 8 }]}>
        <Ionicons name="layers-outline" size={16} color={theme.colors.primary} />
        <Text style={[modalStyles.detailText, { color: theme.colors.text.secondary }]}>Cargando mazos...</Text>
      </View>
    );
  }

  if (decks.length === 0) return null;

  return (
    <View style={{ marginTop: 8, gap: 6 }}>
      <View style={modalStyles.detailRow}>
        <Ionicons name="layers-outline" size={16} color={theme.colors.primary} />
        <Text style={[modalStyles.detailText, { color: theme.colors.primary, fontWeight: '700' }]}>
          {decks.length === 1 ? 'Mazo vinculado' : `${decks.length} mazos vinculados`}
        </Text>
      </View>
      {decks.map((d) => (
        <View
          key={d.id}
          style={[
            modalStyles.detailRow,
            { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: theme.colors.primary + '10', borderRadius: 8, marginLeft: 4 },
          ]}
        >
          <Ionicons name="layers-outline" size={13} color={theme.colors.primary} style={{ opacity: 0.7 }} />
          <Text
            style={[modalStyles.detailText, { color: theme.colors.primary, fontWeight: '600', fontSize: 13 }]}
            numberOfLines={1}
          >
            {d.title}
          </Text>
        </View>
      ))}
    </View>
  );
};

