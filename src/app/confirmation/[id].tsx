import React from 'react';
import { Text, useWindowDimensions, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../../store/AppStore';
import { C, Button, Card, Screen } from '../../components/ui';

export default function Confirmation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const { requests } = useAppStore();
  const request = requests.find((item) => item.id === id);
  const titleSize = Math.min(27, Math.max(22, width * 0.073));

  return <Screen>
    <View style={{ alignItems: 'center', paddingTop: 28 }}>
      <View style={{ width: 88, height: 88, borderRadius: 30, backgroundColor: '#E2F4EB', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="checkmark" size={48} color={C.green} /></View>
      <Text style={{ fontSize: titleSize, fontWeight: '900', color: C.navy, marginTop: 20, textAlign: 'center' }}>Demande enregistrée !</Text>
      <Text style={{ fontSize: 15, color: C.muted, textAlign: 'center', lineHeight: 23, marginTop: 10 }}>Votre demande a été ajoutée à cette démonstration locale. Aucun professionnel réel n’a été contacté.</Text>
    </View>
    {request && <Card style={{ marginTop: 24 }}>
      <Text style={{ color: C.muted, fontSize: 12 }}>RÉFÉRENCE DE DÉMO</Text>
      <Text style={{ fontSize: 20, fontWeight: '900', color: C.blue, marginTop: 5 }}>{request.ref}</Text>
      <Text style={{ fontWeight: '800', color: C.text, marginTop: 17 }}>{request.serviceNames.join(', ')}</Text>
      <Text style={{ color: C.muted, marginTop: 6 }}>{request.address.address}</Text>
      <Text style={{ marginTop: 12, color: C.blue, fontWeight: '700' }}>Demande enregistrée · offres de démonstration</Text>
    </Card>}
    <Button title="Suivre ma demande" onPress={() => router.replace(`/request/${id}`)} />
    <Button title="Retour à l’accueil" secondary onPress={() => router.replace('/(tabs)')} />
  </Screen>;
}
