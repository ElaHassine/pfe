import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { doctorPortalApi } from '../services/api';

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const STEP_MINUTES = 15;
const TIME_OPTIONS = Array.from({ length: (24 * 60) / STEP_MINUTES }, (_, index) => {
  const total = index * STEP_MINUTES;
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  return {
    value: total,
    label: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
  };
});

function getMonthTitle(date) {
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function dateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isSameDay(a, b) {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function buildCalendarDays(monthAnchor) {
  const year = monthAnchor.getFullYear();
  const month = monthAnchor.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const days = [];

  for (let i = 0; i < first.getDay(); i += 1) {
    days.push(null);
  }

  for (let day = 1; day <= last.getDate(); day += 1) {
    days.push(new Date(year, month, day));
  }

  while (days.length % 7 !== 0) {
    days.push(null);
  }

  return days;
}

function formatDateTime(value) {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '-';
  return dt.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toDateTime(dateValue, totalMinutes) {
  const date = new Date(dateValue);
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute, 0, 0);
}

function nextQuarterMinutes() {
  const now = new Date();
  const rounded = Math.ceil((now.getHours() * 60 + now.getMinutes()) / STEP_MINUTES) * STEP_MINUTES;
  return Math.min(rounded, 24 * 60 - STEP_MINUTES);
}

export default function CalendarScreen() {
  const [monthAnchor, setMonthAnchor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [appointments, setAppointments] = useState([]);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState('');
  const [detailsDraft, setDetailsDraft] = useState('');
  const [statusDraft, setStatusDraft] = useState('scheduled');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createPatientName, setCreatePatientName] = useState('');
  const [createTitle, setCreateTitle] = useState('Consultation');
  const [createTimeMinutes, setCreateTimeMinutes] = useState(nextQuarterMinutes());
  const [createDetails, setCreateDetails] = useState('');
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState('');

  const loadAppointments = async () => {
    setLoading(true);
    try {
      const result = await doctorPortalApi.listAppointments();
      const list = result?.appointments || [];
      setAppointments(list);
      if (!selectedAppointmentId && list.length) {
        setSelectedAppointmentId(String(list[0].id));
      }
    } catch (_error) {
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const calendarDays = useMemo(() => buildCalendarDays(monthAnchor), [monthAnchor]);

  const appointmentsByDate = useMemo(() => {
    const map = new Map();
    appointments.forEach((item) => {
      const key = dateKey(item.scheduledAt);
      const list = map.get(key) || [];
      list.push(item);
      map.set(key, list);
    });
    return map;
  }, [appointments]);

  const selectedDayAppointments = useMemo(() => {
    const key = dateKey(selectedDate);
    return (appointmentsByDate.get(key) || []).slice().sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
  }, [appointmentsByDate, selectedDate]);

  const selectedAppointment = useMemo(() => {
    const exact = appointments.find((item) => String(item.id) === String(selectedAppointmentId));
    if (exact) return exact;
    return selectedDayAppointments[0] || null;
  }, [appointments, selectedAppointmentId, selectedDayAppointments]);

  useEffect(() => {
    if (selectedAppointment) {
      setDetailsDraft(selectedAppointment.details || '');
      setStatusDraft(selectedAppointment.status || 'scheduled');
    } else {
      setDetailsDraft('');
      setStatusDraft('scheduled');
    }
  }, [selectedAppointment]);

  const onCreateAppointment = async () => {
    if (!createPatientName.trim()) {
      setCreateError('Patient name is required');
      return;
    }
    if (!createTitle.trim()) {
      setCreateError('Appointment title is required');
      return;
    }

    try {
      setCreateBusy(true);
      setCreateError('');
      const when = toDateTime(selectedDate, createTimeMinutes);
      await doctorPortalApi.createAppointment({
        patientName: createPatientName.trim(),
        title: createTitle.trim(),
        scheduledAt: when.toISOString(),
        details: createDetails.trim(),
      });
      setIsCreateModalOpen(false);
      setCreatePatientName('');
      setCreateTitle('Consultation');
      setCreateTimeMinutes(nextQuarterMinutes());
      setCreateDetails('');
      await loadAppointments();
    } catch (error) {
      setCreateError(error?.message || 'Unable to create appointment');
    } finally {
      setCreateBusy(false);
    }
  };

  const onSaveDetails = async () => {
    if (!selectedAppointment?.id) return;
    try {
      setSaving(true);
      await doctorPortalApi.updateAppointmentDetails(selectedAppointment.id, {
        details: detailsDraft,
        status: statusDraft,
      });
      await loadAppointments();
    } catch (_error) {
      // Keep UI responsive even on transient save failures.
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#F6F8FB' }}
      contentContainerStyle={{ padding: 20, paddingBottom: 36 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <View>
          <Text style={{ fontFamily: 'Sora_700Bold', fontSize: 24, color: '#1A2235' }}>Calendar</Text>
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#6B7A99', marginTop: 3 }}>View every appointment and update visit details.</Text>
        </View>
        <TouchableOpacity
          onPress={() => setIsCreateModalOpen(true)}
          activeOpacity={0.85}
          style={{ backgroundColor: '#00C2B2', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 6 }}
        >
          <Feather name="plus" size={14} color="#050E1F" />
          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: '#050E1F' }}>Add appointment</Text>
        </TouchableOpacity>
      </View>

      <View style={{ backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#E9EEF6', padding: 14, marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <TouchableOpacity onPress={() => setMonthAnchor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#F6F8FB', alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="chevron-left" size={16} color="#3A4560" />
          </TouchableOpacity>
          <Text style={{ fontFamily: 'Sora_600SemiBold', fontSize: 15, color: '#1A2235' }}>{getMonthTitle(monthAnchor)}</Text>
          <TouchableOpacity onPress={() => setMonthAnchor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#F6F8FB', alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="chevron-right" size={16} color="#3A4560" />
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {WEEK_DAYS.map((weekday) => (
            <View key={weekday} style={{ width: '14.285%', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 11, color: '#99A6BC' }}>{weekday}</Text>
            </View>
          ))}
          {calendarDays.map((day, index) => {
            if (!day) {
              return <View key={`blank-${index}`} style={{ width: '14.285%', height: 36, marginBottom: 6 }} />;
            }

            const isSelected = isSameDay(day, selectedDate);
            const count = appointmentsByDate.get(dateKey(day))?.length || 0;

            return (
              <View key={day.toISOString()} style={{ width: '14.285%', alignItems: 'center', marginBottom: 6 }}>
                <TouchableOpacity
                  onPress={() => setSelectedDate(day)}
                  activeOpacity={0.85}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    overflow: 'hidden',
                  }}
                >
                  {count > 0 ? (
                    <LinearGradient
                      colors={isSelected ? ['#00C2B2', '#7FE8CF'] : ['#D7F9EC', '#9AEED3']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: '#07352E' }}>{day.getDate()}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: isSelected ? '#00C2B2' : '#F6F8FB' }}>
                      <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: isSelected ? '#050E1F' : '#1A2235' }}>{day.getDate()}</Text>
                    </View>
                  )}
                </TouchableOpacity>
                {!!count && (
                  <View style={{ marginTop: 2, minWidth: 16, borderRadius: 8, backgroundColor: '#0D2147', paddingHorizontal: 4, alignItems: 'center' }}>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 9, color: '#fff' }}>{count}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </View>

      <View style={{ backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#E9EEF6', padding: 14, marginBottom: 14 }}>
        <Text style={{ fontFamily: 'Sora_600SemiBold', fontSize: 15, color: '#1A2235', marginBottom: 10 }}>
          Appointments on {selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
        </Text>
        {loading ? (
          <ActivityIndicator color="#00C2B2" />
        ) : selectedDayAppointments.length === 0 ? (
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#6B7A99' }}>No appointments for this day.</Text>
        ) : (
          selectedDayAppointments.map((item) => {
            const isActive = String(selectedAppointment?.id || '') === String(item.id);
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => setSelectedAppointmentId(String(item.id))}
                activeOpacity={0.85}
                style={{
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: isActive ? 'rgba(0,194,178,0.45)' : '#E8EDF5',
                  backgroundColor: isActive ? 'rgba(0,194,178,0.08)' : '#fff',
                  padding: 11,
                  marginBottom: 8,
                }}
              >
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: '#1A2235' }}>{item.title}</Text>
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#3A4560', marginTop: 2 }}>
                  {item.patientName} • {new Date(item.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      <View style={{ backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#E9EEF6', padding: 14 }}>
        <Text style={{ fontFamily: 'Sora_600SemiBold', fontSize: 15, color: '#1A2235', marginBottom: 10 }}>Appointment details</Text>
        {!selectedAppointment ? (
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#6B7A99' }}>Select an appointment to view and edit details.</Text>
        ) : (
          <>
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: '#1A2235' }}>{selectedAppointment.patientName}</Text>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#3A4560', marginTop: 2 }}>{formatDateTime(selectedAppointment.scheduledAt)}</Text>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, marginBottom: 10 }}>
              {['scheduled', 'completed', 'cancelled'].map((status) => {
                const active = statusDraft === status;
                return (
                  <TouchableOpacity
                    key={status}
                    onPress={() => setStatusDraft(status)}
                    style={{
                      borderRadius: 999,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      backgroundColor: active ? 'rgba(0,194,178,0.16)' : '#F6F8FB',
                    }}
                  >
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 11, color: active ? '#00A697' : '#6B7A99' }}>{status}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: '#3A4560', marginBottom: 6 }}>Details / Notes</Text>
            <TextInput
              value={detailsDraft}
              onChangeText={setDetailsDraft}
              multiline
              textAlignVertical="top"
              placeholder="Write follow-up notes, prep instructions, or anything useful."
              placeholderTextColor="#A8B4CC"
              style={{
                minHeight: 96,
                borderWidth: 1,
                borderColor: '#D9E0ED',
                borderRadius: 12,
                backgroundColor: '#fff',
                paddingHorizontal: 12,
                paddingVertical: 10,
                fontFamily: 'DMSans_400Regular',
                fontSize: 13,
                color: '#1A2235',
              }}
            />

            <TouchableOpacity
              onPress={onSaveDetails}
              disabled={saving}
              activeOpacity={0.85}
              style={{ marginTop: 12, alignSelf: 'flex-start', backgroundColor: '#00C2B2', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 }}
            >
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: '#050E1F' }}>{saving ? 'Saving...' : 'Save details'}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <Modal
        visible={isCreateModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCreateModalOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(5,14,31,0.45)', justifyContent: 'center', paddingHorizontal: 18 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 14 }}>
            <Text style={{ fontFamily: 'Sora_600SemiBold', fontSize: 16, color: '#1A2235' }}>Add appointment</Text>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#6B7A99', marginTop: 4 }}>Creates an appointment on {selectedDate.toDateString()}.</Text>

            <View style={{ marginTop: 10 }}>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: '#3A4560', marginBottom: 5 }}>Patient</Text>
              <TextInput
                value={createPatientName}
                onChangeText={setCreatePatientName}
                placeholder="Patient name"
                placeholderTextColor="#A8B4CC"
                style={{ borderWidth: 1, borderColor: '#D9E0ED', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#1A2235' }}
              />
            </View>

            <View style={{ marginTop: 10 }}>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: '#3A4560', marginBottom: 5 }}>Title</Text>
              <TextInput
                value={createTitle}
                onChangeText={setCreateTitle}
                placeholder="Appointment title"
                placeholderTextColor="#A8B4CC"
                style={{ borderWidth: 1, borderColor: '#D9E0ED', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#1A2235' }}
              />
            </View>

            <View style={{ marginTop: 10 }}>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: '#3A4560', marginBottom: 5 }}>Time</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {TIME_OPTIONS.map((option) => {
                  const active = createTimeMinutes === option.value;
                  return (
                    <TouchableOpacity
                      key={`create-time-${option.value}`}
                      onPress={() => setCreateTimeMinutes(option.value)}
                      style={{
                        borderRadius: 999,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        backgroundColor: active ? 'rgba(0,194,178,0.16)' : '#F6F8FB',
                      }}
                    >
                      <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 11, color: active ? '#00A697' : '#6B7A99' }}>{option.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View style={{ marginTop: 10 }}>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: '#3A4560', marginBottom: 5 }}>Details (optional)</Text>
              <TextInput
                value={createDetails}
                onChangeText={setCreateDetails}
                multiline
                textAlignVertical="top"
                placeholder="Any details"
                placeholderTextColor="#A8B4CC"
                style={{ minHeight: 70, borderWidth: 1, borderColor: '#D9E0ED', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#1A2235' }}
              />
            </View>

            {!!createError && <Text style={{ marginTop: 8, fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#FF4757' }}>{createError}</Text>}

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <TouchableOpacity
                onPress={() => setIsCreateModalOpen(false)}
                style={{ borderRadius: 999, borderWidth: 1, borderColor: '#D9E0ED', paddingHorizontal: 12, paddingVertical: 7 }}
              >
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: '#6B7A99' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onCreateAppointment}
                disabled={createBusy}
                style={{ borderRadius: 999, backgroundColor: '#00C2B2', paddingHorizontal: 12, paddingVertical: 7 }}
              >
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: '#050E1F' }}>{createBusy ? 'Creating...' : 'Create'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
