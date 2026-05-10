# Comprehensive Testing Guide

## Overview
This guide provides detailed testing procedures for the Longitudinal Lesion Tracking system. Follow these tests sequentially to ensure all components are working correctly.

---

## Part 1: Backend Setup & Testing

### Test 1.1: Python Environment
**Objective:** Verify Python installation and virtual environment

```bash
# Check Python version
python --version
# Expected: Python 3.8 or higher

# Create virtual environment (optional but recommended)
python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Activate (Mac/Linux)
source venv/bin/activate

# Expected: (venv) prefix in terminal
```

**✅ Pass:** Python 3.8+ installed and activated

---

### Test 1.2: Dependency Installation
**Objective:** Verify all Python packages install correctly

```bash
cd mobile-app/backend
pip install -r requirements.txt
```

**Expected output:**
```
Successfully installed flask-2.3.0 flask-cors-4.0.0 torch-2.0.0 ...
```

**✅ Pass:** All dependencies installed without errors

---

### Test 1.3: Model Checkpoint
**Objective:** Verify model file exists and is accessible

```bash
# Windows PowerShell
Test-Path "C:\Users\pc\Documents\ela format pc\LSI3\PFE\models\best_model_b4_benign_0.81.pth"
# Expected: True

# Mac/Linux
ls -la ~/path/to/model/best_model_b4_benign_0.81.pth
# Expected: File exists
```

**✅ Pass:** Model file exists at correct location

---

### Test 1.4: Flask Server Startup
**Objective:** Verify Flask server starts and loads model

```bash
cd mobile-app/backend
python app.py
```

**Expected console output:**
```
🔧 Device: cuda (or cpu)
🔧 Model path: C:\Users\pc\Documents\...
📦 Loading EfficientNet-B4 model...
✅ Classes from checkpoint : ['Actinic keratosis', 'Basal cell carcinoma', ...]
✅ Num classes             : 5
✅ Model loaded. Classes: [...]
 * Running on http://0.0.0.0:5000 (Press CTRL+C to quit)
```

**⚠️ Common Issues:**
- Port 5000 already in use → Change port in `app.py`
- Model not found → Check path in `app.py`
- CUDA not available → Falls back to CPU (slower)

**✅ Pass:** Server running on port 5000 without errors

---

### Test 1.5: Health Endpoint
**Objective:** Test basic endpoint connectivity

```bash
# Method 1: Browser
# Open: http://localhost:5000/health

# Method 2: curl
curl http://localhost:5000/health

# Method 3: PowerShell
Invoke-WebRequest http://localhost:5000/health
```

**Expected response:**
```json
{
  "status": "ok",
  "device": "cuda" or "cpu"
}
```

**Status code:** 200 OK

**✅ Pass:** Health endpoint returns 200 with correct JSON

---

### Test 1.6: Info Endpoint
**Objective:** Verify model information endpoint

```bash
curl http://localhost:5000/info
```

**Expected response:**
```json
{
  "device": "cuda",
  "class_names": [
    "Actinic keratosis",
    "Basal cell carcinoma",
    "Benign",
    "Melanoma",
    "Squamous cell carcinoma"
  ],
  "feature_dim": 1792,
  "endpoints": ["/health", "/info", "/analyze", "/analyze_drift"]
}
```

**✅ Pass:** Info endpoint returns correct model metadata

---

### Test 1.7: Analyze Endpoint (Test Image)
**Objective:** Test single image analysis

**Setup:** Create a test image (use a lesion image or download sample)

```bash
# Using curl with base64-encoded image
# First, convert image to base64:
# Windows PowerShell:
$imageBase64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes("path\to\image.jpg"))

# Create JSON payload:
$body = @{
    image_base64 = $imageBase64
} | ConvertTo-Json

# Send request:
Invoke-WebRequest `
  -Uri "http://localhost:5000/analyze" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body

# Or using curl (Linux/Mac):
curl -X POST http://localhost:5000/analyze \
  -H "Content-Type: application/json" \
  -d '{"image_base64":"'"$imageBase64"'"}'
```

**Expected response:**
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
  "features": [0.123, 0.456, ..., 0.789],  // 1792 elements
  "risk_score": 0.72,
  "drift": null,
  "drift_label": null
}
```

**Validation:**
- prediction: string (matches one of class_names)
- confidence: 0 ≤ confidence ≤ 1
- abcd: 0 ≤ A,B,C,D ≤ 1
- features: array of 1792 floats
- risk_score: 0 ≤ score ≤ 1
- drift: null (first scan)

