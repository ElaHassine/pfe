import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Image, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { doctorAuthApi } from '../services/api';

function buildInitials(firstName = '', lastName = '', fallback = 'DR') {
  const first = String(firstName || '').trim();
  const last = String(lastName || '').trim();
  if (first || last) return `${first[0] || ''}${last[0] || first[1] || ''}`.toUpperCase();
  return fallback;
}

function resizeImageFileToDataUrl(file, scalePercent = 100) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const src = typeof reader.result === 'string' ? reader.result : '';
      if (!src) {
        reject(new Error('Could not read image file.'));
        return;
      }

      const img = document.createElement('img');
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const width = Number(img.width || 1);
        const height = Number(img.height || 1);
        const normalizedPercent = Math.max(100, Math.min(200, Number(scalePercent) || 100));
        const minDim = Math.max(1, Math.min(width, height));
        const cropSize = Math.max(1, Math.round(minDim * (100 / normalizedPercent)));
        const originX = Math.max(0, Math.round((width - cropSize) / 2));
        const originY = Math.max(0, Math.round((height - cropSize) / 2));

        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not process image.'));
          return;
        }

        ctx.drawImage(img, originX, originY, cropSize, cropSize, 0, 0, 512, 512);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };

      img.onerror = () => reject(new Error('Invalid image file.'));
      img.src = src;
    };
    reader.onerror = () => reject(new Error('Could not load image.'));
    reader.readAsDataURL(file);
  });
}

