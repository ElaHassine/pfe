/**
 * AsyncStorage helper for managing patient scan history.
 * Stores: patient scans, previous scan data per patient
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  PATIENTS: 'lesion_tracking:patients', // List of patient IDs
  PATIENT_PREFIX: 'lesion_tracking:patient:', // {patientId}:data
  SCANS_PREFIX: 'lesion_tracking:patient:',  // {patientId}:scans
};

/**
 * Save a new scan for a patient.
 * 
 * @param {string} patientId - Unique patient identifier
 * @param {object} scanData - Scan result object
 *   {
 *     id: string (uuid),
 *     timestamp: ISO string,
 *     image_uri: string (local file path or base64),
 *     prediction: string,
 *     confidence: number,
 *     abcd: {A, B, C, D},
 *     features: [1792 floats],
 *     risk_score: number,
 *     drift: null | number,
 *     drift_label: null | string
 *   }
 */
export const saveScan = async (patientId, scanData) => {
  try {
    const scansKey = `${STORAGE_KEYS.SCANS_PREFIX}${patientId}:scans`;
    
    // Get existing scans
    const existingScansJson = await AsyncStorage.getItem(scansKey);
    const scans = existingScansJson ? JSON.parse(existingScansJson) : [];
    
    // Add new scan
    scans.push({
      ...scanData,
      timestamp: scanData.timestamp || new Date().toISOString(),
      id: scanData.id || generateId(),
    });
    
    // Save back to storage
    await AsyncStorage.setItem(scansKey, JSON.stringify(scans));
    
    // Ensure patient is in patients list
    await addPatient(patientId);
    
    console.log(`✅ Scan saved for patient ${patientId}`);
    return scans[scans.length - 1];
  } catch (error) {
    console.error('❌ Error saving scan:', error);
    throw error;
  }
};

/**
 * Get all scans for a patient, sorted by timestamp (newest first).
 * 
 * @param {string} patientId - Unique patient identifier
 * @returns {array} Array of scan objects
 */
export const getPatientScans = async (patientId) => {
  try {
    const scansKey = `${STORAGE_KEYS.SCANS_PREFIX}${patientId}:scans`;
    const scansJson = await AsyncStorage.getItem(scansKey);
    const scans = scansJson ? JSON.parse(scansJson) : [];
    
    // Sort by timestamp descending (newest first)
    scans.sort(
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    );
    
    return scans;
  } catch (error) {
    console.error('❌ Error getting patient scans:', error);
    throw error;
  }
};

/**
 * Get the most recent scan for a patient (for drift comparison).
 * 
 * @param {string} patientId
 * @returns {object|null} Most recent scan or null if no scans exist
 */
export const getLastScan = async (patientId) => {
  try {
    const scans = await getPatientScans(patientId);
    return scans.length > 0 ? scans[0] : null;
  } catch (error) {
    console.error('❌ Error getting last scan:', error);
    throw error;
  }
};

/**
 * Get a specific scan by ID.
 * 
 * @param {string} patientId
 * @param {string} scanId
 * @returns {object|null}
 */
export const getScanById = async (patientId, scanId) => {
  try {
    const scans = await getPatientScans(patientId);
    return scans.find((s) => s.id === scanId) || null;
  } catch (error) {
    console.error('❌ Error getting scan by ID:', error);
    throw error;
  }
};

/**
 * Delete a scan.
 * 
 * @param {string} patientId
 * @param {string} scanId
 */
export const deleteScan = async (patientId, scanId) => {
  try {
    const scansKey = `${STORAGE_KEYS.SCANS_PREFIX}${patientId}:scans`;
    const scans = await getPatientScans(patientId);
    
    const filtered = scans.filter((s) => s.id !== scanId);
    
    if (filtered.length === 0) {
      // If no scans left, remove the key entirely
      await AsyncStorage.removeItem(scansKey);
    } else {
      await AsyncStorage.setItem(scansKey, JSON.stringify(filtered));
    }
    
    console.log(`✅ Scan ${scanId} deleted for patient ${patientId}`);
  } catch (error) {
    console.error('❌ Error deleting scan:', error);
    throw error;
  }
};

/**
 * Add a patient to the patients list.
 * 
 * @param {string} patientId
 */
export const addPatient = async (patientId) => {
  try {
    const patientsJson = await AsyncStorage.getItem(STORAGE_KEYS.PATIENTS);
    const patients = patientsJson ? JSON.parse(patientsJson) : [];
    
    if (!patients.includes(patientId)) {
      patients.push(patientId);
      await AsyncStorage.setItem(STORAGE_KEYS.PATIENTS, JSON.stringify(patients));
    }
  } catch (error) {
    console.error('❌ Error adding patient:', error);
    throw error;
  }
};

/**
 * Get list of all patient IDs.
 * 
 * @returns {array} Patient IDs
 */
export const getAllPatients = async () => {
  try {
    const patientsJson = await AsyncStorage.getItem(STORAGE_KEYS.PATIENTS);
    return patientsJson ? JSON.parse(patientsJson) : [];
  } catch (error) {
    console.error('❌ Error getting all patients:', error);
    throw error;
  }
};

/**
 * Clear all data for a patient.
 * 
 * @param {string} patientId
 */
export const deletePatientData = async (patientId) => {
  try {
    const scansKey = `${STORAGE_KEYS.SCANS_PREFIX}${patientId}:scans`;
    await AsyncStorage.removeItem(scansKey);
    
    // Remove from patients list
    const patientsJson = await AsyncStorage.getItem(STORAGE_KEYS.PATIENTS);
    const patients = patientsJson ? JSON.parse(patientsJson) : [];
    const filtered = patients.filter((p) => p !== patientId);
    
    if (filtered.length === 0) {
      await AsyncStorage.removeItem(STORAGE_KEYS.PATIENTS);
    } else {
      await AsyncStorage.setItem(STORAGE_KEYS.PATIENTS, JSON.stringify(filtered));
    }
    
    console.log(`✅ All data deleted for patient ${patientId}`);
  } catch (error) {
    console.error('❌ Error deleting patient data:', error);
    throw error;
  }
};

/**
 * Clear ALL data (development/testing).
 */
export const clearAllData = async () => {
  try {
    await AsyncStorage.clear();
    console.log('✅ All data cleared');
  } catch (error) {
    console.error('❌ Error clearing all data:', error);
    throw error;
  }
};

/**
 * Generate a unique ID for scans.
 * 
 * @returns {string} UUID-like string
 */
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get storage statistics (for debugging).
 * 
 * @returns {object} Stats
 */
export const getStorageStats = async () => {
  try {
    const patients = await getAllPatients();
    const stats = {
      total_patients: patients.length,
      patients: {},
    };
    
    for (const patientId of patients) {
      const scans = await getPatientScans(patientId);
      stats.patients[patientId] = {
        scan_count: scans.length,
        oldest_scan: scans.length > 0 ? scans[scans.length - 1].timestamp : null,
        newest_scan: scans.length > 0 ? scans[0].timestamp : null,
      };
    }
    
    return stats;
  } catch (error) {
    console.error('❌ Error getting storage stats:', error);
    throw error;
  }
};
