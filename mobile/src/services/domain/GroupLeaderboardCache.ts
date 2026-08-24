import { createMMKV } from 'react-native-mmkv';
import { fetchWithFallback, parseJsonSafely } from '../api/client';

export interface LeaderboardEntry {
  user_id?: string;
  userId?: string;
  username?: string;
  displayName?: string;
  profileImage?: string;
  gpa: number;
}

export interface LeaderboardSnapshot {
  groupPinId: string;
  entries: LeaderboardEntry[];
  fetchedAt: string; // ISO
}

export type LeaderboardState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'available'; snapshot: LeaderboardSnapshot }
  | { status: 'stale'; snapshot: LeaderboardSnapshot }
  | { status: 'unavailable' };

// Usamos una instancia MMKV separada o la misma que la principal, pero con un namespace claro
const mmkv = createMMKV({ id: 'group-leaderboard-cache' });
const CACHE_KEY_PREFIX = 'leaderboard_';

class GroupLeaderboardCache {
  /**
   * Carga inmediatamente el snapshot guardado (si existe) y determina si está stale.
   * NO hace fetch de red.
   */
  async load(groupPinId: string): Promise<LeaderboardState> {
    const snapshot = this._load(groupPinId);
    if (!snapshot) {
      return { status: 'unavailable' };
    }
    
    // Consideramos "stale" si el fetchedAt fue hace más de 1 hora
    // (O la política que defina el producto. El invariante es que NO es unavailable).
    const fetchedTime = new Date(snapshot.fetchedAt).getTime();
    const isStale = Date.now() - fetchedTime > 60 * 60 * 1000;

    return { 
      status: isStale ? 'stale' : 'available', 
      snapshot 
    };
  }

  /**
   * Obtiene datos frescos del backend y los persiste.
   * Si falla (NETWORK_FAILURE), mantiene el LAST_KNOWN_STATE (stale).
   */
  async refresh(groupPinId: string): Promise<LeaderboardState> {
    try {
      const response = await fetchWithFallback(`/learning/groups/${groupPinId}/leaderboard`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await parseJsonSafely(response);
      const snapshot: LeaderboardSnapshot = {
        groupPinId,
        entries: data?.leaderboard || data?.entries || data || [],
        fetchedAt: new Date().toISOString()
      };

      this._persist(snapshot);
      return { status: 'available', snapshot };

    } catch (error) {
      console.warn(`[GroupLeaderboardCache] Error refreshing ${groupPinId}:`, error);
      
      // Invariante: RETAIN_LAST_KNOWN_STATE
      const snapshot = this._load(groupPinId);
      if (snapshot) {
        return { status: 'stale', snapshot };
      }
      return { status: 'unavailable' };
    }
  }

  private _persist(snapshot: LeaderboardSnapshot): void {
    try {
      const key = `${CACHE_KEY_PREFIX}${snapshot.groupPinId}`;
      mmkv.set(key, JSON.stringify(snapshot));
    } catch (e) {
      console.error('[GroupLeaderboardCache] Persist error', e);
    }
  }

  private _load(groupPinId: string): LeaderboardSnapshot | null {
    try {
      const key = `${CACHE_KEY_PREFIX}${groupPinId}`;
      const data = mmkv.getString(key);
      if (data) {
        return JSON.parse(data) as LeaderboardSnapshot;
      }
    } catch (e) {
      console.error('[GroupLeaderboardCache] Load error', e);
    }
    return null;
  }
}

export const groupLeaderboardCache = new GroupLeaderboardCache();
