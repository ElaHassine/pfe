import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import ActivityListScreen from '../components/ActivityListScreen';
import { Colors, Type, Space, Radius, Shadow, HIT } from '../theme';
import { Button } from '../components';
import { patientApi } from '../services/api';

const tabs = [
  { key: 'appointments', label: 'My Appointments', icon: 'calendar' },
];

function getAppointmentId(item) {
  return String(item?.id || item?._id || item?.bookingRequestId || item?.requestId || '').trim();
}

function loadSource(activity) {
  return {
    appointments: activity.appointments || [],
  };
}

function mapItem(item) {
  return {
    ...item,
    _sortDate: item.scheduledAt || item.createdAt,
  };
}

function AppointmentCard({ item, onCancelSuccess }) {
  const [isCanceling, setIsCanceling] = useState(false);
  const statusNormalized = String(item.status || '').toLowerCase();
  const isScheduled = ['scheduled', 'accepted'].includes(statusNormalized) || !statusNormalized;
  const appointmentId = getAppointmentId(item);

  const executeCancel = useCallback(async () => {
    try {
      setIsCanceling(true);
      await patientApi.cancelAppointment(appointmentId);
      Alert.alert('Appointment canceled', 'Your appointment has been canceled.');
      onCancelSuccess?.(appointmentId);
    } catch (error) {
      Alert.alert('Cancel failed', error?.message || 'Could not cancel the appointment.');
    } finally {
      setIsCanceling(false);
    }
  }, [appointmentId, onCancelSuccess]);

  const handleCancel = useCallback(() => {
    if (!appointmentId) {
      Alert.alert('Cancel failed', 'Appointment ID is missing. Please refresh and try again.');
      return;
    }

    Alert.alert('Cancel appointment', 'Are you sure you want to cancel this appointment?', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel',
        style: 'destructive',
        onPress: () => {
          void executeCancel();
        },
      },
    ]);
  }, [appointmentId, executeCancel]);

  return (
    <View style={[s.appointmentCard, Shadow.sm]}>
      <View style={s.appointmentCardTop}>
        <View style={{ flex: 1 }}>
          <Text style={s.doctorName}>{item.doctorName || 'Doctor'}</Text>
          <Text style={s.specialty}>{item.specialty || 'Dermatology'}</Text>
        </View>
        <Text style={s.dateTime}>
          {item.scheduledAt
            ? new Date(item.scheduledAt).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            : 'Date pending'}
        </Text>
      </View>

      <View style={s.appointmentCardBottom}>
        {item.location && (
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: Space.s4 }}>
            <Feather name="map-pin" size={12} color={Colors.textMuted} />
            <Text style={s.location}>{item.location}</Text>
          </View>
        )}
        {isScheduled && (
          <View style={s.appointmentCancelButton}>
            <Button
              label={isCanceling ? 'Cancelling...' : 'Cancel'}
              variant="outline"
              size="sm"
              onPress={handleCancel}
              disabled={isCanceling}
            />
          </View>
        )}
      </View>
    </View>
  );
}

export default function PatientAppointmentsActivityScreen({ navigation }) {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleCancelSuccess = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  return (
    <ActivityListScreen
      key={refreshKey}
      navigation={navigation}
      title="Appointments Activity"
      dataKey="appointments"
      tabs={tabs}
      kind="appointment"
      loadSource={loadSource}
      emptyIcon="calendar"
      emptyText="Your appointments will appear here when available."
      sectionLabel="My Appointments"
      headerIcon="calendar"
      mapItem={mapItem}
      renderItem={(item) => <AppointmentCard key={getAppointmentId(item)} item={item} onCancelSuccess={handleCancelSuccess} />}
    />
  );
}

const s = StyleSheet.create({
  appointmentCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Space.s12,
    marginBottom: Space.s10,
  },
  appointmentCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Space.s8,
  },
  doctorName: {
    ...Type.d4,
    color: Colors.textOnLight,
    marginBottom: 2,
  },
  specialty: {
    ...Type.b3,
    color: Colors.textMuted,
  },
  location: {
    ...Type.b3,
    color: Colors.textMuted,
  },
  statusBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateTime: {
    ...Type.b2,
    color: Colors.textOnLight,
    textAlign: 'right',
    maxWidth: 140,
  },
  appointmentCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.s6,
    marginTop: Space.s8,
  },
  appointmentCancelButton: {
    marginLeft: Space.s4,
  },
});
