import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { C, Button, Field } from '../ui';
import { homeLocations, type HomeLocation } from '../../data/homeMockData';
import MapLocationPicker from './MapLocationPicker';
import blurFocusedWebElement from '../../utils/blurFocusedWebElement';

type Props = { visible: boolean; selectedLocation: HomeLocation; initialMode: 'search' | 'map'; onClose: () => void; onSelect: (location: HomeLocation) => void };
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’‘]/g, "'").toLowerCase();

export default function LocationPickerSheet({ visible, selectedLocation, initialMode, onClose, onSelect }: Props) {
  const [query, setQuery] = useState(''); const [selection, setSelection] = useState<HomeLocation | null>(() => selectedLocation ?? null); const [geocodedResult, setGeocodedResult] = useState<{ query: string; locations: HomeLocation[] }>({ query: '', locations: [] }); const [searching, setSearching] = useState(false);
  const [mode, setMode] = useState<'search' | 'map'>(initialMode); const [loading, setLoading] = useState(false); const [message, setMessage] = useState('');
  const list = useMemo(() => [...homeLocations, ...(normalize(geocodedResult.query) === normalize(query) ? geocodedResult.locations : [])].filter((item) => normalize(`${item.address} ${item.label}`).includes(normalize(query))), [geocodedResult, query]);
  useEffect(() => {
    const text = query.trim();
    if (Platform.OS === 'web' || text.length < 3) return;
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (!active || !permission.granted) return;
        setSearching(true);
        const results = await Location.geocodeAsync(text);
        if (!active) return;
        setGeocodedResult({ query: text, locations: results.slice(0, 3).map((result, index) => ({ id: `geocode-${normalize(text)}-${index}`, label: 'Résultat cartographique · appareil', address: text, latitude: result.latitude, longitude: result.longitude })) });
      } catch { /* Manual address entry and seeded suggestions remain available. */ }
      finally { if (active) setSearching(false); }
    }, 550);
    return () => { active = false; clearTimeout(timer); };
  }, [query]);
  const finish = (location: HomeLocation) => { blurFocusedWebElement(); onSelect(location); setQuery(''); setSelection(null); setMessage(''); setMode('search'); onClose(); };
  const closeSheet = () => { blurFocusedWebElement(); onClose(); };
  const detectLocation = async () => {
    setLoading(true); setMessage('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) { setMessage('Accès à la position refusé. Vous pouvez choisir une ville ou une adresse manuellement.'); setLoading(false); return; }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = position.coords;
      let address = `Position actuelle · ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      let label = 'Position actuelle';
      try {
        const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (place) {
          const neighborhood = place.district ?? place.subregion ?? place.name;
          const city = place.city ?? place.region;
          const readable = [neighborhood, city].filter((part, index, all) => !!part && all.indexOf(part) === index).join(', ');
          if (readable) { address = readable; label = neighborhood ?? city ?? label; }
        }
      } catch { /* Coordinates remain available when device geocoding is unavailable. */ }
      setSelection({ id: `gps-${latitude.toFixed(4)}-${longitude.toFixed(4)}`, label, address, latitude, longitude }); setMode('map');
    } catch { setMessage('Position indisponible pour le moment. Recherchez une ville ou choisissez un point sur la carte.'); }
    finally { setLoading(false); }
  };
  const confirmSelection = () => { if (selection) finish(selection); };

  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: C.bg, paddingTop: 8 }}>
      <View style={{ width: 38, height: 4, borderRadius: 4, backgroundColor: '#CCD9E2', alignSelf: 'center', marginBottom: 18 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 14 }}><View style={{ flex: 1 }}><Text style={{ fontSize: 21, fontWeight: '800', color: C.text }}>Votre position</Text><Text style={{ color: C.muted, fontSize: 12, marginTop: 3 }}>Suggestions locales · GPS selon l’appareil</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Fermer la sélection d’adresse" onPress={closeSheet} hitSlop={10}><Ionicons name="close" size={23} color={C.muted} /></Pressable></View>
      {mode === 'search' ? <>
        <View style={{ paddingHorizontal: 20 }}><Field label="Ville, quartier ou adresse" value={query} onChangeText={(value) => { setSearching(false); setQuery(value); }} placeholder="Rechercher une ville ou une adresse" right={searching ? <ActivityIndicator size="small" color={C.blue} /> : query ? <Pressable accessibilityLabel="Effacer" onPress={() => { setSearching(false); setQuery(''); }}><Ionicons name="close-circle" size={19} color={C.muted} /></Pressable> : <Ionicons name="search" size={19} color={C.blue} />} />
          <Pressable accessibilityRole="button" onPress={detectLocation} disabled={loading} style={{ minHeight: 49, borderRadius: 15, backgroundColor: '#E7F4FA', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, marginBottom: 10 }}><View style={{ width: 33, height: 33, borderRadius: 11, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' }}>{loading ? <ActivityIndicator size="small" color={C.blue} /> : <Ionicons name="navigate" size={17} color={C.blue} />}</View><Text style={{ color: C.blue, fontWeight: '800', marginLeft: 9, flex: 1 }}>Utiliser ma position actuelle</Text>{loading && <Text style={{ color: C.muted, fontSize: 11 }}>Localisation…</Text>}</Pressable>
          {message ? <Text accessibilityRole="alert" style={{ color: C.red, fontSize: 12, lineHeight: 17, marginBottom: 9 }}>{message}</Text> : null}
          <Pressable accessibilityRole="button" onPress={() => setMode('map')} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, marginBottom: 6 }}><Ionicons name="map-outline" size={19} color={C.blue} /><Text style={{ color: C.blue, fontWeight: '800', marginLeft: 8 }}>Choisir sur la carte</Text><Ionicons name="chevron-forward" size={16} color={C.blue} style={{ marginLeft: 'auto' }} /></Pressable>
        </View>
        <Text style={{ color: C.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, marginHorizontal: 20, marginTop: 8, marginBottom: 5 }}>LIEUX SUGGÉRÉS</Text>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}>{list.map((item) => <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: selection?.id === item.id }} accessibilityLabel={`Sélectionner ${item.address}`} onPress={() => setSelection(item)} style={{ minHeight: 55, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.line }}><View style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: '#EAF3F8', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="location-outline" size={17} color={C.blue} /></View><View style={{ flex: 1, marginLeft: 10 }}><Text style={{ fontWeight: '700', color: C.text, fontSize: 14 }}>{item.address}</Text><Text style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>{item.label}</Text></View><Ionicons name={selection?.id === item.id ? 'radio-button-on' : 'chevron-forward'} size={19} color={selection?.id === item.id ? C.blue : C.muted} /></Pressable>)}{query.trim().length > 0 && <Pressable accessibilityRole="button" accessibilityLabel={`Saisir manuellement ${query.trim()}`} onPress={() => setSelection({ id: `manual-${normalize(query)}`, label: 'Adresse saisie manuellement', address: query.trim() })} style={{ minHeight: 55, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.line }}><View style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: '#EAF3F8', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="create-outline" size={17} color={C.blue} /></View><View style={{ flex: 1, marginLeft: 10 }}><Text style={{ fontWeight: '700', color: C.text, fontSize: 14 }}>{query.trim()}</Text><Text style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>Saisir cette adresse manuellement</Text></View><Ionicons name={selection?.address === query.trim() ? 'radio-button-on' : 'chevron-forward'} size={19} color={selection?.address === query.trim() ? C.blue : C.muted} /></Pressable>}{list.length === 0 && !query.trim() && <Text style={{ color: C.muted, paddingVertical: 22, textAlign: 'center' }}>Aucune suggestion. Vous pouvez choisir un point sur la carte.</Text>}</ScrollView>
        {!!selection && <View style={{ paddingHorizontal: 20, paddingBottom: 15 }}><Button title={`Confirmer · ${selection.address}`} onPress={confirmSelection} /></View>}
      </> : <>
        <View style={{ flex: 1, paddingHorizontal: 16 }}><MapLocationPicker initialLocation={selection} onChoose={setSelection} /></View>
        <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 18 }}><Button title={selection ? 'Confirmer cette position' : 'Touchez la carte pour choisir'} disabled={!selection} onPress={confirmSelection} /><Button title="Retour à la recherche" secondary onPress={() => setMode('search')} /></View>
      </>}
    </SafeAreaView>
  </Modal>;
}
