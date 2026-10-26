import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../ui';

type Props = { canContinue: boolean; onBack: () => void; onNext: () => void };

export default function ServiceTypeNavigation({ canContinue, onBack, onNext }: Props) {
  return <View style={{ width: '100%', alignSelf: 'center', marginTop: 8 }}>
    <View style={{ width: '100%', flexDirection: 'row', alignItems: 'stretch' }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Retour à l’étape précédente" onPress={onBack} style={({ pressed }) => ({ flexGrow: 1, flexBasis: 0, minWidth: 0, minHeight: 54, marginRight: 10, paddingHorizontal: 8, borderRadius: 16, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', opacity: pressed ? 0.86 : 1 })}>
        <Ionicons name="arrow-back" size={18} color={C.blue} style={{ marginRight: 7 }} />
        <Text numberOfLines={1} style={{ color: C.blue, fontSize: 15, fontWeight: '800', flexShrink: 1 }}>Retour</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Suivant, afficher les prestations" accessibilityState={{ disabled: !canContinue }} accessibilityHint={!canContinue ? 'Sélectionnez au moins un type de service' : undefined} disabled={!canContinue} onPress={onNext} style={({ pressed }) => ({ flexGrow: 1, flexBasis: 0, minWidth: 0, minHeight: 54, paddingHorizontal: 8, borderRadius: 16, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', opacity: !canContinue ? 0.48 : pressed ? 0.88 : 1 })}>
        <Text numberOfLines={1} style={{ color: C.white, fontSize: 15, fontWeight: '800', flexShrink: 1 }}>Suivant</Text>
        <Ionicons name="arrow-forward" size={18} color={C.white} style={{ marginLeft: 7 }} />
      </Pressable>
    </View>
    {!canContinue && <Text style={{ color: C.muted, fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 8 }}>Sélectionnez au moins un service pour continuer.</Text>}
  </View>;
}
