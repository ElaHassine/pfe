import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { doctorPortalApi } from '../services/api';

const Card = ({ children, style }) => (
  <View style={[{
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  }, style]}>
    {children}
  </View>
);

function Stat({ label, value, icon, color }) {
  return (
    <Card style={{ flex: 1, minWidth: 150 }}>
      <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: `${color}1F`, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
        <Feather name={icon} size={17} color={color} />
      </View>
      <Text style={{ fontFamily: 'Sora_700Bold', fontSize: 24, color: '#1A2235', marginBottom: 3 }}>{value}</Text>
      <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#6B7A99' }}>{label}</Text>
    </Card>
  );
}

export default function AnalyticsScreen() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const [cases, setCases] = useState([]);
  const [patients, setPatients] = useState([]);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      doctorPortalApi.listCases(),
      doctorPortalApi.listPatients(),
      doctorPortalApi.getNotifications(),
    ]).then(([casesRes, patientsRes, notifRes]) => {
      if (!mounted) return;
      setCases(casesRes.cases || []);
      setPatients(patientsRes.patients || []);
      setNotifications(notifRes.notifications || []);
    }).catch(() => {
      if (!mounted) return;
      setCases([]);
      setPatients([]);
      setNotifications([]);
    });

    return () => { mounted = false; };
  }, []);

  const stats = useMemo(() => {
    const totalCases = cases.length;
    const pending = cases.filter((item) => item.status === 'pending').length;
    const reviewed = cases.filter((item) => item.status === 'reviewed').length;
    const highRisk = cases.filter((item) => item.riskLevel === 'high').length;
    const mediumRisk = cases.filter((item) => item.riskLevel === 'medium').length;
    const lowRisk = cases.filter((item) => item.riskLevel === 'low').length;
    const avgConfidence = totalCases ? Math.round(cases.reduce((sum, item) => sum + (item.confidence || 0), 0) / totalCases) : 0;
    const pendingBookings = notifications.filter((item) => item.status === 'pending').length;

    return {
      totalCases,
      pending,
      reviewed,
      highRisk,
      mediumRisk,
      lowRisk,
      avgConfidence,
      pendingBookings,
      totalPatients: patients.length,
    };
  }, [cases, patients, notifications]);

  const riskBars = [
    { label: 'High risk', value: stats.highRisk, color: '#FF4757' },
    { label: 'Moderate risk', value: stats.mediumRisk, color: '#F59E0B' },
    { label: 'Low risk', value: stats.lowRisk, color: '#00C48C' },
  ];
  const maxRisk = Math.max(1, ...riskBars.map((item) => item.value));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F6F8FB' }} contentContainerStyle={{ padding: isTablet ? 28 : 16, paddingBottom: 50 }}>
      <Text style={{ fontFamily: 'Sora_700Bold', fontSize: isTablet ? 28 : 22, color: '#1A2235', marginBottom: 6 }}>Analytics</Text>
      <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#6B7A99', marginBottom: 22 }}>Performance and case trends for your contacted patients.</Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 22 }}>
        <Stat label="Total cases" value={stats.totalCases} icon="folder" color="#00C2B2" />
        <Stat label="Pending review" value={stats.pending} icon="clock" color="#F59E0B" />
        <Stat label="Reviewed" value={stats.reviewed} icon="check-circle" color="#00C48C" />
        <Stat label="Avg confidence" value={`${stats.avgConfidence}%`} icon="cpu" color="#6366F1" />
      </View>

      <View style={{ flexDirection: isTablet ? 'row' : 'column', gap: 12 }}>
        <Card style={{ flex: 1 }}>
          <Text style={{ fontFamily: 'Sora_600SemiBold', fontSize: 15, color: '#1A2235', marginBottom: 14 }}>Risk distribution</Text>
          {riskBars.map((bar) => (
            <View key={bar.label} style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#6B7A99' }}>{bar.label}</Text>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: '#1A2235' }}>{bar.value}</Text>
              </View>
              <View style={{ height: 7, borderRadius: 999, backgroundColor: '#EEF1F6', overflow: 'hidden' }}>
                <View style={{ width: `${Math.round((bar.value / maxRisk) * 100)}%`, height: 7, borderRadius: 999, backgroundColor: bar.color }} />
              </View>
            </View>
          ))}
        </Card>

        <Card style={{ flex: 1 }}>
          <Text style={{ fontFamily: 'Sora_600SemiBold', fontSize: 15, color: '#1A2235', marginBottom: 14 }}>Operational summary</Text>
          {[
            { label: 'Contacted patients', value: stats.totalPatients, icon: 'users', color: '#00C2B2' },
            { label: 'High-risk cases', value: stats.highRisk, icon: 'alert-circle', color: '#FF4757' },
            { label: 'Pending booking requests', value: stats.pendingBookings, icon: 'bell', color: '#F59E0B' },
            { label: 'Reviewed ratio', value: stats.totalCases ? `${Math.round((stats.reviewed / stats.totalCases) * 100)}%` : '0%', icon: 'bar-chart-2', color: '#6366F1' },
          ].map((item) => (
            <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#F0F2F7' }}>
              <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: `${item.color}22`, alignItems: 'center', justifyContent: 'center' }}>
                <Feather name={item.icon} size={16} color={item.color} />
              </View>
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#6B7A99', flex: 1 }}>{item.label}</Text>
              <Text style={{ fontFamily: 'Sora_700Bold', fontSize: 14, color: '#1A2235' }}>{item.value}</Text>
            </View>
          ))}
        </Card>
      </View>
    </ScrollView>
  );
}
