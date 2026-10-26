import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, LayoutChangeEvent, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { cancelAnimation, interpolate, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBookingDraftActions, useCatalogStore } from '../../store/AppStore';
import { C } from '../ui';
import CircularServiceImage from './CircularServiceImage';
import blurFocusedWebElement from '../../utils/blurFocusedWebElement';
import type { Category } from '../../types';

type NodePosition = { x: number; y: number };
const setAnimatedValue = (shared: SharedValue<number>, value: number) => { shared.value = value; };

function RadialNode({ item, index, x, y, diameter, labelWidth, selected, expanded, focused, reduceMotion, onSelect }: { item: Category; index: number; x: number; y: number; diameter: number; labelWidth: number; selected: boolean; expanded: boolean; focused: boolean; reduceMotion: boolean; onSelect: () => void }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    if (!focused) { cancelAnimation(progress); return; }
    setAnimatedValue(progress, expanded ? withDelay(reduceMotion ? 0 : index * 74, withSpring(1, { damping: 20, stiffness: 155 })) : withTiming(0, { duration: reduceMotion ? 0 : 190 }));
  }, [expanded, focused, index, progress, reduceMotion]);
  const style = useAnimatedStyle(() => ({ opacity: progress.value, transform: [{ translateX: x * progress.value }, { translateY: y * progress.value }, { scale: interpolate(progress.value, [0, 1], [0.72, 1]) }] }));
  return <Animated.View style={[{ position: 'absolute', left: '50%', top: '50%', marginLeft: -labelWidth / 2, marginTop: -diameter / 2, width: labelWidth, height: diameter + 35, zIndex: selected ? 4 : 3 }, style]} pointerEvents={expanded ? 'auto' : 'none'}>
    <CircularServiceImage category={item} selected={selected} diameter={diameter} labelWidth={labelWidth} onPress={onSelect} />
  </Animated.View>;
}

function RadialServiceDiscovery() {
  const { width, height } = useWindowDimensions(); const insets = useSafeAreaInsets(); const { setDraft } = useBookingDraftActions(); const { categories } = useCatalogStore();
  const [expanded, setExpanded] = useState(false); const [focused, setFocused] = useState(false); const [reduceMotion, setReduceMotion] = useState(false); const [canvasWidth, setCanvasWidth] = useState(Math.max(0, width - 16));
  const transitionLock = useRef(false); const centerPulse = useSharedValue(0.88); const centerOpacity = useSharedValue(0);
  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {}); const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion); return () => sub.remove(); }, []);
  const menu = useMemo(() => categories.slice(0, 5), [categories]);
  const diameter = Math.max(84, Math.min(100, width * 0.27));
  const labelWidth = Math.min(100, canvasWidth * 0.33);
  const centerSize = Math.max(88, Math.min(104, width * 0.28));
  const centerRadius = centerSize / 2;
  const radialX = Math.max(0, (canvasWidth - labelWidth) / 2);
  const minSideOffset = (diameter + 35 + 12) / 2;
  const topRadius = Math.max(centerRadius + diameter / 2 + 45, Math.hypot(radialX, minSideOffset));
  const sideY = Math.sqrt(Math.max(0, topRadius ** 2 - radialX ** 2));
  const containerHeight = 2 * (topRadius + diameter / 2 + 8);
  const topControlsHeight = 53;
  const tabBarReserve = Math.max(86, 56 + insets.bottom);
  const usableHeightAfterControls = height - insets.top - 20 - topControlsHeight - tabBarReserve;
  const balancedParentOffset = (usableHeightAfterControls - containerHeight) / 2;
  const parentOffset = Math.min(height * 0.18, Math.max(14, balancedParentOffset));
  const topY = -topRadius;
  const positions: NodePosition[] = [{ x: 0, y: topY }, { x: radialX, y: -sideY }, { x: radialX, y: sideY }, { x: -radialX, y: sideY }, { x: -radialX, y: -sideY }];
  const onCanvasLayout = (event: LayoutChangeEvent) => setCanvasWidth((current) => { const measured = Math.round(event.nativeEvent.layout.width); return measured > 0 && Math.abs(measured - current) > 1 ? measured : current; });

  useFocusEffect(useCallback(() => {
    setFocused(true); setExpanded(true);
    setAnimatedValue(centerOpacity, withTiming(1, { duration: reduceMotion ? 0 : 320 }));
    setAnimatedValue(centerPulse, withSpring(1, { damping: 19, stiffness: 145 }));
    return () => { setFocused(false); cancelAnimation(centerPulse); cancelAnimation(centerOpacity); };
  }, [centerOpacity, centerPulse, reduceMotion]));

  const toggle = () => {
    if (transitionLock.current) return;
    transitionLock.current = true;
    const next = !expanded; setExpanded(next);
    setAnimatedValue(centerPulse, withSpring(next ? 1.03 : 0.97, { damping: 18, stiffness: 160 }));
    setTimeout(() => { transitionLock.current = false; }, reduceMotion ? 20 : 380);
  };
  const centerStyle = useAnimatedStyle(() => ({ opacity: centerOpacity.value, transform: [{ scale: centerPulse.value }] }));
  const openCategory = (categoryId: string) => { blurFocusedWebElement(); setDraft({ categoryId, serviceTypes: [], serviceIds: [] }); router.push(`/category/${categoryId}`); };

  return <View style={{ marginTop: parentOffset }}>
    <View onLayout={onCanvasLayout} accessibilityRole="menu" accessibilityLabel="Catégories de services" style={{ height: containerHeight, marginHorizontal: -12 }}>
      {menu.map((item, index) => <RadialNode key={item.id} item={item} index={index} x={positions[index].x} y={positions[index].y} diameter={diameter} labelWidth={labelWidth} selected={false} expanded={expanded} focused={focused} reduceMotion={reduceMotion} onSelect={() => openCategory(item.id)} />)}
      <Animated.View style={[{ position: 'absolute', left: '50%', top: '50%', marginLeft: -centerRadius, marginTop: -centerRadius, width: centerSize, height: centerSize, zIndex: 5 }, centerStyle]}>
        <Pressable accessibilityRole="button" accessibilityLabel={expanded ? 'Réduire les catégories de services' : 'Afficher les catégories de services'} accessibilityHint="Touchez une catégorie pour ouvrir directement ses services" onPress={toggle} style={{ flex: 1, borderRadius: centerRadius, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', padding: 8, borderWidth: 3, borderColor: '#FFFFFFE8', shadowColor: C.blue, shadowOpacity: 0.21, shadowRadius: 17, shadowOffset: { width: 0, height: 7 }, elevation: 6 }}>
          <View style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: '#FFFFFF25', alignItems: 'center', justifyContent: 'center' }}><Ionicons name={expanded ? 'home-outline' : 'grid-outline'} size={20} color={C.white} /></View>
          <Text style={{ color: C.white, fontSize: 11, lineHeight: 13, fontWeight: '800', marginTop: 5, textAlign: 'center' }}>Choisir un{'\n'}service</Text>
        </Pressable>
      </Animated.View>
    </View>
  </View>;
}

export default React.memo(RadialServiceDiscovery);
