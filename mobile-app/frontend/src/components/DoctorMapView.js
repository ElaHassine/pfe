import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { Colors, Type, Space } from '../theme';

export default function DoctorMapView({ height = 250, title = 'Map preview', subtitle = 'Google Maps native view is available on iOS and Android builds.' }) {
  return (
    <LinearGradient colors={['#E8FFFB', '#F4FFFE']} style={[styles.map, { height }]}> 
      <View style={styles.hint}>
        <Feather name="map" size={22} color={Colors.primary} />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>{subtitle}</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  map: { width: '100%' },
  hint: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.s8,
    paddingHorizontal: Space.s20,
  },
  title: { ...Type.l1, color: Colors.textOnLight },
  sub: { ...Type.b3, color: Colors.textMuted, textAlign: 'center' },
});
