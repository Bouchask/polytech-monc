import "./global.css";
import React, { useState } from "react";
import { StatusBar } from "expo-status-bar";
import {
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Platform,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

export default function App() {
  const [counter, setCounter] = useState(0);
  const [activeTab, setActiveTab] = useState<"features" | "stack">("features");

  const stackItems = [
    {
      name: "Expo SDK 58",
      description: "Plateforme moderne de développement mobile universel",
      icon: "flash-outline" as const,
      color: "bg-indigo-500",
    },
    {
      name: "React Native 0.88",
      description: "Architecture haute performance avec New Architecture",
      icon: "logo-react" as const,
      color: "bg-cyan-500",
    },
    {
      name: "Tailwind CSS (NativeWind v4)",
      description: "Styles utilitaires rapides, responsives et maintenables",
      icon: "color-palette-outline" as const,
      color: "bg-sky-500",
    },
    {
      name: "TypeScript",
      description: "Typage statique sécurisé et autocomplétion complète",
      icon: "code-slash-outline" as const,
      color: "bg-blue-600",
    },
  ];

  const features = [
    {
      title: "Design System Tailwind",
      desc: "Utilisez className pour tous vos composants natifs",
      badge: "Prêt",
    },
    {
      title: "Rechargement Rapide (Fast Refresh)",
      desc: "Modifiez le code et voyez le résultat instantanément",
      badge: "Actif",
    },
    {
      title: "Support Multi-Plateforme",
      desc: "Compatible iOS, Android et Web sans configuration additionnelle",
      badge: "Universel",
    },
  ];

  return (
    <SafeAreaProvider>
      <SafeAreaView className="flex-1 bg-slate-950">
        <StatusBar style="light" />
        <ScrollView
          className="flex-1 px-6 pt-4"
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between mb-8">
            <View className="flex-row items-center gap-3">
              <View className="w-11 h-11 rounded-2xl bg-indigo-600 items-center justify-center shadow-lg shadow-indigo-500/30">
                <Ionicons name="sparkles" size={22} color="#ffffff" />
              </View>
              <View>
                <Text className="text-white text-xl font-bold tracking-tight">
                  Polytech Monc
                </Text>
                <Text className="text-slate-400 text-xs font-medium">
                  Expo • React Native • Tailwind
                </Text>
              </View>
            </View>

            <View className="flex-row items-center px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30">
              <View className="w-2 h-2 rounded-full bg-emerald-400 mr-2" />
              <Text className="text-emerald-400 text-xs font-semibold">
                Actif
              </Text>
            </View>
          </View>

          {/* Hero Banner */}
          <View className="rounded-3xl p-6 bg-gradient-to-br from-indigo-900/60 to-purple-900/40 border border-indigo-500/20 mb-6">
            <View className="flex-row items-center mb-3">
              <Text className="text-indigo-400 font-semibold text-xs uppercase tracking-wider">
                Initialisation Réussie
              </Text>
            </View>
            <Text className="text-white text-2xl font-extrabold mb-2 leading-tight">
              Votre projet mobile est prêt !
            </Text>
            <Text className="text-slate-300 text-sm leading-relaxed mb-5">
              Projet Expo configuré avec NativeWind v4, Tailwind CSS, TypeScript et React Native.
            </Text>

            {/* Test Interactive Counter */}
            <View className="bg-slate-900/70 rounded-2xl p-4 border border-white/10 flex-row items-center justify-between">
              <View>
                <Text className="text-slate-400 text-xs font-medium">
                  Test d'interactivité
                </Text>
                <Text className="text-white text-lg font-bold">
                  Compteur : {counter}
                </Text>
              </View>
              <View className="flex-row gap-2">
                <TouchableOpacity
                  onPress={() => setCounter((c) => Math.max(0, c - 1))}
                  className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 items-center justify-center active:scale-95"
                >
                  <Text className="text-white text-lg font-bold">-</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setCounter((c) => c + 1)}
                  className="w-10 h-10 rounded-xl bg-indigo-600 items-center justify-center active:scale-95 shadow-md shadow-indigo-600/40"
                >
                  <Text className="text-white text-lg font-bold">+</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Tab Selector */}
          <View className="flex-row p-1 bg-slate-900 rounded-2xl border border-slate-800 mb-5">
            <TouchableOpacity
              onPress={() => setActiveTab("features")}
              className={`flex-1 py-2.5 rounded-xl items-center ${
                activeTab === "features" ? "bg-indigo-600 shadow" : ""
              }`}
            >
              <Text
                className={`text-sm font-semibold ${
                  activeTab === "features" ? "text-white" : "text-slate-400"
                }`}
              >
                Fonctionnalités
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab("stack")}
              className={`flex-1 py-2.5 rounded-xl items-center ${
                activeTab === "stack" ? "bg-indigo-600 shadow" : ""
              }`}
            >
              <Text
                className={`text-sm font-semibold ${
                  activeTab === "stack" ? "text-white" : "text-slate-400"
                }`}
              >
                Technologies
              </Text>
            </TouchableOpacity>
          </View>

          {/* Tab Content */}
          {activeTab === "features" ? (
            <View className="gap-3 mb-6">
              {features.map((item, idx) => (
                <View
                  key={idx}
                  className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex-row items-center justify-between"
                >
                  <View className="flex-1 pr-3">
                    <Text className="text-white font-semibold text-base mb-1">
                      {item.title}
                    </Text>
                    <Text className="text-slate-400 text-xs leading-relaxed">
                      {item.desc}
                    </Text>
                  </View>
                  <View className="px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/30">
                    <Text className="text-indigo-400 text-xs font-semibold">
                      {item.badge}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View className="gap-3 mb-6">
              {stackItems.map((item, idx) => (
                <View
                  key={idx}
                  className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex-row items-center gap-4"
                >
                  <View
                    className={`w-11 h-11 rounded-2xl ${item.color} items-center justify-center`}
                  >
                    <Ionicons name={item.icon} size={22} color="#ffffff" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-white font-semibold text-base mb-0.5">
                      {item.name}
                    </Text>
                    <Text className="text-slate-400 text-xs">
                      {item.description}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Quick Guide */}
          <View className="bg-slate-900/50 rounded-2xl p-5 border border-slate-800/80 mb-6">
            <View className="flex-row items-center gap-2 mb-3">
              <Ionicons name="terminal-outline" size={18} color="#94a3b8" />
              <Text className="text-slate-300 font-semibold text-sm">
                Commandes utiles
              </Text>
            </View>

            <View className="space-y-2">
              <View className="bg-slate-950 px-3.5 py-2.5 rounded-xl border border-slate-800">
                <Text className="text-emerald-400 font-mono text-xs">
                  npm start
                </Text>
                <Text className="text-slate-500 text-[11px] mt-0.5">
                  Lance le serveur de développement Expo (Metro)
                </Text>
              </View>

              <View className="bg-slate-950 px-3.5 py-2.5 rounded-xl border border-slate-800 mt-2">
                <Text className="text-emerald-400 font-mono text-xs">
                  npm run ios | npm run android | npm run web
                </Text>
                <Text className="text-slate-500 text-[11px] mt-0.5">
                  Lance sur simulateur iOS, émulateur Android ou navigateur
                </Text>
              </View>
            </View>
          </View>

          {/* Platform Info Footer */}
          <View className="items-center py-2">
            <Text className="text-slate-600 text-xs">
              Plateforme active : {Platform.OS.toUpperCase()}
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
