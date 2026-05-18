import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Image,
} from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Type, Space, Radius, Shadow, HIT, riskConfig } from '../theme';

function stripTitlePrefix(fullName = '') {
  return String(fullName).replace(/^(dr\.?|doctor|prof\.?)\s+/i, '').trim();
}

function buildInitials(fullName = '', fallback = 'DR') {
  const normalized = stripTitlePrefix(fullName);
  const parts = normalized.split(/\s+/).filter(Boolean);
  if (!parts.length) return fallback;
  const first = parts[0]?.[0] || '';
  const last = (parts.length > 1 ? parts[parts.length - 1]?.[0] : '') || '';
  const second = last || parts[0]?.[1] || '';
  return `${first}${second}`.toUpperCase();
}

// ─── DoctorAvatar ───────────────────────────────────────────────────────────
export function DoctorAvatar({
  size = 48,
  fullName = '',
  avatarUrl = '',
  backgroundColor = Colors.primaryDim,
  textColor = Colors.primary,
  borderColor = 'transparent',
  borderWidth = 0,
  style,
}) {
  const initials = buildInitials(fullName, 'DR');
  const hasPhoto = String(avatarUrl || '').trim().length > 0;
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor,
          borderColor,
          borderWidth,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      {hasPhoto ? (
        <Image
          source={{ uri: avatarUrl }}
          style={{ width: '100%', height: '100%', borderRadius: size / 2 }}
          resizeMode="cover"
        />
      ) : (
        <Text style={{ ...Type.l2, color: textColor, fontWeight: '700', fontSize: Math.max(12, Math.round(size * 0.34)) }}>
          {initials}
        </Text>
      )}
    </View>
  );
}

// ─── RiskBadge ────────────────────────────────────────────────────────────────
export function RiskBadge({ level, size = 'md' }) {
  const cfg = riskConfig(level);
  const isSmall = size === 'sm';
  return (
    <View style={[s.riskBadge, { backgroundColor: cfg.bg, borderColor: cfg.color + '50' }, isSmall && s.riskBadgeSm]} accessibilityLabel={cfg.label}>
      <View style={[s.riskDot, { backgroundColor: cfg.color }]} />
      <Text style={[s.riskText, { color: cfg.color }, isSmall && { fontSize: 10 }]}>{cfg.label}</Text>
    </View>
  );
}

// ─── Button ───────────────────────────────────────────────────────────────────
export function Button({ label, onPress, loading = false, disabled = false, variant = 'primary', icon, iconPos = 'right', size = 'md', style, accessibilityLabel }) {
  const isDisabled = disabled || loading;
  const isSm = size === 'sm';
  const bgMap   = { primary: Colors.primary, outline: 'transparent', ghost: 'transparent', danger: Colors.riskHigh };
  const txtMap  = { primary: Colors.primaryOnDark, outline: Colors.primary, ghost: Colors.textSecondary, danger: Colors.textPrimary };
  const brdMap  = { primary: 'transparent', outline: Colors.primary, ghost: 'transparent', danger: 'transparent' };
  return (
    <TouchableOpacity onPress={onPress} disabled={isDisabled} activeOpacity={0.78} hitSlop={HIT}
      accessibilityLabel={accessibilityLabel || label} accessibilityRole="button" accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[s.btn, isSm && s.btnSm, { backgroundColor: bgMap[variant], borderColor: brdMap[variant], borderWidth: variant === 'outline' ? 1.5 : 0, opacity: isDisabled ? 0.48 : 1 }, variant === 'primary' && !isDisabled && Shadow.primary, style]}>
      {loading
        ? <ActivityIndicator size="small" color={variant === 'primary' ? Colors.primaryOnDark : Colors.primary} />
        : <>
            {icon && iconPos === 'left'  && <Feather name={icon} size={isSm ? 14 : 16} color={txtMap[variant]} style={{ marginRight: Space.s8 }} />}
            <Text style={[s.btnLabel, { color: txtMap[variant] }, isSm && { fontSize: 13 }]}>{label}</Text>
            {icon && iconPos === 'right' && <Feather name={icon} size={isSm ? 14 : 16} color={txtMap[variant]} style={{ marginLeft: Space.s8 }} />}
          </>
      }
    </TouchableOpacity>
  );
}

