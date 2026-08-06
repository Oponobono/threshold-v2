import { AIDirective } from '../../providers/AIProvider';
import { DirectiveHandler } from '../DirectiveHandlerRegistry';
import { flashcardCapability } from '../../capabilities/FlashcardCapability';
import { flashcardDomainService } from '../../../domain/FlashcardDomainService';
import { DeckNamingService } from '../../../domain/DeckNamingService';

export class CreateDeckDirectiveHandler implements DirectiveHandler {
  canHandle(directive: AIDirective): boolean {
    return directive.type === 'create_deck';
  }

  async handle(
    directive: AIDirective,
    context: { subjectId?: number | string; userId?: number | string; contextText?: string; subjectName?: string },
  ): Promise<void> {
    if (!context.subjectId || !context.userId) {
      console.warn('[CreateDeckDirectiveHandler] Missing subjectId or userId in context. Skipping.');
      return;
    }

    if (!context.contextText?.trim()) {
      console.warn('[CreateDeckDirectiveHandler] No contextText provided. Cannot generate deck content.');
      return;
    }

    const mode = directive.mode || 'mixed';
    const count = directive.count || 10;
    const title = DeckNamingService.buildBaseDeckTitle({
      source: context.subjectName || 'Materia',
    });

    console.log(`[CreateDeckDirectiveHandler] Generating deck for mode=${mode}, count=${count}, subject=${context.subjectId}`);

    const cards = await flashcardCapability.generate({
      text: context.contextText,
      count,
      mode,
    });

    if (!cards || cards.length === 0) {
      console.warn('[CreateDeckDirectiveHandler] FlashcardCapability returned no cards.');
      return;
    }

    const deck = await flashcardDomainService.saveGeneratedDeck({
      title,
      description: `Mazo generado automáticamente por Zyren`,
      subjectId: context.subjectId,
      cards,
    });

    console.log(`[CreateDeckDirectiveHandler] Deck created: id=${deck.id}, cards=${cards.length}`);
  }
}
