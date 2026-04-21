import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Type, Space, Radius, Shadow, HIT } from '../theme';
import { patientApi } from '../services/api';

const SORT_OPTIONS = [
  { key: 'latest', label: 'From Latest' },
  { key: 'oldest', label: 'From Oldest' },
];

const APPOINTMENT_STATUS_FILTERS = [
  { key: 'scheduled', label: 'Scheduled', icon: 'calendar' },
  { key: 'completed', label: 'Completed', icon: 'check-circle' },
  { key: 'canceled', label: 'Canceled', icon: 'x-circle' },
];

function toDateMs(value) {
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

function monthLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown Month';
  return date.toLocaleString(undefined, { month: 'long', year: 'numeric' });
}

function formatDate(value) {
  if (!value) return 'Unknown date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function mapAppointmentStatusTag(status) {
  const normalized = String(status || '').toLowerCase();

  if (['declined', 'cancelled', 'canceled'].includes(normalized)) {
    return { label: 'canceled', icon: 'x-circle', color: Colors.riskHigh, bg: Colors.riskHighBg };
  }

  if (normalized === 'completed') {
    return { label: 'completed', icon: 'check-circle', color: Colors.riskLow, bg: Colors.riskLowBg };
  }

  return { label: 'scheduled', icon: 'calendar', color: Colors.primary, bg: Colors.primaryDim };
}

function mapAppointmentStatusFilter(status) {
  return mapAppointmentStatusTag(status).label;
}

function DefaultListCard({ item, kind = 'post' }) {
  const appointmentTag = kind === 'appointment' ? mapAppointmentStatusTag(item.status) : null;
  const icon = kind === 'comment' ? 'message-circle' : kind === 'appointment' ? appointmentTag.icon : 'image';
  const iconColor = kind === 'appointment' ? appointmentTag.color : Colors.primary;
  const fallbackText = kind === 'comment' ? 'Comment' : kind === 'appointment' ? 'Appointment' : 'Community post';

  return (
    <View style={[s.card, Shadow.sm]}>
      <View style={s.cardLeadingWrap}>
        {!!item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={s.thumb} />
        ) : (
          <View style={s.thumbFallback}>
            <Feather name={icon} size={18} color={iconColor} />
          </View>
        )}
      </View>
      <View style={s.cardContent}>
        <Text style={s.cardTitle} numberOfLines={kind === 'comment' ? 2 : 1}>{item.note || item.body || item.doctorName || fallbackText}</Text>
        <Text style={[s.cardSubtitle, !item.diagnosis && !item.postNote && s.cardSubtitleHidden]} numberOfLines={1}>
          {item.diagnosis || item.postNote || item.specialty || ' '}
        </Text>
        {kind === 'appointment' ? (
          <View style={s.appointmentMetaRow}>
            <Text style={s.cardMeta} numberOfLines={1}>{item.location || 'Unavailable'}</Text>
            <View style={[s.appointmentStatusTag, { backgroundColor: appointmentTag.bg }]}>
              <Text style={[s.appointmentStatusText, { color: appointmentTag.color }]}>{appointmentTag.label}</Text>
            </View>
          </View>
        ) : null}
      </View>
      <View style={s.cardRightWrap}>
        <View style={s.timePill}>
          <Text style={s.cardRight}>{formatDate(item.createdAt || item.scheduledAt)}</Text>
        </View>
      </View>
    </View>
  );
}

