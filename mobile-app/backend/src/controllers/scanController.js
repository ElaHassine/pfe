const Scan = require('../models/Scan');
const Patient = require('../models/Patient');
const asyncHandler = require('../middleware/asyncHandler');
const { recordPatientActivity } = require('../services/activityService');

exports.listScans = asyncHandler(async (req, res) => {
  const scans = await Scan.find({ patientId: req.user._id }).sort({ createdAt: -1 }).lean();
  res.json({ scans });
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
    notes,
  });

  // First scan in a lesion timeline becomes its own tracking root.
  if (!scan.trackingGroupId) {
    scan.trackingGroupId = String(scan._id);
    await scan.save();
  }

  await Patient.findByIdAndUpdate(req.user._id, { $inc: { 'stats.scanCount': 1 } });
  await recordPatientActivity(req.user._id, 'scan.created', 'scan', scan._id, { riskLevel, lesionType });

  res.status(201).json({ scan });
});

exports.getScanById = asyncHandler(async (req, res) => {
  const scan = await Scan.findOne({ _id: req.params.scanId, patientId: req.user._id }).lean();
  if (!scan) {
    return res.status(404).json({ message: 'Scan not found' });
  }
  res.json({ scan });
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
    scan,
    patientNotes: scan.notes || '',
  });
});
