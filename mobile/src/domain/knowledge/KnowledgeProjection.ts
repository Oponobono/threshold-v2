import { databaseService } from '../../services/database/DatabaseService';
import { getKnowledgeAggregation } from './query';
import { KnowledgeSnapshotBuilder } from './KnowledgeSnapshotBuilder';
import { snapshotTelemetry } from './SnapshotTelemetryService';
import { ConsoleTelemetryCollector, MmkvTelemetryCollector } from './SnapshotTelemetryCollector';
import type { KnowledgeSnapshot } from './types';
import type { KnowledgeProvider } from './KnowledgeProvider';
import { SnapshotBuildReason } from './SnapshotTelemetryTypes';

let collectorsInitialized = false;

function ensureCollectors(): void {
  if (collectorsInitialized) return;
  collectorsInitialized = true;
  try {
    snapshotTelemetry.subscribe(new ConsoleTelemetryCollector());
  } catch {}
  try {
    snapshotTelemetry.subscribe(new MmkvTelemetryCollector());
  } catch {}
}

// ─── In-memory cache con TTL ──────────────────────────────────────────────────
// Evita ejecutar la agregación SQL + JS (1-2s en el JS thread) en llamadas
// repetidas dentro de la misma sesión cuando los datos no han cambiado.
// Esto elimina el "black flash" causado por bloquear el JS thread durante
// transiciones de pantalla (Dashboard mount / re-mount).
const SNAPSHOT_CACHE_TTL_MS = 45_000; // 45 segundos

interface SnapshotCacheEntry {
  snapshot: KnowledgeSnapshot;
  builtAt: number;
}

const _snapshotCache = new Map<string, SnapshotCacheEntry>();

/** Invalida el cache de un usuario. Llamar tras mutaciones de flashcards. */
export function invalidateKnowledgeCache(userId: string): void {
  _snapshotCache.delete(userId);
}

export class KnowledgeProjection implements KnowledgeProvider {
  buildSnapshot(userId: string, reason?: SnapshotBuildReason): Promise<KnowledgeSnapshot> {
    return this.buildSnapshotWithReason(userId, reason ?? 'BOOT' as SnapshotBuildReason);
  }

  async buildSnapshotWithReason(userId: string, reason: SnapshotBuildReason): Promise<KnowledgeSnapshot> {
    ensureCollectors();

    // ── Cache hit: devolver snapshot sin tocar SQLite ─────────────────────────
    // MANUAL_REFRESH siempre fuerza reconstrucción (el usuario lo solicitó explícitamente).
    if (reason !== SnapshotBuildReason.MANUAL_REFRESH) {
      const cached = _snapshotCache.get(userId);
      if (cached && Date.now() - cached.builtAt < SNAPSHOT_CACHE_TTL_MS) {
        console.log(`[KnowledgeProjection] Cache HIT (${reason}) — ${Math.round((Date.now() - cached.builtAt) / 1000)}s old, skipping SQL`);
        return cached.snapshot;
      }
    }

    const ctx = snapshotTelemetry.begin(reason, userId);

    const readStart = Date.now();
    const db = databaseService.getDb();
    ctx.phaseTiming.repositoryReadMs = Date.now() - readStart;

    const aggStart = Date.now();
    const aggregation = await getKnowledgeAggregation(userId);
    ctx.phaseTiming.aggregationMs = Date.now() - aggStart;

    const buildStart = Date.now();
    const snapshot = new KnowledgeSnapshotBuilder(aggregation).build();
    ctx.phaseTiming.snapshotCreateMs = Date.now() - buildStart;

    const freezeStart = Date.now();
    Object.freeze(snapshot);
    ctx.phaseTiming.freezeMs = Date.now() - freezeStart;

    const cacheStart = Date.now();
    // Guardar en cache in-memory para evitar SQL en llamadas repetidas
    _snapshotCache.set(userId, { snapshot, builtAt: Date.now() });
    ctx.phaseTiming.cacheWriteMs = Date.now() - cacheStart;

    ctx.finish(aggregation);

    return snapshot;
  }
}

// Dev-only: global trigger for post-sync measurement from console
if (__DEV__) {
  (globalThis as any).__triggerKnowledgeSnapshot = async (userId: string) => {
    const projection = new KnowledgeProjection();
    return projection.buildSnapshot(userId, SnapshotBuildReason.MANUAL_REFRESH);
  };
}