// ─── ScanCard ─────────────────────────────────────────────────────────────────
export function ScanCard({ scan, onPress }) {
  const cfg = riskConfig(scan.riskLevel);
  const safeLocation = String(scan.location || '').trim() || 'Unknown location';
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.82} accessibilityLabel={`${scan.lesionType}, ${cfg.label}, ${safeLocation}`} accessibilityRole="button" style={s.scanCard}>
      <View style={[s.scanStripe, { backgroundColor: cfg.color }]} />
      <View style={[s.scanThumb, { backgroundColor: cfg.bg }]}> 
        {scan.imageUrl ? (
          <Image source={{ uri: scan.imageUrl }} style={s.scanImage} resizeMode="cover" />
        ) : (
          <Ionicons name="scan-outline" size={28} color={cfg.color} />
        )}
      </View>
      <View style={s.scanContent}>
        <View style={s.scanRow}>
          <Text style={s.scanType} numberOfLines={1}>{scan.lesionType}</Text>
          <RiskBadge level={scan.riskLevel} size="sm" />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.s4, marginBottom: Space.s8 }}>
          <MaterialCommunityIcons name="pin" size={11} color={Colors.textMuted} />
          <Text style={s.scanMeta} numberOfLines={1}>{safeLocation}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={s.scanDate}>{new Date(scan.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
          <Text style={[s.scanConf, { color: cfg.color }]}>{scan.confidence}% conf.</Text>
        </View>
      </View>
      <Feather name="chevron-right" size={16} color={Colors.textTertiary} style={{ alignSelf: 'center', marginRight: Space.s12 }} />
    </TouchableOpacity>
  );
}

// ─── DoctorCard ───────────────────────────────────────────────────────────────
export function DoctorCard({ doctor, onBook, onChat, onPress, bookDisabled = false, bookLabel = '' }) {
  const bookingLabel = String(bookLabel || '').trim() || (doctor.available ? 'Book' : 'Schedule');
  const Wrapper = onPress ? TouchableOpacity : View;
  const wrapperProps = onPress ? {
    onPress,
    activeOpacity: 0.82,
    accessibilityRole: 'button',
    accessibilityLabel: `View details for ${doctor.name}`,
  } : {};

  return (
    <Wrapper style={s.docCard} {...wrapperProps}>
      <View style={s.docTop}>
        <DoctorAvatar size={48} fullName={doctor.name} avatarUrl={doctor.avatarUrl} style={s.docAvatar} />
        <View style={{ flex: 1 }}>
          <Text style={s.docName}>{doctor.name}</Text>
          <Text style={s.docSpec} numberOfLines={1}>{doctor.specialty}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.s4 }}>
            <Ionicons name="star" size={12} color={Colors.riskMed} />
            <Text style={s.docRating}>{doctor.rating}</Text>
            <Text style={s.docReviews}>({doctor.reviews})</Text>
            <View style={s.metaDot} />
            <MaterialCommunityIcons name="pin" size={11} color={Colors.textMuted} />
            <Text style={s.docDist}>{doctor.distance}</Text>
          </View>
        </View>
        <View style={[s.availDot, { backgroundColor: doctor.available ? Colors.riskLow : Colors.textMuted }]} />
      </View>
      <View style={s.docBottom}>
        <View style={s.docActions}>
          <Button
            label="Chat"
            onPress={onChat}
            size="sm"
            variant="outline"
            icon="message-circle"
            iconPos="left"
            accessibilityLabel={`Chat with ${doctor.name}`}
          />
          <Button
            label={bookingLabel}
            onPress={onBook}
            size="sm"
            disabled={bookDisabled}
            accessibilityLabel={`${bookingLabel} appointment with ${doctor.name}`}
          />
        </View>
      </View>
    </Wrapper>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────