export default function SettingsScreen({ doctor, onDoctorUpdated }) {
  const initial = useMemo(() => ({
    firstName: doctor?.profile?.firstName || '',
    lastName: doctor?.profile?.lastName || '',
    email: doctor?.email || '',
    phone: doctor?.profile?.phone || '',
    location: doctor?.profile?.location || '',
    specialty: doctor?.specialty || '',
    hospital: doctor?.credentials?.hospital || '',
    licenseNumber: doctor?.credentials?.licenseNumber || '',
    proofUrl: doctor?.credentials?.proofUrl || '',
    yearsExperience: String(doctor?.credentials?.yearsExperience || ''),
    bio: doctor?.profile?.bio || '',
    avatarUrl: doctor?.profile?.avatarUrl || '',
  }), [doctor]);

  const [form, setForm] = useState(initial);
  const [photoFile, setPhotoFile] = useState(null);
  const [resizePercent, setResizePercent] = useState(100);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const pickPhoto = (captureMode = false) => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      setStatus('Photo upload is available in the web doctor portal.');
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (captureMode) input.setAttribute('capture', 'environment');

    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const previewReader = new FileReader();
      previewReader.onload = () => {
        const previewUrl = typeof previewReader.result === 'string' ? previewReader.result : '';
        setPhotoFile(file);
        setResizePercent(100);
        setForm((prev) => ({ ...prev, avatarUrl: previewUrl }));
      };
      previewReader.readAsDataURL(file);
    };

    input.click();
  };

  const handleSave = async () => {
    setSaving(true);
    setStatus('');
    try {
      const normalizedFirstName = form.firstName.trim();
      const normalizedLastName = form.lastName.trim();
      const resizedAvatarUrl = photoFile ? await resizeImageFileToDataUrl(photoFile, resizePercent) : form.avatarUrl;
      const response = await doctorAuthApi.updateMe({
        profile: {
          fullName: `Dr. ${normalizedFirstName} ${normalizedLastName}`,
          firstName: normalizedFirstName,
          lastName: normalizedLastName,
          phone: form.phone,
          location: form.location,
          bio: form.bio,
          avatarUrl: resizedAvatarUrl,
        },
        specialty: form.specialty,
        credentials: {
          hospital: form.hospital,
          licenseNumber: form.licenseNumber,
          proofUrl: form.proofUrl,
          yearsExperience: Number(form.yearsExperience) || 0,
        },
      });

      onDoctorUpdated?.(response.doctor);
      setStatus('Profile updated successfully.');
    } catch (error) {
      setStatus(error?.message || 'Could not update profile right now.');
    } finally {
      setSaving(false);
    }
  };

  const fields = [
    { key: 'firstName', label: 'First name', placeholder: 'Sarah' },
    { key: 'lastName', label: 'Surname', placeholder: 'Chen' },
    { key: 'email', label: 'Email', placeholder: 'doctor@hospital.com', editable: false },
    { key: 'phone', label: 'Phone number', placeholder: '+1 555 123 4567' },
    { key: 'location', label: 'Cabinet location', placeholder: 'Building A, Floor 3, Room 12' },
    { key: 'specialty', label: 'Specialty / domain', placeholder: 'Dermatology & Skin Oncology' },
    { key: 'hospital', label: 'Hospital / clinic', placeholder: 'City Medical Center' },
    { key: 'licenseNumber', label: 'License number', placeholder: 'MED-123456' },
    { key: 'proofUrl', label: 'Professional proof URL', placeholder: 'https://.../certificate.pdf' },
    { key: 'yearsExperience', label: 'Years of experience', placeholder: '10' },
    { key: 'bio', label: 'Short bio', placeholder: 'Your professional bio' },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F6F8FB' }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text style={{ fontFamily: 'Sora_700Bold', fontSize: 24, color: '#1A2235', marginBottom: 6 }}>Settings</Text>
      <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#6B7A99', marginBottom: 18 }}>
        Complete your profile to verify your professional identity and improve patient trust.
      </Text>
      <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#00C2B2', marginBottom: 12 }}>
        Display name is generated automatically as Dr. {form.firstName || 'First'} {form.lastName || 'Last'}.
      </Text>

      <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 18 }}>
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: '#3A4560', marginBottom: 8 }}>Profile photo</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(0,194,178,0.12)', borderWidth: 1.5, borderColor: '#00C2B2', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
              {form.avatarUrl ? (
                <Image source={{ uri: form.avatarUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              ) : (
                <Text style={{ fontFamily: 'Sora_700Bold', fontSize: 20, color: '#00C2B2' }}>{buildInitials(form.firstName, form.lastName)}</Text>
              )}
            </View>
            <View style={{ flex: 1, gap: 8 }}>
              <TouchableOpacity
                onPress={() => pickPhoto(false)}
                activeOpacity={0.82}
                style={{ minHeight: 38, borderRadius: 10, borderWidth: 1.2, borderColor: '#DDE3EE', backgroundColor: '#F6F8FB', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}
              >
                <Feather name="upload" size={14} color="#00C2B2" />
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: '#00C2B2' }}>Upload photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => pickPhoto(true)}
                activeOpacity={0.82}
                style={{ minHeight: 38, borderRadius: 10, borderWidth: 1.2, borderColor: '#DDE3EE', backgroundColor: '#F6F8FB', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}
              >
                <Feather name="camera" size={14} color="#00C2B2" />
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: '#00C2B2' }}>Take photo</Text>
              </TouchableOpacity>
              {form.avatarUrl ? (
                <TouchableOpacity
                  onPress={() => {
                    setPhotoFile(null);
                    setResizePercent(100);
                    update('avatarUrl', '');
                  }}
                  activeOpacity={0.82}
                  style={{ minHeight: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}
                >
                  <Feather name="trash-2" size={14} color="#FF4757" />
                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: '#FF4757' }}>Remove photo</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
          <View style={{ marginTop: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: '#3A4560' }}>Resize before upload</Text>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: '#00C2B2' }}>{resizePercent}%</Text>
            </View>
            <Slider
              minimumValue={100}
              maximumValue={200}
              step={5}
              value={resizePercent}
              onValueChange={setResizePercent}
              minimumTrackTintColor="#00C2B2"
              maximumTrackTintColor="#DDE3EE"
              thumbTintColor="#00C2B2"
            />
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: '#6B7A99', marginTop: 8 }}>The crop stays centered while the slider changes the zoom before upload.</Text>
          </View>
        </View>

        {fields.map((field) => (
          <View key={field.key} style={{ marginBottom: 14 }}>
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: '#3A4560', marginBottom: 6 }}>{field.label}</Text>
            <TextInput
              value={form[field.key]}
              onChangeText={(value) => update(field.key, value)}
              editable={field.editable !== false}
              placeholder={field.placeholder}
              placeholderTextColor="#A8B4CC"
              multiline={field.key === 'bio'}
              numberOfLines={field.key === 'bio' ? 3 : 1}
              style={{
                minHeight: field.key === 'bio' ? 90 : 44,
                textAlignVertical: field.key === 'bio' ? 'top' : 'center',
                backgroundColor: field.editable === false ? '#F0F2F7' : '#F6F8FB',
                borderWidth: 1.5,
                borderColor: '#DDE3EE',
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: field.key === 'bio' ? 12 : 8,
                fontFamily: 'DMSans_400Regular',
                fontSize: 13,
                color: '#1A2235',
              }}
            />
          </View>
        ))}

        {status ? (
          <View style={{ marginBottom: 12, padding: 10, borderRadius: 10, backgroundColor: status.includes('successfully') ? 'rgba(0,196,140,0.12)' : 'rgba(255,71,87,0.12)' }}>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: status.includes('successfully') ? '#00C48C' : '#FF4757' }}>{status}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.82}
          style={{ backgroundColor: saving ? '#A8B4CC' : '#00C2B2', borderRadius: 999, paddingVertical: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
        >
          <Feather name="save" size={15} color="#050E1F" />
          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: '#050E1F' }}>{saving ? 'Saving...' : 'Save Profile'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
