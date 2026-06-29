export type ConflictStrategy =
  | 'LAST_WRITE_WINS'
  | 'SERVER_WINS'
  | 'CLIENT_WINS'
  | 'MERGE';

export interface ConflictInput {
  local: { id: string; version_number: number; updated_at: string; last_modified_by: string; data: any };
  remote: { id: string; version_number: number; updated_at: string; last_modified_by: string; data: any };
}

export interface ConflictResolution {
  winner: 'local' | 'remote' | 'merged';
  data: any;
  version_number: number;
}

const ENTITY_STRATEGIES: Record<string, ConflictStrategy> = {
  flashcard_decks: 'MERGE',
  flashcards: 'MERGE',
  subjects: 'LAST_WRITE_WINS',
  courses: 'LAST_WRITE_WINS',
  assessments: 'LAST_WRITE_WINS',
  schedules: 'CLIENT_WINS',
  analytics: 'SERVER_WINS',
  settings: 'CLIENT_WINS',
  photos: 'LAST_WRITE_WINS',
  audio_recordings: 'LAST_WRITE_WINS',
  youtube_videos: 'LAST_WRITE_WINS',
  scanned_documents: 'LAST_WRITE_WINS',
};

class ConflictResolver {
  private _overrides: Map<string, ConflictStrategy> = new Map();

  getStrategy(entityType: string): ConflictStrategy {
    return this._overrides.get(entityType) || ENTITY_STRATEGIES[entityType] || 'LAST_WRITE_WINS';
  }

  setStrategy(entityType: string, strategy: ConflictStrategy): void {
    this._overrides.set(entityType, strategy);
  }

  resolve(entityType: string, input: ConflictInput): ConflictResolution {
    const strategy = this.getStrategy(entityType);
    const localVer = input.local.version_number || 0;
    const remoteVer = input.remote.version_number || 0;

    switch (strategy) {
      case 'SERVER_WINS':
        return {
          winner: 'remote',
          data: input.remote.data,
          version_number: Math.max(localVer, remoteVer) + 1,
        };

      case 'CLIENT_WINS':
        return {
          winner: 'local',
          data: input.local.data,
          version_number: Math.max(localVer, remoteVer) + 1,
        };

      case 'MERGE':
        return this._merge(input, entityType);

      case 'LAST_WRITE_WINS':
      default: {
        const localTime = new Date(input.local.updated_at).getTime();
        const remoteTime = new Date(input.remote.updated_at).getTime();
        if (remoteTime > localTime) {
          return { winner: 'remote', data: input.remote.data, version_number: remoteVer + 1 };
        }
        return { winner: 'local', data: input.local.data, version_number: localVer + 1 };
      }
    }
  }

  private _merge(input: ConflictInput, entityType: string): ConflictResolution {
    const merged = { ...input.remote.data };
    let changed = false;

    for (const key of Object.keys(input.local.data)) {
      if (key === 'id' || key === 'version_number' || key === 'updated_at' || key === 'last_modified_by') continue;
      const localVal = input.local.data[key];
      const remoteVal = input.remote.data[key];

      if (localVal !== undefined && localVal !== null && localVal !== '' && (remoteVal === undefined || remoteVal === null || remoteVal === '')) {
        merged[key] = localVal;
        changed = true;
      }
    }

    return {
      winner: changed ? 'merged' : 'remote',
      data: merged,
      version_number: Math.max(input.local.version_number, input.remote.version_number) + 1,
    };
  }

  registerStrategy(entityType: string, strategy: ConflictStrategy): void {
    this.setStrategy(entityType, strategy);
  }

  getRegisteredStrategies(): Record<string, ConflictStrategy> {
    return { ...ENTITY_STRATEGIES, ...Object.fromEntries(this._overrides) };
  }
}

export const conflictResolver = new ConflictResolver();