**✅ Pass:** Analysis returns correct response format and values

---

### Test 1.8: Analyze Drift Endpoint
**Objective:** Test drift detection between two images

**Setup:** Use same image from Test 1.7 to get features array

```bash
# Get features from previous scan response
$previousFeatures = @([0.123, 0.456, ..., 0.789])  # 1792 values

# Prepare drift request
$driftBody = @{
    image_base64 = $imageBase64
    previous_features = $previousFeatures
} | ConvertTo-Json

# Send drift analysis request
Invoke-WebRequest `
  -Uri "http://localhost:5000/analyze_drift" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body $driftBody
```

**Expected response:**
```json
{
  "prediction": "Melanoma",
  "confidence": 0.84,
  "abcd": { "A": 0.6, "B": 0.4, "C": 0.3, "D": 0.5 },
  "features": [0.123, 0.456, ..., 0.789],
  "risk_score": 0.72,
  "drift": 0.05,           // NEW: cosine distance
  "drift_label": "Stable"  // NEW: Stable/Moderate/Significant
}
```

**Validation:**
- drift: 0 ≤ drift ≤ 1
- drift_label: "Stable" OR "Moderate" OR "Significant"
- Drift logic:
  - 0.05 → "Stable" ✓
  - 0.22 → "Moderate" ✓
  - 0.35 → "Significant" ✓

**✅ Pass:** Drift endpoint calculates correct drift scores

---

## Part 2: Frontend Setup & Testing

### Test 2.1: Node.js Environment
**Objective:** Verify Node.js and npm installation

```bash
node --version      # Expected: v16.0.0 or higher
npm --version       # Expected: v7.0.0 or higher
```

**✅ Pass:** Node.js and npm installed

---

### Test 2.2: Dependency Installation
**Objective:** Install all React Native packages

```bash
cd mobile-app/frontend
npm install
```

**Expected output:**
```
added XXX packages in XX seconds
```

**✅ Pass:** All dependencies installed

---

### Test 2.3: Find PC IP Address
**Objective:** Get IP for mobile app to connect to backend

**Windows:**
```powershell
ipconfig
# Look for "IPv4 Address" under active connection
# Example: 192.168.1.100
```

**Mac:**
```bash
ifconfig
# Look for "inet" address (not 127.0.0.1)
```

**Record:** Write down your IP: `___.___.___.___`

**✅ Pass:** IP address identified

---

### Test 2.4: Update Backend URL
**Objective:** Configure mobile app to connect to backend

Edit `mobile-app/frontend/src/services/analysisApi.js`:

```javascript
// BEFORE:
const BACKEND_URL = process.env.BACKEND_URL || 'http://192.168.1.100:5000';

// AFTER (replace with YOUR IP):
const BACKEND_URL = 'http://YOUR_IP_HERE:5000';
// Example: const BACKEND_URL = 'http://192.168.1.100:5000';
```

**✅ Pass:** Backend URL updated to your PC IP

---

### Test 2.5: Start Expo Development Server
**Objective:** Launch React Native development server

```bash
npm start
```

**Expected output:**
```
 ✔ Metro server started
 › Scan the QR code below with Expo Go
 
  [QR Code displayed]
 
 › Press w to open web client
 › Press a to open Android emulator
 › Press i to open iOS simulator
