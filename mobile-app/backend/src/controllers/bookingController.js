const BookingRequest = require('../models/BookingRequest');
const Patient = require('../models/Patient');
const asyncHandler = require('../middleware/asyncHandler');
const { recordDoctorActivity, recordPatientActivity } = require('../services/activityService');

function buildPatientSnapshot(patient) {
  const profile = patient.profile || {};
  return {
    name: profile.fullName || [profile.firstName, profile.lastName].filter(Boolean).join(' ') || patient.email,
    avatarUrl: profile.avatarUrl || '',
    location: profile.location || '',
  };
}

exports.createRequest = asyncHandler(async (req, res) => {
  const { doctorId, doctorName, specialty, location = '', nextSlot = '', available = true, preferredTime = '', message = '' } = req.body;
  const normalizedDoctorId = String(doctorId || '').trim();

  if (!normalizedDoctorId || !doctorName) {
    return res.status(400).json({ message: 'doctorId and doctorName are required' });
  }

  const now = new Date();
  const existingActiveAppointment = await BookingRequest.findOne({
    patientId: req.user._id,
    doctorId: normalizedDoctorId,
    status: 'accepted',
    $or: [
      { scheduledAt: { $exists: false } },
      { scheduledAt: null },
      { scheduledAt: { $gt: now } },
    ],
  }).lean();

  if (existingActiveAppointment) {
    return res.status(409).json({
      message: 'You already have a scheduled appointment with this doctor. You can book again after it is canceled or has passed.',
    });
  }

  const patient = await Patient.findById(req.user._id).select('email profile').lean();
  if (!patient) {
    return res.status(404).json({ message: 'Patient not found' });
  }

  const request = await BookingRequest.create({
    patientId: req.user._id,
    doctorId: normalizedDoctorId,
    doctorSnapshot: {
      name: doctorName,
      specialty: specialty || 'Dermatology',
      location: String(location || '').trim(),
      nextSlot,
      available: !!available,
    },
    patientSnapshot: buildPatientSnapshot(patient),
    preferredTime: preferredTime || nextSlot || 'Next available',
    message: message || 'Please suggest a suitable booking time.',
  });

  await recordPatientActivity(req.user._id, 'booking.requested', 'bookingRequest', request._id, {
    doctorId: request.doctorId,
    doctorName: request.doctorSnapshot?.name,
  });

  res.status(201).json({ request });
});

exports.listMyRequests = asyncHandler(async (req, res) => {
  const requests = await BookingRequest.find({ patientId: req.user._id })
    .sort({ createdAt: -1 })
    .lean();

  res.json({ requests });
});

exports.listRequestsForDoctors = asyncHandler(async (req, res) => {
  const doctorName = req.user?.profile?.fullName;
  const doctorObjectId = String(req.user?._id || '');
  const filter = doctorName
    ? { $or: [{ doctorId: doctorObjectId }, { 'doctorSnapshot.name': doctorName }] }
    : { doctorId: doctorObjectId };

  const requests = await BookingRequest.find(filter).sort({ createdAt: -1 }).lean();
  res.json({ requests });
});

function toConfirmedAppointment(request) {
  return {
    id: String(request._id),
    bookingRequestId: String(request._id),
    doctorId: String(request.doctorId || ''),
    doctorName: request.doctorSnapshot?.name || 'Doctor',
    specialty: request.doctorSnapshot?.specialty || 'Dermatology',
    location: String(request.doctorSnapshot?.location || '').trim(),
    patientName: request.patientSnapshot?.name || 'Patient',
    scheduledAt: request.scheduledAt || null,
    suggestedTime: request.suggestedTime || '',
    doctorNote: request.doctorNote || '',
    status: request.status === 'accepted' ? 'scheduled' : request.status || 'scheduled',
    createdAt: request.createdAt,
    repliedAt: request.repliedAt || null,
  };
}

