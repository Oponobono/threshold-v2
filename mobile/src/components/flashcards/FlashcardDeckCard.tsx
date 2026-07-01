import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { flashcardsStyles } from '../../styles/FlashcardsModal.styles';
import type { FlashcardDeck } from '../../services/api';

const AnimatedArrow = React.memo(function AnimatedArrow() {
  return (
    <View style={{ width: 40, height: 40, marginRight: -6, transform: [{ rotate: '90deg' }] }}>
      <LottieView
        source={require('../../lottieFiles/arrow.json')}
        autoPlay
        loop
        style={{ width: '100%', height: '100%' }}
      />
    </View>
  );
});

interface DeckCardProps {
  deck: FlashcardDeck;
  isShared: boolean;
  currentUserId: string | null;
  isDue: boolean;
  onPress: () => void;
  onLongPress: () => void;
}

export const FlashcardDeckCard = React.memo(function DeckCard({
  deck, isShared, currentUserId, isDue, onPress, onLongPress,
}: DeckCardProps) {
  const { t } = useTranslation();

  const hasExam = !!(deck as any).linked_exam_title;
  const examDate = (deck as any).linked_exam_date;
  const examDays = examDate ? (() => {
    try {
      let d: Date;
      if (examDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        d = new Date(examDate);
      } else {
        const [day, month, year] = examDate.split('-').map(Number);
        d = new Date(year, month - 1, day);
      }
      return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    } catch { return null; }
  })() : null;
  const examColor = examDays === null ? '#9E9E9E' : examDays <= 3 ? '#D32F2F' : examDays <= 7 ? '#F57C00' : examDays <= 14 ? '#F9A825' : '#388E3C';

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={500}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: pressed ? `${flashcardsStyles.deckCard.backgroundColor}80` : flashcardsStyles.deckCard.backgroundColor,
        borderRadius: 18,
        padding: 14,
        borderWidth: 1,
        borderColor: isDue ? theme.colors.danger : flashcardsStyles.deckCard.borderColor,
        gap: 12,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 21,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: (deck as any).subject_color || '#DDE7FF',
        }}
      >
        <MaterialCommunityIcons
          name={isShared ? 'account-group-outline' : (((deck as any).subject_icon as any) || 'cards-outline')}
          size={20}
          color={theme.colors.text.primary}
        />
      </View>

      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 15,
            fontWeight: '700',
            color: theme.colors.text.primary,
          }}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {deck.title}
        </Text>
        {isShared && (
          <Text style={{ fontSize: 11, color: '#388E3C', fontStyle: 'italic', marginBottom: 2, marginTop: 2 }}>
            <Ionicons name="people" size={10} color="#388E3C" />
            {' '}{t('modals.shared')} {t('flashcards.sharedBy')} @{(deck as any).owner_username || (deck as any).owner_name || t('flashcards.peer')}
          </Text>
        )}
        <Text
          style={{
            fontSize: 12,
            color: theme.colors.text.secondary,
            marginTop: 1,
          }}
          numberOfLines={1}
        >
          {(deck as any).subject_name || t('flashcards.noSubject')}
        </Text>
        {hasExam && (
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            marginTop: 6,
            paddingTop: 5,
            borderTopWidth: 0.5,
            borderTopColor: examColor + '30',
          }}>
            <Ionicons name="calendar-outline" size={10} color={examColor} style={{ opacity: 0.8 }} />
            <Text style={{
              fontSize: 10.5,
              color: examColor,
              fontWeight: '500',
              flex: 1,
              opacity: 0.85,
            }} numberOfLines={1}>
              {(deck as any).linked_exam_title}
            </Text>
            {examDays !== null && (
              <View style={{
                paddingHorizontal: 5,
                paddingVertical: 1.5,
                borderRadius: 4,
                borderWidth: 0.5,
                borderColor: examColor + '45',
              }}>
                <Text style={{ fontSize: 9.5, color: examColor, fontWeight: '600', opacity: 0.75 }}>
                  {examDays < 0 ? 'Pasado' : examDays === 0 ? 'Hoy' : examDays === 1 ? 'Mañana' : `${examDays}d`}
                </Text>
              </View>
            )}
          </View>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: hasExam ? 4 : 6 }}>
          <Text style={{ fontSize: 12, color: theme.colors.text.primary, fontWeight: '500' }}>
            {Number(deck.card_count ?? 0)} {t('flashcards.cards')}
          </Text>
          {Number(deck.card_count ?? 0) > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 11, color: '#388E3C', fontWeight: '600' }}>
                ✓ {Number((deck as any).review_count ?? 0)}
              </Text>
              <Text style={{ fontSize: 11, color: '#FF9800', fontWeight: '600' }}>
                💪 {Number((deck as any).learning_count ?? 0) + Number((deck as any).new_count ?? 0)}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <AnimatedArrow />
      </View>
    </Pressable>
  );
});