```

**✅ Pass:** Expo server running and QR code displayed

---

### Test 2.6: Launch Mobile App
**Objective:** Run app on physical device or emulator

**Option A: Physical Device**
1. Install Expo Go from App Store or Google Play
2. Open Expo Go
3. Tap "Scan QR Code"
4. Scan QR from terminal
5. Wait 10-30 seconds

**Option B: Android Emulator**
```bash
npm start
# Press 'a' in terminal
```

**Option C: iOS Simulator**
```bash
npm start
# Press 'i' in terminal
```

**Expected:** App loads to PatientSelectScreen (white background, "Lesion Tracking" header)

**✅ Pass:** App launches successfully

---

## Part 3: Feature Testing

### Test 3.1: Create Patient
**Objective:** Test patient creation flow

**Steps:**
1. App shows "PatientSelectScreen"
2. Tap **"New Patient"** button (blue)
3. Modal appears with text input
4. Enter test patient ID: `TEST_PAT_001`
5. Tap **"Create"** button
6. App navigates to ScanScreen

**Validation:**
- Modal closes
- ScanScreen appears
- Header shows "Patient: TEST_PAT_001"

**✅ Pass:** Patient created and navigated to scan screen

---

### Test 3.2: Image Selection (Gallery)
**Objective:** Test image picker functionality

**Steps:**
1. On ScanScreen, tap **"From Gallery"** button
2. Photo library opens
3. Select any image (preferably skin/lesion image)
4. Image preview shows in app

**Validation:**
- Gallery picker opens
- Image loads in preview
- Analyze button becomes active

**✅ Pass:** Image selected and displayed

---

### Test 3.3: Image Analysis
**Objective:** Test image analysis API call

**Steps:**
1. Review image on ScanScreen
2. Tap **"Analyze"** button
3. Loading indicator appears
4. Wait 10-30 seconds (depends on GPU/CPU)

**Expected:**
- Loading spinner visible
- Backend receives image
- Analysis processes

**Backend console should show:**
```
📸 Image shape: (H, W, 3)
✅ ABCD extracted: A=0.xxx, B=0.xxx, C=0.xxx, D=0.xxx
✅ Features extracted: shape=(1792,)
✅ Prediction: Melanoma (0.84)
✅ Risk score: 0.72
```

**✅ Pass:** Analysis completes without errors

---

### Test 3.4: Results Display
**Objective:** Verify results screen formatting

**Expected UI Elements:**
1. ✅ Risk gauge (circular, colored)
   - Percentage displayed (0-100%)
   - Color matches risk level
   - Text label (Low/Moderate/High Risk)

2. ✅ Classification card
   - Predicted class shown (e.g., "Melanoma")
   - Confidence percentage

3. ✅ ABCD chart
   - Four horizontal bars (A, B, C, D)
   - Each 0-1.0 range
   - Labels and values visible

4. ✅ Details card
   - Risk score percentage
   - Timestamp
   - Feature dimension (1792)

**Validation:**
- All elements present and correctly formatted
- No layout issues or overlapping text
- Colors appropriate for risk level

**✅ Pass:** Results display correctly

---

### Test 3.5: Save Scan
**Objective:** Test save to history

**Steps:**
1. On results screen, tap **"Save to History"** button
2. Alert dialog appears
3. Tap **"New Scan"** or **"View History"**

**Validation:**
- Alert confirms save
- Navigation works
- Scan appears in history (if viewed)

**Backend AsyncStorage:**
```javascript
// Should save object with structure:
{
  id: "timestamp-hash",
  timestamp: "2024-05-04T...",
  image_uri: "file://...",
  prediction: "Melanoma",
  confidence: 0.84,
  abcd: {...},
  features: [...1792 floats...],
  risk_score: 0.72,
  drift: null,
  drift_label: null
}
```

**✅ Pass:** Scan saved to local storage

---

### Test 3.6: View History (First Scan)
**Objective:** Test history screen with one scan

**Steps:**
1. From PatientSelectScreen, select patient
2. Tap history icon (top right)
3. HistoryScreen displays

**Expected:**
1. Timeline with one scan
   - Colored dot (risk color)
   - Scan card showing:
     - Date & time
     - Prediction class
     - Risk % badge
     - Confidence %
   - No drift info (first scan)

2. Delete button on scan card

3. New Scan button (bottom right)

**Validation:**
- Timeline displays correctly
- Scan info accurate
- Navigation working

**✅ Pass:** History displays correctly with one scan

---

### Test 3.7: Second Scan (Drift Detection)
**Objective:** Test drift detection flow

**Steps:**
1. From history, tap **"New Scan"** button
2. Take/select another image (similar lesion)
3. Tap **"Analyze"**

**Expected Behavior:**
- System detects previous scan
- Uses `/analyze_drift` instead of `/analyze`
- Results include:
  - `drift` value (number)
  - `drift_label` ("Stable"/"Moderate"/"Significant")
  - Updated `risk_score`

**Backend should log:**
```
📊 Using drift analysis (previous scan found)
📸 Image shape: ...
📊 Previous features shape: (1792,)
✅ Drift computed: 0.18 (Moderate)
```

**Results screen should show:**
- Drift card with score and label
- Updated risk gauge
- Possibly warning banner (if drift significant)

**✅ Pass:** Drift detection works correctly

---

### Test 3.8: Alert Banner (High Risk)
**Objective:** Test warning banner for significant findings

**Steps:**
1. Take a scan that would have high risk (>0.6) OR significant drift
2. Review results

**Expected:**
- Orange/red warning banner appears
- Icon: ⚠️
- Message: "Significant change detected — please consult a dermatologist"

**Validation:**
- Banner only shows if risk ≥ 0.6 OR drift = "Significant"
- Doesn't show for low/moderate risk

**✅ Pass:** Alert banner displays correctly

---

### Test 3.9: History Timeline (Two Scans)
**Objective:** Test timeline with multiple scans

**Steps:**
1. After second scan saved, go to history
2. View timeline

**Expected:**
- Two timeline entries (newest first)
- Both with colored dots
- Second scan shows drift badge
- Scan cards show prediction, risk, drift info
- Timeline line connecting dots

**Validation:**
- Correct order (newest first)
- Drift info present on second scan
- Timeline properly formatted

**✅ Pass:** Timeline displays multiple scans correctly

---

### Test 3.10: Delete Scan
**Objective:** Test scan deletion

**Steps:**
1. On history, tap trash icon on a scan
2. Confirm dialog appears
3. Tap "Delete"

**Expected:**
- Scan removed from timeline
- Alert: "Scan deleted from history"
- Timeline updates

**✅ Pass:** Scan deletion works

---

### Test 3.11: Navigation
**Objective:** Test all navigation flows

**Test Cases:**
1. PatientSelect → Create → Scan ✓
2. Scan → Take Photo → Analyze → Results → Save ✓
3. Results → View History → HistoryScreen ✓
4. History → New Scan → ScanScreen ✓
5. History → Back → PatientSelect ✓
6. ScanScreen → Back → PatientSelect ✓

**Validation:**
- All transitions smooth
- No errors
- Data persists across navigation

**✅ Pass:** All navigation flows work

---

## Part 4: End-to-End Integration Test

### Test 4.1: Complete User Journey
**Objective:** Full workflow from patient creation to longitudinal tracking

**Scenario:** Patient monitoring suspicious mole over 2 weeks

**Week 1:**
```
1. App launch → PatientSelectScreen
2. Create patient: "PATIENT_MOLE_TEST"
3. Take photo of mole
4. Analyze → Result: Benign (0.45 risk)
5. Save to history
6. Go to history → See 1 scan
```

**Week 2:**
```
1. Select same patient
2. Take new photo of same area
3. Analyze → Result: Benign (0.52 risk) + Moderate drift
4. Save to history
5. Go to history → See 2 scans with drift info
6. Risk changed: 0.45 → 0.52
7. Drift: Moderate (0.22 cosine distance)
```

**Validation:**
- All steps complete without errors
- Data persists correctly
- Drift properly calculated
- Timeline shows progression
- Risk scores reasonable

**✅ Pass:** Complete workflow successful

---

## Part 5: Performance Testing

### Test 5.1: Load Time
**Objective:** Measure application load times

| Component | Expected | Test Result |
|-----------|----------|-------------|
| App startup | <5s | _____ |
| First screen render | <2s | _____ |
| Model load | 15-45s | _____ |
| Image analysis | 5-20s | _____ |
| History load | <1s | _____ |
| Timeline render | <2s | _____ |

**✅ Pass:** All times within acceptable range

---

### Test 5.2: Memory Usage
**Objective:** Monitor memory consumption

**Tools:**
- Android: Android Profiler (Android Studio)
- iOS: Xcode Memory Debugger
- Backend: `top` or Task Manager

**Acceptable Ranges:**
- Mobile app: <200MB
- Backend process: <500MB (with model loaded)

**✅ Pass:** Memory usage within limits

---

## Part 6: Error Handling Tests

### Test 6.1: Backend Connection Error
**Objective:** Test behavior when backend unavailable

**Steps:**
1. Stop Flask server
2. Try to analyze image
3. Wait for timeout (60 seconds)

**Expected:**
- Error message displayed
- User can retry or discard

**Message example:**
```
"Analysis Failed: Backend returned 408"
or "Network request failed"
```

**✅ Pass:** Error handled gracefully

---

### Test 6.2: Invalid Image
**Objective:** Test with invalid image format

**Steps:**
1. Try to upload non-image file (PDF, text, etc.)
2. Observe response

**Expected:**
- Error message
- File rejected before upload

**✅ Pass:** Invalid file rejected

---

### Test 6.3: Network Timeout
**Objective:** Test slow network scenario

**Steps:**
1. Use network throttling (dev tools)
2. Set to slow 3G
3. Try analysis

**Expected:**
- Longer wait time
- Eventually succeeds or times out with error
- No app crash

**✅ Pass:** Handles slow network gracefully

---

## Part 7: Data Validation

### Test 7.1: Risk Score Range
**Objective:** Verify risk scores are always 0-1

**Test Multiple Scans:**
- Light lesion (likely benign) → risk < 0.3 ✓
- Typical mole → 0.3 < risk < 0.6 ✓
- Dark suspicious lesion → risk > 0.6 ✓

**Validation:**
- All scores in [0, 1] range
- Scores reasonable for input

**✅ Pass:** Risk scores valid

---

### Test 7.2: Feature Vector Integrity
**Objective:** Verify feature vectors maintain dimension

**Check:**
- Every scan has 1792 features ✓
- Features are floats ✓
- No NaN or Inf values ✓
- Values normalized approximately in [-1, 1]

**✅ Pass:** Features valid

---

### Test 7.3: Drift Calculation
**Objective:** Verify drift logic

**Test Cases:**
- Same image twice → drift ≈ 0 (Stable) ✓
- Slightly modified image → 0.1-0.2 (Stable) ✓
- Different region → 0.2-0.35 (Moderate) ✓
- Completely different → >0.35 (Significant) ✓

**✅ Pass:** Drift calculation correct

---

## Part 8: Security & Privacy Tests

### Test 8.1: Local Storage Only
**Objective:** Verify no cloud upload

**Steps:**
1. Monitor network traffic (Wireshark, Charles Proxy)
2. Take scans and save
3. Check network requests

**Expected:**
- Only requests to `http://YOUR_IP:5000`
- No upload to external services
- Images only in local AsyncStorage

