/**
 * QuestionRendererFactory.tsx
 *
 * Fábrica de UI (Factory Pattern) que recibe un EvaluationItem genérico
 * y renderiza el componente especializado correcto según su item_type.
 * Centraliza toda la lógica de enrutamiento — los componentes padre
 * nunca necesitan hacer switch/if sobre el tipo.
 */
import React from 'react';
import { EvaluationItem } from '../../services/api/types';
import { FlashcardView } from './FlashcardView';
import { MultipleChoiceView } from './MultipleChoiceView';
import { BooleanView } from './BooleanView';

interface Props {
  item: EvaluationItem;
  onAnswer: (answer: unknown) => void;
  onReveal: () => void;
  isAnswered: boolean;
  // Para flashcard
  selectedRating: 'learning' | 'review' | null;
  // Para multiple_choice
  selectedIndex: number | null;
  // Para boolean
  selectedBoolean: boolean | null;
}

export const QuestionRendererFactory: React.FC<Props> = ({
  item, onAnswer, onReveal, isAnswered,
  selectedRating, selectedIndex, selectedBoolean,
}) => {
  switch (item.item_type) {
    case 'flashcard':
      return (
        <FlashcardView
          item={item}
          onReveal={onReveal}
          onAnswer={(rating) => onAnswer(rating)}
          isAnswered={isAnswered}
          selectedRating={selectedRating}
        />
      );

    case 'multiple_choice':
      return (
        <MultipleChoiceView
          item={item}
          onAnswer={(idx) => onAnswer(idx)}
          isAnswered={isAnswered}
          selectedIndex={selectedIndex}
        />
      );

    case 'boolean':
      return (
        <BooleanView
          item={item}
          onAnswer={(val) => onAnswer(val)}
          isAnswered={isAnswered}
          selectedAnswer={selectedBoolean}
        />
      );

    default:
      return null;
  }
};
