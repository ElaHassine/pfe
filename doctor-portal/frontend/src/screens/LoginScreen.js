import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, useWindowDimensions,
  Animated, Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { doctorAuthApi } from '../services/api';

export default function LoginScreen({ onAuth }) {
  const { width, height } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const isTablet = width >= 768 && width < 1024;
  const isWide = isDesktop;
  const formPanelWidth = Math.max(420, Math.min(520, width * 0.4));
  const [mode, setMode]       = useState('signin');
  const [showReset, setShowReset] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail]       = useState('');
  const [phone, setPhone]       = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [errors, setErrors]     = useState({});
  const [resetErrors, setResetErrors] = useState({});
  const [resetSuccessMessage, setResetSuccessMessage] = useState('');
  const modeAnim = useRef(new Animated.Value(mode === 'signup' ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(modeAnim, {
      toValue: mode === 'signup' ? 1 : 0,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [mode, modeAnim]);

  const validate = () => {
    const e = {};
    if (!email)    e.email    = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email';
    if (!password) e.password = 'Password is required';
    if (mode === 'signup') {
      if (!firstName.trim()) e.firstName = 'First name is required';
      if (!lastName.trim()) e.lastName = 'Surname is required';
      if (!phone.trim()) e.phone = 'Phone number is required';
      if (!confirmPassword) e.confirmPassword = 'Confirm your password';
      if (password && password.length < 8) e.password = 'Minimum 8 characters';
      if (password !== confirmPassword) e.confirmPassword = 'Passwords do not match';
    }
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const result = await doctorAuthApi.login({ email, password });
      onAuth?.({ token: result.token, doctor: result.doctor });
    } catch (error) {
      setErrors({ form: error?.message || 'Could not sign in right now.' });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const normalizedFirstName = firstName.trim();
      const normalizedLastName = lastName.trim();
      const result = await doctorAuthApi.register({
        email,
        password,
        profile: {
          fullName: `Dr. ${normalizedFirstName} ${normalizedLastName}`,
          firstName: normalizedFirstName,
          lastName: normalizedLastName,
          phone: phone.trim(),
        },
      });

      onAuth?.({ token: result.token, doctor: result.doctor });
    } catch (error) {
      setErrors({ form: error?.message || 'Could not create the account right now.' });
    } finally {
      setLoading(false);
    }
  };

  const openResetPassword = () => {
    setResetEmail(email);
    setResetPassword('');
    setResetConfirmPassword('');
    setResetErrors({});
    setResetSuccessMessage('');
    setShowReset(true);
  };

  const closeResetPassword = () => {
    setShowReset(false);
    setResetErrors({});
    setResetPassword('');
    setResetConfirmPassword('');
  };

  const handleResetPassword = async () => {
    const nextErrors = {};
    if (!resetEmail.trim()) nextErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(resetEmail.trim())) nextErrors.email = 'Enter a valid email';
    if (!resetPassword) nextErrors.password = 'New password is required';
    else if (resetPassword.length < 8) nextErrors.password = 'Minimum 8 characters';
    if (resetPassword !== resetConfirmPassword) nextErrors.confirmPassword = 'Passwords do not match';
    setResetErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    try {
      setResetLoading(true);
      await doctorAuthApi.resetPassword({ email: resetEmail.trim(), newPassword: resetPassword });
      setShowReset(false);
      setResetErrors({});
      setResetPassword('');
      setResetConfirmPassword('');
      setResetSuccessMessage('Password updated successfully. Please sign in with your new password.');
      setMode('signin');
    } catch (error) {
      setResetErrors({ form: error?.message || 'Could not reset the password right now.' });
    } finally {
      setResetLoading(false);
    }
  };

  if (isDesktop) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', minHeight: height }}>
        {/* Left brand panel */}
        <LinearGradient colors={['#050E1F', '#0D2147']} style={{ flex: 1, padding: 48, justifyContent: 'space-between', minHeight: height }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 36, height: 36, borderRadius: 9, backgroundColor: '#00C2B2', alignItems: 'center', justifyContent: 'center' }}>
              <Feather name="activity" size={18} color="#050E1F" />
            </View>
            <Text style={{ fontFamily: 'Sora_700Bold', fontSize: 18, color: '#fff' }}>lesio</Text>
          </View>

          <View>
            <Text style={{ fontFamily: 'Sora_700Bold', fontSize: 38, color: '#fff', lineHeight: 50, marginBottom: 16 }}>
              AI-Powered{'\n'}
              <Text style={{ color: '#00C2B2' }}>Dermatology</Text>{'\n'}
              Case Review
            </Text>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 16, color: 'rgba(255,255,255,0.6)', lineHeight: 26, marginBottom: 40 }}>
              Review AI-analyzed skin lesion cases, provide expert diagnoses, and help patients get the care they need.
            </Text>

            {/* Stats */}
            {[
              { icon: 'users',       value: '2,400+',  label: 'Patients served' },
              { icon: 'check-circle',value: '98.2%',   label: 'Satisfaction rate' },
              { icon: 'clock',       value: '< 3hrs',  label: 'Avg. response time' },
            ].map((st, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(0,194,178,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name={st.icon} size={18} color="#00C2B2" />
                </View>
                <View>
                  <Text style={{ fontFamily: 'Sora_700Bold', fontSize: 18, color: '#fff' }}>{st.value}</Text>
                  <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{st.label}</Text>
                </View>
              </View>
            ))}
          </View>

          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
            © 2024 Lesio Health, Inc. · HIPAA Compliant
          </Text>
        </LinearGradient>

        {/* Right form panel */}
        <View style={{ width: formPanelWidth, backgroundColor: '#F6F8FB', minHeight: height, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 24 }}>
          {showReset ? (
            <ResetPasswordCard
              isWide={isWide}
              viewportHeight={height}
              cardMaxWidth={460}
              resetEmail={resetEmail}
              setResetEmail={setResetEmail}
              resetPassword={resetPassword}
              setResetPassword={setResetPassword}
              resetConfirmPassword={resetConfirmPassword}
              setResetConfirmPassword={setResetConfirmPassword}
              resetLoading={resetLoading}
              resetErrors={resetErrors}
              onBack={closeResetPassword}
              onSubmit={handleResetPassword}
            />
          ) : (
            <LoginFormCard
              isWide={isWide}
              mode={mode}
              setMode={setMode}
              firstName={firstName}
              setFirstName={setFirstName}
              lastName={lastName}
              setLastName={setLastName}
              email={email}
              setEmail={setEmail}
              phone={phone}
              setPhone={setPhone}
              password={password}
              setPassword={setPassword}
              confirmPassword={confirmPassword}
              setConfirmPassword={setConfirmPassword}
              showPw={showPw}
              setShowPw={setShowPw}
              loading={loading}
              errors={errors}
              setErrors={setErrors}
              successMessage={resetSuccessMessage}
              modeAnim={modeAnim}
              viewportHeight={height}
              cardMaxWidth={460}
              onForgotPassword={openResetPassword}
              handleSubmit={mode === 'signup' ? handleRegister : handleLogin}
            />
          )}
        </View>
      </View>
    );
  }

  // Tablet and mobile
  return (
    <LinearGradient colors={['#050E1F', '#0D2147']} style={{ flex: 1 }}>
      <View
        style={{
          flex: 1,
          paddingHorizontal: isTablet ? 28 : 20,
          paddingTop: isTablet ? 32 : 40,
          paddingBottom: isTablet ? 32 : 24,
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: height,
        }}
      >
        {showReset ? (
          <ResetPasswordCard
            isWide={isWide}
            viewportHeight={height}
            cardMaxWidth={isTablet ? 620 : undefined}
            resetEmail={resetEmail}
            setResetEmail={setResetEmail}
            resetPassword={resetPassword}
            setResetPassword={setResetPassword}
            resetConfirmPassword={resetConfirmPassword}
            setResetConfirmPassword={setResetConfirmPassword}
            resetLoading={resetLoading}
            resetErrors={resetErrors}
            onBack={closeResetPassword}
            onSubmit={handleResetPassword}
          />
        ) : (
          <LoginFormCard
            isWide={isWide}
            mode={mode}
            setMode={setMode}
            firstName={firstName}
            setFirstName={setFirstName}
            lastName={lastName}
            setLastName={setLastName}
            email={email}
            setEmail={setEmail}
            phone={phone}
            setPhone={setPhone}
            password={password}
            setPassword={setPassword}
            confirmPassword={confirmPassword}
            setConfirmPassword={setConfirmPassword}
            showPw={showPw}
            setShowPw={setShowPw}
            loading={loading}
            errors={errors}
            setErrors={setErrors}
            successMessage={resetSuccessMessage}
            modeAnim={modeAnim}
            viewportHeight={height}
            cardMaxWidth={isTablet ? 620 : undefined}
            onForgotPassword={openResetPassword}
            handleSubmit={mode === 'signup' ? handleRegister : handleLogin}
          />
        )}
      </View>
    </LinearGradient>
  );
}

