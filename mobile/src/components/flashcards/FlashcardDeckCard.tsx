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
          backgroundColor: deck.subject_color || '#DDE7FF',
        }}
      >
        <MaterialCommunityIcons
          name={isShared ? 'account-group-outline' : ((deck.subject_icon as React.ComponentProps<typeof MaterialCommunityIcons>['name']) || 'cards-outline')}
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
            {' '}{t('modals.shared')} {t('flashcards.sharedBy')} @{deck.owner_username || deck.owner_name || t('flashcards.peer')}
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
          {deck.subject_name || t('flashcards.noSubject')}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <Text style={{ fontSize: 12, color: theme.colors.text.secondary }}>
            {Number(deck.card_count ?? 0)} {t('flashcards.cards')}
          </Text>
          {Number(deck.card_count ?? 0) > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 11, color: '#388E3C', fontWeight: '600' }}>
                ✓ {Number(deck.review_count ?? 0)}
              </Text>
              <Text style={{ fontSize: 11, color: theme.colors.primary, fontWeight: '600' }}>
                💪 {Number(deck.learning_count ?? 0) + Number(deck.new_count ?? 0)}
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
