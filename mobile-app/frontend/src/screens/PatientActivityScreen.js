import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Type, Space, Radius, Shadow, HIT } from '../theme';
import { patientApi } from '../services/api';

const TABS = [
  { key: 'myPosts', label: 'My Posts', icon: 'edit-3' },
  { key: 'myComments', label: 'My Comments', icon: 'message-circle' },
  { key: 'likedPosts', label: 'Liked Posts', icon: 'heart' },
  { key: 'savedPosts', label: 'Saved Posts', icon: 'bookmark' },
  { key: 'likedComments', label: 'Liked Comments', icon: 'thumbs-up' },
  { key: 'appointments', label: 'My Appointments', icon: 'calendar' },
];

const SORT_OPTIONS = [
  { key: 'latest', label: 'From Latest' },
  { key: 'oldest', label: 'From Oldest' },
];

function formatDate(value) {
  if (!value) return 'Unknown date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatCompactDate(value) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function toDateMs(value) {
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

function monthLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown Month';
  return date.toLocaleString(undefined, { month: 'long', year: 'numeric' });
}

function ActivityCard({ title, subtitle, rightText, imageUrl, icon }) {
  return (
    <View style={[s.card, Shadow.sm]}>
      <View style={s.cardLeadingWrap}>
        {!!imageUrl ? (
          <Image source={{ uri: imageUrl }} style={s.thumb} />
        ) : (
          <View style={s.thumbFallback}>
            <Feather name={icon || 'activity'} size={18} color={Colors.primary} />
          </View>
        )}
      </View>
      <View style={s.cardContent}>
        <Text style={s.cardTitle} numberOfLines={1}>{title}</Text>
        <Text style={[s.cardSubtitle, !subtitle && s.cardSubtitleHidden]} numberOfLines={1}>{subtitle || ' '}</Text>
      </View>
      <View style={s.cardRightWrap}>
        <View style={s.timePill}>
          <Text style={s.cardRight} numberOfLines={1}>{rightText || ''}</Text>
        </View>
      </View>
    </View>
  );
}

