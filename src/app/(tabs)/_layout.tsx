import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View,Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '../../store/AppStore';
import { C } from '../../components/ui';
const names:any={index:'Accueil',tracking:'Suivi',alerts:'Alertes',account:'Compte'};
export default function TabLayout(){const {notifications}=useAppStore();const insets=useSafeAreaInsets();const count=notifications.filter(n=>!n.read).length;const bottomSpace=Math.max(insets.bottom,6);return <Tabs screenOptions={({route})=>({headerShown:false,tabBarActiveTintColor:C.blue,tabBarInactiveTintColor:'#8395A3',tabBarStyle:{height:64+bottomSpace,paddingTop:6,paddingBottom:bottomSpace,borderTopColor:C.line,backgroundColor:'#fff'},tabBarLabelStyle:{fontSize:11,fontWeight:'700'},tabBarIcon:({color,focused})=>{const icon:any={index:focused?'home':'home-outline',tracking:focused?'reader':'reader-outline',alerts:focused?'notifications':'notifications-outline',account:focused?'person':'person-outline'};return <View>{<Ionicons name={icon[route.name]} size={21} color={typeof color==='string'?color:C.muted}/ >}{route.name==='alerts'&&count>0?<View style={{position:'absolute',right:-7,top:-5,backgroundColor:'#D9485F',borderRadius:7,minWidth:14,height:14,alignItems:'center',justifyContent:'center'}}><Text style={{color:'#fff',fontSize:9,fontWeight:'800'}}>{count}</Text></View>:null}</View>},tabBarLabel:names[route.name]})}><Tabs.Screen name="index"/><Tabs.Screen name="tracking"/><Tabs.Screen name="alerts"/><Tabs.Screen name="account"/></Tabs>}
