import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { riskCfg } from '../services/data';
import { doctorPortalApi } from '../services/api';

const Card = ({ children, style }) => (
  <View style={[{
    backgroundColor: '#fff', borderRadius: 16, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 10, elevation: 3,
  }, style]}>
    {children}
  </View>
);

const SectionLabel = ({ children }) => (
  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 11, color: '#A8B4CC', letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 12 }}>
    {children}
  </Text>
);

const RiskPill = ({ level }) => {
  const cfg = riskCfg(level);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: cfg.bg, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: cfg.border }}>
      <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: cfg.color }} />
      <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: cfg.color }}>{cfg.label}</Text>
    </View>
  );
};

export default function CaseDetailScreen({ caseData: c, navigate }) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1280;
  const isTablet  = width >= 768;

  const cfg = riskCfg(c?.riskLevel);
  const [diagnosis,   setDiagnosis]   = useState('');
  const [rec,         setRec]         = useState('');
  const [notes,       setNotes]       = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [errors,      setErrors]      = useState({});
  const [submitted,   setSubmitted]   = useState(false);

  if (!c) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: 'DMSans_400Regular', color: '#6B7A99' }}>No case selected</Text>
      </View>
    );
  }

  const ABCDE = [
    { k: 'A', label: 'Asymmetry', value: 'Moderate asymmetry detected',  flag: true  },
    { k: 'B', label: 'Border',    value: 'Irregular, notched edges',       flag: true  },
    { k: 'C', label: 'Color',     value: 'Multiple shades present',        flag: true  },
    { k: 'D', label: 'Diameter',  value: '~' + (c.lesionType.includes('Melanoma') ? '11' : '6') + 'mm', flag: false },
    { k: 'E', label: 'Evolution', value: 'Change reported by patient',     flag: true  },
  ];

  const RECS = [
    { val: 'monitor',  icon: 'calendar',     label: 'Monitor',  desc: '3-month rescan'  },
    { val: 'biopsy',   icon: 'aperture',     label: 'Biopsy',   desc: 'Tissue sample'   },
    { val: 'excision', icon: 'scissors',     label: 'Excision', desc: 'Surgical removal' },
    { val: 'urgent',   icon: 'alert-octagon',label: 'Urgent',   desc: 'Immediate care'  },
  ];

  const handleSubmit = async () => {
    if (!diagnosis.trim()) { 
      setErrors({ diagnosis: 'Clinical diagnosis is required' }); 
      return; 
    }

    setSubmitting(true);
    try {
      const response = await doctorPortalApi.submitScanReview(c.id, {
        clinicalDiagnosis: diagnosis,
        recommendation: rec,
        doctorNotes: notes,
      });

      if (response?.message) {
        setSubmitting(false);
        setSubmitted(true);
      }
    } catch (error) {
      setSubmitting(false);
      Alert.alert('Error', error?.message || 'Failed to submit diagnosis');
    }
  };

  if (submitted) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F6F8FB', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(0,196,140,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
          <Feather name="check-circle" size={40} color="#00C48C" />
        </View>
        <Text style={{ fontFamily: 'Sora_700Bold', fontSize: 24, color: '#1A2235', marginBottom: 8, textAlign: 'center' }}>Response Sent</Text>
        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 15, color: '#6B7A99', textAlign: 'center', lineHeight: 24, marginBottom: 32 }}>
          Your diagnosis has been sent to {c.patientName}. They'll be notified via the Lesio mobile app.
        </Text>
        <TouchableOpacity
          onPress={() => navigate('cases')}
          activeOpacity={0.85}
          style={{ backgroundColor: '#00C2B2', borderRadius: 999, paddingHorizontal: 32, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}
        >
          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: '#050E1F' }}>Back to Cases</Text>
          <Feather name="arrow-right" size={15} color="#050E1F" />
        </TouchableOpacity>
      </View>
    );
  }

  const LeftPanel = () => (
    <View style={{ flex: isDesktop ? 1 : 1, gap: 16 }}>

      {/* Patient info */}
      <Card>
        <SectionLabel>Patient</SectionLabel>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(0,194,178,0.1)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 16, color: '#00C2B2' }}>
              {c.patientName.split(' ').map(n => n[0]).join('')}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'Sora_600SemiBold', fontSize: 16, color: '#1A2235', marginBottom: 2 }}>{c.patientName}</Text>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#6B7A99' }}>Age {c.patientAge}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
              <Feather name="map-pin" size={12} color="#A8B4CC" />
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#A8B4CC' }}>{c.location}</Text>
            </View>
          </View>
          <RiskPill level={c.riskLevel} />
        </View>

        <TouchableOpacity
          onPress={() => navigate('patient-history', {
            historyContext: {
              patientId: c.patientId,
              patientName: c.patientName,
              from: 'case',
            },
          })}
          activeOpacity={0.8}
          style={{ marginTop: 12, alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: 'rgba(0,194,178,0.12)', borderWidth: 1, borderColor: 'rgba(0,194,178,0.35)' }}
        >
          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: '#00A99D' }}>View Full History</Text>
        </TouchableOpacity>
      </Card>

      {/* Lesion images */}
      <Card>
        <SectionLabel>Lesion Images</SectionLabel>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {['Captured Image', 'AI Heatmap'].map((label, i) => (
            <View key={i} style={{ flex: 1 }}>
              <View style={{ height: isTablet ? 160 : 120, backgroundColor: '#F6F8FB', borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 6, borderWidth: 1, borderColor: '#EEF1F6' }}>
                <Ionicons name={i === 0 ? 'scan-outline' : 'cellular-outline'} size={40} color="#DDE3EE" />
              </View>
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#A8B4CC', textAlign: 'center' }}>{label}</Text>
            </View>
          ))}
        </View>
      </Card>

      {/* AI Analysis */}
      <Card style={{ borderLeftWidth: 4, borderLeftColor: cfg.color }}>
        <SectionLabel>AI Analysis</SectionLabel>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <View>
            <Text style={{ fontFamily: 'Sora_600SemiBold', fontSize: 16, color: '#1A2235', marginBottom: 3 }}>{c.lesionType}</Text>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#6B7A99' }}>AI Confidence: {c.confidence}%</Text>
          </View>
          <RiskPill level={c.riskLevel} />
        </View>
        <View style={{ height: 6, backgroundColor: '#EEF1F6', borderRadius: 3, overflow: 'hidden', marginBottom: 16 }}>
          <View style={{ height: 6, width: `${c.confidence}%`, backgroundColor: cfg.color, borderRadius: 3 }} />
        </View>

        {/* ABCDE */}
        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: '#A8B4CC', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>ABCDE Assessment</Text>
        {ABCDE.map(item => (
          <View key={item.k} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F6F8FB' }}>
            <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: item.flag ? 'rgba(245,158,11,0.1)' : 'rgba(0,194,178,0.1)', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: 'Sora_700Bold', fontSize: 14, color: item.flag ? '#F59E0B' : '#00C2B2' }}>{item.k}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: '#A8B4CC', marginBottom: 1 }}>{item.label}</Text>
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: item.flag ? '#F59E0B' : '#3A4560' }}>{item.value}</Text>
            </View>
            {item.flag && <Feather name="alert-triangle" size={14} color="#F59E0B" />}
          </View>
        ))}
      </Card>

      {/* Patient notes */}
      <Card>
        <SectionLabel>Patient Notes</SectionLabel>
        <View style={{ backgroundColor: '#F6F8FB', borderRadius: 10, padding: 14, borderLeftWidth: 3, borderLeftColor: '#DDE3EE' }}>
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#3A4560', lineHeight: 22 }}>{c.notes}</Text>
        </View>
      </Card>
    </View>
  );

  const RightPanel = () => (
    <View style={{ flex: isDesktop ? 1 : 1, gap: 16 }}>
      <Card>
        <SectionLabel>Your Diagnosis</SectionLabel>

        {/* Clinical diagnosis */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: '#3A4560', marginBottom: 8 }}>
            Clinical Diagnosis <Text style={{ color: '#FF4757' }}>*</Text>
          </Text>
          <TextInput
            value={diagnosis}
            onChangeText={v => { setDiagnosis(v); setErrors({}); }}
            placeholder="Enter your clinical diagnosis..."
            placeholderTextColor="#A8B4CC"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            style={[{
              backgroundColor: '#F6F8FB',
              borderWidth: 1.5, borderRadius: 10,
              padding: 14,
              fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#1A2235',
              minHeight: 100,
            }, errors.diagnosis && { borderColor: '#FF4757' }, !errors.diagnosis && { borderColor: '#DDE3EE' }]}
          />
          {errors.diagnosis && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 }}>
              <Feather name="alert-circle" size={12} color="#FF4757" />
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#FF4757' }}>{errors.diagnosis}</Text>
            </View>
          )}
        </View>

        {/* Recommendation */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: '#3A4560', marginBottom: 10 }}>Recommendation</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {RECS.map(r => (
              <TouchableOpacity
                key={r.val}
                onPress={() => setRec(r.val)}
                activeOpacity={0.78}
                accessibilityRole="radio"
                accessibilityState={{ checked: rec === r.val }}
                style={{
                  flex: 1, minWidth: '45%',
                  flexDirection: 'row', alignItems: 'center', gap: 8,
                  padding: 12, borderRadius: 10, borderWidth: 1.5,
                  backgroundColor: rec === r.val ? 'rgba(0,194,178,0.08)' : '#F6F8FB',
                  borderColor:     rec === r.val ? '#00C2B2'               : '#DDE3EE',
                }}
              >
                <Feather name={r.icon} size={16} color={rec === r.val ? '#00C2B2' : '#A8B4CC'} />
                <View>
                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: rec === r.val ? '#00C2B2' : '#3A4560' }}>{r.label}</Text>
                  <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: '#A8B4CC' }}>{r.desc}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Additional notes */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: '#3A4560', marginBottom: 8 }}>Additional Notes for Patient</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Any additional guidance or follow-up instructions..."
            placeholderTextColor="#A8B4CC"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            style={{
              backgroundColor: '#F6F8FB', borderWidth: 1.5,
              borderColor: '#DDE3EE', borderRadius: 10,
              padding: 14, fontFamily: 'DMSans_400Regular',
              fontSize: 14, color: '#1A2235', minHeight: 100,
            }}
          />
        </View>

        {/* Submit */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.85}
          style={{
            backgroundColor: submitting ? '#A8B4CC' : '#00C2B2',
            borderRadius: 999, minHeight: 50,
            alignItems: 'center', justifyContent: 'center',
            flexDirection: 'row', gap: 8,
            shadowColor: '#00C2B2',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: submitting ? 0 : 0.28,
            shadowRadius: 14, elevation: 4,
          }}
        >
          {submitting
            ? <ActivityIndicator color="#fff" size="small" />
            : <>
                <Feather name="send" size={16} color="#050E1F" />
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: '#050E1F' }}>Send Response to Patient</Text>
              </>
          }
        </TouchableOpacity>
      </Card>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#F6F8FB' }}>
      {/* Top bar */}
      <View style={{
        backgroundColor: '#fff',
        paddingHorizontal: isTablet ? 32 : 16,
        paddingVertical: 16,
        borderBottomWidth: 1, borderBottomColor: '#EEF1F6',
        flexDirection: 'row', alignItems: 'center', gap: 16,
      }}>
        <TouchableOpacity
          onPress={() => navigate('cases')}
          activeOpacity={0.75}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingRight: 8 }}
        >
          <Feather name="arrow-left" size={18} color="#6B7A99" />
          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: '#6B7A99' }}>Cases</Text>
        </TouchableOpacity>

        <View style={{ width: 1, height: 18, backgroundColor: '#EEF1F6' }} />

        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: 'Sora_600SemiBold', fontSize: 17, color: '#1A2235' }}>
            {c.patientName}
          </Text>
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#6B7A99' }}>
            {c.lesionType} · {new Date(c.scanDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </Text>
        </View>

        {c.priority && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,71,87,0.1)', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(255,71,87,0.25)' }}>
            <Feather name="alert-circle" size={12} color="#FF4757" />
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: '#FF4757' }}>Priority</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <ScrollView
        contentContainerStyle={{ padding: isTablet ? 32 : 16, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 20 }}>
          <LeftPanel />
          <RightPanel />
        </View>
      </ScrollView>
    </View>
  );
}
