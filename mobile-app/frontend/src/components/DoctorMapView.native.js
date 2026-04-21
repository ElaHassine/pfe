import React from 'react';
import { View, StyleSheet } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../theme';

export default function DoctorMapView({ pins = [], selectedId, onSelectPin, height = 250 }) {
  const fallback = { latitude: 37.7749, longitude: -122.4194 };
  const selected = pins.find((pin) => pin.id === selectedId);

  return (
    <MapView
      provider={PROVIDER_GOOGLE}
      style={[styles.map, { height }]}
      initialRegion={{
        latitude: selected?.coordinate?.latitude || fallback.latitude,
        longitude: selected?.coordinate?.longitude || fallback.longitude,
        latitudeDelta: 0.055,
        longitudeDelta: 0.055,
      }}
      showsUserLocation={false}
      showsMyLocationButton={false}
    >
      {pins.map((pin) => {
        const isActive = pin.id === selectedId;
        return (
          <Marker
            key={pin.id}
            coordinate={pin.coordinate || fallback}
            onPress={() => onSelectPin?.(pin.id)}
          >
            <View style={[styles.pinDot, isActive && styles.pinDotActive]}>
              <Feather
                name="map-pin"
                size={isActive ? 16 : 14}
                color={isActive ? Colors.primaryOnDark : Colors.primary}
              />
            </View>
          </Marker>
        );
      })}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { width: '100%' },
  pinDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.bgCard,
    borderWidth: 1.5,
    borderColor: Colors.primary + '66',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinDotActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
  },
});