export function StatCard({ label, value, iconName, color, bg, style, onPress }) {
  const Wrap = onPress ? TouchableOpacity : View;
  const props = onPress ? { onPress, activeOpacity: 0.82, accessibilityLabel: `${label}: ${value}`, accessibilityRole: 'button' } : {};
  return (
    <Wrap style={[s.statCard, Shadow.sm, style]} {...props}>
      <View style={[s.statIcon, { backgroundColor: bg || Colors.primaryDim }]}>
        <Feather name={iconName} size={20} color={color || Colors.primary} />
      </View>
      <Text style={[s.statValue, { color: color || Colors.primary }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </Wrap>
  );
}

// ─── SectionHeader ────────────────────────────────────────────────────────────
export function SectionHeader({ title, action, onAction }) {
  return (
    <View style={s.secHeader}>
      <Text style={s.secTitle}>{title}</Text>
      {action && (
        <TouchableOpacity onPress={onAction} hitSlop={HIT} activeOpacity={0.7} accessibilityLabel={action} accessibilityRole="button">
          <Text style={s.secAction}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────
export function EmptyState({ iconName = 'inbox', title, subtitle, action, onAction }) {
  return (
    <View style={s.empty}>
      <View style={s.emptyIcon}><Feather name={iconName} size={36} color={Colors.textMuted} /></View>
      <Text style={s.emptyTitle}>{title}</Text>
      {subtitle && <Text style={s.emptySub}>{subtitle}</Text>}
      {action && <Button label={action} onPress={onAction} variant="outline" style={{ marginTop: Space.s16 }} />}
    </View>
  );
}

// ─── AILoadingOverlay ─────────────────────────────────────────────────────────
export function AILoadingOverlay({ steps = [], message = 'Analyzing...' }) {
  return (
    <View style={s.aiWrap} accessibilityLiveRegion="polite">
      <View style={s.aiRings}>
        {[120, 90, 60].map((sz, i) => (
          <View key={i} style={[s.aiRing, { width: sz, height: sz, borderRadius: sz / 2, borderColor: Colors.primary + ['20','40','80'][i] }]} />
        ))}
        <View style={s.aiCore}>
          <Ionicons name="cellular" size={28} color={Colors.primary} />
        </View>
      </View>
      <Text style={s.aiMsg}>{message}</Text>
      <Text style={s.aiSub}>AI model processing image data</Text>
      {steps.length > 0 && (
        <View style={s.aiSteps}>
          {steps.map((step, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: Space.s12 }}>
              <View style={[s.aiDot, { backgroundColor: step.done ? Colors.riskLow : Colors.borderDefault }]}>
                {step.done   && <Feather name="check" size={9} color={Colors.bgBase} />}
                {step.active && <ActivityIndicator size="small" color={Colors.primary} />}
              </View>
              <Text style={[s.aiStep, { color: step.done ? Colors.textSecondary : step.active ? Colors.textPrimary : Colors.textTertiary }]}>{step.label}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  riskBadge: { flexDirection: 'row', alignItems: 'center', gap: Space.s4, paddingHorizontal: Space.s8, paddingVertical: 4, borderRadius: Radius.full, borderWidth: 1 },
  riskBadgeSm: { paddingHorizontal: 6, paddingVertical: 3 },
  riskDot: { width: 6, height: 6, borderRadius: 3 },
  riskText: { ...Type.l2 },

  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 44, paddingHorizontal: Space.s24, paddingVertical: Space.s12, borderRadius: Radius.full },
  btnSm: { minHeight: 36, paddingHorizontal: Space.s16, paddingVertical: Space.s8 },
  btnLabel: { ...Type.l1, color: Colors.primaryOnDark },

  scanCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bgCard, borderRadius: Radius.lg, overflow: 'hidden', marginBottom: Space.s12, minHeight: 92, ...Shadow.sm },
  scanStripe: { width: 4 },
  scanThumb: { width: 64, height: 64, borderRadius: 10, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginLeft: Space.s8 },
  scanImage: { width: '100%', height: '100%' },
  scanContent: { flex: 1, paddingVertical: Space.s12, paddingLeft: Space.s8, paddingRight: Space.s8, justifyContent: 'space-between' },
  scanRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Space.s4, paddingRight: Space.s8 },
  scanType: { ...Type.l1, color: Colors.textOnLight, flex: 1, marginRight: Space.s8 },
  scanMeta: { ...Type.b3, color: Colors.textMuted, flex: 1 },
  scanDate: { ...Type.b3, color: Colors.grey300 },
  scanConf: { ...Type.l3 },

  docCard: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Space.s16, marginBottom: Space.s12, ...Shadow.sm },
  docTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Space.s16 },
  docAvatar: { marginRight: Space.s12 },
  docName: { ...Type.d4, color: Colors.textOnLight, marginBottom: 2 },
  docSpec: { ...Type.b3, color: Colors.textMuted, marginBottom: Space.s4 },
  docRating: { ...Type.l2, color: Colors.riskMed },
  docReviews: { ...Type.b3, color: Colors.grey300 },
  metaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: Colors.grey200, marginHorizontal: 2 },
  docDist: { ...Type.b3, color: Colors.textMuted },
  availDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  docBottom: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  docActions: { flexDirection: 'row', gap: Space.s8, alignItems: 'center' },

  statCard: { flex: 1, backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Space.s16 },
  statIcon: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', marginBottom: Space.s8 },
  statValue: { ...Type.d3, marginBottom: 2 },
  statLabel: { ...Type.b3, color: Colors.textMuted },

  secHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Space.s16 },
  secTitle: { ...Type.d4, color: Colors.textOnLight },
  secAction: { ...Type.l1, color: Colors.primary },

  empty: { alignItems: 'center', paddingVertical: Space.s48 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.grey50, alignItems: 'center', justifyContent: 'center', marginBottom: Space.s16 },
  emptyTitle: { ...Type.d4, color: Colors.textOnLight, marginBottom: Space.s8 },
  emptySub: { ...Type.b2, color: Colors.textMuted, textAlign: 'center', paddingHorizontal: Space.s32 },

  aiWrap: { alignItems: 'center', paddingVertical: Space.s48, paddingHorizontal: Space.s24 },
  aiRings: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center', marginBottom: Space.s32 },
  aiRing: { position: 'absolute', borderWidth: 1.5 },
  aiCore: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.primaryDim, borderWidth: 2, borderColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  aiMsg: { ...Type.d4, color: Colors.textOnLight, marginBottom: Space.s8 },
  aiSub: { ...Type.b2, color: Colors.textSecondary, marginBottom: Space.s24 },
  aiSteps: { width: '100%', gap: Space.s12 },
  aiDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  aiStep: { ...Type.b2 },
});
