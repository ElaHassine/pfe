# Longitudinal Lesion Tracking - Quick Start Guide

## ⚡ 5-Minute Setup

### Prerequisites
- Python 3.8+ installed
- Node.js 16+ and npm installed  
- Model checkpoint at: `C:\Users\pc\Documents\ela format pc\LSI3\PFE\models\best_model_b4_benign_0.81.pth`
- Phone with Expo Go app (iOS/Android)
- Phone & PC on same WiFi network

---

## 🔧 Step 1: Backend Setup (5 min)

### 1.1 Install Python Dependencies
```bash
cd mobile-app/backend
pip install -r requirements.txt
```

### 1.2 Verify Model Path
Open `app.py` and confirm:
```python
MODEL_PATH = r"C:\Users\pc\Documents\ela format pc\LSI3\PFE\models\best_model_b4_benign_0.81.pth"
```

### 1.3 Start Flask Server
```bash
python app.py
```

Expected output:
```
🔧 Device: cuda  (or cpu)
🔧 Model path: C:\Users\pc\...
📦 Loading EfficientNet-B4 model...
✅ Model loaded. Classes: ['Actinic keratosis', ...]
 * Running on http://0.0.0.0:5000
```

### 1.4 Test Health
Open browser and go to: `http://localhost:5000/health`

Expected: `{"status": "ok", "device": "cuda"}`

✅ **Backend is ready!**

---

## 📱 Step 2: Frontend Setup (5 min)

### 2.1 Install Dependencies
```bash
cd mobile-app/frontend
npm install
```

### 2.2 Find Your PC IP Address

**Windows:**
```bash
ipconfig
# Look for "IPv4 Address" under your active connection
# Example: 192.168.1.100
```

**Mac/Linux:**
```bash
ifconfig
# Look for "inet" address
```

### 2.3 Update Backend URL
Edit `src/services/analysisApi.js`:
```javascript
const BACKEND_URL = 'http://192.168.1.100:5000';  // ← Your PC IP
```

Or edit `src/config/appConfig.js`:
```javascript
URL: process.env.REACT_APP_BACKEND_URL || 'http://192.168.1.100:5000',
```

### 2.4 Start Mobile App
```bash
npm start
```

Expected output:
```
 ✔ Metro server started
 › To view your app with Live Reloader, press w in the terminal
 › Press a to open Android or i for iOS
 › Press s to open the web client
 › Scan the QR code below with Expo Go
```

### 2.5 Run on Phone
- Open **Expo Go** app
- Tap **Scan QR Code**
- Scan code from terminal
- Wait 10-30 seconds for app to load

✅ **Frontend is running!**

---

## 🎯 Step 3: Test the Feature (5 min)

### 3.1 Create Patient
1. App opens to **Patient Select Screen**
2. Tap **New Patient** button
3. Enter patient ID (e.g., "PAT-001")
4. Tap **Create**

### 3.2 Take First Scan
1. **Scan Screen** opens
2. Tap **Take Photo** or **From Gallery**
3. Select or take a lesion image
4. Tap **Analyze**
5. Wait for processing...

Expected results:
```
✅ Analysis complete:
   prediction: Melanoma
   confidence: 0.84 (84%)
   risk_score: 0.72 (72%)
```

### 3.3 Review Results
- Risk gauge shows colored indicator
- ABCD scores shown as horizontal bars
- Classification and confidence displayed
- Tap **Save to History**

### 3.4 View History
1. Back to app home
2. Patient card shows "1 scans"
3. Tap **View** or go to **Scan** → tap **History**
4. Timeline shows your first scan

✅ **Feature is working!**

---

## 🔄 Step 4: Test Drift Detection (10 min)

### 4.1 Take Second Scan
1. From **Patient Select Screen**, select same patient
2. **Scan Screen** opens
3. Take another photo of same lesion (slightly different angle)
4. Tap **Analyze**

### 4.2 Expected Results
System automatically detects previous scan and computes drift:
```
✅ Drift analysis complete:
   drift: 0.18 (cosine distance)
   drift_label: Moderate
   risk_score: 0.75 (updated with drift)
```

