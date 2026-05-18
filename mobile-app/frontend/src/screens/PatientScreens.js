/**
 * All remaining Lesio screens — v2 rebuild
 * Follows ui-ux-pro-max + ckmui-styling standards throughout
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Alert, Animated, TextInput, Dimensions, Image, PanResponder,
  ActivityIndicator, Platform, Modal, Pressable, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Colors, Type, Space, Radius, Shadow, HIT, riskConfig } from '../theme';
import { Button, RiskBadge, ScanCard, DoctorCard, DoctorAvatar, StatCard, SectionHeader, EmptyState, AILoadingOverlay } from '../components';
import { RichBlogContent } from '../components/RichBlogContent';
import { scanApi, catalogApi, analysisApi as catalogAnalysisApi, communityApi, chatApi, bookingApi, patientApi, blogApi } from '../services/api';
import { analyzeImageWithDrift } from '../services/analysisApi';
import { useAuth } from '../context/AuthContext';
import DoctorMapView from '../components/DoctorMapView';

const { width } = Dimensions.get('window');
const TRACKING_FEATURE_DIMENSION = 1792;

function getDoctorCoordinate(doctor) {
  const direct = doctor?.coordinate || doctor?.coordinates || doctor?.locationCoordinates;
  if (direct && Number.isFinite(Number(direct.latitude)) && Number.isFinite(Number(direct.longitude))) {
    return {
      latitude: Number(direct.latitude),
      longitude: Number(direct.longitude),
    };
  }

  const locationText = String(doctor?.location || '');
  const match = locationText.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return null;

  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

  return { latitude, longitude };
}

function riskScoreFromLevel(riskLevel) {
  const normalized = String(riskLevel || '').toLowerCase();
  if (normalized === 'high') return 3;
  if (normalized === 'medium') return 2;
  return 1;
}

function buildHistoryFromScans(scans = []) {
  return scans
    .map((scan) => {
      const date = new Date(scan.date || scan.createdAt || scan.updatedAt || Date.now());
      if (Number.isNaN(date.getTime())) return null;

      const riskBase = riskScoreFromLevel(scan.riskLevel) * 25;
      const confidence = Math.max(0, Math.min(100, Number(scan.confidence || 0)));

      return {
        month: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        score: Math.round(riskBase + confidence / 4),
        timestamp: date.getTime(),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(({ month, score }) => ({ month, score }));
}

function buildMapUrls(doctor, coordinate) {
  const locationText = String(doctor?.location || '').trim();
  const label = encodeURIComponent(String(doctor?.name || 'Doctor cabinet'));

  if (coordinate) {
    const lat = coordinate.latitude;
    const lng = coordinate.longitude;

    return {
      ios: `http://maps.apple.com/?ll=${lat},${lng}&q=${label}`,
      android: `geo:${lat},${lng}?q=${lat},${lng}(${label})`,
      web: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    };
  }

  const query = encodeURIComponent(locationText || String(doctor?.name || 'Doctor cabinet'));
  return {
    ios: `http://maps.apple.com/?q=${query}`,
    android: `geo:0,0?q=${query}`,
    web: `https://www.google.com/maps/search/?api=1&query=${query}`,
  };
}

function haversineDistanceKm(a, b) {
  const lat1 = Number(a?.latitude);
  const lon1 = Number(a?.longitude);
  const lat2 = Number(b?.latitude);
  const lon2 = Number(b?.longitude);

  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return Number.POSITIVE_INFINITY;

  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const root = sinLat * sinLat
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * sinLon * sinLon;
  return 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(root)));
}

function normalizeLocationText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function locationMatchesUserLocation(doctorLocation, userLocationText = '') {
  const normalizedDoctorLocation = normalizeLocationText(doctorLocation);
  const normalizedUserLocation = normalizeLocationText(userLocationText);

  if (!normalizedDoctorLocation || !normalizedUserLocation) return false;

  const placeParts = normalizedUserLocation.split(' ').filter((part) => part.length >= 3);
  return placeParts.some((part) => normalizedDoctorLocation.includes(part));
}

function getNearbyDoctorState(doctor, userCoordinate, userLocationText) {
  const doctorCoordinate = getDoctorCoordinate(doctor);
  const distanceKm = userCoordinate && doctorCoordinate
    ? haversineDistanceKm(userCoordinate, doctorCoordinate)
    : Number.POSITIVE_INFINITY;
  const textLocation = String(doctor?.location || doctor?.profile?.location || '');
  const sameCityFallback = locationMatchesUserLocation(textLocation, userLocationText);

  return {
    distanceKm,
    sameCityFallback,
    isNearby:
      (Number.isFinite(distanceKm) && distanceKm <= 100)
      || (!Number.isFinite(distanceKm) && sameCityFallback),
  };
}

// ─── Shared screen header ────────────────────────────────────────────────────

function ScreenHeader({ title, onBack, rightIcon, onRight, rightLabel, gradient = true }) {
  const content = (
    <View style={sh.bar}>
      <TouchableOpacity onPress={onBack} style={sh.iconBtn} hitSlop={HIT} accessibilityLabel="Go back" accessibilityRole="button" activeOpacity={0.72}>
        <Feather name="arrow-left" size={22} color={Colors.textPrimary} />
      </TouchableOpacity>
      <Text style={sh.title} numberOfLines={1}>{title}</Text>
      {rightIcon ? (
        <TouchableOpacity onPress={onRight} style={sh.iconBtn} hitSlop={HIT} accessibilityLabel={rightLabel || 'Action'} accessibilityRole="button" activeOpacity={0.72}>
          <Feather name={rightIcon} size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
      ) : <View style={sh.iconBtn} />}
    </View>
  );

  if (!gradient) return <SafeAreaView edges={['top']} style={{ backgroundColor: Colors.bgCard }}>{content}</SafeAreaView>;
  return (
    <LinearGradient colors={['#050E1F','#0D2147']}>
      <SafeAreaView edges={['top']}>{content}</SafeAreaView>
    </LinearGradient>
  );
}

const sh = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Space.s8, paddingVertical: Space.s8, minHeight: 56 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { ...Type.d4, color: Colors.textPrimary, flex: 1, textAlign: 'center' },
});

// ═════════════════════════════════════════════════════════════════════════════
// LESION SCAN SCREEN
// ═════════════════════════════════════════════════════════════════════════════

export function LesionScanScreen({ navigation, route }) {
  const [step, setStep]     = useState('capture'); // capture | preview | gradcam-loading | analyzing
  const [location, setLoc]  = useState('Back');
  const [capturedImageUri, setCapturedImageUri] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [cameraMountError, setCameraMountError] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [gradcamHeatmap, setGradcamHeatmap] = useState(null); // base64 heatmap
  const [gradcamResult, setGradcamResult] = useState(null);
  const [qualityChecks, setQualityChecks] = useState({
    focus: 'Pending',
    light: 'Pending',
    detail: 'Pending',
  });
  const cameraRef = useRef(null);
  const gradCamPulse = useRef(new Animated.Value(0.55)).current;
  const scanLineMotion = useRef(new Animated.Value(0)).current;
  const scanLine = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const [analysisSteps, setAnalysisSteps] = useState([
    { label: 'Image preprocessing',  done: false, active: false },
    { label: 'Feature extraction',    done: false, active: false },
    { label: 'Risk classification',   done: false, active: false },
    { label: 'Generating report',     done: false, active: false },
  ]);

  const LOCATIONS = ['Left arm','Right arm','Back','Chest','Neck','Face','Leg','Other'];
  const sourceTrackingGroupId = String(
    route?.params?.trackingGroupId
    || route?.params?.sourceScan?.trackingGroupId
    || route?.params?.sourceScan?.id
    || ''
  ).trim();

  const resolvePreviousTrackingFeatures = async () => {
    const sourceScanFeatures = route?.params?.sourceScan?.analysis?.features;
    if (Array.isArray(sourceScanFeatures) && sourceScanFeatures.length === TRACKING_FEATURE_DIMENSION) {
      return sourceScanFeatures;
    }

    if (!sourceTrackingGroupId) return null;

    // First, try to fetch from the backend
    try {
      const response = await scanApi.getPreviousFeatures(sourceTrackingGroupId);
      if (Array.isArray(response?.features) && response.features.length === TRACKING_FEATURE_DIMENSION) {
        return response.features;
      }
    } catch (error) {
      console.warn('Failed to fetch previous features from backend:', error?.message || error);
    }

    // Fallback: try to find features from local scan list
    const response = await scanApi.list();
    const trackedScans = (response?.scans || [])
      .filter((scan) => String(scan?.trackingGroupId || '').trim() === sourceTrackingGroupId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    for (const trackedScan of trackedScans) {
      const features = trackedScan?.analysis?.features || trackedScan?.features;
      if (Array.isArray(features) && features.length === TRACKING_FEATURE_DIMENSION) {
        return features;
      }
    }

    return null;
  };

  useEffect(() => {
    // Prompt once when entering capture flow to reduce first-capture failures.
    if (step === 'capture' && cameraPermission && !cameraPermission.granted) {
      requestCameraPermission().catch(() => {});
    }
  }, [step, cameraPermission, requestCameraPermission]);

  useEffect(() => {
    if (step !== 'capture') return undefined;

    const pulseLoop = Animated.loop(Animated.sequence([
      Animated.timing(gradCamPulse, { toValue: 0.85, duration: 900, useNativeDriver: true }),
      Animated.timing(gradCamPulse, { toValue: 0.45, duration: 900, useNativeDriver: true }),
    ]));

    const scanLoop = Animated.loop(Animated.sequence([
      Animated.timing(scanLineMotion, { toValue: 1, duration: 1300, useNativeDriver: true }),
      Animated.timing(scanLineMotion, { toValue: 0, duration: 1300, useNativeDriver: true }),
    ]));

    pulseLoop.start();
    scanLoop.start();
    return () => {
      pulseLoop.stop();
      scanLoop.stop();
    };
  }, [gradCamPulse, scanLineMotion, step]);

  const ensureCameraPermission = async () => {
    if (cameraPermission?.granted) return true;
    const permission = await requestCameraPermission();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Camera permission is needed to capture a lesion photo.');
      return false;
    }
    return true;
  };

  const applyQualityChecks = (quality) => {
    if (!quality) {
      setQualityChecks({ focus: 'Unknown', light: 'Unknown', detail: 'Unknown' });
      return;
    }

    setQualityChecks({
      focus: quality.contrast >= 0.06 ? 'Good' : quality.contrast >= 0.04 ? 'Fair' : 'Poor',
      light: quality.brightness >= 0.14 ? 'Good' : quality.brightness >= 0.09 ? 'Fair' : 'Poor',
      detail: quality.detail >= 0.065 ? 'Good' : quality.detail >= 0.045 ? 'Fair' : 'Poor',
    });
  };

  const runGradCamPrecheck = async (imageUri) => {
    setCapturedImageUri(imageUri);
    setStep('gradcam-loading');

    try {
      const result = await catalogAnalysisApi.analyzeWithGradCAM(imageUri);

      if (result?.noLesionDetected || result?.code === 'NO_LESION_DETECTED') {
        Alert.alert('No lesion detected', 'No lesion detected, try again.');
        setGradcamResult(null);
        setGradcamHeatmap(null);
        setStep('capture');
        return;
      }

      setGradcamResult(result);
      setGradcamHeatmap(result?.heatmap || null);
      applyQualityChecks(result?.quality);
      setStep('preview');
    } catch (error) {
      if (error?.status === 422 || error?.code === 'IMAGE_QUALITY_TOO_LOW') {
        Alert.alert('No lesion detected', 'No lesion detected, try again.');
      } else {
        Alert.alert('Grad-CAM analysis failed', error?.message || 'Could not analyze with Grad-CAM.');
      }
      setGradcamResult(null);
      setGradcamHeatmap(null);
      setStep('capture');
    }
  };

  const captureFromCamera = async () => {
    const granted = await ensureCameraPermission();
    if (!granted || !cameraRef.current || !cameraReady) {
      if (granted && !cameraReady) {
        Alert.alert('Camera not ready', 'Please wait a second for the camera to initialize.');
      }
      return;
    }

    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 1, skipProcessing: false });
      if (photo?.uri) {
        await runGradCamPrecheck(photo.uri);
      }
    } catch (error) {
      Alert.alert('Capture failed', error?.message || 'Could not capture image right now.');
    }
  };

  const pickFromLibrary = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission required', 'Photo library permission is needed to select an image.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        quality: 1,
        allowsEditing: true,
        aspect: [4, 3],
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        await runGradCamPrecheck(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Image unavailable', error?.message || 'Could not open photo library.');
    }
  };

  const runAnalysis = async () => {
    if (isAnalyzing) return;
    if (!capturedImageUri) {
      Alert.alert('No image selected', 'Capture or upload a lesion photo before analysis.');
      return;
    }

    if (!gradcamResult) {
      Alert.alert('Retake required', 'Please capture a clearer image before running analysis.');
      return;
    }

    setIsAnalyzing(true);
    setStep('analyzing');
    progress.setValue(0);
    setAnalysisSteps([
      { label: 'Image preprocessing', done: false, active: false },
      { label: 'Feature extraction', done: false, active: false },
      { label: 'Risk classification', done: false, active: false },
      { label: 'Generating report', done: false, active: false },
    ]);

    // Animate scan line
    Animated.loop(Animated.sequence([
      Animated.timing(scanLine, { toValue: 1, duration: 1400, useNativeDriver: true }),
      Animated.timing(scanLine, { toValue: 0, duration: 1400, useNativeDriver: true }),
    ])).start();

    Animated.timing(progress, { toValue: 1, duration: 3000, useNativeDriver: false }).start();

    // Simulate step progression
    const delays = [600, 1400, 2200, 2700];
    delays.forEach((d, i) => {
      setTimeout(() => {
        setAnalysisSteps(prev => prev.map((s, j) => ({
          ...s,
          done:   j < i,
          active: j === i,
        })));
      }, d);
    });

    try {
      let result = gradcamResult;
      let previousTrackingFeatures = null;

      if (sourceTrackingGroupId) {
        try {
          previousTrackingFeatures = await resolvePreviousTrackingFeatures();
        } catch (trackingError) {
          console.warn('Longitudinal tracking lookup failed:', trackingError?.message || trackingError);
        }
      }

      if (previousTrackingFeatures) {
        try {
          const longitudinalResult = await analyzeImageWithDrift(capturedImageUri, previousTrackingFeatures);
          result = {
            ...gradcamResult,
            drift: longitudinalResult?.drift ?? null,
            drift_label: longitudinalResult?.drift_label ?? null,
            longitudinal: {
              applied: true,
              trackingGroupId: sourceTrackingGroupId || null,
              previousFeaturesCount: previousTrackingFeatures.length,
              drift: longitudinalResult?.drift ?? null,
              driftLabel: longitudinalResult?.drift_label ?? null,
              riskScore: longitudinalResult?.risk_score ?? null,
            },
          };
        } catch (trackingError) {
          console.warn('Longitudinal tracking analysis failed:', trackingError?.message || trackingError);
        }
      }

      let createdScan = null;

      try {
        const response = await scanApi.create({
          imageUrl: capturedImageUri,
          trackingGroupId: sourceTrackingGroupId || undefined,
          location,
          lesionType: result?.lesionType || 'Unclassified Lesion',
          riskLevel: String(result?.riskLevel || 'low').toLowerCase(),
          confidence: Number(result?.confidence || 0),
          features: Array.isArray(result?.features) && result.features.length === 1792 ? result.features : [],
          analysis: result,
        });

        const persisted = response?.scan;
        if (persisted?._id) {
          createdScan = {
            id: persisted._id,
            trackingGroupId: persisted.trackingGroupId || persisted._id,
            date: persisted.createdAt,
            imageUrl: persisted.imageUrl,
            location: persisted.location,
            riskLevel: persisted.riskLevel,
            confidence: persisted.confidence,
            lesionType: persisted.lesionType,
            analysis: persisted.analysis,
            features: persisted.features || [],
            notes: persisted.notes || '',
            doctorNotes: persisted.doctorNotes || '',
          };
        }
      } catch (_error) {
        // Keep result navigation responsive even if saving scan fails.
      }

      navigation.navigate('AIResult', {
        result,
        isNew: true,
        scan: createdScan,
        trackingGroupId: createdScan?.trackingGroupId || sourceTrackingGroupId,
        scanPreviewImage: capturedImageUri,
        scanLocation: location,
      });
    } catch (error) {
      setStep('preview');
      Alert.alert('Analysis failed', error?.message || 'Could not analyze this image right now.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.grey50 }}>
      <StatusBar barStyle="light-content" />
      <ScreenHeader title="Skin Scan" onBack={() => navigation.goBack()} rightIcon="help-circle" rightLabel="Scan help" />

      <ScrollView showsVerticalScrollIndicator={false}>

        {step === 'capture' && (
          <View style={sc.wrap}>
            {/* Camera frame */}
            <View style={sc.frameOuter}>
              <View style={sc.frame}>
                {cameraPermission?.granted ? (
                  <CameraView
                    ref={cameraRef}
                    style={sc.cameraPreview}
                    facing="back"
                    ratio={Platform.OS === 'android' ? '4:3' : undefined}
                    enableTorch={torchEnabled}
                    onCameraReady={() => {
                      setCameraReady(true);
                      setCameraMountError('');
                    }}
                    onMountError={(error) => {
                      const message = error?.message || 'Camera failed to initialize.';
                      setCameraMountError(message);
                      setCameraReady(false);
                    }}
                  />
                ) : (
                  <View style={sc.cameraBlocked}>
                    <Feather name="camera-off" size={24} color={Colors.textMuted} />
                    <Text style={sc.cameraBlockedText}>Camera permission needed</Text>
                    <Button label="Enable Camera" onPress={ensureCameraPermission} variant="outline" />
                  </View>
                )}

                {!!cameraMountError && (
                  <View style={sc.cameraErrorBanner}>
                    <Feather name="alert-circle" size={14} color={Colors.riskHigh} />
                    <Text style={sc.cameraErrorText}>Camera unavailable: {cameraMountError}</Text>
                  </View>
                )}

                {cameraPermission?.granted && (
                  <TouchableOpacity
                    style={[sc.torchButton, torchEnabled && sc.torchButtonActive]}
                    onPress={() => setTorchEnabled(prev => !prev)}
                    accessibilityRole="button"
                    accessibilityLabel={torchEnabled ? 'Turn flashlight off' : 'Turn flashlight on'}
                    activeOpacity={0.82}
                  >
                    <Feather name={torchEnabled ? 'zap' : 'zap-off'} size={18} color={torchEnabled ? Colors.primaryOnDark : Colors.textPrimary} />
                    <Text style={[sc.torchButtonText, torchEnabled && sc.torchButtonTextActive]}>{torchEnabled ? 'Torch On' : 'Torch'}</Text>
                  </TouchableOpacity>
                )}

                <Animated.View style={[sc.gradCamOverlay, { opacity: gradCamPulse }]} pointerEvents="none">
                  <LinearGradient colors={['rgba(248,113,113,0.28)', 'rgba(245,158,11,0.18)', 'rgba(0,194,178,0.08)']} style={sc.gradCamHeat} />
                  <Text style={sc.gradCamLabel}>Grad-CAM Assist</Text>
                </Animated.View>

                {['tl','tr','bl','br'].map(c => (
                  <View key={c} style={[sc.corner, c.includes('t') ? {top:0}:{bottom:0}, c.includes('l') ? {left:0}:{right:0}, {transform:[{rotate:c==='tr'?'90deg':c==='br'?'180deg':c==='bl'?'270deg':'0deg'}]}]} />
                ))}
                <View style={sc.targetWrap} pointerEvents="none">
                  <View style={sc.target}>
                    <View style={sc.targetDot} />
                  </View>
                </View>
                <Animated.View
                  pointerEvents="none"
                  style={[
                    sc.scanLineFake,
                    {
                      transform: [{
                        translateY: scanLineMotion.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-72, 72],
                        }),
                      }],
                    },
                  ]}
                />
              </View>
              <Text style={sc.frameHint}>Hold steady · center lesion inside the target ring</Text>
            </View>

            {/* Mode toggle */}
            <View style={sc.modeRow}>
              {[
                { icon: 'camera', label: 'Capture', onPress: captureFromCamera },
                { icon: 'image', label: 'Upload', onPress: pickFromLibrary },
              ].map((m, i) => (
                <TouchableOpacity key={i} style={[sc.modeBtn, i===0 && sc.modeBtnActive]} onPress={m.onPress} accessibilityLabel={m.label} accessibilityRole="button" activeOpacity={0.72}>
                  <Feather name={m.icon} size={18} color={i===0 ? Colors.primary : Colors.textMuted} />
                  <Text style={[sc.modeTxt, i===0 && sc.modeTxtActive]}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Tips */}
            <View style={sc.tipsCard}>
              <Text style={sc.tipsTitle}>Capture Tips</Text>
              {['Place lesion in the center','Use even, natural lighting','Keep camera steady to avoid blur','Keep lens clean for sharper details'].map((t, i) => (
                <View key={i} style={{ flexDirection:'row', gap: Space.s8, marginBottom: Space.s8 }}>
                  <Feather name="check-circle" size={14} color={Colors.primary} style={{ marginTop: 2 }} />
                  <Text style={sc.tipTxt}>{t}</Text>
                </View>
              ))}
            </View>

            {/* Capture button */}
            <TouchableOpacity style={sc.captureBtn} onPress={captureFromCamera} accessibilityLabel="Capture lesion image" accessibilityRole="button" activeOpacity={0.82}>
              <View style={sc.captureBtnInner} />
            </TouchableOpacity>
          </View>
        )}

        {step === 'gradcam-loading' && (
          <View style={sc.wrap}>
            <View style={sc.gradcamLoadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={sc.gradcamLoadingText}>Analyzing image with Grad-CAM...</Text>
              <Text style={sc.gradcamLoadingSubtext}>Generating heatmap to guide lesion detection</Text>
            </View>
          </View>
        )}

        {step === 'preview' && (
          <View style={sc.wrap}>
            <Text style={sc.previewTitle}>Review Image</Text>
            <Text style={sc.previewSub}>Confirm before analysis</Text>

            {/* Image preview with Grad-CAM overlay */}
            <View style={sc.previewImg}>
              {capturedImageUri ? (
                <View style={sc.previewImageContainer}>
                  <Image source={{ uri: capturedImageUri }} style={sc.previewImage} />
                  {gradcamHeatmap && (
                    <Image
                      source={{ uri: `data:image/png;base64,${gradcamHeatmap}` }}
                      style={[sc.heatmapOverlay]}
                    />
                  )}
                </View>
              ) : (
                <>
                  <Ionicons name="scan-outline" size={56} color={Colors.textMuted} />
                  <Text style={sc.previewImgTxt}>No image selected</Text>
                </>
              )}
              <View style={sc.qualityRow}>
                {[
                  { k: 'Focus', v: qualityChecks.focus },
                  { k: 'Light', v: qualityChecks.light },
                  { k: 'Detail', v: qualityChecks.detail },
                ].map((q,i) => (
                  <View key={i} style={sc.qItem}>
                    <Feather
                      name={q.v === 'Poor' ? 'x-circle' : q.v === 'Fair' ? 'alert-circle' : 'check-circle'}
                      size={12}
                      color={q.v === 'Poor' ? Colors.riskHigh : q.v === 'Fair' ? Colors.riskMed : Colors.riskLow}
                    />
                    <Text style={sc.qKey}>{q.k}</Text>
                    <Text style={[sc.qVal, { color: q.v === 'Poor' ? Colors.riskHigh : q.v === 'Fair' ? Colors.riskMed : Colors.riskLow }]}>{q.v}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Location picker */}
            <Text style={sc.locTitle}>Lesion Location</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Space.s8, paddingBottom: Space.s4 }}>
              {LOCATIONS.map(loc => (
                <TouchableOpacity key={loc} style={[sc.locChip, location===loc && sc.locChipActive]} onPress={() => setLoc(loc)} accessibilityRole="radio" accessibilityLabel={loc} accessibilityState={{ checked: location===loc }} activeOpacity={0.72}>
                  <Text style={[sc.locTxt, location===loc && sc.locTxtActive]}>{loc}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={sc.previewActions}>
              <Button label="Retake" onPress={() => setStep('capture')} variant="outline" style={{ flex: 1 }} />
              <Button label={isAnalyzing ? 'Analyzing...' : 'Analyze'} onPress={runAnalysis} icon="cpu" iconPos="right" style={{ flex: 2 }} />
            </View>
          </View>
        )}

        {step === 'analyzing' && (
          <View style={sc.wrap}>
            <AILoadingOverlay
              message="AI Analysis in Progress"
              steps={analysisSteps}
            />
            <Animated.View style={[sc.progressBar, { width: progress.interpolate({ inputRange:[0,1], outputRange:['0%','100%'] }) }]} />
            <Text style={sc.disclaimer}>⚕️ This is a screening tool only. Always consult a qualified dermatologist for diagnosis.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const sc = StyleSheet.create({
  wrap: { padding: Space.s24 },
  frameOuter: { alignItems: 'center', marginBottom: Space.s24 },
  frame: { width: width - 48, height: width - 48, backgroundColor: '#0A1A30', borderRadius: Radius.xl, alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' },
  cameraPreview: { ...StyleSheet.absoluteFillObject },
  cameraBlocked: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: Space.s10, backgroundColor: '#0A1A30' },
  cameraBlockedText: { ...Type.b2, color: Colors.textMuted },
  cameraErrorBanner: {
    position: 'absolute',
    left: Space.s12,
    right: Space.s12,
    bottom: Space.s12,
    zIndex: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.s8,
    paddingHorizontal: Space.s12,
    paddingVertical: Space.s10,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255,245,245,0.94)',
    borderWidth: 1,
    borderColor: Colors.riskHigh + '50',
  },
  cameraErrorText: { ...Type.b3, color: Colors.riskHigh, flex: 1 },
  torchButton: { position: 'absolute', top: Space.s12, right: Space.s12, zIndex: 5, flexDirection: 'row', alignItems: 'center', gap: Space.s6, paddingHorizontal: Space.s12, paddingVertical: Space.s8, borderRadius: Radius.full, backgroundColor: 'rgba(5,14,31,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  torchButtonActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  torchButtonText: { ...Type.l3, color: Colors.textPrimary },
  torchButtonTextActive: { color: Colors.primaryOnDark },
  gradCamOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  gradCamHeat: { width: 190, height: 190, borderRadius: 95 },
  gradCamLabel: { ...Type.l3, color: Colors.textPrimary, marginTop: Space.s8, backgroundColor: 'rgba(5,14,31,0.45)', paddingHorizontal: Space.s8, paddingVertical: 2, borderRadius: Radius.full },
  gradcamLoadingContainer: { alignItems: 'center', justifyContent: 'center', gap: Space.s16, paddingVertical: Space.s48 },
  gradcamLoadingText: { ...Type.d4, color: Colors.textOnLight, textAlign: 'center' },
  gradcamLoadingSubtext: { ...Type.b2, color: Colors.textMuted, textAlign: 'center' },
  corner: { position: 'absolute', width: 28, height: 28, borderTopWidth: 3, borderLeftWidth: 3, borderColor: Colors.primary, borderRadius: 3 },
  targetWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  target: { width: 110, height: 110, borderRadius: 55, borderWidth: 2, borderStyle: 'dashed', borderColor: Colors.primary, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.03)' },
  targetDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  scanLineFake: { position: 'absolute', left: 24, right: 24, height: 2, backgroundColor: Colors.primary, opacity: 0.55, top: '50%' },
  frameHint: { ...Type.b3, color: Colors.textMuted, marginTop: Space.s12 },
  modeRow: { flexDirection: 'row', gap: Space.s12, marginBottom: Space.s24 },
  modeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Space.s8, padding: Space.s12, borderRadius: Radius.md, backgroundColor: Colors.bgCard, borderWidth: 1.5, borderColor: Colors.grey100, minHeight: 44 },
  modeBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryDim },
  modeTxt: { ...Type.l2, color: Colors.textMuted },
  modeTxtActive: { color: Colors.primary },
  tipsCard: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Space.s16, marginBottom: Space.s32, ...Shadow.sm },
  tipsTitle: { ...Type.l1, color: Colors.textOnLight, marginBottom: Space.s12 },
  tipTxt: { ...Type.b2, color: Colors.textMuted, flex: 1 },
  captureBtn: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', ...Shadow.primary },
  captureBtnInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: 'rgba(255,255,255,0.25)' },
  previewTitle: { ...Type.d3, color: Colors.textOnLight, marginBottom: 4 },
  previewSub: { ...Type.b2, color: Colors.textMuted, marginBottom: Space.s24 },
  previewImg: { backgroundColor: Colors.bgCard, borderRadius: Radius.xl, minHeight: 380, alignItems: 'center', justifyContent: 'center', gap: Space.s8, marginBottom: Space.s24, overflow: 'hidden', ...Shadow.sm },
  previewImageContainer: { position: 'relative', width: '100%', height: 380 },
  previewImage: { width: '100%', height: 380 },
  heatmapOverlay: { position: 'absolute', top: 0, left: 0, width: '100%', height: 380, opacity: 0.75 },
  previewImgTxt: { ...Type.b2, color: Colors.textMuted },
  qualityRow: { flexDirection: 'row', gap: Space.s16, marginTop: Space.s8, paddingBottom: Space.s12 },
  qItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  qKey: { ...Type.l3, color: Colors.textMuted },
  qVal: { ...Type.l2 },
  locTitle: { ...Type.l1, color: Colors.textOnLight, marginBottom: Space.s12 },
  locChip: { paddingHorizontal: Space.s16, paddingVertical: Space.s8, borderRadius: Radius.full, backgroundColor: Colors.bgCard, borderWidth: 1.5, borderColor: Colors.grey100, minHeight: 36 },
  locChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  locTxt: { ...Type.l2, color: Colors.textMuted },
  locTxtActive: { color: Colors.primaryOnDark },
  previewActions: { flexDirection: 'row', gap: Space.s12, marginTop: Space.s24 },
  progressBar: { height: 3, backgroundColor: Colors.primary, borderRadius: 2, marginTop: Space.s24 },
  disclaimer: { ...Type.b3, color: Colors.textMuted, textAlign: 'center', marginTop: Space.s24, lineHeight: 20 },
});

// ═════════════════════════════════════════════════════════════════════════════
// AI RESULT SCREEN
// ═════════════════════════════════════════════════════════════════════════════

export function AIResultScreen({ navigation, route }) {
  const MOCK = { riskLevel:'medium', confidence:83, lesionType:'Dysplastic Nevus', characteristics:['Asymmetric border','Color variation','Diameter ~6mm','Flat surface'], recommendation:'consult', abcde:{ A:{label:'Asymmetry',value:'Moderate',flag:true}, B:{label:'Border',value:'Irregular edges',flag:true}, C:{label:'Color',value:'2-3 shades',flag:true}, D:{label:'Diameter',value:'~6mm',flag:false}, E:{label:'Evolution',value:'Track needed',flag:false} } };
  const [fetchedScan, setFetchedScan] = useState(null);
  const [isLoadingScan, setIsLoadingScan] = useState(false);
  const passedScan = route.params?.scan;
  const scan = fetchedScan || passedScan;

  // Fetch full scan if only ID was provided
  useEffect(() => {
    const fetchFullScan = async () => {
      if (!passedScan) return;
      // If we already have scan data (not just an ID), don't refetch
      if (passedScan.riskLevel) return;
      
      setIsLoadingScan(true);
      try {
        const result = await scanApi.getScanById(passedScan.id);
        if (result?.scan) {
          setFetchedScan(result.scan);
        }
      } catch (_error) {
        // Fall through if fetch fails
      } finally {
        setIsLoadingScan(false);
      }
    };
    fetchFullScan();
  }, [passedScan?.id, passedScan?.riskLevel]);

  const scanAnalysis = scan?.analysis || null;

  const fallbackRecommendation = (riskLevel) => {
    if (riskLevel === 'high') return 'urgent';
    if (riskLevel === 'medium') return 'consult';
    return 'monitor';
  };

  const scanResult = scan
    ? {
        riskLevel: scan?.riskLevel || scanAnalysis?.riskLevel || 'low',
        confidence: Number(scan?.confidence ?? scanAnalysis?.confidence ?? 0),
        lesionType: scan?.lesionType || scanAnalysis?.lesionType || 'Unclassified Lesion',
        characteristics: Array.isArray(scanAnalysis?.characteristics) && scanAnalysis.characteristics.length
          ? scanAnalysis.characteristics
          : ['No detailed characteristics were saved for this scan.'],
        recommendation: scanAnalysis?.recommendation || fallbackRecommendation(scan?.riskLevel || scanAnalysis?.riskLevel),
        abcde: scanAnalysis?.abcde || {
          A: { label: 'Asymmetry', value: 'Not available', flag: false },
          B: { label: 'Border', value: 'Not available', flag: false },
          C: { label: 'Color', value: 'Not available', flag: false },
          D: { label: 'Diameter', value: 'Not available', flag: false },
          E: { label: 'Evolution', value: 'Not available', flag: false },
        },
      }
    : null;

  const result = route.params?.result || scanResult || MOCK;
  const trackingGroupId = String(route.params?.trackingGroupId || scan?.trackingGroupId || scan?.id || '').trim();
  const resultImageUri = scan?.imageUrl || route.params?.scanPreviewImage || null;
  const [isSharingToCommunity, setIsSharingToCommunity] = useState(false);
  const cfg = riskConfig(result.riskLevel);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const barAnim = useRef(new Animated.Value(0)).current;
  const [shareOptionsVisible, setShareOptionsVisible] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [shareDoctors, setShareDoctors] = useState([]);
  const [isLoadingDoctors, setIsLoadingDoctors] = useState(false);
  const [sharingDoctorId, setSharingDoctorId] = useState('');
  const [analysisSearch, setAnalysisSearch] = useState('');
  const [patientNotes, setPatientNotes] = useState(String(scan?.notes || ''));
  const [notesDraft, setNotesDraft] = useState(String(scan?.notes || ''));
  const [notesModalVisible, setNotesModalVisible] = useState(false);
  const [isSavingPatientNotes, setIsSavingPatientNotes] = useState(false);

  useEffect(() => {
    const currentNotes = String(scan?.notes || '');
    setPatientNotes(currentNotes);
    setNotesDraft(currentNotes);
  }, [scan?.id, scan?.notes]);

  const filteredCharacteristics = (result.characteristics || []).filter((item) =>
    String(item || '').toLowerCase().includes(analysisSearch.toLowerCase())
  );

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 55, friction: 10, useNativeDriver: true }),
    ]).start(() => {
      Animated.timing(barAnim, { toValue: result.confidence / 100, duration: 1200, useNativeDriver: false }).start();
    });
  }, []);

  const recMap = {
    urgent:  { icon: 'alert-octagon', title: 'Urgent: See a Dermatologist',  desc: 'This lesion shows high-risk features requiring immediate professional evaluation.', color: Colors.riskHigh,  bg: Colors.riskHighBg },
    consult: { icon: 'user-check',     title: 'Consult a Dermatologist',       desc: 'Schedule an appointment within 2–4 weeks for professional evaluation.',               color: Colors.riskMed,   bg: Colors.riskMedBg  },
    monitor: { icon: 'calendar',        title: 'Monitor & Rescan',              desc: 'Low-risk characteristics. Continue monitoring and rescan in 3 months.',               color: Colors.riskLow,   bg: Colors.riskLowBg  },
  };
  const rec = recMap[result.recommendation] || recMap.monitor;

  const buildDiagnosisMessage = () => {
    const characteristics = (result.characteristics || []).map((item, idx) => `${idx + 1}. ${item}`).join('\n') || 'N/A';
    const abcde = Object.entries(result.abcde || {}).map(([key, value]) => {
      const val = value?.value || 'Not available';
      const flag = value?.flag ? ' [flag]' : '';
      return `${key}: ${val}${flag}`;
    }).join('\n') || 'N/A';

    return [
      'Shared Lesion Diagnosis Analysis',
      `Risk Level: ${String(result.riskLevel || 'unknown').toUpperCase()}`,
      `Confidence: ${result.confidence ?? 0}%`,
      `Detected Lesion: ${result.lesionType || 'Unclassified Lesion'}`,
      `Recommendation: ${result.recommendation || 'monitor'}`,
      '',
      'Observed Characteristics:',
      characteristics,
      '',
      'ABCDE Analysis:',
      abcde,
    ].join('\n');
  };

  const openShareToDoctor = async () => {
    setShareModalVisible(true);
    setIsLoadingDoctors(true);

    try {
      const response = await catalogApi.listDoctors();
      setShareDoctors(response?.doctors || []);
    } catch (error) {
      setShareDoctors([]);
      Alert.alert('Doctors unavailable', error?.message || 'Could not load doctors right now.');
    } finally {
      setIsLoadingDoctors(false);
    }
  };

  const shareDiagnosisToDoctor = async (doctor) => {
    if (!doctor?.id) return;

    setSharingDoctorId(String(doctor.id));
    try {
      const upsert = await chatApi.upsertThread({
        doctorId: doctor.id,
        doctorName: doctor.name,
        specialty: doctor.specialty,
      });

      const threadId = upsert?.thread?.id;
      if (!threadId) {
        throw new Error('Could not create a doctor chat thread.');
      }

      await chatApi.sendMessage(threadId, buildDiagnosisMessage());
      setShareModalVisible(false);
      Alert.alert('Diagnosis shared', 'Detailed diagnosis has been sent to the selected doctor.', [
        { text: 'Open Chat', onPress: () => navigation.navigate('Chat', { doctor }) },
        { text: 'OK', style: 'cancel' },
      ]);
    } catch (error) {
      Alert.alert('Share failed', error?.message || 'Could not share diagnosis with this doctor.');
    } finally {
      setSharingDoctorId('');
    }
  };

  const shareResultToCommunity = async () => {
    if (isSharingToCommunity) return;

    if (!resultImageUri) {
      Alert.alert('Share unavailable', 'No scan image is available for this result.');
      return;
    }

    const diagnosis = result?.lesionType || 'Unclassified Lesion';
    const note = [
      `Risk: ${String(result?.riskLevel || 'unknown').toUpperCase()}`,
      `Confidence: ${result?.confidence ?? 0}%`,
      `Recommendation: ${result?.recommendation || 'monitor'}`,
      '',
      'Shared from scan result.',
    ].join('\n');

    setIsSharingToCommunity(true);
    try {
      await communityApi.createPost({
        imageUrl: resultImageUri,
        diagnosis,
        note,
        location: scan?.location || route.params?.scanLocation || '',
      });
      Alert.alert('Shared', 'Scan result was shared to the community.');
    } catch (error) {
      Alert.alert('Share failed', error?.message || 'Could not share this result to community.');
    } finally {
      setIsSharingToCommunity(false);
    }
  };

  const savePatientNotes = async () => {
    if (!scan?.id || isSavingPatientNotes) return;

    try {
      setIsSavingPatientNotes(true);
      const response = await scanApi.updatePatientNotes(scan.id, notesDraft);
      const savedNotes = String(response?.patientNotes ?? notesDraft);
      setPatientNotes(savedNotes);
      setNotesDraft(savedNotes);
      setNotesModalVisible(false);
      Alert.alert('Notes saved', 'Your notes were updated for this scan.');
    } catch (error) {
      Alert.alert('Save failed', error?.message || 'Could not save your notes right now.');
    } finally {
      setIsSavingPatientNotes(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.grey50 }}>
      <StatusBar barStyle="light-content" />
      <ScreenHeader
        title="AI Analysis Result"
        onBack={() => navigation.reset({ index: 0, routes: [{ name: 'PatientDashboard' }] })}
        rightIcon="share-2"
        rightLabel="Share diagnosis"
        onRight={() => setShareOptionsVisible(true)}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: Space.s20, paddingBottom: Space.s48 }}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>

          {resultImageUri && (
            <View style={[ar.imageHeaderCard, Shadow.sm]}>
              <Image source={{ uri: resultImageUri }} style={ar.imageHeader} />
            </View>
          )}

          {/* Risk card */}
          <View style={[ar.riskCard, { borderTopColor: cfg.color }, Shadow.md]}>
            <View style={ar.riskTop}>
              <View style={[ar.riskBubble, { backgroundColor: cfg.bg, borderColor: cfg.color + '50' }]}>
                <Feather name={cfg.icon} size={28} color={cfg.color} />
                <Text style={[ar.riskLevelText, { color: cfg.color }]}>{result.riskLevel?.toUpperCase()}</Text>
                <Text style={ar.riskWord}>RISK</Text>
              </View>
              <View style={{ flex: 1, marginLeft: Space.s20 }}>
                <Text style={ar.typeLabel}>Detected lesion</Text>
                <Text style={ar.typeName}>{result.lesionType}</Text>
                <Text style={ar.confLabel}>AI Confidence</Text>
                <View style={ar.confTrack}>
                  <Animated.View style={[ar.confFill, { backgroundColor: cfg.color, width: barAnim.interpolate({ inputRange:[0,1], outputRange:['0%','100%'] }) }]} />
                </View>
                <Text style={[ar.confScore, { color: cfg.color }]}>{result.confidence}%</Text>
              </View>
            </View>
            {/* Risk gradient scale */}
            <View style={{ marginTop: Space.s16 }}>
              <LinearGradient colors={[Colors.riskLow, Colors.riskMed, Colors.riskHigh]} style={ar.scaleBar} start={{x:0,y:0}} end={{x:1,y:0}}>
                <View style={[ar.scaleMarker, { left: result.riskLevel==='low'?'18%':result.riskLevel==='medium'?'52%':'82%', borderColor: Colors.bgCard }]} />
              </LinearGradient>
              <View style={ar.scaleLabels}>
                {['Low','Moderate','High'].map(l => <Text key={l} style={ar.scaleLabel}>{l}</Text>)}
              </View>
            </View>
          </View>

          <View style={ar.searchWrap}>
            <Feather name="search" size={16} color={Colors.textMuted} style={ar.searchIcon} />
            <TextInput
              value={analysisSearch}
              onChangeText={setAnalysisSearch}
              placeholder="Search analysis details"
              placeholderTextColor={Colors.textMuted}
              style={ar.searchInput}
              accessibilityLabel="Search analysis details"
            />
            {analysisSearch.length > 0 ? (
              <TouchableOpacity onPress={() => setAnalysisSearch('')} hitSlop={HIT} accessibilityLabel="Clear analysis search">
                <Feather name="x" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Characteristics */}
          <View style={ar.section}>
            <Text style={ar.sectionTitle}>Observed Characteristics</Text>
            {filteredCharacteristics.map((c, i) => (
              <View key={i} style={{ flexDirection:'row', alignItems:'center', gap: Space.s12, marginBottom: Space.s10 }}>
                <View style={{ width:6, height:6, borderRadius:3, backgroundColor: Colors.primary }} />
                <Text style={ar.charText}>{c}</Text>
              </View>
            ))}
            {filteredCharacteristics.length === 0 ? (
              <Text style={ar.emptySearchText}>No analysis items match your search.</Text>
            ) : null}
          </View>

          <View style={ar.section}>
            <View style={ar.notesHeader}>
              <Text style={ar.sectionTitle}>Your Notes</Text>
              <View style={ar.notesHeaderRight}>
                {!scan?.id ? <Text style={ar.notesMeta}>Save a scan to keep notes</Text> : null}
                <TouchableOpacity
                  style={[ar.notesEditBtn, !scan?.id && ar.notesEditBtnDisabled]}
                  onPress={() => {
                    setNotesDraft(patientNotes);
                    setNotesModalVisible(true);
                  }}
                  disabled={!scan?.id}
                  accessibilityRole="button"
                  accessibilityLabel="Edit your notes"
                  activeOpacity={0.78}
                >
                  <Feather name="edit-2" size={14} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={[ar.notesPreviewCard, !scan?.id && ar.notesInputDisabled]}>
              <Text style={ar.notesPreviewText}>
                {String(patientNotes || '').trim() || 'No notes yet. Tap the edit icon to add your observations, symptoms, or questions.'}
              </Text>
            </View>
          </View>

          <View style={ar.section}>
            <Text style={ar.sectionTitle}>Doctor Notes</Text>
            <View style={ar.doctorNotesCard}>
              <Text style={ar.doctorNotesText}>
                {String(scan?.doctorNotes || '').trim() || 'No doctor notes yet.'}
              </Text>
            </View>
          </View>

          {/* Recommendation */}
          <View style={[ar.recCard, { backgroundColor: rec.bg, borderColor: rec.color + '40' }]}>
            <View style={[ar.recIconWrap, { backgroundColor: rec.color + '25' }]}>
              <Feather name={rec.icon} size={24} color={rec.color} />
            </View>
            <View style={{ flex:1 }}>
              <Text style={[ar.recTitle, { color: rec.color }]}>{rec.title}</Text>
              <Text style={ar.recDesc}>{rec.desc}</Text>
            </View>
          </View>

          {/* Actions */}
          <View style={{ gap: Space.s12, marginTop: Space.s8 }}>
            <Button label="Find Dermatologist" onPress={() => navigation.navigate('DermatologistFinder')} icon="map-pin" />
            <Button
              label="Track Lesion"
              onPress={() => navigation.navigate('LesionTracking', {
                trackingGroupId,
                scan,
              })}
              variant="outline"
              icon="bar-chart-2"
              iconPos="left"
            />
          </View>

          {/* Disclaimer */}
          <View style={ar.disclaimer}>
            <Feather name="info" size={14} color={Colors.textMuted} />
            <Text style={ar.disclaimerText}>This AI analysis is a screening tool and does not replace professional medical diagnosis.</Text>
          </View>
        </Animated.View>
      </ScrollView>

      <Modal
        visible={notesModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setNotesModalVisible(false);
          setNotesDraft(patientNotes);
        }}
      >
        <Pressable
          style={ar.modalBackdrop}
          onPress={() => {
            setNotesModalVisible(false);
            setNotesDraft(patientNotes);
          }}
        >
          <Pressable style={[ar.modalCard, Shadow.lg]} onPress={() => {}}>
            <Text style={ar.modalTitle}>Edit Your Notes</Text>
            <Text style={ar.modalSub}>Update your observations for this scan.</Text>

            <TextInput
              value={notesDraft}
              onChangeText={setNotesDraft}
              multiline
              textAlignVertical="top"
              placeholder="Add your observations, symptoms, or questions for the doctor"
              placeholderTextColor={Colors.textMuted}
              style={ar.notesInput}
              accessibilityLabel="Edit your notes"
            />

            <View style={ar.notesModalActions}>
              <Button
                label="Cancel"
                variant="ghost"
                size="sm"
                onPress={() => {
                  setNotesModalVisible(false);
                  setNotesDraft(patientNotes);
                }}
              />
              <Button
                label={isSavingPatientNotes ? 'Saving...' : 'Save Notes'}
                onPress={savePatientNotes}
                loading={isSavingPatientNotes}
                disabled={!scan?.id || isSavingPatientNotes}
                size="sm"
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={shareOptionsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setShareOptionsVisible(false)}
      >
        <Pressable style={ar.modalBackdrop} onPress={() => setShareOptionsVisible(false)}>
          <Pressable style={[ar.modalCard, Shadow.lg]} onPress={() => {}}>
            <Text style={ar.modalTitle}>Share Diagnosis</Text>
            <Text style={ar.modalSub}>Choose how you want to share this analysis.</Text>

            <View style={{ gap: Space.s12 }}>
              <Button
                label="Share With Doctor"
                onPress={() => {
                  setShareOptionsVisible(false);
                  openShareToDoctor();
                }}
                icon="send"
                iconPos="left"
              />
              <Button
                label={isSharingToCommunity ? 'Sharing...' : 'Share To Community'}
                onPress={() => {
                  setShareOptionsVisible(false);
                  shareResultToCommunity();
                }}
                icon="users"
                iconPos="left"
                loading={isSharingToCommunity}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={shareModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setShareModalVisible(false)}
      >
        <Pressable style={ar.modalBackdrop} onPress={() => setShareModalVisible(false)}>
          <Pressable style={[ar.modalCard, Shadow.lg]} onPress={() => {}}>
            <Text style={ar.modalTitle}>Share Diagnosis With Doctor</Text>
            <Text style={ar.modalSub}>Select a doctor to send the full analysis via chat.</Text>

            {isLoadingDoctors ? (
              <View style={ar.modalLoading}>
                <ActivityIndicator color={Colors.primary} />
                <Text style={ar.modalLoadingText}>Loading doctors...</Text>
              </View>
            ) : shareDoctors.length === 0 ? (
              <Text style={ar.modalEmpty}>No doctors available right now.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                {shareDoctors.map((doctor) => {
                  const isSending = sharingDoctorId === String(doctor.id);
                  return (
                    <TouchableOpacity
                      key={doctor.id}
                      style={ar.modalDoctorRow}
                      onPress={() => shareDiagnosisToDoctor(doctor)}
                      activeOpacity={0.78}
                      disabled={isSending}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={ar.modalDoctorName}>{doctor.name}</Text>
                        <Text style={ar.modalDoctorMeta}>{doctor.specialty}</Text>
                      </View>
                      {isSending ? <ActivityIndicator color={Colors.primary} /> : <Feather name="send" size={16} color={Colors.primary} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const ar = StyleSheet.create({
  imageHeaderCard: { backgroundColor: Colors.bgCard, borderRadius: Radius.xl, overflow: 'hidden', marginBottom: Space.s16 },
  imageHeader: { width: '100%', height: 200 },
  riskCard: { backgroundColor: Colors.bgCard, borderRadius: Radius.xl, padding: Space.s20, borderTopWidth: 4, marginBottom: Space.s16 },
  riskTop: { flexDirection:'row', alignItems:'center' },
  riskBubble: { width:100, height:100, borderRadius:50, borderWidth:2, alignItems:'center', justifyContent:'center', gap:2 },
  riskLevelText: { ...Type.l2, letterSpacing:1, marginTop:2 },
  riskWord: { ...Type.l3, color: Colors.textMuted },
  typeLabel: { ...Type.l3, color: Colors.textMuted, marginBottom:4 },
  typeName: { ...Type.d4, color: Colors.textOnLight, marginBottom: Space.s12 },
  confLabel: { ...Type.l3, color: Colors.textMuted, marginBottom:6 },
  confTrack: { height:5, backgroundColor: Colors.grey100, borderRadius:3, overflow:'hidden', marginBottom:4 },
  confFill: { height:5, borderRadius:3 },
  confScore: { ...Type.l1 },
  scaleBar: { height:8, borderRadius:4, position:'relative', overflow:'visible' },
  scaleMarker: { position:'absolute', top:-4, width:16, height:16, borderRadius:8, backgroundColor: Colors.bgCard, borderWidth:2, marginLeft:-8 },
  scaleLabels: { flexDirection:'row', justifyContent:'space-between', marginTop:4 },
  scaleLabel: { ...Type.l3, color: Colors.textMuted },
  section: { backgroundColor: Colors.bgCard, borderRadius: Radius.xl, padding: Space.s20, marginBottom: Space.s16, ...Shadow.sm },
  sectionTitle: { ...Type.d4, color: Colors.textOnLight },
  abcdeRow: { flexDirection:'row', alignItems:'center', gap: Space.s12, backgroundColor: Colors.grey50, borderRadius: Radius.md, padding: Space.s12, marginBottom: Space.s8, borderWidth:1, borderColor:'transparent' },
  abcdeLetter: { width:36, height:36, borderRadius: Radius.sm, alignItems:'center', justifyContent:'center' },
  abcdeLetterTxt: { ...Type.d4 },
  abcdeLabel: { ...Type.l3, color: Colors.textMuted, marginBottom:2 },
  abcdeValue: { ...Type.l2, color: Colors.textOnLight },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Space.s16,
    gap: Space.s8,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.grey100,
    paddingHorizontal: Space.s14,
    minHeight: 46,
    ...Shadow.sm,
  },
  searchIcon: { marginLeft: Space.s12 },
  searchInput: { flex: 1, ...Type.b2, color: Colors.textOnLight, paddingLeft: Space.s4 },
  notesHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Space.s10 },
  notesHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: Space.s8 },
  notesMeta: { ...Type.l3, color: Colors.textMuted },
  notesEditBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  notesEditBtnDisabled: { opacity: 0.45 },
  notesPreviewCard: {
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.grey100,
    backgroundColor: Colors.grey50,
    paddingHorizontal: Space.s16,
    paddingVertical: Space.s12,
  },
  notesPreviewText: { ...Type.b2, color: Colors.textMuted, lineHeight: 21 },
  notesInput: {
    minHeight: 96,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.grey100,
    backgroundColor: Colors.grey50,
    color: Colors.textOnLight,
    paddingHorizontal: Space.s16,
    paddingVertical: Space.s12,
    marginBottom: Space.s12,
    ...Type.b2,
  },
  notesInputDisabled: { opacity: 0.65 },
  notesModalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Space.s8, marginTop: Space.s4 },
  doctorNotesCard: {
    marginTop: Space.s10,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.grey100,
    backgroundColor: Colors.grey50,
    paddingHorizontal: Space.s16,
    paddingVertical: Space.s12,
  },
  doctorNotesText: { ...Type.b2, color: Colors.textMuted, lineHeight: 21 },
  emptySearchText: { ...Type.b3, color: Colors.textMuted, marginTop: Space.s4 },
  charText: { ...Type.b2, color: Colors.grey700 },
  recCard: { flexDirection:'row', gap: Space.s16, padding: Space.s20, borderRadius: Radius.xl, borderWidth:1, marginBottom: Space.s16, alignItems:'flex-start' },
  recIconWrap: { width:48, height:48, borderRadius:24, alignItems:'center', justifyContent:'center' },
  recTitle: { ...Type.d4, marginBottom: Space.s8 },
  recDesc: { ...Type.b2, color: Colors.grey700, lineHeight:22 },
  disclaimer: { flexDirection:'row', gap: Space.s8, padding: Space.s16, backgroundColor: Colors.grey50, borderRadius: Radius.md, marginTop: Space.s8, alignItems:'flex-start' },
  disclaimerText: { ...Type.b3, color: Colors.textMuted, flex:1, lineHeight:18 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5,14,31,0.45)',
    justifyContent: 'center',
    paddingHorizontal: Space.s20,
  },
  modalCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    padding: Space.s16,
  },
  modalTitle: { ...Type.d4, color: Colors.textOnLight, marginBottom: Space.s4 },
  modalSub: { ...Type.b3, color: Colors.textMuted, marginBottom: Space.s12 },
  modalLoading: { alignItems: 'center', paddingVertical: Space.s16, gap: Space.s8 },
  modalLoadingText: { ...Type.b3, color: Colors.textMuted },
  modalEmpty: { ...Type.b2, color: Colors.textMuted, textAlign: 'center', paddingVertical: Space.s16 },
  modalDoctorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.s8,
    paddingVertical: Space.s10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.grey100,
  },
  modalDoctorName: { ...Type.l1, color: Colors.textOnLight },
  modalDoctorMeta: { ...Type.b3, color: Colors.textMuted },
});

