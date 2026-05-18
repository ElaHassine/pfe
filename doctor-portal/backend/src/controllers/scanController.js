const Scan = require('../models/Scan');
const Patient = require('../models/Patient');
const asyncHandler = require('../middleware/asyncHandler');
const { recordPatientActivity } = require('../services/activityService');
const { normalizeMediaUrl } = require('../utils/media');

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
  const { imageUrl, imageKey, location, lesionType, sizeMm, riskLevel, confidence, analysis, notes = '' } = req.body;

  if (!imageUrl || !location || !lesionType || !riskLevel || confidence === undefined) {
    return res.status(400).json({ message: 'Missing required scan fields' });
  }

  const scan = await Scan.create({
    patientId: req.user._id,
    imageUrl,
    imageKey,
    location,
    lesionType,
    sizeMm,
    riskLevel,
    confidence,
    analysis,
    notes,
  });

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
