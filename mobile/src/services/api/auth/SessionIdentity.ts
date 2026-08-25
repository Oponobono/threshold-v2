import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

export interface SessionBoundContext {
  readonly userId: string;
  readonly sessionGeneration: string;
}

class SessionIdentity {
  private _sessionGeneration: string | null = null;
  private _userId: string | null = null;

  /**
   * Initializes a new session, replacing the current one.
   * This generates a unique identifier for the current login span.
   */
  startSession(userId: string): string {
    this._sessionGeneration = uuidv4();
    this._userId = userId;
    console.log(`[SessionIdentity] Started new session generation for user ${userId} -> ${this._sessionGeneration}`);
    return this._sessionGeneration;
  }

  /**
   * Clears the current session. All in-flight operations that were bound
   * to the previous generation should now abort.
   */
  clearSession(): void {
    console.log(`[SessionIdentity] Cleared session generation (was ${this._sessionGeneration})`);
    this._sessionGeneration = null;
    this._userId = null;
  }

  /**
   * Returns the current session generation token.
   */
  get currentGeneration(): string | null {
    return this._sessionGeneration;
  }

  /**
   * Returns the current user ID bound to the session.
   */
  get currentUserId(): string | null {
    return this._userId;
  }

  /**
   * Returns an immutable session context for repositories.
   * Throws if there is no active session.
   */
  getBoundContext(): SessionBoundContext {
    if (!this._userId || !this._sessionGeneration) {
      throw new Error('NO_ACTIVE_SESSION: Cannot create bound context');
    }
    return Object.freeze({
      userId: this._userId,
      sessionGeneration: this._sessionGeneration
    });
  }

  /**
   * Validates if a given generation token is still the active session.
   * Used BEFORE applying side-effects from async operations.
   */
  isValidGeneration(generation: string | null): boolean {
    if (!generation || !this._sessionGeneration) return false;
    return generation === this._sessionGeneration;
  }
}

export const sessionIdentity = new SessionIdentity();
