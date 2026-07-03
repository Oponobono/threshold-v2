import { createMMKV } from 'react-native-mmkv';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { flashcardDeckRepository } from '../database/repositories/FlashcardDeckRepository';

export interface MigrationAudit {
  totalDecks: number;
  negativeIds: number;
  duplicateIds: number;
  corruptedEntries: number;
  hasCards: boolean;
}

export interface MigrationReport {
  total: number;
  migrated: number;
  reassignedIds: number;
  failed: number;
  durationMs: number;
  mmkvCleared: boolean;
}

async function auditMMKV(mmkv: ReturnType<typeof createMMKV>): Promise<MigrationAudit> {
  const raw = mmkv.getString('local:flashcard_decks');
  if (!raw) return { totalDecks: 0, negativeIds: 0, duplicateIds: 0, corruptedEntries: 0, hasCards: false };

  let decks: any[];
  try { decks = JSON.parse(raw); }
  catch { return { totalDecks: -1, negativeIds: 0, duplicateIds: 0, corruptedEntries: 1, hasCards: false }; }

  const ids = decks.map(d => String(d.id));
  const uniqueIds = new Set(ids);
  const corrupted = decks.filter(d => !d.title || !d.user_id);
  const allKeys = mmkv.getAllKeys() as string[];
  const hasCards = allKeys.some(k => k.startsWith('cache:flashcards_by_deck:'));

  return {
    totalDecks: decks.length,
    negativeIds: decks.filter(d => typeof d.id === 'number' && d.id < 0).length,
    duplicateIds: ids.length - uniqueIds.size,
    corruptedEntries: corrupted.length,
    hasCards,
  };
}

export async function migrateFlashcardsFromMMKV(): Promise<MigrationReport | null> {
  const mmkv = createMMKV({ id: 'oponobono.threshold' });
  if (mmkv.getString('flashcards_migrated_v1') === 'true') return null;

  const audit = await auditMMKV(mmkv);
  if (audit.corruptedEntries > 0 || audit.totalDecks === -1) {
    console.error('[Migration] MMKV corrupto — abortando migración:', audit);
    return { total: audit.totalDecks, migrated: 0, reassignedIds: 0, failed: audit.totalDecks, durationMs: 0, mmkvCleared: false };
  }

  const t0 = Date.now();
  const raw = mmkv.getString('local:flashcard_decks');
  if (!raw) {
    mmkv.set('flashcards_migrated_v1', 'true');
    return { total: 0, migrated: 0, reassignedIds: 0, failed: 0, durationMs: 0, mmkvCleared: true };
  }

  const decks = JSON.parse(raw);
  let migrated = 0, reassignedIds = 0, failed = 0;

  for (const deck of decks) {
    try {
      const isNegative = typeof deck.id === 'number' && deck.id < 0;
      const safeId = isNegative ? uuidv4() : String(deck.id);
      if (isNegative) reassignedIds++;

      await flashcardDeckRepository.upsert({ ...deck, id: safeId });

      // Verificación de integridad de contenido (no solo existencia)
      const stored = await flashcardDeckRepository.getById(safeId);
      if (!stored || stored.title !== deck.title || String(stored.user_id) !== String(deck.user_id)) {
        throw new Error(`Integrity check failed for deck ${safeId}`);
      }

      migrated++;
    } catch (err) {
      console.error(`[Migration] Falló deck ${deck.id}:`, err);
      failed++;
    }
  }

  const allMigrated = failed === 0;
  if (allMigrated) {
    mmkv.remove('local:flashcard_decks');
    mmkv.set('flashcards_migrated_v1', 'true');
  }

  const report: MigrationReport = {
    total: decks.length,
    migrated,
    reassignedIds,
    failed,
    durationMs: Date.now() - t0,
    mmkvCleared: allMigrated,
  };

  console.log('[Migration] Flashcards Migration Report:', report);
  return report;
}
