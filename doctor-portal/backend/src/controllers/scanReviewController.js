const mongoose = require('mongoose');
const asyncHandler = require('../middleware/asyncHandler');
const Scan = require('../models/Scan');
const ActivityEvent = require('../models/ActivityEvent');
const { recordPatientActivity } = require('../services/activityService');

// Helper to get contacted patient ids (existing from doctorController)
async function getContactedPatientIds(doctor) {
  const doctorId = String(doctor?._id || '');
  const doctorName = doctor?.profile?.fullName;
  const chatFilter = doctorName
    ? { $or: [{ doctorId }, { 'doctorSnapshot.name': doctorName }] }
    : { doctorId };

  const ChatThread = require('../models/ChatThread');
  const BookingRequest = require('../models/BookingRequest');

  const [chatThreads, bookings] = await Promise.all([
    ChatThread.find(chatFilter).select('patientId').lean(),
    BookingRequest.find(chatFilter).select('patientId').lean(),
  ]);

  const uniqueIds = new Set();
  chatThreads.forEach((t) => uniqueIds.add(String(t.patientId)));
  bookings.forEach((b) => uniqueIds.add(String(b.patientId)));
  return uniqueIds;
}

exports.submitScanReview = asyncHandler(async (req, res) => {
  const { scanId } = req.params;
  const { clinicalDiagnosis, recommendation, doctorNotes = '' } = req.body;

  // Validate required fields
  if (!clinicalDiagnosis || !clinicalDiagnosis.trim()) {
    return res.status(400).json({ message: 'Clinical diagnosis is required' });
  }

  if (!mongoose.Types.ObjectId.isValid(scanId)) {
    return res.status(400).json({ message: 'Invalid scan id' });
  }

  // Find the scan
  const scan = await Scan.findById(scanId).populate('patientId', 'email profile');
  if (!scan) {
    return res.status(404).json({ message: 'Scan not found' });
  }

  // Check if doctor has access (via chat or booking contact)
  const contactedIds = await getContactedPatientIds(req.user);
  if (!contactedIds.has(String(scan.patientId._id))) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  // Update scan with doctor review
  scan.doctorNotes = String(doctorNotes).trim();
  scan.clinicalDiagnosis = String(clinicalDiagnosis).trim();
  scan.recommendation = String(recommendation || '').trim();
  scan.status = 'reviewed';
  scan.reviewedByDoctorId = req.user._id;
  scan.reviewedAt = new Date();

  await scan.save();

  // Record activity
  const doctorName = req.user?.profile?.fullName || `Dr. ${req.user?.email || 'Doctor'}`;

  await recordPatientActivity(
    scan.patientId._id,
    'scan.reviewed',
    'scan',
    scan._id,
    {
      doctorId: req.user._id,
      doctorName,
      diagnosis: scan.clinicalDiagnosis,
      recommendation: scan.recommendation,
    }
  );

  // Create notification activity for patient to receive on mobile app
  await ActivityEvent.create({
    patientId: scan.patientId._id,
    doctorId: req.user._id,
    actorType: 'doctor',
    type: 'scan.review_received',
    entityType: 'scan',
    entityId: scan._id,
    metadata: {
      diagnosis: scan.clinicalDiagnosis,
      recommendation: scan.recommendation,
      doctorName,
    },
  });

  res.json({
    message: 'Scan review submitted successfully',
    scan: {
      id: scan._id,
      doctorNotes: scan.doctorNotes,
      clinicalDiagnosis: scan.clinicalDiagnosis,
      recommendation: scan.recommendation,
      status: scan.status,
      reviewedAt: scan.reviewedAt,
    },
  });
});