function ActivityTrendLineGraph({ data = [] }) {
  const [chartWidth, setChartWidth] = useState(0);
  const chartHeight = 120;
  const padH = 14;
  const padTop = 10;
  const padBottom = 22;
  const plotHeight = chartHeight - padTop - padBottom;
  const safeData = data.length ? data : [{ key: 'empty', short: 'Now', value: 0 }];
  const maxValue = Math.max(...safeData.map((item) => Number(item.value || 0)), 1);
  const innerWidth = Math.max(chartWidth - padH * 2, 1);
  const denominator = Math.max(safeData.length - 1, 1);

  const points = safeData.map((item, idx) => {
    const value = Number(item.value || 0);
    const x = safeData.length === 1
      ? padH + innerWidth / 2
      : padH + (idx / denominator) * innerWidth;
    const y = padTop + plotHeight - (value / maxValue) * plotHeight;
    return {
      ...item,
      value,
      x,
      y,
    };
  });

  return (
    <View>
      <View
        style={s.lineGraphFrame}
        onLayout={(event) => {
          const width = Math.round(event.nativeEvent.layout.width || 0);
          if (width !== chartWidth) setChartWidth(width);
        }}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((tick, idx) => (
          <View
            key={`grid-${idx}`}
            style={[
              s.lineGraphGrid,
              { top: padTop + tick * plotHeight },
            ]}
          />
        ))}

        {points.slice(0, -1).map((point, idx) => {
          const next = points[idx + 1];
          const dx = next.x - point.x;
          const dy = next.y - point.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
          const midX = (point.x + next.x) / 2;
          const midY = (point.y + next.y) / 2;

          return (
            <View
              key={`line-${point.key}`}
              style={[
                s.lineGraphSegment,
                {
                  width: length,
                  left: midX - length / 2,
                  top: midY - 1,
                  transform: [{ rotate: `${angle}deg` }],
                },
              ]}
            />
          );
        })}

        {points.map((point) => (
          <View
            key={`dot-${point.key}`}
            style={[
              s.lineGraphDot,
              { left: point.x - 5, top: point.y - 5 },
            ]}
          />
        ))}
      </View>

      <View style={s.lineGraphLabelsRow}>
        {points.map((point) => (
          <View key={`label-${point.key}`} style={s.lineGraphLabelItem}>
            <Text style={s.lineGraphMonth}>{point.short}</Text>
            <Text style={s.lineGraphValue}>{point.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function PatientActivityScreen({ navigation }) {
  const [activeHero, setActiveHero] = useState('myPosts');
  const [isLoading, setLoading] = useState(true);
  const [activity, setActivity] = useState({
    myPosts: [],
    likedPosts: [],
    myComments: [],
    savedPosts: [],
    appointments: [],
    likedComments: [],
  });

  const loadActivity = useCallback(async () => {
    setLoading(true);
    try {
      const res = await patientApi.getActivityOverview();
      setActivity(res.activity || {
        myPosts: [], likedPosts: [], myComments: [], savedPosts: [], appointments: [], likedComments: [],
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadActivity();
    }, [loadActivity])
  );

  const counters = useMemo(() => ({
    myPosts: activity.myPosts.length,
    likedPosts: activity.likedPosts.length,
    myComments: activity.myComments.length,
    savedPosts: activity.savedPosts.length,
    appointments: activity.appointments.length,
    likedComments: activity.likedComments.length,
  }), [activity]);

  const heroStats = useMemo(() => ([
    { key: 'myPosts', label: 'Posts', icon: 'edit-3', value: counters.myPosts },
    { key: 'myComments', label: 'Comments', icon: 'message-circle', value: counters.myComments },
    { key: 'appointments', label: 'Appointments', icon: 'calendar', value: counters.appointments },
  ]), [counters.appointments, counters.myComments, counters.myPosts]);

  const totalTracked = useMemo(
    () => heroStats.reduce((sum, item) => sum + Number(item.value || 0), 0),
    [heroStats]
  );

  const insightStats = useMemo(() => {
    const totalInteractions =
      counters.myPosts
      + counters.myComments
      + counters.likedPosts
      + counters.savedPosts
      + counters.likedComments;

    const totalVisits = counters.appointments;
    const shareRate = counters.myPosts > 0
      ? Math.round((counters.savedPosts / counters.myPosts) * 100)
      : 0;

    return {
      totalInteractions,
      totalVisits,
      shareRate,
    };
  }, [counters]);

  const categoryBars = useMemo(() => {
    const dataset = [
      { key: 'posts', label: 'Posts', value: counters.myPosts, color: '#0BAA8A' },
      { key: 'comments', label: 'Comments', value: counters.myComments, color: '#00C2B2' },
      { key: 'likes', label: 'Likes', value: counters.likedPosts + counters.likedComments, color: '#1E8FFF' },
      { key: 'saved', label: 'Saved', value: counters.savedPosts, color: '#F59E0B' },
    ];

    const maxValue = Math.max(...dataset.map((item) => item.value), 1);
    return dataset.map((item) => ({
      ...item,
      pct: Math.max(8, Math.round((item.value / maxValue) * 100)),
    }));
  }, [counters]);

  const monthlyTrend = useMemo(() => {
    const bucket = new Map();
    const seed = [];

    for (let idx = 3; idx >= 0; idx -= 1) {
      const date = new Date();
      date.setDate(1);
      date.setHours(0, 0, 0, 0);
      date.setMonth(date.getMonth() - idx);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const short = date.toLocaleDateString(undefined, { month: 'short' });
      bucket.set(key, 0);
      seed.push({ key, short });
    }

    const allDates = [
      ...activity.myPosts.map((item) => item.createdAt),
      ...activity.myComments.map((item) => item.createdAt),
      ...activity.likedPosts.map((item) => item.createdAt),
      ...activity.savedPosts.map((item) => item.createdAt),
      ...activity.likedComments.map((item) => item.createdAt),
      ...activity.appointments.map((item) => item.scheduledAt || item.createdAt),
    ];

    allDates.forEach((value) => {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return;
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      if (!bucket.has(key)) return;
      bucket.set(key, bucket.get(key) + 1);
    });

    return seed.map((item) => ({ ...item, value: bucket.get(item.key) || 0 }));
  }, [activity]);

  const handleHeroPress = useCallback((key) => {
    setActiveHero(key);
    if (key === 'myPosts') navigation.navigate('PatientPostsActivity');
    if (key === 'myComments') navigation.navigate('PatientCommentsActivity');
    if (key === 'appointments') navigation.navigate('PatientAppointmentsActivity');
  }, [navigation]);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.grey50 }}>
      <LinearGradient colors={['#050E1F', '#0D2147']}>
        <SafeAreaView edges={['top']}>
          <View style={s.headerBar}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={s.iconBtn} hitSlop={HIT}>
              <Feather name="arrow-left" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={s.headerTitle}>My Activity</Text>
            <View style={s.iconBtn} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      <LinearGradient
        colors={['#ECFFFC', '#E2F8F5']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.heroPanel, Shadow.sm]}
      >
        <View style={s.heroPanelHead}>
          <View>
            <Text style={s.heroPanelTitle}>Activity Overview</Text>
            <Text style={s.heroPanelSub}>{totalTracked} tracked actions</Text>
          </View>
          <View style={s.heroPanelTag}>
            <Feather name="activity" size={12} color={Colors.primary} />
            <Text style={s.heroPanelTagText}>Live</Text>
          </View>
        </View>

        <View style={s.heroStatsRow}>
          {heroStats.map((stat) => {
            const isActive = activeHero === stat.key;
            return (
              <TouchableOpacity
                key={stat.key}
                style={[s.heroStatCard, isActive && s.heroStatCardActive]}
                onPress={() => handleHeroPress(stat.key)}
                activeOpacity={0.84}
              >
                <View style={[s.heroStatIconWrap, isActive && s.heroStatIconWrapActive]}>
                  <Feather name={stat.icon} size={14} color={isActive ? Colors.primaryOnDark : Colors.primary} />
                </View>
                <Text style={[s.heroStatValue, isActive && s.heroStatValueActive]}>{stat.value}</Text>
                <Text style={[s.heroStatLabel, isActive && s.heroStatLabelActive]}>{stat.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </LinearGradient>

      <View style={s.insightsWrap}>
        <View style={[s.insightSummaryCard, Shadow.sm]}>
          <View style={s.insightSummaryHead}>
            <Text style={s.insightSummaryTitle}>Activity Insights</Text>
            <Text style={s.insightSummarySub}>Last 4 months</Text>
          </View>
          <View style={s.summaryStatRow}>
            <View style={s.summaryStatItem}>
              <Text style={s.summaryStatValue}>{insightStats.totalInteractions}</Text>
              <Text style={s.summaryStatLabel}>Interactions</Text>
            </View>
            <View style={s.summaryDivider} />
            <View style={s.summaryStatItem}>
              <Text style={s.summaryStatValue}>{insightStats.totalVisits}</Text>
              <Text style={s.summaryStatLabel}>Appointments</Text>
            </View>
            <View style={s.summaryDivider} />
            <View style={s.summaryStatItem}>
              <Text style={s.summaryStatValue}>{insightStats.shareRate}%</Text>
              <Text style={s.summaryStatLabel}>Save rate</Text>
            </View>
          </View>
        </View>

        <View style={[s.chartCard, Shadow.sm]}>
          <Text style={s.chartTitle}>Category Breakdown</Text>
          <View style={s.breakdownList}>
            {categoryBars.map((bar) => (
              <View key={bar.key} style={s.breakdownRow}>
                <Text style={s.breakdownLabel}>{bar.label}</Text>
                <View style={s.breakdownTrack}>
                  <View style={[s.breakdownFill, { width: `${bar.pct}%`, backgroundColor: bar.color }]} />
                </View>
                <Text style={s.breakdownValue}>{bar.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[s.chartCard, Shadow.sm]}>
          <Text style={s.chartTitle}>Monthly Activity Trend</Text>
          <ActivityTrendLineGraph data={monthlyTrend} />
        </View>

        {isLoading ? (
          <View style={s.loaderWrap}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  headerBar: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: Space.s8, paddingVertical: Space.s8 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...Type.d4, color: Colors.textPrimary, flex: 1, textAlign: 'center' },
  heroPanel: {
    marginHorizontal: Space.s16,
    marginTop: Space.s12,
    marginBottom: Space.s4,
    borderRadius: Radius.xl,
    padding: Space.s12,
    borderWidth: 1,
    borderColor: '#C9F0EA',
    gap: Space.s10,
    overflow: 'hidden',
  },
  heroPanelHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Space.s4,
  },
  heroPanelTitle: { ...Type.l1, color: Colors.textOnLight },
  heroPanelSub: { ...Type.b3, color: Colors.textMuted },
  heroPanelTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: Radius.full,
    paddingHorizontal: Space.s8,
    paddingVertical: 4,
    backgroundColor: 'rgba(0,194,178,0.14)',
  },
  heroPanelTagText: { ...Type.l3, color: Colors.primary },
  heroStatsRow: { flexDirection: 'row', gap: Space.s8 },
  heroStatCard: {
    flex: 1,
    minHeight: 78,
    borderRadius: Radius.lg,
    paddingVertical: Space.s10,
    paddingHorizontal: Space.s8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(11,143,121,0.16)',
  },
  heroStatCardActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  heroStatIconWrap: {
    width: 24,
    height: 24,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryDim,
    marginBottom: 2,
  },
  heroStatIconWrapActive: { backgroundColor: 'rgba(255,255,255,0.22)' },
  heroStatValue: { ...Type.d4, color: Colors.textOnLight },
  heroStatValueActive: { color: Colors.primaryOnDark },
  heroStatLabel: { ...Type.l3, color: Colors.textMuted },
  heroStatLabelActive: { color: Colors.primaryOnDark },
  insightsWrap: {
    paddingHorizontal: Space.s16,
    paddingTop: Space.s10,
    gap: Space.s10,
  },
  insightSummaryCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Space.s12,
    borderWidth: 1,
    borderColor: Colors.grey100,
  },
  insightSummaryHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Space.s10,
  },
  insightSummaryTitle: { ...Type.l1, color: Colors.textOnLight },
  insightSummarySub: { ...Type.l3, color: Colors.textMuted },
  summaryStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryStatItem: { flex: 1, alignItems: 'center' },
  summaryStatValue: { ...Type.d4, color: Colors.primary },
  summaryStatLabel: { ...Type.l3, color: Colors.textMuted },
  summaryDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: Colors.grey100,
    marginHorizontal: Space.s4,
  },
  chartCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Space.s12,
    borderWidth: 1,
    borderColor: Colors.grey100,
  },
  chartTitle: { ...Type.l1, color: Colors.textOnLight, marginBottom: Space.s10 },
  breakdownList: { gap: Space.s8 },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.s8,
  },
  breakdownLabel: { ...Type.l3, color: Colors.textMuted, width: 72 },
  breakdownTrack: {
    flex: 1,
    height: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.grey100,
    overflow: 'hidden',
  },
  breakdownFill: {
    height: 7,
    borderRadius: Radius.full,
  },
  breakdownValue: { ...Type.l3, color: Colors.textOnLight, width: 22, textAlign: 'right' },
  lineGraphFrame: {
    height: 120,
    borderRadius: Radius.md,
    backgroundColor: Colors.grey50,
    borderWidth: 1,
    borderColor: Colors.grey100,
    position: 'relative',
    overflow: 'hidden',
  },
  lineGraphGrid: {
    position: 'absolute',
    left: 12,
    right: 12,
    height: 1,
    backgroundColor: Colors.grey100,
  },
  lineGraphSegment: {
    position: 'absolute',
    height: 2,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
  },
  lineGraphDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCard,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  lineGraphLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Space.s8,
    paddingHorizontal: Space.s4,
  },
  lineGraphLabelItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  lineGraphMonth: { ...Type.l3, color: Colors.textMuted },
  lineGraphValue: { ...Type.l3, color: Colors.textOnLight },
  tabsGrid: {
    paddingHorizontal: Space.s16,
    paddingVertical: Space.s12,
    gap: Space.s10,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  activityTile: {
    flexBasis: '48%',
    flexGrow: 1,
    borderWidth: 1,
    borderColor: Colors.grey100,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    paddingHorizontal: Space.s12,
    paddingVertical: Space.s12,
    minHeight: 92,
    justifyContent: 'space-between',
    gap: Space.s6,
  },
  activityTileActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  activityTileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activityTileIconWrap: {
    width: 28,
    height: 28,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryDim,
  },
  activityTileIconWrapActive: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  activityTileCountPill: {
    minWidth: 28,
    height: 24,
    borderRadius: Radius.full,
    paddingHorizontal: Space.s8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.grey50,
  },
  activityTileCountPillActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  activityTileCount: {
    ...Type.l2,
    color: Colors.textOnLight,
  },
  activityTileCountActive: {
    color: Colors.primaryOnDark,
  },
  activityTileLabel: {
    ...Type.l2,
    color: Colors.textOnLight,
  },
  activityTileLabelActive: {
    color: Colors.primaryOnDark,
  },
  activityTileHint: {
    ...Type.l3,
    color: Colors.textMuted,
  },
  activityTileHintActive: {
    color: 'rgba(255,255,255,0.82)',
  },
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
  card: { flexDirection: 'row', alignItems: 'center', gap: Space.s10, height: 92, backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Space.s12 },
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
  cardRightWrap: { width: 90, alignItems: 'flex-end', justifyContent: 'center' },
  timePill: {
    borderRadius: Radius.full,
    paddingHorizontal: Space.s8,
    paddingVertical: Space.s4,
    backgroundColor: Colors.primaryDim,
  },
  cardRight: { ...Type.l3, color: Colors.textMuted, textAlign: 'right' },
});
