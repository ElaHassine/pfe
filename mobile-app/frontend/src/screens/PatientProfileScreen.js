import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import Slider from '@react-native-community/slider';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Colors, Type, Space, Radius, Shadow, HIT } from '../theme';
import { useAuth } from '../context/AuthContext';

function buildInitials(firstName = '', lastName = '', fallback = 'PA') {
  const first = String(firstName || '').trim();
  const last = String(lastName || '').trim();
  if (first || last) return `${first[0] || ''}${last[0] || first[1] || ''}`.toUpperCase();
  return fallback;
}

export default function PatientProfileScreen({ navigation }) {
  const { user, updateProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [resizePercent, setResizePercent] = useState(100);
  const [photoSize, setPhotoSize] = useState({ width: 0, height: 0 });

  const initial = useMemo(() => ({
    firstName: user?.profile?.firstName || '',
    lastName: user?.profile?.lastName || '',
    avatarUrl: user?.profile?.avatarUrl || '',
  }), [user]);

  const [form, setForm] = useState(initial);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const pickProfilePhoto = async (source = 'library') => {
    try {
      const permission = source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert('Permission needed', source === 'camera' ? 'Camera permission is required.' : 'Photo library permission is required.');
        return;
      }

      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 1, base64: true })
        : await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 1, base64: true });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const value = asset.uri || '';
      updateField('avatarUrl', value);
      setPhotoSize({ width: Number(asset.width) || 0, height: Number(asset.height) || 0 });
      setResizePercent(100);
    } catch (error) {
      Alert.alert('Photo unavailable', error?.message || 'Could not process profile photo.');
    }
  };

  const applyResize = async (sourceUri, percent) => {
    const normalizedPercent = Math.max(100, Math.min(200, Number(percent) || 100));
    const sourceWidth = Number(photoSize.width) || 1024;
    const sourceHeight = Number(photoSize.height) || 1024;
    const minDim = Math.max(1, Math.min(sourceWidth, sourceHeight));
    const cropSize = Math.max(1, Math.round(minDim * (100 / normalizedPercent)));
    const originX = Math.max(0, Math.round((sourceWidth - cropSize) / 2));
    const originY = Math.max(0, Math.round((sourceHeight - cropSize) / 2));
    const resized = await ImageManipulator.manipulateAsync(
      sourceUri,
      [
        { crop: { originX, originY, width: cropSize, height: cropSize } },
        { resize: { width: 512, height: 512 } },
      ],
      {
        compress: 0.82,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      }
    );

    if (resized.base64) {
      return `data:image/jpeg;base64,${resized.base64}`;
    }

    return resized.uri;
  };

  const handleSave = async () => {
    const firstName = String(form.firstName || '').trim();
    const lastName = String(form.lastName || '').trim();

    if (!firstName || !lastName) {
      Alert.alert('Missing information', 'Please enter both first name and surname.');
      return;
    }

    const fullName = `${firstName} ${lastName}`.trim();

    setSaving(true);
    try {
      let avatarUrl = form.avatarUrl || '';
      if (avatarUrl && !String(avatarUrl).startsWith('http') && !String(avatarUrl).startsWith('data:')) {
        avatarUrl = await applyResize(avatarUrl, resizePercent);
      }

      await updateProfile({
        profile: {
          firstName,
          lastName,
          fullName,
          avatarUrl,
        },
      });
      navigation.goBack();
    } catch (error) {
      Alert.alert('Update failed', error?.message || 'Could not update profile right now.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.grey50 }}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={s.headerWrap}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={HIT}>
            <Feather name="arrow-left" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Edit Profile</Text>
          <View style={s.backBtn} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={s.content}>
        <View style={[s.card, Shadow.sm]}>
          <Text style={s.sectionTitle}>Profile Photo</Text>
          <View style={s.photoRow}>
            <View style={s.photoPreview}>
              {form.avatarUrl ? (
                <Image source={{ uri: form.avatarUrl }} style={s.photoImage} resizeMode="cover" />
              ) : (
                <Text style={s.photoInitials}>{buildInitials(form.firstName, form.lastName, 'PA')}</Text>
              )}
            </View>
            <View style={s.photoActions}>
              <TouchableOpacity style={s.photoBtn} onPress={() => pickProfilePhoto('library')} activeOpacity={0.78}>
                <Feather name="upload" size={14} color={Colors.primary} />
                <Text style={s.photoBtnText}>Upload photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.photoBtn} onPress={() => pickProfilePhoto('camera')} activeOpacity={0.78}>
                <Feather name="camera" size={14} color={Colors.primary} />
                <Text style={s.photoBtnText}>Take photo</Text>
              </TouchableOpacity>
              {form.avatarUrl ? (
                <TouchableOpacity style={s.photoBtn} onPress={() => {
                  updateField('avatarUrl', '');
                  setPhotoSize({ width: 0, height: 0 });
                  setResizePercent(100);
                }} activeOpacity={0.78}>
                  <Feather name="trash-2" size={14} color={Colors.riskHigh} />
                  <Text style={[s.photoBtnText, { color: Colors.riskHigh }]}>Remove</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
          <View style={s.sliderWrap}>
            <View style={s.sliderTopRow}>
              <Text style={s.sliderLabel}>Zoom / resize</Text>
              <Text style={s.sliderValue}>{resizePercent}%</Text>
            </View>
            <Slider
              minimumValue={100}
              maximumValue={200}
              step={5}
              value={resizePercent}
              onValueChange={setResizePercent}
              minimumTrackTintColor={Colors.primary}
              maximumTrackTintColor={Colors.grey100}
              thumbTintColor={Colors.primary}
            />
            <Text style={s.sliderNote}>
              {photoSize.width && photoSize.height
                ? `Current photo size: ${photoSize.width} x ${photoSize.height}`
                : 'Photo size will be used automatically when you upload.'}
            </Text>
            <Text style={s.hint}>The crop stays centered while the slider changes the zoom before upload.</Text>
          </View>
        </View>

        <View style={[s.card, Shadow.sm]}>
          <Text style={s.sectionTitle}>Personal Info</Text>

          <Text style={s.label}>First name</Text>
          <TextInput
            value={form.firstName}
            onChangeText={(value) => updateField('firstName', value)}
            placeholder="First name"
            placeholderTextColor={Colors.textMuted}
            style={s.input}
            autoCapitalize="words"
          />

          <Text style={s.label}>Surname</Text>
          <TextInput
            value={form.lastName}
            onChangeText={(value) => updateField('lastName', value)}
            placeholder="Surname"
            placeholderTextColor={Colors.textMuted}
            style={s.input}
            autoCapitalize="words"
          />

          <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving} activeOpacity={0.8}>
            {saving ? <ActivityIndicator color={Colors.primaryOnDark} /> : <Text style={s.saveBtnText}>Save Profile</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  headerWrap: { backgroundColor: '#050E1F' },
  header: { minHeight: 56, paddingHorizontal: Space.s8, paddingVertical: Space.s8, flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...Type.d4, color: Colors.textPrimary, flex: 1, textAlign: 'center' },

  content: { padding: Space.s20, paddingBottom: Space.s40, gap: Space.s12 },
  card: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Space.s16 },
  sectionTitle: { ...Type.d4, color: Colors.textOnLight, marginBottom: Space.s12 },

  photoRow: { flexDirection: 'row', alignItems: 'center', gap: Space.s12 },
  photoPreview: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: Colors.primaryDim,
    borderWidth: 1.5,
    borderColor: Colors.primary + '66',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoImage: { width: '100%', height: '100%' },
  photoInitials: { ...Type.d3, color: Colors.primary, fontWeight: '700' },
  photoActions: { flex: 1, gap: Space.s8 },
  photoBtn: {
    minHeight: 38,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.grey100,
    backgroundColor: Colors.grey50,
    paddingHorizontal: Space.s10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.s8,
  },
  photoBtnText: { ...Type.l3, color: Colors.primary },
  sliderWrap: { marginTop: Space.s12 },
  sliderTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Space.s8 },
  sliderLabel: { ...Type.l2, color: Colors.textOnLight },
  sliderValue: { ...Type.l3, color: Colors.primary, fontWeight: '700' },
  sliderNote: { ...Type.l3, color: Colors.textMuted, marginTop: Space.s6 },
  hint: { ...Type.l3, color: Colors.textMuted, marginTop: Space.s8 },

  label: { ...Type.l2, color: Colors.textOnLight, marginBottom: Space.s8 },
  input: {
    minHeight: 46,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.grey100,
    backgroundColor: Colors.grey50,
    paddingHorizontal: Space.s12,
    color: Colors.textOnLight,
    ...Type.b2,
    marginBottom: Space.s12,
  },
  saveBtn: {
    marginTop: Space.s4,
    minHeight: 46,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  saveBtnText: { ...Type.l1, color: Colors.primaryOnDark },
});
