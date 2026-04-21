export const Colors = {
  primary: '#00C2B2',
  primaryDim: 'rgba(0,194,178,0.14)',
  primaryOnDark: '#050E1F',

  bgBase: '#050E1F',
  bgSurface: '#0A1A30',
  bgCard: '#FFFFFF',
  bgInput: '#F8FAFC',

  borderDefault: '#E2E8F0',
  borderSubtle: '#EDF2F7',
  borderFocus: '#00C2B2',

  textPrimary: '#FFFFFF',
  textSecondary: '#D9E2F2',
  textTertiary: '#A7B4C9',
  textOnLight: '#0F172A',
  textMuted: '#64748B',

  grey50: '#F8FAFC',
  grey100: '#F1F5F9',
  grey200: '#E2E8F0',
  grey300: '#CBD5E1',
  grey500: '#64748B',
  grey700: '#334155',

  riskLow: '#00C48C',
  riskLowBg: 'rgba(0,196,140,0.12)',
  riskMed: '#F59E0B',
  riskMedBg: 'rgba(245,158,11,0.12)',
  riskHigh: '#FF4757',
  riskHighBg: 'rgba(255,71,87,0.12)',

  error: '#EF4444',
};

export const Space = {
  s4: 4,
  s8: 8,
  s10: 10,
  s12: 12,
  s16: 16,
  s20: 20,
  s24: 24,
  s32: 32,
  s48: 48,
  s80: 80,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const Type = {
  d2: { fontFamily: 'Sora_700Bold', fontSize: 32, lineHeight: 38 },
  d3: { fontFamily: 'Sora_700Bold', fontSize: 24, lineHeight: 30 },
  d4: { fontFamily: 'Sora_600SemiBold', fontSize: 18, lineHeight: 24 },

  l1: { fontFamily: 'DMSans_500Medium', fontSize: 14, lineHeight: 20 },
  l2: { fontFamily: 'DMSans_500Medium', fontSize: 12, lineHeight: 16 },
  l3: { fontFamily: 'DMSans_500Medium', fontSize: 11, lineHeight: 15 },

  b1: { fontFamily: 'DMSans_400Regular', fontSize: 16, lineHeight: 24 },
  b2: { fontFamily: 'DMSans_400Regular', fontSize: 14, lineHeight: 21 },
  b3: { fontFamily: 'DMSans_400Regular', fontSize: 12, lineHeight: 18 },
};

export const Shadow = {
  sm: {
    shadowColor: '#020617',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  md: {
    shadowColor: '#020617',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  lg: {
    shadowColor: '#020617',
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  primary: {
    shadowColor: '#00C2B2',
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
};

export const HIT = { top: 10, bottom: 10, left: 10, right: 10 };

export function riskConfig(level) {
  const normalized = String(level || '').toLowerCase();

  if (normalized === 'high') {
    return {
      color: Colors.riskHigh,
      bg: Colors.riskHighBg,
      border: 'rgba(255,71,87,0.35)',
      label: 'High Risk',
      tw: 'text-risk-high bg-risk-highbg',
    };
  }

  if (normalized === 'medium' || normalized === 'moderate') {
    return {
      color: Colors.riskMed,
      bg: Colors.riskMedBg,
      border: 'rgba(245,158,11,0.35)',
      label: 'Moderate Risk',
      tw: 'text-risk-med bg-risk-medbg',
    };
  }

  return {
    color: Colors.riskLow,
    bg: Colors.riskLowBg,
    border: 'rgba(0,196,140,0.35)',
    label: 'Low Risk',
    tw: 'text-risk-low bg-risk-lowbg',
  };
}
