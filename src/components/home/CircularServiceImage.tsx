import React, { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../ui';
import type { Category } from '../../types';

type Props = { category: Category; selected: boolean; onPress: () => void; diameter: number; labelWidth: number };
const fallbackIcons: Record<string, string> = { electricite: 'flash', electromenager: 'construct', plomberie: 'water', peinture: 'color-palette', nettoyage: 'sparkles' };

export default function CircularServiceImage({ category, selected, onPress, diameter, labelWidth }: Props) {
  const [failed, setFailed] = useState(false);
  return <Pressable accessibilityRole="button" accessibilityLabel={`Choisir ${category.name}`} accessibilityState={{ selected }} onPress={onPress} style={{ width: labelWidth, alignItems: 'center' }}>
    <View style={{ width: diameter, height: diameter, borderRadius: diameter / 2, overflow: 'hidden', borderWidth: selected ? 3 : 2, borderColor: selected ? C.blue : C.white, backgroundColor: category.color, alignItems: 'center', justifyContent: 'center', shadowColor: '#183247', shadowOpacity: selected ? 0.22 : 0.12, shadowRadius: 11, shadowOffset: { width: 0, height: 4 }, elevation: selected ? 5 : 3 }}>
      {!failed ? <Image source={{ uri: category.image }} resizeMode="cover" onError={() => setFailed(true)} style={{ width: '100%', height: '100%' }} /> : <Ionicons name={(fallbackIcons[category.id] ?? 'home') as never} size={30} color={C.blue} />}
    </View>
    <Text numberOfLines={2} style={{ width: labelWidth, minHeight: 30, color: selected ? C.blue : C.navy, fontSize: 11, lineHeight: 13, textAlign: 'center', fontWeight: selected ? '800' : '700', marginTop: 5 }}>{category.name}</Text>
    {selected && <View pointerEvents="none" style={{ position: 'absolute', top: 5, right: Math.max(2, (labelWidth - diameter) / 2 - 5), width: 21, height: 21, borderRadius: 11, backgroundColor: C.blue, borderColor: C.white, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="checkmark" size={12} color={C.white} /></View>}
  </Pressable>;
}
