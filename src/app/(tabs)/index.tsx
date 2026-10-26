import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../../store/AppStore';
import { C, Screen } from '../../components/ui';
import LocationPickerSheet from '../../components/home/LocationPickerSheet';
import RadialServiceDiscovery from '../../components/home/RadialServiceDiscovery';
import type { HomeLocation } from '../../data/homeMockData';

export default function Home() {
  const { homeLocation, setHomeLocation, setDraft, notifications } = useAppStore();
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationMode, setLocationMode] = useState<'search' | 'map'>('search');
  const [locationSession, setLocationSession] = useState(0);
  const unreadCount = notifications.filter((notification) => !notification.read).length;
  const selectedLocation: HomeLocation = { id: homeLocation.id, label: homeLocation.label, address: homeLocation.address, latitude: homeLocation.latitude, longitude: homeLocation.longitude };

  const chooseLocation = (location: HomeLocation) => {
    const address = { id: location.id, label: location.label, address: location.address, latitude: location.latitude, longitude: location.longitude };
    setHomeLocation(address);
    setDraft({ address });
  };
  const openLocation = (mode: 'search' | 'map') => { setLocationMode(mode); setLocationSession((key) => key + 1); setLocationOpen(true); };

  return <Screen backgroundColor="#F4F8FC">
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 53 }}>
      <Pressable accessibilityRole="search" accessibilityLabel={`Rechercher une ville ou une adresse. Sélectionnée : ${homeLocation.address}`} onPress={() => openLocation('search')} style={{ flex: 1, height: 52, flexDirection: 'row', alignItems: 'center', borderRadius: 17, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, paddingHorizontal: 12, shadowColor: C.navy, shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 }}>
        <Ionicons name="location" size={18} color={C.blue} /><View style={{ flex: 1, marginLeft: 9 }}><Text style={{ color: C.muted, fontSize: 9.5, fontWeight: '600' }}>VOTRE POSITION</Text><Text numberOfLines={1} style={{ color: C.navy, fontWeight: '800', fontSize: 13, marginTop: 2 }}>{homeLocation.address}</Text></View><Ionicons name="search" size={17} color={C.muted} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Choisir la position sur la carte" onPress={() => openLocation('map')} style={{ width: 43, height: 48, borderRadius: 15, backgroundColor: '#E7F4FA', alignItems: 'center', justifyContent: 'center', marginLeft: 7 }}><Ionicons name="map-outline" size={19} color={C.blue} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={unreadCount ? `Alertes, ${unreadCount} non lues` : 'Alertes'} onPress={() => router.push('/(tabs)/alerts')} style={{ width: 43, height: 48, borderRadius: 15, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', marginLeft: 7 }}><Ionicons name="notifications-outline" size={19} color={C.navy} />{unreadCount > 0 && <View style={{ position: 'absolute', top: 6, right: 6, minWidth: 15, height: 15, borderRadius: 8, backgroundColor: C.red, borderWidth: 2, borderColor: C.white, alignItems: 'center', justifyContent: 'center' }}>{unreadCount < 10 && <Text style={{ color: C.white, fontSize: 8, fontWeight: '800' }}>{unreadCount}</Text>}</View>}</Pressable>
    </View>
    <RadialServiceDiscovery />
    <LocationPickerSheet key={locationSession} visible={locationOpen} selectedLocation={selectedLocation} initialMode={locationMode} onClose={() => setLocationOpen(false)} onSelect={chooseLocation} />
  </Screen>;
}
