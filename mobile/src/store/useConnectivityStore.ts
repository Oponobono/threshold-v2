import { create } from 'zustand';

interface ConnectivityStoreState {
  isOnline: boolean;
  setOnline: (isOnline: boolean) => void;
}

export const useConnectivityStore = create<ConnectivityStoreState>((set) => ({
  isOnline: true,
  setOnline: (isOnline: boolean) => set({ isOnline }),
}));