### 4.3 View Both Scans
1. Go to **History**
2. Timeline shows both scans
3. Tap second scan → **Drift: Moderate** badge visible
4. Risk indicators show progression

✅ **Longitudinal tracking working!**

---

## ⚙️ Troubleshooting

### Backend won't start
```
❌ ModuleNotFoundError: No module named 'torch'
```
**Fix:** Run `pip install -r requirements.txt` again

```
❌ FileNotFoundError: [Errno 2] No such file or directory
```
**Fix:** Check MODEL_PATH in `app.py` - copy full Windows path with `r` prefix

### Mobile app won't connect
```
❌ Network request failed
```
**Fix:** 
1. Ensure phone is on same WiFi as PC
2. Check backend URL in `analysisApi.js` has correct IP
3. Verify Flask server is running: `http://<YOUR_IP>:5000/health` in browser
4. Try pinging PC from phone terminal: `ping <YOUR_IP>`

### Analysis takes too long
```
⏳ Analyzing... (>30 seconds)
```
**Possible causes:**
- GPU not available → Switch to CPU (slower but works)
- Large image → Compression reduces size but speeds up processing
- Network slow → Ensure good WiFi connection

**Fix:** On slow device, edit `app.py`:
```python
DEVICE = "cpu"  # Force CPU mode
```

### Camera permission denied
```
❌ Camera permission required
```
**Fix:** 
1. Close Expo Go app
2. Settings → Permissions → Camera/Photos → Enable
3. Restart Expo Go

### AsyncStorage errors
```
❌ AsyncStorage.getItem not found
```
**Fix:** Install async storage:
```bash
npm install @react-native-async-storage/async-storage
```

---

## 📊 Next Steps

### Advanced Configuration

1. **Enable GPU acceleration** (if CUDA available):
   - Ensure PyTorch with CUDA: `pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118`
   - Restart Flask server

2. **Cloud deployment**:
   - Deploy Flask to Heroku, AWS, or Azure
   - Update `BACKEND_URL` to cloud endpoint
   - Add HTTPS and authentication

3. **Custom models**:
   - Replace model checkpoint with your own
   - Update `class_names` in Flask app
   - Retrain if needed

4. **Database integration**:
   - Currently uses local AsyncStorage
   - Can add cloud backend (Firebase, PostgreSQL, etc.)
   - Sync data to server

5. **Additional features**:
   - Export scans as PDF report
   - Share with dermatologist
   - Multi-user support
   - Doctor dashboard

---

## 📋 Verification Checklist

- [ ] Flask server running on `http://localhost:5000`
- [ ] `/health` endpoint returns 200 OK
- [ ] Model loads without errors (check console)
- [ ] Mobile app opens to Patient Select screen
- [ ] Can create new patient
- [ ] Camera/gallery picker works
- [ ] First scan completes analysis
- [ ] Results display with gauges and charts
- [ ] Scan saved to history
- [ ] Second scan shows drift computation
- [ ] Timeline displays all scans
- [ ] Risk colors match thresholds (green/orange/red)
- [ ] Delete functionality works
- [ ] All screens navigate properly

---

## 🚀 Ready to Deploy?

Once tested locally:

1. **For demo/testing:**
   - Keep Flask server running on PC
   - Update backend URL for test network IP
   - Share Expo link with testers

2. **For production:**
   - Deploy Flask to cloud
   - Set up HTTPS
   - Add authentication
   - Configure database
   - Set up monitoring

See `LESION_TRACKING_SETUP.md` for detailed deployment guide.

---

## 📞 Quick Reference

| Task | Command |
|------|---------|
| Start backend | `python app.py` |
| Start frontend | `npm start` |
| Install deps (backend) | `pip install -r requirements.txt` |
| Install deps (frontend) | `npm install` |
| Check backend health | `curl http://localhost:5000/health` |
| Find PC IP | `ipconfig` (Windows) or `ifconfig` (Mac) |
| View logs | Check terminal where server is running |
| Clear AsyncStorage | In DevTools or call `clearAllData()` |
| Test endpoint | Use Postman, curl, or browser |

---

**Version:** 1.0.0  
**Created:** May 4, 2024  
**Status:** Ready to Use ✅
