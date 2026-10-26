import React from 'react';
import { Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { C, Button, Card, Photo, Screen } from '../components/ui';

const hero = 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1100';

export default function Welcome() {
  const { height, width } = useWindowDimensions();
  const heroHeight = Math.max(220, Math.min(350, height * 0.42));
  const headlineSize = Math.min(31, Math.max(26, (width - 32) * 0.088));

  return <Screen>
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 18 }}>
      <View style={{ width: 43, height: 43, borderRadius: 15, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="home" size={22} color="#fff" /></View>
      <Text style={{ fontSize: 24, fontWeight: '900', color: C.navy, marginLeft: 10 }}>palesso</Text>
      <Text accessibilityRole="button" onPress={() => router.replace('/(tabs)')} style={{ marginLeft: 'auto', color: C.blue, fontWeight: '700', padding: 8 }}>Passer</Text>
    </View>
    <View style={{ height: heroHeight, borderRadius: 26, overflow: 'hidden', marginBottom: 22 }}>
      <Photo uri={hero} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      <View style={{ position: 'absolute', left: 14, right: 14, bottom: 14, maxWidth: 360, alignSelf: 'flex-start', backgroundColor: '#FFFFFFE8', borderRadius: 14, padding: 10, flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons name="shield-checkmark" size={20} color={C.green} />
        <Text numberOfLines={2} style={{ color: C.navy, fontWeight: '700', marginLeft: 8, flex: 1 }}>Des services à domicile, simplement</Text>
      </View>
    </View>
    <Text style={{ fontSize: headlineSize, fontWeight: '900', color: C.navy, lineHeight: headlineSize * 1.2 }}>Votre maison mérite{'\n'}le meilleur soin.</Text>
    <Text style={{ fontSize: 16, color: C.muted, lineHeight: 24, marginTop: 10 }}>Trouvez un professionnel près de chez vous, comparez les offres et suivez votre demande en toute simplicité.</Text>
    <Button title="Découvrir les services" onPress={() => router.replace('/(tabs)')} icon="arrow-forward" />
    <Button title="Se connecter" secondary onPress={() => router.push('/auth/login')} />
    <Text style={{ color: C.muted, textAlign: 'center', marginTop: 16 }}>Découvrez Palesso sans créer de compte.</Text>
    <Card style={{ marginTop: 16, backgroundColor: '#EAF5FA', borderWidth: 0 }}><Text style={{ color: C.navy, fontWeight: '700', textAlign: 'center' }}>Vos demandes sont enregistrées par l’API Palesso. Aucune intervention réelle n’est encore attribuée.</Text></Card>
  </Screen>;
}
