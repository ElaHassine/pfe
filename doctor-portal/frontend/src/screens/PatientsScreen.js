import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, useWindowDimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { riskCfg } from '../services/data';
import { doctorPortalApi } from '../services/api';

const RiskPill = ({ level }) => {
  const cfg = riskCfg(level);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: cfg.bg, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 4, borderWidth: 1, borderColor: cfg.border }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: cfg.color }} />
      <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 11, color: cfg.color }}>{cfg.label}</Text>
    </View>
  );
};

export default function PatientsScreen({ navigate }) {
  const { width }  = useWindowDimensions();
  const isTablet   = width >= 768;
  const isDesktop  = width >= 1024;
  const [search, setSearch] = useState('');
  const [patients, setPatients] = useState([]);
  const [cases, setCases] = useState([]);

  useEffect(() => {
    let mounted = true;
    Promise.all([doctorPortalApi.listPatients(), doctorPortalApi.listCases()]).then(([patientsRes, casesRes]) => {
      if (!mounted) return;
      setPatients(patientsRes.patients || []);
      setCases(casesRes.cases || []);
    }).catch(() => {
      if (!mounted) return;
      setPatients([]);
      setCases([]);
    });
    return () => { mounted = false; };
  }, []);

  const filtered = patients.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#F6F8FB' }}>
      {/* Header */}
      <View style={{
        backgroundColor: '#fff', paddingHorizontal: isTablet ? 32 : 16, paddingVertical: 20,
        borderBottomWidth: 1, borderBottomColor: '#EEF1F6',
        flexDirection: isTablet ? 'row' : 'column', alignItems: isTablet ? 'center' : 'flex-start', gap: 16,
      }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: 'Sora_700Bold', fontSize: 22, color: '#1A2235' }}>Patients</Text>
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#6B7A99', marginTop: 2 }}>
            {filtered.length} patient{filtered.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F6F8FB', borderRadius: 10, borderWidth: 1.5, borderColor: '#DDE3EE', paddingHorizontal: 12, minHeight: 44, width: isTablet ? 260 : '100%' }}>
          <Feather name="search" size={16} color="#A8B4CC" style={{ marginRight: 8 }} />
          <TextInput value={search} onChangeText={setSearch} placeholder="Search patients..." placeholderTextColor="#A8B4CC" style={{ flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#1A2235' }} />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: isTablet ? 32 : 16, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>

        {/* Summary cards */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          {[
            { label: 'Total Patients', value: patients.length, icon: 'users',       color: '#00C2B2', bg: 'rgba(0,194,178,0.1)'    },
            { label: 'High Risk',      value: patients.filter(p => p.riskLevel === 'high').length, icon: 'alert-circle', color: '#FF4757', bg: 'rgba(255,71,87,0.1)' },
            { label: 'Active Cases',   value: cases.filter(c => c.status === 'pending').length, icon: 'folder', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
          ].map((st, i) => (
            <View key={i} style={{ flex: 1, minWidth: isDesktop ? 0 : 140, backgroundColor: '#fff', borderRadius: 14, padding: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 }}>
              <View style={{ width: 38, height: 38, borderRadius: 9, backgroundColor: st.bg, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                <Feather name={st.icon} size={18} color={st.color} />
              </View>
              <Text style={{ fontFamily: 'Sora_700Bold', fontSize: 22, color: '#1A2235', marginBottom: 3 }}>{st.value}</Text>
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#6B7A99' }}>{st.label}</Text>
            </View>
          ))}
        </View>

        {/* Patient list */}
        <View style={{ backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 3 }}>
          {isTablet && (
            <View style={{ flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#F6F8FB', borderBottomWidth: 1, borderBottomColor: '#EEF1F6' }}>
              {[{ l: 'Patient', f: 2 }, { l: 'Age', f: 0.6 }, { l: 'Total Scans', f: 1 }, { l: 'Last Scan', f: 1 }, { l: 'Risk Level', f: 1 }, { l: '', f: 0.5 }].map((col, i) => (
                <Text key={i} style={{ flex: col.f, fontFamily: 'DMSans_500Medium', fontSize: 11, color: '#A8B4CC', textTransform: 'uppercase', letterSpacing: 0.8 }}>{col.l}</Text>
              ))}
            </View>
          )}

          {filtered.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 48 }}>
              <Feather name="users" size={36} color="#DDE3EE" />
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: '#A8B4CC', marginTop: 12 }}>No patients found</Text>
            </View>
          ) : filtered.map((p, idx) => (
            <TouchableOpacity
              key={p.id}
              onPress={() => {
                navigate('patient-history', {
                  historyContext: {
                    patientId: p.id,
                    patientName: p.name,
                    from: 'patients',
                  },
                });
              }}
              activeOpacity={0.82}
              style={{
                flexDirection: isTablet ? 'row' : 'column',
                alignItems: isTablet ? 'center' : 'flex-start',
                paddingHorizontal: 20, paddingVertical: 14,
                borderBottomWidth: idx < filtered.length - 1 ? 1 : 0,
                borderBottomColor: '#F6F8FB',
                gap: isTablet ? 0 : 10,
              }}
            >
              {/* Patient name + avatar */}
              <View style={{ flex: isTablet ? 2 : 1, flexDirection: 'row', alignItems: 'center', gap: 12, width: isTablet ? undefined : '100%' }}>
                <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,194,178,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: '#00C2B2' }}>
                    {p.name.split(' ').map(n => n[0]).join('')}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: '#1A2235' }}>{p.name}</Text>
                  {!isTablet && <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#A8B4CC' }}>Age {p.age} · {p.scans} scans</Text>}
                </View>
                {!isTablet && <RiskPill level={p.riskLevel} />}
              </View>

              {isTablet && <>
                <Text style={{ flex: 0.6, fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#6B7A99' }}>{p.age}</Text>
                <Text style={{ flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#6B7A99' }}>{p.scans} scans</Text>
                <Text style={{ flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#6B7A99' }}>
                  {new Date(p.lastScan).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
                <View style={{ flex: 1 }}><RiskPill level={p.riskLevel} /></View>
                <View style={{ flex: 0.5, alignItems: 'flex-end' }}>
                  <Feather name="chevron-right" size={16} color="#DDE3EE" />
                </View>
              </>}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
