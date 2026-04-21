import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  useWindowDimensions,
  Modal,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { riskCfg } from '../services/data';
import { doctorPortalApi } from '../services/api';

// ─── Shared card wrapper ──────────────────────────────────────────────────────
const Card = ({ children, style }) => (
  <View style={[{
    backgroundColor: '#fff', borderRadius: 16,
    padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 10, elevation: 3,
  }, style]}>
    {children}
  </View>
);

// ─── Stat tile ────────────────────────────────────────────────────────────────
const StatTile = ({ icon, label, value, color, bg, delta }) => (
  <Card style={{ flex: 1, minWidth: 140 }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
      <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
        <Feather name={icon} size={20} color={color} />
      </View>
      {delta && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: delta > 0 ? 'rgba(0,196,140,0.1)' : 'rgba(255,71,87,0.1)', borderRadius: 99, paddingHorizontal: 7, paddingVertical: 3 }}>
          <Feather name={delta > 0 ? 'trending-up' : 'trending-down'} size={11} color={delta > 0 ? '#00C48C' : '#FF4757'} />
          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 11, color: delta > 0 ? '#00C48C' : '#FF4757' }}>{Math.abs(delta)}%</Text>
        </View>
      )}
    </View>
    <Text style={{ fontFamily: 'Sora_700Bold', fontSize: 26, color: '#1A2235', marginBottom: 4 }}>{value}</Text>
    <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#6B7A99' }}>{label}</Text>
  </Card>
);

// ─── Risk badge ───────────────────────────────────────────────────────────────
const RiskPill = ({ level }) => {
  const cfg = riskCfg(level);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: cfg.bg, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 4, borderWidth: 1, borderColor: cfg.border }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: cfg.color }} />
      <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 11, color: cfg.color }}>{cfg.label}</Text>
    </View>
  );
};

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TIME_STEP_MINUTES = 15;
const TIME_OPTIONS = Array.from({ length: (24 * 60) / TIME_STEP_MINUTES }, (_, index) => {
  const totalMinutes = index * TIME_STEP_MINUTES;
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return {
    label: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    value: totalMinutes,
  };
});

