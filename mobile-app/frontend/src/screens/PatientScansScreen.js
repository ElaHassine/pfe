import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Type, Space, Radius, HIT } from '../theme';
import { EmptyState, ScanCard, StatCard, SectionHeader } from '../components';
import { scanApi } from '../services/api';

const FILTERS = ['All', 'Today', 'This Week', 'This Month'];

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

function isSameDay(date, now) {
  return (
    date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate()
  );
}

function isInCurrentWeek(date, now) {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 6);

  return date >= start && date <= end;
}

function isInCurrentMonth(date, now) {
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

export default function PatientScansScreen({ navigation, route }) {
  const [filter, setFilter] = useState('All');
  const [riskFilter, setRiskFilter] = useState(route?.params?.riskFilter || 'All');
  const [scans, setScans] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadScans = useCallback(async (mountedRef) => {
    setIsLoading(true);

    try {
      const response = await scanApi.list();

      if (!mountedRef.current) return;

      const mapped = (response.scans || [])
        .map((scan) => ({
          id: scan._id || scan.id,
          trackingGroupId: scan.trackingGroupId || scan._id || scan.id,
          date: scan.createdAt || scan.date || scan.updatedAt || Date.now(),
          notes: scan.notes || '',
          doctorNotes: scan.doctorNotes || '',
          imageUrl: scan.imageUrl,
          location: scan.location,
          riskLevel: normalizeRiskLevel(scan.riskLevel),
          confidence: scan.confidence,
          lesionType: scan.lesionType,
          analysis: scan.analysis,
        }))
        .sort((a, b) => parseTimeMs(b.date) - parseTimeMs(a.date));

      setScans(mapped);
    } catch (_error) {
      if (!mountedRef.current) return;
      setScans([]);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const mountedRef = { current: true };
      loadScans(mountedRef);
      return () => {
        mountedRef.current = false;
      };
    }, [loadScans])
  );

  const highCount = scans.filter((scan) => scan.riskLevel === 'high').length;
  const mediumCount = scans.filter((scan) => scan.riskLevel === 'medium').length;
  const lowCount = scans.filter((scan) => scan.riskLevel === 'low').length;

  const filteredScans = useMemo(() => {
    const now = new Date();

    return scans.filter((scan) => {
      const scanDate = new Date(scan.date);
      if (Number.isNaN(scanDate.getTime())) return false;

      if (filter === 'Today' && !isSameDay(scanDate, now)) return false;
      if (filter === 'This Week' && !isInCurrentWeek(scanDate, now)) return false;
      if (filter === 'This Month' && !isInCurrentMonth(scanDate, now)) return false;
      if (riskFilter !== 'All' && scan.riskLevel !== riskFilter) return false;

      return true;
    });
  }, [filter, riskFilter, scans]);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.grey50 }}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#050E1F', '#0D2147']}>
        <SafeAreaView edges={['top']}>
          <View style={ps.headerRow}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={HIT}
              style={ps.headerIconBtn}
              activeOpacity={0.72}
            >
              <Feather name="arrow-left" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={ps.headerTitle} numberOfLines={1}>Scans</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('LesionTracking')}
              accessibilityRole="button"
              accessibilityLabel="Open scan history"
              hitSlop={HIT}
              style={ps.headerIconBtn}
              activeOpacity={0.72}
            >
              <Feather name="bar-chart-2" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ps.body}>
        <SectionHeader
          title="All Scans"
        />

        <View style={ps.summaryPanel}>
          <LinearGradient colors={['#ECFFFC', '#E2F8F5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={ps.summaryPanelGradient}>
            <View style={ps.summaryPanelTop}>
              <View>
                <Text style={ps.summaryTitle}>Scan Overview</Text>
                <Text style={ps.summarySub}>Quick view of your scan risk breakdown</Text>
              </View>
            </View>

            <View style={ps.summaryRow}>
              <StatCard
                label="Low Risk"
                value={String(lowCount)}
                iconName="check-circle"
                color={Colors.riskLow}
                bg={Colors.riskLowBg}
                style={[{ flex: 1 }, riskFilter === 'low' && ps.summaryCardActiveLow]}
                onPress={() => setRiskFilter((prev) => (prev === 'low' ? 'All' : 'low'))}
              />
              <View style={{ width: Space.s8 }} />
              <StatCard
                label="Medium Risk"
                value={String(mediumCount)}
                iconName="activity"
                color={Colors.riskMed}
                bg={Colors.riskMedBg}
                style={[{ flex: 1 }, riskFilter === 'medium' && ps.summaryCardActiveMedium]}
                onPress={() => setRiskFilter((prev) => (prev === 'medium' ? 'All' : 'medium'))}
              />
              <View style={{ width: Space.s8 }} />
              <StatCard
                label="High Risk"
                value={String(highCount)}
                iconName="alert-circle"
                color={Colors.riskHigh}
                bg={Colors.riskHighBg}
                style={[{ flex: 1 }, riskFilter === 'high' && ps.summaryCardActiveHigh]}
                onPress={() => setRiskFilter((prev) => (prev === 'high' ? 'All' : 'high'))}
              />
            </View>
          </LinearGradient>
        </View>

        {riskFilter !== 'All' && (
          <View style={ps.activeRiskFilterRow}>
            <Text style={ps.activeRiskFilterText}>Risk filter: {riskFilter}</Text>
            <TouchableOpacity
              onPress={() => setRiskFilter('All')}
              activeOpacity={0.72}
              accessibilityRole="button"
              accessibilityLabel="Clear risk filter"
            >
              <Text style={ps.clearRiskFilterText}>Clear</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={ps.filterRow}>
          {FILTERS.map((item) => (
            <TouchableOpacity
              key={item}
              style={[ps.chip, filter === item && ps.chipActive]}
              onPress={() => setFilter(item)}
              accessibilityRole="radio"
              accessibilityLabel={`Filter scans by ${item.toLowerCase()}`}
              accessibilityState={{ checked: filter === item }}
              activeOpacity={0.72}
            >
              <Text style={[ps.chipText, filter === item && ps.chipTextActive]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {isLoading ? (
          <View style={ps.loadingWrap}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : filteredScans.length === 0 ? (
          <EmptyState
            iconName="aperture"
            title={filter === 'All' && riskFilter === 'All' ? 'No scans yet' : 'No matching scans'}
            subtitle={filter === 'All' && riskFilter === 'All' ? 'Your analyzed scans will appear here.' : 'Try changing date/risk filters or capture a new scan.'}
            action="Start Scan"
            onAction={() => navigation.navigate('LesionScan')}
          />
        ) : (
          filteredScans.map((scan) => (
            <ScanCard
              key={scan.id}
              scan={scan}
              onPress={() => navigation.navigate('AIResult', { scan })}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const ps = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Space.s8, paddingVertical: Space.s8, minHeight: 56 },
  headerIconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...Type.d4, color: Colors.textPrimary, flex: 1, textAlign: 'center' },
  summaryPanel: { marginBottom: Space.s16 },
  summaryPanelGradient: { borderRadius: Radius.xl, padding: Space.s16, borderWidth: 1, borderColor: '#C9F0EA' },
  summaryPanelTop: { marginBottom: Space.s12 },
  summaryTitle: { ...Type.d4, color: Colors.textOnLight, marginBottom: 2 },
  summarySub: { ...Type.b3, color: Colors.textMuted },
  summaryRow: { flexDirection: 'row' },
  summaryCardActiveLow: { borderWidth: 1.5, borderColor: Colors.riskLow + '66' },
  summaryCardActiveMedium: { borderWidth: 1.5, borderColor: Colors.riskMed + '66' },
  summaryCardActiveHigh: { borderWidth: 1.5, borderColor: Colors.riskHigh + '66' },
  activeRiskFilterRow: { marginTop: -Space.s6, marginBottom: Space.s12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  activeRiskFilterText: { ...Type.b3, color: Colors.textMuted, textTransform: 'capitalize' },
  clearRiskFilterText: { ...Type.l2, color: Colors.primary },
  body: { paddingHorizontal: Space.s20, paddingTop: Space.s16, paddingBottom: Space.s48 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.s8, marginBottom: Space.s16 },
  chip: { paddingHorizontal: Space.s16, paddingVertical: Space.s8, borderRadius: Radius.full, backgroundColor: Colors.bgCard, borderWidth: 1.5, borderColor: Colors.grey100, minHeight: 36 },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { ...Type.l2, color: Colors.textMuted },
  chipTextActive: { color: Colors.primaryOnDark },
  loadingWrap: { paddingVertical: Space.s24, alignItems: 'center' },
});