import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export type NetworkStatus = 'ONLINE' | 'OFFLINE' | 'SLOW' | 'EXPENSIVE';

export interface NetworkState {
  status: NetworkStatus;
  isOnline: boolean;
  isSlow: boolean;
  isExpensive: boolean;
  type: string | null;
}

type NetworkListener = (state: NetworkState) => void;

const SLOW_THRESHOLD_KBPS = 500;

class NetworkManager {
  private _state: NetworkState = {
    status: 'OFFLINE',
    isOnline: false,
    isSlow: false,
    isExpensive: false,
    type: null,
  };

  private _listeners: Set<NetworkListener> = new Set();
  private _unsubscribe: (() => void) | null = null;

  get state(): NetworkState {
    return { ...this._state };
  }

  get isOnline(): boolean {
    return this._state.isOnline;
  }

  subscribe(listener: NetworkListener): () => void {
    this._listeners.add(listener);
    listener({ ...this._state });
    return () => this._listeners.delete(listener);
  }

  start(): void {
    if (this._unsubscribe) return;
    this._unsubscribe = NetInfo.addEventListener(this._handleNetworkChange);
  }

  stop(): void {
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
  }

  private _handleNetworkChange = (netState: NetInfoState): void => {
    const isOnline = !!netState.isConnected && !!netState.isInternetReachable;
    const details = netState as any;
    const isSlow = details.downlink !== null && details.downlink !== undefined && details.downlink < SLOW_THRESHOLD_KBPS;
    const isExpensive = netState.type === 'cellular';

    let status: NetworkStatus = 'ONLINE';
    if (!isOnline) {
      status = 'OFFLINE';
    } else if (isSlow) {
      status = 'SLOW';
    } else if (isExpensive) {
      status = 'EXPENSIVE';
    }

    this._state = {
      status,
      isOnline,
      isSlow,
      isExpensive,
      type: netState.type,
    };

    this._notify();
  };

  private _notify(): void {
    const snapshot = { ...this._state };
    this._listeners.forEach(fn => {
      try { fn(snapshot); } catch { /* ignore */ }
    });
  }
}

export const networkManager = new NetworkManager();
