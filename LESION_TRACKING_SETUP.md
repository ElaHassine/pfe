# Longitudinal Lesion Tracking Feature - Complete Setup Guide

## 📋 Overview

This implementation adds longitudinal lesion tracking with feature drift detection to your doctor-patient portal. The system:

1. **Captures** lesion images via camera or gallery picker
2. **Analyzes** images using EfficientNet-B4 AI model
3. **Computes** ABCD dermoscopy scores and feature vectors (1792-dim)
4. **Detects** feature drift between sequential scans
5. **Calculates** risk scores combining ABCD, drift, and CNN predictions
6. **Stores** scan history locally on device (AsyncStorage)
7. **Visualizes** results with risk gauges and timeline view

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│         React Native Mobile App             │
├─────────────────────────────────────────────┤
│ PatientSelectScreen → ScanScreen → History  │
│ • Camera/Gallery picker                     │
│ • Image upload & analysis                   │
│ • Risk visualization                        │
│ • Timeline view                             │
└────────────────┬────────────────────────────┘
                 │ HTTP POST (image + features)
                 ↓
┌─────────────────────────────────────────────┐
│      Flask Backend (Python)                 │
├─────────────────────────────────────────────┤
│ POST /analyze                               │
│ POST /analyze_drift                         │
│ • Load EfficientNet-B4 model                │
│ • Extract features (1792-dim)               │
│ • Compute ABCD scores                       │
│ • Calculate drift between visits            │
│ • Fuse risk score                           │
└────────────────┬────────────────────────────┘
                 │
                 ↓
        ┌────────────────────┐
        │  ML Models         │
        ├────────────────────┤
        │ • EfficientNet-B4  │
        │ • 1792-dim features│
        │ • Drift detector   │
        │ • ABCD extractor   │
        └────────────────────┘
```

---

## 🚀 Quick Start

### Backend Setup (Flask/Python)

1. **Install dependencies:**
   ```bash
   cd mobile-app/backend
   pip install -r requirements.txt
   ```

2. **Verify model checkpoint:**
   - Location: `C:\Users\pc\Documents\ela format pc\LSI3\PFE\models\best_model_b4_benign_0.81.pth`
   - Contains: model weights, class names, validation metrics

3. **Update model path in `app.py`:**
   ```python
   MODEL_PATH = r"C:\Users\pc\Documents\ela format pc\LSI3\PFE\models\best_model_b4_benign_0.81.pth"
   ```

4. **Run Flask server:**
   ```bash
   python app.py
   # Server runs on http://localhost:5000
   ```

5. **Test endpoints:**
   ```bash
   curl http://localhost:5000/health
   # Expected: {"status": "ok", "device": "cpu" | "cuda"}
   ```

### Frontend Setup (React Native)

1. **Install dependencies:**
   ```bash
   cd mobile-app/frontend
   npm install
   # or
   yarn install
   ```

2. **Configure backend URL:**
   Edit `src/services/analysisApi.js`:
   ```javascript
   const BACKEND_URL = 'http://192.168.1.100:5000';  // Change to your PC IP
   ```

   **Find your PC IP:**
   - Windows: `ipconfig` → Look for "IPv4 Address"
   - Mac/Linux: `ifconfig` → Look for "inet"

3. **Run mobile app:**
   ```bash
   npm start
   # Scan QR code with Expo Go app on your phone
   ```

---

## 📁 File Structure

```
mobile-app/
├── backend/
│   ├── app.py                      ← Flask server (NEW)
│   ├── requirements.txt             ← Python dependencies (NEW)
│   ├── setup.sh                     ← Setup script (NEW)
│   └── src/
│       ├── ml/
│       │   └── infer_pytorch.py
│       └── ...
│
└── frontend/
    ├── AppLesionTracking.js         ← Alternative App entry point (NEW)
    ├── src/
    │   ├── navigation/
    │   │   └── LesionTrackingNavigator.js  ← Navigation setup (NEW)
    │   ├── screens/
    │   │   ├── PatientSelectScreen.js      ← Select/create patient (NEW)
    │   │   ├── ScanScreen.js               ← Main camera & analysis (NEW)
    │   │   └── HistoryScreen.js            ← Timeline view (NEW)
    │   └── services/
    │       ├── analysisApi.js              ← Backend API client (NEW)
    │       └── storage.js                  ← AsyncStorage helper (NEW)
    └── package.json