function LoginFormCard({
  isWide,
  mode,
  setMode,
  firstName,
  setFirstName,
  lastName,
  setLastName,
  email,
  setEmail,
  phone,
  setPhone,
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  showPw,
  setShowPw,
  loading,
  errors,
  setErrors,
  successMessage,
  modeAnim,
  viewportHeight,
  cardMaxWidth,
  onForgotPassword,
  handleSubmit,
}) {
  const isSignup = mode === 'signup';
  const [modeToggleWidth, setModeToggleWidth] = useState(0);
  const isTwoCol = isWide || (cardMaxWidth || 0) >= 560;
  const indicatorX = modeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.max(0, modeToggleWidth / 2)],
  });
  const fieldGap = 14;
  const innerPadding = isWide ? 36 : 24;
  const maxCardHeight = isWide ? Math.max(540, viewportHeight - 48) : undefined;

  return (
    <View style={{
      backgroundColor: '#fff',
      borderRadius: 20,
      padding: 0,
      width: '100%',
      maxWidth: cardMaxWidth || (isWide ? 440 : 560),
      maxHeight: maxCardHeight,
      minHeight: isWide ? 660 : 'auto',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 32,
      elevation: 8,
      overflow: 'hidden',
    }}>
      <ScrollView
        style={{ maxHeight: '100%' }}
        contentContainerStyle={{ paddingHorizontal: innerPadding, paddingVertical: innerPadding, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flex: 1 }}>
          {/* Logo */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: isSignup ? 22 : 28 }}>
            <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#00C2B2', alignItems: 'center', justifyContent: 'center' }}>
              <Feather name="activity" size={20} color="#050E1F" />
            </View>
            <View>
              <Text style={{ fontFamily: 'Sora_700Bold', fontSize: 20, color: '#050E1F', letterSpacing: -0.5 }}>lesio</Text>
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: '#6B7A99', marginTop: -2 }}>Doctor Portal</Text>
            </View>
          </View>

          <Text style={{ fontFamily: 'Sora_700Bold', fontSize: 26, color: '#1A2235', marginBottom: 6 }}>
            {mode === 'signup' ? 'Create doctor account' : 'Welcome back'}
          </Text>
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#6B7A99', marginBottom: isSignup ? 18 : 28, lineHeight: 20 }}>
            {mode === 'signup'
              ? 'Create your portal account to review patient cases and complete your profile.'
              : 'Sign in to your professional account to review patient cases.'}
          </Text>

          <View
            onLayout={(event) => setModeToggleWidth(event.nativeEvent.layout.width - 8)}
            style={{
              flexDirection: 'row',
              backgroundColor: '#F0F3F8',
              borderRadius: 999,
              padding: 4,
              marginBottom: isSignup ? 18 : 24,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 4,
                top: 4,
                bottom: 4,
                width: modeToggleWidth > 0 ? modeToggleWidth / 2 : '50%',
                borderRadius: 999,
                backgroundColor: '#00C2B2',
                transform: [{ translateX: indicatorX }],
              }}
            />
            {[
              { key: 'signin', label: 'Sign In' },
              { key: 'signup', label: 'Sign Up' },
            ].map((option) => (
              <TouchableOpacity
                key={option.key}
                onPress={() => { setMode(option.key); setErrors({}); }}
                activeOpacity={0.8}
                style={{
                  flex: 1,
                  borderRadius: 999,
                  paddingVertical: 10,
                  alignItems: 'center',
                  backgroundColor: 'transparent',
                }}
              >
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: mode === option.key ? '#050E1F' : '#6B7A99' }}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {successMessage ? (
            <View style={{ backgroundColor: 'rgba(0,194,178,0.12)', borderColor: 'rgba(0,194,178,0.22)', borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 16 }}>
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#00A896' }}>{successMessage}</Text>
            </View>
          ) : null}

          {errors.form && (
            <View style={{ backgroundColor: 'rgba(255,71,87,0.08)', borderColor: 'rgba(255,71,87,0.2)', borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 16 }}>
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#FF4757' }}>{errors.form}</Text>
            </View>
          )}

          {mode === 'signup' && (
            <View style={{ flexDirection: isTwoCol ? 'row' : 'column', gap: fieldGap, marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: '#3A4560', marginBottom: 6 }}>First name</Text>
                <View style={[
                  { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, minHeight: 48, backgroundColor: '#F6F8FB' },
                  { borderColor: errors.firstName ? '#FF4757' : '#DDE3EE' },
                ]}>
                  <Feather name="user" size={17} color={errors.firstName ? '#FF4757' : '#A8B4CC'} style={{ marginRight: 10 }} />
                  <TextInput
                    value={firstName}
                    onChangeText={v => { setFirstName(v); setErrors(e => ({ ...e, firstName: null })); }}
                    placeholder="Sarah"
                    placeholderTextColor="#A8B4CC"
                    autoCapitalize="words"
                    autoCorrect={false}
                    style={{ flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#1A2235', paddingVertical: 12 }}
                  />
                </View>
                {errors.firstName && <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#FF4757', marginTop: 4 }}>{errors.firstName}</Text>}
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: '#3A4560', marginBottom: 6 }}>Surname</Text>
                <View style={[
                  { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, minHeight: 48, backgroundColor: '#F6F8FB' },
                  { borderColor: errors.lastName ? '#FF4757' : '#DDE3EE' },
                ]}>
                  <Feather name="user-check" size={17} color={errors.lastName ? '#FF4757' : '#A8B4CC'} style={{ marginRight: 10 }} />
                  <TextInput
                    value={lastName}
                    onChangeText={v => { setLastName(v); setErrors(e => ({ ...e, lastName: null })); }}
                    placeholder="Chen"
                    placeholderTextColor="#A8B4CC"
                    autoCapitalize="words"
                    autoCorrect={false}
                    style={{ flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#1A2235', paddingVertical: 12 }}
                  />
                </View>
                {errors.lastName && <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#FF4757', marginTop: 4 }}>{errors.lastName}</Text>}
              </View>
            </View>
          )}

          {mode === 'signup' && (
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: '#6B7A99', marginTop: -6, marginBottom: 12 }}>
              Display name will be generated automatically as Dr. {firstName || 'First'} {lastName || 'Last'}.
            </Text>
          )}

          {/* Email */}
          <View style={{ marginBottom: isSignup ? 12 : 16 }}>
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: '#3A4560', marginBottom: 6 }}>
              Email address
            </Text>
            <View style={[
              { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, minHeight: 48, backgroundColor: '#F6F8FB' },
              { borderColor: errors.email ? '#FF4757' : '#DDE3EE' },
            ]}>
              <Feather name="mail" size={17} color={errors.email ? '#FF4757' : '#A8B4CC'} style={{ marginRight: 10 }} />
              <TextInput
                value={email}
                onChangeText={v => { setEmail(v); setErrors(e => ({ ...e, email: null })); }}
                placeholder="you@hospital.com"
                placeholderTextColor="#A8B4CC"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={{ flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#1A2235', paddingVertical: 12 }}
              />
            </View>
            {errors.email && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <Feather name="alert-circle" size={12} color="#FF4757" />
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#FF4757' }}>{errors.email}</Text>
              </View>
            )}
          </View>

          {mode === 'signup' && (
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: '#3A4560', marginBottom: 6 }}>Phone number</Text>
              <View style={[
                { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, minHeight: 48, backgroundColor: '#F6F8FB' },
                { borderColor: errors.phone ? '#FF4757' : '#DDE3EE' },
              ]}>
                <Feather name="phone" size={17} color={errors.phone ? '#FF4757' : '#A8B4CC'} style={{ marginRight: 10 }} />
                <TextInput
                  value={phone}
                  onChangeText={v => { setPhone(v); setErrors(e => ({ ...e, phone: null })); }}
                  placeholder="+1 555 123 4567"
                  placeholderTextColor="#A8B4CC"
                  keyboardType="phone-pad"
                  autoCorrect={false}
                  style={{ flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#1A2235', paddingVertical: 12 }}
                />
              </View>
              {errors.phone && <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#FF4757', marginTop: 4 }}>{errors.phone}</Text>}
            </View>
          )}

          {/* Password */}
          <View style={{ marginBottom: isSignup ? 6 : 8 }}>
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: '#3A4560', marginBottom: 6 }}>
              Password
            </Text>
            <View style={[
              { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, minHeight: 48, backgroundColor: '#F6F8FB' },
              { borderColor: errors.password ? '#FF4757' : '#DDE3EE' },
            ]}>
              <Feather name="lock" size={17} color={errors.password ? '#FF4757' : '#A8B4CC'} style={{ marginRight: 10 }} />
              <TextInput
                value={password}
                onChangeText={v => { setPassword(v); setErrors(e => ({ ...e, password: null })); }}
                placeholder="••••••••"
                placeholderTextColor="#A8B4CC"
                secureTextEntry={!showPw}
                autoCorrect={false}
                style={{ flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#1A2235', paddingVertical: 12 }}
              />
              <TouchableOpacity onPress={() => setShowPw(v => !v)} accessibilityLabel={showPw ? 'Hide password' : 'Show password'}>
                <Feather name={showPw ? 'eye-off' : 'eye'} size={17} color="#A8B4CC" />
              </TouchableOpacity>
            </View>
            {errors.password && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <Feather name="alert-circle" size={12} color="#FF4757" />
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#FF4757' }}>{errors.password}</Text>
              </View>
            )}
          </View>

          {mode === 'signup' && (
            <View style={{ marginBottom: 8 }}>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: '#3A4560', marginBottom: 6 }}>Confirm password</Text>
              <View style={[
                { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, minHeight: 48, backgroundColor: '#F6F8FB' },
                { borderColor: errors.confirmPassword ? '#FF4757' : '#DDE3EE' },
              ]}>
                <Feather name="shield" size={17} color={errors.confirmPassword ? '#FF4757' : '#A8B4CC'} style={{ marginRight: 10 }} />
                <TextInput
                  value={confirmPassword}
                  onChangeText={v => { setConfirmPassword(v); setErrors(e => ({ ...e, confirmPassword: null })); }}
                  placeholder="Repeat password"
                  placeholderTextColor="#A8B4CC"
                  secureTextEntry={!showPw}
                  autoCorrect={false}
                  style={{ flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#1A2235', paddingVertical: 12 }}
                />
                <TouchableOpacity onPress={() => setShowPw(v => !v)} accessibilityLabel={showPw ? 'Hide password' : 'Show password'}>
                  <Feather name={showPw ? 'eye-off' : 'eye'} size={17} color="#A8B4CC" />
                </TouchableOpacity>
              </View>
              {errors.confirmPassword && <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#FF4757', marginTop: 4 }}>{errors.confirmPassword}</Text>}
            </View>
          )}

          <TouchableOpacity onPress={onForgotPassword} style={{ alignSelf: 'flex-end', marginBottom: isSignup ? 16 : 24 }}>
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: '#00C2B2' }}>Forgot password?</Text>
          </TouchableOpacity>

          {/* Sign in button */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
            style={{
              backgroundColor: loading ? '#A8B4CC' : '#00C2B2',
              borderRadius: 999,
              minHeight: 50,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 8,
              marginBottom: 20,
              shadowColor: '#00C2B2',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: loading ? 0 : 0.3,
              shadowRadius: 16,
              elevation: 4,
            }}
          >
            {loading
              ? <ActivityIndicator color="#050E1F" size="small" />
              : <>
                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: '#050E1F' }}>{mode === 'signup' ? 'Create Account' : 'Sign In'}</Text>
                  <Feather name="arrow-right" size={15} color="#050E1F" />
                </>
            }
          </TouchableOpacity>

          {mode === 'signin' && (
            <TouchableOpacity onPress={() => setMode('signup')} style={{ alignSelf: 'center', marginBottom: 16 }}>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: '#00C2B2' }}>Create a doctor account</Text>
            </TouchableOpacity>
          )}

          {/* Patient app callout */}
          <View style={{ backgroundColor: 'rgba(0,194,178,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(0,194,178,0.2)', flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
            <Feather name="smartphone" size={16} color="#00C2B2" style={{ marginTop: 1 }} />
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#6B7A99', flex: 1, lineHeight: 20 }}>
              Are you a patient?{' '}
              <Text style={{ color: '#00C2B2', fontFamily: 'DMSans_500Medium' }}>Download the Lesio mobile app</Text>
              {' '}to scan and track your skin health.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function ResetPasswordCard({
  isWide,
  viewportHeight,
  cardMaxWidth,
  resetEmail,
  setResetEmail,
  resetPassword,
  setResetPassword,
  resetConfirmPassword,
  setResetConfirmPassword,
  resetLoading,
  resetErrors,
  onBack,
  onSubmit,
}) {
  return (
    <View style={{
      backgroundColor: '#fff',
      borderRadius: 20,
      padding: isWide ? 44 : 28,
      width: '100%',
      maxWidth: cardMaxWidth || (isWide ? 440 : 560),
      maxHeight: isWide ? Math.max(540, viewportHeight - 48) : undefined,
      minHeight: isWide ? 520 : 'auto',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 32,
      elevation: 8,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 28 }}>
        <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#00C2B2', alignItems: 'center', justifyContent: 'center' }}>
          <Feather name="lock" size={18} color="#050E1F" />
        </View>
        <View>
          <Text style={{ fontFamily: 'Sora_700Bold', fontSize: 20, color: '#050E1F', letterSpacing: -0.5 }}>Reset password</Text>
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: '#6B7A99', marginTop: -2 }}>Doctor Portal</Text>
        </View>
      </View>

      <Text style={{ fontFamily: 'Sora_700Bold', fontSize: 26, color: '#1A2235', marginBottom: 6 }}>
        Forgot your password?
      </Text>
      <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#6B7A99', marginBottom: 24, lineHeight: 20 }}>
        Enter your email and choose a new password to regain access to the portal.
      </Text>

      {resetErrors.form && (
        <View style={{ backgroundColor: 'rgba(255,71,87,0.08)', borderColor: 'rgba(255,71,87,0.2)', borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 16 }}>
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#FF4757' }}>{resetErrors.form}</Text>
        </View>
      )}

      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: '#3A4560', marginBottom: 6 }}>Email address</Text>
        <View style={[
          { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, minHeight: 48, backgroundColor: '#F6F8FB' },
          { borderColor: resetErrors.email ? '#FF4757' : '#DDE3EE' },
        ]}>
          <Feather name="mail" size={17} color={resetErrors.email ? '#FF4757' : '#A8B4CC'} style={{ marginRight: 10 }} />
          <TextInput
            value={resetEmail}
            onChangeText={v => setResetEmail(v)}
            placeholder="you@hospital.com"
            placeholderTextColor="#A8B4CC"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={{ flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#1A2235', paddingVertical: 12 }}
          />
        </View>
        {resetErrors.email && <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#FF4757', marginTop: 4 }}>{resetErrors.email}</Text>}
      </View>

      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: '#3A4560', marginBottom: 6 }}>New password</Text>
        <View style={[
          { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, minHeight: 48, backgroundColor: '#F6F8FB' },
          { borderColor: resetErrors.password ? '#FF4757' : '#DDE3EE' },
        ]}>
          <Feather name="lock" size={17} color={resetErrors.password ? '#FF4757' : '#A8B4CC'} style={{ marginRight: 10 }} />
          <TextInput
            value={resetPassword}
            onChangeText={v => setResetPassword(v)}
            placeholder="Enter new password"
            placeholderTextColor="#A8B4CC"
            secureTextEntry
            autoCorrect={false}
            style={{ flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#1A2235', paddingVertical: 12 }}
          />
        </View>
        {resetErrors.password && <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#FF4757', marginTop: 4 }}>{resetErrors.password}</Text>}
      </View>

      <View style={{ marginBottom: 20 }}>
        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: '#3A4560', marginBottom: 6 }}>Confirm password</Text>
        <View style={[
          { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, minHeight: 48, backgroundColor: '#F6F8FB' },
          { borderColor: resetErrors.confirmPassword ? '#FF4757' : '#DDE3EE' },
        ]}>
          <Feather name="shield" size={17} color={resetErrors.confirmPassword ? '#FF4757' : '#A8B4CC'} style={{ marginRight: 10 }} />
          <TextInput
            value={resetConfirmPassword}
            onChangeText={v => setResetConfirmPassword(v)}
            placeholder="Repeat new password"
            placeholderTextColor="#A8B4CC"
            secureTextEntry
            autoCorrect={false}
            style={{ flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#1A2235', paddingVertical: 12 }}
          />
        </View>
        {resetErrors.confirmPassword && <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#FF4757', marginTop: 4 }}>{resetErrors.confirmPassword}</Text>}
      </View>

      <TouchableOpacity
        onPress={onSubmit}
        disabled={resetLoading}
        activeOpacity={0.85}
        style={{
          backgroundColor: resetLoading ? '#A8B4CC' : '#00C2B2',
          borderRadius: 999,
          minHeight: 50,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
          marginBottom: 16,
          shadowColor: '#00C2B2',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: resetLoading ? 0 : 0.3,
          shadowRadius: 16,
          elevation: 4,
        }}
      >
        {resetLoading
          ? <ActivityIndicator color="#050E1F" size="small" />
          : <>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: '#050E1F' }}>Update Password</Text>
              <Feather name="check" size={15} color="#050E1F" />
            </>
        }
      </TouchableOpacity>

      <TouchableOpacity onPress={onBack} style={{ alignSelf: 'center' }}>
        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: '#00C2B2' }}>Back to sign in</Text>
      </TouchableOpacity>
    </View>
  );
}
