/**
 * Config utility for managing backend URL and app settings
 */

const CONFIG = {
  // Backend Configuration
  BACKEND: {
    // Change this to your Flask server IP address
    URL: process.env.REACT_APP_BACKEND_URL || 'http://192.168.1.100:5000',
    TIMEOUT: 60000, // 60 seconds
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000, // 1 second
  },

  // Image Upload Configuration
  IMAGE: {
    MAX_SIZE: 50 * 1024 * 1024, // 50MB
    QUALITY: 0.8, // 80% compression
    FORMATS: ['jpeg', 'jpg', 'png', 'bmp', 'gif'],
  },

  // AI Model Configuration
  MODEL: {
    FEATURE_DIM: 1792,
    CLASS_NAMES: [
      'Actinic keratosis',
      'Basal cell carcinoma',
      'Benign',
      'Melanoma',
      'Squamous cell carcinoma',
    ],
    INPUT_SIZE: 380,
  },

  // Risk Thresholds
  RISK: {
    LOW_THRESHOLD: 0.3,   // < 30% = Low Risk
    HIGH_THRESHOLD: 0.6,  // >= 60% = High Risk
    ALERT_THRESHOLD: 0.6, // Show warning banner
  },

  // Drift Thresholds
  DRIFT: {
    STABLE_MAX: 0.15,
    MODERATE_MAX: 0.30,
  },

  // Storage Configuration
  STORAGE: {
    PATIENTS_KEY: 'lesion_tracking:patients',
    SCANS_PREFIX: 'lesion_tracking:patient:',
  },

  // Debug Configuration
  DEBUG: {
    ENABLED: process.env.NODE_ENV === 'development',
    LOG_API_CALLS: true,
    LOG_STORAGE_OPS: true,
  },
};

/**
 * Get the backend URL
 * Can be overridden by environment variable: REACT_APP_BACKEND_URL
 */
export const getBackendURL = () => CONFIG.BACKEND.URL;

/**
 * Set backend URL dynamically (for configuration screens)
 */
export const setBackendURL = (url) => {
  CONFIG.BACKEND.URL = url;
  if (CONFIG.DEBUG.ENABLED) {
    console.log(`🔗 Backend URL updated to: ${url}`);
  }
};

/**
 * Get risk color based on score
 */
export const getRiskColor = (score) => {
  if (score < CONFIG.RISK.LOW_THRESHOLD) return '#4CAF50'; // Green
  if (score < CONFIG.RISK.HIGH_THRESHOLD) return '#FF9800'; // Orange
  return '#F44336'; // Red
};

/**
 * Get risk label based on score
 */
export const getRiskLabel = (score) => {
  if (score < CONFIG.RISK.LOW_THRESHOLD) return 'Low Risk';
  if (score < CONFIG.RISK.HIGH_THRESHOLD) return 'Moderate Risk';
  return 'High Risk';
};

/**
 * Check if risk score should trigger alert
 */
export const shouldShowAlert = (riskScore, driftLabel) => {
  return (
    riskScore >= CONFIG.RISK.ALERT_THRESHOLD ||
    driftLabel === 'Significant'
  );
};

export default CONFIG;
