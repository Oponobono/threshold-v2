import { ReminderPolicy } from './ReminderPolicy';
import type { ReminderProfile, ReminderSequence, Reminder } from '../types';

const STANDARD_OFFSETS: readonly number[] = [0];
const MINIMAL_OFFSETS: readonly number[] = [0];
const PERSISTENT_OFFSETS: readonly number[] = [0];

const DEFAULT_PROFILE: ReminderProfile = {
  name: 'standard',
  defaultOffsets: STANDARD_OFFSETS,
};

/**
 * Política de repaso (flashcard_deck) — contrato v1.1 (Ago 2026):
 *
 * Un mazo con tarjetas por repasar (dueCardsCount/card_count > 0) genera
 * EXACTAMENTE un recordatorio DIARIO a la hora checkTime (FSRS agregado).
 * El ancla temporal ya NO es decisión de esta política: la construye
 * ReviewDuePlanBuilder a partir de checkTime (preferencias del usuario,
 * default 19:00). Por eso getEventTime no existe aquí — el único veto de
 * esta política es el estado del mazo (sin tarjetas pendientes → se cancela).
 *
 * El engine NO guarda estado mutable de dueCardsCount: lee el snapshot en
 * cada build y esta política lo valida en el momento.
 */
export class ReviewPolicy implements ReminderPolicy {
  readonly entityType = 'flashcard_deck';
  readonly defaultProfile = DEFAULT_PROFILE;

  getOffsets(entity: any, profile: ReminderProfile): readonly number[] {
    if (profile.customOffsets && profile.customOffsets.length > 0) {
      return profile.customOffsets;
    }
    switch (profile.name) {
      case 'minimal':
        return MINIMAL_OFFSETS;
      case 'persistent':
        return PERSISTENT_OFFSETS;
      case 'standard':
      default:
        return STANDARD_OFFSETS;
    }
  }

  shouldCancel(sequence: ReminderSequence, entity: any): boolean {
    const cards = entity?.card_count ?? entity?.dueCardsCount;
    return cards != null && cards <= 0;
  }

  shouldCancelReminder(reminder: Reminder, entity: any): boolean {
    const cards = entity?.card_count ?? entity?.dueCardsCount;
    return cards != null && cards <= 0;
  }

  getExpiration(entity: any): Date | null {
    return null;
  }
}
