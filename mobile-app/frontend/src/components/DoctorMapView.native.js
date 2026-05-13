import React from 'react';
import { View, StyleSheet, Text, Platform } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Feather } from '@expo/vector-icons';
import { Colors, Type, Space, Radius, Shadow } from '../theme';

export default function DoctorMapView({
  pins = [],
  selectedId,
  onSelectPin,
  height = 250,
  interactive = true,
  title = 'Map preview',
  subtitle = '',
}) {
  const fallback = { latitude: 37.7749, longitude: -122.4194 };
  const selected = pins.find((pin) => pin.id === selectedId);
  const coordinate = selected?.coordinate || pins[0]?.coordinate || fallback;
  const latitude = Number(coordinate?.latitude) || fallback.latitude;
  const longitude = Number(coordinate?.longitude) || fallback.longitude;
  const mapProvider = Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined;

  if (!interactive) {
    const hasCoordinate = Number.isFinite(latitude) && Number.isFinite(longitude);

    return (
      <View style={[styles.previewWrap, { height }]}> 
        <MapView
          provider={mapProvider}
          style={styles.map}
          region={{
            latitude,
            longitude,
            latitudeDelta: 0.022,
            longitudeDelta: 0.022,
          }}
          scrollEnabled={false}
          zoomEnabled={false}
          pitchEnabled={false}
          rotateEnabled={false}
          toolbarEnabled={false}
          showsUserLocation={false}
          showsMyLocationButton={false}
        >
          {hasCoordinate && (
            <Marker coordinate={{ latitude, longitude }}>
              <View style={styles.pinDot}>
                <Feather name="map-pin" size={16} color={Colors.primaryOnDark} />
              </View>
            </Marker>
          )}
        </MapView>
        <View style={styles.previewOverlay} pointerEvents="none">
          <View style={styles.previewTag}>
            <Text style={styles.previewTitle} numberOfLines={1}>{title}</Text>
            {!!subtitle && (
              <Text style={styles.previewSubtitle} numberOfLines={2}>
                {subtitle}
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  }

  return (
    <MapView
      provider={mapProvider}
      style={[styles.map, { height }]}
      initialRegion={{
        latitude,
        longitude,
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
  map: {
    width: '100%',
  },
  previewWrap: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: Radius.lg,
    backgroundColor: Colors.grey100,
  },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    padding: Space.s12,
  },
  previewTag: {
    maxWidth: '82%',
    paddingVertical: Space.s6,
    paddingHorizontal: Space.s10,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  previewCard: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Space.s16,
    gap: Space.s8,
    backgroundColor: Colors.grey100,
  },
  previewPin: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    padding: Space.s12,
  },
  previewTag: {
    maxWidth: '82%',
    paddingVertical: Space.s6,
    paddingHorizontal: Space.s10,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  previewTitle: {
    ...Type.l1,
    color: Colors.textOnLight,
    textAlign: 'center',
  },
  previewSubtitle: {
    ...Type.b3,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  pinDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: Colors.textPrimary,
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
