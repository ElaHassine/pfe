/**
 * PatientSelectScreen.js
 * 
 * Allow user to select or create a patient before scanning.
 * Shows list of existing patients with quick stats.
 * Allows manual patient ID entry or quick create new patient.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAllPatients, getPatientScans, deletePatientData } from '../services/storage';

const PatientSelectScreen = ({ navigation }) => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewPatientModal, setShowNewPatientModal] = useState(false);
  const [newPatientId, setNewPatientId] = useState('');
  const [patientStats, setPatientStats] = useState({});

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    try {
      setLoading(true);
      const patientIds = await getAllPatients();
      setPatients(patientIds);

      // Load stats for each patient
      const stats = {};
      for (const patientId of patientIds) {
        const scans = await getPatientScans(patientId);
        stats[patientId] = {
          scan_count: scans.length,
          latest_date: scans.length > 0 ? new Date(scans[0].timestamp) : null,
          latest_risk: scans.length > 0 ? scans[0].risk_score : null,
        };
      }
      setPatientStats(stats);
    } catch (error) {
      console.error('❌ Error loading patients:', error);
      Alert.alert('Error', 'Failed to load patients');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPatient = (patientId) => {
    navigation.navigate('Scan', { patientId });
  };

  const handleCreatePatient = async () => {
    const patientId = newPatientId.trim();
    if (!patientId) {
      Alert.alert('Invalid', 'Please enter a patient ID');
      return;
    }

    if (patients.includes(patientId)) {
      Alert.alert('Exists', `Patient ${patientId} already exists`);
      return;
    }

    // Create patient by navigating to scan screen
    setShowNewPatientModal(false);
    setNewPatientId('');
    navigation.navigate('Scan', { patientId });
  };

  const handleDeletePatient = (patientId) => {
    Alert.alert(
      'Delete Patient',
      `Delete all data for patient ${patientId}?`,
      [
        { text: 'Cancel', onPress: () => {} },
        {
          text: 'Delete',
          onPress: async () => {
            try {
              await deletePatientData(patientId);
              loadPatients();
              Alert.alert('Deleted', `Patient ${patientId} deleted`);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete patient');
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  const getRiskColor = (riskScore) => {
    if (!riskScore) return '#999';
    if (riskScore < 0.3) return '#4CAF50'; // Green
    if (riskScore < 0.6) return '#FF9800'; // Orange
    return '#F44336'; // Red
  };

  const PatientItem = ({ patientId }) => {
    const stats = patientStats[patientId] || {};
    const latestDateStr = stats.latest_date
      ? stats.latest_date.toLocaleDateString()
      : 'No scans';

    return (
      <TouchableOpacity
        style={styles.patientCard}
        onPress={() => handleSelectPatient(patientId)}
      >
        <View style={styles.patientCardContent}>
          <View style={styles.patientInfo}>
            <Text style={styles.patientId}>{patientId}</Text>
            <Text style={styles.patientStats}>
              {stats.scan_count} scans • {latestDateStr}
            </Text>
          </View>

          {stats.latest_risk !== null && (
            <View style={styles.riskIndicator}>
              <View
                style={[
                  styles.riskDot,
                  { backgroundColor: getRiskColor(stats.latest_risk) },
                ]}
              />
              <Text style={styles.riskText}>
                {(stats.latest_risk * 100).toFixed(0)}%
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => handleDeletePatient(patientId)}
          >
            <Ionicons name="close-circle" size={24} color="#999" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading patients...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Lesion Tracking</Text>
        <Text style={styles.headerSubtitle}>Select Patient</Text>
      </View>

      {/* Patient List */}
      {patients.length > 0 ? (
        <FlatList
          data={patients}
          keyExtractor={(item) => item}
          renderItem={({ item }) => <PatientItem patientId={item} />}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="person-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>No patients yet</Text>
          <Text style={styles.emptySubtext}>Create one to get started</Text>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => setShowNewPatientModal(true)}
        >
          <Ionicons name="add-circle" size={24} color="white" />
          <Text style={styles.createBtnText}>New Patient</Text>
        </TouchableOpacity>

        {patients.length > 0 && (
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={loadPatients}
          >
            <Ionicons name="refresh" size={24} color="#007AFF" />
            <Text style={styles.refreshBtnText}>Refresh</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* New Patient Modal */}
      <Modal
        visible={showNewPatientModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNewPatientModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Patient</Text>
              <TouchableOpacity
                onPress={() => setShowNewPatientModal(false)}
              >
                <Ionicons name="close" size={28} color="white" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalLabel}>Enter Patient ID</Text>
              <TextInput
                style={styles.patientIdInput}
                placeholder="e.g., PAT-001, john_doe"
                value={newPatientId}
                onChangeText={setNewPatientId}
                autoCapitalize="none"
                placeholderTextColor="#aaa"
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => {
                    setShowNewPatientModal(false);
                    setNewPatientId('');
                  }}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.confirmBtn}
                  onPress={handleCreatePatient}
                >
                  <Text style={styles.confirmBtnText}>Create</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  header: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  listContent: {
    padding: 12,
    paddingBottom: 100,
  },
  patientCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  patientCardContent: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
  },
  patientInfo: {
    flex: 1,
  },
  patientId: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  patientStats: {
    fontSize: 12,
    color: '#999',
  },
  riskIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  riskDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  riskText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  deleteBtn: {
    padding: 4,
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
  },
  actionContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
  },
  createBtn: {
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  createBtnText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  refreshBtn: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  refreshBtnText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
  },
  modalBody: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  patientIdInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: '#333',
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  confirmBtn: {
    flex: 1,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
});

export default PatientSelectScreen;