export default function ActivityListScreen({
  navigation,
  title,
  dataKey,
  tabs,
  kind,
  loadSource,
  emptyIcon = 'inbox',
  emptyText,
  sectionLabel,
  headerIcon,
  mapItem,
  renderItem,
}) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.key || dataKey);
  const [sortOrder, setSortOrder] = useState('latest');
  const [appointmentStatusFilter, setAppointmentStatusFilter] = useState('scheduled');
  const [isLoading, setLoading] = useState(true);
  const [activity, setActivity] = useState({});

  const loadActivity = useCallback(async () => {
    setLoading(true);
    try {
      const res = await patientApi.getActivityOverview();
      const source = loadSource(res.activity || {});
      setActivity(source);
    } finally {
      setLoading(false);
    }
  }, [loadSource]);

  useFocusEffect(
    useCallback(() => {
      loadActivity();
    }, [loadActivity])
  );

  const counters = useMemo(() => tabs.reduce((acc, tab) => {
    acc[tab.key] = Array.isArray(activity[tab.key]) ? activity[tab.key].length : 0;
    return acc;
  }, {}), [activity, tabs]);

  const items = activity[activeTab] || [];
  const activeMeta = tabs.find((tab) => tab.key === activeTab) || tabs[0];

  const filteredItems = useMemo(() => {
    if (kind !== 'appointment') return items;

    return items.filter((item) => mapAppointmentStatusFilter(item.status) === appointmentStatusFilter);
  }, [appointmentStatusFilter, items, kind]);

  const groupedItems = useMemo(() => {
    const mapped = filteredItems.map((item) => mapItem(item));
    const sorted = [...mapped].sort((a, b) => {
      const aMs = toDateMs(a._sortDate);
      const bMs = toDateMs(b._sortDate);
      return sortOrder === 'latest' ? bMs - aMs : aMs - bMs;
    });

    const groups = [];
    sorted.forEach((item) => {
      const key = monthLabel(item._sortDate);
      const existing = groups.find((group) => group.key === key);
      if (existing) {
        existing.items.push(item);
      } else {
        groups.push({ key, items: [item] });
      }
    });

    return groups;
  }, [filteredItems, mapItem, sortOrder]);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.grey50 }}>
      <LinearGradient colors={['#050E1F', '#0D2147']}>
        <SafeAreaView edges={['top']}>
          <View style={s.headerBar}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={s.iconBtn} hitSlop={HIT}>
              <Feather name="arrow-left" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={s.headerTitle}>{title}</Text>
            <View style={s.iconBtn} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      <View style={s.tabRow}>
        {kind === 'appointment'
          ? APPOINTMENT_STATUS_FILTERS.map((option) => {
              const isActive = appointmentStatusFilter === option.key;
              const count = items.filter((item) => mapAppointmentStatusFilter(item.status) === option.key).length;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[s.tabChip, isActive && s.tabChipActive, Shadow.sm]}
                  onPress={() => setAppointmentStatusFilter(option.key)}
                  activeOpacity={0.84}
                >
                  <Feather name={option.icon} size={13} color={isActive ? Colors.primaryOnDark : Colors.primary} />
                  <Text style={[s.tabChipText, isActive && s.tabChipTextActive]} numberOfLines={1}>{option.label}</Text>
                  <Text style={[s.tabChipCount, isActive && s.tabChipCountActive]}>{count}</Text>
                </TouchableOpacity>
              );
            })
          : tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[s.tabChip, isActive && s.tabChipActive, Shadow.sm]}
                  onPress={() => setActiveTab(tab.key)}
                  activeOpacity={0.84}
                >
                  <Feather name={tab.icon} size={13} color={isActive ? Colors.primaryOnDark : Colors.primary} />
                  <Text style={[s.tabChipText, isActive && s.tabChipTextActive]} numberOfLines={1}>{tab.label}</Text>
                  <Text style={[s.tabChipCount, isActive && s.tabChipCountActive]}>{counters[tab.key] || 0}</Text>
                </TouchableOpacity>
              );
            })}
      </View>

      <View style={s.sortRow}>
        {SORT_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[s.sortChip, sortOrder === option.key && s.sortChipActive]}
            onPress={() => setSortOrder(option.key)}
            activeOpacity={0.8}
          >
            <Text style={[s.sortChipText, sortOrder === option.key && s.sortChipTextActive]}>{option.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.contentWrap}>
        <View style={[s.sectionHeader, Shadow.sm]}>
          <View style={s.sectionHeaderLeft}>
            <View style={s.sectionHeaderIconWrap}>
              <Feather name={headerIcon || activeMeta.icon} size={16} color={Colors.primary} />
            </View>
            <View>
              <Text style={s.sectionHeaderTitle}>{sectionLabel || activeMeta.label}</Text>
              <Text style={s.sectionHeaderHint}>{filteredItems.length} item{filteredItems.length === 1 ? '' : 's'}</Text>
            </View>
          </View>
        </View>

        {isLoading ? (
          <View style={s.loaderWrap}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : groupedItems.length === 0 ? (
          <View style={[s.emptyCard, Shadow.sm]}>
            <View style={s.emptyIconWrap}>
              <Feather name={emptyIcon || activeMeta.icon || 'inbox'} size={20} color={Colors.primary} />
            </View>
            <Text style={s.emptyTitle}>Nothing here yet</Text>
            <Text style={s.emptyText}>{emptyText || `Your ${activeMeta.label.toLowerCase()} will appear here when available.`}</Text>
          </View>
        ) : (
          groupedItems.map((group) => (
            <View key={group.key} style={s.monthSection}>
              <Text style={s.monthTitle}>{group.key}</Text>
              {group.items.map((item) => (
                renderItem ? renderItem(item) : <DefaultListCard key={item.id} item={item} kind={kind} />
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

export { DefaultListCard, monthLabel, toDateMs, formatDate };

const s = StyleSheet.create({
  headerBar: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: Space.s8, paddingVertical: Space.s8 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...Type.d4, color: Colors.textPrimary, flex: 1, textAlign: 'center' },
  tabRow: { flexDirection: 'row', gap: Space.s8, paddingHorizontal: Space.s16, paddingVertical: Space.s12 },
  tabChip: {
    flex: 1,
    minHeight: 76,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.grey100,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: Space.s8,
  },
  tabChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabChipText: { ...Type.l3, color: Colors.textOnLight, textAlign: 'center' },
  tabChipTextActive: { color: Colors.primaryOnDark },
  tabChipCount: { ...Type.l2, color: Colors.textMuted },
  tabChipCountActive: { color: Colors.primaryOnDark },
  sortRow: { flexDirection: 'row', gap: Space.s8, paddingHorizontal: Space.s16, paddingBottom: Space.s8 },
  sortChip: { paddingHorizontal: Space.s12, paddingVertical: Space.s6, borderRadius: Radius.full, backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.grey100 },
  sortChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryDim },
  sortChipText: { ...Type.l3, color: Colors.textMuted },
  sortChipTextActive: { color: Colors.primary },
  contentWrap: { paddingHorizontal: Space.s16, paddingBottom: Space.s28, gap: Space.s10 },
  sectionHeader: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    paddingHorizontal: Space.s12,
    paddingVertical: Space.s10,
    marginBottom: Space.s2,
  },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: Space.s10 },
  sectionHeaderIconWrap: {
    width: 34,
    height: 34,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryDim,
  },
  sectionHeaderTitle: { ...Type.l1, color: Colors.textOnLight },
  sectionHeaderHint: { ...Type.b3, color: Colors.textMuted },
  loaderWrap: { paddingVertical: Space.s28, alignItems: 'center' },
  emptyCard: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Space.s20, alignItems: 'center', gap: Space.s10 },
  emptyIconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryDim,
  },
  emptyTitle: { ...Type.l1, color: Colors.textOnLight },
  emptyText: { ...Type.b3, color: Colors.textMuted, textAlign: 'center' },
  monthSection: { gap: Space.s8, marginBottom: Space.s12 },
  monthTitle: { ...Type.l2, color: Colors.textMuted, paddingHorizontal: Space.s4 },
  card: { flexDirection: 'row', alignItems: 'center', gap: Space.s10, minHeight: 92, backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Space.s12 },
  cardLeadingWrap: {
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumb: { width: 52, height: 52, borderRadius: Radius.md, backgroundColor: Colors.grey50 },
  thumbFallback: { width: 52, height: 52, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primaryDim },
  cardContent: { flex: 1, justifyContent: 'center' },
  cardTitle: { ...Type.l2, color: Colors.textOnLight },
  cardSubtitle: { ...Type.b3, color: Colors.textMuted, marginTop: 2 },
  cardSubtitleHidden: { opacity: 0 },
  cardMeta: { ...Type.l3, color: Colors.textMuted, marginTop: 2 },
  appointmentMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Space.s8, marginTop: 2 },
  appointmentStatusTag: { borderRadius: Radius.full, paddingHorizontal: Space.s8, paddingVertical: 3 },
  appointmentStatusText: { ...Type.l3 },
  cardRightWrap: { width: 90, alignItems: 'flex-end', justifyContent: 'center' },
  timePill: { borderRadius: Radius.full, paddingHorizontal: Space.s8, paddingVertical: Space.s4, backgroundColor: Colors.primaryDim },
  cardRight: { ...Type.l3, color: Colors.textMuted, textAlign: 'right' },
});
