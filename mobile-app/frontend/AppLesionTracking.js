/**
 * App.js - Updated to integrate Lesion Tracking feature
 * 
 * This shows how to integrate the lesion tracking navigator into your existing app.
 * You can either:
 * 1. Replace the entire app with this if lesion tracking is the main feature
 * 2. Add it as a tab or screen within your existing navigation structure
 * 3. Use conditional navigation based on user role (patient vs doctor)
 * 
 * OPTION 1: Standalone Lesion Tracking App
 * ==========================================
 */

import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts, DMSans_400Regular, DMSans_500Medium } from '@expo-google-fonts/dm-sans';
import { Sora_600SemiBold, Sora_700Bold } from '@expo-google-fonts/sora';

import LesionTrackingNavigator from './src/navigation/LesionTrackingNavigator';

function App() {
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    Sora_600SemiBold,
    Sora_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#007AFF" size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" />
        <LesionTrackingNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default App;

/**
 * OPTION 2: Integrate with existing app structure
 * ================================================
 * 
 * If you already have an AppNavigator with tabs or other screens,
 * you can add LesionTrackingNavigator as one tab or screen:
 * 
 * In your src/navigation/AppNavigator.js or similar:
 * 
 * import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
 * import LesionTrackingNavigator from './LesionTrackingNavigator';
 * 
 * const Tab = createBottomTabNavigator();
 * 
 * export function MainTabs() {
 *   return (
 *     <Tab.Navigator>
 *       <Tab.Screen name="Dashboard" component={DashboardScreen} />
 *       <Tab.Screen 
 *         name="LesionTracking" 
 *         component={LesionTrackingNavigator}
 *         options={{ title: 'Lesion Scan' }}
 *       />
 *       <Tab.Screen name="Profile" component={ProfileScreen} />
 *     </Tab.Navigator>
 *   );
 * }
 * 
 * 
 * OPTION 3: Conditional navigation by user role
 * ==============================================
 * 
 * If you have patients and doctors with different features:
 * 
 * export default function App() {
 *   const { user } = useAuth();
 *   
 *   return (
 *     <GestureHandlerRootView style={{ flex: 1 }}>
 *       <SafeAreaProvider>
 *         <StatusBar barStyle="light-content" />
 *         {user?.role === 'patient' ? (
 *           <LesionTrackingNavigator />
 *         ) : (
 *           <DoctorAppNavigator />
 *         )}
 *       </SafeAreaProvider>
 *     </GestureHandlerRootView>
 *   );
 * }
 */
