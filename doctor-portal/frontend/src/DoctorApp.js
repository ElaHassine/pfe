import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Image,
  useWindowDimensions, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';

import DashboardScreen  from './screens/DashboardScreen';
import CasesScreen      from './screens/CasesScreen';
import CaseDetailScreen from './screens/CaseDetailScreen';
import PatientsScreen   from './screens/PatientsScreen';
import ChatScreen       from './screens/ChatScreen';
import CalendarScreen   from './screens/CalendarScreen';
import AnalyticsScreen  from './screens/AnalyticsScreen';
import ReviewsScreen    from './screens/ReviewsScreen';
import SettingsScreen   from './screens/SettingsScreen';
import PatientHistoryScreen from './screens/PatientHistoryScreen';
import BlogsScreen      from './screens/BlogsScreen';
import LoginScreen      from './screens/LoginScreen';
import { doctorAuthApi, doctorPortalApi, clearAuthToken, setAuthToken } from './services/api';

// ─── Nav items ────────────────────────────────────────────────────────────────
const NAV = [
  { id: 'dashboard', icon: 'grid',       label: 'Dashboard'  },
  { id: 'cases',     icon: 'folder',     label: 'Cases' },
  { id: 'patients',  icon: 'users',      label: 'Patients'   },
  { id: 'calendar',  icon: 'calendar',   label: 'Calendar'   },
  { id: 'messages',  icon: 'message-circle', label: 'Chat' },
  { id: 'analytics', icon: 'bar-chart-2',label: 'Analytics'  },
  { id: 'reviews',   icon: 'star',       label: 'Reviews'    },
  { id: 'blogs',     icon: 'book-open',  label: 'Blogs'      },
  { id: 'settings',  icon: 'settings',   label: 'Settings'   },
];

function doctorInitials(doctor) {
  const first = String(doctor?.profile?.firstName || '').trim();
  const last = String(doctor?.profile?.lastName || '').trim();
  if (first || last) return `${first[0] || ''}${last[0] || first[1] || ''}`.toUpperCase();

  const fallbackName = String(doctor?.profile?.fullName || doctor?.email || 'DR')
    .replace(/^(dr\.?|doctor|prof\.?)\s+/i, '')
    .trim();
  const parts = fallbackName.split(/\s+/).filter(Boolean);
  if (!parts.length) return 'DR';
  const a = parts[0]?.[0] || 'D';
  const b = (parts.length > 1 ? parts[parts.length - 1]?.[0] : parts[0]?.[1]) || 'R';
  return `${a}${b}`.toUpperCase();
}