```

---

## 🔌 Backend Endpoints

### `POST /analyze`
First scan - no drift comparison.

**Request:**
```json
{
  "image_base64": "iVBORw0KGgoAAAANS..."
}
```

**Response:**
```json
{
  "prediction": "Melanoma",
  "confidence": 0.84,
  "abcd": {
    "A": 0.6,
    "B": 0.4,
    "C": 0.3,
    "D": 0.5
  },
  "features": [0.123, 0.456, ..., 0.789],  // 1792 floats
  "risk_score": 0.72,
  "drift": null,
  "drift_label": null
}
```

### `POST /analyze_drift`
Subsequent scans - compares to previous features.

**Request:**
```json
{
  "image_base64": "iVBORw0KGgoAAAANS...",
  "previous_features": [0.123, 0.456, ..., 0.789]  // 1792 floats from previous scan
}
```

**Response:**
```json
{
  "prediction": "Melanoma",
  "confidence": 0.82,
  "abcd": {...},
  "features": [...],
  "risk_score": 0.75,
  "drift": 0.18,
  "drift_label": "Moderate"  // "Stable" | "Moderate" | "Significant"
}
```

### `GET /health`
Health check.

**Response:**
```json
{
  "status": "ok",
  "device": "cuda" | "cpu"
}
```

### `GET /info`
Model info.

**Response:**
```json
{
  "device": "cuda",
  "class_names": ["Actinic keratosis", "Basal cell carcinoma", ...],
  "feature_dim": 1792,
  "endpoints": ["/health", "/info", "/analyze", "/analyze_drift"]
}
```

---

## 📱 Mobile App Flow

### 1. **Patient Select Screen**
- List all patients with scan stats
- Create new patient
- Delete patient data
- Shows: # scans, latest date, risk indicator

### 2. **Scan Screen**
- **Image Selection:**
  - Take photo (camera)
  - Select from gallery
  - Preview before analysis

- **Analysis:**
  - Press "Analyze" button
  - Shows loading indicator
  - Automatically uses drift if previous scan exists

- **Results Display:**
  - Risk gauge (0-100%, colored by risk level)
  - Classification & confidence
  - ABCD horizontal bar chart
  - Feature drift + label (if applicable)
  - Warning banner if risk > 0.6 or drift is Significant

- **Save/Discard:**
  - Save to AsyncStorage history
  - View history or start new scan

### 3. **History Screen**
- Timeline of all scans (newest first)
- Each entry shows:
  - Date & time
  - Prediction class
  - Risk score (colored dot)
  - Drift label (if computed)
  - Confidence %

- **Tap entry** → Full detail modal with:
  - Original image
  - Risk gauge
  - ABCD chart
  - Drift details
  - Metadata (timestamp, scan ID)

---

## 🔐 Data Storage (Local AsyncStorage)

### Storage Keys
```
lesion_tracking:patients              // List of patient IDs
lesion_tracking:patient:{id}:scans    // Array of scans for patient
```

### Scan Object Schema
```javascript
{
  id: "1234567890-abc123",            // Unique scan ID
  timestamp: "2024-05-04T14:30:00Z",  // ISO timestamp
  image_uri: "file:///...",           // Local file URI
  prediction: "Melanoma",
  confidence: 0.84,
  abcd: {
    A: 0.6,
    B: 0.4,
    C: 0.3,
    D: 0.5
  },
  features: [0.123, 0.456, ...],      // 1792-dim vector
  risk_score: 0.72,
  drift: 0.18,                         // null for first scan
  drift_label: "Moderate"              // null for first scan
}
```

### Helper Functions (storage.js)
```javascript
// Save a new scan
await saveScan(patientId, scanData);