// ─── SimpleLineChart — pure RN, no native deps, works on web ─────────────────

function SimpleLineChart({ data = [], labels = [], color = Colors.primary, width = 280, height = 130 }) {
  const safeData = data.map((value) => (Number.isFinite(Number(value)) ? Number(value) : 0));
  const max = Math.max(...safeData, 1);
  const padH = 24;
  const padV = 16;
  const chartW = width - padH * 2;
  const chartH = height - padV * 2;
  const denominator = Math.max(safeData.length - 1, 1);

  const points = safeData.map((v, i) => ({
    x: safeData.length === 1 ? padH + chartW / 2 : padH + (i / denominator) * chartW,
    y: padV + chartH - (v / max) * chartH,
    value: v,
    label: labels[i] || '',
  }));

  // Build SVG-like path using View elements as dots + connecting lines
  return (
    <View style={{ width, height, position: 'relative' }}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
        <View key={i} style={{
          position: 'absolute',
          left: padH, right: padH,
          top: padV + t * chartH,
          height: 1,
          backgroundColor: Colors.grey100,
        }} />
      ))}

      {/* Connecting lines between points */}
      {points.slice(0, -1).map((p, i) => {
        const next = points[i + 1];
        const dx = next.x - p.x;
        const dy = next.y - p.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        return (
          <View key={i} style={{
            position: 'absolute',
            left: p.x,
            top: p.y,
            width: len,
            height: 2.5,
            backgroundColor: color,
            opacity: 0.85,
            transformOrigin: 'left center',
            transform: [{ rotate: `${angle}deg` }],
          }} />
        );
      })}

      {/* Dots */}
      {points.map((p, i) => (
        <View key={i} style={{
          position: 'absolute',
          left: p.x - 5, top: p.y - 5,
          width: 10, height: 10, borderRadius: 5,
          backgroundColor: Colors.bgCard,
          borderWidth: 2, borderColor: color,
        }} />
      ))}

      {/* Labels */}
      {points.map((p, i) => (
        <Text key={i} style={{
          position: 'absolute',
          left: p.x - 12, top: height - 16,
          width: 24, textAlign: 'center',
          ...Type.l3, color: Colors.textMuted, fontSize: 9,
        }}>
          {p.label}
        </Text>
      ))}
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// LESION TRACKING SCREEN
// ═════════════════════════════════════════════════════════════════════════════

