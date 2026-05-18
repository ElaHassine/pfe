const Scan = require('../models/Scan');
const Patient = require('../models/Patient');
const asyncHandler = require('../middleware/asyncHandler');
const { recordPatientActivity } = require('../services/activityService');
const fs = require('fs/promises');
const path = require('path');
const { getUploadsSubdir, normalizeMediaUrl } = require('../utils/media');

function toScanResponse(scan, req) {
  return {
    ...scan,
    imageUrl: normalizeMediaUrl(scan.imageUrl, req),
  };
}

exports.listScans = asyncHandler(async (req, res) => {
  const scans = await Scan.find({ patientId: req.user._id }).sort({ createdAt: -1 }).lean();
  res.json({ scans: scans.map((item) => toScanResponse(item, req)) });
});

exports.createScan = asyncHandler(async (req, res) => {
  const {
    imageUrl,
    imageKey,
    trackingGroupId,
    location,
    lesionType,
    sizeMm,
    riskLevel,
    confidence,
    analysis,
    features = [],
    notes = '',
  } = req.body;

  if (!imageUrl || !location || !lesionType || !riskLevel || confidence === undefined) {
    return res.status(400).json({ message: 'Missing required scan fields' });
  }

  const normalizedTrackingGroupId = String(trackingGroupId || '').trim();

  const scan = await Scan.create({
    patientId: req.user._id,
    imageUrl,
    imageKey,
    trackingGroupId: normalizedTrackingGroupId || undefined,
    location,
    lesionType,
    sizeMm,
    riskLevel,
    confidence,
    analysis,
    features: Array.isArray(features) && features.length === 1792 ? features : [],
    notes,
  });

  // First scan in a lesion timeline becomes its own tracking root.
  if (!scan.trackingGroupId) {
    scan.trackingGroupId = String(scan._id);
    await scan.save();
  }

  await Patient.findByIdAndUpdate(req.user._id, { $inc: { 'stats.scanCount': 1 } });
  await recordPatientActivity(req.user._id, 'scan.created', 'scan', scan._id, { riskLevel, lesionType });

  res.status(201).json({ scan: toScanResponse(scan.toObject(), req) });
});

exports.getScanById = asyncHandler(async (req, res) => {
  const scan = await Scan.findOne({ _id: req.params.scanId, patientId: req.user._id }).lean();
  if (!scan) {
    return res.status(404).json({ message: 'Scan not found' });
  }
  res.json({ scan: toScanResponse(scan, req) });
});

exports.updatePatientNotes = asyncHandler(async (req, res) => {
  const patientNotes = String(req.body?.patientNotes || '').trim();

  const scan = await Scan.findOneAndUpdate(
    { _id: req.params.scanId, patientId: req.user._id },
    { $set: { notes: patientNotes } },
    { new: true }
  ).lean();

  if (!scan) {
    return res.status(404).json({ message: 'Scan not found' });
  }

  res.json({
    scan: toScanResponse(scan, req),
    patientNotes: scan.notes || '',
  });
});

exports.getPreviousFeatures = asyncHandler(async (req, res) => {
  const { trackingGroupId } = req.params;

  // Get the most recent scan with features in this tracking group
  const previousScan = await Scan.findOne(
    {
      patientId: req.user._id,
      trackingGroupId,
      features: { $exists: true, $ne: [] },
    },
    { features: 1 }
  )
    .sort({ createdAt: -1 })
    .lean();

  if (!previousScan || !previousScan.features || previousScan.features.length === 0) {
    return res.json({ features: null, message: 'No previous features found' });
  }

  res.json({ features: previousScan.features });
});

async function storeScanImage(file) {
  if (!file?.buffer) return { imageUrl: '', imageKey: '' };

  const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
  const safeExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext) ? ext : '.jpg';
  const fileName = `scan-${Date.now()}-${Math.random().toString(36).slice(2, 10)}${safeExt}`;
  const absoluteDir = getUploadsSubdir('scans');
  await fs.mkdir(absoluteDir, { recursive: true });

  const absoluteFilePath = path.join(absoluteDir, fileName);
  await fs.writeFile(absoluteFilePath, file.buffer);

  return {
    imageUrl: `/uploads/scans/${fileName}`,
    imageKey: `scans/${fileName}`,
  };
}

exports.uploadScanImage = asyncHandler(async (req, res) => {
  const uploaded = req.file ? await storeScanImage(req.file) : { imageUrl: '', imageKey: '' };
  if (!uploaded.imageUrl) return res.status(400).json({ message: 'No image uploaded' });
  res.status(201).json({
    image: {
      ...uploaded,
      imageUrl: normalizeMediaUrl(uploaded.imageUrl, req),
    },
  });
});

