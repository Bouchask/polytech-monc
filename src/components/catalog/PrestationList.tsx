import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ServiceItem } from '../../types';
import { C, Photo } from '../ui';

type Props = { items: ServiceItem[]; selectedIds: string[]; onToggle: (id: string) => void };

export default function PrestationList({ items, selectedIds, onToggle }: Props) {
  return <View>
    {items.map((item) => {
      const selected = selectedIds.includes(item.id);
      const hasPrice = typeof item.min === 'number' && typeof item.max === 'number';
      return <Pressable
        key={item.id}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={`${item.name}, ${hasPrice ? `${item.min} à ${item.max} dirhams, estimation` : 'prix à confirmer'}${selected ? ', sélectionné' : ''}`}
        onPress={() => onToggle(item.id)}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', minHeight: 108, overflow: 'hidden', backgroundColor: selected ? '#F0F8FC' : C.white, borderRadius: 18, borderWidth: selected ? 1.5 : 1, borderColor: selected ? C.blue : C.line, marginBottom: 11, opacity: pressed ? 0.93 : 1, shadowColor: C.navy, shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 })}
      >
        <Photo uri={item.image} style={{ width: 92, height: 108 }} resizeMode="cover" />
        <View style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 11 }}>
          <Text numberOfLines={2} style={{ color: C.text, fontSize: 14, lineHeight: 18, fontWeight: '800' }}>{item.name}</Text>
          {!!item.description && <Text numberOfLines={2} style={{ color: C.muted, fontSize: 12, lineHeight: 16, marginTop: 4 }}>{item.description}</Text>}
          <Text style={{ color: C.blue, fontSize: 12, fontWeight: '800', marginTop: 7 }}>{hasPrice ? `${item.min}–${item.max} MAD · estimation` : 'Prix à confirmer'}</Text>
        </View>
        <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={21} color={selected ? C.blue : '#B4C2CC'} style={{ marginRight: 11 }} />
      </Pressable>;
    })}
  </View>;
}
