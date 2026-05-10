/**
 * Auth Screens — Patient only
 * Doctor authentication is handled by the separate web dashboard.
 */
import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { Colors, Type, Space, Radius, HIT } from '../theme';
import { Button } from '../components';
import AppTextInput from '../components/AppTextInput';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/api';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';

WebBrowser.maybeCompleteAuthSession();

// ─── Shared header ────────────────────────────────────────────────────────────

function AuthHeader({ onBack, title, subtitle }) {
  return (
    <View style={s.header}>
      <TouchableOpacity onPress={onBack} hitSlop={HIT} accessibilityLabel="Go back" accessibilityRole="button" style={s.backBtn}>
        <Feather name="arrow-left" size={22} color={Colors.textPrimary} />
      </TouchableOpacity>
      <View style={s.logoRow}>
        <View style={s.logoMark} />
        <Text style={s.logoText}>lesio</Text>
      </View>
      <Text style={s.title}>{title}</Text>
      {subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
    </View>
  );
}

function GoogleSignInButton({ onGoogleSignIn, onSuccess }) {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [request, , promptAsync] = Google.useAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    expoClientId: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID,
  });

  const handleGoogleLogin = async () => {
    if (!request) {
      Alert.alert('Google sign-in not configured', 'Add Google client IDs to your Expo environment to enable Google login.');
      return;
    }

    try {
      setGoogleLoading(true);
      const result = await promptAsync();
      if (result?.type !== 'success') return;

      const accessToken = result.authentication?.accessToken;
      if (!accessToken) {
        Alert.alert('Google sign-in failed', 'No Google access token was returned.');
        return;
      }

      const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const profile = await profileRes.json();

      await onGoogleSignIn({
        email: profile.email,
        fullName: profile.name,
        avatarUrl: profile.picture,
      });

      onSuccess?.();
    } catch (error) {
      Alert.alert('Google sign-in failed', error?.message || 'Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <TouchableOpacity
      style={[s.socialBtn, { marginTop: Space.s12 }]}
      activeOpacity={0.75}
      accessibilityLabel="Continue with Google"
      accessibilityRole="button"
      onPress={handleGoogleLogin}
      disabled={googleLoading}
    >
      <Feather name="globe" size={18} color={Colors.textPrimary} />
      <Text style={s.socialText}>{googleLoading ? 'Signing in...' : 'Continue with Google'}</Text>
    </TouchableOpacity>
  );
}

// ─── LoginScreen ──────────────────────────────────────────────────────────────

export function LoginScreen({ navigation }) {
  const { login, googleSignIn } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [errors, setErrors]     = useState({});
  const pwRef = useRef(null);

  const validate = () => {
    const e = {};
    if (!email)    e.email    = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email';
    if (!password) e.password = 'Password is required';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await login(email, password);
      navigation.replace('PatientDashboard');
    } catch (error) {
      Alert.alert('Login failed', error?.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const canUseGoogleAuth = (() => {
    if (Platform.OS === 'web') return !!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    if (Platform.OS === 'android') return !!process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
    if (Platform.OS === 'ios') return !!process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
    return !!process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID;
  })();

  return (
    <LinearGradient colors={['#050E1F', '#0D2147']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            <AuthHeader onBack={() => navigation.goBack()} title="Welcome back" subtitle="Sign in to your Lesio account" />

            <AppTextInput label="Email address" value={email} onChangeText={setEmail}
              placeholder="you@example.com" keyboardType="email-address"
              autoComplete="email" iconName="mail" error={errors.email}
              returnKeyType="next" onSubmitEditing={() => pwRef.current?.focus()} />

            <AppTextInput label="Password" value={password} onChangeText={setPassword}
              placeholder="Enter your password" secureTextEntry
              autoComplete="password" iconName="lock" error={errors.password}
              inputRef={pwRef} returnKeyType="done" onSubmitEditing={handleLogin} />

            <TouchableOpacity style={s.forgotBtn} hitSlop={HIT} accessibilityLabel="Forgot password" accessibilityRole="button" onPress={() => navigation.navigate('ResetPassword')}>
              <Text style={s.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            <Button label="Sign In" onPress={handleLogin} loading={loading} icon="arrow-right" style={{ marginTop: Space.s8 }} />

            <View style={s.divider}>
              <View style={s.divLine} />
              <Text style={s.divText}>or</Text>
              <View style={s.divLine} />
            </View>

            {canUseGoogleAuth ? (
              <GoogleSignInButton
                onGoogleSignIn={googleSignIn}
                onSuccess={() => navigation.replace('PatientDashboard')}
              />
            ) : (
              <View style={[s.socialBtn, s.socialBtnDisabled, { marginTop: Space.s12 }]}>
                <Feather name="globe" size={18} color={Colors.textTertiary} />
                <Text style={[s.socialText, s.socialTextDisabled]}>Google sign-in unavailable</Text>
              </View>
            )}

            {/* Doctor callout */}
            <View style={s.doctorCallout}>
              <Feather name="monitor" size={16} color={Colors.primary} />
              <Text style={s.doctorCalloutText}>
                Are you a dermatologist?{' '}
                <Text style={s.doctorCalloutLink}>Access the doctor portal at lesio.app/doctors</Text>
              </Text>
            </View>

            <View style={s.switchRow}>
              <Text style={s.switchText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')} hitSlop={HIT} accessibilityLabel="Create an account" accessibilityRole="link">
                <Text style={s.switchLink}>Create one</Text>
              </TouchableOpacity>
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ─── ResetPasswordScreen ────────────────────────────────────────────────────

export function ResetPasswordScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const handleReset = async () => {
    const nextErrors = {};
    if (!email.trim()) nextErrors.email = 'Email is required';
    if (!newPassword) nextErrors.newPassword = 'New password is required';
    else if (newPassword.length < 8) nextErrors.newPassword = 'Minimum 8 characters';
    if (newPassword !== confirmPassword) nextErrors.confirmPassword = 'Passwords do not match';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    try {
      setLoading(true);
      await authApi.resetPassword({ email: email.trim(), newPassword });
      Alert.alert('Password updated', 'You can now sign in with your new password.');
      navigation.navigate('Login');
    } catch (error) {
      Alert.alert('Reset failed', error?.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#050E1F', '#0D2147']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <AuthHeader onBack={() => navigation.goBack()} title="Reset password" subtitle="Update your password and sign in again" />
          <AppTextInput label="Email address" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoComplete="email" iconName="mail" error={errors.email} />
          <AppTextInput label="New password" value={newPassword} onChangeText={setNewPassword} placeholder="Enter new password" secureTextEntry autoComplete="password" iconName="lock" error={errors.newPassword} />
          <AppTextInput label="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Repeat new password" secureTextEntry autoComplete="password" iconName="shield" error={errors.confirmPassword} />
          <Button label="Update Password" onPress={handleReset} loading={loading} icon="check" style={{ marginTop: Space.s8 }} />
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ─── RegisterScreen ───────────────────────────────────────────────────────────

export function RegisterScreen({ navigation }) {
  const { register } = useAuth();
  const [step, setStep]   = useState(1);
  const [form, setForm]   = useState({ name: '', email: '', password: '', confirmPassword: '', type: 'patient' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors]   = useState({});

  const upd = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const validateStep1 = () => {
    const e = {};
    if (!form.name)  e.name  = 'Name is required';
    if (!form.email) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const validateStep2 = () => {
    const e = {};
    if (!form.password)               e.password        = 'Password is required';
    else if (form.password.length < 8) e.password        = 'Minimum 8 characters';
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleNext = async () => {
    if (step === 1) {
      if (validateStep1()) setStep(2);
    } else {
      if (!validateStep2()) return;
      setLoading(true);
      try {
        await register(form);
        navigation.replace('PatientDashboard');
      } catch (error) {
        Alert.alert('Registration failed', error?.message || 'Please try again.');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <LinearGradient colors={['#050E1F', '#0D2147']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            <AuthHeader
              onBack={() => step === 1 ? navigation.goBack() : setStep(1)}
              title={step === 1 ? 'Create account' : 'Set your password'}
              subtitle={step === 1 ? 'Start monitoring your skin health' : 'Almost done — secure your account'}
            />

            {/* Step indicator */}
            <View style={s.stepBar}>
              {[1, 2].map(n => (
                <View key={n} style={s.stepItem}>
                  <View style={[s.stepCircle, step >= n && s.stepCircleActive]}>
                    {step > n
                      ? <Feather name="check" size={13} color={Colors.primaryOnDark} />
                      : <Text style={[s.stepNum, step >= n && { color: Colors.primaryOnDark }]}>{n}</Text>
                    }
                  </View>
                  {n < 2 && <View style={[s.stepLine, step > n && s.stepLineActive]} />}
                </View>
              ))}
            </View>

            {step === 1 ? (
              <>
                <AppTextInput label="Full name"     value={form.name}  onChangeText={v => upd('name', v)}  placeholder="Alex Johnson"     autoCapitalize="words" iconName="user" error={errors.name} />
                <AppTextInput label="Email address" value={form.email} onChangeText={v => upd('email', v)} placeholder="you@example.com" keyboardType="email-address" iconName="mail" error={errors.email} />
              </>
            ) : (
              <>
                <AppTextInput label="Password"         value={form.password}        onChangeText={v => upd('password', v)}        placeholder="Minimum 8 characters" secureTextEntry iconName="lock"   error={errors.password} />
                <AppTextInput label="Confirm password" value={form.confirmPassword} onChangeText={v => upd('confirmPassword', v)} placeholder="Repeat password"       secureTextEntry iconName="shield" error={errors.confirmPassword} />
                <View style={s.termsRow}>
                  <Feather name="check-square" size={16} color={Colors.primary} />
                  <Text style={s.termsText}>
                    By creating an account you agree to our{' '}
                    <Text style={{ color: Colors.primary }}>Terms</Text> and{' '}
                    <Text style={{ color: Colors.primary }}>Privacy Policy</Text>
                  </Text>
                </View>
              </>
            )}

            <Button label={step === 1 ? 'Continue' : 'Create Account'} onPress={handleNext} loading={loading} icon={step === 1 ? 'arrow-right' : 'check'} style={{ marginTop: Space.s8 }} />

            {/* Doctor callout */}
            <View style={s.doctorCallout}>
              <Feather name="monitor" size={16} color={Colors.primary} />
              <Text style={s.doctorCalloutText}>
                Are you a dermatologist?{' '}
                <Text style={s.doctorCalloutLink}>Access the doctor portal at lesio.app/doctors</Text>
              </Text>
            </View>

            <View style={s.switchRow}>
              <Text style={s.switchText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')} hitSlop={HIT} accessibilityLabel="Sign in" accessibilityRole="link">
                <Text style={s.switchLink}>Sign In</Text>
              </TouchableOpacity>
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: Space.s24, paddingBottom: Space.s48 },
  header: { paddingTop: Space.s16, marginBottom: Space.s32 },
  backBtn: { width: 44, height: 44, justifyContent: 'center', marginBottom: Space.s24 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: Space.s8, marginBottom: Space.s24 },
  logoMark: { width: 28, height: 28, borderRadius: 8, backgroundColor: Colors.primary },
  logoText: { ...Type.d4, color: Colors.textPrimary, letterSpacing: -1 },
  title: { ...Type.d2, color: Colors.textPrimary, marginBottom: Space.s8 },
  subtitle: { ...Type.b1, color: Colors.textSecondary },

  forgotBtn: { alignSelf: 'flex-end', marginBottom: Space.s16, minHeight: 44, justifyContent: 'center' },
  forgotText: { ...Type.l2, color: Colors.primary },

  divider: { flexDirection: 'row', alignItems: 'center', gap: Space.s12, marginVertical: Space.s24 },
  divLine: { flex: 1, height: 1, backgroundColor: Colors.borderSubtle },
  divText: { ...Type.b3, color: Colors.textTertiary },

  socialBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Space.s12, borderWidth: 1.5, borderColor: Colors.borderDefault, borderRadius: Radius.full, paddingVertical: Space.s16, minHeight: 44 },
  socialText: { ...Type.l1, color: Colors.textPrimary },
  socialBtnDisabled: { borderColor: Colors.borderSubtle, backgroundColor: Colors.bgElevated },
  socialTextDisabled: { color: Colors.textTertiary },

  doctorCallout: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Space.s8,
    backgroundColor: Colors.primaryDim, borderRadius: Radius.md,
    padding: Space.s16, marginTop: Space.s24,
    borderWidth: 1, borderColor: Colors.primary + '30',
  },
  doctorCalloutText: { ...Type.b3, color: Colors.textSecondary, flex: 1, lineHeight: 20 },
  doctorCalloutLink: { color: Colors.primary, fontWeight: '600' },

  switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: Space.s24 },
  switchText: { ...Type.b2, color: Colors.textTertiary },
  switchLink: { ...Type.l1, color: Colors.primary },

  stepBar: { flexDirection: 'row', alignItems: 'center', marginBottom: Space.s32 },
  stepItem: { flexDirection: 'row', alignItems: 'center' },
  stepCircle: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: Colors.borderDefault, alignItems: 'center', justifyContent: 'center' },
  stepCircleActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  stepNum: { ...Type.l1, color: Colors.textTertiary },
  stepLine: { width: 40, height: 1.5, backgroundColor: Colors.borderSubtle },
  stepLineActive: { backgroundColor: Colors.primary },

  termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Space.s8, marginBottom: Space.s8 },
  termsText: { ...Type.b3, color: Colors.textSecondary, flex: 1, lineHeight: 20 },
});
