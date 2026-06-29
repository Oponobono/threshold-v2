import { create } from 'zustand';
import { NetworkStatus } from '../services/network/NetworkManager';

interface ConnectivityStoreState {
  isOnline: boolean;
  status: NetworkStatus;
  isSlow: boolean;
  isExpensive: boolean;
  type: string | null;
  setOnline: (isOnline: boolean) => void;
  setNetworkState: (state: { isOnline: boolean; status: NetworkStatus; isSlow: boolean; isExpensive: boolean; type: string | null }) => void;
}

export const useConnectivityStore = create<ConnectivityStoreState>((set) => ({
  isOnline: false,
  status: 'OFFLINE' as NetworkStatus,
  isSlow: false,
  isExpensive: false,
  type: null,
  setOnline: (isOnline: boolean) => set({ isOnline }),
  setNetworkState: (state) => set(state),
}));