exports.listMyAppointments = asyncHandler(async (req, res) => {
  const requests = await BookingRequest.find({
    patientId: req.user._id,
    status: 'accepted',
  }).sort({ repliedAt: -1, createdAt: -1 }).lean();

  res.json({ appointments: requests.map(toConfirmedAppointment) });
});

exports.suggestTime = asyncHandler(async (req, res) => {
  const { suggestedTime, doctorNote = '' } = req.body;

  if (!suggestedTime || !String(suggestedTime).trim()) {
    return res.status(400).json({ message: 'suggestedTime is required' });
  }

  const doctorName = req.user?.profile?.fullName;
  const doctorObjectId = String(req.user?._id || '');
  const filter = doctorName
    ? { _id: req.params.requestId, $or: [{ doctorId: doctorObjectId }, { 'doctorSnapshot.name': doctorName }] }
    : { _id: req.params.requestId, doctorId: doctorObjectId };

  const request = await BookingRequest.findOne(filter);

  if (!request) {
    return res.status(404).json({ message: 'Booking request not found' });
  }

  if (request.status === 'accepted' || request.status === 'declined') {
    return res.status(400).json({ message: `Cannot suggest time for a ${request.status} request` });
  }

  request.status = 'suggested';
  request.suggestedTime = String(suggestedTime).trim();
  request.doctorNote = String(doctorNote).trim();
  request.repliedAt = new Date();
  await request.save();

  await recordDoctorActivity(req.user._id, 'booking.time-suggested', 'bookingRequest', request._id, {
    suggestedTime: request.suggestedTime,
    patientId: request.patientId,
  });

  await recordPatientActivity(request.patientId, 'booking.time-suggested', 'bookingRequest', request._id, {
    doctorId: request.doctorId,
    doctorName: request.doctorSnapshot?.name,
    suggestedTime: request.suggestedTime,
    doctorNote: request.doctorNote,
  });

  res.json({ request });
});

exports.respondToSuggestion = asyncHandler(async (req, res) => {
  const { action } = req.body;
  const normalized = String(action || '').trim().toLowerCase();

  if (!['accept', 'decline'].includes(normalized)) {
    return res.status(400).json({ message: 'action must be accept or decline' });
  }

  const request = await BookingRequest.findOne({
    _id: req.params.requestId,
    patientId: req.user._id,
  });

  if (!request) {
    return res.status(404).json({ message: 'Booking request not found' });
  }

  if (request.status !== 'suggested') {
    return res.status(400).json({ message: 'Only suggested bookings can be accepted or declined' });
  }

  request.status = normalized === 'accept' ? 'accepted' : 'declined';
  request.repliedAt = new Date();
  await request.save();

  await recordPatientActivity(
    req.user._id,
    normalized === 'accept' ? 'booking.accepted' : 'booking.declined',
    'bookingRequest',
    request._id,
    {
      doctorId: request.doctorId,
      doctorName: request.doctorSnapshot?.name,
      suggestedTime: request.suggestedTime,
    }
  );

  res.json({ request });
});

exports.cancelAppointment = asyncHandler(async (req, res) => {
  const request = await BookingRequest.findOne({
    _id: req.params.requestId,
    patientId: req.user._id,
    status: 'accepted',
  });

  if (!request) {
    return res.status(404).json({ message: 'Appointment not found' });
  }

  request.status = 'declined';
  request.repliedAt = new Date();
  await request.save();

  await recordDoctorActivity(request.doctorId, 'booking.cancelled', 'bookingRequest', request._id, {
    patientId: request.patientId,
    patientName: request.patientSnapshot?.name,
    suggestedTime: request.suggestedTime || '',
  });

  await recordPatientActivity(req.user._id, 'booking.cancelled', 'bookingRequest', request._id, {
    doctorId: request.doctorId,
    doctorName: request.doctorSnapshot?.name,
    suggestedTime: request.suggestedTime || '',
  });

  res.json({ request: toConfirmedAppointment(request.toObject()) });
});
