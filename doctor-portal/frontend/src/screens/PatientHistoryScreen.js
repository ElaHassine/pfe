import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, useWindowDimensions, Image,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { doctorPortalApi } from '../services/api';
import { riskCfg } from '../services/data';

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function PatientAvatar({ name, avatarUrl, size = 52 }) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  const initials = parts.length ? `${parts[0]?.[0] || 'P'}${parts.length > 1 ? parts[parts.length - 1]?.[0] : parts[0]?.[1] || 'A'}`.toUpperCase() : 'PA';

  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: 'rgba(0,194,178,0.1)', borderWidth: 1.5, borderColor: 'rgba(0,194,178,0.35)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      ) : (
        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: '#00C2B2' }}>{initials}</Text>
      )}
    </View>
  );
}

const RiskPill = ({ level }) => {
  const cfg = riskCfg(level);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: cfg.bg, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 4, borderWidth: 1, borderColor: cfg.border }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: cfg.color }} />
      <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 11, color: cfg.color }}>{cfg.label}</Text>
    </View>
  );
};

export default function PatientHistoryScreen({ navigate, historyContext }) {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState(null);

  const patientId = historyContext?.patientId;
  const backTarget = historyContext?.from || 'patients';

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!patientId) {
        if (mounted) {
          setHistory(null);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        const response = await doctorPortalApi.getPatientHistory(patientId);
        if (!mounted) return;
        setHistory(response || null);
      } catch (_error) {
        if (!mounted) return;
        setHistory(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => { mounted = false; };
  }, [patientId]);

  const scans = history?.scans || [];
  const patient = history?.patient || {};
  const stats = history?.stats || {};

  const timeline = useMemo(() => {
    const scanEvents = scans.map((scan) => ({
      type: 'scan',
      id: `scan-${scan.id}`,
      at: scan.createdAt,
      data: scan,
    }));

    return [...scanEvents]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [scans]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F6F8FB', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#00C2B2" />
      </View>
    );
  }

  if (!history) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F6F8FB', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <Feather name="file-text" size={36} color="#D5DEED" />
        <Text style={{ fontFamily: 'Sora_600SemiBold', fontSize: 18, color: '#3A4560', marginTop: 12 }}>Patient history unavailable</Text>
        <TouchableOpacity onPress={() => navigate(backTarget)} activeOpacity={0.8} style={{ marginTop: 16, backgroundColor: '#00C2B2', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10 }}>
          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: '#050E1F' }}>Back to Patients</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F6F8FB' }}>
      <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#EEF1F6', paddingHorizontal: isTablet ? 28 : 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <TouchableOpacity onPress={() => navigate(backTarget)} activeOpacity={0.75} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#F6F8FB', alignItems: 'center', justifyContent: 'center' }}>
          <Feather name="arrow-left" size={16} color="#6B7A99" />
        </TouchableOpacity>
        <PatientAvatar name={patient.name} avatarUrl={patient.avatarUrl} size={44} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: 'Sora_600SemiBold', fontSize: 17, color: '#1A2235' }}>{patient.name || historyContext?.patientName || 'Patient'}</Text>
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#6B7A99' }}>
            Age {patient.age || '-'} · Joined {formatDate(patient.joinedAt)}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: isTablet ? 28 : 16, paddingBottom: 54 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
          {[
            { label: 'Total Scans', value: stats.totalScans || 0, icon: 'activity', color: '#00C2B2', bg: 'rgba(0,194,178,0.1)' },
            { label: 'High Risk', value: stats.highRiskScans || 0, icon: 'alert-circle', color: '#FF4757', bg: 'rgba(255,71,87,0.1)' },
            { label: 'Pending', value: stats.pendingCases || 0, icon: 'clock', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
            { label: 'Avg Confidence', value: `${stats.averageConfidence || 0}%`, icon: 'bar-chart-2', color: '#6366F1', bg: 'rgba(99,102,241,0.1)' },
          ].map((item) => (
            <View key={item.label} style={{ flexGrow: 1, minWidth: 145, backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#EEF1F6' }}>
              <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: item.bg, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                <Feather name={item.icon} size={15} color={item.color} />
              </View>
              <Text style={{ fontFamily: 'Sora_700Bold', fontSize: 19, color: '#1A2235' }}>{item.value}</Text>
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#6B7A99' }}>{item.label}</Text>
            </View>
          ))}
        </View>

        <View style={{ backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#EEF1F6', padding: 16 }}>
          <Text style={{ fontFamily: 'Sora_600SemiBold', fontSize: 16, color: '#1A2235', marginBottom: 4 }}>Full Timeline</Text>
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#6B7A99', marginBottom: 14 }}>
            Scans and review outcomes to help with better clinical context.
          </Text>

          {timeline.length === 0 ? (
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#A8B4CC' }}>No history records available.</Text>
          ) : timeline.map((event, index) => {
            if (event.type === 'scan') {
              const scan = event.data;
              return (
                <View key={event.id} style={{ borderBottomWidth: index < timeline.length - 1 ? 1 : 0, borderBottomColor: '#F6F8FB', paddingVertical: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: '#1A2235' }}>{scan.lesionType || 'Skin scan'}</Text>
                    <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#A8B4CC' }}>{formatDate(scan.createdAt)}</Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <RiskPill level={scan.riskLevel} />
                    <View style={{ backgroundColor: '#F6F8FB', borderRadius: 99, paddingHorizontal: 9, paddingVertical: 4 }}>
                      <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 11, color: '#6B7A99' }}>Confidence {scan.confidence || 0}%</Text>
                    </View>
                    <View style={{ backgroundColor: scan.status === 'reviewed' ? 'rgba(0,194,178,0.12)' : 'rgba(245,158,11,0.12)', borderRadius: 99, paddingHorizontal: 9, paddingVertical: 4 }}>
                      <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 11, color: scan.status === 'reviewed' ? '#00C2B2' : '#F59E0B', textTransform: 'capitalize' }}>{scan.status}</Text>
                    </View>
                  </View>

                  {scan.imageUrl ? (
                    <View style={{ marginBottom: 8 }}>
                      <Image
                        source={{ uri: scan.imageUrl }}
                        resizeMode="cover"
                        style={{ width: '100%', height: 170, borderRadius: 10, backgroundColor: '#EEF1F6' }}
                      />
                    </View>
                  ) : null}

                  {!!scan.clinicalDiagnosis && (
                    <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#3A4560', marginTop: 2 }}>
                      Diagnosis: {scan.clinicalDiagnosis}
                    </Text>
                  )}
                  {!!scan.doctorNotes && (
                    <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#6B7A99', marginTop: 2 }}>
                      Notes: {scan.doctorNotes}
                    </Text>
                  )}
                </View>
              );
            }

            return null;
          })}
        </View>
      </ScrollView>
    </View>
  );
}