// Get all scans for patient (sorted by date, newest first)
const scans = await getPatientScans(patientId);

// Get most recent scan (for drift comparison)
const lastScan = await getLastScan(patientId);

// Get specific scan by ID
const scan = await getScanById(patientId, scanId);

// Delete a scan
await deleteScan(patientId, scanId);

// Get storage statistics
const stats = await getStorageStats();
```

---

## 🎨 UI Components

### Risk Gauge
- Circular progress indicator (0-100%)
- Color-coded:
  - 🟢 Green (< 30%)   → Low Risk
  - 🟠 Orange (30-60%) → Moderate Risk
  - 🔴 Red (> 60%)     → High Risk

### ABCD Chart
- Horizontal bar chart with 4 bars
- Each bar: 0-1.0 range
- Labels: A (Asymmetry), B (Border), C (Color), D (Diameter)

### Timeline View
- Vertical timeline with color-coded dots
- Scan cards showing:
  - Date & time
  - Prediction
  - Risk % badge
  - Drift label
  - Confidence %

### Warning Banner
- Red alert box with ⚠️ icon
- Shows if: drift = "Significant" OR risk > 0.6
- Message: "⚠️ Significant change detected — please consult a dermatologist"

---

## 🔧 Configuration

### Backend Configuration (app.py)
```python
# Model path
MODEL_PATH = r"C:\Users\pc\Documents\ela format pc\LSI3\PFE\models\best_model_b4_benign_0.81.pth"

# Device (auto-detects GPU)
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# Max image size
MAX_IMAGE_SIZE = 50 * 1024 * 1024  # 50MB

# Server port
app.run(host="0.0.0.0", port=5000)
```

### Frontend Configuration (analysisApi.js)
```javascript
// Backend URL - UPDATE THIS to your PC IP
const BACKEND_URL = 'http://192.168.1.100:5000';

// Request timeout
timeout: 60000  // 60 seconds for model inference
```

### Image Upload
- Format: Base64-encoded JPEG/PNG
- Quality: 0.8 (80% compression for faster upload)
- Max size: 50MB

---

## 🛠️ Troubleshooting

### Backend Issues

**Model not loading:**
```
❌ FileNotFoundError: Model checkpoint not found
```
→ Check `MODEL_PATH` in `app.py` matches actual file location

**CUDA out of memory:**
```
❌ RuntimeError: CUDA out of memory
```
→ Reduce image size or use CPU: `DEVICE = "cpu"`

**Port already in use:**
```
❌ OSError: [Errno 48] Address already in use
```
→ Change port: `app.run(port=5001)` or kill process on port 5000

### Frontend Issues

**Backend connection timeout:**
```
❌ Error analyzing image: Backend returned 408
```
→ Check backend URL in `analysisApi.js` matches your PC IP
→ Ensure both phone and PC are on same WiFi network
→ Test with: `curl http://<YOUR_PC_IP>:5000/health`

**AsyncStorage error:**
```
❌ AsyncStorage is not supported by current environment
```
→ Install: `npm install @react-native-async-storage/async-storage`

**Camera permission denied:**
→ Grant camera + photo library permissions when prompted

**Image picker not working:**
→ Ensure Expo Go app has media permissions (Settings → Permissions)

---

## 🚀 Deployment Options

