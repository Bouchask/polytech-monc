import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'palesso-laravel-api-token-v1';
const platformDefault = Platform.OS === 'android'
  ? 'http://10.0.2.2:8000/api'
  : 'http://127.0.0.1:8000/api';

const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const developmentApiFallback = typeof __DEV__ !== 'undefined' && __DEV__ ? platformDefault : '';

function resolveApiUrl(configured: string | undefined) {
  const candidate = (configured || developmentApiFallback).replace(/\/$/, '');
  if (!candidate) return '';

  // Android emulators cannot reach the host computer through 127.0.0.1.
  // Keep an explicit remote/LAN host unchanged; only rewrite loopback URLs.
  if (Platform.OS === 'android') {
    try {
      const url = new URL(candidate);
      if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
        url.hostname = '10.0.2.2';
        return url.toString().replace(/\/$/, '');
      }
    } catch {
      // Keep the candidate as-is so apiRequest can return a useful config error.
    }
  }
  return candidate;
}

// Expo inlines EXPO_PUBLIC_API_URL at build time. Never send a release build
// silently to localhost when the deployment URL has not been supplied.
export const API_BASE_URL = resolveApiUrl(configuredApiUrl);

function isNgrokApi(url: string) {
  try {
    return /(^|\.)ngrok(-free)?\.(app|dev|io)$/i.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

let token: string | null = null;

export async function getApiToken() {
  if (token) return token;
  token = Platform.OS === 'web'
    ? await AsyncStorage.getItem(TOKEN_KEY)
    : await SecureStore.getItemAsync(TOKEN_KEY);
  return token;
}

export async function setApiToken(value: string | null) {
  token = value;
  if (Platform.OS === 'web') {
    if (value) await AsyncStorage.setItem(TOKEN_KEY, value);
    else await AsyncStorage.removeItem(TOKEN_KEY);
  } else if (value) {
    await SecureStore.setItemAsync(TOKEN_KEY, value);
  } else {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
}

export function apiAssetUrl(path: string) {
  return /^https?:\/\//i.test(path) ? path : `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export class ApiError extends Error {
  status: number;
  errors?: Record<string, string[]>;
  code?: string;

  constructor(message: string, status: number, errors?: Record<string, string[]>, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
    this.code = code;
  }
}

type ApiOptions = Omit<RequestInit, 'headers'> & { headers?: Record<string, string>; auth?: boolean };

export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { auth = true, headers: customHeaders = {}, ...init } = options;
  if (!API_BASE_URL) {
    throw new ApiError('Adresse de l’API manquante. Configurez EXPO_PUBLIC_API_URL avant de créer cette version de Palesso.', 0);
  }
  const headers: Record<string, string> = { Accept: 'application/json', ...customHeaders };
  // Free ngrok endpoints show an interstitial in browsers unless API requests
  // include this documented bypass header. Laravel CORS already allows headers.
  if (isNgrokApi(API_BASE_URL)) headers['ngrok-skip-browser-warning'] = 'true';
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  if (init.body && !isFormData && !headers['Content-Type']) headers['Content-Type'] = 'application/json';

  if (auth) {
    const currentToken = await getApiToken();
    if (currentToken) headers.Authorization = `Bearer ${currentToken}`;
  }

  let response: Response;
  try {
    response = await fetch(apiAssetUrl(path), { ...init, headers });
  } catch (error) {
    const detail = error instanceof Error ? ` (${error.message})` : '';
    throw new ApiError(`Impossible de joindre le backend à ${API_BASE_URL}. Vérifiez que Laravel fonctionne, que l’adresse est accessible depuis cet appareil et que le port 8000 est ouvert${detail}.`, 0);
  }

  const text = await response.text();
  let body: any = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = {}; }

  if (response.status === 401 && auth) await setApiToken(null);
  if (!response.ok) {
    const fieldMessage = body?.errors && Object.values(body.errors).flat().find((value: unknown) => typeof value === 'string');
    const message = typeof fieldMessage === 'string' ? fieldMessage : (body?.message || 'Une erreur est survenue. Réessayez.');
    throw new ApiError(message, response.status, body?.errors, body?.code);
  }
  return body as T;
}

export function jsonBody(value: unknown) {
  return JSON.stringify(value);
}
