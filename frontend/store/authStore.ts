import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  walletBalance: number;
  kycStatus: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setToken: (token: string) => void;
  logout: () => Promise<void>;
  loadAuth: () => Promise<void>;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setToken: async (token) => {
    await AsyncStorage.setItem('token', token);
    set({ token });
  },
  clearAuth: () => {
    set({ user: null, token: null, isLoading: false });
  },
  logout: async () => {
    try {
      // Clear token from storage
      await AsyncStorage.removeItem('token');
      // Clear user data from storage if any
      await AsyncStorage.removeItem('user');
      // Clear state
      set({ user: null, token: null, isLoading: false });
    } catch (error) {
      console.error('Error during logout:', error);
      // Still clear state even if storage fails
      set({ user: null, token: null, isLoading: false });
    }
  },
  loadAuth: async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      set({ token, isLoading: false });
    } catch (error) {
      console.error('Error loading auth:', error);
      set({ token: null, isLoading: false });
    }
  },
}));
