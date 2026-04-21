const BookingRequest = require('../models/BookingRequest');
const DoctorAppointment = require('../models/DoctorAppointment');
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
  const { doctorId, doctorName, specialty, nextSlot = '', available = true, preferredTime = '', message = '' } = req.body;

  if (!doctorId || !doctorName) {
    return res.status(400).json({ message: 'doctorId and doctorName are required' });
  }

  const patient = await Patient.findById(req.user._id).select('email profile').lean();
  if (!patient) {
    return res.status(404).json({ message: 'Patient not found' });
  }

  const request = await BookingRequest.create({
    patientId: req.user._id,
    doctorId: String(doctorId),
    doctorSnapshot: {
      name: doctorName,
      specialty: specialty || 'Dermatology',
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

exports.suggestTime = asyncHandler(async (req, res) => {
  const { suggestedTime, doctorNote = '', scheduledAt = '' } = req.body;

  if (!suggestedTime || !String(suggestedTime).trim()) {
    return res.status(400).json({ message: 'suggestedTime is required' });
  }

  let parsedScheduledAt = null;
  if (scheduledAt && String(scheduledAt).trim()) {
    const candidate = new Date(String(scheduledAt));
    if (Number.isNaN(candidate.getTime())) {
      return res.status(400).json({ message: 'scheduledAt must be a valid datetime' });
    }
    parsedScheduledAt = candidate;
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

  if (request.status !== 'accepted' && request.status !== 'suggested') {
    return res.status(400).json({ message: 'Can only suggest time after accepting the request' });
  }

  request.status = 'suggested';
  request.suggestedTime = String(suggestedTime).trim();
  request.doctorNote = String(doctorNote).trim();
  request.scheduledAt = parsedScheduledAt || request.scheduledAt || null;
  request.repliedAt = new Date();
  await request.save();

  const fallbackFromText = new Date(request.suggestedTime);
  const scheduledDateTime = parsedScheduledAt
    || (Number.isNaN(fallbackFromText.getTime()) ? null : fallbackFromText)
    || new Date();

  await DoctorAppointment.findOneAndUpdate(
    { bookingRequestId: request._id },
    {
      $set: {
        doctorId: String(req.user?._id || request.doctorId || ''),
        patientId: request.patientId,
        patientName: request.patientSnapshot?.name || 'Patient',
        title: `Appointment with ${request.patientSnapshot?.name || 'Patient'}`,
        scheduledAt: scheduledDateTime,
        details: request.doctorNote,
        source: 'booking',
        bookingRequestId: request._id,
        status: request.status === 'declined' ? 'cancelled' : 'scheduled',
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

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

exports.respondToBooking = asyncHandler(async (req, res) => {
  const { action } = req.body;
  const normalized = String(action || '').trim().toLowerCase();

  if (!['accept', 'decline'].includes(normalized)) {
    return res.status(400).json({ message: 'action must be accept or decline' });
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
    return res.status(400).json({ message: `Booking request already ${request.status}` });
  }

  request.status = normalized === 'accept' ? 'accepted' : 'declined';
  request.repliedAt = new Date();
  await request.save();

  await recordDoctorActivity(
    req.user._id,
    normalized === 'accept' ? 'booking.accepted' : 'booking.declined',
    'bookingRequest',
    request._id,
    {
      patientId: request.patientId,
      patientName: request.patientSnapshot?.name,
      suggestedTime: request.suggestedTime || request.preferredTime || '',
    }
  );

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