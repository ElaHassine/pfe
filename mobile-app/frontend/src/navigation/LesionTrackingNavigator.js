/**
 * Navigation configuration using React Navigation Stack Navigator
 * Screens: PatientSelect → Scan → History
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

// Import screens
import PatientSelectScreen from '../screens/PatientSelectScreen';
import ScanScreen from '../screens/ScanScreen';
import HistoryScreen from '../screens/HistoryScreen';

const Stack = createNativeStackNavigator();

export const LesionTrackingNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: '#f5f5f5' },
          animationEnabled: true,
          cardStyleInterpolator: ({ current, layouts }) => {
            return {
              cardStyle: {
                transform: [
                  {
                    translateX: current.progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [layouts.screen.width, 0],
                    }),
                  },
                ],
              },
            };
          },
        }}
      >
        {/* Home: Select Patient */}
        <Stack.Screen
          name="PatientSelect"
          component={PatientSelectScreen}
          options={{
            title: 'Lesion Tracking',
          }}
        />

        {/* Scan Screen */}
        <Stack.Screen
          name="Scan"
          component={ScanScreen}
          options={{
            title: 'Lesion Scan',
          }}
        />

        {/* History Screen */}
        <Stack.Screen
          name="History"
          component={HistoryScreen}
          options={{
            title: 'Scan History',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default LesionTrackingNavigator;
