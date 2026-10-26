import React, { useCallback, useEffect } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore, useBookingDraftActions, useCatalogStore } from '../../store/AppStore';
import { C, Header, Screen } from '../../components/ui';
import ServiceTypeGrid from '../../components/catalog/ServiceTypeGrid';
import ServiceTypeNavigation from '../../components/catalog/ServiceTypeNavigation';
import blurFocusedWebElement from '../../utils/blurFocusedWebElement';

export default function CategoryPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { draft } = useAppStore();
  const { setDraft, toggleServiceType } = useBookingDraftActions();
  const { categories } = useCatalogStore();
  const category = categories.find((item) => item.id === id) ?? categories[0];
  const selectedTypes = draft.categoryId === category.id ? draft.serviceTypes : [];

  useEffect(() => {
    if (draft.categoryId !== category.id) setDraft({ categoryId: category.id, serviceTypes: [], serviceIds: [] });
  }, [category.id, draft.categoryId, setDraft]);

  const toggleType = useCallback((type: string) => toggleServiceType(category.id, type), [category.id, toggleServiceType]);

  return <Screen>
    <Header title={category.name} />
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
      <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: category.color, alignItems: 'center', justifyContent: 'center', marginRight: 11 }}>
        <Ionicons name={category.icon as never} size={21} color={C.blue} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: C.navy, fontSize: 16, fontWeight: '800' }}>Quel service vous faut-il ?</Text>
        <Text style={{ color: C.muted, fontSize: 12, marginTop: 3 }}>Choisissez une ou plusieurs options.</Text>
      </View>
    </View>
    <ServiceTypeGrid categoryId={category.id} selectedTypes={selectedTypes} onToggle={toggleType} />
    <ServiceTypeNavigation
      canContinue={selectedTypes.length > 0}
      onBack={() => { blurFocusedWebElement(); router.back(); }}
      onNext={() => { blurFocusedWebElement(); router.push('/booking/items'); }}
    />
  </Screen>;
}
