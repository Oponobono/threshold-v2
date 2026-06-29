import type { FaultRule, FaultType } from './types';

type FetchInterceptor = (path: string, init?: RequestInit) => Promise<Response> | null;

export class FaultInjector {
  private _enabled = false;
  private _rules: FaultRule[] = [];
  private _interceptor: FetchInterceptor | null = null;
  private _injected: number = 0;
  private _history: { path: string; faultType: FaultType; timestamp: number }[] = [];

  enable(rules: FaultRule[]): void {
    this._enabled = true;
    this._rules = rules;
    this._injected = 0;
    this._history = [];
  }

  disable(): void {
    this._enabled = false;
    this._rules = [];
    this._injected = 0;
  }

  get enabled(): boolean {
    return this._enabled;
  }

  get rules(): FaultRule[] {
    return [...this._rules];
  }

  get injected(): number {
    return this._injected;
  }

  get history(): { path: string; faultType: FaultType; timestamp: number }[] {
    return [...this._history];
  }

  setInterceptor(interceptor: FetchInterceptor): void {
    this._interceptor = interceptor;
  }

  intercept(path: string, init?: RequestInit): Promise<Response> | null {
    if (!this._enabled) return null;

    // Custom interceptor runs first
    if (this._interceptor) {
      const result = this._interceptor(path, init);
      if (result) return result;
    }

    // Match rules
    for (const rule of this._rules) {
      if (rule.endpointPattern && !path.includes(rule.endpointPattern)) continue;
      if (rule.probability !== undefined && Math.random() > rule.probability) continue;

      this._injected++;
      this._history.push({ path, faultType: rule.faultType, timestamp: Date.now() });

      return this._createFaultResponse(rule);
    }

    return null;
  }

  private _createFaultResponse(rule: FaultRule): Promise<Response> {
    const delayMs = rule.delayMs ?? 0;

    switch (rule.faultType) {
      case 'HTTP_500':
        return new Promise(resolve => {
          setTimeout(() => {
            resolve(new Response(null, { status: 500, statusText: 'Internal Server Error' }));
          }, delayMs);
        });

      case 'HTTP_429':
        return new Promise(resolve => {
          setTimeout(() => {
            resolve(new Response(null, { status: 429, statusText: 'Too Many Requests', headers: { 'Retry-After': '5' } }));
          }, delayMs);
        });

      case 'HTTP_TIMEOUT':
        return new Promise<Response>((_resolve, reject) => {
          setTimeout(() => reject(new Error('The operation timed out')), delayMs || 10000);
        });

      case 'HTTP_TOKEN_EXPIRED':
        return new Promise(resolve => {
          setTimeout(() => {
            resolve(new Response(JSON.stringify({ error: 'Token expired' }), { status: 401, statusText: 'Unauthorized' }));
          }, delayMs);
        });

      case 'HTTP_404':
        return new Promise(resolve => {
          setTimeout(() => {
            resolve(new Response(null, { status: 404, statusText: 'Not Found' }));
          }, delayMs);
        });

      case 'SQLITE_BUSY':
        return Promise.reject(new Error('SQLITE_BUSY: database is locked'));

      case 'PACKET_LOSS':
        return new Promise((_resolve, reject) => {
          setTimeout(() => {
            reject(new Error('Network request failed: packet loss'));
          }, delayMs);
        });

      default:
        return Promise.resolve(new Response(null, { status: 200 }));
    }
  }
}

export const faultInjector = new FaultInjector();
