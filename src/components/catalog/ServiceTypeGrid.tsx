import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useCatalogStore } from '../../store/AppStore';
import { C, screenGutter } from '../ui';
import type { Category } from '../../types';

type Props = {
  categoryId: string;
  selectedTypes: string[];
  onToggle: (type: string) => void;
};

const ServiceTypeCard = memo(function ServiceTypeCard({ category, type, image, selected, width, imageHeight, onToggle }: { category: Category; type: string; image: string; selected: boolean; width: `${number}%`; imageHeight: number; onToggle: (type: string) => void }) {
  const [useCategoryFallback, setUseCategoryFallback] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const displayedImage = useCategoryFallback ? category.image : image;
  const imageSource = useMemo(() => ({ uri: displayedImage }), [displayedImage]);
  const handlePress = useCallback(() => onToggle(type), [onToggle, type]);

  // Keep the card visible if a remote image request stalls without firing onError.
  useEffect(() => {
    if (!imageLoading) return;
    const timeout = setTimeout(() => {
      setImageLoading(false);
      setImageFailed(true);
    }, 8000);
    return () => clearTimeout(timeout);
  }, [imageLoading, displayedImage]);

  const handleImageError = () => {
    setImageLoading(false);
    if (!useCategoryFallback && image !== category.image) {
      setUseCategoryFallback(true);
      setImageLoading(true);
    } else {
      setImageFailed(true);
    }
  };
  return <Pressable
    accessibilityRole="button"
    accessibilityState={{ selected }}
    accessibilityLabel={`${type}${selected ? ', sélectionné' : ''}`}
    onPress={handlePress}
    style={({ pressed }) => ({
      width,
      flexGrow: 0,
      flexShrink: 0,
      marginBottom: 12,
      borderRadius: 18,
      overflow: 'hidden',
      borderWidth: selected ? 2 : 1,
      borderColor: selected ? C.blue : C.line,
      backgroundColor: category.color,
      shadowColor: C.navy,
      shadowOpacity: selected ? 0.14 : 0.08,
      shadowRadius: 9,
      shadowOffset: { width: 0, height: 4 },
      elevation: selected ? 3 : 1,
      opacity: pressed ? 0.92 : 1,
      transform: [{ scale: pressed ? 0.99 : 1 }],
    })}
  >
    <View style={{ width: '100%', height: imageHeight, backgroundColor: category.color, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {!imageFailed ? <Image
        source={imageSource}
        resizeMode="cover"
        onLoadStart={() => setImageLoading(true)}
        onLoad={() => setImageLoading(false)}
        onError={handleImageError}
        style={{ width: '100%', height: '100%' }}
      /> : <View style={{ width: '100%', height: '100%', backgroundColor: category.color, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', marginBottom: 7 }}><Ionicons name={category.icon as never} size={25} color={C.blue} /></View>
        <Text style={{ color: C.navy, fontSize: 12, fontWeight: '800', textAlign: 'center' }}>{category.name}</Text>
        <Text style={{ color: C.muted, fontSize: 10, textAlign: 'center', marginTop: 3 }}>Visuel indisponible</Text>
      </View>}
      {imageLoading && !imageFailed && <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#18324718' }}><ActivityIndicator size="small" color={C.white} /></View>}
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, minHeight: 46, paddingHorizontal: 10, paddingVertical: 7, justifyContent: 'flex-end', backgroundColor: '#183247A8' }}>
        <Text numberOfLines={2} style={{ color: C.white, fontSize: 13, lineHeight: 16, fontWeight: '800', paddingRight: 23 }}>{type}</Text>
      </View>
      {selected && <View pointerEvents="none" style={{ position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: C.blue, borderWidth: 2, borderColor: C.white, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="checkmark" size={14} color={C.white} /></View>}
    </View>
  </Pressable>;
});

export default function ServiceTypeGrid({ categoryId, selectedTypes, onToggle }: Props) {
  const { categories, serviceItems, typesByCategory } = useCatalogStore();
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const gutter = screenGutter(windowWidth);
  const measuredContentWidth = windowWidth - insets.left - insets.right - gutter * 2;
  // A non-zero fallback keeps the first native/web render visible before dimensions settle.
  const contentWidth = Math.min(measuredContentWidth > 0 ? measuredContentWidth : 320, 720);
  const columns = contentWidth >= 276 ? 2 : 1;
  const cardWidth = columns === 1 ? '100%' : '48.5%';
  const cardWidthDp = columns === 1 ? contentWidth : (contentWidth - 12) / 2;
  const imageHeight = Math.max(112, Math.min(164, Math.round(cardWidthDp * 0.82)));
  const types = typesByCategory[categoryId] ?? [];
  const category = useMemo(() => categories.find((item) => item.id === categoryId) ?? categories[0], [categories, categoryId]);
  const imageByType = useMemo(() => {
    const images = new Map<string, string>();
    for (const item of serviceItems) {
      if (item.categoryId === categoryId && !images.has(item.type)) images.set(item.type, item.image);
    }
    return images;
  }, [categoryId, serviceItems]);

  return <View style={{ width: '100%', maxWidth: 720, alignSelf: 'center' }}>
    <View style={{ width: '100%', flexDirection: 'row', flexWrap: 'wrap', justifyContent: columns === 1 ? 'center' : 'space-between' }}>
      {category && types.map((type) => <ServiceTypeCard
        key={`${categoryId}-${type}`}
        category={category}
        type={type}
        image={imageByType.get(type) ?? category.image}
        width={cardWidth}
        imageHeight={imageHeight}
        selected={selectedTypes.includes(type)}
        onToggle={onToggle}
      />)}
    </View>
  </View>;
}
