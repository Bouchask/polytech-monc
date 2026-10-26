import React from 'react';
import { Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../ui';
import type { HomeLocation } from '../../data/homeMockData';

type Props = { initialLocation?: HomeLocation | null; onChoose: (location: HomeLocation) => void };

// Web has no native map view. The address search and GPS flow remain available there.
export default function MapLocationPicker({ initialLocation }: Props) {
  const { height: windowHeight } = useWindowDimensions();
  const previewHeight = Math.max(240, Math.min(360, Math.round(windowHeight * 0.45)));
  return <View style={{ height: previewHeight, borderRadius: 22, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, padding: 22, alignItems: 'center', justifyContent: 'center' }}>
    <View style={{ width: 54, height: 54, borderRadius: 18, backgroundColor: '#E8F4FA', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}><Ionicons name="map-outline" size={26} color={C.blue} /></View>
    <Text style={{ color: C.navy, fontSize: 16, fontWeight: '800', textAlign: 'center' }}>La carte interactive est disponible dans l’application mobile</Text>
    <Text style={{ color: C.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 8 }}>{initialLocation?.address ?? 'Recherchez une ville ou utilisez votre position pour choisir une adresse.'}</Text>
    <Text style={{ color: C.muted, fontSize: 11, textAlign: 'center', marginTop: 14 }}>Sélectionnez une suggestion ou saisissez une adresse manuellement.</Text>
  </View>;
}

export type { Props as MapLocationPickerProps };
