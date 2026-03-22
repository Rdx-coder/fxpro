import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const DEFAULT_BACKEND_URL = 'http://localhost:8000';

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, '');
}

function resolveBackendUrl() {
  const configured = normalizeBaseUrl(
    process.env.EXPO_PUBLIC_BACKEND_URL || DEFAULT_BACKEND_URL
  );

  // Optional override for Android physical devices/emulators.
  const androidOverride = process.env.EXPO_PUBLIC_ANDROID_BACKEND_URL;
  if (Platform.OS === 'android' && androidOverride) {
    return normalizeBaseUrl(androidOverride);
  }

  // Android emulator cannot access host localhost directly.
  if (Platform.OS === 'android') {
    try {
      const parsed = new URL(configured);
      if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
        // Prefer Expo host IP for physical Android devices on the same LAN.
        const hostUri =
          (Constants.expoConfig as any)?.hostUri ||
          (Constants as any)?.manifest2?.extra?.expoGo?.debuggerHost;

        if (hostUri && typeof hostUri === 'string') {
          const host = hostUri.split(':')[0];
          if (host) {
            parsed.hostname = host;
            return normalizeBaseUrl(parsed.toString());
          }
        }

        // Fallback for Android emulator.
        parsed.hostname = '10.0.2.2';
        return normalizeBaseUrl(parsed.toString());
      }
    } catch {
      // Fall back to configured URL.
    }
  }

  return configured;
}

const API_URL = `${resolveBackendUrl()}/api`;

type ApiResponse<T = any> = {
  data: T;
  status: number;
  headers: Record<string, string>;
};

// Custom fetch-based API client for React Native compatibility
class APIClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private async getHeaders() {
    const token = await AsyncStorage.getItem('token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return headers;
  }

  async request<T = any>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    data?: any
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${path}`;
    const headers = await this.getHeaders();

    const options: RequestInit = {
      method,
      headers,
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);

      const headersMap: Record<string, string> = {};
      if (response.headers?.forEach) {
        response.headers.forEach((value, key) => {
          headersMap[key] = value;
        });
      }

      const contentType = response.headers.get('content-type') || '';
      const payload = contentType.includes('application/json')
        ? await response.json()
        : await response.text();

      if (!response.ok) {
        const apiError: any = new Error(
          `API Error: ${response.status} ${response.statusText}`
        );
        apiError.response = {
          data: payload,
          status: response.status,
          headers: headersMap,
        };
        throw apiError;
      }

      return {
        data: payload as T,
        status: response.status,
        headers: headersMap,
      };
    } catch (error) {
      console.error(`API Request Error [${method} ${path}]:`, error);

      const networkError: any = error;
      if (!networkError?.response) {
        networkError.message =
          networkError?.message ||
          `Network request failed. Check backend reachability at ${this.baseURL}`;
      }

      throw error;
    }
  }

  get(path: string) {
    return this.request('GET', path);
  }

  post(path: string, data?: any) {
    return this.request('POST', path, data);
  }

  put(path: string, data?: any) {
    return this.request('PUT', path, data);
  }

  delete(path: string) {
    return this.request('DELETE', path);
  }
}

const api = new APIClient(API_URL);

export default api;

// Auth APIs
export const authAPI = {
  register: (data: { name: string; email: string; password: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  forgotPassword: (data: { email: string }) =>
    api.post('/auth/forgot-password', data),
};

// Profile APIs
export const profileAPI = {
  get: () => api.get('/profile'),
  update: (data: { name?: string; phone?: string }) =>
    api.put('/profile', data),
};

// KYC APIs
export const kycAPI = {
  upload: (data: { type: string; fileData: string }) =>
    api.post('/kyc/upload', data),
  getDocuments: () => api.get('/kyc/documents'),
  getStatus: () => api.get('/kyc/status'),
};

// Bank APIs
export const bankAPI = {
  list: () => api.get('/bank-accounts'),
  create: (data: any) => api.post('/bank-accounts', data),
  delete: (id: string) => api.delete(`/bank-accounts/${id}`),
};

// Wallet APIs
export const walletAPI = {
  getBalance: () => api.get('/wallet/balance'),
  getTransactions: () => api.get('/wallet/transactions'),
};

// Deposit APIs
export const depositAPI = {
  create: (data: { amount: number; method: string; screenshot: string }) =>
    api.post('/deposits', data),
  list: () => api.get('/deposits'),
};

// Withdrawal APIs
export const withdrawalAPI = {
  create: (data: { amount: number; bankAccountId: string }) =>
    api.post('/withdrawals', data),
  list: () => api.get('/withdrawals'),
};

// Market APIs
export const marketAPI = {
  getQuotes: () => api.get('/market/quotes'),
  getSymbols: () => api.get('/market/symbols'),
  getPrice: (symbol: string) => api.get(`/market/price/${symbol}`),
};

// Trade APIs
export const tradeAPI = {
  execute: (data: { symbol: string; type: string; quantity: number; leverage: number }) =>
    api.post('/trades/execute', data),
  getOpen: () => api.get('/trades/open'),
  close: (id: string) => api.post(`/trades/${id}/close`),
  getHistory: () => api.get('/trades/history'),
};

// Calendar APIs
export const calendarAPI = {
  getEvents: () => api.get('/calendar/events'),
};

// Admin APIs
export const adminAPI = {
  getDashboard: () => api.get('/admin/dashboard'),
  getUsers: () => api.get('/admin/users'),
  manageUser: (data: { userId: string; action: string }) =>
    api.post('/admin/users/manage', data),
  updateWallet: (data: { userId: string; action: string; amount: number; note?: string }) =>
    api.post('/admin/users/wallet', data),
  getPendingKYC: () => api.get('/admin/kyc/pending'),
  reviewKYC: (data: { documentId: string; action: string; note?: string }) =>
    api.post('/admin/kyc/review', data),
  getPendingDeposits: () => api.get('/admin/deposits/pending'),
  reviewDeposit: (data: { depositId: string; action: string; note?: string }) =>
    api.post('/admin/deposits/review', data),
  getPendingWithdrawals: () => api.get('/admin/withdrawals/pending'),
  reviewWithdrawal: (data: { withdrawalId: string; action: string; note?: string }) =>
    api.post('/admin/withdrawals/review', data),
  getTrades: () => api.get('/admin/trades'),
  createTrade: (data: { userId: string; symbol: string; type: string; entryPrice: number; quantity: number; leverage: number }) =>
    api.post('/admin/trades/create', data),
  updateTrade: (tradeId: string, data: any) =>
    api.put(`/admin/trades/${tradeId}`, data),
  closeTrade: (tradeId: string, data: { exitPrice?: number }) =>
    api.post(`/admin/trades/${tradeId}/close`, data),
  getPaymentSettings: () => api.get('/admin/payment-settings'),
  updatePaymentSettings: (data: { upiId?: string; qrCodeBase64?: string }) =>
    api.put('/admin/payment-settings', data),
};

// Public APIs (no auth required)
export const publicAPI = {
  getPaymentSettings: () => api.get('/payment-settings'),
};