### 1. Local Development
- Flask on laptop (http://localhost:5000)
- Mobile app via Expo Go
- Best for testing

### 2. Network Development
- Flask on local PC (http://192.168.x.x:5000)
- Mobile app on same WiFi
- Good for real device testing

### 3. Production (Cloud)
- Deploy Flask to cloud (AWS, Azure, Heroku, etc.)
- Update `BACKEND_URL` to cloud endpoint
- Add HTTPS, auth, rate limiting

Example cloud deployment (Heroku):
```bash
cd mobile-app/backend
git init
git add .
git commit -m "Initial commit"
heroku create lesio-backend
git push heroku main
# App runs at https://lesio-backend.herokuapp.com
```

---

## 📊 Feature Drift Algorithm

```
Drift Detection:
1. Extract 1792-dim feature vector from previous scan
2. Extract 1792-dim feature vector from current scan
3. Compute cosine distance between vectors
4. Classify drift:
   - drift < 0.15   → "Stable"
   - drift < 0.30   → "Moderate"
   - drift ≥ 0.30   → "Significant"

Risk Score Fusion (0-1):
  Risk = 0.10×A + 0.10×B + 0.10×C + 0.10×D 
         + 0.30×drift + 0.30×malignancy_prob

  where:
    A, B, C, D = ABCD dermoscopy scores
    drift = cosine distance (0-1 normalized)
    malignancy_prob = P(malignant class) from CNN
```

---

## 📚 Dependencies

### Backend (Python)
- `flask` - Web framework
- `torch` - PyTorch deep learning
- `timm` - EfficientNet models
- `opencv-python` - Image processing (ABCD)
- `scipy` - Cosine distance calculation
- `numpy` - Numerical operations
- `scikit-learn` - K-means clustering

### Frontend (React Native)
- `@react-navigation` - Navigation
- `expo-camera` - Camera access
- `expo-image-picker` - Gallery picker
- `@react-native-async-storage` - Local storage
- `@expo/vector-icons` - Icons (Ionicons)

---

## 📖 Usage Example

### Create Patient & Scan
```javascript
// Patient Select Screen
// → New Patient → Enter "PAT-001"

// Scan Screen
// → Take Photo
// → Review image
// → Analyze
// → View results
// → Save to History

// History Screen
// → View timeline
// → Tap scan for details
```

### Longitudinal Tracking
```javascript
// First Visit
// → Scan lesion
// → Save (features saved locally)

// Second Visit (weeks/months later)
// → New scan same lesion
// → System automatically compares features
// → Shows drift + updated risk

// Third+ Visits
// → Continuous monitoring
// → Track disease progression
// → Detect significant changes
```

---

## ✅ Testing Checklist

- [ ] Backend server starts without errors
- [ ] `/health` endpoint returns 200
- [ ] `/info` endpoint shows model classes
- [ ] Mobile app connects to backend
- [ ] First scan completes analysis
- [ ] Results display properly
- [ ] Scan saves to AsyncStorage
- [ ] Second scan shows drift
- [ ] History timeline populates
- [ ] Risk gauge colors correctly
- [ ] Warning banner shows for high risk
- [ ] Delete functionality works
- [ ] All screens navigate properly

---

## 🤝 Integration with Existing App

If you have an existing app structure, integrate lesion tracking as:

1. **Tab Navigator:**
   ```javascript
   <Tab.Screen name="Lesion" component={LesionTrackingNavigator} />
   ```

2. **Stack Screen:**
   ```javascript
   <Stack.Screen name="LesionTracking" component={LesionTrackingNavigator} />
   ```

3. **Conditional Rendering:**
   ```javascript
   {user?.role === 'patient' && <LesionTrackingNavigator />}
   ```

See `AppLesionTracking.js` for examples.

---

## 📞 Support

For issues or questions:

1. Check logs:
   - Backend: `python app.py` console output
   - Frontend: `expo start` terminal output
   - AsyncStorage: React DevTools

2. Enable verbose logging:
   ```javascript
   // In storage.js and analysisApi.js
   console.log('🔍 Debug message:', data);
   ```

3. Validate data:
   ```javascript
   // Check AsyncStorage contents
   const stats = await getStorageStats();
   console.log(JSON.stringify(stats, null, 2));
   ```

---

## 📄 License

[Your license here]

---

**Version:** 1.0.0  
**Last Updated:** May 4, 2024  
**Status:** Production Ready
