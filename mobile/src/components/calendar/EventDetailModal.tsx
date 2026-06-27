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

              {event.linked_deck_id && (
                <LinkedDeckRow deckId={event.linked_deck_id} />
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

const LinkedDeckRow = ({ deckId }: { deckId: string }) => {
  const [deckTitle, setDeckTitle] = React.useState<string>('Cargando mazo...');
  React.useEffect(() => {
    import('../../services/database').then(({ flashcardDeckRepository }) => {
      import('../../services/localFlashcardService').then(({ getLocalDecks }) => {
        flashcardDeckRepository.getById(deckId).then(d => {
          if (d && (d as any).title) {
            setDeckTitle((d as any).title);
          } else {
            const localDecks = getLocalDecks();
            const localDeck = localDecks.find((ld: any) => String(ld.id) === String(deckId));
            if (localDeck && localDeck.title) {
              setDeckTitle(localDeck.title);
            } else {
              setDeckTitle('Mazo vinculado');
            }
          }
        });
      });
    });
  }, [deckId]);

  return (
    <View style={[modalStyles.detailRow, { marginTop: 8, padding: 8, backgroundColor: theme.colors.primary + '15', borderRadius: 8 }]}>
      <Ionicons name="layers-outline" size={16} color={theme.colors.primary} />
      <Text style={[modalStyles.detailText, { color: theme.colors.primary, fontWeight: '600' }]}>{deckTitle}</Text>
    </View>
  );
};
