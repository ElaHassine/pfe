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
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Type, Space, Radius, Shadow, HIT } from '../theme';
import { EmptyState } from '../components';
import { bookingApi, patientApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

const LAST_VIEWED_NOTIFICATIONS_KEY = 'lesio.lastViewedNotifications';

function formatRelativeTime(value) {
  if (!value) return 'Just now';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Just now';

  const diffMs = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function buildNotificationMeta(event) {
  const type = String(event?.type || '').toLowerCase();
  const metadata = event?.metadata || {};

  if (type === 'scan.created') {
    const riskLevel = String(metadata.riskLevel || '').trim();
    const lesionType = String(metadata.lesionType || 'new scan').trim();
    return {
      title: 'Scan analyzed',
      message: `${lesionType}${riskLevel ? ` • ${riskLevel} risk` : ''}`,
      icon: 'activity',
      accent: riskLevel === 'high' ? Colors.riskHigh : riskLevel === 'medium' ? Colors.riskMed : Colors.primary,
      bg: riskLevel === 'high' ? Colors.riskHighBg : riskLevel === 'medium' ? Colors.riskMedBg : Colors.primaryDim,
    };
  }

  if (type === 'booking.requested') {
    return {
      title: 'Booking request sent',
      message: `${metadata.doctorName || 'A doctor'}${metadata.preferredTime ? ` • ${metadata.preferredTime}` : ''}`,
      icon: 'calendar',
      accent: Colors.riskMed,
      bg: Colors.riskMedBg,
    };
  }

  if (type === 'booking.time-suggested') {
    const note = String(metadata.doctorNote || '').trim();
    return {
      title: 'Booking time suggested',
      message: `${metadata.doctorName || 'Your doctor'} proposed ${metadata.suggestedTime || 'a time slot'}${note ? ` • Note: ${note}` : ''}`,
      icon: 'calendar',
      accent: Colors.primary,
      bg: Colors.primaryDim,
    };
  }

  if (type === 'community.post-created') {
    return {
      title: 'Community post shared',
      message: metadata.diagnosis || metadata.location || 'Your post is now visible to other patients',
      icon: 'users',
      accent: Colors.primary,
      bg: Colors.primaryDim,
    };
  }

  if (type === 'community.comment-created') {
    return {
      title: 'New comment added',
      message: 'Someone replied to your community post',
      icon: 'message-circle',
      accent: '#6366F1',
      bg: 'rgba(99,102,241,0.12)',
    };
  }

  if (type === 'community.post-liked') {
    return {
      title: 'Post liked',
      message: 'Another patient liked your post',
      icon: 'heart',
      accent: Colors.riskHigh,
      bg: Colors.riskHighBg,
    };
  }

  if (type === 'auth.logged-in' || type === 'auth.google-signed-in' || type === 'auth.registered') {
    return {
      title: 'Account update',
      message: 'Your account activity was recorded successfully',
      icon: 'shield',
      accent: Colors.primary,
      bg: Colors.primaryDim,
    };
  }

  return {
    title: event?.type ? String(event.type).replace(/\./g, ' ') : 'Activity update',
    message: String(metadata.note || metadata.message || 'A new event was added to your activity feed'),
    icon: 'bell',
    accent: Colors.primary,
    bg: Colors.primaryDim,
  };
}

function shouldDisplayNotification(event) {
  const type = String(event?.type || '').toLowerCase();
  return !['booking.accepted', 'booking.declined', 'booking.cancelled'].includes(type);
}

export default function NotificationsScreen({ navigation }) {
  const { getMyActivity } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [bookingRequests, setBookingRequests] = useState([]);
  const [bookingBusyId, setBookingBusyId] = useState('');

  const suggestedBookingRequests = useMemo(
    () => bookingRequests.filter((request) => String(request.status || '').toLowerCase() === 'suggested'),
    [bookingRequests]
  );

  const mapBookingStatus = (status) => {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'accepted') {
      return { label: 'Accepted', color: Colors.riskLow, bg: Colors.riskLowBg };
    }
    if (normalized === 'declined') {
      return { label: 'Declined', color: Colors.riskHigh, bg: Colors.riskHighBg };
    }
    if (normalized === 'suggested') {
      return { label: 'Time Suggested', color: Colors.primary, bg: Colors.primaryDim };
    }
    return { label: 'Pending', color: Colors.riskMed, bg: Colors.riskMedBg };
  };

  const loadNotifications = useCallback(async (mountedRef) => {
    setIsLoading(true);
    try {
      const [events, bookingResult] = await Promise.all([
        getMyActivity(),
        bookingApi.myRequests(),
      ]);
      if (!mountedRef.current) return;
      setItems((events || [])
        .filter(shouldDisplayNotification)
        .map((event) => ({
          id: event._id || `${event.type}-${event.createdAt}`,
          ...buildNotificationMeta(event),
          time: formatRelativeTime(event.createdAt),
        })));
      setBookingRequests(bookingResult?.requests || []);
      // Mark as viewed after loading
      await AsyncStorage.setItem(LAST_VIEWED_NOTIFICATIONS_KEY, String(Date.now()));
    } catch (_error) {
      if (!mountedRef.current) return;
      setItems([]);
      setBookingRequests([]);
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [getMyActivity]);

  const respondToBooking = useCallback(async (requestId, action) => {
    setBookingBusyId(requestId);
    try {
      const result = await bookingApi.respondToSuggestion(requestId, action);
      setBookingRequests((prev) => prev.filter((request) => String(request._id || request.id) !== String(requestId)));
    } catch (_error) {
      // Keep screen responsive if update fails.
    } finally {
      setBookingBusyId('');
    }
  }, []);

  const deleteNotification = useCallback(async (eventId) => {
    try {
      await patientApi.deleteActivity(eventId);
      setItems((prev) => prev.filter((item) => String(item.id) !== String(eventId)));
    } catch (_error) {
      Alert.alert('Delete failed', 'Could not delete this notification right now.');
    }
  }, []);

  const renderSwipeActions = useCallback(() => (
    <View style={s.swipeDeleteAction}>
      <Feather name="trash-2" size={22} color={Colors.textPrimary} />
    </View>
  ), []);

  const clearAllNotifications = useCallback(() => {
    Alert.alert(
      'Clear all notifications',
      'This will delete all notification items from your feed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear all',
          style: 'destructive',
          onPress: async () => {
            try {
              await patientApi.clearActivity();
              setItems([]);
              await AsyncStorage.setItem(LAST_VIEWED_NOTIFICATIONS_KEY, String(Date.now()));
            } catch (_error) {
              // Leave the current feed intact if clearing fails.
            }
          },
        },
      ]
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      const mountedRef = { current: true };
      loadNotifications(mountedRef);
      return () => {
        mountedRef.current = false;
      };
    }, [loadNotifications])
  );

  const notificationCount = useMemo(() => items.length, [items]);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.grey50 }}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Space.s48 }}>
        <LinearGradient colors={['#050E1F', '#0D2147']} style={s.header}>
          <SafeAreaView edges={['top']}>
            <View style={s.headerTop}>
              <TouchableOpacity
                style={s.backButton}
                onPress={() => navigation.goBack()}
                hitSlop={HIT}
                accessibilityRole="button"
                accessibilityLabel="Go back"
                activeOpacity={0.72}
              >
                <Feather name="arrow-left" size={22} color={Colors.textPrimary} />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={s.kicker}>Patient updates</Text>
                <Text style={s.title}>Notifications</Text>
              </View>
              <View style={s.bellPill}>
                <Feather name="bell" size={16} color={Colors.primary} />
                <Text style={s.bellText}>{notificationCount}</Text>
              </View>
            </View>
            <Text style={s.subtitle}>Track scans, bookings, and community activity in one place.</Text>
          </SafeAreaView>
        </LinearGradient>

        <TouchableOpacity
          style={s.clearAllLink}
          onPress={clearAllNotifications}
          accessibilityRole="button"
          accessibilityLabel="Clear all notifications"
          activeOpacity={0.8}
        >
          <Text style={s.clearAllText}>Clear All</Text>
        </TouchableOpacity>

        <View style={s.body}>
          {isLoading && (
            <View style={{ paddingVertical: Space.s16, alignItems: 'center' }}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          )}

          {!isLoading && suggestedBookingRequests.map((request) => {
            const status = mapBookingStatus(request.status);
            const requestId = String(request._id || request.id || '');
            const isBusy = bookingBusyId && bookingBusyId === requestId;
            return (
              <View key={`booking-${requestId}`} style={[s.bookingCard, Shadow.sm]}>
                <View style={s.bookingTopRow}>
                  <View style={[s.iconWrap, { backgroundColor: status.bg }]}>
                    <Feather name="calendar" size={18} color={status.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardTitle}>Booking with {request.doctorSnapshot?.name || 'Doctor'}</Text>
                    <Text style={s.cardMessage}>
                      Suggested: {request.suggestedTime || 'Awaiting doctor suggestion'}
                    </Text>
                  </View>
                  <View style={[s.statusPill, { backgroundColor: status.bg }]}> 
                    <Text style={[s.statusText, { color: status.color }]}>{status.label}</Text>
                  </View>
                </View>

                {request.status === 'suggested' && (
                  <View style={s.bookingActionsRow}>
                    <TouchableOpacity
                      onPress={() => respondToBooking(requestId, 'decline')}
                      disabled={!!isBusy}
                      activeOpacity={0.8}
                      style={[s.bookingActionBtn, s.bookingDeclineBtn]}
                    >
                      {isBusy ? <ActivityIndicator size="small" color={Colors.riskHigh} /> : <Text style={s.bookingDeclineText}>Cancel</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => respondToBooking(requestId, 'accept')}
                      disabled={!!isBusy}
                      activeOpacity={0.8}
                      style={[s.bookingActionBtn, s.bookingAcceptBtn]}
                    >
                      {isBusy ? <ActivityIndicator size="small" color={Colors.primaryOnDark} /> : <Text style={s.bookingAcceptText}>Confirm</Text>}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}

          {!isLoading && items.length === 0 && (
            <EmptyState
              iconName="bell-off"
              title="No notifications yet"
              subtitle="New scans, bookings, and community activity will appear here."
            />
          )}

          {!isLoading && items.map((item) => (
            <Swipeable
              key={item.id}
              renderRightActions={renderSwipeActions}
              rightThreshold={44}
              overshootRight={false}
              onSwipeableOpen={(direction) => {
                if (direction === 'right') {
                  deleteNotification(item.id);
                }
              }}
            >
              <View style={[s.card, Shadow.sm]}>
                <View style={[s.iconWrap, { backgroundColor: item.bg }]}>
                  <Feather name={item.icon} size={18} color={item.accent} />
                </View>
                <View style={s.cardBody}>
                  <View style={s.cardTopRow}>
                    <Text style={s.cardTitle}>{item.title}</Text>
                    <Text style={s.cardTime}>{item.time}</Text>
                  </View>
                  <Text style={s.cardMessage}>{item.message}</Text>
                </View>
              </View>
            </Swipeable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  header: { paddingHorizontal: Space.s24, paddingBottom: Space.s24 },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: Space.s12 },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  kicker: { ...Type.l2, color: Colors.textSecondary, marginBottom: 2 },
  title: { ...Type.d3, color: Colors.textPrimary },
  subtitle: { ...Type.b2, color: 'rgba(255,255,255,0.75)', marginTop: Space.s12, maxWidth: 320 },
  bellPill: {
    minWidth: 48,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: Space.s10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  bellText: { ...Type.l2, color: Colors.textPrimary },
  clearAllLink: {
    alignSelf: 'flex-end',
    marginTop: Space.s10,
    marginRight: Space.s24,
  },
  clearAllText: { ...Type.l1, color: Colors.primary },
  body: { paddingHorizontal: Space.s24, paddingTop: Space.s24 },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    padding: Space.s16,
    marginBottom: Space.s12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Space.s12,
    borderWidth: 1,
    borderColor: Colors.grey100,
  },
  swipeDeleteAction: {
    width: 84,
    marginBottom: Space.s12,
    borderRadius: Radius.xl,
    backgroundColor: Colors.riskHigh,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Space.s8,
  },
  bookingCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    padding: Space.s16,
    marginBottom: Space.s12,
    borderWidth: 1,
    borderColor: Colors.grey100,
  },
  bookingTopRow: {
    flexDirection: 'row',
    gap: Space.s12,
    alignItems: 'center',
  },
  statusPill: {
    borderRadius: Radius.full,
    paddingHorizontal: Space.s8,
    paddingVertical: 4,
  },
  statusText: { ...Type.l3 },
  bookingActionsRow: {
    marginTop: Space.s12,
    flexDirection: 'row',
    gap: Space.s8,
  },
  bookingActionBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  bookingDeclineBtn: {
    backgroundColor: Colors.riskHighBg,
    borderColor: Colors.riskHigh + '40',
  },
  bookingAcceptBtn: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  bookingDeclineText: {
    ...Type.l2,
    color: Colors.riskHigh,
  },
  bookingAcceptText: {
    ...Type.l2,
    color: Colors.primaryOnDark,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1 },
  cardTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Space.s12 },
  cardTitle: { ...Type.l1, color: Colors.textOnLight, flex: 1 },
  cardTime: { ...Type.l3, color: Colors.textMuted, marginTop: 2 },
  cardMessage: { ...Type.b2, color: Colors.textMuted, marginTop: 4, lineHeight: 20 },
});
