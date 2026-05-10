/**
 * HistoryScreen.js
 * 
 * Timeline view of all scans for a patient.
 * Shows: date, prediction, risk score (colored), drift label
 * Tap to view full result details for that scan.
 */

import React, { useEffect, useState, useFocusEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getPatientScans, deleteScan } from '../services/storage';

const { width } = Dimensions.get('window');

const HistoryScreen = ({ route, navigation }) => {
  const { patientId } = route.params;

  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedScan, setSelectedScan] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Reload scans when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      loadScans();
    }, [patientId])
  );

  const loadScans = async () => {
    try {
      setLoading(true);
      const patientScans = await getPatientScans(patientId);
      setScans(patientScans);
    } catch (error) {
      console.error('❌ Error loading scans:', error);
      Alert.alert('Error', 'Failed to load scan history');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteScan = (scanId) => {
    Alert.alert(
      'Delete Scan',
      'Are you sure you want to delete this scan?',
      [
        { text: 'Cancel' },
        {
          text: 'Delete',
          onPress: async () => {
            try {
              await deleteScan(patientId, scanId);
              loadScans();
              Alert.alert('Deleted', 'Scan deleted from history');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete scan');
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  const handleViewDetails = (scan) => {
    setSelectedScan(scan);
    setShowDetailModal(true);
  };

  const getRiskColor = (riskScore) => {
    if (riskScore < 0.3) return '#4CAF50'; // Green
    if (riskScore < 0.6) return '#FF9800'; // Orange
    return '#F44336'; // Red
  };

  const getDriftColor = (drift_label) => {
    if (!drift_label) return '#999';
    if (drift_label === 'Stable') return '#4CAF50';
    if (drift_label === 'Moderate') return '#FF9800';
    return '#F44336';
  };

  const ScanTimelineItem = ({ scan, index, total }) => {
    const scanDate = new Date(scan.timestamp);
    const isLast = index === total - 1;

    return (
      <View style={styles.timelineItem}>
        {/* Timeline Dot and Line */}
        <View style={styles.timelineLeft}>
          <View
            style={[
              styles.timelineDot,
              { backgroundColor: getRiskColor(scan.risk_score) },
            ]}
          />
          {!isLast && <View style={styles.timelineLine} />}
        </View>

        {/* Scan Card */}
        <TouchableOpacity
          style={styles.scanCard}
          onPress={() => handleViewDetails(scan)}
        >
          {/* Header */}
          <View style={styles.scanCardHeader}>
            <View style={styles.scanCardTitleView}>
              <Text style={styles.scanDate}>
                {scanDate.toLocaleDateString()}
              </Text>
              <Text style={styles.scanTime}>
                {scanDate.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>

            <View style={styles.scanCardActions}>
              <View
                style={[
                  styles.riskBadge,
                  { backgroundColor: getRiskColor(scan.risk_score) },
                ]}
              >
                <Text style={styles.riskBadgeText}>
                  {(scan.risk_score * 100).toFixed(0)}%
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => handleDeleteScan(scan.id)}
                style={styles.deleteIconBtn}
              >
                <Ionicons name="trash-outline" size={18} color="#999" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Body */}
          <View style={styles.scanCardBody}>
            <View style={styles.scanInfo}>
              <Ionicons
                name="alert-circle-outline"
                size={16}
                color="#666"
                style={{ marginRight: 4 }}
              />
              <Text style={styles.predictionText}>{scan.prediction}</Text>
            </View>

            {/* Drift Badge */}
            {scan.drift_label && (
              <View
                style={[
                  styles.driftBadge,
                  { borderColor: getDriftColor(scan.drift_label) },
                ]}
              >
                <Text
                  style={[
                    styles.driftBadgeText,
                    { color: getDriftColor(scan.drift_label) },
                  ]}
                >
                  {scan.drift_label} drift
                </Text>
              </View>
            )}

            {/* Confidence */}
            <Text style={styles.confidenceText}>
              Confidence: {(scan.confidence * 100).toFixed(1)}%
            </Text>
          </View>

          {/* Arrow */}
          <View style={styles.scanCardArrow}>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={28} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scan History</Text>
          <View style={{ width: 28 }} />
        </View>

        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color="white" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Scan History</Text>
          <Text style={styles.headerSubtitle}>Patient: {patientId}</Text>
        </View>
        <TouchableOpacity onPress={loadScans}>
          <Ionicons name="refresh" size={28} color="white" />
        </TouchableOpacity>
      </View>

      {/* Content */}
      {scans.length > 0 ? (
        <View style={styles.timelineContainer}>
          <FlatList
            data={scans}
            keyExtractor={(item, index) => item.id || index.toString()}
            renderItem={({ item, index }) => (
              <ScanTimelineItem
                scan={item}
                index={index}
                total={scans.length}
              />
            )}
            scrollEventThrottle={16}
            contentContainerStyle={styles.timelineContent}
          />

          {/* New Scan Button */}
          <TouchableOpacity
            style={styles.newScanBtn}
            onPress={() => navigation.navigate('Scan', { patientId })}
          >
            <Ionicons name="add" size={28} color="white" />
            <Text style={styles.newScanBtnText}>New Scan</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-outline" size={80} color="#ccc" />
          <Text style={styles.emptyText}>No Scans Yet</Text>
          <Text style={styles.emptySubtext}>
            Start by taking your first lesion scan
          </Text>

          <TouchableOpacity
            style={styles.startScanBtn}
            onPress={() => navigation.navigate('Scan', { patientId })}
          >
            <Ionicons name="camera" size={24} color="white" />
            <Text style={styles.startScanBtnText}>Take First Scan</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Detail Modal */}
      <Modal
        visible={showDetailModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDetailModal(false)}
      >
        {selectedScan && (
          <ScanDetailView
            scan={selectedScan}
            onClose={() => setShowDetailModal(false)}
          />
        )}
      </Modal>
    </View>
  );
};

/**
 * ScanDetailView - Full details of a scan
 */
const ScanDetailView = ({ scan, onClose }) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={28} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scan Details</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.detailScroll}>
        {/* Image */}
        {scan.image_uri && (
          <View style={styles.detailImageContainer}>
            <Image
              source={{ uri: scan.image_uri }}
              style={styles.detailImage}
              resizeMode="contain"
            />
          </View>
        )}

        {/* Risk Gauge */}
        <RiskGaugeDetail riskScore={scan.risk_score} />

        {/* Prediction Card */}
        <View style={styles.detailCard}>
          <Text style={styles.detailCardTitle}>Classification</Text>
          <Text style={styles.predictionClass}>{scan.prediction}</Text>
          <Text style={styles.confidenceText}>
            Confidence: {(scan.confidence * 100).toFixed(1)}%
          </Text>
        </View>

        {/* ABCD Card */}
        <View style={styles.detailCard}>
          <Text style={styles.detailCardTitle}>ABCD Scores</Text>
          <ABCDChartDetail abcd={scan.abcd} />
        </View>

        {/* Drift Card */}
        {scan.drift !== null && scan.drift !== undefined && (
          <View style={styles.detailCard}>
            <Text style={styles.detailCardTitle}>Feature Drift</Text>
            <Text style={styles.driftScore}>{scan.drift.toFixed(3)}</Text>
            <Text style={styles.driftLabel}>{scan.drift_label}</Text>
          </View>
        )}

        {/* Metadata Card */}
        <View style={styles.detailCard}>
          <Text style={styles.detailCardTitle}>Metadata</Text>
          <DetailRowDetail label="Timestamp" value={new Date(scan.timestamp).toLocaleString()} />
          <DetailRowDetail label="Scan ID" value={scan.id} />
          <DetailRowDetail label="Risk Score" value={(scan.risk_score * 100).toFixed(1) + '%'} />
          <DetailRowDetail label="Feature Dim" value="1792" />
        </View>
      </ScrollView>

      {/* Close Button */}
      <View style={styles.detailActionContainer}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={onClose}
        >
          <Text style={styles.closeBtnText}>Close</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

/**
 * Risk Gauge Detail Component
 */
const RiskGaugeDetail = ({ riskScore }) => {
  const getRiskInfo = (score) => {
    if (score < 0.3) return { label: 'Low Risk', color: '#4CAF50' };
    if (score < 0.6) return { label: 'Moderate Risk', color: '#FF9800' };
    return { label: 'High Risk', color: '#F44336' };
  };

  const riskInfo = getRiskInfo(riskScore);

  return (
    <View style={styles.detailGaugeContainer}>
      <View style={styles.detailGaugeCircle}>
        <View
          style={[
            styles.detailGaugeFill,
            {
              backgroundColor: riskInfo.color,
              borderRadius: 60,
              width: 120 * Math.min(riskScore, 1),
            },
          ]}
        />
        <View style={styles.detailGaugeInner}>
          <Text style={styles.detailGaugeValue}>
            {(riskScore * 100).toFixed(0)}%
          </Text>
          <Text style={styles.detailGaugeLabel}>{riskInfo.label}</Text>
        </View>
      </View>
    </View>
  );
};

/**
 * ABCD Chart Detail
 */
const ABCDChartDetail = ({ abcd }) => {
  const maxValue = 1;

  const ABCDBar = ({ label, value }) => (
    <View style={styles.detailAbcdRow}>
      <Text style={styles.detailAbcdLabel}>{label}</Text>
      <View style={styles.detailAbcdBarBg}>
        <View
          style={[
            styles.detailAbcdBar,
            { width: `${(value / maxValue) * 100}%` },
          ]}
        />
      </View>
      <Text style={styles.detailAbcdValue}>{value.toFixed(2)}</Text>
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
 * Detail Row
 */
const DetailRowDetail = ({ label, value }) => (
  <View style={styles.detailDetailRow}>
    <Text style={styles.detailDetailLabel}>{label}</Text>
    <Text
      style={styles.detailDetailValue}
      numberOfLines={1}
      ellipsizeMode="tail"
    >
      {value}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  timelineContainer: {
    flex: 1,
  },
  timelineContent: {
    paddingHorizontal: 12,
    paddingVertical: 16,
    paddingBottom: 80,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  timelineLeft: {
    width: 40,
    alignItems: 'center',
    paddingTop: 8,
  },
  timelineDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: '#f5f5f5',
    backgroundColor: '#007AFF',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#ddd',
    marginTop: 8,
  },
  scanCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    marginLeft: 12,
    marginRight: 0,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  scanCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  scanCardTitleView: {
    flex: 1,
  },
  scanDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  scanTime: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  scanCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  riskBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
  },
  riskBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'white',
  },
  deleteIconBtn: {
    padding: 4,
  },
  scanCardBody: {
    marginBottom: 8,
  },
  scanInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  predictionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  confidenceText: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  driftBadge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginVertical: 4,
    alignSelf: 'flex-start',
  },
  driftBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  scanCardArrow: {
    marginTop: 4,
    alignItems: 'flex-end',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  startScanBtn: {
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  startScanBtnText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  newScanBtn: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  newScanBtnText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  detailScroll: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  detailImageContainer: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 12,
    backgroundColor: 'white',
    borderRadius: 12,
  },
  detailImage: {
    width: width - 40,
    height: 300,
    borderRadius: 12,
  },
  detailGaugeContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 12,
  },
  detailGaugeCircle: {
    width: 240,
    height: 120,
    borderRadius: 120,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  detailGaugeFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: 120,
  },
  detailGaugeInner: {
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  detailGaugeValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#333',
  },
  detailGaugeLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  detailCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  detailCardTitle: {
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
  detailAbcdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailAbcdLabel: {
    width: 140,
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  detailAbcdBarBg: {
    flex: 1,
    height: 20,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    overflow: 'hidden',
    marginHorizontal: 8,
  },
  detailAbcdBar: {
    height: '100%',
    backgroundColor: '#007AFF',
  },
  detailAbcdValue: {
    width: 50,
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  detailDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailDetailLabel: {
    fontSize: 13,
    color: '#666',
    flex: 1,
  },
  detailDetailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    textAlign: 'right',
  },
  detailActionContainer: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    paddingBottom: 24,
  },
  closeBtn: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
  },
  closeBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});

export default HistoryScreen;
