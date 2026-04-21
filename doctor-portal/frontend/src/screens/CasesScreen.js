import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, useWindowDimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { riskCfg } from '../services/data';
import { doctorPortalApi } from '../services/api';

const FILTERS = ['All', 'Pending', 'Reviewed', 'High Risk'];

const RiskPill = ({ level }) => {
  const cfg = riskCfg(level);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: cfg.bg, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 4, borderWidth: 1, borderColor: cfg.border }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: cfg.color }} />
      <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 11, color: cfg.color }}>{cfg.label}</Text>
    </View>
  );
};

export default function CasesScreen({ navigate }) {
  const { width } = useWindowDimensions();
  const isTablet  = width >= 768;
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState('All');
  const [sortBy, setSortBy]   = useState('date');
  const [cases, setCases] = useState([]);

  useEffect(() => {
    let mounted = true;
    doctorPortalApi.listCases().then(({ cases: list }) => {
      if (mounted) setCases(list || []);
    }).catch(() => {
      if (mounted) setCases([]);
    });
    return () => { mounted = false; };
  }, []);

  const filtered = cases.filter(c => {
    const matchSearch = c.patientName.toLowerCase().includes(search.toLowerCase()) || c.lesionType.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === 'All'       ? true :
      filter === 'Pending'   ? c.status   === 'pending' :
      filter === 'Reviewed'  ? c.status   === 'reviewed' :
      filter === 'High Risk' ? c.riskLevel === 'high' : true;
    return matchSearch && matchFilter;
  });

  return (
    <View style={{ flex: 1, backgroundColor: '#F6F8FB' }}>
      {/* Header bar */}
      <View style={{
        backgroundColor: '#fff',
        paddingHorizontal: isTablet ? 32 : 16,
        paddingVertical: 20,
        borderBottomWidth: 1, borderBottomColor: '#EEF1F6',
        flexDirection: isTablet ? 'row' : 'column',
        alignItems: isTablet ? 'center' : 'flex-start',
        gap: 16,
      }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: 'Sora_700Bold', fontSize: 22, color: '#1A2235' }}>Case Queue</Text>
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#6B7A99', marginTop: 2 }}>
            {filtered.length} case{filtered.length !== 1 ? 's' : ''} · {cases.filter(c => c.status === 'pending').length} pending
          </Text>
        </View>

        {/* Search */}
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F6F8FB', borderRadius: 10, borderWidth: 1.5, borderColor: '#DDE3EE', paddingHorizontal: 12, minHeight: 44, width: isTablet ? 280 : '100%' }}>
          <Feather name="search" size={16} color="#A8B4CC" style={{ marginRight: 8 }} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search patients or lesion type..."
            placeholderTextColor="#A8B4CC"
            style={{ flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#1A2235' }}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Feather name="x" size={14} color="#A8B4CC" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter chips */}
      <View style={{ backgroundColor: '#fff', paddingHorizontal: isTablet ? 32 : 16, paddingBottom: 14, paddingTop: 10, borderBottomWidth: 1, borderBottomColor: '#EEF1F6', flexDirection: 'row', gap: 8 }}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            activeOpacity={0.75}
            accessibilityRole="radio"
            accessibilityState={{ checked: filter === f }}
            style={{
              paddingHorizontal: 14, paddingVertical: 7,
              borderRadius: 99, minHeight: 34,
              backgroundColor: filter === f ? '#00C2B2' : '#F6F8FB',
              borderWidth: 1.5,
              borderColor: filter === f ? '#00C2B2' : '#DDE3EE',
            }}
          >
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: filter === f ? '#050E1F' : '#6B7A99' }}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Cases table/list */}
      <ScrollView contentContainerStyle={{ padding: isTablet ? 32 : 16, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        {isTablet ? (
          // Table view for tablet+
          <View style={{ backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 3 }}>
            {/* Table header */}
            <View style={{ flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#F6F8FB', borderBottomWidth: 1, borderBottomColor: '#EEF1F6' }}>
              {[{ label: 'Patient', flex: 2 }, { label: 'Lesion Type', flex: 2 }, { label: 'Risk', flex: 1 }, { label: 'Confidence', flex: 1 }, { label: 'Date', flex: 1 }, { label: 'Status', flex: 1 }, { label: '', flex: 0.5 }].map((col, i) => (
                <Text key={i} style={{ flex: col.flex, fontFamily: 'DMSans_500Medium', fontSize: 12, color: '#A8B4CC', textTransform: 'uppercase', letterSpacing: 0.8 }}>{col.label}</Text>
              ))}
            </View>

            {/* Rows */}
            {filtered.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 48 }}>
                <Feather name="inbox" size={36} color="#DDE3EE" />
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: '#A8B4CC', marginTop: 12 }}>No cases found</Text>
              </View>
            ) : filtered.map((c, idx) => (
              <TouchableOpacity
                key={c.id}
                onPress={() => navigate('case', { caseData: c })}
                activeOpacity={0.82}
                style={{
                  flexDirection: 'row', alignItems: 'center',
                  paddingHorizontal: 20, paddingVertical: 14,
                  borderBottomWidth: idx < filtered.length - 1 ? 1 : 0,
                  borderBottomColor: '#F6F8FB',
                  backgroundColor: c.priority ? 'rgba(255,71,87,0.02)' : '#fff',
                }}
              >
                {c.priority && <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: '#FF4757' }} />}

                {/* Patient */}
                <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,194,178,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: '#00C2B2' }}>
                      {c.patientName.split(' ').map(n => n[0]).join('')}
                    </Text>
                  </View>
                  <View>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: '#1A2235' }}>{c.patientName}</Text>
                    <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#A8B4CC' }}>Age {c.patientAge}</Text>
                  </View>
                </View>

                <Text style={{ flex: 2, fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#3A4560' }}>{c.lesionType}</Text>
                <View style={{ flex: 1 }}><RiskPill level={c.riskLevel} /></View>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{ height: 4, width: 48, backgroundColor: '#EEF1F6', borderRadius: 2, overflow: 'hidden' }}>
                    <View style={{ height: 4, width: `${c.confidence}%`, backgroundColor: riskCfg(c.riskLevel).color, borderRadius: 2 }} />
                  </View>
                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: '#6B7A99' }}>{c.confidence}%</Text>
                </View>
                <Text style={{ flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#A8B4CC' }}>
                  {new Date(c.scanDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
                <View style={{ flex: 1 }}>
                  <View style={{
                    paddingHorizontal: 9, paddingVertical: 3, borderRadius: 99, alignSelf: 'flex-start',
                    backgroundColor: c.status === 'reviewed' ? 'rgba(0,196,140,0.1)' : 'rgba(245,158,11,0.1)',
                  }}>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 11, color: c.status === 'reviewed' ? '#00C48C' : '#F59E0B' }}>
                      {c.status === 'reviewed' ? 'Reviewed' : 'Pending'}
                    </Text>
                  </View>
                </View>
                <View style={{ flex: 0.5, alignItems: 'flex-end' }}>
                  <Feather name="chevron-right" size={16} color="#DDE3EE" />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          // Card view for mobile
          filtered.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 60 }}>
              <Feather name="inbox" size={40} color="#DDE3EE" />
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 16, color: '#A8B4CC', marginTop: 14 }}>No cases found</Text>
            </View>
          ) : filtered.map(c => (
            <TouchableOpacity
              key={c.id}
              onPress={() => navigate('case', { caseData: c })}
              activeOpacity={0.82}
              style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, flexDirection: 'row', gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 }}
            >
              {c.priority && <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: '#FF4757', borderTopLeftRadius: 14, borderBottomLeftRadius: 14 }} />}
              <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,194,178,0.1)', alignItems: 'center', justifyContent: 'center', marginLeft: c.priority ? 6 : 0 }}>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: '#00C2B2' }}>{c.patientName.split(' ').map(n => n[0]).join('')}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: '#1A2235' }}>{c.patientName}</Text>
                  <RiskPill level={c.riskLevel} />
                </View>
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#3A4560', marginBottom: 6 }}>{c.lesionType}</Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#A8B4CC' }}>{c.confidence}% AI confidence</Text>
                  <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#A8B4CC' }}>{new Date(c.scanDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
                </View>
              </View>
              <Feather name="chevron-right" size={16} color="#DDE3EE" style={{ alignSelf: 'center' }} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}
