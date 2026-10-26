import React from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../../store/AppStore';

import { Button, C, Card, Header, Photo, Screen, Tag } from '../../components/ui';

export default function Offers() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { requests, offers, acceptOffer, technicians } = useAppStore();
  const request = requests.find((item) => item.id === id);
  const list = offers.filter((offer) => offer.requestId === id);

  return <Screen>
    <Header title="Offres reçues" />
    <Text style={{ color: C.muted, marginTop: -10, marginBottom: 16 }}>{request?.serviceNames.join(', ') || 'Demande'} · comparez avant de choisir</Text>
    {list.map((offer) => {
      const technician = technicians.find((item) => item.id === offer.technicianId);
      if (!technician) return null;
      return <Card key={offer.id}>
        <View style={{ flexDirection: 'row', alignItems: 'center', minWidth: 0 }}>
          <Photo uri={technician.avatar} style={{ width: 55, height: 55, borderRadius: 18, flexShrink: 0 }} />
          <View style={{ marginLeft: 11, flex: 1, minWidth: 0 }}>
            <Text style={{ fontWeight: '800', fontSize: 16, color: C.text }}>{technician.name}</Text>
            <Text style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>{technician.specialty} · {technician.experience} ans d’expérience</Text>
          </View>
          <Tag label="Profil démo" />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 14 }}>
          <Text style={{ color: C.amber, fontWeight: '800' }}>★ {technician.rating}</Text>
          <Text style={{ color: C.muted, marginLeft: 6 }}>({technician.reviews} avis · {technician.jobs} interventions)</Text>
        </View>
        <Text style={{ color: C.text, lineHeight: 20, marginTop: 12 }}>{offer.message}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', rowGap: 8, marginTop: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 145, marginRight: 8 }}>
            <Ionicons name="time-outline" size={17} color={C.blue} />
            <Text style={{ color: C.muted, marginLeft: 6, flex: 1 }}>{offer.availability}</Text>
          </View>
          <Text style={{ fontSize: 18, fontWeight: '800', color: C.blue }}>{offer.price} MAD</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={`Voir le profil de ${technician.name}`} onPress={() => router.push(`/technician/${technician.id}?offerId=${offer.id}&requestId=${id}`)} style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', marginTop: 7 }}>
          <Text style={{ color: C.blue, fontWeight: '700' }}>Voir le profil  ›</Text>
        </Pressable>
        {offer.status === 'PENDING' && request?.status !== 'CANCELLED' && <Button title="Choisir cet artisan" onPress={() => Alert.alert('Confirmer votre choix', `${technician.name} · ${offer.price} MAD · ${offer.availability}`, [{ text: 'Retour', style: 'cancel' }, { text: 'Confirmer', onPress: () => { void acceptOffer(id as string, offer.id).then(() => router.replace(`/appointment/${id}`)).catch(error => Alert.alert('Confirmation impossible', error instanceof Error ? error.message : 'Réessayez.')); } }])} />}
        {offer.status === 'ACCEPTED' && <Tag label="Offre acceptée" color={C.green} />}
      </Card>;
    })}
    {list.length === 0 && <Card><Text style={{ color: C.muted }}>Aucune offre reçue pour le moment.</Text></Card>}
    <Text style={{ fontSize: 12, color: C.muted, textAlign: 'center', marginTop: 6 }}>Offres et professionnels de démonstration — aucune intervention réelle n’est déclenchée.</Text>
  </Screen>;
}
