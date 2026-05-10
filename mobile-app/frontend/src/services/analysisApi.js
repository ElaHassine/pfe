/**
 * API service for lesion analysis backend.
 * Handles communication with Flask /analyze and /analyze_drift endpoints.
 */

import * as FileSystem from 'expo-file-system';

// Configure backend URL - change this to your Flask server address
const BACKEND_URL = process.env.BACKEND_URL || 'http://192.168.1.100:5000';

console.log(`🔗 Backend URL: ${BACKEND_URL}`);

/**
 * Convert image file URI to base64 string.
 * 
 * @param {string} imageUri - File URI from image picker or camera
 * @returns {Promise<string>} Base64-encoded image string
 */
export const imageUriToBase64 = async (imageUri) => {
  try {
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return base64;
  } catch (error) {
    console.error('❌ Error converting image to base64:', error);
    throw error;
  }
};

/**
 * Analyze a single lesion image (first scan).
 * 
 * @param {string} imageUri - File URI from image picker or camera
 * @returns {Promise<object>} Analysis result
 *   {
 *     prediction: string,
 *     confidence: number,
 *     abcd: {A, B, C, D},
 *     features: [1792 floats],
 *     risk_score: number,
 *     drift: null,
 *     drift_label: null
 *   }
 */
export const analyzeImage = async (imageUri) => {
  try {
    console.log(`📸 Analyzing image: ${imageUri}`);
    
    // Convert to base64
    const base64 = await imageUriToBase64(imageUri);
    console.log(`📤 Uploading to ${BACKEND_URL}/analyze`);
    
    const response = await fetch(`${BACKEND_URL}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_base64: base64,
      }),
      timeout: 60000, // 60 second timeout for model inference
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Backend returned ${response.status}: ${errorText}`
      );
    }
    
    const result = await response.json();
    console.log('✅ Analysis complete:', {
      prediction: result.prediction,
      confidence: result.confidence,
      risk_score: result.risk_score,
    });
    
    return result;
  } catch (error) {
    console.error('❌ Error analyzing image:', error);
    throw error;
  }
};

/**
 * Analyze with drift detection (comparing to previous scan).
 * 
 * @param {string} imageUri - Current image URI
 * @param {array} previousFeatures - Feature vector from previous scan (1792 floats)
 * @returns {Promise<object>} Analysis result with drift
 *   {
 *     prediction: string,
 *     confidence: number,
 *     abcd: {A, B, C, D},
 *     features: [1792 floats],
 *     risk_score: number,
 *     drift: number,
 *     drift_label: string ("Stable" | "Moderate" | "Significant")
 *   }
 */
export const analyzeImageWithDrift = async (imageUri, previousFeatures) => {
  try {
    if (!previousFeatures || previousFeatures.length !== 1792) {
      throw new Error(
        `Invalid previous features: expected 1792 values, got ${
          previousFeatures ? previousFeatures.length : 0
        }`
      );
    }
    
    console.log(`📸 Analyzing image with drift comparison`);
    
    // Convert to base64
    const base64 = await imageUriToBase64(imageUri);
    console.log(`📤 Uploading to ${BACKEND_URL}/analyze_drift`);
    
    const response = await fetch(`${BACKEND_URL}/analyze_drift`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_base64: base64,
        previous_features: previousFeatures,
      }),
      timeout: 60000,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Backend returned ${response.status}: ${errorText}`
      );
    }
    
    const result = await response.json();
    console.log('✅ Drift analysis complete:', {
      prediction: result.prediction,
      drift: result.drift,
      drift_label: result.drift_label,
      risk_score: result.risk_score,
    });
    
    return result;
  } catch (error) {
    console.error('❌ Error analyzing image with drift:', error);
    throw error;
  }
};

/**
 * Check backend health and get model info.
 * 
 * @returns {Promise<object>} Info response
 */
export const getBackendInfo = async () => {
  try {
    const response = await fetch(`${BACKEND_URL}/info`);
    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`);
    }
    const info = await response.json();
    console.log('✅ Backend info:', info);
    return info;
  } catch (error) {
    console.error('❌ Error getting backend info:', error);
    throw error;
  }
};

/**
 * Check backend health.
 * 
 * @returns {Promise<boolean>} True if backend is healthy
 */
export const checkBackendHealth = async () => {
  try {
    const response = await fetch(`${BACKEND_URL}/health`, {
      timeout: 5000,
    });
    return response.ok;
  } catch (error) {
    console.error('❌ Backend health check failed:', error);
    return false;
  }
};

/**
 * Set backend URL (for configuration).
 * 
 * @param {string} url - Backend URL (e.g., "http://192.168.1.100:5000")
 */
export const setBackendUrl = (url) => {
  // Note: In production, use environment variables or app config
  // This is a placeholder for dynamic configuration
  console.log(`🔗 Backend URL set to: ${url}`);
};