function getMonthTitle(date) {
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function buildCalendarDays(monthAnchor) {
  const year = monthAnchor.getFullYear();
  const month = monthAnchor.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const prefix = firstDay.getDay();

  const cells = [];
  for (let i = 0; i < prefix; i += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    cells.push(new Date(year, month, day));
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
}

function isSameDay(a, b) {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function formatSuggestedDateTime(value) {
  return value.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getCurrentSlotMinutes() {
  const now = new Date();
  const rounded = Math.ceil((now.getHours() * 60 + now.getMinutes()) / TIME_STEP_MINUTES) * TIME_STEP_MINUTES;
  return Math.min(rounded, 24 * 60 - TIME_STEP_MINUTES);
}

function getProfileCompletion(doctor) {
  const items = [
    { label: 'Full name', complete: !!doctor?.profile?.fullName },
    { label: 'Email address', complete: !!doctor?.email },
    { label: 'Phone number', complete: !!doctor?.profile?.phone },
    { label: 'Cabinet location', complete: !!doctor?.profile?.location },
    { label: 'Professional proof', complete: !!doctor?.credentials?.proofUrl },
    { label: 'Specialty / domain', complete: !!doctor?.specialty },
  ];

  const completed = items.filter((item) => item.complete).length;
  const percent = Math.round((completed / items.length) * 100);
  return { percent, items };
}

export default function DashboardScreen({ navigate, doctor }) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1280;
  const isTablet  = width >= 768;

  const [dashboard, setDashboard] = useState({ stats: { totalPatients: 0, avgResponseTime: '0h', satisfaction: '0%' }, pendingCases: [], reviewedCases: [], patients: [] });
  const [notifications, setNotifications] = useState([]);
  const [bookingBusyId, setBookingBusyId] = useState('');
  const [isSuggestModalVisible, setIsSuggestModalVisible] = useState(false);
  const [activeBooking, setActiveBooking] = useState(null);
  const [suggestedDate, setSuggestedDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  });
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedTimeMinutes, setSelectedTimeMinutes] = useState(() => getCurrentSlotMinutes());
  const [isTimeDropdownOpen, setIsTimeDropdownOpen] = useState(false);
  const [doctorNote, setDoctorNote] = useState('');
  const [suggestBusy, setSuggestBusy] = useState(false);
  const [suggestError, setSuggestError] = useState('');
  const firstName = doctor?.profile?.firstName || (doctor?.profile?.fullName || '').replace(/^Dr\.?\s*/i, '').split(' ')[0] || 'Doctor';
  const profileCompletion = getProfileCompletion(doctor);
  const missingItems = profileCompletion.items.filter((item) => !item.complete);

  useEffect(() => {
    let mounted = true;
    doctorPortalApi.getDashboard().then((data) => {
      if (mounted) setDashboard(data);
    }).catch(() => {
      if (mounted) setDashboard({ stats: { totalPatients: 0, avgResponseTime: '0h', satisfaction: '0%' }, pendingCases: [], reviewedCases: [], patients: [] });
    });
    doctorPortalApi.getNotifications().then((data) => {
      if (mounted) setNotifications(data.notifications || []);
    }).catch(() => {
      if (mounted) setNotifications([]);
    });
    return () => { mounted = false; };
  }, []);

  const pending = dashboard.pendingCases || [];
  const highRisk = pending.filter(c => c.riskLevel === 'high');
  const reviewed = dashboard.reviewedCases || [];
  const totalPatients = dashboard.stats?.totalPatients || 0;
  const bookingRequests = notifications.filter((item) => item.type === 'booking-request' && ['pending', 'accepted', 'suggested', 'declined'].includes(String(item.status || '').toLowerCase()));
  const pendingCasesCount = dashboard.stats?.pendingCases ?? pending.length;
  const highRiskPendingCount = dashboard.stats?.highRiskPending ?? highRisk.length;
  const reviewedTodayCount = dashboard.stats?.reviewedToday ?? reviewed.filter((item) => {
    const reviewedAt = item.reviewedAt || item.scanDate;
    if (!reviewedAt) return false;
    return new Date(reviewedAt).toDateString() === new Date().toDateString();
  }).length;
  const casesThisWeek = [...pending, ...reviewed].filter((item) => {
    const referenceDate = item.reviewedAt || item.scanDate;
    if (!referenceDate) return false;
    const date = new Date(referenceDate);
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - 6);
    return date >= weekStart;
  }).length;

  const STATS = [
    { icon: 'clock',        label: 'Pending Cases', value: pendingCasesCount,   color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
    { icon: 'alert-circle', label: 'High Risk',     value: highRiskPendingCount, color: '#FF4757', bg: 'rgba(255,71,87,0.12)' },
    { icon: 'check-circle', label: 'Reviewed Today', value: reviewedTodayCount,  color: '#00C48C', bg: 'rgba(0,196,140,0.12)' },
    { icon: 'users',        label: 'Total Patients', value: totalPatients,       color: '#00C2B2', bg: 'rgba(0,194,178,0.12)' },
  ];

  const openSuggestModal = (request) => {
    const now = new Date();
    const defaultDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    setActiveBooking(request);
    setSuggestedDate(defaultDate);
    setCalendarMonth(new Date(defaultDate.getFullYear(), defaultDate.getMonth(), 1));
    setSelectedTimeMinutes(getCurrentSlotMinutes());
    setIsTimeDropdownOpen(false);
    setDoctorNote('');
    setSuggestError('');
    setIsSuggestModalVisible(true);
  };

  const closeSuggestModal = () => {
    if (suggestBusy) return;
    setIsSuggestModalVisible(false);
    setActiveBooking(null);
    setIsTimeDropdownOpen(false);
    setDoctorNote('');
    setSuggestError('');
  };

  const submitSuggestion = async () => {
    if (!activeBooking?.id) {
      setSuggestError('Booking request not found.');
      return;
    }

    const bookingDateTime = new Date(
      suggestedDate.getFullYear(),
      suggestedDate.getMonth(),
      suggestedDate.getDate(),
      Math.floor(selectedTimeMinutes / 60),
      selectedTimeMinutes % 60,
      0,
      0
    );

    if (bookingDateTime.getTime() < Date.now()) {
      setSuggestError('Please choose a future date and time.');
      return;
    }

    try {
      setSuggestBusy(true);
      setSuggestError('');
      await doctorPortalApi.suggestBookingTime(
        activeBooking.id,
        formatSuggestedDateTime(bookingDateTime),
        doctorNote.trim(),
        bookingDateTime.toISOString()
      );
      const refreshed = await doctorPortalApi.getNotifications();
      setNotifications(refreshed.notifications || []);
      setIsSuggestModalVisible(false);
      setActiveBooking(null);
      setDoctorNote('');
    } catch (error) {
      setSuggestError(error?.message || 'Unable to suggest this time right now.');
    } finally {
      setSuggestBusy(false);
    }
  };

  const calendarDays = buildCalendarDays(calendarMonth);

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: '#F6F8FB' }}
        contentContainerStyle={{ padding: isTablet ? 32 : 16, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
      {/* Page header */}
      <View style={{ marginBottom: 28 }}>
        <Text style={{ fontFamily: 'Sora_700Bold', fontSize: isTablet ? 28 : 22, color: '#1A2235', marginBottom: 4 }}>
          Good morning, Dr. {firstName} 👋
        </Text>
        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#6B7A99' }}>
          You have {highRiskPendingCount} high-priority case{highRiskPendingCount !== 1 ? 's' : ''} awaiting review.
        </Text>
      </View>

      {/* Profile completion */}
      <Card style={{ marginBottom: 24, borderWidth: 1, borderColor: profileCompletion.percent >= 100 ? 'rgba(0,196,140,0.18)' : 'rgba(0,194,178,0.16)' }}>
        <View style={{ flexDirection: isTablet ? 'row' : 'column', alignItems: isTablet ? 'center' : 'flex-start', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'Sora_600SemiBold', fontSize: 15, color: '#1A2235', marginBottom: 6 }}>
              Profile completion
            </Text>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#6B7A99', lineHeight: 18 }}>
              Complete your doctor profile to build trust and unlock patient-facing booking features.
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontFamily: 'Sora_700Bold', fontSize: 24, color: '#1A2235' }}>{profileCompletion.percent}%</Text>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#6B7A99' }}>{missingItems.length} item{missingItems.length !== 1 ? 's' : ''} left</Text>
          </View>
        </View>

        <View style={{ height: 8, backgroundColor: '#EEF1F6', borderRadius: 999, overflow: 'hidden', marginTop: 16 }}>
          <View style={{ width: `${profileCompletion.percent}%`, height: 8, borderRadius: 999, backgroundColor: profileCompletion.percent >= 100 ? '#00C48C' : '#00C2B2' }} />
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
          {profileCompletion.items.map((item) => (
            <View
              key={item.label}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: item.complete ? 'rgba(0,196,140,0.10)' : 'rgba(255,183,77,0.10)',
              }}
            >
              <Feather name={item.complete ? 'check-circle' : 'alert-circle'} size={12} color={item.complete ? '#00C48C' : '#F59E0B'} />
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 11, color: item.complete ? '#00C48C' : '#F59E0B' }}>{item.label}</Text>
            </View>
          ))}
        </View>

        {missingItems.length > 0 && (
          <View style={{ marginTop: 14 }}>
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: '#3A4560', marginBottom: 8 }}>Finish next</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {missingItems.map((item) => (
                <View key={item.label} style={{ backgroundColor: '#F6F8FB', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
                  <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: '#6B7A99' }}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <TouchableOpacity
          onPress={() => navigate('settings')}
          activeOpacity={0.8}
          style={{ alignSelf: 'flex-start', marginTop: 16, backgroundColor: '#00C2B2', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 }}
        >
          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: '#050E1F' }}>Complete profile</Text>
        </TouchableOpacity>
      </Card>

      {/* Stats grid */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 28 }}>
        {STATS.map((st, i) => (
          <StatTile key={i} {...st} style={{ minWidth: isDesktop ? 0 : isTablet ? '45%' : '47%' }} />
        ))}
      </View>

      {/* Main content row */}
      <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 20 }}>

        {/* Priority cases */}
        <View style={{ flex: isDesktop ? 2 : 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <Text style={{ fontFamily: 'Sora_600SemiBold', fontSize: 16, color: '#1A2235' }}>Priority Cases</Text>
            <TouchableOpacity
              onPress={() => navigate('cases')}
              activeOpacity={0.75}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: '#00C2B2' }}>View all</Text>
              <Feather name="arrow-right" size={13} color="#00C2B2" />
            </TouchableOpacity>
          </View>

          {pending.slice(0, 4).map(c => (
            <TouchableOpacity
              key={c.id}
              onPress={() => navigate('case', { caseData: c })}
              activeOpacity={0.82}
              accessibilityRole="button"
            >
              <Card style={{ marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }}>
                {/* Priority indicator */}
                {c.priority && (
                  <View style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', backgroundColor: '#FF4757', borderTopLeftRadius: 16, borderBottomLeftRadius: 16 }} />
                )}

                {/* Patient avatar */}
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,194,178,0.12)', alignItems: 'center', justifyContent: 'center', marginLeft: c.priority ? 8 : 0 }}>
                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: '#00C2B2' }}>
                    {c.patientName.split(' ').map(n => n[0]).join('')}
                  </Text>
                </View>

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: '#1A2235' }}>{c.patientName}</Text>
                    <RiskPill level={c.riskLevel} />
                  </View>
                  <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#3A4560', marginBottom: 4 }}>{c.lesionType}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Feather name="map-pin" size={11} color="#A8B4CC" />
                      <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#A8B4CC' }}>{c.location}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Feather name="cpu" size={11} color="#A8B4CC" />
                      <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#A8B4CC' }}>{c.confidence}% confidence</Text>
                    </View>
                  </View>
                </View>

                <Feather name="chevron-right" size={16} color="#DDE3EE" />
              </Card>
            </TouchableOpacity>
          ))}
        </View>

        {/* Right column */}
        <View style={{ flex: isDesktop ? 1 : 1, gap: 16 }}>

          {/* Booking notifications */}
          <Card>
            <Text style={{ fontFamily: 'Sora_600SemiBold', fontSize: 15, color: '#1A2235', marginBottom: 16 }}>Booking Notifications</Text>
            {bookingRequests.length === 0 ? (
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#6B7A99' }}>No actionable booking requests.</Text>
            ) : bookingRequests.slice(0, 3).map((request) => {
              const requestStatus = String(request.status || 'pending').toLowerCase();
              const isPending = requestStatus === 'pending';
              const isAccepted = requestStatus === 'accepted';
              const isSuggested = requestStatus === 'suggested';
              const isCancelled = requestStatus === 'declined';

              return (
                <View key={request.id} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0F2F7' }}>
                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: '#1A2235', marginBottom: 3 }}>{request.patientName}</Text>
                  <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#6B7A99', marginBottom: 6 }}>
                    Wants {request.doctorName} · preferred {request.preferredTime || 'next available'}
                  </Text>
                  <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#3A4560', marginBottom: 8 }}>
                    {isSuggested
                      ? `Suggested ${request.suggestedTime || 'a time'}${request.doctorNote ? ` · ${request.doctorNote}` : ''}`
                      : isCancelled
                        ? 'Cancelled by patient'
                      : isAccepted
                        ? 'Accepted. You can now suggest a time.'
                        : 'Waiting for your response'}
                  </Text>
                  <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#3A4560', marginBottom: 8 }}>{request.message}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {isPending && (
                      <>
                        <TouchableOpacity
                          onPress={async () => {
                            try {
                              setBookingBusyId(request.id);
                              await doctorPortalApi.respondBookingRequest(request.id, 'accept');
                              const refreshed = await doctorPortalApi.getNotifications();
                              setNotifications(refreshed.notifications || []);
                            } catch (_error) {
                              // Keep the dashboard responsive even if the update fails.
                            } finally {
                              setBookingBusyId('');
                            }
                          }}
                          disabled={bookingBusyId === request.id}
                          activeOpacity={0.8}
                          style={{ backgroundColor: 'rgba(0,196,140,0.12)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: 'rgba(0,196,140,0.25)' }}
                        >
                          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: '#00C48C' }}>Accept</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={async () => {
                            try {
                              setBookingBusyId(request.id);
                              await doctorPortalApi.respondBookingRequest(request.id, 'decline');
                              const refreshed = await doctorPortalApi.getNotifications();
                              setNotifications(refreshed.notifications || []);
                            } catch (_error) {
                              // Keep the dashboard responsive even if the update fails.
                            } finally {
                              setBookingBusyId('');
                            }
                          }}
                          disabled={bookingBusyId === request.id}
                          activeOpacity={0.8}
                          style={{ backgroundColor: 'rgba(255,71,87,0.12)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: 'rgba(255,71,87,0.25)' }}
                        >
                          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: '#FF4757' }}>Decline</Text>
                        </TouchableOpacity>
                      </>
                    )}
                    {isAccepted && !isSuggested && (
                      <TouchableOpacity
                        onPress={() => openSuggestModal(request)}
                        activeOpacity={0.8}
                        style={{ backgroundColor: '#00C2B2', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 }}
                      >
                        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: '#050E1F' }}>Suggest time</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </Card>

          {/* Performance */}
          <Card>
            <Text style={{ fontFamily: 'Sora_600SemiBold', fontSize: 15, color: '#1A2235', marginBottom: 16 }}>Performance</Text>
            {[
              { label: 'Response Time', value: dashboard.stats?.avgResponseTime || '0h', icon: 'clock',      color: '#00C2B2' },
              { label: 'Satisfaction',  value: dashboard.stats?.satisfaction || '0%',    icon: 'star',        color: '#F59E0B' },
              { label: 'Cases This Week', value: String(casesThisWeek),   icon: 'folder',      color: '#6366F1' },
            ].map((m, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: i < 2 ? 1 : 0, borderBottomColor: '#F0F2F7' }}>
                <View style={{ width: 36, height: 36, borderRadius: 9, backgroundColor: m.color + '18', alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name={m.icon} size={17} color={m.color} />
                </View>
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#6B7A99', flex: 1 }}>{m.label}</Text>
                <Text style={{ fontFamily: 'Sora_700Bold', fontSize: 15, color: '#1A2235' }}>{m.value}</Text>
              </View>
            ))}
          </Card>

          {/* Risk breakdown */}
          <Card>
            <Text style={{ fontFamily: 'Sora_600SemiBold', fontSize: 15, color: '#1A2235', marginBottom: 16 }}>Risk Breakdown</Text>
            {[
              { label: 'High Risk',    count: highRisk.length,                       color: '#FF4757', pct: Math.round(highRisk.length / pending.length * 100) || 0 },
              { label: 'Moderate',     count: pending.filter(c => c.riskLevel === 'medium').length, color: '#F59E0B', pct: Math.round(pending.filter(c => c.riskLevel === 'medium').length / pending.length * 100) || 0 },
              { label: 'Low Risk',     count: pending.filter(c => c.riskLevel === 'low').length,    color: '#00C48C', pct: Math.round(pending.filter(c => c.riskLevel === 'low').length / pending.length * 100) || 0 },
            ].map((r, i) => (
              <View key={i} style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                  <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#6B7A99' }}>{r.label}</Text>
                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: '#1A2235' }}>{r.count} cases</Text>
                </View>
                <View style={{ height: 6, backgroundColor: '#EEF1F6', borderRadius: 3, overflow: 'hidden' }}>
                  <View style={{ height: 6, width: `${r.pct}%`, backgroundColor: r.color, borderRadius: 3 }} />
                </View>
              </View>
            ))}
          </Card>

          {/* Quick actions */}
          <Card>
            <Text style={{ fontFamily: 'Sora_600SemiBold', fontSize: 15, color: '#1A2235', marginBottom: 14 }}>Quick Actions</Text>
            {[
              { icon: 'folder',  label: 'Review pending cases', screen: 'cases',    color: '#00C2B2' },
              { icon: 'users',   label: 'View all patients',    screen: 'patients', color: '#6366F1' },
              { icon: 'message-circle', label: 'Chat',           screen: 'messages',      color: '#00C48C' },
              { icon: 'bell',    label: 'Notifications',         screen: 'notifications', color: '#F59E0B' },
            ].map((a, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => navigate(a.screen)}
                activeOpacity={0.78}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: i < 2 ? 1 : 0, borderBottomColor: '#F0F2F7' }}
              >
                <View style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: a.color + '18', alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name={a.icon} size={16} color={a.color} />
                </View>
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#3A4560', flex: 1 }}>{a.label}</Text>
                <Feather name="chevron-right" size={14} color="#DDE3EE" />
              </TouchableOpacity>
            ))}
          </Card>
        </View>
      </View>
      </ScrollView>

      <Modal
        visible={isSuggestModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeSuggestModal}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(5,14,31,0.45)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 }}>
            <View style={{ width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#EEF1F6', shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 }}>
              <Text style={{ fontFamily: 'Sora_600SemiBold', fontSize: 16, color: '#1A2235' }}>Suggest time</Text>
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#6B7A99', marginTop: 4 }}>
              Pick the exact date and hour for {activeBooking?.patientName || 'the patient'}.
            </Text>

              <View style={{ marginTop: 14, borderWidth: 1, borderColor: '#E8ECF4', borderRadius: 14, padding: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <TouchableOpacity
                  onPress={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                  style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#F5F7FB', alignItems: 'center', justifyContent: 'center' }}
                  activeOpacity={0.8}
                >
                  <Feather name="chevron-left" size={16} color="#3A4560" />
                </TouchableOpacity>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: '#1A2235' }}>{getMonthTitle(calendarMonth)}</Text>
                <TouchableOpacity
                  onPress={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                  style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#F5F7FB', alignItems: 'center', justifyContent: 'center' }}
                  activeOpacity={0.8}
                >
                  <Feather name="chevron-right" size={16} color="#3A4560" />
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {WEEK_DAYS.map((weekday) => (
                  <View key={weekday} style={{ width: '14.285%', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 11, color: '#9AA6BD' }}>{weekday}</Text>
                  </View>
                ))}

                {calendarDays.map((day, index) => {
                  if (!day) {
                    return <View key={`empty-${index}`} style={{ width: '14.285%', height: 36, marginBottom: 6 }} />;
                  }

                  const isPicked = isSameDay(day, suggestedDate);
                  const isPastDay = day.getTime() < new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime();

                  return (
                    <View key={day.toISOString()} style={{ width: '14.285%', alignItems: 'center', marginBottom: 6 }}>
                      <TouchableOpacity
                        onPress={() => {
                          if (isPastDay) return;
                          setSuggestedDate(day);
                        }}
                        disabled={isPastDay}
                        activeOpacity={0.82}
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 15,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: isPicked ? '#00C2B2' : 'transparent',
                          opacity: isPastDay ? 0.35 : 1,
                        }}
                      >
                        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: isPicked ? '#050E1F' : '#3A4560' }}>{day.getDate()}</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            </View>

            <View style={{ marginTop: 12 }}>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: '#3A4560', marginBottom: 8 }}>Time</Text>
              <View style={{ width: 170, alignSelf: 'flex-start', position: 'relative', zIndex: 50, elevation: 50, overflow: 'visible' }}>
                <TouchableOpacity
                  onPress={() => setIsTimeDropdownOpen((prev) => !prev)}
                  activeOpacity={0.85}
                  style={{
                    height: 46,
                    paddingHorizontal: 14,
                    borderWidth: 0,
                    borderRadius: 14,
                    backgroundColor: 'rgba(248,250,255,0.96)',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    shadowColor: '#0D2147',
                    shadowOpacity: 0.08,
                    shadowRadius: 10,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: 2,
                  }}
                >
                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: '#1A2235' }}>
                    {TIME_OPTIONS.find((option) => option.value === selectedTimeMinutes)?.label || '00:00'}
                  </Text>
                  <Feather name={isTimeDropdownOpen ? 'chevron-up' : 'chevron-down'} size={16} color="#6B7A99" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ marginTop: 12, backgroundColor: '#F6F8FB', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: '#3A4560', marginBottom: 4 }}>Selected Slot</Text>
              <Text style={{ fontFamily: 'Sora_600SemiBold', fontSize: 13, color: '#1A2235' }}>
                {formatSuggestedDateTime(new Date(
                  suggestedDate.getFullYear(),
                  suggestedDate.getMonth(),
                  suggestedDate.getDate(),
                  Math.floor(selectedTimeMinutes / 60),
                  selectedTimeMinutes % 60,
                  0,
                  0
                ))}
              </Text>
            </View>

              <View style={{ marginTop: 10 }}>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: '#3A4560', marginBottom: 8 }}>Doctor note (optional)</Text>
              <TextInput
                value={doctorNote}
                onChangeText={setDoctorNote}
                placeholder="Add context for the patient (e.g. please arrive 10 min early)"
                placeholderTextColor="#A8B4CC"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                maxLength={220}
                style={{
                  minHeight: 72,
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
            </View>

            {!!suggestError && (
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#FF4757', marginTop: 8 }}>{suggestError}</Text>
            )}

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                onPress={closeSuggestModal}
                disabled={suggestBusy}
                activeOpacity={0.8}
                style={{ borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: '#D9E0ED', backgroundColor: '#fff' }}
              >
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: '#6B7A99' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={submitSuggestion}
                disabled={suggestBusy}
                activeOpacity={0.8}
                style={{ borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#00C2B2', minWidth: 120, alignItems: 'center' }}
              >
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: '#050E1F' }}>{suggestBusy ? 'Sending...' : 'Send to patient'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isTimeDropdownOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsTimeDropdownOpen(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setIsTimeDropdownOpen(false)}
          style={{ flex: 1, backgroundColor: 'rgba(5,14,31,0.18)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 }}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => {}}
            style={{
              width: 170,
              maxHeight: 240,
              borderRadius: 16,
              backgroundColor: '#FFFFFF',
              overflow: 'hidden',
              shadowColor: '#0D2147',
              shadowOpacity: 0.18,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 10 },
              elevation: 16,
            }}
          >
            <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
              {TIME_OPTIONS.map((option) => {
                const isSelected = option.value === selectedTimeMinutes;
                return (
                  <TouchableOpacity
                    key={`time-${option.value}`}
                    onPress={() => {
                      setSelectedTimeMinutes(option.value);
                      setIsTimeDropdownOpen(false);
                    }}
                    activeOpacity={0.85}
                    style={{
                      minHeight: 40,
                      paddingHorizontal: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: isSelected ? 'rgba(0,194,178,0.10)' : '#fff',
                    }}
                  >
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: '#1A2235' }}>{option.label}</Text>
                    {isSelected && <Feather name="check" size={14} color="#00A697" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}
