import 'react-native-gesture-handler';
import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppStoreProvider } from '../store/AppStore';
export default function RootLayout(){return <AppStoreProvider><StatusBar style="dark"/><Stack screenOptions={{headerShown:false,contentStyle:{backgroundColor:'#F4F8FC'},animation:'slide_from_right'}}><Stack.Screen name="index"/><Stack.Screen name="(tabs)"/><Stack.Screen name="booking/[step]"/><Stack.Screen name="category/[id]"/><Stack.Screen name="auth/[mode]"/><Stack.Screen name="request/[id]"/><Stack.Screen name="offers/[id]"/><Stack.Screen name="technician/[id]"/><Stack.Screen name="appointment/[id]"/><Stack.Screen name="search"/><Stack.Screen name="addresses"/><Stack.Screen name="settings"/><Stack.Screen name="help"/><Stack.Screen name="confirmation/[id]"/></Stack></AppStoreProvider>}
