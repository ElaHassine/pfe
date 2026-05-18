import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Animated, ScrollView, useWindowDimensions, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Colors, Type, Space, Radius, HIT } from '../theme';

const SLIDES = [
  { id: 1, gradient: ['#050E1F','#0A2540'], accent: Colors.primary,    eyebrow: 'WELCOME TO LESIO', title: 'AI-Powered Skin\nHealth Monitoring',  subtitle: 'Clinical-grade lesion analysis in your pocket. Detect risks early before they become serious.', icon: 'aperture',    iconLib: 'Feather' },
  { id: 2, gradient: ['#050E1F','#0D1A3C'], accent: '#6366F1',          eyebrow: 'STEP 1',           title: 'Capture\nYour Lesion',                 subtitle: 'Use your camera or upload a photo. Guided framing ensures the perfect shot every time.',          icon: 'camera',      iconLib: 'Feather' },
  { id: 3, gradient: ['#050E1F','#0A2030'], accent: Colors.primary,    eyebrow: 'STEP 2',           title: 'Instant\nAI Analysis',                 subtitle: 'Our model — trained on 2M+ dermatological images — assesses risk level in seconds.',               icon: 'cpu',         iconLib: 'Feather' },
  { id: 4, gradient: ['#050E1F','#1A1030'], accent: '#F59E0B',          eyebrow: 'STEP 3',           title: 'Track\nEvolution',                     subtitle: 'Monitor your lesions over time with visual comparisons and a clear risk score history.',            icon: 'trending-up', iconLib: 'Feather' },
  { id: 5, gradient: ['#050E1F','#0A2540'], accent: '#00C48C',          eyebrow: 'STEP 4',           title: 'Connect With\nDermatologists',         subtitle: 'Find certified dermatologists near you and get expert consultations — all in one place.',           icon: 'users',       iconLib: 'Feather' },
];

function SlideIllustration({ slide, sz }) {
  const IconComp = slide.iconLib === 'Ionicons' ? Ionicons : Feather;
  return (
    <View style={{ width: sz, height: sz, alignItems: 'center', justifyContent: 'center' }}>
      {/* Concentric rings */}
      {[1, 0.72, 0.50].map((scale, i) => (
        <View key={i} style={{
          position: 'absolute',
          width: sz * scale, height: sz * scale,
          borderRadius: (sz * scale) / 2,
          borderWidth: i === 2 ? 1.5 : 1,
          borderColor: slide.accent + ['12','28','55'][i],
        }} />
      ))}

      {/* Center icon */}
      <View style={{
        width: sz * 0.30, height: sz * 0.30,
        borderRadius: (sz * 0.30) / 2,
        backgroundColor: slide.accent + '18',
        borderWidth: 2, borderColor: slide.accent,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <IconComp name={slide.icon} size={sz * 0.13} color={slide.accent} />
      </View>

      {/* Floating metric badges — positioned around the ring, not overlapping center */}
      <View style={{
        position: 'absolute', bottom: sz * 0.04,
        flexDirection: 'row', flexWrap: 'wrap',
        justifyContent: 'center', gap: sz * 0.025, width: sz,
      }}>
        {slide.id === 1 && [
          { icon: 'check-circle', text: 'Low Risk',      color: Colors.riskLow,  bg: Colors.riskLowBg },
          { icon: 'cpu',          text: '94% Confident', color: '#6366F1',       bg: 'rgba(99,102,241,0.12)' },
          { icon: 'alert-circle', text: 'Moderate',      color: Colors.riskMed,  bg: Colors.riskMedBg },
        ].map((b, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: sz * 0.022, backgroundColor: b.bg, borderColor: b.color + '60', borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: sz * 0.04, paddingVertical: sz * 0.018 }}>
            <Feather name={b.icon} size={Math.max(9, sz * 0.055)} color={b.color} />
            <Text style={{ color: b.color, fontSize: Math.max(9, sz * 0.058), fontWeight: '600' }}>{b.text}</Text>
          </View>
        ))}

        {slide.id === 3 && [
          { icon: 'check', text: 'Preprocessing' },
          { icon: 'check', text: 'Feature extraction' },
          { icon: 'loader', text: 'Classifying...' },
        ].map((s, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: sz * 0.035, paddingVertical: sz * 0.014, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: Radius.full, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
            <Feather name={s.icon} size={Math.max(9, sz * 0.055)} color={i < 2 ? Colors.riskLow : Colors.textSecondary} />
            <Text style={{ color: i < 2 ? Colors.textSecondary : Colors.textTertiary, fontSize: Math.max(9, sz * 0.055) }}>{s.text}</Text>
          </View>
        ))}

        {slide.id === 4 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: sz * 0.04, paddingVertical: sz * 0.018, backgroundColor: Colors.riskHighBg, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.riskHigh + '50' }}>
            <Feather name="trending-up" size={Math.max(9, sz * 0.058)} color={Colors.riskHigh} />
            <Text style={{ color: Colors.riskHigh, fontSize: Math.max(9, sz * 0.058), fontWeight: '600' }}>Risk increasing</Text>
          </View>
        )}

        {slide.id === 5 && [
          { init: 'AB', name: 'Dr. Amina Ben Ali', avail: true },
          { init: 'MS', name: 'Dr. Mourad Sghaier', avail: false },
        ].map((d, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: sz * 0.035, paddingVertical: sz * 0.018, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: Radius.full, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
            <View style={{ width: sz * 0.08, height: sz * 0.08, borderRadius: sz * 0.04, backgroundColor: slide.accent + '25', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: slide.accent, fontSize: sz * 0.042, fontWeight: '700' }}>{d.init}</Text>
            </View>
            <Text style={{ color: Colors.textSecondary, fontSize: Math.max(9, sz * 0.055) }}>{d.name}</Text>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: d.avail ? Colors.riskLow : Colors.textMuted }} />
          </View>
        ))}
      </View>
    </View>
  );
}