**✅ Pass:** Data remains local

---

### Test 8.2: Data Encryption
**Objective:** Verify sensitive data protection

**Check:**
- AsyncStorage data not human-readable ✓
- Proper permissions on files ✓
- No logs contain sensitive data ✓

**✅ Pass:** Data properly protected

---

## Final Verification Checklist

### Backend ✅
- [ ] Flask server starts without errors
- [ ] Model loads successfully (10-45 seconds)
- [ ] `/health` endpoint works
- [ ] `/info` endpoint works
- [ ] `/analyze` endpoint works
- [ ] `/analyze_drift` endpoint works
- [ ] ABCD scores in range [0,1]
- [ ] Feature dimension is 1792
- [ ] Risk scores in range [0,1]
- [ ] Drift scores in range [0,1]

### Frontend ✅
- [ ] App launches without crashes
- [ ] PatientSelectScreen displays
- [ ] Can create patient
- [ ] Can navigate to ScanScreen
- [ ] Camera/gallery picker works
- [ ] Image preview displays
- [ ] Analyze button functional
- [ ] Results display correctly
- [ ] Risk gauge shows correct color
- [ ] ABCD chart renders
- [ ] Can save scan
- [ ] Can view history
- [ ] Timeline displays
- [ ] Can delete scan
- [ ] All navigation works

