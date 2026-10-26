import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Text, useWindowDimensions, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { C } from '../ui';
import type { HomeLocation } from '../../data/homeMockData';

type Props = { initialLocation?: HomeLocation | null; onChoose: (location: HomeLocation) => void };
const center = { latitude: 33.5899, longitude: -7.6039 };
const toRegion = (latitude: number, longitude: number): Region => ({ latitude, longitude, latitudeDelta: 0.025, longitudeDelta: 0.025 });
const androidMapKeyConfigured = Boolean(process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY);

export default function MapLocationPicker({ initialLocation, onChoose }: Props) {
  const { height: windowHeight } = useWindowDimensions();
  const mapHeight = Math.max(220, Math.min(310, Math.round(windowHeight * 0.39)));
  const map = useRef<MapView>(null);
  const reverseGeocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastExternalId = useRef(initialLocation?.id ?? null);
  const [region, setRegion] = useState(() => toRegion(initialLocation?.latitude ?? center.latitude, initialLocation?.longitude ?? center.longitude));
  const [selectedLabel, setSelectedLabel] = useState(initialLocation?.latitude && initialLocation.longitude ? initialLocation.address : '');
  const [currentPosition, setCurrentPosition] = useState<{ latitude: number; longitude: number } | null>(() => initialLocation?.id.startsWith('gps-') && initialLocation.latitude && initialLocation.longitude ? { latitude: initialLocation.latitude, longitude: initialLocation.longitude } : null);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    if (!initialLocation?.latitude || !initialLocation.longitude || initialLocation.id.startsWith('map-') || lastExternalId.current === initialLocation.id) return;
    lastExternalId.current = initialLocation.id;
    const next = toRegion(initialLocation.latitude, initialLocation.longitude);
    map.current?.animateToRegion(next, 350);
    if (initialLocation.id.startsWith('gps-')) {
      const position = { latitude: initialLocation.latitude, longitude: initialLocation.longitude };
      const timer = setTimeout(() => setCurrentPosition(position), 0);
      return () => clearTimeout(timer);
    }
  }, [initialLocation?.id, initialLocation?.latitude, initialLocation?.longitude]);

  const commitPosition = useCallback(async (next: Region) => {
    setRegion(next);
    const locationId = `map-${next.latitude.toFixed(5)}-${next.longitude.toFixed(5)}`;
    const coordinateAddress = `Position sur la carte · ${next.latitude.toFixed(5)}, ${next.longitude.toFixed(5)}`;
    setSelectedLabel(coordinateAddress);
    onChoose({ id: locationId, label: 'Point choisi', address: coordinateAddress, latitude: next.latitude, longitude: next.longitude });
    if (reverseGeocodeTimer.current) clearTimeout(reverseGeocodeTimer.current);
    reverseGeocodeTimer.current = setTimeout(async () => {
      setResolving(true);
      let label = 'Point choisi';
      let address = `Position sur la carte · ${next.latitude.toFixed(5)}, ${next.longitude.toFixed(5)}`;
      try {
        const [place] = await Location.reverseGeocodeAsync({ latitude: next.latitude, longitude: next.longitude });
        if (place) {
          const neighborhood = place.district ?? place.subregion ?? place.name;
          const city = place.city ?? place.region;
          const readable = [neighborhood, city].filter((part, index, all) => !!part && all.indexOf(part) === index).join(', ');
          if (readable) { address = readable; label = neighborhood ?? city ?? label; }
        }
      } catch { /* Coordinate address stays available if device geocoding is unavailable. */ }
      setSelectedLabel(address);
      onChoose({ id: locationId, label, address, latitude: next.latitude, longitude: next.longitude });
      setResolving(false);
    }, 500);
  }, [onChoose]);

  useEffect(() => () => { if (reverseGeocodeTimer.current) clearTimeout(reverseGeocodeTimer.current); }, []);

  return <View style={{ height: mapHeight + 82 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
      <View style={{ flex: 1 }}><Text style={{ color: C.text, fontSize: 17, fontWeight: '800' }}>Choisir sur la carte</Text><Text style={{ color: C.muted, fontSize: 12, marginTop: 3 }}>Déplacez la carte pour placer le repère.</Text></View>
      {resolving && <ActivityIndicator size="small" color={C.blue} />}
    </View>
    <View style={{ height: mapHeight, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: C.line }}>
      <MapView
        ref={map}
        style={{ flex: 1 }}
        initialRegion={region}
        onRegionChangeComplete={(next) => { void commitPosition(next); }}
        onLongPress={(event) => { const { latitude, longitude } = event.nativeEvent.coordinate; const next = toRegion(latitude, longitude); map.current?.animateToRegion(next, 300); void commitPosition(next); }}
        showsUserLocation={!!currentPosition}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        accessibilityLabel="Carte interactive. Déplacez la carte pour choisir l’adresse."
      >
        {currentPosition && <Marker coordinate={currentPosition} title="Ma position actuelle" pinColor={C.cyan} />}
      </MapView>
      <View pointerEvents="none" style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -18, marginTop: -36, alignItems: 'center' }}><View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.blue, borderWidth: 3, borderColor: C.white, alignItems: 'center', justifyContent: 'center', shadowColor: C.navy, shadowOpacity: 0.22, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 5 }}><Ionicons name="location" size={18} color={C.white} /></View><View style={{ width: 3, height: 8, backgroundColor: C.blue, marginTop: -1 }} /></View>
      <View pointerEvents="none" style={{ position: 'absolute', left: 10, right: 10, bottom: 10, paddingHorizontal: 11, paddingVertical: 9, borderRadius: 12, backgroundColor: '#FFFFFFEF' }}><Text numberOfLines={2} style={{ color: C.navy, fontWeight: '700', fontSize: 11 }}>{selectedLabel || `Point sélectionné · ${region.latitude.toFixed(4)}, ${region.longitude.toFixed(4)}`}</Text></View>
    </View>
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}><Ionicons name="information-circle-outline" size={15} color={C.muted} /><Text style={{ color: C.muted, fontSize: 10.5, marginLeft: 5, flex: 1 }}>Carte native Google Maps (Android) / Apple Plans (iOS).</Text></View>
    {Platform.OS === 'android' && !androidMapKeyConfigured && <Text style={{ color: C.muted, fontSize: 10.5, lineHeight: 15, marginTop: 5 }}>Pour les builds Android distribués, ajoutez une clé Google Maps dans .env puis reconstruisez l’application. La recherche et la saisie manuelle restent disponibles.</Text>}
  </View>;
}
