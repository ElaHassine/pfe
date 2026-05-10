/**
 * ScanScreen.js
 * 
 * Main scanning interface:
 * 1. Select image (camera or gallery)
 * 2. Send to backend for analysis
 * 3. Display results with risk visualization
 * 4. Offer to save scan to history
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  ScrollView,
  Dimensions,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Camera from 'expo-camera';
import { analyzeImage, analyzeImageWithDrift } from '../services/analysisApi';
import { saveScan, getLastScan } from '../services/storage';

const { width } = Dimensions.get('window');

const ScanScreen = ({ route, navigation }) => {
  const { patientId } = route.params;

  const [imageUri, setImageUri] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const cameraRef = useRef(null);

  useEffect(() => {
    requestCameraPermissions();
  }, []);

  const requestCameraPermissions = async () => {
    const cameraStatus = await Camera.requestCameraPermissionsAsync();
    const mediaLibraryStatus =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!cameraStatus.granted || !mediaLibraryStatus.granted) {
      Alert.alert(
        'Permissions Required',
        'Camera and photo library access is needed to use this feature'
      );
    }
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: false,
        });
        setImageUri(photo.uri);
        setShowCameraModal(false);
      } catch (error) {
        Alert.alert('Error', 'Failed to take picture');
      }
    }
  };

  const pickFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.cancelled && result.assets && result.assets.length > 0) {
        setImageUri(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const analyzeImage_Handler = async () => {
    if (!imageUri) {
      Alert.alert('No Image', 'Please select an image first');
      return;
    }

    try {
      setAnalyzing(true);

      // Check if there's a previous scan for drift comparison
      const lastScan = await getLastScan(patientId);

      let result;
      if (lastScan && lastScan.features) {
        console.log('📊 Using drift analysis (previous scan found)');
        result = await analyzeImageWithDrift(imageUri, lastScan.features);
      } else {
        console.log('📊 Using simple analysis (first scan)');
        result = await analyzeImage(imageUri);
      }

      setAnalysisResult(result);
    } catch (error) {
      console.error('❌ Analysis failed:', error);
      Alert.alert('Analysis Failed', error.message || 'Unknown error');
    } finally {
      setAnalyzing(false);
    }
  };

  const saveScan_Handler = async () => {
    if (!analysisResult) return;

    try {
      setLoading(true);
      await saveScan(patientId, {
        image_uri: imageUri,
        prediction: analysisResult.prediction,
        confidence: analysisResult.confidence,
        abcd: analysisResult.abcd,
        features: analysisResult.features,
        risk_score: analysisResult.risk_score,
        drift: analysisResult.drift,
        drift_label: analysisResult.drift_label,
      });

      Alert.alert('Saved', 'Scan saved to history', [
        {
          text: 'View History',
          onPress: () => navigation.navigate('History', { patientId }),
        },
        {
          text: 'New Scan',
          onPress: () => {
            setImageUri(null);
            setAnalysisResult(null);
          },
        },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to save scan');
    } finally {
      setLoading(false);
    }
  };

  const resetScan = () => {
    setImageUri(null);
    setAnalysisResult(null);
  };

  // ===== Render: Initial State =====
  if (!imageUri) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={28} color="white" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Lesion Scan</Text>
            <Text style={styles.headerSubtitle}>Patient: {patientId}</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('History', { patientId })}>
            <Ionicons name="time" size={28} color="white" />
          </TouchableOpacity>
        </View>

        <View style={styles.imageSelectContainer}>
          <Ionicons name="camera-outline" size={80} color="#ccc" />
          <Text style={styles.selectText}>Select or Take an Image</Text>
          <Text style={styles.selectSubtext}>
            Take a clear photo of the lesion or select from gallery
          </Text>
        </View>

        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={styles.cameraBtn}
            onPress={() => setShowCameraModal(true)}
          >
            <Ionicons name="camera" size={24} color="white" />
            <Text style={styles.cameraBtnText}>Take Photo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.galleryBtn}
            onPress={pickFromGallery}
          >
            <Ionicons name="image" size={24} color="white" />
            <Text style={styles.galleryBtnText}>From Gallery</Text>
          </TouchableOpacity>
        </View>

        {/* Camera Modal */}
        <Modal
          visible={showCameraModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowCameraModal(false)}
        >
          <View style={styles.cameraContainer}>
            <Camera.Camera
              ref={cameraRef}
              style={styles.camera}
              type={Camera.CameraType.back}
            />

            <View style={styles.cameraControls}>
              <TouchableOpacity
                style={styles.cameraCancelBtn}
                onPress={() => setShowCameraModal(false)}
              >
                <Ionicons name="close" size={32} color="white" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cameraCaptureBtn}
                onPress={takePicture}
              >
                <View style={styles.captureCircle} />
              </TouchableOpacity>

              <View style={{ width: 60 }} />
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // ===== Render: Image Selected (before analysis) =====
  if (!analysisResult) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setImageUri(null)}>
            <Ionicons name="arrow-back" size={28} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Review Image</Text>
          <View style={{ width: 28 }} />
        </View>

        <View style={styles.imagePreviewContainer}>
          <Image
            source={{ uri: imageUri }}
            style={styles.imagePreview}
            resizeMode="contain"
          />
        </View>

        <ScrollView style={styles.infoContainer}>
          <Text style={styles.infoLabel}>Image selected. Ready to analyze?</Text>
          <Text style={styles.infoText}>
            The AI will analyze the lesion for classification, ABCD metrics, and
            feature drift (if previous scan exists).
          </Text>
        </ScrollView>

        <View style={styles.actionContainer}>
          {analyzing ? (
            <View style={styles.loadingView}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Analyzing...</Text>
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={styles.analyzeBtn}
                onPress={analyzeImage_Handler}
              >
                <Ionicons name="flask-outline" size={24} color="white" />
                <Text style={styles.analyzeBtnText}>Analyze</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setImageUri(null)}
              >
                <Text style={styles.cancelBtnText}>Change Image</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  }

  // ===== Render: Results Screen =====
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => resetScan()}>
          <Ionicons name="arrow-back" size={28} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Results</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.resultsScroll}>
        {/* Risk Gauge */}
        <RiskGauge riskScore={analysisResult.risk_score} />

        {/* Alert Banner */}
        {(analysisResult.drift_label === 'Significant' || 
          analysisResult.risk_score > 0.6) && (
          <View style={styles.warningBanner}>
            <Ionicons name="warning" size={20} color="#F44336" />
            <Text style={styles.warningText}>
              ⚠️ Significant change detected — please consult a dermatologist
            </Text>
          </View>
        )}

        {/* Prediction Card */}
        <View style={styles.resultCard}>
          <Text style={styles.resultCardTitle}>Classification</Text>
          <Text style={styles.predictionClass}>
            {analysisResult.prediction}
          </Text>
          <Text style={styles.confidenceText}>
            Confidence: {(analysisResult.confidence * 100).toFixed(1)}%
          </Text>
        </View>

        {/* ABCD Card */}
        <View style={styles.resultCard}>
          <Text style={styles.resultCardTitle}>ABCD Scores</Text>
          <ABCDChart abcd={analysisResult.abcd} />
        </View>

        {/* Drift Card (if present) */}
        {analysisResult.drift !== null && (
          <View style={styles.resultCard}>
            <Text style={styles.resultCardTitle}>Feature Drift</Text>
            <Text style={styles.driftScore}>
              {analysisResult.drift.toFixed(3)}
            </Text>
            <Text style={styles.driftLabel}>
              {analysisResult.drift_label}
            </Text>
          </View>
        )}

        {/* Details Card */}
        <View style={styles.resultCard}>
          <Text style={styles.resultCardTitle}>Details</Text>
          <DetailRow
            label="Risk Score"
            value={(analysisResult.risk_score * 100).toFixed(1) + '%'}
          />
          <DetailRow
            label="Timestamp"
            value={new Date().toLocaleString()}
          />
          <DetailRow
            label="Feature Dimension"
            value="1792"
          />
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        {loading ? (
          <View style={styles.loadingView}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Saving...</Text>
          </View>
        ) : (
          <>
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={saveScan_Handler}
            >
              <Ionicons name="checkmark-circle" size={24} color="white" />
              <Text style={styles.saveBtnText}>Save to History</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={resetScan}
            >
              <Text style={styles.cancelBtnText}>Discard</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
};

/**
 * Risk Gauge Component - Circular colored indicator
 */
const RiskGauge = ({ riskScore }) => {
  const getRiskInfo = (score) => {
    if (score < 0.3) return { label: 'Low Risk', color: '#4CAF50' };
    if (score < 0.6) return { label: 'Moderate Risk', color: '#FF9800' };
    return { label: 'High Risk', color: '#F44336' };
  };

  const riskInfo = getRiskInfo(riskScore);

  return (
    <View style={styles.gaugeContainer}>
      <View style={styles.gaugeCircle}>
        <View
          style={[
            styles.gaugeFill,
            {
              backgroundColor: riskInfo.color,
              borderRadius: 60,
              width: 120 * Math.min(riskScore, 1),
            },
          ]}
        />
        <View style={styles.gaugeInner}>
          <Text style={styles.gaugeValue}>
            {(riskScore * 100).toFixed(0)}%
          </Text>
          <Text style={styles.gaugeLabel}>{riskInfo.label}</Text>
        </View>
      </View>
    </View>
  );
};

/**
 * ABCD Chart - Horizontal bar chart
 */
const ABCDChart = ({ abcd }) => {
  const maxValue = 1;

  const ABCDBar = ({ label, value }) => (
    <View style={styles.abcdRow}>
      <Text style={styles.abcdLabel}>{label}</Text>
      <View style={styles.abcdBarBg}>
        <View
          style={[
            styles.abcdBar,
            { width: `${(value / maxValue) * 100}%` },
          ]}
        />
      </View>
      <Text style={styles.abcdValue}>{value.toFixed(2)}</Text>
    </View>
  );

  return (
    <View>
      <ABCDBar label="A (Asymmetry)" value={abcd.A} />
      <ABCDBar label="B (Border)" value={abcd.B} />
      <ABCDBar label="C (Color)" value={abcd.C} />
      <ABCDBar label="D (Diameter)" value={abcd.D} />
    </View>
  );
};

/**
 * Detail Row - Key-value pair
 */
const DetailRow = ({ label, value }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    paddingTop: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  imageSelectContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  selectText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  selectSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  imagePreviewContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  imagePreview: {
    width: '100%',
    height: 400,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  infoContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'white',
  },
  infoLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  resultsScroll: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  gaugeContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 12,
  },
  gaugeCircle: {
    width: 240,
    height: 120,
    borderRadius: 120,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  gaugeFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: 120,
    backgroundColor: '#4CAF50',
  },
  gaugeInner: {
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  gaugeValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#333',
  },
  gaugeLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  warningBanner: {
    flexDirection: 'row',
    backgroundColor: '#FFF3E0',
    borderLeftColor: '#F44336',
    borderLeftWidth: 4,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  warningText: {
    marginLeft: 12,
    flex: 1,
    fontSize: 13,
    color: '#D32F2F',
    fontWeight: '600',
  },
  resultCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  resultCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  predictionClass: {
    fontSize: 24,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 4,
  },
  confidenceText: {
    fontSize: 13,
    color: '#999',
  },
  driftScore: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  driftLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  abcdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  abcdLabel: {
    width: 140,
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  abcdBarBg: {
    flex: 1,
    height: 20,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    overflow: 'hidden',
    marginHorizontal: 8,
  },
  abcdBar: {
    height: '100%',
    backgroundColor: '#007AFF',
  },
  abcdValue: {
    width: 50,
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailLabel: {
    fontSize: 13,
    color: '#666',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  actionContainer: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    paddingBottom: 24,
  },
  cameraBtn: {
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    elevation: 3,
  },
  cameraBtnText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  galleryBtn: {
    flexDirection: 'row',
    backgroundColor: '#34C759',
    borderRadius: 12,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
  },
  galleryBtnText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  analyzeBtn: {
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    elevation: 3,
  },
  analyzeBtnText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  saveBtn: {
    flexDirection: 'row',
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    elevation: 3,
  },
  saveBtnText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  cancelBtn: {
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  loadingView: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  cameraControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 32,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    height: 100,
  },
  cameraCancelBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraCaptureBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF3B30',
  },
});

export default ScanScreen;