export default function DoctorApp() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const isTablet  = width >= 768;

  const [authed, setAuthed]         = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [activeScreen, setScreen]   = useState('dashboard');
  const [selectedCase, setCase]     = useState(null);
  const [sidebarOpen, setSidebar]   = useState(false);
  const [doctor, setDoctor]         = useState(null);
  const [caseCount, setCaseCount]   = useState(0);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [historyContext, setHistoryContext] = useState(null);

  useEffect(() => {
    let mounted = true;

    const hydrateSession = async () => {
      try {
        const currentDoctor = await doctorAuthApi.me();
        if (!mounted) return;
        setDoctor(currentDoctor.doctor || null);
        setAuthed(true);
      } catch (_error) {
        if (!mounted) return;
        clearAuthToken();
        setDoctor(null);
        setAuthed(false);
      } finally {
        if (mounted) setSessionLoading(false);
      }
    };

    hydrateSession();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;

    if (!authed) {
      setCaseCount(0);
      return () => { mounted = false; };
    }

    const loadCaseCount = async () => {
      try {
        const response = await doctorPortalApi.listCases();
        if (!mounted) return;
        setCaseCount((response?.cases || []).length);
      } catch (_error) {
        if (!mounted) return;
        setCaseCount(0);
      }
    };

    loadCaseCount();
    return () => { mounted = false; };
  }, [authed, activeScreen]);

  useEffect(() => {
    let mounted = true;

    if (!authed) {
      setUnreadChatCount(0);
      return () => { mounted = false; };
    }

    const loadUnreadChatCount = async () => {
      try {
        const response = await doctorPortalApi.listChatThreads();
        if (!mounted) return;
        const totalUnread = (response?.threads || []).reduce((sum, thread) => sum + (thread.unread || 0), 0);
        setUnreadChatCount(totalUnread);
      } catch (_error) {
        if (!mounted) return;
        setUnreadChatCount(0);
      }
    };

    loadUnreadChatCount();
    return () => { mounted = false; };
  }, [authed, activeScreen]);

  useEffect(() => {
    if (!authed) return undefined;

    let cancelled = false;

    const beat = async () => {
      try {
        if (cancelled) return;
        await doctorPortalApi.heartbeatPresence();
      } catch (_error) {
        // Ignore transient presence errors to avoid interrupting UX.
      }
    };

    beat();
    const timer = setInterval(beat, 25000);

    return () => {
      cancelled = true;
      clearInterval(timer);
      doctorPortalApi.setOfflinePresence().catch(() => {});
    };
  }, [authed]);

  const navItems = useMemo(() => (
    NAV.map((item) => {
      if (item.id === 'cases') {
        return { ...item, badge: caseCount > 0 ? caseCount : undefined };
      }
      if (item.id === 'messages') {
        return { ...item, badge: unreadChatCount > 0 ? unreadChatCount : undefined };
      }
      return item;
    })
  ), [caseCount, unreadChatCount]);

  const handleAuth = ({ token, doctor: nextDoctor }) => {
    setAuthToken(token);
    setDoctor(nextDoctor || null);
    setAuthed(true);
    setScreen('dashboard');
    setSidebar(false);
  };

  const handleLogout = () => {
    doctorPortalApi.setOfflinePresence().catch(() => {});
    clearAuthToken();
    setDoctor(null);
    setAuthed(false);
    setScreen('dashboard');
    setCase(null);
    setSidebar(false);
  };

  if (sessionLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#050E1F', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#00C2B2" size="large" />
      </View>
    );
  }

  if (!authed) {
    return <LoginScreen onAuth={handleAuth} />;
  }

  const navigate = (screen, params) => {
    if (params?.caseData) setCase(params.caseData);
    if (params?.historyContext) setHistoryContext(params.historyContext);
    setScreen(screen);
    setSidebar(false);
  };

  const renderScreen = () => {
    switch (activeScreen) {
      case 'dashboard': return <DashboardScreen navigate={navigate} doctor={doctor} />;
      case 'cases':     return <CasesScreen     navigate={navigate} />;
      case 'case':      return <CaseDetailScreen caseData={selectedCase} navigate={navigate} />;
      case 'patients':  return <PatientsScreen   navigate={navigate} />;
      case 'calendar':  return <CalendarScreen />;
      case 'messages':  return <ChatScreen navigate={navigate} />;
      case 'analytics': return <AnalyticsScreen />;
      case 'reviews':   return <ReviewsScreen />;
      case 'blogs':     return <BlogsScreen doctor={doctor} />;
      case 'settings':  return <SettingsScreen doctor={doctor} onDoctorUpdated={setDoctor} />;
      case 'patient-history': return <PatientHistoryScreen navigate={navigate} historyContext={historyContext} />;
      default:          return <PlaceholderScreen title={activeScreen} />;
    }
  };

  // ── Sidebar ──
  const Sidebar = ({ collapsed }) => (
    <View style={{
      width:            collapsed ? 64 : 240,
      backgroundColor: '#050E1F',
      borderRightWidth: 1,
      borderRightColor: 'rgba(255,255,255,0.07)',
      paddingTop: 24,
      paddingBottom: 24,
      justifyContent: 'space-between',
    }}>
      {/* Logo */}
      <View>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: collapsed ? 16 : 20, marginBottom: 32, gap: 10 }}>
          <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#00C2B2', alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="activity" size={16} color="#050E1F" />
          </View>
          {!collapsed && (
            <View>
              <Text style={{ fontFamily: 'Sora_700Bold', fontSize: 16, color: '#fff', letterSpacing: -0.5 }}>lesio</Text>
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: -2 }}>Doctor Portal</Text>
            </View>
          )}
        </View>

        {/* Nav items */}
        {navItems.map(item => {
          const isActive = activeScreen === item.id || (item.id === 'cases' && activeScreen === 'case');
          return (
            <TouchableOpacity
              key={item.id}
              onPress={() => navigate(item.id)}
              activeOpacity={0.75}
              accessibilityLabel={item.label}
              accessibilityRole="button"
              style={{
                flexDirection:  'row',
                alignItems:     'center',
                paddingHorizontal: collapsed ? 16 : 20,
                paddingVertical:   12,
                marginHorizontal:  8,
                marginBottom:      2,
                borderRadius:      10,
                backgroundColor:   isActive ? 'rgba(0,194,178,0.12)' : 'transparent',
                gap: 12,
              }}
            >
              <Feather name={item.icon} size={20} color={isActive ? '#00C2B2' : 'rgba(255,255,255,0.45)'} />
              {!collapsed && (
                <>
                  <Text style={{
                    fontFamily:  isActive ? 'DMSans_500Medium' : 'DMSans_400Regular',
                    fontSize:    14,
                    color:       isActive ? '#00C2B2' : 'rgba(255,255,255,0.55)',
                    flex: 1,
                  }}>
                    {item.label}
                  </Text>
                  {item.badge && (
                    <View style={{ backgroundColor: '#FF4757', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 10, color: '#fff' }}>{item.badge}</Text>
                    </View>
                  )}
                </>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Doctor profile */}
      <TouchableOpacity
        activeOpacity={0.8}
        style={{
          flexDirection:     'row',
          alignItems:        'center',
          paddingHorizontal: collapsed ? 12 : 16,
          paddingVertical:   12,
          marginHorizontal:  8,
          borderRadius:      10,
          backgroundColor:   'rgba(255,255,255,0.05)',
          gap: 10,
        }}
      >
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,194,178,0.2)', borderWidth: 2, borderColor: '#00C2B2', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {doctor?.profile?.avatarUrl ? (
            <Image source={{ uri: doctor.profile.avatarUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          ) : (
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: '#00C2B2' }}>{doctorInitials(doctor)}</Text>
          )}
        </View>
        {!collapsed && (
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: '#fff' }} numberOfLines={1}>{doctor?.profile?.fullName || doctor?.email || 'Doctor profile'}</Text>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: 'rgba(255,255,255,0.4)' }} numberOfLines={1}>{doctor?.specialty || 'Doctor Portal'}</Text>
          </View>
        )}
        {!collapsed && <Feather name="log-out" size={15} color="rgba(255,255,255,0.3)" onPress={handleLogout} />}
      </TouchableOpacity>
    </View>
  );

  // ── Mobile top bar ──
  const TopBar = () => (
    <View style={{
      backgroundColor: '#050E1F',
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
      gap: 12,
    }}>
      <TouchableOpacity onPress={() => setSidebar(v => !v)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
        <Feather name={sidebarOpen ? 'x' : 'menu'} size={22} color="#fff" />
      </TouchableOpacity>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
        <View style={{ width: 28, height: 28, borderRadius: 7, backgroundColor: '#00C2B2', alignItems: 'center', justifyContent: 'center' }}>
          <Feather name="activity" size={14} color="#050E1F" />
        </View>
        <Text style={{ fontFamily: 'Sora_700Bold', fontSize: 16, color: '#fff' }}>lesio</Text>
        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Doctor Portal</Text>
      </View>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,194,178,0.2)', borderWidth: 2, borderColor: '#00C2B2', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {doctor?.profile?.avatarUrl ? (
          <Image source={{ uri: doctor.profile.avatarUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : (
          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: '#00C2B2' }}>{doctorInitials(doctor)}</Text>
        )}
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, flexDirection: isTablet ? 'row' : 'column', backgroundColor: '#F6F8FB' }}>
      <StatusBar barStyle="light-content" />

      {/* Desktop/tablet sidebar — always visible */}
      {isTablet && <Sidebar collapsed={!isDesktop} />}

      {/* Mobile overlay sidebar */}
      {!isTablet && sidebarOpen && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50, flexDirection: 'row' }}>
          <View style={{ width: 240 }}>
            <Sidebar collapsed={false} />
          </View>
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(5,14,31,0.6)' }} onPress={() => setSidebar(false)} />
        </View>
      )}

      {/* Main content */}
      <View style={{ flex: 1 }}>
        {!isTablet && <TopBar />}
        <View style={{ flex: 1, overflow: 'hidden' }}>
          {renderScreen()}
        </View>
      </View>
    </View>
  );
}

function PlaceholderScreen({ title }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F6F8FB' }}>
      <Feather name="tool" size={40} color="#A8B4CC" />
      <Text style={{ fontFamily: 'Sora_600SemiBold', fontSize: 20, color: '#3A4560', marginTop: 16, textTransform: 'capitalize' }}>{title}</Text>
      <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#6B7A99', marginTop: 8 }}>Coming soon</Text>
    </View>
  );
}
