import { v4 as uuidv4 } from 'uuid';
import { flashcardDeckRepository } from '../database/repositories/FlashcardDeckRepository';
import { flashcardRepository } from '../database/repositories/FlashcardRepository';
import { getUserId } from '../api/auth';
import type { GeneratedCard } from '../ai/capabilities/FlashcardCapability';
import { DeckUniquenessService } from './DeckUniquenessService';

export interface RichCard {
  front: string;
  back?: string;
  item_type?: string;
  content_json?: string;
  hint?: string | null;
  explanation?: string | null;
  direction?: string;
}

export interface CreateDeckWithCardsParams {
  title: string;
  description: string;
  subjectId?: string | number;
  subjectName?: string;
  subjectColor?: string;
  subjectIcon?: string;
  cards: (GeneratedCard | RichCard)[];
}

export class FlashcardDomainService {
  /**
   * Persists a deck and its cards through the domain repositories.
   * This is the ONLY authorised path to save AI-generated or imported decks.
   * The UI must never call flashcardDeckRepository or flashcardRepository directly.
   */
  async saveGeneratedDeck(params: CreateDeckWithCardsParams) {
    const userId = await getUserId();
    const deckId = uuidv4();

    // 1. Resolve Unique Title
    const finalTitle = await DeckUniquenessService.ensureUniqueTitle(String(userId || 0), params.title);

    // 2. Create Deck
    const deck = await flashcardDeckRepository.create({
      id: deckId,
      title: finalTitle,
      description: params.description,
      subject_id: params.subjectId ? String(params.subjectId) : undefined,
      subject_name: params.subjectName,
      subject_color: params.subjectColor,
      subject_icon: params.subjectIcon,
      card_count: params.cards.length,
      user_id: String(userId || 0),
      created_at: new Date().toISOString(),
      review_count: 0,
      learning_count: 0,
      new_count: params.cards.length,
    });

    // 2. Create Cards — handles both simple (GeneratedCard) and rich (RichCard) formats
    for (const c of params.cards) {
      const front = (c as any).front || (c as any).pregunta || '';
      const back = (c as any).back || (c as any).respuesta || '';

      await flashcardRepository.create({
        id: uuidv4(),
        deck_id: deck.id,
        front,
        back,
        item_type: (c as RichCard).item_type ?? 'flashcard',
        content_json: (c as RichCard).content_json ?? undefined,
        hint: (c as RichCard).hint ?? null,
        explanation: (c as RichCard).explanation ?? null,
      } as any);
    }

    return deck;
  }
}

export const flashcardDomainService = new FlashcardDomainService();
