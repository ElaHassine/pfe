import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { doctorAuthApi } from '../services/api';

export default function LoginScreen({ onAuth }) {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const [mode, setMode]       = useState('signin');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail]       = useState('');
  const [phone, setPhone]       = useState('');
  const [specialty, setSpecialty] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [errors, setErrors]     = useState({});

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
        specialty: specialty.trim() || 'Dermatology',
      });

      onAuth?.({ token: result.token, doctor: result.doctor });
    } catch (error) {
      setErrors({ form: error?.message || 'Could not create the account right now.' });
    } finally {
      setLoading(false);
    }
  };

  if (isWide) {
    return (
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {/* Left brand panel */}
        <LinearGradient colors={['#050E1F', '#0D2147']} style={{ flex: 1, padding: 48, justifyContent: 'space-between' }}>
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
        <View style={{ width: 520, backgroundColor: '#F6F8FB', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
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
            specialty={specialty}
            setSpecialty={setSpecialty}
            password={password}
            setPassword={setPassword}
            confirmPassword={confirmPassword}
            setConfirmPassword={setConfirmPassword}
            showPw={showPw}
            setShowPw={setShowPw}
            loading={loading}
            errors={errors}
            setErrors={setErrors}
            handleSubmit={mode === 'signup' ? handleRegister : handleLogin}
          />
        </View>
      </View>
    );
  }

  // Mobile
  return (
    <LinearGradient colors={['#050E1F', '#0D2147']} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20, paddingTop: 60, paddingBottom: 40, justifyContent: 'center' }}>
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
          specialty={specialty}
          setSpecialty={setSpecialty}
          password={password}
          setPassword={setPassword}
          confirmPassword={confirmPassword}
          setConfirmPassword={setConfirmPassword}
          showPw={showPw}
          setShowPw={setShowPw}
          loading={loading}
          errors={errors}
          setErrors={setErrors}
          handleSubmit={mode === 'signup' ? handleRegister : handleLogin}
        />
      </ScrollView>
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
  specialty,
  setSpecialty,
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  showPw,
  setShowPw,
  loading,
  errors,
  setErrors,
  handleSubmit,
}) {
  return (
    <View style={{
      backgroundColor: '#fff',
      borderRadius: 20,
      padding: isWide ? 48 : 28,
      width: isWide ? 440 : '100%',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 32,
      elevation: 8,
    }}>
      {/* Logo */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 32 }}>
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
      <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#6B7A99', marginBottom: 32, lineHeight: 20 }}>
        {mode === 'signup'
          ? 'Create your portal account to review patient cases and complete your profile.'
          : 'Sign in to your professional account to review patient cases.'}
      </Text>

      <View style={{ flexDirection: 'row', backgroundColor: '#F0F3F8', borderRadius: 999, padding: 4, marginBottom: 24 }}>
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
              backgroundColor: mode === option.key ? '#00C2B2' : 'transparent',
            }}
          >
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: mode === option.key ? '#050E1F' : '#6B7A99' }}>{option.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {errors.form && (
        <View style={{ backgroundColor: 'rgba(255,71,87,0.08)', borderColor: 'rgba(255,71,87,0.2)', borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 16 }}>
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#FF4757' }}>{errors.form}</Text>
        </View>
      )}

      {mode === 'signup' && (
        <View style={{ marginBottom: 16 }}>
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
      )}

      {mode === 'signup' && (
        <View style={{ marginBottom: 16 }}>
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
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: '#6B7A99', marginTop: 6 }}>Display name will be generated automatically as Dr. {firstName || 'First'} {lastName || 'Last'}.</Text>
        </View>
      )}

      {/* Email */}
      <View style={{ marginBottom: 16 }}>
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
        <View style={{ marginBottom: 16 }}>
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
      <View style={{ marginBottom: 8 }}>
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
        <>
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: '#3A4560', marginBottom: 6 }}>Specialty / domain</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, minHeight: 48, backgroundColor: '#F6F8FB', borderColor: '#DDE3EE' }}>
              <Feather name="award" size={17} color="#A8B4CC" style={{ marginRight: 10 }} />
              <TextInput
                value={specialty}
                onChangeText={setSpecialty}
                placeholder="Dermatology, oncology, etc."
                placeholderTextColor="#A8B4CC"
                autoCorrect={false}
                style={{ flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#1A2235', paddingVertical: 12 }}
              />
            </View>
          </View>

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
        </>
      )}

      <TouchableOpacity style={{ alignSelf: 'flex-end', marginBottom: 24 }}>
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
          marginBottom: 24,
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
  );
}