export function LesionTrackingScreen({ navigation, route }) {
  const [scans, setScans] = useState([]);
  const [selected, setSelected] = useState(null);
  const [activeTrackingGroupId, setActiveTrackingGroupId] = useState('');

  const requestedTrackingGroupId = String(route?.params?.trackingGroupId || route?.params?.scan?.trackingGroupId || '').trim();

  const groupedScans = useMemo(() => {
    const groups = new Map();

    scans.forEach((scan) => {
      const groupId = String(scan.trackingGroupId || scan.id || '').trim();
      if (!groupId) return;
      const entry = groups.get(groupId) || [];
      entry.push(scan);
      groups.set(groupId, entry);
    });

    return Array.from(groups.entries())
      .map(([id, group]) => {
        const timeline = [...group].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const latest = timeline[timeline.length - 1] || null;
        return {
          id,
          scans: timeline,
          latestDate: latest ? new Date(latest.date).getTime() : 0,
          label: `${latest?.lesionType || 'Lesion'}${latest?.location ? ` - ${latest.location}` : ''}`,
        };
      })
      .sort((a, b) => b.latestDate - a.latestDate);
  }, [scans]);

  useEffect(() => {
    if (!groupedScans.length) {
      setActiveTrackingGroupId('');
      return;
    }

    const requestedExists = groupedScans.some((group) => group.id === requestedTrackingGroupId);
    if (requestedTrackingGroupId && requestedExists && activeTrackingGroupId !== requestedTrackingGroupId) {
      setActiveTrackingGroupId(requestedTrackingGroupId);
      return;
    }

    const activeExists = groupedScans.some((group) => group.id === activeTrackingGroupId);
    if (!activeExists) {
      setActiveTrackingGroupId(groupedScans[0].id);
    }
  }, [activeTrackingGroupId, groupedScans, requestedTrackingGroupId]);

  const activeGroup = useMemo(
    () => groupedScans.find((group) => group.id === activeTrackingGroupId) || groupedScans[0] || null,
    [activeTrackingGroupId, groupedScans]
  );

  const sortedScans = useMemo(() => activeGroup?.scans || [], [activeGroup]);
  const timelineScans = useMemo(() => [...sortedScans].reverse(), [sortedScans]);

  const firstScan = sortedScans[0] || null;
  const latestScan = sortedScans[sortedScans.length - 1] || null;
  const chartHistory = useMemo(() => buildHistoryFromScans(sortedScans), [sortedScans]);

  const chartSubtitle = useMemo(() => {
    const count = chartHistory.length;
    if (count <= 0) return 'No history yet';
    return `${count} scan${count > 1 ? 's' : ''} tracked`;
  }, [chartHistory]);

  const trend = useMemo(() => {
    if (chartHistory.length < 2) {
      return {
        icon: 'minus',
        label: 'No trend',
        color: Colors.textMuted,
        bg: Colors.grey100,
      };
    }

    const first = Number(chartHistory[0]?.score || 0);
    const last = Number(chartHistory[chartHistory.length - 1]?.score || 0);
    const delta = Math.round(last - first);

    if (delta > 0) {
      return {
        icon: 'trending-up',
        label: `+${delta} pts`,
        color: Colors.riskHigh,
        bg: Colors.riskHighBg,
      };
    }

    if (delta < 0) {
      return {
        icon: 'trending-down',
        label: `${delta} pts`,
        color: Colors.riskLow,
        bg: Colors.riskLowBg,
      };
    }

    return {
      icon: 'minus',
      label: '0 pts',
      color: Colors.textMuted,
      bg: Colors.grey100,
    };
  }, [chartHistory]);

  const comparisonScans = useMemo(() => {
    if (!latestScan) return [];
    if (!firstScan || firstScan.id === latestScan.id) {
      return [
        { key: 'latest', label: 'Latest', scan: latestScan },
        { key: 'latest-now', label: 'Now', scan: latestScan },
      ];
    }
    return [
      { key: 'first', label: 'First', scan: firstScan },
      { key: 'latest', label: 'Latest', scan: latestScan },
    ];
  }, [firstScan, latestScan]);

  useEffect(() => {
    let mounted = true;
    async function loadTracking() {
      try {
        const scanRes = await scanApi.list();

        if (!mounted) return;

        const mapped = (scanRes.scans || []).map((scan) => ({
          id: scan._id,
          trackingGroupId: scan.trackingGroupId || scan._id,
          date: scan.createdAt,
          imageUrl: scan.imageUrl,
          location: scan.location,
          riskLevel: scan.riskLevel,
          confidence: scan.confidence,
          lesionType: scan.lesionType,
          analysis: scan.analysis,
          notes: scan.notes || '',
          doctorNotes: scan.doctorNotes || '',
        }));

        setScans(mapped);
      } catch (_error) {
        if (!mounted) return;
        setScans([]);
        setSelected(null);
      }
    }

    loadTracking();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!timelineScans.length) {
      setSelected(null);
      return;
    }

    if (!selected || !timelineScans.some((scan) => scan.id === selected.id)) {
      setSelected(timelineScans[0]);
    }
  }, [timelineScans, selected]);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.grey50 }}>
      <StatusBar barStyle="light-content" />
      <ScreenHeader
        title="Lesion Tracking"
        onBack={() => navigation.goBack()}
        rightIcon="plus"
        rightLabel="Add scan"
        onRight={() => navigation.navigate('LesionScan', { trackingGroupId: activeTrackingGroupId })}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: Space.s20, paddingBottom: Space.s48 }}>

        {/* Risk chart */}
        <View style={lt.chartCard}>
          <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom: Space.s16 }}>
            <View>
              <Text style={lt.chartTitle}>Risk Score History</Text>
              <Text style={lt.chartSub}>{chartSubtitle}</Text>
            </View>
            <View style={[lt.trendBadge, { backgroundColor: trend.bg }]}>
              <Feather name={trend.icon} size={12} color={trend.color} />
              <Text style={{ ...Type.l3, color: trend.color }}>{trend.label}</Text>
            </View>
          </View>
          <SimpleLineChart
            data={chartHistory.map(d => d.score)}
            labels={chartHistory.map(d => d.month)}
            color={Colors.primary}
            width={width - 80}
            height={130}
          />
        </View>

        {/* Before/After */}
        <View style={lt.compareCard}>
          <Text style={lt.cardTitle}>Before / After</Text>
          <View style={lt.compareRow}>
            {comparisonScans.map(({ key, label, scan }) => (
              <View key={key} style={lt.compareImg}>
                {scan?.imageUrl ? (
                  <Image source={{ uri: scan.imageUrl }} style={lt.compareImagePhoto} />
                ) : (
                  <Ionicons name="scan-outline" size={36} color={Colors.textMuted} />
                )}
                <Text style={lt.compareLabel}>{label}</Text>
                <Text style={lt.compareDate}>
                  {scan?.date ? new Date(scan.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Unknown'}
                </Text>
              </View>
            ))}
            <View style={lt.compareDivider}>
              <Feather name="repeat" size={18} color={Colors.textMuted} />
            </View>
          </View>
          {comparisonScans.length > 0 ? (
            <View style={{ flexDirection:'row', justifyContent:'space-around', marginTop: Space.s16 }}>
              {comparisonScans.map(({ key, scan }) => {
                const cfg = riskConfig(scan?.riskLevel);
                return (
                  <View key={`meta-${key}`} style={{ alignItems:'center', gap: Space.s8 }}>
                    <Text style={lt.sizeLabel}>{cfg.label}</Text>
                    <RiskBadge level={scan?.riskLevel} size="sm" />
                    <Text style={[lt.sizeVal, { color: cfg.color }]}>{Number(scan?.confidence || 0)}% conf.</Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={lt.compareEmpty}>No scans yet. Add a scan to start tracking changes.</Text>
          )}
        </View>

        {/* Timeline */}
        <SectionHeader title="Scan Timeline" />
        {timelineScans.map((scan, i) => {
          const cfg = riskConfig(scan.riskLevel);
          const isSel = selected?.id === scan.id;
          return (
            <TouchableOpacity key={scan.id} style={lt.tlItem} onPress={() => setSelected(scan)} activeOpacity={0.82} accessibilityLabel={`${scan.lesionType}, ${cfg.label}`} accessibilityRole="button">
              <View style={lt.tlLeft}>
                <View style={[lt.tlDot, { backgroundColor: cfg.color }, isSel && { width:20, height:20, borderRadius:10, borderWidth:3, borderColor: Colors.bgCard, ...Shadow.sm }]} />
                {i < timelineScans.length - 1 && <View style={lt.tlLine} />}
              </View>
              <View style={[lt.tlCard, isSel && { borderColor: cfg.color + '60', borderWidth:1.5 }, Shadow.sm]}>
                <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom: Space.s4 }}>
                  <Text style={lt.tlDate}>{new Date(scan.date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</Text>
                  <RiskBadge level={scan.riskLevel} size="sm" />
                </View>
                <Text style={lt.tlType}>{scan.lesionType}</Text>
                {scan.imageUrl ? (
                  <Image source={{ uri: scan.imageUrl }} style={lt.tlImage} />
                ) : null}
                <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
                  <View style={{ flexDirection:'row', alignItems:'center', gap:4 }}>
                    <MaterialCommunityIcons name="pin" size={11} color={Colors.textMuted} />
                    <Text style={lt.tlLoc}>{scan.location || 'Unknown location'}</Text>
                  </View>
                  <Text style={[lt.tlConf, {color:cfg.color}]}>{scan.confidence}% conf.</Text>
                </View>
                {isSel && (
                  <TouchableOpacity style={lt.viewBtn} onPress={() => navigation.navigate('AIResult',{scan})} accessibilityLabel="View full analysis" accessibilityRole="button">
                    <Text style={lt.viewBtnTxt}>View Full Analysis</Text>
                    <Feather name="arrow-right" size={13} color={Colors.primary} />
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const lt = StyleSheet.create({
  chartCard: { backgroundColor: Colors.bgCard, borderRadius: Radius.xl, padding: Space.s20, marginBottom: Space.s16, ...Shadow.sm },
  chartTitle: { ...Type.d4, color: Colors.textOnLight },
  chartSub: { ...Type.b3, color: Colors.textMuted },
  trendBadge: { flexDirection:'row', alignItems:'center', gap:4, backgroundColor: Colors.riskHighBg, paddingHorizontal: Space.s8, paddingVertical:4, borderRadius: Radius.full },
  compareCard: { backgroundColor: Colors.bgCard, borderRadius: Radius.xl, padding: Space.s20, marginBottom: Space.s16, ...Shadow.sm },
  cardTitle: { ...Type.d4, color: Colors.textOnLight, marginBottom: Space.s16 },
  compareRow: { flexDirection:'row', gap: Space.s8, position:'relative' },
  compareImg: { flex:1, height:130, backgroundColor: Colors.grey50, borderRadius: Radius.lg, alignItems:'center', justifyContent:'center', gap:8 },
  compareImagePhoto: { width: '100%', height: 72, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg },
  compareLabel: { ...Type.l3, color: Colors.textMuted },
  compareDate: { ...Type.l3, color: Colors.textMuted },
  compareEmpty: { ...Type.b3, color: Colors.textMuted, marginTop: Space.s16 },
  compareDivider: { position:'absolute', left:'50%', top:'50%', marginLeft:-16, marginTop:-16, width:32, height:32, borderRadius:16, backgroundColor: Colors.bgCard, alignItems:'center', justifyContent:'center', ...Shadow.sm },
  sizeLabel: { ...Type.l3, color: Colors.textMuted },
  sizeVal: { ...Type.l1 },
  tlItem: { flexDirection:'row', gap: Space.s12, marginBottom:0 },
  tlLeft: { width:20, alignItems:'center' },
  tlDot: { width:16, height:16, borderRadius:8, marginTop: Space.s16, zIndex:1 },
  tlLine: { width:2, flex:1, backgroundColor: Colors.grey100, marginTop:4, marginBottom:4 },
  tlCard: { flex:1, backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Space.s16, marginBottom: Space.s12, borderWidth:1, borderColor:'transparent' },
  tlDate: { ...Type.b3, color: Colors.textMuted },
  tlType: { ...Type.l1, color: Colors.textOnLight, marginBottom: Space.s8 },
  tlImage: { width: '100%', height: 120, borderRadius: Radius.md, marginBottom: Space.s8 },
  tlLoc: { ...Type.b3, color: Colors.textMuted },
  tlConf: { ...Type.l3 },
  viewBtn: { flexDirection:'row', alignItems:'center', gap:6, marginTop: Space.s12, paddingTop: Space.s12, borderTopWidth:1, borderTopColor: Colors.grey50 },
  viewBtnTxt: { ...Type.l2, color: Colors.primary },
});

// ═════════════════════════════════════════════════════════════════════════════
// DERMATOLOGIST FINDER
// ═════════════════════════════════════════════════════════════════════════════

export function DermatologistFinder({ navigation }) {
  const { user } = useAuth();
  const [search, setSearch]       = useState('');
  const [activeFilter, setFilter] = useState('All');
  const [doctors, setDoctors] = useState([]);
  const [userCoordinate, setUserCoordinate] = useState(null);
  const [locationReady, setLocationReady] = useState(false);
  const [blockedDoctorIds, setBlockedDoctorIds] = useState([]);
  const userLocationText = String(user?.profile?.location || '').trim();
  const [bookingDoctor, setBookingDoctor] = useState(null);
  const [bookingPreferredTime, setBookingPreferredTime] = useState('');
  const [bookingMessage, setBookingMessage] = useState('');
  const [bookingSending, setBookingSending] = useState(false);

  const blockedDoctorSet = useMemo(() => new Set(blockedDoctorIds), [blockedDoctorIds]);

  const openBookingComposer = useCallback((doctor) => {
    setBookingDoctor(doctor);
    setBookingPreferredTime(String(doctor?.nextSlot || '').trim());
    setBookingMessage('');
  }, []);

  const closeBookingComposer = useCallback(() => {
    if (bookingSending) return;
    setBookingDoctor(null);
    setBookingPreferredTime('');
    setBookingMessage('');
  }, [bookingSending]);

  const loadNearbyLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setUserCoordinate(null);
        setLocationReady(true);
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setUserCoordinate({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    } catch (_error) {
      setUserCoordinate(null);
    } finally {
      setLocationReady(true);
    }
  }, []);

  const submitBookingComposer = useCallback(async () => {
    if (!bookingDoctor?.id) {
      Alert.alert('Booking unavailable', 'Please select a doctor first.');
      return;
    }

    const preferred = String(bookingPreferredTime || '').trim() || String(bookingDoctor.nextSlot || 'Next available').trim();
    const message = String(bookingMessage || '').trim() || 'Please suggest a booking time that works best for you.';

    try {
      setBookingSending(true);
      await bookingApi.createRequest({
        doctorId: bookingDoctor.id,
        doctorName: bookingDoctor.name,
        specialty: bookingDoctor.specialty,
        location: bookingDoctor.location || bookingDoctor.profile?.location || '',
        nextSlot: bookingDoctor.nextSlot,
        available: bookingDoctor.available,
        preferredTime: preferred,
        message,
      });

      setBookingDoctor(null);
      setBookingPreferredTime('');
      setBookingMessage('');

      Alert.alert(
        'Booking request sent',
        'Your preferred time and message were sent to the doctor.',
        [
          { text: 'Chat', onPress: () => navigation.navigate('Chat', { doctor: bookingDoctor }) },
          { text: 'OK', style: 'cancel' },
        ]
      );
    } catch (error) {
      Alert.alert('Booking unavailable', error?.message || 'Could not send a booking request right now.');
    } finally {
      setBookingSending(false);
    }
  }, [bookingDoctor, bookingPreferredTime, bookingMessage, navigation]);

  useEffect(() => {
    let mounted = true;

    const refresh = async () => {
      try {
        const [doctorRes, appointmentRes] = await Promise.all([
          catalogApi.listDoctors(),
          patientApi.getAppointments(),
        ]);

        if (!mounted) return;
        setDoctors(doctorRes?.doctors || []);

        const nowMs = Date.now();
        const blocked = (appointmentRes?.appointments || [])
          .filter((appointment) => {
            const doctorId = String(appointment?.doctorId || '').trim();
            if (!doctorId) return false;

            const appointmentMs = appointment?.scheduledAt
              ? new Date(appointment.scheduledAt).getTime()
              : Number.NaN;

            // No date means still active in current booking model; otherwise block only future appointments.
            return Number.isNaN(appointmentMs) || appointmentMs > nowMs;
          })
          .map((appointment) => String(appointment.doctorId).trim().toLowerCase());

        setBlockedDoctorIds(blocked);
      } catch (_error) {
        if (!mounted) return;
        setDoctors([]);
        setBlockedDoctorIds([]);
      }
    };

    refresh();
    loadNearbyLocation();
    const unsubscribe = navigation.addListener('focus', refresh);

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [navigation, loadNearbyLocation]);

  const filtered = useMemo(() => {
    const normalizedSearch = search.toLowerCase().trim();

    const scored = doctors
      .map((doctor) => {
        const matchesSearch =
          String(doctor?.name || '').toLowerCase().includes(normalizedSearch)
          || String(doctor?.specialty || '').toLowerCase().includes(normalizedSearch);

        if (!matchesSearch) return null;

        const nearbyState = getNearbyDoctorState(doctor, userCoordinate, userLocationText);

        return {
          ...doctor,
          ...nearbyState,
        };
      })
      .filter(Boolean)
      .filter((doctor) => {
        if (activeFilter === 'All') return true;
        if (activeFilter === 'Online') return !!doctor.available;
        if (activeFilter === 'Top Rated') return Number(doctor.rating || 0) >= 4.8;
        if (activeFilter === 'Nearby') {
          // Prefer real proximity when GPS is available, otherwise fall back to the city match.
          return doctor.isNearby;
        }
        return true;
      });

    if (activeFilter === 'Nearby') {
      return scored.sort((a, b) => {
        // 1. Priority: doctors with calculable distance (have coordinates)
        const aHasDistance = Number.isFinite(a.distanceKm) && a.distanceKm !== Number.POSITIVE_INFINITY;
        const bHasDistance = Number.isFinite(b.distanceKm) && b.distanceKm !== Number.POSITIVE_INFINITY;
        if (aHasDistance !== bHasDistance) return aHasDistance ? -1 : 1;

        // 2. Then: city matches (for doctors without coordinates)
        const aFallback = a.sameCityFallback ? 0 : 1;
        const bFallback = b.sameCityFallback ? 0 : 1;
        if (aFallback !== bFallback) return aFallback - bFallback;

        // 3. Finally: by distance (closest first)
        const aDistance = Number.isFinite(a.distanceKm) ? a.distanceKm : Number.POSITIVE_INFINITY;
        const bDistance = Number.isFinite(b.distanceKm) ? b.distanceKm : Number.POSITIVE_INFINITY;
        return aDistance - bDistance;
      });
    }

    if (activeFilter === 'Top Rated') {
      return scored.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
    }

    return scored;
  }, [activeFilter, doctors, locationReady, search, userCoordinate, userLocationText]);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.grey50 }}>
      <StatusBar barStyle="light-content" />
      <ScreenHeader
        title="Find a Dermatologist"
        onBack={() => navigation.goBack()}
        rightIcon="map"
        rightLabel="Map view"
        onRight={() => navigation.navigate('DermatologistMap')}
      />

      {/* Search bar */}
      <View style={df.searchWrap}>
        <Feather name="search" size={16} color={Colors.textMuted} style={df.searchIcon} />
        <TextInput
          value={search} onChangeText={setSearch}
          placeholder="Search by name or specialty..."
          placeholderTextColor={Colors.textMuted}
          style={df.searchInput}
          accessibilityLabel="Search dermatologists"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={HIT} accessibilityLabel="Clear search">
            <Feather name="x" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Space.s48 }}>
        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Space.s8, padding: Space.s16 }}>
          {['All','Online','Top Rated','Nearby'].map(f => (
            <TouchableOpacity key={f} style={[df.chip, activeFilter===f && df.chipActive]} onPress={() => setFilter(f)} accessibilityRole="radio" accessibilityLabel={f} accessibilityState={{ checked: activeFilter===f }} activeOpacity={0.72}>
              <Text style={[df.chipTxt, activeFilter===f && df.chipTxtActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={{ paddingHorizontal: Space.s20 }}>
          <Text style={df.resultCount}>{filtered.length} dermatologist{filtered.length !== 1 ? 's':''}  found</Text>
          {filtered.length === 0
            ? <EmptyState
                iconName="users"
                title="No doctors found"
                subtitle={
                  activeFilter === 'Nearby'
                    ? (!locationReady ? 'Getting your location...' : 'No nearby doctors found in your area')
                    : 'Try adjusting your search or filters'
                }
              />
            : filtered.map(doc => {
              const isBlocked = blockedDoctorSet.has(String(doc?.id || '').trim().toLowerCase());
              return (
                <DoctorCard
                  key={doc.id}
                  doctor={doc}
                  onPress={() => navigation.navigate('DoctorDetails', { doctor: doc })}
                  onBook={() => openBookingComposer(doc)}
                  onChat={() => navigation.navigate('Chat', { doctor: doc })}
                  bookDisabled={isBlocked}
                  bookLabel={isBlocked ? 'Booked' : (doc.available ? 'Book' : 'Schedule')}
                />
              );
            })
          }

          
        </View>
      </ScrollView>

      <Modal
        visible={!!bookingDoctor}
        transparent
        animationType="fade"
        onRequestClose={closeBookingComposer}
      >
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(5,14,31,0.45)', justifyContent: 'center', paddingHorizontal: Space.s20 }} onPress={closeBookingComposer}>
          <Pressable onPress={() => {}} style={{ backgroundColor: Colors.bgCard, borderRadius: Radius.xl, padding: Space.s16, borderWidth: 1, borderColor: Colors.grey100 }}>
            <Text style={{ ...Type.d4, color: Colors.textOnLight }}>Request Booking</Text>
            <Text style={{ ...Type.b3, color: Colors.textMuted, marginTop: 4 }}>
              {bookingDoctor?.name || 'Doctor'} will receive your preferred time and message.
            </Text>

            <Text style={{ ...Type.l2, color: Colors.textOnLight, marginTop: Space.s12, marginBottom: 6 }}>Preferred time</Text>
            <TextInput
              value={bookingPreferredTime}
              onChangeText={setBookingPreferredTime}
              placeholder="e.g. Tomorrow 10:30 AM"
              placeholderTextColor={Colors.textMuted}
              style={{
                minHeight: 42,
                borderRadius: Radius.md,
                borderWidth: 1,
                borderColor: Colors.grey100,
                backgroundColor: Colors.grey50,
                paddingHorizontal: Space.s12,
                color: Colors.textOnLight,
                ...Type.b2,
              }}
            />

            <Text style={{ ...Type.l2, color: Colors.textOnLight, marginTop: Space.s12, marginBottom: 6 }}>Message to doctor</Text>
            <TextInput
              value={bookingMessage}
              onChangeText={setBookingMessage}
              placeholder="Write any context for your preferred time"
              placeholderTextColor={Colors.textMuted}
              multiline
              textAlignVertical="top"
              style={{
                minHeight: 92,
                borderRadius: Radius.md,
                borderWidth: 1,
                borderColor: Colors.grey100,
                backgroundColor: Colors.grey50,
                paddingHorizontal: Space.s12,
                paddingVertical: Space.s10,
                color: Colors.textOnLight,
                ...Type.b2,
              }}
            />

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: Space.s8, marginTop: Space.s14 }}>
              <Button label="Cancel" variant="ghost" size="sm" onPress={closeBookingComposer} />
              <Button label={bookingSending ? 'Sending...' : 'Send Request'} size="sm" onPress={submitBookingComposer} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const df = StyleSheet.create({
  searchWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: Space.s20, marginTop: Space.s12, marginBottom: Space.s12, gap: Space.s8, backgroundColor: Colors.bgCard, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.grey100, paddingHorizontal: Space.s14, minHeight: 46, ...Shadow.sm },
  searchIcon: { marginLeft: Space.s12 },
  searchInput: { flex: 1, ...Type.b2, color: Colors.textOnLight, paddingLeft: Space.s4 },
  chip: { paddingHorizontal: Space.s16, paddingVertical: Space.s8, borderRadius: Radius.full, backgroundColor: Colors.bgCard, borderWidth:1.5, borderColor: Colors.grey100, minHeight:36 },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipTxt: { ...Type.l2, color: Colors.textMuted },
  chipTxtActive: { color: Colors.primaryOnDark },
  resultCount: { ...Type.b2, color: Colors.textMuted, marginBottom: Space.s12 },
  emergency: { flexDirection:'row', alignItems:'center', gap: Space.s12, backgroundColor: Colors.riskHighBg, borderRadius: Radius.xl, padding: Space.s16, marginTop: Space.s16, borderWidth:1, borderColor: Colors.riskHigh+'30' },
  emergencyIcon: { width:44, height:44, borderRadius:22, backgroundColor: Colors.riskHigh+'20', alignItems:'center', justifyContent:'center' },
  emergencyTitle: { ...Type.l1, color: Colors.riskHigh },
  emergencySub: { ...Type.b3, color: Colors.textMuted },
});

export function DoctorDetailsScreen({ navigation, route }) {
  const doctor = route.params?.doctor || {};
  const { user } = useAuth();
  const [doctorDetails, setDoctorDetails] = useState(null);
  const [isLoadingDoctor, setIsLoadingDoctor] = useState(false);
  const [mapCoordinate, setMapCoordinate] = useState(getDoctorCoordinate(doctor));
  const [rating, setRating] = useState(Number(doctor.userRating || 0));
  const [review, setReview] = useState('');
  const [reviews, setReviews] = useState([]);
  const [isSavingRating, setIsSavingRating] = useState(false);
  const [isSavingReview, setIsSavingReview] = useState(false);
  const [isOpeningMap, setIsOpeningMap] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [hasExistingReview, setHasExistingReview] = useState(false);

  const activeDoctor = doctorDetails || doctor;

  const coordinate = mapCoordinate || getDoctorCoordinate(activeDoctor);

  useEffect(() => {
    const directCoordinate = getDoctorCoordinate(activeDoctor);
    if (directCoordinate) {
      setMapCoordinate(directCoordinate);
      return;
    }

    const locationText = String(activeDoctor.location || activeDoctor.profile?.location || '').trim();
    if (!locationText) {
      setMapCoordinate(null);
      return;
    }

    let cancelled = false;

    const resolveCoordinate = async () => {
      try {
        const query = encodeURIComponent(locationText);
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${query}`, {
          headers: {
            Accept: 'application/json',
          },
        });

        if (!response.ok) return;

        const results = await response.json();
        const firstResult = Array.isArray(results) ? results[0] : null;
        const latitude = Number(firstResult?.lat);
        const longitude = Number(firstResult?.lon);

        if (!cancelled && Number.isFinite(latitude) && Number.isFinite(longitude)) {
          setMapCoordinate({ latitude, longitude });
        }
      } catch (_error) {
        if (!cancelled) {
          setMapCoordinate(null);
        }
      }
    };

    resolveCoordinate();

    return () => {
      cancelled = true;
    };
  }, [activeDoctor]);

  useEffect(() => {
    let mounted = true;

    const hydrateFeedback = async () => {
      try {
        setIsLoadingDoctor(true);
        const [doctorResponse, reviewResponse] = await Promise.all([
          catalogApi.getDoctorDetails(doctor.id),
          catalogApi.listDoctorReviews(doctor.id),
        ]);
        if (!mounted) return;

        setDoctorDetails(doctorResponse?.doctor || null);

        const sharedReviews = reviewResponse?.reviews || [];
        setReviews(sharedReviews);

        const myReview = sharedReviews.find((item) => String(item.patientId) === String(user?._id));
        if (myReview) {
          setRating(Number(myReview.rating || 0));
          setReview(String(myReview.review || ''));
          setHasExistingReview(true);
          return;
        }

        setRating(Number(doctor.userRating || 0));
        setReview('');
        setHasExistingReview(false);
      } catch (_error) {
        if (!mounted) return;
        setReviews([]);
        setDoctorDetails(null);
        setRating(Number(doctor.userRating || 0));
        setReview('');
        setHasExistingReview(false);
      } finally {
        if (!mounted) return;
        setIsLoadingDoctor(false);
      }
    };

    hydrateFeedback();
    return () => { mounted = false; };
  }, [doctor.id, doctor.userRating, user?._id]);

  const handleRate = async (value) => {
    setRating(value);

    if (!activeDoctor?.id) return;

    setIsSavingRating(true);
    try {
      await catalogApi.upsertDoctorReview(activeDoctor.id, {
        rating: value,
        review,
      });

      const response = await catalogApi.listDoctorReviews(activeDoctor.id);
      setReviews(response?.reviews || []);
    } catch (_error) {
      Alert.alert('Rating unavailable', 'Could not save your rating right now.');
    } finally {
      setIsSavingRating(false);
    }
  };

  const handleDeleteReview = async () => {
    if (isSavingReview) return;
    if (!activeDoctor?.id) {
      Alert.alert('Error', 'Doctor details are missing.');
      return;
    }

    console.log('Delete review clicked. Has existing review:', hasExistingReview, 'Doctor ID:', activeDoctor.id);
    setIsSavingReview(true);
    try {
      await catalogApi.deleteDoctorReview(activeDoctor.id);
      const response = await catalogApi.listDoctorReviews(activeDoctor.id);
      setReviews(response?.reviews || []);
      setRating(0);
      setReview('');
      setHasExistingReview(false);
      setIsReviewModalOpen(false);
      Alert.alert('Review deleted', 'Your review has been deleted.');
    } catch (error) {
      console.log('Delete review error:', error);
      Alert.alert('Error', error?.message || 'Could not delete your review.');
    } finally {
      setIsSavingReview(false);
    }
  };

  const handleSaveReview = async () => {
    if (!rating) {
      Alert.alert('Rate first', 'Please select a rating before saving a review.');
      return;
    }

    if (!activeDoctor?.id) {
      Alert.alert('Review unavailable', 'Doctor details are missing.');
      return;
    }

    setIsSavingReview(true);
    try {
      await catalogApi.upsertDoctorReview(activeDoctor.id, {
        rating,
        review,
      });

      const response = await catalogApi.listDoctorReviews(activeDoctor.id);
      setReviews(response?.reviews || []);
      setHasExistingReview(true);
      setIsReviewModalOpen(false);
      Alert.alert('Review saved', 'Your feedback has been saved.');
    } catch (_error) {
      Alert.alert('Review unavailable', 'Could not save your review right now.');
    } finally {
      setIsSavingReview(false);
    }
  };

  const safeValue = (value) => {
    const text = String(value || '').trim();
    return text ? text : 'Unavailable';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diff = now - date;
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      if (days === 0) return 'Today';
      if (days === 1) return 'Yesterday';
      if (days < 7) return `${days}d ago`;
      if (days < 30) return `${Math.floor(days / 7)}w ago`;
      if (days < 365) return `${Math.floor(days / 30)}m ago`;
      return `${Math.floor(days / 365)}y ago`;
    } catch {
      return '';
    }
  };

  const hasText = (value) => String(value || '').trim().length > 0;

  const openCabinetInMaps = async () => {
    if (isOpeningMap) return;

    setIsOpeningMap(true);
    try {
      const urls = buildMapUrls(doctor, coordinate);
      const primary = Platform.OS === 'ios' ? urls.ios : Platform.OS === 'android' ? urls.android : urls.web;
      const canOpenPrimary = await Linking.canOpenURL(primary);

      if (canOpenPrimary) {
        await Linking.openURL(primary);
        return;
      }

      await Linking.openURL(urls.web);
    } catch (_error) {
      Alert.alert('Map unavailable', 'Could not open maps right now.');
    } finally {
      setIsOpeningMap(false);
    }
  };

  const hasSpecialty = hasText(activeDoctor.specialty);
  const hasHospital = hasText(activeDoctor.credentials?.hospital);
  const yearsExperience = Number(activeDoctor.credentials?.yearsExperience || 0);
  const hasYearsExperience = Number.isFinite(yearsExperience) && yearsExperience > 0;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.grey50 }}>
      <StatusBar barStyle="light-content" />
      <ScreenHeader title="Doctor Details" onBack={() => navigation.goBack()} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: Space.s20, paddingBottom: Space.s48 }}>
        <View style={[dd.heroCard, Shadow.md]}>
          <LinearGradient
            colors={['#ECFFFC', '#E2F8F5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={dd.heroGradient}
          >
            <View style={dd.topRow}>
            <DoctorAvatar size={56} fullName={activeDoctor.name} avatarUrl={activeDoctor.profile?.avatarUrl || activeDoctor.avatarUrl} style={dd.avatarCircle} />
            <View style={{ flex: 1 }}>
              <Text style={dd.name}>{safeValue(activeDoctor.name)}</Text>
              <Text style={dd.specialty}>{safeValue(activeDoctor.specialty)}</Text>
              {hasText(activeDoctor.profile?.bio) ? (
                <Text style={dd.bio}>{activeDoctor.profile?.bio}</Text>
              ) : null}
              <View style={dd.metaPills}>
                <View style={dd.metaPill}>
                  <View style={[dd.availDot, { backgroundColor: activeDoctor.available ? Colors.riskLow : Colors.textMuted }]} />
                  <Text style={dd.metaText}>{activeDoctor.available ? 'Online' : 'Offline'}</Text>
                </View>
              </View>
            </View>
            </View>

          {isLoadingDoctor ? (
            <View style={dd.loadingRow}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={dd.loadingText}>Refreshing latest profile...</Text>
            </View>
          ) : null}

          {/* Stars Only - Click to Open Review Modal */}
          <TouchableOpacity
            onPress={() => setIsReviewModalOpen(true)}
            activeOpacity={0.72}
            style={dd.starsOnlyContainer}
            accessibilityRole="button"
            accessibilityLabel="Click to write a review"
          >
            <View style={dd.starRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Ionicons
                  key={star}
                  name={star <= rating ? 'star' : 'star-outline'}
                  size={28}
                  color={Colors.riskMed}
                  style={{ marginRight: Space.s8 }}
                />
              ))}
            </View>
            <Text style={dd.ratingSubtext}>{rating > 0 ? `${rating}/5` : 'Tap to rate'}</Text>
          </TouchableOpacity>
          </LinearGradient>
        </View>

        {hasText(activeDoctor.profile?.bio) ? (
          <View style={[dd.card, Shadow.sm]}>
            <Text style={dd.sectionTitle}>Bio</Text>
            <Text style={dd.fieldValue}>{activeDoctor.profile?.bio}</Text>
          </View>
        ) : null}

        {/* Review Modal - Yellow Box */}
        <Modal
          visible={isReviewModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsReviewModalOpen(false)}
        >
          <Pressable
            style={dd.modalOverlay}
            onPress={() => setIsReviewModalOpen(false)}
            accessibilityLabel="Close review modal"
          >
            <Pressable
              style={dd.modalContent}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={dd.modalHeader}>
                <Text style={dd.modalTitle}>Write Your Review</Text>
                <TouchableOpacity
                  onPress={() => setIsReviewModalOpen(false)}
                  style={dd.modalCloseBtn}
                  hitSlop={HIT}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                >
                  <Feather name="x" size={24} color={Colors.textOnLight} />
                </TouchableOpacity>
              </View>

              <View style={dd.modalRatingSection}>
                <Text style={dd.modalLabel}>Your Rating</Text>
                <View style={dd.starRowModal}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity
                      key={star}
                      onPress={() => setRating(star)}
                      accessibilityRole="button"
                      accessibilityLabel={`Rate ${star} star${star > 1 ? 's' : ''}`}
                      activeOpacity={0.76}
                    >
                      <Ionicons
                        name={star <= rating ? 'star' : 'star-outline'}
                        size={32}
                        color={Colors.riskMed}
                        style={{ marginRight: Space.s12 }}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={dd.modalReviewSection}>
                <Text style={dd.modalLabel}>Your Review (Optional)</Text>
                <TextInput
                  value={review}
                  onChangeText={setReview}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  maxLength={500}
                  placeholder="Tell us why you chose this rating (communication, clarity, wait time, follow-up...)"
                  placeholderTextColor={Colors.textMuted}
                  style={dd.reviewInputModal}
                  accessibilityLabel="Write a doctor review"
                />
                <Text style={dd.reviewCount}>{String(review || '').length}/500</Text>
              </View>

              <View style={dd.modalFooter}>
                <View style={dd.modalButtonRow}>
                  <Button
                    label={isSavingReview ? 'Saving...' : 'Save Review'}
                    size="md"
                    onPress={handleSaveReview}
                    loading={isSavingReview}
                    disabled={isSavingReview || !rating}
                    style={{ flex: 1 }}
                  />
                  {hasExistingReview && (
                    <TouchableOpacity
                      onPress={handleDeleteReview}
                      style={[dd.deleteButton, isSavingReview && { opacity: 0.5 }]}
                      activeOpacity={0.72}
                      accessibilityRole="button"
                      accessibilityLabel="Delete review"
                    >
                      <Feather name="trash-2" size={20} color={Colors.riskHigh} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        <View style={[dd.card, Shadow.sm]}>
          <Text style={dd.sectionTitle}>Contact</Text>
          <Text style={dd.fieldLabel}>Email</Text>
          <Text style={dd.fieldValue}>{safeValue(activeDoctor.email)}</Text>

          <Text style={dd.fieldLabel}>Phone Number</Text>
          <Text style={dd.fieldValue}>{safeValue(activeDoctor.phone || activeDoctor.profile?.phone)}</Text>
        </View>

        {(hasSpecialty || hasHospital || hasYearsExperience) ? (
          <View style={[dd.card, Shadow.sm]}>
            <Text style={dd.sectionTitle}>Details</Text>

            {hasSpecialty ? (
              <>
                <Text style={dd.fieldLabel}>Specialty</Text>
                <Text style={dd.fieldValue}>{activeDoctor.specialty}</Text>
              </>
            ) : null}

            {hasHospital ? (
              <>
                <Text style={dd.fieldLabel}>Hospital</Text>
                <Text style={dd.fieldValue}>{activeDoctor.credentials?.hospital}</Text>
              </>
            ) : null}

            {hasYearsExperience ? (
              <>
                <Text style={dd.fieldLabel}>Years of Experience</Text>
                <Text style={dd.fieldValue}>{yearsExperience}</Text>
              </>
            ) : null}
          </View>
        ) : null}

        <View style={[dd.card, Shadow.sm]}>
          <View style={dd.mapHeader}>
            <View>
              <Text style={dd.sectionTitle}>Cabinet Location</Text>
              <Text style={dd.mapSub}>Exact office location shown on map</Text>
            </View>
            <TouchableOpacity
              onPress={openCabinetInMaps}
              style={dd.mapAction}
              activeOpacity={0.78}
              accessibilityRole="button"
              accessibilityLabel="Open cabinet location in maps"
            >
              <Feather name="external-link" size={14} color={Colors.primary} />
              <Text style={dd.mapActionText}>{isOpeningMap ? 'Opening...' : 'Open'}</Text>
            </TouchableOpacity>
          </View>

          <View style={[dd.mapWrap, Shadow.sm]}>
            <DoctorMapView
              key={coordinate ? `${coordinate.latitude},${coordinate.longitude}` : 'doctor-map-fallback'}
              pins={coordinate ? [{ id: String(activeDoctor.id || 'doctor'), coordinate }] : []}
              selectedId={String(activeDoctor.id || 'doctor')}
              height={220}
              interactive={false}
              title="Cabinet map"
              subtitle={safeValue(activeDoctor.location || activeDoctor.profile?.location)}
            />
          </View>

          <Text style={dd.fieldLabel}>Exact Location</Text>
          <Text style={dd.fieldValue}>{safeValue(activeDoctor.location || activeDoctor.profile?.location)}</Text>
        </View>

        {/* Patient Reviews Section */}
        {reviews.length > 0 && (
          <View style={[dd.card, Shadow.sm]}>
            <Text style={dd.sectionTitle}>Patient Reviews</Text>
            {reviews.slice(0, 3).map((item) => (
              <View key={item.id} style={dd.reviewItemCompact}>
                <View style={dd.reviewCompactTop}>
                  <View>
                    <Text style={dd.sharedReviewer}>{item.patientName || 'Patient'}</Text>
                    <Text style={dd.sharedReviewStars}>{'★'.repeat(Math.max(0, Math.min(5, Number(item.rating || 0))))}</Text>
                  </View>
                  <Text style={dd.reviewDate}>{formatDate(item.updatedAt)}</Text>
                </View>
                <Text style={dd.sharedReviewBody}>{item.review || 'No written comment.'}</Text>
              </View>
            ))}
            {reviews.length > 3 && (
              <TouchableOpacity
                onPress={() => navigation.navigate('AllReviews', { doctorId: activeDoctor.id, doctorName: activeDoctor.name, reviews })}
                style={dd.viewAllButton}
                activeOpacity={0.72}
                accessibilityRole="button"
                accessibilityLabel="View all reviews"
              >
                <Text style={dd.viewAllButtonText}>View all reviews</Text>
                <Feather name="arrow-right" size={16} color={Colors.primary} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const dd = StyleSheet.create({
  heroCard: {
    borderRadius: Radius.xl,
    overflow: 'hidden',
    marginBottom: Space.s16,
  },
  heroGradient: {
    paddingHorizontal: Space.s20,
    paddingVertical: Space.s16,
    borderWidth: 1,
    borderColor: '#C9F0EA',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Space.s12,
    marginBottom: Space.s6,
  },
  avatarCircle: {
    flexShrink: 0,
  },
  starsOnlyContainer: {
    alignItems: 'center',
    paddingVertical: Space.s12,
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Space.s8,
  },
  starRowModal: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Space.s12,
  },
  ratingSubtext: {
    ...Type.b2,
    color: Colors.textMuted,
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    padding: Space.s20,
    marginBottom: Space.s16,
  },
  name: { ...Type.d3, color: Colors.textOnLight, marginBottom: 2 },
  specialty: { ...Type.b2, color: Colors.textMuted },
  bio: { ...Type.b3, color: Colors.textMuted, marginTop: Space.s6, lineHeight: 18 },
  metaPills: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.s8, marginTop: Space.s8 },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.s10,
    paddingHorizontal: Space.s10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.grey50,
    borderWidth: 1,
    borderColor: Colors.grey100,
  },
  metaText: { ...Type.l3, color: Colors.textMuted },
  availDot: { width: 8, height: 8, borderRadius: 4 },
  loadingRow: {
    marginTop: Space.s8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.s8,
  },
  loadingText: { ...Type.b3, color: Colors.textMuted },
  reviewItemCompact: {
    backgroundColor: Colors.grey50,
    borderWidth: 1,
    borderColor: Colors.grey100,
    borderRadius: Radius.md,
    padding: Space.s10,
    marginBottom: Space.s10,
  },
  reviewCompactTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Space.s8,
  },
  sharedReviewer: { ...Type.l2, color: Colors.textOnLight },
  sharedReviewStars: { ...Type.b3, color: Colors.riskMed, marginTop: 4 },
  reviewDate: { ...Type.l3, color: Colors.textMuted },
  sharedReviewBody: { ...Type.b3, color: Colors.textMuted },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.s8,
    paddingVertical: Space.s12,
    borderTopWidth: 1,
    borderTopColor: Colors.grey100,
  },
  viewAllButtonText: { ...Type.l2, color: Colors.primary },
  sectionTitle: { ...Type.d4, color: Colors.textOnLight, marginBottom: Space.s10 },
  fieldLabel: { ...Type.l2, color: Colors.textMuted, marginTop: Space.s8, marginBottom: 2 },
  fieldValue: { ...Type.l1, color: Colors.textOnLight },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Space.s16,
  },
  modalContent: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
    padding: Space.s20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Space.s16,
  },
  modalTitle: { ...Type.d3, color: Colors.textOnLight },
  modalCloseBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalLabel: { ...Type.l2, color: Colors.textOnLight, marginBottom: Space.s10 },
  modalRatingSection: {
    marginBottom: Space.s16,
  },
  modalReviewSection: {
    marginBottom: Space.s16,
  },
  reviewInputModal: {
    ...Type.b2,
    color: Colors.textOnLight,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderWidth: 1,
    borderColor: Colors.grey100,
    borderRadius: Radius.md,
    minHeight: 96,
    paddingHorizontal: Space.s10,
    paddingVertical: Space.s10,
    marginBottom: Space.s8,
  },
  reviewCount: { ...Type.l3, color: Colors.textMuted, textAlign: 'right' },
  modalFooter: {
    marginTop: Space.s12,
  },
  modalButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.s8,
  },
  deleteButton: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.riskHigh + '30',
    backgroundColor: Colors.riskHigh + '10',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActions: { flexDirection: 'row', gap: Space.s8, marginTop: Space.s14 },
  mapHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Space.s12 },
  mapSub: { ...Type.b3, color: Colors.textMuted },
  mapAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primaryDim,
    borderWidth: 1,
    borderColor: Colors.primary + '50',
    borderRadius: Radius.full,
    paddingHorizontal: Space.s10,
    paddingVertical: 6,
  },
  mapActionText: { ...Type.l3, color: Colors.primary },
  mapWrap: { borderRadius: Radius.lg, overflow: 'hidden', marginBottom: Space.s10 },
});

export function AllReviewsScreen({ navigation, route }) {
  const reviews = route.params?.reviews || [];
  const doctorName = route.params?.doctorName || 'Doctor';

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diff = now - date;
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      if (days === 0) return 'Today';
      if (days === 1) return 'Yesterday';
      if (days < 7) return `${days}d ago`;
      if (days < 30) return `${Math.floor(days / 7)}w ago`;
      if (days < 365) return `${Math.floor(days / 30)}m ago`;
      return `${Math.floor(days / 365)}y ago`;
    } catch {
      return '';
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.grey50 }}>
      <StatusBar barStyle="light-content" />
      <ScreenHeader title={`Reviews for ${doctorName}`} onBack={() => navigation.goBack()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: Space.s20, paddingBottom: Space.s40 }}
      >
        {reviews.length === 0 ? (
          <View style={ars.emptyContainer}>
            <Ionicons name="star-outline" size={48} color={Colors.textMuted} />
            <Text style={ars.emptyTitle}>No reviews yet</Text>
            <Text style={ars.emptyText}>Be the first to review this doctor</Text>
          </View>
        ) : (
          reviews.map((item) => (
            <View key={item.id} style={[ars.reviewCard, Shadow.sm]}>
              <View style={ars.reviewHeader}>
                <View>
                  <Text style={ars.reviewerName}>{item.patientName || 'Patient'}</Text>
                  <Text style={ars.reviewStars}>{'★'.repeat(Math.max(0, Math.min(5, Number(item.rating || 0))))}</Text>
                </View>
                <Text style={ars.reviewDateText}>{formatDate(item.updatedAt)}</Text>
              </View>
              <Text style={ars.reviewText}>{item.review || 'No written comment.'}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const ars = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Space.s40,
  },
  emptyTitle: { ...Type.d3, color: Colors.textOnLight, marginTop: Space.s12, marginBottom: Space.s4 },
  emptyText: { ...Type.b2, color: Colors.textMuted },
  reviewCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    padding: Space.s16,
    marginBottom: Space.s12,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Space.s10,
  },
  reviewerName: { ...Type.l2, color: Colors.textOnLight },
  reviewStars: { ...Type.b2, color: Colors.riskMed, marginTop: 4 },
  reviewDateText: { ...Type.b2, color: Colors.textMuted },
  reviewText: { ...Type.b2, color: Colors.textOnLight, lineHeight: 20 },
});

export function DermatologistMapScreen({ navigation }) {
  const [doctors, setDoctors] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [bookingDoctor, setBookingDoctor] = useState(null);
  const [bookingPreferredTime, setBookingPreferredTime] = useState('');
  const [bookingMessage, setBookingMessage] = useState('');
  const [bookingSending, setBookingSending] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadMapDoctors = async () => {
      try {
        const response = await catalogApi.listDoctors();

        if (!mounted) return;
        const result = response?.doctors || [];
        setDoctors(result);
        if (result[0]?.id) setSelectedId(result[0].id);
      } catch (_error) {
        if (!mounted) return;
        setDoctors([]);
        setSelectedId('');
      }
    };

    loadMapDoctors();
    return () => { mounted = false; };
  }, []);

  const pins = doctors.map((doctor, idx) => {
    const points = [
      { latitude: 37.7749, longitude: -122.4194 },
      { latitude: 37.7845, longitude: -122.4092 },
      { latitude: 37.7681, longitude: -122.4295 },
      { latitude: 37.7615, longitude: -122.4141 },
      { latitude: 37.7902, longitude: -122.4324 },
    ];
    return { ...doctor, coordinate: points[idx % points.length] };
  });

  const selected = pins.find((pin) => pin.id === selectedId) || pins[0];

  const openBookingComposer = useCallback((doctor) => {
    setBookingDoctor(doctor);
    setBookingPreferredTime(String(doctor?.nextSlot || '').trim());
    setBookingMessage('');
  }, []);

  const closeBookingComposer = useCallback(() => {
    if (bookingSending) return;
    setBookingDoctor(null);
    setBookingPreferredTime('');
    setBookingMessage('');
  }, [bookingSending]);

  const submitBookingComposer = useCallback(async () => {
    if (!bookingDoctor?.id) {
      Alert.alert('Booking unavailable', 'Please select a doctor first.');
      return;
    }

    const preferred = String(bookingPreferredTime || '').trim() || String(bookingDoctor.nextSlot || 'Next available').trim();
    const message = String(bookingMessage || '').trim() || 'Please suggest a booking time that works best for you.';

    try {
      setBookingSending(true);
      await bookingApi.createRequest({
        doctorId: bookingDoctor.id,
        doctorName: bookingDoctor.name,
        specialty: bookingDoctor.specialty,
        location: bookingDoctor.location || bookingDoctor.profile?.location || '',
        nextSlot: bookingDoctor.nextSlot,
        available: bookingDoctor.available,
        preferredTime: preferred,
        message,
      });

      setBookingDoctor(null);
      setBookingPreferredTime('');
      setBookingMessage('');

      Alert.alert(
        'Booking request sent',
        'Your preferred time and message were sent to the doctor.',
        [
          { text: 'Chat', onPress: () => navigation.navigate('Chat', { doctor: bookingDoctor }) },
          { text: 'OK', style: 'cancel' },
        ]
      );
    } catch (error) {
      Alert.alert('Booking unavailable', error?.message || 'Could not send a booking request right now.');
    } finally {
      setBookingSending(false);
    }
  }, [bookingDoctor, bookingPreferredTime, bookingMessage, navigation]);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.grey50 }}>
      <StatusBar barStyle="light-content" />
      <ScreenHeader title="Dermatologists Map" onBack={() => navigation.goBack()} rightIcon="list" rightLabel="List view" onRight={() => navigation.goBack()} />

      <View style={{ padding: Space.s20, gap: Space.s12 }}>
        <View style={[dm.mapCard, Shadow.md]}>
          <DoctorMapView pins={pins} selectedId={selected?.id} onSelectPin={setSelectedId} height={250} />
        </View>

        {selected && (
          <View style={[dm.selectedCard, Shadow.sm]}>
            <Text style={dm.selectedName}>{selected.name}</Text>
            <Text style={dm.selectedSpec}>{selected.specialty}</Text>
            <View style={dm.metaRow}>
              <Text style={dm.metaItem}>⭐ {selected.rating}</Text>
              <Text style={dm.metaItem}>📍 {selected.distance}</Text>
            </View>
            <View style={dm.actionRow}>
              <Button label="Chat" variant="outline" size="sm" icon="message-circle" iconPos="left" onPress={() => navigation.navigate('Chat', { doctor: selected })} />
              <Button
                label={selected.available ? 'Book' : 'Schedule'}
                size="sm"
                onPress={() => openBookingComposer(selected)}
              />
            </View>
          </View>
        )}

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Space.s20 }}>
          {pins.map((doctor) => (
            <TouchableOpacity
              key={doctor.id}
              style={[dm.listRow, selected?.id === doctor.id && dm.listRowActive]}
              onPress={() => setSelectedId(doctor.id)}
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityLabel={`Focus ${doctor.name} on map`}
            >
              <View style={dm.listMarker}>
                <MaterialCommunityIcons name="pin" size={13} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={dm.listName}>{doctor.name}</Text>
                <Text style={dm.listSpec}>{doctor.specialty}</Text>
              </View>
              <Text style={dm.listDist}>{doctor.distance}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <Modal
        visible={!!bookingDoctor}
        transparent
        animationType="fade"
        onRequestClose={closeBookingComposer}
      >
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(5,14,31,0.45)', justifyContent: 'center', paddingHorizontal: Space.s20 }} onPress={closeBookingComposer}>
          <Pressable onPress={() => {}} style={{ backgroundColor: Colors.bgCard, borderRadius: Radius.xl, padding: Space.s16, borderWidth: 1, borderColor: Colors.grey100 }}>
            <Text style={{ ...Type.d4, color: Colors.textOnLight }}>Request Booking</Text>
            <Text style={{ ...Type.b3, color: Colors.textMuted, marginTop: 4 }}>
              {bookingDoctor?.name || 'Doctor'} will receive your preferred time and message.
            </Text>

            <Text style={{ ...Type.l2, color: Colors.textOnLight, marginTop: Space.s12, marginBottom: 6 }}>Preferred time</Text>
            <TextInput
              value={bookingPreferredTime}
              onChangeText={setBookingPreferredTime}
              placeholder="e.g. Tomorrow 10:30 AM"
              placeholderTextColor={Colors.textMuted}
              style={{
                minHeight: 42,
                borderRadius: Radius.md,
                borderWidth: 1,
                borderColor: Colors.grey100,
                backgroundColor: Colors.grey50,
                paddingHorizontal: Space.s12,
                color: Colors.textOnLight,
                ...Type.b2,
              }}
            />

            <Text style={{ ...Type.l2, color: Colors.textOnLight, marginTop: Space.s12, marginBottom: 6 }}>Message to doctor</Text>
            <TextInput
              value={bookingMessage}
              onChangeText={setBookingMessage}
              placeholder="Write any context for your preferred time"
              placeholderTextColor={Colors.textMuted}
              multiline
              textAlignVertical="top"
              style={{
                minHeight: 92,
                borderRadius: Radius.md,
                borderWidth: 1,
                borderColor: Colors.grey100,
                backgroundColor: Colors.grey50,
                paddingHorizontal: Space.s12,
                paddingVertical: Space.s10,
                color: Colors.textOnLight,
                ...Type.b2,
              }}
            />

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: Space.s8, marginTop: Space.s14 }}>
              <Button label="Cancel" variant="ghost" size="sm" onPress={closeBookingComposer} />
              <Button label={bookingSending ? 'Sending...' : 'Send Request'} size="sm" onPress={submitBookingComposer} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const dm = StyleSheet.create({
  mapCard: { borderRadius: Radius.xl, overflow: 'hidden', backgroundColor: Colors.bgCard },
  selectedCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Space.s16,
  },
  selectedName: { ...Type.d4, color: Colors.textOnLight, marginBottom: Space.s4 },
  selectedSpec: { ...Type.b3, color: Colors.textMuted, marginBottom: Space.s8 },
  metaRow: { flexDirection: 'row', gap: Space.s8, marginBottom: Space.s12, flexWrap: 'wrap' },
  metaItem: { ...Type.l3, color: Colors.grey700, backgroundColor: Colors.grey50, paddingHorizontal: Space.s8, paddingVertical: 4, borderRadius: Radius.full },
  actionRow: { flexDirection: 'row', gap: Space.s8 },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.s10,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    paddingHorizontal: Space.s12,
    paddingVertical: Space.s10,
    marginBottom: Space.s8,
    borderWidth: 1,
    borderColor: Colors.grey100,
  },
  listRowActive: { borderColor: Colors.primary + '66', backgroundColor: Colors.primaryDim },
  listMarker: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.primaryDim, alignItems: 'center', justifyContent: 'center' },
  listName: { ...Type.l1, color: Colors.textOnLight },
  listSpec: { ...Type.b3, color: Colors.textMuted },
  listDist: { ...Type.l3, color: Colors.textMuted },
});

export function ChatScreen({ navigation, route }) {
  const initialDoctor = route?.params?.doctor;
  const [draft, setDraft] = useState('');
  const [viewMode, setViewMode] = useState('list');
  const [search, setSearch] = useState('');
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState('');
  const [messagesByThread, setMessagesByThread] = useState({});

  const formatTime = (dateString) => {
    const date = new Date(dateString || Date.now());
    const diff = Date.now() - date.getTime();
    const mins = Math.max(1, Math.floor(diff / 60000));
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  const normalizeThread = (thread) => ({
    id: String(thread.id),
    doctorId: thread.doctorId,
    name: thread.doctorName,
    specialty: thread.specialty,
    avatarUrl: thread.avatarUrl || '',
    last: thread.lastMessage || 'Start the conversation',
    unread: thread.unread || 0,
    time: formatTime(thread.lastMessageAt || thread.updatedAt || Date.now()),
    online: false,
  });

  const normalizeMessage = (message) => ({
    id: String(message.id),
    by: message.senderType === 'patient' ? 'patient' : 'doctor',
    text: message.body,
    read: !!message.readAt,
  });

  const loadThreads = async () => {
    try {
      const response = await chatApi.listThreads();
      const list = (response.threads || []).map(normalizeThread);
      setThreads(list);
      if (!activeThreadId && list[0]?.id) {
        setActiveThreadId(list[0].id);
      }
    } catch (error) {
      Alert.alert('Chat unavailable', error?.message || 'Could not load chats right now.');
    }
  };

  const loadMessages = async (threadId) => {
    if (!threadId) return;
    try {
      const response = await chatApi.getMessages(threadId);
      setMessagesByThread(prev => ({
        ...prev,
        [threadId]: (response.messages || []).map(normalizeMessage),
      }));
      setThreads(prev => prev.map(thread => (
        thread.id === threadId ? { ...thread, unread: 0 } : thread
      )));

      // Backend also marks read in getMessages; keep this as best-effort fallback.
      chatApi.markThreadRead(threadId).catch(() => {});
    } catch (error) {
      Alert.alert('Messages unavailable', error?.message || 'Could not load messages.');
    }
  };

  useEffect(() => {
    loadThreads();
  }, []);

  useEffect(() => {
    const ensureInitialDoctorThread = async () => {
      if (!initialDoctor?.id) return;
      try {
        const response = await chatApi.upsertThread({
          doctorId: initialDoctor.id,
          doctorName: initialDoctor.name,
          specialty: initialDoctor.specialty,
          avatarUrl: initialDoctor.avatarUrl || initialDoctor.profile?.avatarUrl || '',
        });
        const thread = normalizeThread(response.thread);
        setThreads(prev => {
          const without = prev.filter(item => item.id !== thread.id);
          return [thread, ...without];
        });
        setActiveThreadId(thread.id);
        setViewMode('thread');
        await loadMessages(thread.id);
      } catch (error) {
        Alert.alert('Chat unavailable', error?.message || 'Could not open doctor chat.');
      }
    };

    ensureInitialDoctorThread();
  }, [initialDoctor?.id]);

  const activeThread = threads.find(t => t.id === activeThreadId) || threads[0];
  const activeMessages = messagesByThread[activeThreadId] || [];
  const visibleThreads = threads.filter(t => (
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.specialty.toLowerCase().includes(search.toLowerCase())
  ));

  const openThread = async (threadId) => {
    setActiveThreadId(threadId);
    setViewMode('thread');
    await loadMessages(threadId);
  };

  const sendMessage = async () => {
    if (!activeThreadId) return;
    const text = draft.trim();
    if (!text) return;
    try {
      const response = await chatApi.sendMessage(activeThreadId, text);
      const nextMessage = normalizeMessage(response.message);
      setMessagesByThread(prev => {
        const list = prev[activeThreadId] || [];
        return {
          ...prev,
          [activeThreadId]: [...list, nextMessage],
        };
      });
      setThreads(prev => prev.map(thread => (
        thread.id === activeThreadId
          ? { ...thread, last: text, time: 'now' }
          : thread
      )));
      setDraft('');
    } catch (error) {
      Alert.alert('Message failed', error?.message || 'Could not send message.');
    }
  };

  if (viewMode === 'list') {
    return (
      <View style={ch.page}>
        <StatusBar barStyle="light-content" />
        <ScreenHeader title="Doctor Chat" onBack={() => navigation.goBack()} rightIcon="message-square" rightLabel="Messages" />

        <ScrollView style={{ flex: 1 }} contentContainerStyle={ch.listContent}>
          <View style={ch.searchWrap}>
            <Feather name="search" size={16} color={Colors.textMuted} style={ch.searchIcon} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search doctor chats"
              placeholderTextColor={Colors.textMuted}
              style={ch.searchInput}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ch.storyRow}>
            {threads.map(thread => {
              return (
                <TouchableOpacity key={thread.id} style={ch.storyItem} onPress={() => openThread(thread.id)} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={`Open chat with ${thread.name}`}>
                  <View style={ch.storyAvatarWrap}>
                    <DoctorAvatar size={54} fullName={thread.name} avatarUrl={thread.avatarUrl} style={ch.storyAvatar} />
                    {thread.online && <View style={ch.onlineDot} />}
                  </View>
                  <Text style={ch.storyName} numberOfLines={1}>{thread.name.split(' ')[1] || thread.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {visibleThreads.map(thread => {
            return (
              <TouchableOpacity
                key={thread.id}
                style={ch.chatRow}
                onPress={() => openThread(thread.id)}
                activeOpacity={0.84}
                accessibilityRole="button"
                accessibilityLabel={`Open chat with ${thread.name}`}
              >
                <View style={ch.chatAvatarWrap}>
                  <DoctorAvatar size={52} fullName={thread.name} avatarUrl={thread.avatarUrl} style={ch.chatAvatar} />
                  {thread.online && <View style={ch.chatOnlineDot} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ch.chatName}>{thread.name}</Text>
                  <Text style={ch.chatPreview} numberOfLines={1}>{thread.last}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <Text style={ch.chatTime}>{thread.time}</Text>
                  {thread.unread > 0 && <View style={ch.chatUnread}><Text style={ch.chatUnreadText}>{thread.unread}</Text></View>}
                </View>
              </TouchableOpacity>
            );
          })}

          {visibleThreads.length === 0 && (
            <View style={ch.emptyThreads}>
              <Text style={ch.emptyThreadsText}>No chats found</Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={ch.pageThread}>
      <StatusBar barStyle="light-content" />
      <ScreenHeader title={activeThread.name} onBack={() => setViewMode('list')} rightIcon="phone" rightLabel="Call doctor" />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={ch.messagesList}>
        {activeMessages.map(msg => {
          const mine = msg.by === 'patient';
          return (
            <View key={msg.id} style={[ch.msgRow, mine ? ch.msgRowMine : ch.msgRowDoctor]}>
              {!mine && <DoctorAvatar size={26} fullName={activeThread?.name} avatarUrl={activeThread?.avatarUrl} style={ch.messageAvatar} />}
              <View style={[ch.msgBubble, mine ? ch.msgMine : ch.msgDoctor, !mine && ch.msgDoctorGap]}>
                <Text style={[ch.msgTxt, mine && { color: '#FFFFFF' }]}>{msg.text}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View style={ch.composer}>
        <TouchableOpacity style={ch.attachBtn} accessibilityLabel="Attach" accessibilityRole="button">
          <Feather name="mic" size={20} color={Colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={ch.attachBtn} accessibilityLabel="Photo" accessibilityRole="button">
          <Feather name="image" size={20} color={Colors.primary} />
        </TouchableOpacity>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Aa"
          placeholderTextColor={Colors.textMuted}
          style={ch.input}
          multiline
        />
        <View style={ch.sendSpacer} />
        <TouchableOpacity onPress={sendMessage} style={ch.sendBtn} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Send message">
          <Ionicons name="send" size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const ch = StyleSheet.create({
  page: { flex: 1, backgroundColor: Colors.grey50 },
  listContent: { paddingBottom: Space.s16 },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Space.s12, paddingTop: Space.s12, paddingBottom: Space.s8 },
  listTitle: { ...Type.d3, color: Colors.textOnLight, flex: 1, marginLeft: Space.s8 },
  listHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: Space.s8 },
  listIconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.primaryDim, alignItems: 'center', justifyContent: 'center' },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: Space.s20, marginTop: Space.s12, marginBottom: Space.s12, gap: Space.s8, backgroundColor: Colors.bgCard, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.grey100, paddingHorizontal: Space.s14, minHeight: 46, ...Shadow.sm },
  searchIcon: { marginLeft: Space.s12 },
  searchInput: { flex: 1, ...Type.b2, color: Colors.textOnLight, paddingLeft: Space.s4 },
  storyRow: { gap: Space.s12, paddingHorizontal: Space.s20, paddingBottom: Space.s8 },
  storyItem: { width: 68, alignItems: 'center' },
  storyAvatarWrap: { position: 'relative', marginBottom: 6 },
  storyAvatar: {},
  onlineDot: { position: 'absolute', right: 2, bottom: 2, width: 12, height: 12, borderRadius: 6, backgroundColor: '#31A24C', borderWidth: 2, borderColor: '#FFFFFF' },
  storyName: { ...Type.l3, color: Colors.grey700, textAlign: 'center' },
  chatRow: { flexDirection: 'row', alignItems: 'center', gap: Space.s10, marginHorizontal: Space.s20, marginBottom: Space.s8, paddingHorizontal: Space.s12, paddingVertical: Space.s10, backgroundColor: Colors.bgCard, borderRadius: Radius.lg, ...Shadow.sm },
  chatAvatarWrap: { position: 'relative' },
  chatAvatar: {},
  chatOnlineDot: { position: 'absolute', right: 1, bottom: 1, width: 12, height: 12, borderRadius: 6, backgroundColor: '#31A24C', borderWidth: 2, borderColor: '#FFFFFF' },
  chatName: { ...Type.l1, color: Colors.textOnLight },
  chatPreview: { ...Type.b3, color: Colors.textMuted },
  chatTime: { ...Type.l3, color: Colors.textMuted },
  chatUnread: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  chatUnreadText: { ...Type.l3, color: '#FFFFFF', fontWeight: '700' },
  emptyThreads: { alignItems: 'center', paddingVertical: Space.s24 },
  emptyThreadsText: { ...Type.b2, color: Colors.textMuted },

  pageThread: { flex: 1, backgroundColor: Colors.grey50 },
  threadHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Space.s10, paddingTop: Space.s10, paddingBottom: Space.s8, borderBottomWidth: 1, borderBottomColor: '#EEF1F5' },
  threadHeaderCenter: { flexDirection: 'row', alignItems: 'center', gap: Space.s8, flex: 1 },
  threadHeaderAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  threadHeaderAvatarText: { ...Type.l3, color: '#FFFFFF', fontWeight: '700' },
  threadHeaderName: { ...Type.l2, color: Colors.textOnLight },
  threadHeaderSub: { ...Type.l3, color: Colors.textMuted },
  threadHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: Space.s6 },
  messagesList: { paddingHorizontal: Space.s20, paddingTop: Space.s8, paddingBottom: Space.s12 },
  msgRow: { marginBottom: Space.s8, flexDirection: 'row', alignItems: 'flex-end' },
  msgRowMine: { justifyContent: 'flex-end' },
  msgRowDoctor: { justifyContent: 'flex-start' },
  messageAvatar: { marginRight: Space.s6, marginBottom: 2 },
  msgBubble: { maxWidth: '78%', borderRadius: 20, paddingHorizontal: Space.s12, paddingVertical: Space.s10, justifyContent: 'center' },
  msgMine: { backgroundColor: Colors.primary, borderBottomRightRadius: 8 },
  msgDoctor: { backgroundColor: Colors.bgCard, borderBottomLeftRadius: 8, borderWidth: 1, borderColor: Colors.grey100 },
  msgDoctorGap: { marginLeft: 2 },
  msgTxt: { ...Type.b2, color: Colors.textOnLight, lineHeight: 19 },
  composer: { flexDirection: 'row', alignItems: 'center', gap: Space.s6, borderTopWidth: 1, borderTopColor: Colors.grey100, backgroundColor: Colors.bgCard, paddingHorizontal: Space.s12, paddingVertical: Space.s10 },
  attachBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, maxWidth: '74%', minHeight: 30, maxHeight: 70, borderRadius: 16, backgroundColor: Colors.grey50, borderWidth: 1, borderColor: Colors.grey100, paddingHorizontal: Space.s10, paddingLeft: Space.s14, paddingVertical: Space.s6, marginTop: Space.s4, marginRight: Space.s6, color: Colors.textOnLight, ...Type.b2 },
  sendSpacer: { width: Space.s3 },
  sendBtn: { width: 36, height: 36, borderRadius: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary },
});
// ═════════════════════════════════════════════════════════════════════════════
// SKIN EDUCATION SCREEN
// ═════════════════════════════════════════════════════════════════════════════

// Category colors - consistent with doctor portal
const CATEGORY_COLORS = {
  'Detection': '#00C2B2',
  'Education': '#6366F1',
  'Prevention': '#F59E0B',
  'Reference': '#00C48C',
  'Treatment': '#45B7D1',
  'Dermatology': '#EC4899',
  'Screening': '#8B5CF6',
  'Skincare': '#06B6D4',
  'Wellness': '#10B981',
  'Case Studies': '#F97316',
};

function randomRecentDate(daysBack = 365) {
  const now = Date.now();
  const past = now - Math.floor(Math.random() * daysBack * 24 * 60 * 60 * 1000);
  return new Date(past).toISOString();
}

function estimateReadTime(text = '') {
  try {
    const words = String(text).trim().split(/\s+/).filter(Boolean).length;
    const minutes = Math.max(1, Math.round(words / 200));
    return `${minutes} min read`;
  } catch (_e) {
    return '1 min read';
  }
}

function normalizeEducationalArticle(article = {}) {
  const id = article.id || article._id || `${article.title || 'article'}-${Math.random().toString(36).slice(2, 9)}`;
  const title = article.title || article.headline || 'Untitled article';
  const content = article.content || article.body || '';
  const summary = article.summary || article.excerpt || (content ? String(content).slice(0, 160) + '...' : '');
  const category = article.category || 'Education';
  const readTime = article.readTime || estimateReadTime(content);
  const updatedAt = article.updatedAt || article.modifiedAt || article.publishedAt || randomRecentDate(365);
  const publishedAt = article.publishedAt || article.createdAt || updatedAt;

  return {
    ...article,
    id,
    title,
    summary,
    content,
    category,
    readTime,
    updatedAt,
    publishedAt,
    color: CATEGORY_COLORS[category] || CATEGORY_COLORS['Education'],
  };
}

export function SkinEducationScreen({ navigation }) {
  const [expanded, setExpanded] = useState(null);
  const [catFilter, setCat] = useState('All');
  const [articlesList, setArticlesList] = useState([]);
  const [doctorBlogs, setDoctorBlogs] = useState([]);
  const [search, setSearch] = useState('');
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [readingStats, setReadingStats] = useState({ totalRead: 0, favorites: 0 });

  useEffect(() => {
    let mounted = true;
    Promise.all([
      catalogApi.listArticles(),
      blogApi.listBlogs(),
    ]).then(([articlesResponse, blogsResponse]) => {
      if (!mounted) return;
      setArticlesList((articlesResponse.articles || []).map(normalizeEducationalArticle));
      setDoctorBlogs((blogsResponse.blogs || []).map(mapDoctorBlogToArticle));
    }).catch(() => {
      if (mounted) {
        setArticlesList([]);
        setDoctorBlogs([]);
      }
    });
    return () => { mounted = false; };
  }, []);

  // Auto-rotate featured carousel
  useEffect(() => {
    const allBlogs = [...articlesList, ...doctorBlogs];
    if (allBlogs.length === 0) return;
    
    const interval = setInterval(() => {
      setFeaturedIndex((prev) => (prev + 1) % allBlogs.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [articlesList, doctorBlogs]);

  const ABCDE = [
    { letter:'A', title:'Asymmetry',  desc:"One half doesn't match the other. Normal moles are symmetrical.",           flag:true  },
    { letter:'B', title:'Border',     desc:'Ragged, notched, or blurred edges. Normal moles have smooth, clear borders.', flag:true  },
    { letter:'C', title:'Color',      desc:'Multiple colors (black, brown, white, red, blue) within one lesion.',         flag:true  },
    { letter:'D', title:'Diameter',   desc:'Larger than 6mm (pencil eraser). Smaller lesions can also be melanoma.',      flag:false },
    { letter:'E', title:'Evolution',  desc:'Any change in size, shape, or color over time.',                               flag:true  },
  ];

  const formatBlogDate = (article = {}) => {
    const rawDate = article.publishedAt || article.updatedAt || article.createdAt;
    if (!rawDate) return '';
    const date = new Date(rawDate);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' });
  };

  const cats = ['All', ...new Set([...articlesList, ...doctorBlogs].map(a => a.category))];
  const categoryColors = {
    All: Colors.primary,
    ...CATEGORY_COLORS,
    ...Object.fromEntries(
      [...articlesList, ...doctorBlogs]
        .filter((item) => item?.category)
        .map((item) => [item.category, item.color || CATEGORY_COLORS[item.category] || Colors.primary])
    ),
  };
  
  const allBlogs = [...articlesList, ...doctorBlogs];
  const featuredBlog = allBlogs[featuredIndex % allBlogs.length] || null;

  const goToFeaturedBlog = useCallback((direction) => {
    if (allBlogs.length < 2) return;
    setFeaturedIndex((prev) => {
      const next = prev + direction;
      return (next + allBlogs.length) % allBlogs.length;
    });
  }, [allBlogs.length]);

  const featuredSwipeResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gestureState) => {
      const horizontalMove = Math.abs(gestureState.dx);
      const verticalMove = Math.abs(gestureState.dy);
      return horizontalMove > 14 && horizontalMove > verticalMove;
    },
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dx <= -35) {
        goToFeaturedBlog(1);
      } else if (gestureState.dx >= 35) {
        goToFeaturedBlog(-1);
      }
    },
  }), [goToFeaturedBlog]);
  
  const articles = (catFilter === 'All' ? articlesList : articlesList.filter(a => a.category === catFilter)).filter((article) =>
    [article.title, article.summary, article.category].some((value) => String(value || '').toLowerCase().includes(search.toLowerCase()))
  );
  const doctorArticles = (catFilter === 'All' ? doctorBlogs : doctorBlogs.filter(a => a.category === catFilter)).filter((article) =>
    [article.title, article.summary, article.category].some((value) => String(value || '').toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <View style={{ flex: 1, backgroundColor: Colors.grey50 }}>
      <StatusBar barStyle="light-content" />
      <ScreenHeader title="Skin Education" onBack={() => navigation.goBack()} rightIcon="search" rightLabel="Search blogs" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Space.s48 }}>

        {/* Featured Blog Carousel */}
        {featuredBlog && (
          <View style={se.featuredSection}>
            <LinearGradient 
              colors={[`${featuredBlog.color}40`, `${featuredBlog.color}08`]} 
              style={se.featuredCard}
              {...featuredSwipeResponder.panHandlers}
            >
              <View style={se.featuredBadge}>
                <Feather name="trending-up" size={14} color={Colors.textPrimary} />
                <Text style={se.featuredBadgeText}>Featured</Text>
              </View>
              <Text style={se.featuredTitle} numberOfLines={2}>{featuredBlog.title}</Text>
              <Text style={se.featuredSummary} numberOfLines={2}>{featuredBlog.summary}</Text>
              <View style={se.featuredMeta}>
                <Text style={se.featuredMetaText}>{featuredBlog.readTime}</Text>
                <View style={se.metaDot} />
                <Text style={se.featuredMetaText}>{formatBlogDate(featuredBlog)}</Text>
              </View>
              <TouchableOpacity 
                style={[se.readButton, { backgroundColor: featuredBlog.color }]}
                onPress={() => navigation.navigate('ArticleDetail', { article: featuredBlog })}
                activeOpacity={0.82}
              >
                <Text style={se.readButtonText}>Read Blog</Text>
                <Feather name="arrow-right" size={14} color={Colors.textPrimary} />
              </TouchableOpacity>
            </LinearGradient>
            
            {/* Carousel Dots */}
            <View style={se.dotsContainer}>
              {allBlogs.map((_, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[se.dot, featuredIndex % allBlogs.length === idx && se.dotActive]}
                  onPress={() => setFeaturedIndex(idx)}
                />
              ))}
            </View>
          </View>
        )}

        {/* Quick Stats */}
        <View style={se.statsSection}>
          <View style={[se.statCard, { backgroundColor: '#00C2B214' }]}>
            <Feather name="book-open" size={20} color="#00C2B2" />
            <Text style={se.statValue}>{allBlogs.length}</Text>
            <Text style={se.statLabel}>Articles</Text>
          </View>
          <View style={[se.statCard, { backgroundColor: '#6366F114' }]}>
            <Feather name="clock" size={20} color="#6366F1" />
            <Text style={se.statValue}>{Math.ceil(allBlogs.reduce((sum, a) => sum + (Number(String(a.readTime || '').match(/\d+/)?.[0]) || 1), 0) / allBlogs.length)}m</Text>
            <Text style={se.statLabel}>Avg. Read</Text>
          </View>
          <View style={[se.statCard, { backgroundColor: '#F59E0B14' }]}>
            <Feather name="award" size={20} color="#F59E0B" />
            <Text style={se.statValue}>{doctorArticles.length}</Text>
            <Text style={se.statLabel}>Expert Posts</Text>
          </View>
        </View>

        

        {/* Search */}
        <View style={se.searchWrap}>
          <Feather name="search" size={16} color={Colors.textMuted} style={se.searchIcon} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search blogs"
            placeholderTextColor={Colors.textMuted}
            style={se.searchInput}
            accessibilityLabel="Search blogs"
          />
          {search.length > 0 ? (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={HIT} accessibilityLabel="Clear search">
              <Feather name="x" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Category filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Space.s8, padding: Space.s16 }}>
          {cats.map(c => {
            const color = categoryColors[c] || Colors.primary;
            return (
              <TouchableOpacity
                key={c}
                style={[
                  se.catChip,
                  {
                    backgroundColor: `${color}14`,
                    borderColor: `${color}40`,
                  },
                  catFilter===c && {
                    backgroundColor: color,
                    borderColor: color,
                  },
                ]}
                onPress={() => setCat(c)}
                accessibilityRole="radio"
                accessibilityLabel={c}
                accessibilityState={{ checked: catFilter===c }}
                activeOpacity={0.72}
              >
                <Text style={[se.catTxt, { color }, catFilter===c && se.catTxtActive]}>{c}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Doctor-written blogs */}
        <View style={{ paddingHorizontal: Space.s20 }}>
          <SectionHeader title="Doctor Blogs" />
          {doctorArticles.map(article => (
            <TouchableOpacity key={article.id} style={se.articleCard} onPress={() => navigation.navigate('ArticleDetail', { article })} activeOpacity={0.82} accessibilityLabel={article.title} accessibilityRole="button">
              <View style={{ width:4, backgroundColor: article.color, borderTopLeftRadius:4, borderBottomLeftRadius:4 }} />
              <View style={{ flex:1, padding: Space.s16 }}>
                <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom: Space.s8 }}>
                  <View style={{ flexDirection:'row', gap: Space.s8, alignItems:'center' }}>
                    <View style={{ backgroundColor: article.color+'20', paddingHorizontal:8, paddingVertical:3, borderRadius: Radius.full }}>
                      <Text style={{ ...Type.l3, color: article.color }}>{article.category}</Text>
                    </View>
                  </View>
                </View>
                <Text style={se.articleTitle}>{article.title}</Text>
                <Text style={se.articleSummary}>{article.summary}</Text>
                {article.authorName ? <Text style={{ ...Type.l3, color: Colors.grey700, marginTop: Space.s8 }}>By {article.authorName}</Text> : null}
                <Text style={{ ...Type.l3, color: Colors.textMuted, marginTop: Space.s4 }}>
                  {article.readTime || '1 min read'}{formatBlogDate(article) ? ` · ${formatBlogDate(article)}` : ''}
                </Text>
              </View>
            </TouchableOpacity>
          ))}

          {doctorArticles.length === 0 ? (
            <View style={se.emptySearchCard}>
              <Text style={se.emptySearchTitle}>No doctor blogs yet</Text>
              <Text style={se.emptySearchText}>Published blogs from doctors will appear here.</Text>
            </View>
          ) : null}
        </View>

        {/* Blogs */}
        <View style={{ paddingHorizontal: Space.s20 }}>
          <SectionHeader title="Educational Blogs" />
          {articles.map(article => (
            <TouchableOpacity key={article.id} style={se.articleCard} onPress={() => navigation.navigate('ArticleDetail', { article })} activeOpacity={0.82} accessibilityLabel={article.title} accessibilityRole="button">
              <View style={{ width:4, backgroundColor: article.color, borderTopLeftRadius:4, borderBottomLeftRadius:4 }} />
              <View style={{ flex:1, padding: Space.s16 }}>
                <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom: Space.s8 }}>
                  <View style={{ flexDirection:'row', gap: Space.s8, alignItems:'center' }}>
                    <View style={{ backgroundColor: article.color+'20', paddingHorizontal:8, paddingVertical:3, borderRadius: Radius.full }}>
                      <Text style={{ ...Type.l3, color: article.color }}>{article.category}</Text>
                    </View>
                  </View>
                </View>
                <Text style={se.articleTitle}>{article.title}</Text>
                <Text style={se.articleSummary}>{article.summary}</Text>
                <Text style={{ ...Type.l3, color: Colors.textMuted, marginTop: Space.s8 }}>
                  {article.readTime || '1 min read'} · {formatBlogDate(article)}
                </Text>
              </View>
            </TouchableOpacity>
          ))}

          {articles.length === 0 ? (
            <View style={se.emptySearchCard}>
              <Text style={se.emptySearchTitle}>No blogs found</Text>
              <Text style={se.emptySearchText}>Try a different keyword or clear the search.</Text>
            </View>
          ) : null}
        </View>


      </ScrollView>
    </View>
  );
}

function mapDoctorBlogToArticle(blog = {}) {
  const color = blog.color || CATEGORY_COLORS[blog.category] || '#00C2B2';
  const content = String(blog.content || '').trim();

  return {
    id: blog.id,
    title: blog.title || 'Doctor Blog',
    summary: blog.summary || 'Read the full blog to learn more.',
    authorName: blog.authorSnapshot?.name || 'Doctor',
    content,
    category: blog.category || 'Detection',
    color,
    readTime: blog.readTime || '1 min read',
    publishedAt: blog.publishedAt || null,
    updatedAt: blog.updatedAt || null,
    createdAt: blog.createdAt || null,
  };
}

const se = StyleSheet.create({
  featuredSection: { paddingHorizontal: Space.s20, paddingTop: Space.s12, paddingBottom: Space.s20 },
  featuredCard: { 
    borderRadius: Radius.xl, 
    padding: Space.s20, 
    backgroundColor: Colors.bgCard,
    marginBottom: Space.s16,
    ...Shadow.lg 
  },
  featuredBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: Space.s10, 
    backgroundColor: 'rgba(255,255,255,0.2)', 
    paddingHorizontal: Space.s10, 
    paddingVertical: Space.s4, 
    borderRadius: Radius.full, 
    alignSelf: 'flex-start',
    marginBottom: Space.s12
  },
  featuredBadgeText: { ...Type.l3, color: Colors.textPrimary, fontWeight: '600' },
  featuredTitle: { ...Type.d2, color: Colors.textOnLight, marginBottom: Space.s8, lineHeight: 38 },
  featuredSummary: { ...Type.b2, color: Colors.grey700, marginBottom: Space.s12, lineHeight: 20 },
  featuredMeta: { flexDirection: 'row', alignItems: 'center', gap: Space.s8, marginBottom: Space.s14 },
  featuredMetaText: { ...Type.b3, color: Colors.textMuted },
  metaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: Colors.textMuted },
  readButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: Space.s8,
    marginTop: Space.s8,
    paddingHorizontal: Space.s16, 
    paddingVertical: Space.s12, 
    borderRadius: Radius.lg
  },
  readButtonText: { ...Type.l2, color: Colors.textPrimary, fontWeight: '600' },
  dotsContainer: { flexDirection: 'row', justifyContent: 'center', gap: Space.s8, marginTop: Space.s14 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.grey200 },
  dotActive: { width: 24, backgroundColor: Colors.primary },
  
  statsSection: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    paddingHorizontal: Space.s20, 
    marginVertical: Space.s16,
    marginBottom: Space.s20,
    gap: Space.s8
  },
  statCard: { 
    flex: 1,
    alignItems: 'center', 
    paddingTop: Space.s16,
    paddingBottom: Space.s16,
    paddingHorizontal: Space.s12,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bgCard,
    gap: Space.s8
  },
  statValue: { ...Type.d4, color: Colors.textOnLight },
  statLabel: { ...Type.b3, color: Colors.textMuted },
  
  abcdeFeature: { padding: Space.s24, paddingBottom: Space.s16 },
  abcdeTitle: { ...Type.d3, color: Colors.textPrimary, marginBottom: Space.s8 },
  abcdeSub: { ...Type.b2, color: 'rgba(255,255,255,0.78)', marginBottom: Space.s20, lineHeight:22 },
  abcdeCard: { width:155, backgroundColor:'rgba(255,255,255,0.14)', borderRadius: Radius.lg, padding: Space.s16, borderWidth:1, borderColor:'rgba(255,255,255,0.18)' },
  abcdeLetter: { width:40, height:40, borderRadius:20, backgroundColor:'rgba(255,255,255,0.2)', alignItems:'center', justifyContent:'center', marginBottom: Space.s8 },
  abcdeLetterTxt: { ...Type.d3, color: Colors.textPrimary },
  abcdeCardTitle: { ...Type.l1, color: Colors.textPrimary, marginBottom: Space.s4 },
  abcdeCardDesc: { ...Type.b3, color:'rgba(255,255,255,0.72)', lineHeight:18, marginBottom: Space.s8 },
  warnBadge: { flexDirection:'row', alignItems:'center', gap:4, backgroundColor:'rgba(255,255,255,0.15)', borderRadius: Radius.full, paddingHorizontal:8, paddingVertical:3, alignSelf:'flex-start' },
  warnTxt: { ...Type.l3, color: Colors.textPrimary },
  searchIcon: { marginLeft: Space.s12 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: Space.s20, marginTop: Space.s12, marginBottom: Space.s12, gap: Space.s8, backgroundColor: Colors.bgCard, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.grey100, paddingHorizontal: Space.s14, minHeight: 46, ...Shadow.sm },
  searchInput: { flex: 1, ...Type.b2, color: Colors.textOnLight, paddingLeft: Space.s4 },
  catChip: { paddingHorizontal: Space.s16, paddingVertical: Space.s8, borderRadius: Radius.full, backgroundColor: Colors.bgCard, borderWidth:1.5, borderColor: Colors.grey100, minHeight:36 },
  catChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catTxt: { ...Type.l2, color: Colors.textMuted },
  catTxtActive: { color: Colors.primaryOnDark },
  articleCard: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, flexDirection:'row', overflow:'hidden', marginBottom: Space.s12, ...Shadow.sm },
  articleTitle: { ...Type.d4, color: Colors.textOnLight, marginBottom: Space.s4 },
  articleSummary: { ...Type.b2, color: Colors.textMuted, lineHeight:20 },
  emptySearchCard: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Space.s16, marginBottom: Space.s12, ...Shadow.sm },
  emptySearchTitle: { ...Type.l1, color: Colors.textOnLight, marginBottom: Space.s4 },
  emptySearchText: { ...Type.b3, color: Colors.textMuted },
});

export function ArticleDetailScreen({ navigation, route }) {
  const article = route?.params?.article || {
    title: 'Skin Health Essentials',
    category: 'Prevention',
    summary: 'Daily practices to reduce skin-risk factors and improve early detection.',
    color: Colors.primary,
    content:
      'Wear protective clothing, avoid peak UV hours (10am to 4pm), and reapply sunscreen every two hours. Document suspicious lesions with date-stamped photos to support early clinical review.',
  };
  
  const [readProgress, setReadProgress] = useState(0);

  const toRgb = (hex) => {
    const clean = String(hex || '').replace('#', '').trim();
    if (clean.length !== 6) return null;
    const r = Number.parseInt(clean.slice(0, 2), 16);
    const g = Number.parseInt(clean.slice(2, 4), 16);
    const b = Number.parseInt(clean.slice(4, 6), 16);
    if (![r, g, b].every((v) => Number.isFinite(v))) return null;
    return { r, g, b };
  };

  const articleColor = article.color || Colors.primary;
  const rgb = toRgb(articleColor);
  const gradientColors = rgb
    ? [`rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.14)`, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.06)`]
    : ['#ECFFFC', '#E2F8F5'];

  function stripTitleFromContent(content = '', title = '') {
    try {
      const t = String(title || '').trim();
      let c = String(content || '');
      if (!t) return c;

      const ci = c.trimStart();
      if (ci.slice(0, t.length).toLowerCase() === t.toLowerCase()) {
        c = ci.slice(t.length).replace(/^[:\s#=-]*\r?\n?/, '');
        return c.trimStart();
      }

      if (/^#\s*/.test(ci)) {
        const withoutHash = ci.replace(/^#\s*/, '');
        if (withoutHash.slice(0, t.length).toLowerCase() === t.toLowerCase()) {
          c = withoutHash.slice(t.length).replace(/^[:\s#=-]*\r?\n?/, '');
          return c.trimStart();
        }
      }

      const h1 = ci.match(/^<h1[^>]*>([\s\S]*?)<\/h1>\s*/i);
      if (h1) {
        const inner = h1[1].trim();
        if (inner.toLowerCase() === t.toLowerCase() || inner.toLowerCase().includes(t.toLowerCase())) {
          c = ci.replace(/^<h1[^>]*>[\s\S]*?<\/h1>\s*/i, '');
          return c.trimStart();
        }
      }

      return c;
    } catch (_e) {
      return content;
    }
  }

  const rawContent = String(article.content || '').trim() || 'No content available for this blog yet.';
  const fullContent = stripTitleFromContent(rawContent, article.title);
  
  // Extract key points from article
  const keyPoints = article.keyPoints || [];
  
  // Calculate read time based on content length
  const wordCount = fullContent.split(/\s+/).length;
  const estimatedReadTime = Math.ceil(wordCount / 200); // 200 words per minute average

  return (
    <View style={{ flex: 1, backgroundColor: Colors.grey50 }}>
      <StatusBar barStyle="light-content" />

      <ScreenHeader
        title="Skin Education"
        onBack={() => navigation.goBack()}
        rightIcon="search"
        rightLabel="Search blogs"
        onRight={() => navigation.navigate('SkinEducation')}
      />

      <View style={ad.progressWrap}>
        <View style={ad.progressTrack}>
          <View style={[ad.progressBar, { width: `${readProgress}%`, backgroundColor: articleColor }]} />
        </View>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ paddingBottom: Space.s48 }}
        scrollEventThrottle={16}
        onScroll={(event) => {
          const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
          const progress = (contentOffset.y / (contentSize.height - layoutMeasurement.height)) * 100;
          setReadProgress(Math.min(progress, 100));
        }}
      >
        {/* Header Section */}
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[ad.header, Shadow.sm]}
        >
          <View style={ad.categoryPill}>
            <Text style={[ad.categoryTxt, { color: articleColor }]}>{article.category || 'Blog'}</Text>
          </View>
          <Text style={ad.title}>{article.title}</Text>
          <Text style={ad.summary}>{article.summary}</Text>
          
          {/* Meta Information */}
          <View style={ad.metaSection}>
            <View style={ad.metaItem}>
              <Feather name="clock" size={14} color={Colors.textMuted} />
              <Text style={ad.metaText}>{estimatedReadTime} min read</Text>
            </View>
            {article.authorName && (
              <View style={ad.metaItem}>
                <Feather name="user" size={14} color={Colors.textMuted} />
                <Text style={ad.metaText}>{article.authorName}</Text>
              </View>
            )}
            {article.publishedAt && (
              <View style={ad.metaItem}>
                <Feather name="calendar" size={14} color={Colors.textMuted} />
                <Text style={ad.metaText}>{new Date(article.publishedAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}</Text>
              </View>
            )}
          </View>
        </LinearGradient>

        {/* Content Section */}
        <View style={[ad.bodyCard, Shadow.sm]}>
          <RichBlogContent content={fullContent} color={articleColor} />
        </View>

        {/* Key Points */}
        {keyPoints.length > 0 && (
          <View style={ad.keyPointsSection}>
            <Text style={ad.sectionTitle}>Key Takeaways</Text>
            {keyPoints.map((point, idx) => (
              <View key={idx} style={ad.keyPointItem}>
                <View style={[ad.keyPointBullet, { backgroundColor: articleColor }]}>
                  <Text style={ad.keyPointNumber}>{idx + 1}</Text>
                </View>
                <Text style={ad.keyPointText}>{point}</Text>
              </View>
            ))}
          </View>
        )}


      </ScrollView>
    </View>
  );
}

const ad = StyleSheet.create({
  progressWrap: {
    paddingHorizontal: Space.s14,
    paddingTop: Space.s10,
    paddingBottom: Space.s6,
    backgroundColor: Colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: Colors.grey100,
  },
  progressTrack: { flex: 1, height: 3, backgroundColor: Colors.grey100, borderRadius: 1.5, overflow: 'hidden' },
  progressBar: { height: '100%', borderRadius: 1.5 },
  
  header: { 
    borderRadius: Radius.xl, 
    padding: Space.s20, 
    marginHorizontal: Space.s20,
    marginTop: Space.s14,
    marginBottom: Space.s12,
    backgroundColor: Colors.bgCard,
  },
  categoryPill: { 
    alignSelf: 'flex-start', 
    borderRadius: Radius.full, 
    paddingHorizontal: Space.s10, 
    paddingVertical: Space.s5, 
    marginBottom: Space.s12,
    backgroundColor: Colors.grey100,
    borderWidth: 1,
    borderColor: Colors.grey200
  },
  categoryTxt: { ...Type.l3, fontWeight: '600' },
  title: { ...Type.d2, color: Colors.textOnLight, marginBottom: Space.s10, lineHeight: 32 },
  summary: { ...Type.b2, color: Colors.grey700, lineHeight: 21, marginBottom: Space.s12 },
  
  metaSection: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: Space.s16, 
    marginTop: Space.s14,
    paddingTop: Space.s14,
    borderTopWidth: 1,
    borderTopColor: Colors.grey100
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: Space.s6 },
  metaText: { ...Type.b3, color: Colors.textMuted },
  metaText: { ...Type.b3, color: Colors.textMuted },
  
  bodyCard: { 
    backgroundColor: Colors.bgCard, 
    borderRadius: Radius.xl, 
    padding: Space.s20,
    marginHorizontal: Space.s20,
    marginBottom: Space.s16
  },
  sectionTitle: { ...Type.l1, color: Colors.textOnLight, marginBottom: Space.s12, fontWeight: '600' },
  bodyText: { ...Type.b2, color: Colors.grey700, lineHeight: 24 },
  
  keyPointsSection: { 
    marginHorizontal: Space.s20, 
    marginBottom: Space.s16,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    padding: Space.s20,
    ...Shadow.sm
  },
  keyPointItem: { 
    flexDirection: 'row', 
    gap: Space.s12, 
    marginBottom: Space.s12,
    alignItems: 'flex-start'
  },
  keyPointBullet: { 
    width: 32, 
    height: 32, 
    borderRadius: 16, 
    alignItems: 'center', 
    justifyContent: 'center',
    marginTop: 2
  },
  keyPointNumber: { ...Type.l2, color: Colors.textPrimary, fontWeight: '700' },
  keyPointText: { ...Type.b2, color: Colors.grey700, flex: 1, paddingTop: 4, lineHeight: 20 }
});

export function CommunityGuidelinesScreen({ navigation }) {
  const guidelines = [
    'Keep all comments respectful and supportive.',
    'Do not share personal contact details or sensitive medical identifiers.',
    'Community feedback is not a diagnosis. Consult a dermatologist for treatment decisions.',
    'Report harmful or misleading posts to keep the space safe for everyone.',
  ];

  return (
    <View style={{ flex: 1, backgroundColor: Colors.grey50 }}>
      <StatusBar barStyle="light-content" />
      <ScreenHeader title="Community Guidelines" onBack={() => navigation.goBack()} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: Space.s20, paddingBottom: Space.s48 }}>
        <View style={[cg.hero, Shadow.sm]}>
          <Feather name="shield" size={20} color={Colors.primary} />
          <Text style={cg.heroTitle}>A safe, patient-first space</Text>
          <Text style={cg.heroSub}>Follow these rules to keep conversations helpful, private, and medically responsible.</Text>
        </View>

        {guidelines.map((rule, idx) => (
          <View key={idx} style={[cg.ruleCard, Shadow.sm]}>
            <View style={cg.ruleIndex}><Text style={cg.ruleIndexTxt}>{idx + 1}</Text></View>
            <Text style={cg.ruleText}>{rule}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const cg = StyleSheet.create({
  hero: { backgroundColor: Colors.bgCard, borderRadius: Radius.xl, padding: Space.s20, gap: Space.s8, marginBottom: Space.s12 },
  heroTitle: { ...Type.d4, color: Colors.textOnLight },
  heroSub: { ...Type.b2, color: Colors.textMuted, lineHeight: 20 },
  ruleCard: { flexDirection: 'row', alignItems: 'flex-start', gap: Space.s12, backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Space.s16, marginBottom: Space.s10 },
  ruleIndex: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.primaryDim, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  ruleIndexTxt: { ...Type.l3, color: Colors.primary },
  ruleText: { ...Type.b2, color: Colors.grey700, lineHeight: 20, flex: 1 },
});

// ═════════════════════════════════════════════════════════════════════════════
// COMMUNITY SCREEN
// ═════════════════════════════════════════════════════════════════════════════

export function CommunityScreen({ navigation }) {
  const { user } = useAuth();
  const currentPatientId = String(user?._id || '');
  const [composer, setComposer] = useState({ diagnosis: '', note: '', image: null });
  const [textModalVisible, setTextModalVisible] = useState(false);
  const [mediaModalVisible, setMediaModalVisible] = useState(false);
  const [commentDrafts, setCommentDrafts] = useState({});
  const [posts, setPosts] = useState([]);
  const [isLoading, setLoading] = useState(true);
  const [savedPosts, setSavedPosts] = useState(new Set());
  const [expandedComments, setExpandedComments] = useState(new Set());
  const [commentLikes, setCommentLikes] = useState(new Set());
  const [replyingTo, setReplyingTo] = useState(null);
  const [editModal, setEditModal] = useState({
    visible: false,
    type: 'post',
    postId: '',
    commentId: '',
    text: '',
  });

  const profileName = user?.profile?.fullName || user?.name || user?.email || 'Patient';
  const profileInitial = String(profileName || 'P').trim().charAt(0).toUpperCase() || 'P';
  const profileAvatarUrl = String(user?.profile?.avatarUrl || user?.avatarUrl || '').trim();

  const formatRelativeTime = (dateStr) => {
    const date = new Date(dateStr);
    const diffMs = Date.now() - date.getTime();
    const mins = Math.max(1, Math.floor(diffMs / 60000));
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hr ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  };

  const normalizePosts = (rawPosts = []) => rawPosts.map((post) => {
    const authorId = String(post.patientId || '');
    const resolvedPostAvatar = String(post.authorSnapshot?.avatarUrl || '').trim()
      || (authorId === currentPatientId ? profileAvatarUrl : '');

    return {
      id: post._id,
      authorId,
      author: post.authorSnapshot?.name || 'Patient',
      avatarUrl: resolvedPostAvatar,
    time: formatRelativeTime(post.createdAt),
    isEdited: !!post.editedAt,
    location: post.location || '',
    diagnosis: post.diagnosis,
    note: post.note,
    image: post.imageUrl,
    likes: post.likeCount || 0,
    likedByMe: !!post.likedByMe,
    saves: post.saveCount || 0,
    savedByMe: !!post.savedByMe,
    comments: (post.comments || []).map((comment) => {
      const commentAuthorId = String(comment.patientId || '');
      const resolvedCommentAvatar = String(comment.authorSnapshot?.avatarUrl || '').trim()
        || (commentAuthorId === currentPatientId ? profileAvatarUrl : '');

      return {
      id: comment._id,
      authorId: commentAuthorId,
      author: comment.authorSnapshot?.name || 'Patient',
      avatarUrl: resolvedCommentAvatar,
      text: comment.body,
      isEdited: !!comment.editedAt,
      likedByMe: !!comment.likedByMe,
      replies: (comment.replies || []).map((reply) => {
        const replyAuthorId = String(reply.patientId || '');
        const resolvedReplyAvatar = String(reply.authorSnapshot?.avatarUrl || '').trim()
          || (replyAuthorId === currentPatientId ? profileAvatarUrl : '');

        return {
        id: reply._id,
        authorId: replyAuthorId,
        author: reply.authorSnapshot?.name || 'Patient',
        avatarUrl: resolvedReplyAvatar,
        text: reply.body,
        isEdited: !!reply.editedAt,
        likedByMe: !!reply.likedByMe,
      };
      }),
    };
    }),
  };
  });

  const loadFeed = async () => {
    setLoading(true);
    try {
      const response = await communityApi.listPosts();
      const normalized = normalizePosts(response.posts || []);
      setPosts(normalized);
      setSavedPosts(new Set(normalized.filter((item) => item.savedByMe).map((item) => item.id)));
      const likedCommentIds = [];
      normalized.forEach((post) => {
        (post.comments || []).forEach((comment) => {
          if (comment.likedByMe) likedCommentIds.push(comment.id);
          (comment.replies || []).forEach((reply) => {
            if (reply.likedByMe) likedCommentIds.push(reply.id);
          });
        });
      });
      setCommentLikes(new Set(likedCommentIds));
    } catch (error) {
      Alert.alert('Community unavailable', error?.message || 'Could not load posts right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeed();
  }, []);

  const pickImage = async (source) => {
    try {
      const permission = source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        return null;
      }

      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: true, aspect: [4, 3] })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.8, allowsEditing: true, aspect: [4, 3] });

      if (!result.canceled && result.assets?.[0]?.uri) {
        const uri = result.assets[0].uri;
        setComposer(prev => ({ ...prev, image: uri }));
        return uri;
      }
      return null;
    } catch {
      Alert.alert('Image unavailable', 'Could not open the image picker right now.');
      return null;
    }
  };

  const openTextComposer = () => {
    setTextModalVisible(true);
  };

  const openCameraComposer = () => {
    setMediaModalVisible(true);
  };

  const addPost = async () => {
    const hasText = !!String(composer.note || '').trim();
    if (!hasText) {
      Alert.alert('Write something', 'Please add text to your post.');
      return;
    }

    try {
      await communityApi.createPost({
        imageUri: composer.image || '',
        diagnosis: composer.diagnosis.trim() || '',
        note: composer.note.trim(),
        location: '',
      });

      setComposer({ diagnosis: '', note: '', image: null });
      setTextModalVisible(false);
      setMediaModalVisible(false);
      await loadFeed();
      Alert.alert('Posted!', 'Your post has been shared with the community.');
    } catch (error) {
      Alert.alert('Post failed', error?.message || 'Could not publish your post.');
    }
  };

  const addComment = async (postId) => {
    const text = (commentDrafts[postId] || '').trim();
    if (!text) return;

    try {
      await communityApi.addComment(postId, text);
      setCommentDrafts(prev => ({ ...prev, [postId]: '' }));
      await loadFeed();
    } catch (error) {
      Alert.alert('Comment failed', error?.message || 'Could not add your comment.');
    }
  };

  const addReply = async (postId, commentId) => {
    const text = (commentDrafts[`reply_${commentId}`] || '').trim();
    if (!text) return;

    try {
      await communityApi.addReply(postId, commentId, text);
      setCommentDrafts(prev => ({ ...prev, [`reply_${commentId}`]: '' }));
      setReplyingTo(null);
      await loadFeed();
    } catch (error) {
      Alert.alert('Reply failed', error?.message || 'Could not add your reply.');
    }
  };

  const openEdit = ({ type, postId, commentId = '', text = '' }) => {
    setEditModal({
      visible: true,
      type,
      postId: String(postId || ''),
      commentId: String(commentId || ''),
      text: String(text || ''),
    });
  };

  const saveEdit = async () => {
    const nextText = String(editModal.text || '').trim();
    if (!nextText) {
      Alert.alert('Edit required', 'Please enter some text before saving.');
      return;
    }

    try {
      if (editModal.type === 'post') {
        await communityApi.updatePost(editModal.postId, { note: nextText });
      } else {
        await communityApi.updateComment(editModal.postId, editModal.commentId, nextText);
      }
      setEditModal({ visible: false, type: 'post', postId: '', commentId: '', text: '' });
      await loadFeed();
    } catch (error) {
      Alert.alert('Edit failed', error?.message || 'Could not save changes.');
    }
  };

  const deleteOwnedItem = ({ type, postId, commentId = '' }) => {
    const isPost = type === 'post';
    Alert.alert(
      isPost ? 'Delete post' : 'Delete comment',
      isPost ? 'Are you sure you want to delete this post?' : 'Are you sure you want to delete this comment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (isPost) {
                await communityApi.deletePost(postId);
              } else {
                await communityApi.deleteComment(postId, commentId);
              }
              await loadFeed();
            } catch (error) {
              Alert.alert('Delete failed', error?.message || 'Could not delete item.');
            }
          },
        },
      ]
    );
  };

  const toggleLike = async (post) => {
    try {
      if (post.likedByMe) {
        await communityApi.unlikePost(post.id);
      } else {
        await communityApi.likePost(post.id);
      }
      setPosts(prev => prev.map(item => {
        if (item.id !== post.id) return item;
        const likedByMe = !item.likedByMe;
        return {
          ...item,
          likedByMe,
          likes: likedByMe ? item.likes + 1 : Math.max(0, item.likes - 1),
        };
      }));
    } catch (error) {
      Alert.alert('Like failed', error?.message || 'Could not update like.');
    }
  };

  const toggleComments = (postId) => {
    setExpandedComments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
      }
      return newSet;
    });
  };

  const toggleCommentLike = async (postId, commentId) => {
    const currentlyLiked = commentLikes.has(commentId);
    try {
      if (currentlyLiked) {
        await communityApi.unlikeComment(postId, commentId);
      } else {
        await communityApi.likeComment(postId, commentId);
      }
      setCommentLikes(prev => {
        const newSet = new Set(prev);
        if (currentlyLiked) {
          newSet.delete(commentId);
        } else {
          newSet.add(commentId);
        }
        return newSet;
      });
    } catch (error) {
      Alert.alert('Action failed', error?.message || 'Could not update comment like.');
    }
  };

  const toggleSave = async (postId) => {
    const currentlySaved = savedPosts.has(postId);
    try {
      if (currentlySaved) {
        await communityApi.unsavePost(postId);
      } else {
        await communityApi.savePost(postId);
      }
      setSavedPosts(prev => {
        const newSet = new Set(prev);
        if (currentlySaved) {
          newSet.delete(postId);
        } else {
          newSet.add(postId);
        }
        return newSet;
      });
      setPosts(prev => prev.map(item => {
        if (item.id !== postId) return item;
        return {
          ...item,
          saves: currentlySaved ? Math.max(0, item.saves - 1) : item.saves + 1,
          savedByMe: !currentlySaved,
        };
      }));
    } catch (error) {
      Alert.alert('Save failed', error?.message || 'Could not update saved post.');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.grey50 }}>
      <StatusBar barStyle="light-content" />
      <ScreenHeader
        title="Community"
        onBack={() => navigation.goBack()}
        rightIcon="message-square"
        rightLabel="Community guidelines"
        onRight={() => navigation.navigate('CommunityGuidelines')}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: Space.s20, paddingBottom: Space.s48 }}>
        <View style={cm.hero}>
          <View style={cm.heroBadge}>
            <Feather name="users" size={16} color={Colors.primary} />
            <Text style={cm.heroBadgeText}>Patient support community</Text>
          </View>
          <Text style={cm.heroTitle}>Share progress photos, diagnosis notes, and support each other.</Text>
          <Text style={cm.heroSub}>Posts are visible to other patients. Keep comments respectful and remember that community feedback is not a medical diagnosis.</Text>
        </View>

        <View style={[cm.inlineComposer, Shadow.sm]}>
          <View style={cm.inlineAvatar}>
            {profileAvatarUrl ? (
              <Image source={{ uri: profileAvatarUrl }} style={cm.inlineAvatarImage} resizeMode="cover" />
            ) : (
              <Text style={cm.inlineAvatarText}>{profileInitial}</Text>
            )}
          </View>
          <TouchableOpacity
            style={cm.inlinePlaceholderWrap}
            onPress={openTextComposer}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Write community post"
          >
            <Text style={cm.inlinePlaceholder}>{composer.note?.trim() ? composer.note : 'Share a post with the community...'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={cm.inlineCameraBtn}
            onPress={openCameraComposer}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Add photo to community post"
          >
            <Feather name="camera" size={18} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={cm.inlineSendBtn}
            onPress={addPost}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Post to community"
          >
            <Feather name="send" size={16} color={Colors.primaryOnDark} />
          </TouchableOpacity>
        </View>

        <Modal
          visible={textModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setTextModalVisible(false)}
        >
          <Pressable style={cm.modalBackdrop} onPress={() => setTextModalVisible(false)}>
            <Pressable style={[cm.modalCard, Shadow.lg]} onPress={() => {}}>
              <Text style={cm.sectionTitle}>Write post</Text>

              <TextInput
                value={composer.note}
                onChangeText={note => setComposer(prev => ({ ...prev, note }))}
                placeholder="What would you like to share with the community?"
                placeholderTextColor={Colors.textMuted}
                multiline
                style={[cm.input, cm.textArea]}
              />

              <View style={cm.modalActions}>
                <Button label="Cancel" variant="ghost" onPress={() => setTextModalVisible(false)} />
                <Button label="Done" onPress={() => setTextModalVisible(false)} />
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        <Modal
          visible={mediaModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setMediaModalVisible(false)}
        >
          <Pressable style={cm.modalBackdrop} onPress={() => setMediaModalVisible(false)}>
            <Pressable style={[cm.modalCard, Shadow.lg]} onPress={() => {}}>
              <Text style={cm.sectionTitle}>Add photo</Text>

              <View style={cm.imagePickerRow}>
                <TouchableOpacity style={cm.imagePickerBtn} onPress={() => pickImage('library')} activeOpacity={0.78} accessibilityRole="button" accessibilityLabel="Choose image from library">
                  <Feather name="image" size={18} color={Colors.primary} />
                  <Text style={cm.imagePickerText}>Choose photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={cm.imagePickerBtn} onPress={() => pickImage('camera')} activeOpacity={0.78} accessibilityRole="button" accessibilityLabel="Take a photo">
                  <Feather name="camera" size={18} color={Colors.primary} />
                  <Text style={cm.imagePickerText}>Use camera</Text>
                </TouchableOpacity>
              </View>

              <View style={cm.previewBox}>
                {composer.image ? (
                  <View style={cm.previewImageWrap}>
                    <Image source={{ uri: composer.image }} style={cm.previewImage} />
                    <Text style={cm.previewLabel}>Photo attached</Text>
                  </View>
                ) : (
                  <View style={cm.previewEmpty}>
                    <Feather name="upload" size={18} color={Colors.textMuted} />
                    <Text style={cm.previewEmptyText}>Add a lesion photo to start your post</Text>
                  </View>
                )}
              </View>

              <TextInput
                value={composer.diagnosis}
                onChangeText={diagnosis => setComposer(prev => ({ ...prev, diagnosis }))}
                placeholder="Diagnosis (optional)"
                placeholderTextColor={Colors.textMuted}
                style={cm.input}
              />

              <View style={cm.modalActions}>
                <Button label="Cancel" variant="ghost" onPress={() => setMediaModalVisible(false)} />
                <Button label="Done" onPress={() => setMediaModalVisible(false)} />
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        <Modal
          visible={editModal.visible}
          transparent
          animationType="fade"
          onRequestClose={() => setEditModal({ visible: false, type: 'post', postId: '', commentId: '', text: '' })}
        >
          <Pressable style={cm.modalBackdrop} onPress={() => setEditModal({ visible: false, type: 'post', postId: '', commentId: '', text: '' })}>
            <Pressable style={[cm.modalCard, Shadow.lg]} onPress={() => {}}>
              <Text style={cm.sectionTitle}>{editModal.type === 'post' ? 'Edit post' : 'Edit comment'}</Text>
              <TextInput
                value={editModal.text}
                onChangeText={text => setEditModal(prev => ({ ...prev, text }))}
                placeholder={editModal.type === 'post' ? 'Update your post...' : 'Update your comment...'}
                placeholderTextColor={Colors.textMuted}
                multiline
                style={[cm.input, cm.textArea]}
              />
              <View style={cm.modalActions}>
                <Button label="Cancel" variant="ghost" onPress={() => setEditModal({ visible: false, type: 'post', postId: '', commentId: '', text: '' })} />
                <Button label="Save" onPress={saveEdit} />
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        <View style={{ marginTop: Space.s24 }}>
          <SectionHeader title="Community feed" action="Guidelines" onAction={() => navigation.navigate('CommunityGuidelines')} />

          {isLoading && (
            <View style={{ paddingVertical: Space.s16, alignItems: 'center' }}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          )}

          {!isLoading && posts.map(post => (
            <View key={post.id} style={[cm.postCard, Shadow.sm]}>
              <View style={cm.postHeader}>
                <View style={cm.avatar}>
                  {post.avatarUrl ? (
                    <Image source={{ uri: post.avatarUrl }} style={cm.avatarImage} resizeMode="cover" />
                  ) : (
                    <Text style={cm.avatarText}>{post.author[0]}</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={cm.postAuthor}>{post.author}</Text>
                  <View style={cm.metaRowInline}>
                    <Text style={cm.postMeta}>{post.time}</Text>
                    {post.isEdited && <Text style={cm.editedText}>edited</Text>}
                  </View>
                </View>
                {post.authorId === currentPatientId && (
                  <View style={cm.ownerActionsInline}>
                    <TouchableOpacity
                      style={cm.ownerActionBtn}
                      onPress={() => openEdit({ type: 'post', postId: post.id, text: post.note })}
                      activeOpacity={0.75}
                      accessibilityRole="button"
                      accessibilityLabel="Edit your post"
                    >
                      <Feather name="edit-2" size={13} color={Colors.textMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={cm.ownerActionBtn}
                      onPress={() => deleteOwnedItem({ type: 'post', postId: post.id })}
                      activeOpacity={0.75}
                      accessibilityRole="button"
                      accessibilityLabel="Delete your post"
                    >
                      <Feather name="trash-2" size={13} color={Colors.riskHigh} />
                    </TouchableOpacity>
                  </View>
                )}
                <View style={cm.metaBadge}>
                  <Feather name="shield" size={11} color={Colors.primary} />
                  <Text style={cm.metaBadgeText}>Shared safely</Text>
                </View>
              </View>

              <Text style={cm.postNote}>{post.note}</Text>

              {!!post.image && (
                <View style={cm.postImageWrap}>
                  <Image source={{ uri: post.image }} style={cm.postImage} />
                  {!!post.diagnosis && <Text style={cm.postDiagnosis}>{post.diagnosis}</Text>}
                </View>
              )}

              <View style={cm.postStats}>
                <TouchableOpacity
                  style={cm.statPill}
                  onPress={() => toggleLike(post)}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={post.likedByMe ? 'Unlike post' : 'Like post'}
                >
                  <Ionicons
                    name={post.likedByMe ? 'heart' : 'heart-outline'}
                    size={13}
                    color={post.likedByMe ? Colors.riskHigh : Colors.textMuted}
                  />
                  <Text style={cm.statText}>{post.likes}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={cm.statPill}
                  onPress={() => toggleComments(post.id)}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel="View comments"
                >
                  <Feather name="message-circle" size={12} color={Colors.primary} />
                  <Text style={cm.statText}>{post.comments.length}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={cm.statPill}
                  onPress={() => toggleSave(post.id)}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={savedPosts.has(post.id) ? 'Unsave post' : 'Save post'}
                >
                  <Ionicons
                    name={savedPosts.has(post.id) ? 'bookmark' : 'bookmark-outline'}
                    size={12}
                    color={savedPosts.has(post.id) ? '#FFC107' : Colors.textMuted}
                  />
                  <Text style={cm.statText}>{post.saves}</Text>
                </TouchableOpacity>
              </View>

              {expandedComments.has(post.id) && (
                <>
                  <View style={cm.commentsWrap}>
                    {post.comments.length > 0 ? (
                      post.comments.map(comment => (
                        <View key={comment.id} style={cm.commentRow}>
                          <View style={cm.commentAvatar}>
                            {comment.avatarUrl ? (
                              <Image source={{ uri: comment.avatarUrl }} style={cm.commentAvatarImage} resizeMode="cover" />
                            ) : (
                              <Text style={cm.commentAvatarText}>{comment.author[0]}</Text>
                            )}
                          </View>
                          <View style={{ flex: 1 }}>
                            <View style={cm.commentBubble}>
                              <View style={cm.metaRowInline}>
                                <Text style={cm.commentAuthor}>{comment.author}</Text>
                                {comment.isEdited && <Text style={cm.editedText}>edited</Text>}
                              </View>
                              <Text style={cm.commentText}>{comment.text}</Text>
                            </View>
                            <View style={cm.commentActions}>
                              <TouchableOpacity
                                onPress={() => toggleCommentLike(post.id, comment.id)}
                                style={cm.commentActionBtn}
                                activeOpacity={0.75}
                                accessibilityRole="button"
                                accessibilityLabel={commentLikes.has(comment.id) ? 'Unlike comment' : 'Like comment'}
                              >
                                <Ionicons
                                  name={commentLikes.has(comment.id) ? 'heart' : 'heart-outline'}
                                  size={11}
                                  color={commentLikes.has(comment.id) ? Colors.riskHigh : Colors.textMuted}
                                />
                                <Text style={cm.commentActionText}>Like</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                                style={cm.commentActionBtn}
                                activeOpacity={0.75}
                                accessibilityRole="button"
                                accessibilityLabel="Reply to comment"
                              >
                                <Ionicons name="arrow-undo" size={11} color={Colors.textMuted} />
                                <Text style={cm.commentActionText}>Reply</Text>
                              </TouchableOpacity>
                              {comment.authorId === currentPatientId && (
                                <>
                                  <TouchableOpacity
                                    onPress={() => openEdit({ type: 'comment', postId: post.id, commentId: comment.id, text: comment.text })}
                                    style={cm.commentActionBtn}
                                    activeOpacity={0.75}
                                    accessibilityRole="button"
                                    accessibilityLabel="Edit your comment"
                                  >
                                    <Feather name="edit-2" size={11} color={Colors.textMuted} />
                                    <Text style={cm.commentActionText}>Edit</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    onPress={() => deleteOwnedItem({ type: 'comment', postId: post.id, commentId: comment.id })}
                                    style={cm.commentActionBtn}
                                    activeOpacity={0.75}
                                    accessibilityRole="button"
                                    accessibilityLabel="Delete your comment"
                                  >
                                    <Feather name="trash-2" size={11} color={Colors.riskHigh} />
                                    <Text style={cm.commentActionText}>Delete</Text>
                                  </TouchableOpacity>
                                </>
                              )}
                            </View>
                            {replyingTo === comment.id && (
                              <View style={cm.replyComposer}>
                                <TextInput
                                  value={commentDrafts[`reply_${comment.id}`] || ''}
                                  onChangeText={text => setCommentDrafts(prev => ({ ...prev, [`reply_${comment.id}`]: text }))}
                                  placeholder="Write a reply..."
                                  placeholderTextColor={Colors.textMuted}
                                  style={cm.replyInput}
                                />
                                <TouchableOpacity
                                  onPress={() => addReply(post.id, comment.id)}
                                  style={cm.replyButton}
                                  activeOpacity={0.78}
                                  accessibilityRole="button"
                                  accessibilityLabel="Send reply"
                                >
                                  <Feather name="send" size={14} color={Colors.primaryOnDark} />
                                </TouchableOpacity>
                              </View>
                            )}
                            {comment.replies && comment.replies.length > 0 && (
                              <View style={cm.repliesContainer}>
                                {comment.replies.map(reply => (
                                  <View key={reply.id} style={cm.replyItem}>
                                    <View style={cm.replyAvatar}>
                                      {reply.avatarUrl ? (
                                        <Image source={{ uri: reply.avatarUrl }} style={cm.replyAvatarImage} resizeMode="cover" />
                                      ) : (
                                        <Text style={cm.replyAvatarText}>{reply.author[0]}</Text>
                                      )}
                                    </View>
                                    <View style={{ flex: 1 }}>
                                      <View style={cm.replyBubble}>
                                        <View style={cm.metaRowInline}>
                                          <Text style={cm.replyAuthor}>{reply.author}</Text>
                                          {reply.isEdited && <Text style={cm.editedText}>edited</Text>}
                                        </View>
                                        <Text style={cm.replyText}>{reply.text}</Text>
                                      </View>
                                      <View style={[cm.commentActions, { marginTop: Space.s4 }]}> 
                                        <TouchableOpacity
                                          onPress={() => toggleCommentLike(post.id, reply.id)}
                                          style={cm.commentActionBtn}
                                          activeOpacity={0.75}
                                          accessibilityRole="button"
                                          accessibilityLabel={commentLikes.has(reply.id) ? 'Unlike reply' : 'Like reply'}
                                        >
                                          <Ionicons
                                            name={commentLikes.has(reply.id) ? 'heart' : 'heart-outline'}
                                            size={11}
                                            color={commentLikes.has(reply.id) ? Colors.riskHigh : Colors.textMuted}
                                          />
                                          <Text style={cm.commentActionText}>Like</Text>
                                        </TouchableOpacity>
                                        {reply.authorId === currentPatientId && (
                                          <>
                                            <TouchableOpacity
                                              onPress={() => openEdit({ type: 'comment', postId: post.id, commentId: reply.id, text: reply.text })}
                                              style={cm.commentActionBtn}
                                              activeOpacity={0.75}
                                              accessibilityRole="button"
                                              accessibilityLabel="Edit your reply"
                                            >
                                              <Feather name="edit-2" size={11} color={Colors.textMuted} />
                                              <Text style={cm.commentActionText}>Edit</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                              onPress={() => deleteOwnedItem({ type: 'comment', postId: post.id, commentId: reply.id })}
                                              style={cm.commentActionBtn}
                                              activeOpacity={0.75}
                                              accessibilityRole="button"
                                              accessibilityLabel="Delete your reply"
                                            >
                                              <Feather name="trash-2" size={11} color={Colors.riskHigh} />
                                              <Text style={cm.commentActionText}>Delete</Text>
                                            </TouchableOpacity>
                                          </>
                                        )}
                                      </View>
                                    </View>
                                  </View>
                                ))}
                              </View>
                            )}
                          </View>
                        </View>
                      ))
                    ) : (
                      <Text style={cm.noCommentsText}>No comments yet. Be the first to comment!</Text>
                    )}
                  </View>

                  <View style={cm.commentComposer}>
                    <TextInput
                      value={commentDrafts[post.id] || ''}
                      onChangeText={text => setCommentDrafts(prev => ({ ...prev, [post.id]: text }))}
                      placeholder="Leave a supportive comment"
                      placeholderTextColor={Colors.textMuted}
                      style={cm.commentInput}
                    />
                    <TouchableOpacity
                      onPress={() => addComment(post.id)}
                      style={cm.commentButton}
                      activeOpacity={0.78}
                      accessibilityRole="button"
                      accessibilityLabel="Send comment"
                    >
                      <Feather name="send" size={16} color={Colors.primaryOnDark} />
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const cm = StyleSheet.create({
  hero: { backgroundColor: Colors.bgCard, borderRadius: Radius.xl, padding: Space.s20, marginBottom: Space.s16, ...Shadow.sm },
  heroBadge: { flexDirection: 'row', alignItems: 'center', gap: Space.s8, alignSelf: 'flex-start', backgroundColor: Colors.primaryDim, paddingHorizontal: Space.s12, paddingVertical: Space.s8, borderRadius: Radius.full, marginBottom: Space.s12 },
  heroBadgeText: { ...Type.l2, color: Colors.primary },
  heroTitle: { ...Type.d4, color: Colors.textOnLight, marginBottom: Space.s8 },
  heroSub: { ...Type.b2, color: Colors.textMuted, lineHeight: 20 },
  composer: { backgroundColor: Colors.bgCard, borderRadius: Radius.xl, padding: Space.s20, marginBottom: Space.s8 },
  inlineComposer: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    paddingHorizontal: Space.s12,
    minHeight: 62,
    marginBottom: Space.s8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.s10,
  },
  inlineAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.primaryDim, alignItems: 'center', justifyContent: 'center' },
  inlineAvatarImage: { width: '100%', height: '100%', borderRadius: 19 },
  inlineAvatarText: { ...Type.l1, color: Colors.primary },
  inlinePlaceholderWrap: {
    flex: 1,
    minHeight: 38,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.grey100,
    backgroundColor: Colors.grey50,
    paddingHorizontal: Space.s14,
    justifyContent: 'center',
  },
  inlinePlaceholder: { ...Type.b2, color: Colors.textMuted, marginLeft: Space.s16, lineHeight: 16 },
  inlineCameraBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.primaryDim, alignItems: 'center', justifyContent: 'center' },
  inlineSendBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { ...Type.d4, color: Colors.textOnLight, marginBottom: Space.s12 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(5,14,31,0.45)', justifyContent: 'center', paddingHorizontal: Space.s20 },
  modalCard: { backgroundColor: Colors.bgCard, borderRadius: Radius.xl, padding: Space.s20 },
  imagePickerRow: { flexDirection: 'row', gap: Space.s8, marginBottom: Space.s12 },
  imagePickerBtn: { flex: 1, minHeight: 44, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.grey100, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Space.s8, backgroundColor: Colors.grey50 },
  imagePickerText: { ...Type.l2, color: Colors.primary },
  previewBox: { minHeight: 120, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.grey100, backgroundColor: Colors.grey50, marginBottom: Space.s12, overflow: 'hidden' },
  previewImageWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Space.s8, padding: Space.s16 },
  previewImage: { width: '100%', height: 180, borderRadius: Radius.lg },
  previewLabel: { ...Type.l2, color: Colors.primary },
  previewEmpty: { flex: 1, minHeight: 120, alignItems: 'center', justifyContent: 'center', gap: Space.s8, padding: Space.s16 },
  previewEmptyText: { ...Type.b3, color: Colors.textMuted, textAlign: 'center' },
  input: { backgroundColor: Colors.grey50, borderWidth: 1, borderColor: Colors.grey100, borderRadius: Radius.md, paddingHorizontal: Space.s16, paddingVertical: Space.s12, color: Colors.textOnLight, ...Type.b2, marginBottom: Space.s12 },
  textArea: { minHeight: 96, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Space.s8, marginTop: Space.s8 },
  postCard: { backgroundColor: Colors.bgCard, borderRadius: Radius.xl, padding: Space.s16, marginBottom: Space.s16 },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: Space.s12, marginBottom: Space.s12 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primaryDim, alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: '100%', height: '100%', borderRadius: 20 },
  avatarText: { ...Type.l1, color: Colors.primary },
  postAuthor: { ...Type.l1, color: Colors.textOnLight },
  metaRowInline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Space.s8 },
  postMeta: { ...Type.b3, color: Colors.textMuted },
  editedText: { ...Type.l3, color: Colors.riskLow, fontStyle: 'italic' },
  ownerActionsInline: { flexDirection: 'row', alignItems: 'center', gap: Space.s4 },
  ownerActionBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.grey50 },
  metaBadge: { flexDirection: 'row', alignItems: 'center', gap: Space.s4, backgroundColor: Colors.primaryDim, borderRadius: Radius.full, paddingHorizontal: Space.s8, paddingVertical: Space.s4 },
  metaBadgeText: { ...Type.l3, color: Colors.primary },
  postImageWrap: { borderRadius: Radius.lg, overflow: 'hidden', marginBottom: Space.s12 },
  postImage: { width: '100%', height: 200, backgroundColor: Colors.grey50 },
  postDiagnosis: { ...Type.l1, color: Colors.textOnLight, paddingTop: Space.s12, paddingHorizontal: Space.s12, paddingBottom: Space.s4, backgroundColor: Colors.grey50 },
  postNote: { ...Type.b2, color: Colors.textMuted, lineHeight: 20, marginBottom: Space.s12 },
  postStats: { flexDirection: 'row', gap: Space.s8, marginBottom: Space.s12 },
  statPill: { flexDirection: 'row', alignItems: 'center', gap: Space.s4, backgroundColor: Colors.grey50, borderRadius: Radius.full, paddingHorizontal: Space.s10, paddingVertical: Space.s6 },
  statText: { ...Type.l3, color: Colors.textMuted },
  commentsWrap: { gap: Space.s8, marginBottom: Space.s12 },
  commentRow: { flexDirection: 'row', gap: Space.s8, alignItems: 'flex-start' },
  commentAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.grey100, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  commentAvatarImage: { width: '100%', height: '100%', borderRadius: 14 },
  commentAvatarText: { ...Type.l3, color: Colors.textMuted },
  commentBubble: { flex: 1, backgroundColor: Colors.grey50, borderRadius: Radius.md, padding: Space.s10 },
  commentAuthor: { ...Type.l2, color: Colors.textOnLight, marginBottom: 2 },
  commentText: { ...Type.b3, color: Colors.textMuted, lineHeight: 18 },
  commentActions: { flexDirection: 'row', gap: Space.s12, marginTop: Space.s6 },
  commentActionBtn: { flexDirection: 'row', alignItems: 'center', gap: Space.s4 },
  commentActionText: { ...Type.l3, color: Colors.textMuted },
  noCommentsText: { ...Type.b3, color: Colors.textMuted, textAlign: 'center', paddingVertical: Space.s12 },
  replyComposer: { flexDirection: 'row', gap: Space.s6, alignItems: 'center', marginTop: Space.s8, paddingLeft: Space.s36, backgroundColor: Colors.grey50, borderRadius: Radius.md, paddingHorizontal: Space.s12, paddingVertical: Space.s8 },
  replyInput: { flex: 1, minHeight: 36, color: Colors.textOnLight, ...Type.b3 },
  replyButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  repliesContainer: { marginTop: Space.s8, paddingLeft: Space.s24, gap: Space.s8 },
  replyItem: { flexDirection: 'row', gap: Space.s8, alignItems: 'flex-start' },
  replyAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.grey100, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  replyAvatarImage: { width: '100%', height: '100%', borderRadius: 14 },
  replyAvatarText: { ...Type.l3, color: Colors.textMuted },
  replyBubble: { flex: 1, backgroundColor: Colors.grey50, borderRadius: Radius.md, padding: Space.s10 },
  replyAuthor: { ...Type.l2, color: Colors.textOnLight, marginBottom: 2 },
  replyText: { ...Type.b3, color: Colors.textMuted, lineHeight: 18 },
  commentComposer: { flexDirection: 'row', gap: Space.s8, alignItems: 'center' },
  commentInput: { flex: 1, minHeight: 44, borderWidth: 1, borderColor: Colors.grey100, borderRadius: Radius.full, paddingHorizontal: Space.s16, color: Colors.textOnLight, backgroundColor: Colors.grey50, ...Type.b3 },
  commentButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
});
