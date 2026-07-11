export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export class FakeClock implements Clock {
  private _now: Date;
  private _advanceMs: number;

  constructor(anchorDate: Date, options?: { advanceMs?: number }) {
    this._now = new Date(anchorDate);
    this._advanceMs = options?.advanceMs ?? 0;
  }

  now(): Date {
    const result = new Date(this._now);
    if (this._advanceMs > 0) {
      this._now = new Date(this._now.getTime() + this._advanceMs);
    }
    return result;
  }

  setNow(date: Date): void {
    this._now = new Date(date);
  }

  advance(ms: number): void {
    this._now = new Date(this._now.getTime() + ms);
  }
}
