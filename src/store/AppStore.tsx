import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { Address, AppNotification, BookingDraft, Category, Offer, RequestMedia, ServiceItem, ServiceRequest, Technician, User } from '../types';
import { categories as fallbackCategories, serviceItems as fallbackItems, technicians as fallbackTechnicians, typesByCategory as fallbackTypes, seedAddresses } from '../data/catalog';
import { apiAssetUrl, apiRequest, getApiToken, jsonBody, setApiToken } from '../lib/api';

type AuthInput = { email: string; password: string; name?: string; phone?: string };
type Store = {
  user: User | null;
  authReady: boolean;
  loading: boolean;
  dataError: string | null;
  draft: BookingDraft;
  requests: ServiceRequest[];
  offers: Offer[];
  technicians: Technician[];
  notifications: AppNotification[];
  addresses: Address[];
  categories: Category[];
  serviceItems: ServiceItem[];
  typesByCategory: Record<string, string[]>;
  homeLocation: Address;
  setHomeLocation: (address: Address) => void;
  setDraft: (draft: Partial<BookingDraft>) => void;
  toggleServiceType: (categoryId: string, type: string) => void;
  resetDraft: () => void;
  refresh: () => Promise<void>;
  signIn: (input: AuthInput) => Promise<void>;
  signUp: (input: AuthInput) => Promise<void>;
  verifyEmailSignup: (email: string, code: string) => Promise<void>;
  resendEmailSignup: (email: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  resetPassword: (email: string, code: string, password: string) => Promise<void>;
  changePassword: (currentPassword: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  publish: () => Promise<ServiceRequest>;
  acceptOffer: (requestId: string, offerId: string) => Promise<void>;
  cancelRequest: (id: string) => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  updateUser: (user: User) => Promise<void>;
  addAddress: (address: Omit<Address, 'id'>) => Promise<void>;
};

type CatalogStore = Pick<Store, 'categories' | 'serviceItems' | 'typesByCategory'>;
type BookingDraftActions = Pick<Store, 'setDraft' | 'toggleServiceType'>;

const initialDraft: BookingDraft = { serviceTypes: [], serviceIds: [], description: '', media: [] };
const fallbackCategoryColors = new Map(fallbackCategories.map(category => [category.id, category.color]));
const Context = createContext<Store | null>(null);
const CatalogContext = createContext<CatalogStore | null>(null);
const BookingDraftActionsContext = createContext<BookingDraftActions | null>(null);
type Row = Record<string, any>;

function mapAddress(row: Row): Address {
  return { id: String(row.id), label: String(row.label ?? 'Adresse'), address: String(row.address ?? ''), details: row.details ?? undefined, latitude: row.latitude ?? undefined, longitude: row.longitude ?? undefined };
}

function mapTechnician(row: Row): Technician {
  return { id: String(row.id), name: String(row.name), specialty: String(row.specialty), rating: Number(row.rating ?? 0), reviews: Number(row.review_count ?? 0), jobs: Number(row.completed_jobs ?? 0), experience: Number(row.experience_years ?? 0), bio: String(row.biography ?? ''), avatar: String(row.avatar_url ?? '') };
}

function mapOffer(row: Row): Offer {
  return { id: String(row.id), requestId: String(row.request_id), technicianId: String(row.technician_id), price: Number(row.proposed_price_mad), message: String(row.message ?? ''), availability: String(row.availability ?? ''), status: row.status };
}

function mapNotification(row: Row): AppNotification {
  return { id: String(row.id), title: String(row.title), body: String(row.body), kind: row.kind, requestId: row.request_id ?? undefined, createdAt: String(row.created_at), read: Boolean(row.is_read) };
}

function mapRequest(row: Row, itemsById: Map<string, ServiceItem>, offersByRequestId: Map<string, Offer[]>, signedMedia: RequestMedia[] = []): ServiceRequest {
  const addressData = (row.address_snapshot ?? {}) as Row;
  const ids: string[] = Array.isArray(row.service_item_ids) ? row.service_item_ids : [];
  const selectedItems = ids.map(id => itemsById.get(id));
  const selectedItemNames = ids.map((id, index) => selectedItems[index]?.name ?? id);
  const typeNames: string[] = Array.isArray(row.service_types) ? row.service_types : [];
  const selectedItemTypes = new Set(selectedItems.flatMap(item => item ? [item.type] : []));
  const names = [...selectedItemNames, ...typeNames.filter(type => selectedItemNames.length === 0 || !selectedItemTypes.has(type))];
  if (row.custom_service) names.push(String(row.custom_service));
  const matchingOffers = offersByRequestId.get(String(row.id)) ?? [];
  return {
    id: String(row.id), ref: String(row.reference), categoryId: String(row.category_id), serviceNames: names.length ? names : ['Demande personnalisée'],
    description: String(row.description ?? ''), address: mapAddress({ id: row.address_id ?? `snapshot-${row.id}`, ...addressData }),
    createdAt: String(row.created_at), status: row.status, urgency: row.urgency, schedule: row.scheduled_at ?? undefined,
    allDay: Boolean(row.all_day), media: signedMedia, offerIds: matchingOffers.map(offer => offer.id), acceptedOfferId: row.accepted_offer_id ?? undefined,
  };
}

function userFromApi(user: Row | null): User | null {
  if (!user) return null;
  return { name: String(user.name ?? 'Client Palesso'), phone: String(user.phone ?? ''), email: user.email ?? undefined };
}

function mediaMime(media: RequestMedia) {
  const ext = media.name.split('.').pop()?.toLowerCase();
  if (media.type === 'image') {
    if (ext === 'png') return 'image/png';
    if (ext === 'webp') return 'image/webp';
    if (ext === 'heic') return 'image/heic';
    if (ext === 'heif') return 'image/heif';
    return 'image/jpeg';
  }
  if (media.type === 'video') return ext === 'mov' ? 'video/quicktime' : 'video/mp4';
  const audioMimes: Record<string, string> = {
    aac: 'audio/aac', aif: 'audio/aiff', aiff: 'audio/aiff', amr: 'audio/amr',
    caf: 'audio/x-caf', flac: 'audio/flac', m4a: 'audio/mp4', mp3: 'audio/mpeg',
    oga: 'audio/ogg', ogg: 'audio/ogg', opus: 'audio/opus', wav: 'audio/wav',
    weba: 'audio/webm', webm: 'audio/webm', mp4: 'audio/mp4',
  };
  return (ext && audioMimes[ext]) || 'audio/mp4';
}

export function AppStoreProvider({ children }: React.PropsWithChildren) {
  const [homeLocation, setHomeLocationState] = useState<Address>(seedAddresses[0]);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [draft, setDraftState] = useState(initialDraft);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [technicians, setTechnicians] = useState(fallbackTechnicians);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [categories, setCategories] = useState(fallbackCategories);
  const [serviceItems, setServiceItems] = useState(fallbackItems);
  const [typesByCategory, setTypesByCategory] = useState(fallbackTypes);
  const itemsRef = useRef(serviceItems);
  const techniciansRef = useRef(technicians);
  const setDraft = useCallback((patch: Partial<BookingDraft>) => {
    setDraftState(current => ({ ...current, ...patch }));
  }, []);
  const toggleServiceType = useCallback((categoryId: string, type: string) => {
    setDraftState(current => {
      const currentTypes = current.categoryId === categoryId ? current.serviceTypes : [];
      const serviceTypes = currentTypes.includes(type)
        ? currentTypes.filter(item => item !== type)
        : [...currentTypes, type];
      return { ...current, categoryId, serviceTypes, serviceIds: [] };
    });
  }, []);
  const resetDraft = useCallback(() => setDraftState(initialDraft), []);
  const setHomeLocation = useCallback((address: Address) => setHomeLocationState(address), []);
  useEffect(() => { itemsRef.current = serviceItems; }, [serviceItems]);
  useEffect(() => { techniciansRef.current = technicians; }, [technicians]);

  const clearCustomerData = useCallback(() => {
    setRequests([]); setOffers([]); setNotifications([]); setAddresses([]); setUser(null);
  }, []);

  const refreshCatalog = useCallback(async () => {
    const result = await apiRequest<{ categories: Row[]; serviceTypes: Row[]; serviceItems: Row[]; technicians: Row[] }>('/catalog', { auth: false });
    if (result.categories?.length) setCategories(result.categories.map((row: Row) => ({ id: row.id, name: row.name, description: row.description, icon: row.icon, image: row.image_url, color: fallbackCategoryColors.get(row.id) ?? '#EAF5FC' })));
    if (result.serviceItems?.length) setServiceItems(result.serviceItems.map((row: Row) => ({ id: row.id, categoryId: row.category_id, type: row.service_type, name: row.name, description: row.description, min: row.min_price_mad ?? undefined, max: row.max_price_mad ?? undefined, image: row.image_url })));
    if (result.serviceTypes?.length) {
      const next: Record<string, string[]> = {};
      for (const row of result.serviceTypes) (next[row.category_id] ??= []).push(row.name);
      setTypesByCategory(next);
    }
    if (result.technicians) setTechnicians(result.technicians.map(mapTechnician));
  }, []);

  const refreshCustomerData = useCallback(async () => {
    if (!await getApiToken()) { clearCustomerData(); return; }
    setLoading(true);
    try {
      const result = await apiRequest<{ user: Row; addresses: Row[]; requests: Row[]; offers: Row[]; notifications: Row[]; appointments: Row[] }>('/me/bootstrap?includeTechnicians=false');
      const mappedOffers = (result.offers ?? []).map(mapOffer);
      const itemsById = new Map(itemsRef.current.map(item => [item.id, item]));
      const offersByRequestId = new Map<string, Offer[]>();
      for (const offer of mappedOffers) {
        const requestOffers = offersByRequestId.get(offer.requestId);
        if (requestOffers) requestOffers.push(offer);
        else offersByRequestId.set(offer.requestId, [offer]);
      }
      const mappedTechnicians = (result.offers ?? []).flatMap((row: Row) => {
        const nested = Array.isArray(row.technicians) ? row.technicians[0] : row.technicians;
        return nested ? [mapTechnician(nested)] : [];
      });
      const allTechnicians = new Map<string, Technician>();
      for (const technician of techniciansRef.current) allTechnicians.set(technician.id, technician);
      for (const technician of mappedTechnicians) allTechnicians.set(technician.id, technician);
      setTechnicians([...allTechnicians.values()]);
      const appointmentDates = new Map<string, string | undefined>((result.appointments ?? []).map((row: Row) => [String(row.request_id), row.scheduled_at ?? undefined]));
      const mappedRequests = (result.requests ?? []).map((row: Row) => {
        const mediaRows: Row[] = Array.isArray(row.request_media) ? row.request_media : [];
        const signedMedia = mediaRows.map(media => ({ id: String(media.id), uri: apiAssetUrl(String(media.url ?? '')), type: media.media_type, name: media.file_name, durationMs: media.duration_ms ?? undefined, fileSize: Number(media.byte_size) } as RequestMedia)).filter(media => Boolean(media.uri));
        const mapped = mapRequest(row, itemsById, offersByRequestId, signedMedia);
        mapped.schedule = appointmentDates.get(mapped.id) ?? mapped.schedule;
        return mapped;
      });
      setUser(userFromApi(result.user));
      setAddresses((result.addresses ?? []).map(mapAddress));
      setOffers(mappedOffers);
      setRequests(mappedRequests);
      setNotifications((result.notifications ?? []).map(mapNotification));
      setDataError(null);
    } catch (error) {
      setDataError(error instanceof Error ? error.message : 'Impossible de synchroniser vos données.');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [clearCustomerData]);

  const refresh = useCallback(async () => {
    try {
      await refreshCatalog();
      if (await getApiToken()) await refreshCustomerData();
      setDataError(null);
    } catch (error) {
      setDataError(error instanceof Error ? error.message : 'Impossible de synchroniser les données.');
    }
  }, [refreshCatalog, refreshCustomerData]);

  useEffect(() => {
    let active = true;
    AsyncStorage.getAllKeys().then(keys => {
      const legacyAuthKeys = keys.filter(key => /^sb-[a-z0-9-]+-auth-token$/i.test(key));
      if (legacyAuthKeys.length) return AsyncStorage.multiRemove(legacyAuthKeys);
      return undefined;
    }).catch(() => undefined);
    AsyncStorage.getItem('palesso-local').then(saved => {
      if (!active || !saved) return;
      const value = JSON.parse(saved) as { draft?: BookingDraft; homeLocation?: Address };
      if (value.draft) setDraftState(value.draft);
      if (value.homeLocation) setHomeLocationState(value.homeLocation);
    }).catch(() => undefined);
    void (async () => {
      try {
        await refreshCatalog();
        if (await getApiToken()) await refreshCustomerData();
      } catch (error) {
        if (active) setDataError(error instanceof Error ? error.message : 'Connexion à la base indisponible.');
      } finally { if (active) setAuthReady(true); }
    })();
    return () => { active = false; };
  }, [clearCustomerData, refreshCatalog, refreshCustomerData]);

  useEffect(() => {
    AsyncStorage.setItem('palesso-local', JSON.stringify({ draft, homeLocation })).catch(() => undefined);
  }, [draft, homeLocation]);

  const value = useMemo<Store>(() => ({
    user, authReady, loading, dataError, draft, requests, offers, technicians, notifications, addresses, categories, serviceItems, typesByCategory, homeLocation,
    setHomeLocation,
    setDraft,
    toggleServiceType,
    resetDraft,
    refresh,
    signIn: async ({ email, password }) => {
      const result = await apiRequest<{ token: string; user: Row }>('/auth/login', { method: 'POST', auth: false, body: jsonBody({ email: email.trim().toLowerCase(), password }) });
      await setApiToken(result.token);
      setUser(userFromApi(result.user));
      await refreshCustomerData();
    },
    signUp: async ({ phone, password, name, email }) => {
      await apiRequest('/auth/register', { method: 'POST', auth: false, body: jsonBody({ name: name?.trim(), phone: phone?.trim() || null, email: email.trim().toLowerCase(), password }) });
    },
    verifyEmailSignup: async (email, code) => {
      const result = await apiRequest<{ token: string; user: Row }>('/auth/verify-email', { method: 'POST', auth: false, body: jsonBody({ email: email.trim().toLowerCase(), code: code.trim() }) });
      await setApiToken(result.token);
      setUser(userFromApi(result.user));
      await refreshCustomerData();
    },
    resendEmailSignup: async email => {
      await apiRequest('/auth/resend-signup', { method: 'POST', auth: false, body: jsonBody({ email: email.trim().toLowerCase() }) });
    },
    requestPasswordReset: async email => {
      await apiRequest('/auth/password/forgot', { method: 'POST', auth: false, body: jsonBody({ email: email.trim().toLowerCase() }) });
    },
    resetPassword: async (email, code, password) => {
      await apiRequest('/auth/password/reset', { method: 'POST', auth: false, body: jsonBody({ email: email.trim().toLowerCase(), code, password, password_confirmation: password }) });
    },
    changePassword: async (currentPassword, password) => {
      await apiRequest('/auth/password/change', { method: 'POST', body: jsonBody({ current_password: currentPassword, password, password_confirmation: password }) });
    },
    logout: async () => {
      try { await apiRequest('/auth/logout', { method: 'POST' }); } finally { await setApiToken(null); clearCustomerData(); }
    },
    publish: async () => {
      if (!await getApiToken()) throw new Error('Connectez-vous avant de publier votre demande.');
      const address = draft.address;
      if (!address?.address.trim()) throw new Error('Ajoutez une adresse avant de publier la demande.');
      const payload = {
        categoryId: draft.categoryId ?? 'plomberie', serviceTypes: draft.serviceTypes, serviceItemIds: draft.serviceIds,
        customService: draft.customService, description: draft.description, urgency: draft.urgency ?? 'urgent',
        scheduledAt: draft.schedule, allDay: draft.allDay ?? false,
        address: { label: address.label, address: address.address, details: address.details, latitude: address.latitude, longitude: address.longitude },
      };
      const form = new FormData();
      form.append('payload', JSON.stringify(payload));
      const mediaMeta: { type: string; name: string; durationMs?: number }[] = [];
      for (const item of draft.media) {
        if (item.fileSize && item.fileSize > 52_428_800) throw new Error(`${item.name} dépasse la limite de 50 Mo.`);
        const type = mediaMime(item);
        mediaMeta.push({ type: item.type, name: item.name, ...(item.durationMs ? { durationMs: item.durationMs } : {}) });
        if (Platform.OS === 'web') {
          const response = await fetch(item.uri);
          if (!response.ok) throw new Error(`Impossible de lire le fichier ${item.name}.`);
          const blob = await response.blob();
          form.append('media[]', new File([blob], item.name, { type }));
        } else {
          form.append('media[]', { uri: item.uri, name: item.name, type } as unknown as Blob);
        }
      }
      form.append('mediaMeta', JSON.stringify(mediaMeta));
      const result = await apiRequest<{ request: Row }>('/requests', { method: 'POST', body: form });
      if (!result.request) throw new Error('La demande n’a pas été retournée par le backend.');
      const media = Array.isArray(result.request.request_media) ? result.request.request_media.map((item: Row) => ({ id: String(item.id), uri: apiAssetUrl(String(item.url ?? '')), type: item.media_type, name: item.file_name, durationMs: item.duration_ms ?? undefined, fileSize: Number(item.byte_size) } as RequestMedia)) : [];
      const itemsById = new Map(serviceItems.map(item => [item.id, item]));
      const mapped = mapRequest(result.request, itemsById, new Map(), media);
      setRequests(current => [mapped, ...current.filter(request => request.id !== mapped.id)]);
      setDraftState(initialDraft);
      await refreshCustomerData();
      return mapped;
    },
    acceptOffer: async (requestId, offerId) => {
      await apiRequest(`/requests/${requestId}/offers/${offerId}/accept`, { method: 'POST' });
      await refreshCustomerData();
    },
    cancelRequest: async id => {
      await apiRequest(`/requests/${id}/cancel`, { method: 'POST' });
      await refreshCustomerData();
    },
    markRead: async id => {
      await apiRequest(`/notifications/${id}/read`, { method: 'POST' });
      setNotifications(current => current.map(item => item.id === id ? { ...item, read: true } : item));
    },
    markAllRead: async () => {
      await apiRequest('/notifications/read', { method: 'POST' });
      setNotifications(current => current.map(item => ({ ...item, read: true })));
    },
    updateUser: async next => {
      const result = await apiRequest<{ user: Row }>('/me/profile', { method: 'PATCH', body: jsonBody({ name: next.name.trim(), phone: next.phone, email: next.email }) });
      setUser(userFromApi(result.user));
    },
    addAddress: async address => {
      const result = await apiRequest<{ address: Row }>('/addresses', { method: 'POST', body: jsonBody({ label: address.label, address: address.address, details: address.details ?? null, latitude: address.latitude ?? null, longitude: address.longitude ?? null }) });
      setAddresses(current => [mapAddress(result.address), ...current]);
    },
  }), [user, authReady, loading, dataError, draft, requests, offers, technicians, notifications, addresses, categories, serviceItems, typesByCategory, homeLocation, setHomeLocation, setDraft, toggleServiceType, resetDraft, refresh, refreshCustomerData, clearCustomerData]);

  const catalogValue = useMemo<CatalogStore>(() => ({ categories, serviceItems, typesByCategory }), [categories, serviceItems, typesByCategory]);
  const draftActionsValue = useMemo<BookingDraftActions>(() => ({ setDraft, toggleServiceType }), [setDraft, toggleServiceType]);

  return <CatalogContext.Provider value={catalogValue}>
    <BookingDraftActionsContext.Provider value={draftActionsValue}>
      <Context.Provider value={value}>{children}</Context.Provider>
    </BookingDraftActionsContext.Provider>
  </CatalogContext.Provider>;
}

export function useAppStore() {
  const value = useContext(Context);
  if (!value) throw new Error('AppStoreProvider missing');
  return value;
}

export function useCatalogStore() {
  const value = useContext(CatalogContext);
  if (!value) throw new Error('AppStoreProvider missing');
  return value;
}

export function useBookingDraftActions() {
  const value = useContext(BookingDraftActionsContext);
  if (!value) throw new Error('AppStoreProvider missing');
  return value;
}
