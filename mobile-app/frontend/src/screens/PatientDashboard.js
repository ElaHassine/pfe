import React, { useCallback, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Modal,
  Pressable,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Type, Space, Radius, Shadow, HIT, riskConfig } from '../theme';
import { StatCard, ScanCard, SectionHeader, Button, EmptyState } from '../components';
import { scanApi, chatApi, patientApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

const LAST_VIEWED_NOTIFICATIONS_KEY = 'lesio.lastViewedNotifications';

const QUICK_ACTIONS = [
  { icon: 'camera',     label: 'New Scan',   screen: 'LesionScan',          color: Colors.primary,  bg: Colors.primaryDim },
  { icon: 'aperture',   label: 'Scans',      screen: 'PatientScans',        color: '#6366F1',       bg: 'rgba(99,102,241,0.12)' },
  { icon: 'map-pin',    label: 'Doctors',    screen: 'DermatologistFinder', color: '#F59E0B',       bg: 'rgba(245,158,11,0.12)' },
  { icon: 'book-open',  label: 'Learn',      screen: 'SkinEducation',       color: '#00C48C',       bg: 'rgba(0,196,140,0.12)' },
  { icon: 'users',      label: 'Community',  screen: 'Community',           color: '#6366F1',       bg: 'rgba(99,102,241,0.12)' },
];

const FILTERS = ['All', 'High', 'Medium', 'Low'];
const APPOINTMENT_FILTERS = ['All', 'Today', 'This Week', 'This Month'];

function normalizeRiskLevel(level) {
  const normalized = String(level || '').trim().toLowerCase();
  if (normalized === 'moderate') return 'medium';
  if (normalized === 'high' || normalized === 'medium' || normalized === 'low') return normalized;
  return 'low';
}

function parseTimeMs(value) {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function buildInitials(fullName = '', fallback = 'PA') {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return fallback;
  const first = parts[0]?.[0] || '';
  const last = (parts.length > 1 ? parts[parts.length - 1]?.[0] : '') || '';
  const second = last || parts[0]?.[1] || '';
  return `${first}${second}`.toUpperCase();
}

function getAppointmentId(item) {
  return String(item?.id || item?._id || item?.bookingRequestId || item?.requestId || '').trim();
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
            <MaterialCommunityIcons name="pin" size={12} color={Colors.textMuted} />
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

export default function PatientDashboard({ navigation }) {
  const { user, getMySummary, logout, getMyActivity } = useAuth();
  const [filter, setFilter] = useState('All');
  const [appointmentFilter, setAppointmentFilter] = useState('All');
  const [scans, setScans] = useState([]);
  const [isProfileMenuOpen, setProfileMenuOpen] = useState(false);
  const [summary, setSummary] = useState({
    scanCount: 0,
    postCount: 0,
    commentCount: 0,
    likeCount: 0,
  });
  const [appointments, setAppointments] = useState([]);
  const [isBusy, setBusy] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [cancellingAppointmentId, setCancellingAppointmentId] = useState('');

  const loadUnreadChatCount = useCallback(async (mountedRef) => {
    try {
      const response = await chatApi.listThreads();
      if (!mountedRef.current) return;
      
      const totalUnread = (response.threads || []).reduce((sum, thread) => {
        return sum + (thread.unread || 0);
      }, 0);
      
      setUnreadChatCount(totalUnread);
    } catch (_error) {
      if (!mountedRef.current) return;
      setUnreadChatCount(0);
    }
  }, []);

  const openChat = useCallback(() => {
    navigation.navigate('Chat');
  }, [navigation]);

  const loadDashboard = useCallback(async (mountedRef) => {
    setBusy(true);
    try {
      const [scanRes, summaryRes] = await Promise.all([
        scanApi.list(),
        getMySummary(),
      ]);
      const appointmentRes = await patientApi.getAppointments();

      if (!mountedRef.current) return;

      const incomingScans = (scanRes.scans || [])
        .map((scan) => ({
          id: scan._id,
          trackingGroupId: scan.trackingGroupId || scan._id,
          date: scan.createdAt,
          imageUrl: scan.imageUrl,
          location: scan.location,
          riskLevel: normalizeRiskLevel(scan.riskLevel),
          confidence: scan.confidence,
          lesionType: scan.lesionType,
          analysis: scan.analysis,
          notes: scan.notes || '',
          doctorNotes: scan.doctorNotes || '',
          size: scan.sizeMm ? `${scan.sizeMm}mm` : undefined,
        }))
        .sort((a, b) => parseTimeMs(b.date) - parseTimeMs(a.date));

      setScans(incomingScans);
      setSummary({
        scanCount: summaryRes.scanCount || incomingScans.length,
        postCount: summaryRes.postCount || 0,
        commentCount: summaryRes.commentCount || 0,
        likeCount: summaryRes.likeCount || 0,
      });
      setAppointments((appointmentRes?.appointments || []).map((appointment) => ({
        ...appointment,
        id: getAppointmentId(appointment),
      })));
    } catch (_error) {
      if (!mountedRef.current) return;
      setScans([]);
      setAppointments([]);
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }, [getMySummary]);

  const loadUnreadCount = useCallback(async (mountedRef) => {
    try {
      const lastViewedStr = await AsyncStorage.getItem(LAST_VIEWED_NOTIFICATIONS_KEY);
      const lastViewed = lastViewedStr ? Number(lastViewedStr) : 0;
      const events = await getMyActivity();
      
      if (!mountedRef.current) return;
      
      const unread = (events || []).filter(event => {
        const eventTime = new Date(event.createdAt).getTime();
        return eventTime > lastViewed;
      }).length;
      
      setUnreadCount(unread);
    } catch (_error) {
      if (!mountedRef.current) return;
      setUnreadCount(0);
    }
  }, [getMyActivity]);

  useFocusEffect(
    useCallback(() => {
      const mountedRef = { current: true };
      loadDashboard(mountedRef);
      loadUnreadCount(mountedRef);
      loadUnreadChatCount(mountedRef);

      return () => {
        mountedRef.current = false;
      };
    }, [loadDashboard, loadUnreadCount, loadUnreadChatCount])
  );

  const openNotifications = useCallback(async () => {
    await AsyncStorage.setItem(LAST_VIEWED_NOTIFICATIONS_KEY, String(Date.now()));
    setUnreadCount(0);
    navigation.navigate('Notifications');
  }, [navigation]);

  const filtered = useMemo(
    () => {
      if (filter === 'All') return scans;
      const normalizedFilter = String(filter || '').toLowerCase();
      return scans.filter((s) => normalizeRiskLevel(s.riskLevel) === normalizedFilter);
    },
    [filter, scans]
  );

  const visibleScans = useMemo(() => filtered.slice(0, 3), [filtered]);

  const filteredAppointments = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(startOfToday);
    const dayOffset = (startOfWeek.getDay() + 6) % 7;
    startOfWeek.setDate(startOfWeek.getDate() - dayOffset);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    return appointments.filter((appointment) => {
      if (appointmentFilter === 'All') return true;
      if (!appointment.scheduledAt) return false;

      const appointmentDate = new Date(appointment.scheduledAt);
      if (Number.isNaN(appointmentDate.getTime())) return false;

      if (appointmentFilter === 'Today') {
        return appointmentDate >= startOfToday && appointmentDate < new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
      }

      if (appointmentFilter === 'This Week') {
        const nextWeek = new Date(startOfWeek);
        nextWeek.setDate(nextWeek.getDate() + 7);
        return appointmentDate >= startOfWeek && appointmentDate < nextWeek;
      }

      if (appointmentFilter === 'This Month') {
        return appointmentDate >= startOfMonth && appointmentDate < endOfMonth;
      }

      return true;
    });
  }, [appointmentFilter, appointments]);

  const visibleAppointments = useMemo(
    () => filteredAppointments.slice(0, 3),
    [filteredAppointments]
  );

  const highCount = scans.filter((s) => normalizeRiskLevel(s.riskLevel) === 'high').length;
  
  const nextAppointment = useMemo(() => {
    const now = new Date();
    const scheduledAppointments = appointments
      .filter((a) => a.scheduledAt && new Date(a.scheduledAt) > now)
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
    return scheduledAppointments[0] || null;
  }, [appointments]);

  const displayName = user?.profile?.fullName || user?.name || user?.email || 'there';
  const firstName = String(displayName).split(' ')[0] || 'there';
  const profileInitials = buildInitials(displayName, 'PA');
  const currentAvatarUrl = String(user?.profile?.avatarUrl || '').trim();

  const cancelAppointment = useCallback(async (appointmentId) => {
    try {
      setCancellingAppointmentId(String(appointmentId));
      await patientApi.cancelAppointment(appointmentId);
      setAppointments((prev) => prev.filter((appointment) => String(appointment.id) !== String(appointmentId)));
    } catch (error) {
      Alert.alert('Cancel failed', error?.message || 'Could not cancel this appointment right now.');
    } finally {
      setCancellingAppointmentId('');
    }
  }, []);

  const openEditProfile = () => {
    setProfileMenuOpen(false);
    navigation.navigate('PatientProfile');
  };

  const openActivityPage = () => {
    setProfileMenuOpen(false);
    navigation.navigate('PatientActivity');
  };

  const handleLogout = () => {
    setProfileMenuOpen(false);
    Alert.alert('Log out', 'Do you want to log out now?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: () => {
          logout();
          navigation.replace('Landing');
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.grey50 }}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Space.s80 }}>

        {/* ── Header ── */}
        <LinearGradient colors={['#050E1F','#0D2147']} style={s.header}>
          <SafeAreaView edges={['top']}>
            <View style={s.headerTop}>
              <View>
                <Text style={s.greeting}>Good morning,</Text>
                <Text style={s.userName}>{firstName} 👋</Text>
              </View>
              <View style={s.headerActions}>
                <TouchableOpacity
                  style={s.iconButton}
                  onPress={openNotifications}
                  accessibilityLabel="Open notifications"
                  accessibilityRole="button"
                  hitSlop={HIT}
                >
                  <Feather name="bell" size={20} color={Colors.textPrimary} />
                  {unreadCount > 0 && <View style={s.badgeDot} />}
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.avatar}
                  onPress={() => setProfileMenuOpen(prev => !prev)}
                  accessibilityLabel="Profile settings"
                  accessibilityRole="button"
                  hitSlop={HIT}
                >
                  {currentAvatarUrl ? (
                    <Image source={{ uri: currentAvatarUrl }} style={s.avatarImage} resizeMode="cover" />
                  ) : (
                    <Text style={s.avatarText}>{profileInitials}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* High risk alert */}
            {highCount > 0 && (
              <TouchableOpacity
                style={s.alertBanner}
                onPress={() => navigation.navigate('PatientScans', { riskFilter: 'high' })}
                activeOpacity={0.82}
                accessibilityLabel={`${highCount} high-risk lesion requires attention`}
                accessibilityRole="button"
              >
                <Feather name="alert-circle" size={16} color={Colors.riskHigh} />
                <Text style={s.alertText}>{highCount} high-risk lesion requires attention</Text>
                <Feather name="chevron-right" size={14} color={Colors.riskHigh} />
              </TouchableOpacity>
            )}

            {/* Stats */}
            <View style={s.statsRow}>
              <StatCard label="Total Scans" value={String(summary.scanCount || scans.length)} iconName="aperture"   color={Colors.primary}  bg={Colors.primaryDim}  style={{ flex: 1 }} />
              <View style={{ width: Space.s8 }} />
              <StatCard label="Risk Alerts" value={String(highCount)}        iconName="alert-circle" color={Colors.riskHigh} bg={Colors.riskHighBg} style={{ flex: 1 }} />
              <View style={{ width: Space.s8 }} />
              <StatCard label="Posts"       value={String(summary.postCount || 0)} iconName="users"        color={Colors.riskMed}  bg={Colors.riskMedBg}  style={{ flex: 1 }} />
            </View>
          </SafeAreaView>
        </LinearGradient>

        <View style={s.body}>

          {/* ── Scan CTA ── */}
          <TouchableOpacity
            onPress={() => navigation.navigate('LesionScan')}
            activeOpacity={0.85}
            accessibilityLabel="Start a new skin scan"
            accessibilityRole="button"
            style={[s.scanCTA, Shadow.primary]}
          >
            <LinearGradient colors={['#00C2B2','#007F8C']} style={s.scanCTAGrad} start={{x:0,y:0}} end={{x:1,y:1}}>
              <View style={{ flex: 1 }}>
                <Text style={s.scanCTATitle}>Start New Scan</Text>
                <Text style={s.scanCTASub}>AI analysis in under 10 seconds</Text>
              </View>
              <View style={s.scanCTAIcon}>
                <Feather name="camera" size={32} color={Colors.textPrimary} />
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* ── Appointment Reminder ── */}
          {nextAppointment && (
            <TouchableOpacity
              onPress={() => navigation.navigate('PatientAppointmentsActivity')}
              activeOpacity={0.85}
              accessibilityLabel={`Upcoming appointment with ${nextAppointment.doctorName || 'doctor'}`}
              accessibilityRole="button"
              style={[s.reminderCTA, Shadow.primary]}
            >
              <LinearGradient
                colors={['#F87171', '#EF4444', '#B91C1C']}
                style={s.reminderCTAGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.reminderCTATitle}>{nextAppointment.doctorName || 'Doctor'}</Text>
                  <Text style={s.reminderCTASub}>
                    {nextAppointment.scheduledAt
                      ? new Date(nextAppointment.scheduledAt).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : 'Scheduled appointment'}
                  </Text>
                  {nextAppointment.location && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.s4, marginTop: Space.s4 }}>
                      <Feather name="map-pin" size={12} color="rgba(255,255,255,0.9)" />
                      <Text style={s.reminderLocation}>{nextAppointment.location}</Text>
                    </View>
                  )}
                </View>
                <View style={s.reminderCTAIcon}>
                  <Feather name="calendar" size={32} color={Colors.textPrimary} />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* ── Appointments ── */}
          <SectionHeader
            title="Appointments"
            action="View All"
            onAction={() => navigation.navigate('PatientAppointmentsActivity')}
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.appointmentFilterRow}
          >
            {APPOINTMENT_FILTERS.map((item) => (
              <TouchableOpacity
                key={item}
                style={[s.chip, appointmentFilter === item && s.chipActive, s.filterChip]}
                onPress={() => setAppointmentFilter(item)}
                accessibilityRole="radio"
                accessibilityLabel={`Filter appointments by ${item.toLowerCase()}`}
                accessibilityState={{ checked: appointmentFilter === item }}
                activeOpacity={0.72}
              >
                <Text style={[s.chipText, appointmentFilter === item && s.chipTextActive]}>{item}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {filteredAppointments.length === 0 && !isBusy ? (
            <View style={{ marginTop: -Space.s48 }}>
              <EmptyState
                iconName="calendar"
                title={appointmentFilter === 'All' ? 'No confirmed appointments' : `No appointments for ${appointmentFilter.toLowerCase()}`}
                subtitle="When a doctor confirms your booking, it will appear here."
              />
            </View>
          ) : (
            visibleAppointments.map((appointment) => (
              <AppointmentCard 
                key={getAppointmentId(appointment)} 
                item={appointment} 
                onCancelSuccess={(appointmentId) => {
                  setAppointments((prev) => prev.filter((a) => getAppointmentId(a) !== String(appointmentId)));
                }}
              />
            ))
          )}

          {/* ── Recent Scans ── */}
          <SectionHeader
            title="Recent Scans"
            action="View All"
            onAction={() => navigation.navigate('PatientScans')}
          />

          {/* Filter chips */}
          <View style={s.filterRow}>
            {FILTERS.map(f => (
              <TouchableOpacity
                key={f}
                style={[s.chip, filter === f && s.chipActive, s.filterChip]}
                onPress={() => setFilter(f)}
                accessibilityRole="radio"
                accessibilityLabel={`Filter by ${f} risk`}
                accessibilityState={{ checked: filter === f }}
                activeOpacity={0.72}
              >
                <Text style={[s.chipText, filter === f && s.chipTextActive]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {isBusy && (
            <View style={{ paddingVertical: Space.s16, alignItems: 'center' }}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          )}

          {visibleScans.length === 0 && !isBusy
            ? <EmptyState iconName="aperture" title="No scans yet" subtitle="Tap 'New Scan' to analyze your first lesion" action="Start Scan" onAction={() => navigation.navigate('LesionScan')} />
            : visibleScans.map(scan => (
                <ScanCard key={scan.id} scan={scan} onPress={() => navigation.navigate('AIResult', { scan })} />
              ))
          }

          {/* ── Health Tip ── */}
          <TouchableOpacity
            style={s.tip}
            onPress={() => navigation.navigate('SkinEducation')}
            activeOpacity={0.82}
            accessibilityLabel="Skin health tip — learn the ABCDE rule"
            accessibilityRole="button"
          >
            <View style={s.tipIcon}>
              <Feather name="info" size={18} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.tipTitle}>Skin Health Tip</Text>
              <Text style={s.tipBody}>Check your skin monthly using the ABCDE method. Early detection dramatically improves outcomes.</Text>
              <Text style={s.tipLink}>Learn the ABCDE Rule →</Text>
            </View>
          </TouchableOpacity>

        </View>
      </ScrollView>

      {/* ── Bottom Tab Bar ── */}
      <SafeAreaView edges={['bottom']} style={s.tabBar}>
        {[
          { icon: 'home',      label: 'Home',    active: true,  screen: null },
          { icon: 'aperture',   label: 'Scans',   active: false, screen: 'PatientScans' },
          { icon: 'users',     label: 'Community', active: false, screen: 'Community' },
          { icon: 'message-circle', label: 'Chat', active: false, screen: 'Chat', badge: unreadChatCount > 0 },
          { icon: 'map-pin',   label: 'Doctors', active: false, screen: 'DermatologistFinder' },
          { icon: 'book-open', label: 'Learn',   active: false, screen: 'SkinEducation' },
        ].map((t, i) => (
          <TouchableOpacity
            key={i}
            style={s.tabItem}
            onPress={() => {
              if (t.screen === 'Chat') {
                openChat();
              } else if (t.screen) {
                navigation.navigate(t.screen);
              }
            }}
            accessibilityRole="tab"
            accessibilityLabel={t.label}
            accessibilityState={{ selected: t.active }}
            hitSlop={HIT}
          >
            <View style={{ position: 'relative' }}>
              <Feather name={t.icon} size={22} color={t.active ? Colors.primary : Colors.textMuted} />
              {t.badge && <View style={s.tabBadge} />}
            </View>
            <Text style={[s.tabLabel, t.active && s.tabLabelActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </SafeAreaView>

      <Modal
        visible={isProfileMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setProfileMenuOpen(false)}
      >
        <Pressable style={s.menuBackdrop} onPress={() => setProfileMenuOpen(false)}>
          <Pressable style={[s.profileMenu, Shadow.lg]} onPress={() => {}}>
            <TouchableOpacity
              style={s.profileMenuItem}
              onPress={openActivityPage}
              accessibilityRole="button"
              accessibilityLabel="Open activity page"
              activeOpacity={0.75}
            >
              <Feather name="activity" size={15} color={Colors.primary} />
              <Text style={s.profileMenuText}>Activity</Text>
            </TouchableOpacity>
            <View style={s.profileMenuDivider} />
            <TouchableOpacity
              style={s.profileMenuItem}
              onPress={openEditProfile}
              accessibilityRole="button"
              accessibilityLabel="Edit profile info"
              activeOpacity={0.75}
            >
              <Feather name="edit-3" size={15} color={Colors.textOnLight} />
              <Text style={s.profileMenuText}>Edit Profile Info</Text>
            </TouchableOpacity>
            <View style={s.profileMenuDivider} />
            <TouchableOpacity
              style={s.profileMenuItem}
              onPress={handleLogout}
              accessibilityRole="button"
              accessibilityLabel="Log out"
              activeOpacity={0.75}
            >
              <Feather name="log-out" size={15} color={Colors.riskHigh} />
              <Text style={[s.profileMenuText, { color: Colors.riskHigh }]}>Log Out</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Floating AI Bubble */}
      <TouchableOpacity
        style={s.floatingAgentBubble}
        onPress={() => navigation.navigate('AgentChat')}
        accessibilityRole="button"
        accessibilityLabel="Ask AI assistant"
        activeOpacity={0.85}
      >
        <LinearGradient colors={['#050E1F', '#0D2147']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.floatingAgentGradient}>
          <Ionicons name="sparkles" size={24} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  header: { paddingHorizontal: Space.s24, paddingBottom: Space.s24 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: Space.s16, marginBottom: Space.s16 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Space.s10 },
  iconButton: {
    position: 'relative',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.riskHigh,
    borderWidth: 2,
    borderColor: '#050E1F',
  },
  greeting: { ...Type.b2, color: Colors.textSecondary, marginBottom: 2 },
  userName: { ...Type.d3, color: Colors.textPrimary },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primaryDim, borderWidth: 2, borderColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: '100%', height: '100%', borderRadius: 20 },
  avatarText: { ...Type.l1, color: Colors.primary },
  profileMenu: {
    position: 'absolute',
    top: 78,
    right: Space.s20,
    minWidth: 190,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.grey100,
    overflow: 'hidden',
    zIndex: 30,
  },
  profileMenuItem: {
    minHeight: 44,
    paddingHorizontal: Space.s12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.s8,
  },
  profileMenuText: { ...Type.l2, color: Colors.textOnLight },
  profileMenuDivider: { height: 1, backgroundColor: Colors.grey100 },
  alertBanner: { flexDirection: 'row', alignItems: 'center', gap: Space.s8, backgroundColor: Colors.riskHighBg, borderRadius: Radius.md, padding: Space.s12, borderWidth: 1, borderColor: Colors.riskHigh + '40', marginBottom: Space.s16 },
  alertText: { ...Type.l2, color: Colors.riskHigh, flex: 1 },
  statsRow: { flexDirection: 'row' },

  body: { paddingHorizontal: Space.s24, paddingTop: Space.s24 },

  quickActions: { flexDirection: 'row', marginBottom: Space.s24 },
  actionItem: { flex: 1, alignItems: 'center', gap: Space.s8 },
  actionIcon: { width: 56, height: 56, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { ...Type.l3, color: Colors.grey700 },

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
  appointmentCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.s6,
    marginTop: Space.s8,
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
  dateTime: {
    ...Type.b2,
    color: Colors.textOnLight,
    textAlign: 'right',
    maxWidth: 140,
  },
  appointmentCancelButton: {
    marginLeft: Space.s4,
  },
  appointmentStripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  appointmentIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primaryDim, alignItems: 'center', justifyContent: 'center', marginLeft: Space.s8 },
  appointmentContent: { flex: 1, marginLeft: Space.s12 },
  appointmentRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Space.s8, alignItems: 'flex-start' },
  appointmentDoctor: { ...Type.l1, color: Colors.textOnLight, flex: 1 },
  appointmentTime: { ...Type.l3, color: Colors.textMuted, maxWidth: 145 },
  appointmentSubtitle: { ...Type.b3, color: Colors.textMuted, marginTop: 2 },
  appointmentNote: { ...Type.b2, color: Colors.textOnLight, marginTop: 4, lineHeight: 18 },
  appointmentActions: { marginTop: Space.s10, alignSelf: 'flex-end', alignItems: 'flex-end' },
  appointmentCardActions: { marginTop: Space.s8, alignSelf: 'flex-end' },


  scanCTA: { borderRadius: Radius.xl, overflow: 'hidden', marginBottom: Space.s32 },
  scanCTAGrad: { flexDirection: 'row', alignItems: 'center', padding: Space.s24 },
  scanCTATitle: { ...Type.d4, color: Colors.textPrimary, marginBottom: 4 },
  scanCTASub: { ...Type.b2, color: 'rgba(255,255,255,0.75)' },
  scanCTAIcon: { width: 64, height: 64, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 32, alignItems: 'center', justifyContent: 'center' },

  reminderCTA: { borderRadius: Radius.xl, overflow: 'hidden', marginBottom: Space.s20 },
  reminderCTAGrad: { flexDirection: 'row', alignItems: 'center', padding: Space.s24 },
  reminderCTATitle: { ...Type.d4, color: Colors.textPrimary, marginBottom: 4 },
  reminderCTASub: { ...Type.b2, color: 'rgba(255,255,255,0.84)' },
  reminderLocation: { ...Type.b3, color: 'rgba(255,255,255,0.84)' },
  reminderCTAIcon: { width: 64, height: 64, backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 32, alignItems: 'center', justifyContent: 'center' },

  chip: { paddingHorizontal: Space.s16, paddingVertical: Space.s8, borderRadius: Radius.full, backgroundColor: Colors.bgCard, borderWidth: 1.5, borderColor: Colors.grey100, minHeight: 36 },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { ...Type.l2, color: Colors.grey500 },
  chipTextActive: { color: Colors.primaryOnDark },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: Space.s16 },
  filterChip: { marginRight: Space.s8, marginBottom: Space.s8 },
  appointmentFilterRow: { flexDirection: 'row', alignItems: 'center', paddingBottom: Space.s2, marginBottom: Space.s16 },

  tip: { flexDirection: 'row', gap: Space.s12, backgroundColor: Colors.bgCard, borderRadius: Radius.xl, padding: Space.s20, borderLeftWidth: 4, borderLeftColor: Colors.primary, ...Shadow.sm, marginTop: Space.s24 },
  tipIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primaryDim, alignItems: 'center', justifyContent: 'center' },
  tipTitle: { ...Type.l1, color: Colors.textOnLight, marginBottom: 4 },
  tipBody: { ...Type.b2, color: Colors.textMuted, lineHeight: 20, marginBottom: Space.s8 },
  tipLink: { ...Type.l2, color: Colors.primary },

  tabBar: { backgroundColor: Colors.bgCard, borderTopWidth: 1, borderTopColor: Colors.grey100, flexDirection: 'row', ...Shadow.lg },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: Space.s12, gap: 4, minHeight: 44 },
  tabLabel: { ...Type.l3, color: Colors.textMuted },
  tabLabelActive: { color: Colors.primary },
  tabBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.riskHigh,
    borderWidth: 1.5,
    borderColor: Colors.bgCard,
  },

  floatingAgentBubble: { position: 'absolute', bottom: 100, right: 20, width: 56, height: 56, borderRadius: 28, overflow: 'hidden', elevation: 6, shadowColor: '#0D2147', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, zIndex: 999 },
  floatingAgentGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  menuBackdrop: {
    flex: 1,
  },

});