### Integration ✅
- [ ] Mobile app connects to backend
- [ ] First scan analysis works
- [ ] Results display correctly
- [ ] Scan saves to local storage
- [ ] Second scan detects drift
- [ ] Drift label correct
- [ ] History shows progression
- [ ] Timeline order correct (newest first)
- [ ] All data persists

### Performance ✅
- [ ] App startup: <5 seconds
- [ ] Model load: <1 minute
- [ ] Analysis: <30 seconds
- [ ] History load: <2 seconds
- [ ] No memory leaks
- [ ] Smooth animations

### Error Handling ✅
- [ ] Network errors handled
- [ ] Invalid images rejected
- [ ] Timeouts managed
- [ ] Clear error messages
- [ ] Graceful degradation

---

## Test Results Summary

| Category | Tests | Passed | Failed | Notes |
|----------|-------|--------|--------|-------|
| Backend Setup | 8 | ___ | ___ | |
| Frontend Setup | 6 | ___ | ___ | |
| Features | 11 | ___ | ___ | |
| Integration | 1 | ___ | ___ | |
| Performance | 2 | ___ | ___ | |
| Error Handling | 3 | ___ | ___ | |
| Data Validation | 3 | ___ | ___ | |
| Security | 2 | ___ | ___ | |
| **TOTAL** | **36** | ___ | ___ | |

---

## Sign-Off

**Tester Name:** ________________  
**Date:** ________________  
**Device:** ________________  
**Overall Status:** ☐ Pass ☐ Fail  

**Issues Found:**
```
[List any issues or blockers]
```

**Notes:**
```
[Additional observations]
```

---

**End of Testing Guide**  
Version: 1.0  
Last Updated: May 4, 2024
