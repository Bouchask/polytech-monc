import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useBookingDraftActions, useCatalogStore } from '../store/AppStore';
import { C, Card, Field, Header, Photo, Screen } from '../components/ui';

export default function Search() {
  const [query, setQuery] = useState('');
  const { setDraft } = useBookingDraftActions();
  const { categories, serviceItems } = useCatalogStore();
  const categoriesById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const normalizedQuery = query.toLocaleLowerCase();
  const results = useMemo(() => serviceItems.filter((service) => `${service.name} ${service.type} ${categoriesById.get(service.categoryId)?.name ?? ''}`.toLocaleLowerCase().includes(normalizedQuery)), [categoriesById, normalizedQuery, serviceItems]);

  return <Screen>
    <Header title="Explorer les services" />
    <Field label="Recherche" value={query} onChangeText={setQuery} placeholder="Ex. fuite d’eau, prise…" right={<Ionicons name="search" size={19} color={C.muted} />} />
    {!query && <>
      <Text style={{ fontWeight: '800', color: C.text, marginBottom: 10 }}>Recherches récentes</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 13 }}>
        {['Plomberie', 'Électricité'].map((term) => <Pressable key={term} accessibilityRole="button" onPress={() => setQuery(term)} style={({ pressed }) => ({ minHeight: 42, justifyContent: 'center', paddingHorizontal: 12, backgroundColor: C.white, borderRadius: 12, marginRight: 8, marginBottom: 8, opacity: pressed ? 0.75 : 1 })}><Text style={{ color: C.muted, fontWeight: '700' }}>{term}</Text></Pressable>)}
      </View>
    </>}
    {results.map((service) => <Card key={service.id} accessibilityLabel={`${service.name}, ${categoriesById.get(service.categoryId)?.name ?? ''}`} onPress={() => { setDraft({ categoryId: service.categoryId, serviceTypes: [service.type], serviceIds: [service.id] }); router.push('/booking/location'); }} style={{ padding: 0, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' }}>
      <Photo uri={service.image} style={{ width: 84, height: 82, flexShrink: 0 }} resizeMode="cover" />
      <View style={{ padding: 11, flex: 1, minWidth: 0 }}>
        <Text style={{ fontWeight: '800', color: C.text }}>{service.name}</Text>
        <Text style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{categoriesById.get(service.categoryId)?.name} · {service.type}</Text>
        <Text style={{ fontWeight: '700', color: C.blue, fontSize: 12, marginTop: 4 }}>{typeof service.min === 'number' && typeof service.max === 'number' ? `${service.min}–${service.max} MAD · estimation` : 'Prix à confirmer'}</Text>
      </View>
    </Card>)}
    {results.length === 0 && <Card style={{ alignItems: 'center', padding: 26 }}>
      <Ionicons name="search-outline" size={34} color={C.muted} />
      <Text style={{ fontWeight: '800', color: C.text, marginTop: 10 }}>Aucun résultat</Text>
      <Text style={{ color: C.muted, marginTop: 5, textAlign: 'center', lineHeight: 20 }}>Essayez un autre terme ou demandez un service personnalisé.</Text>
    </Card>}
  </Screen>;
}