export default function LandingScreen({ navigation }) {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const scrollRef = useRef(null);
  const [idx, setIdx] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;

  // Single base unit drives all proportions
  const U = Math.min(width, height) / 18;
  const H_PAD = U * 1.2;
  const VISUAL_SZ = isLandscape
    ? Math.min(height * 0.60, width * 0.36)
    : Math.min(width * 0.72, height * 0.40);

  const titleSz  = Math.min(U * 1.5,  32);
  const bodySz   = Math.min(U * 0.85, 16);
  const eyeSz    = Math.min(U * 0.6,  11);
  const ctaSz    = Math.min(U * 0.9,  16);
  const signinSz = Math.min(U * 0.72, 13);
  const btnH     = Math.max(44, Math.min(U * 2.8, 56));
  const dotH     = Math.max(7, U * 0.42);
  const dotActW  = Math.max(24, U * 1.4);
  const dotInacW = Math.max(7,  U * 0.42);

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    {
      useNativeDriver: false,
      listener: e => setIdx(Math.round(e.nativeEvent.contentOffset.x / width)),
    }
  );

  const goNext = () => {
    if (idx < SLIDES.length - 1) {
      scrollRef.current?.scrollTo({ x: (idx + 1) * width, animated: true });
    } else {
      navigation.navigate('Register');
    }
  };

  const slide = SLIDES[idx];
  const isLast = idx === SLIDES.length - 1;

  const Controls = ({ accent }) => (
    <View style={{ width: '100%', alignItems: 'center', gap: U * 0.65 }}>
      {/* Dot indicators */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: U * 0.32 }}>
        {SLIDES.map((sl, i) => {
          const iR = [(i-1)*width, i*width, (i+1)*width];
          return (
            <TouchableOpacity
              key={i}
              onPress={() => scrollRef.current?.scrollTo({ x: i * width, animated: true })}
              activeOpacity={0.7}
              hitSlop={HIT}
              accessibilityLabel={`Go to slide ${i + 1}`}
              accessibilityRole="button"
            >
              <Animated.View style={{
                height: dotH, borderRadius: dotH / 2, backgroundColor: sl.accent,
                width:   scrollX.interpolate({ inputRange: iR, outputRange: [dotInacW, dotActW, dotInacW], extrapolate: 'clamp' }),
                opacity: scrollX.interpolate({ inputRange: iR, outputRange: [0.3, 1, 0.3], extrapolate: 'clamp' }),
              }} />
            </TouchableOpacity>
          );
        })}
      </View>

      {/* CTA */}
      <TouchableOpacity
        onPress={goNext}
        activeOpacity={0.82}
        accessibilityLabel={isLast ? 'Get started' : 'Next slide'}
        accessibilityRole="button"
        style={{
          width: '100%', height: btnH, borderRadius: btnH / 2,
          backgroundColor: accent, alignItems: 'center', justifyContent: 'center',
          flexDirection: 'row', gap: Space.s8,
        }}
      >
        <Text style={{ color: Colors.primaryOnDark, fontSize: ctaSz, fontWeight: '700' }}>
          {isLast ? 'Get Started' : 'Next'}
        </Text>
        <Feather name={isLast ? 'arrow-right' : 'chevron-right'} size={ctaSz} color={Colors.primaryOnDark} />
      </TouchableOpacity>

      {/* Sign in link */}
      <TouchableOpacity
        onPress={() => navigation.navigate('Login')}
        hitSlop={HIT}
        accessibilityLabel="Sign in to your account"
        accessibilityRole="link"
      >
        <Text style={{ color: Colors.textTertiary, fontSize: signinSz, textAlign: 'center' }}>
          Already have an account?{' '}
          <Text style={{ color: accent, fontWeight: '700' }}>Sign In</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bgBase }} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" />

      {/* Skip — absolute, clear of safe area */}
      {!isLast && (
        <TouchableOpacity
          onPress={() => navigation.navigate('Register')}
          activeOpacity={0.72}
          hitSlop={HIT}
          accessibilityLabel="Skip onboarding"
          accessibilityRole="button"
          style={{ position: 'absolute', zIndex: 99, top: Math.max(52, U * 2.8), right: H_PAD, paddingHorizontal: U * 0.7, paddingVertical: U * 0.38, borderRadius: Radius.full, backgroundColor: 'rgba(255,255,255,0.08)' }}
        >
          <Text style={{ color: Colors.textTertiary, fontSize: Math.min(13, U * 0.72), fontWeight: '600' }}>Skip</Text>
        </TouchableOpacity>
      )}

      <Animated.ScrollView
        ref={scrollRef}
        horizontal pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
      >
        {SLIDES.map((sl) => (
          <LinearGradient key={sl.id} colors={sl.gradient} style={{ width, height }}>
            {isLandscape ? (
              <View style={{ flex: 1, flexDirection: 'row', paddingTop: Math.max(52, U * 2.8) + U * 0.5, paddingBottom: U * 1.2, paddingHorizontal: H_PAD, gap: H_PAD }}>
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <SlideIllustration slide={sl} sz={VISUAL_SZ} />
                </View>
                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', gap: U * 0.45, paddingBottom: U }} showsVerticalScrollIndicator={false}>
                  <Text style={{ color: sl.accent, fontSize: eyeSz, fontWeight: '700', letterSpacing: 1.8 }}>{sl.eyebrow}</Text>
                  <Text style={{ color: Colors.textPrimary, fontSize: titleSz, fontWeight: '700', lineHeight: titleSz * 1.22 }}>{sl.title}</Text>
                  <Text style={{ color: Colors.textSecondary, fontSize: bodySz, lineHeight: bodySz * 1.65, marginBottom: U * 0.5 }}>{sl.subtitle}</Text>
                  <Controls accent={sl.accent} />
                </ScrollView>
              </View>
            ) : (
              <ScrollView
                contentContainerStyle={{ flexGrow: 1, paddingTop: Math.max(52, U * 2.8) + U * 0.4, paddingBottom: U * 1.2, paddingHorizontal: H_PAD, gap: U * 0.9 }}
                showsVerticalScrollIndicator={false}
                directionalLockEnabled
              >
                <View style={{ alignItems: 'center', paddingVertical: U * 0.3 }}>
                  <SlideIllustration slide={sl} sz={VISUAL_SZ} />
                </View>
                <View style={{ gap: U * 0.3 }}>
                  <Text style={{ color: sl.accent, fontSize: eyeSz, fontWeight: '700', letterSpacing: 1.8 }}>{sl.eyebrow}</Text>
                  <Text style={{ color: Colors.textPrimary, fontSize: titleSz, fontWeight: '700', lineHeight: titleSz * 1.22 }}>{sl.title}</Text>
                  <Text style={{ color: Colors.textSecondary, fontSize: bodySz, lineHeight: bodySz * 1.65 }}>{sl.subtitle}</Text>
                </View>
                <Controls accent={sl.accent} />
              </ScrollView>
            )}
          </LinearGradient>
        ))}
      </Animated.ScrollView>
    </SafeAreaView>
  );
}
