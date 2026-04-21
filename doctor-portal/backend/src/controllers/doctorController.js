const mongoose = require('mongoose');
const asyncHandler = require('../middleware/asyncHandler');
const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');
const Scan = require('../models/Scan');
const DoctorReview = require('../models/DoctorReview');
const CommunityPost = require('../models/CommunityPost');
const BookingRequest = require('../models/BookingRequest');
const ChatThread = require('../models/ChatThread');
const DoctorAppointment = require('../models/DoctorAppointment');

function calculateAge(dob) {
  if (!dob) {
    return null;
  }

  const birthDate = new Date(dob);
  if (Number.isNaN(birthDate.getTime())) {
    return null;
  }

  const ageDiffMs = Date.now() - birthDate.getTime();
  const ageDate = new Date(ageDiffMs);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
}

function formatPatientName(patient) {
  const profile = patient?.profile || {};
  return profile.fullName || [profile.firstName, profile.lastName].filter(Boolean).join(' ') || patient?.email || 'Patient';
}

function riskWeight(level) {
  switch (String(level || '').toLowerCase()) {
    case 'high':
      return 0;
    case 'medium':
      return 1;
    default:
      return 2;
  }
}

function statusWeight(status) {
  switch (String(status || '').toLowerCase()) {
    case 'pending':
      return 0;
    case 'reviewed':
      return 1;
    default:
      return 2;
  }
}

function toCaseItem(scan) {
  const patient = scan.patientId || {};
  return {
    id: scan._id,
    patientId: patient._id || scan.patientId,
    patientName: formatPatientName(patient),
    patientAge: calculateAge(patient.dob),
    scanDate: scan.createdAt,
    location: scan.location,
    riskLevel: scan.riskLevel,
    confidence: scan.confidence,
    lesionType: scan.lesionType,
    notes: scan.notes || '',
    status: scan.status,
    priority: scan.riskLevel === 'high' && scan.status === 'pending',
    imageUrl: scan.imageUrl,
    imageKey: scan.imageKey || '',
    analysis: scan.analysis || {},
    reviewedAt: scan.reviewedAt || null,
    doctorNotes: scan.doctorNotes || '',
    clinicalDiagnosis: scan.clinicalDiagnosis || '',
    recommendation: scan.recommendation || '',
  };
}

function sortCases(a, b) {
  const priorityDiff = Number(b.priority) - Number(a.priority);
  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  const statusDiff = statusWeight(a.status) - statusWeight(b.status);
  if (statusDiff !== 0) {
    return statusDiff;
  }

  const riskDiff = riskWeight(a.riskLevel) - riskWeight(b.riskLevel);
  if (riskDiff !== 0) {
    return riskDiff;
  }

  return new Date(b.scanDate).getTime() - new Date(a.scanDate).getTime();
}

function toCommunityPost(post) {
  const patient = post.patientId || {};
  const profile = patient.profile || {};

  return {
    id: post._id,
    patientId: patient._id || post.patientId,
    authorSnapshot: post.authorSnapshot || {
      name: formatPatientName(patient),
      avatarUrl: profile.avatarUrl || '',
    },
    imageUrl: post.imageUrl,
    imageKey: post.imageKey || '',
    diagnosis: post.diagnosis,
    note: post.note,
    location: post.location || '',
    visibility: post.visibility,
    moderationStatus: post.moderationStatus,
    likeCount: post.likeCount || 0,
    commentCount: post.commentCount || 0,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
}

function toNotification(request) {
  return {
    id: request._id,
    type: 'booking-request',
    status: request.status,
    doctorId: request.doctorId,
    doctorName: request.doctorSnapshot?.name || 'Doctor',
    specialty: request.doctorSnapshot?.specialty || 'Dermatology',
    patientName: request.patientSnapshot?.name || 'Patient',
    patientAvatarUrl: request.patientSnapshot?.avatarUrl || '',
    patientLocation: request.patientSnapshot?.location || '',
    preferredTime: request.preferredTime || '',
    suggestedTime: request.suggestedTime || '',
    message: request.message || '',
    doctorNote: request.doctorNote || '',
    createdAt: request.createdAt,
    repliedAt: request.repliedAt || null,
  };
}

function getDoctorOwnerFilter(doctorUser) {
  const doctorName = doctorUser?.profile?.fullName;
  const doctorObjectId = String(doctorUser?._id || '');
  return doctorName
    ? { $or: [{ doctorId: doctorObjectId }, { doctorId: doctorName }] }
    : { doctorId: doctorObjectId };
}

function toAppointmentItem(item) {
  return {
    id: String(item._id),
    patientId: item.patientId ? String(item.patientId) : '',
    patientName: item.patientName || 'Patient',
    title: item.title || 'Appointment',
    scheduledAt: item.scheduledAt,
    details: item.details || '',
    status: item.status || 'scheduled',
    source: item.source || 'manual',
    bookingRequestId: item.bookingRequestId ? String(item.bookingRequestId) : '',
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function toReviewerName(patient) {
  const profile = patient?.profile || {};
  const fullName = (profile.fullName || [profile.firstName, profile.lastName].filter(Boolean).join(' ')).trim();

  if (fullName) {
    const parts = fullName.split(' ').filter(Boolean);
    if (parts.length === 1) {
      return `${parts[0].slice(0, 1).toUpperCase()}***`;
    }
    const first = parts[0];
    const lastInitial = parts[parts.length - 1].slice(0, 1).toUpperCase();
    return `${first} ${lastInitial}.`;
  }

  const emailPrefix = String(patient?.email || '').split('@')[0] || 'Patient';
  return `${emailPrefix.slice(0, 1).toUpperCase()}***`;
}

exports.heartbeatPresence = asyncHandler(async (req, res) => {
  const now = new Date();
  await Doctor.findByIdAndUpdate(req.user._id, {
    $set: {
      'presence.isOnline': true,
      'presence.lastSeenAt': now,
    },
  });

  res.json({
    presence: {
      isOnline: true,
      lastSeenAt: now,
    },
  });
});

exports.setOfflinePresence = asyncHandler(async (req, res) => {
  const now = new Date();
  await Doctor.findByIdAndUpdate(req.user._id, {
    $set: {
      'presence.isOnline': false,
      'presence.lastSeenAt': now,
    },
  });

  res.json({
    presence: {
      isOnline: false,
      lastSeenAt: now,
    },
  });
});

async function getContactedPatientIds(doctorUser) {
  const doctorName = doctorUser?.profile?.fullName;
  const doctorObjectId = String(doctorUser?._id || '');
  const filter = doctorName
    ? { $or: [{ doctorId: doctorObjectId }, { 'doctorSnapshot.name': doctorName }] }
    : { doctorId: doctorObjectId };

  const [threads, requests] = await Promise.all([
    ChatThread.find(filter).select('patientId').lean(),
    BookingRequest.find(filter).select('patientId').lean(),
  ]);

  const ids = new Set();
  threads.forEach((thread) => {
    if (thread.patientId) ids.add(String(thread.patientId));
  });
  requests.forEach((request) => {
    if (request.patientId) ids.add(String(request.patientId));
  });

  return ids;
}

async function loadPatientsAndScans(doctorUser) {
  const contactedPatientIds = await getContactedPatientIds(doctorUser);
  const contactedIdsArray = Array.from(contactedPatientIds);

  if (!contactedIdsArray.length) {
    return { patients: [], patientSummaries: [], scans: [], caseItems: [] };
  }

  const [patients, scans] = await Promise.all([
    Patient.find({ _id: { $in: contactedIdsArray } }).select('email profile dob stats createdAt').lean(),
    Scan.find({ patientId: { $in: contactedIdsArray } }).sort({ createdAt: -1 }).populate({ path: 'patientId', select: 'email profile dob' }).lean(),
  ]);

  const scansByPatientId = new Map();
  scans.forEach((scan) => {
    const patientId = String(scan.patientId?._id || scan.patientId);
    const list = scansByPatientId.get(patientId) || [];
    list.push(scan);
    scansByPatientId.set(patientId, list);
  });

  const patientSummaries = patients.map((patient) => {
    const patientScans = scansByPatientId.get(String(patient._id)) || [];
    const latestScan = patientScans[0] || null;
    const riskLevel = patientScans.reduce((current, scan) => (
      riskWeight(scan.riskLevel) < riskWeight(current) ? scan.riskLevel : current
    ), 'low');

    return {
      id: patient._id,
      name: formatPatientName(patient),
      age: calculateAge(patient.dob),
      scans: patientScans.length,
      lastScan: latestScan?.createdAt || patient.createdAt || null,
      riskLevel: patientScans.length ? riskLevel : 'low',
      email: patient.email,
      avatarUrl: patient.profile?.avatarUrl || '',
      location: patient.profile?.location || '',
    };
  });

  const caseItems = scans.map(toCaseItem).sort(sortCases);

  return { patients, patientSummaries, scans, caseItems };
}

async function loadCommunityPosts() {
  const posts = await CommunityPost.find()
    .sort({ createdAt: -1 })
    .populate({ path: 'patientId', select: 'email profile dob' })
    .lean();

  return posts.map(toCommunityPost);
}

async function loadNotifications() {
  const requests = await BookingRequest.find().sort({ createdAt: -1 }).lean();
  return requests.map(toNotification);
}

function toConfirmedBookingIds(requests) {
  return new Set(requests.filter((request) => String(request.status || '').toLowerCase() === 'accepted').map((request) => String(request._id)));
}

exports.getDashboard = asyncHandler(async (req, res) => {
  const doctorName = req.user?.profile?.fullName;
  const doctorObjectId = String(req.user?._id || '');
  const notificationFilter = doctorName
    ? { $or: [{ doctorId: doctorObjectId }, { 'doctorSnapshot.name': doctorName }] }
    : { doctorId: doctorObjectId };

  const [data, communityPosts, notificationRequests] = await Promise.all([
    loadPatientsAndScans(req.user),
    loadCommunityPosts(),
    BookingRequest.find(notificationFilter).sort({ createdAt: -1 }).lean(),
  ]);
  const notifications = notificationRequests.map(toNotification);
  const pendingCases = data.caseItems.filter((item) => item.status === 'pending');
  const reviewedCases = data.caseItems.filter((item) => item.status === 'reviewed');
  const highRiskPending = pendingCases.filter((item) => item.riskLevel === 'high');
  const pendingNotifications = notifications.filter((item) => item.status === 'pending');
  const reviewedToday = data.caseItems.filter((item) => {
    if (item.status !== 'reviewed') {
      return false;
    }

    const reviewedAt = item.reviewedAt || item.scanDate;
    if (!reviewedAt) {
      return false;
    }

    const reviewedDate = new Date(reviewedAt);
    const today = new Date();
    return reviewedDate.toDateString() === today.toDateString();
  });

  res.json({
    stats: {
      pendingCases: pendingCases.length,
      reviewedToday: reviewedToday.length,
      highRiskPending: highRiskPending.length,
      totalPatients: data.patients.length,
      avgResponseTime: '2.4h',
      satisfaction: '98%',
      totalCommunityPosts: communityPosts.length,
      flaggedCommunityPosts: communityPosts.filter((post) => post.moderationStatus === 'flagged').length,
      bookingRequests: notifications.length,
      pendingBookingRequests: pendingNotifications.length,
    },
    pendingCases,
    reviewedCases,
    patients: data.patientSummaries,
    communityPosts: communityPosts.slice(0, 5),
    notifications: notifications.slice(0, 8),
  });
});

exports.listCases = asyncHandler(async (req, res) => {
  const { caseItems } = await loadPatientsAndScans(req.user);
  res.json({ cases: caseItems });
});

exports.getCaseById = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'Invalid case id' });
  }

  const scan = await Scan.findById(req.params.id).populate({ path: 'patientId', select: 'email profile dob' }).lean();
  if (!scan) {
    return res.status(404).json({ message: 'Case not found' });
  }

  const contactedIds = await getContactedPatientIds(req.user);
  const patientId = String(scan.patientId?._id || scan.patientId);
  if (!contactedIds.has(patientId)) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  res.json({ caseData: toCaseItem(scan) });
});

exports.listPatients = asyncHandler(async (req, res) => {
  const { patientSummaries } = await loadPatientsAndScans(req.user);
  res.json({ patients: patientSummaries });
});

exports.getPatientHistory = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid patient id' });
  }

  const contactedIds = await getContactedPatientIds(req.user);
  if (!contactedIds.has(String(id))) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const patient = await Patient.findById(id).select('email profile dob stats createdAt').lean();
  if (!patient) {
    return res.status(404).json({ message: 'Patient not found' });
  }

  const doctorName = req.user?.profile?.fullName;
  const doctorObjectId = String(req.user?._id || '');
  const doctorFilter = doctorName
    ? { $or: [{ doctorId: doctorObjectId }, { 'doctorSnapshot.name': doctorName }] }
    : { doctorId: doctorObjectId };

  const [scans, bookings, posts] = await Promise.all([
    Scan.find({ patientId: patient._id }).sort({ createdAt: -1 }).lean(),
    BookingRequest.find({ patientId: patient._id, ...doctorFilter }).sort({ createdAt: -1 }).lean(),
    CommunityPost.find({ patientId: patient._id }).sort({ createdAt: -1 }).limit(30).lean(),
  ]);

  const totalScans = scans.length;
  const pendingCases = scans.filter((scan) => scan.status === 'pending').length;
  const reviewedCases = scans.filter((scan) => scan.status === 'reviewed').length;
  const highRiskScans = scans.filter((scan) => String(scan.riskLevel || '').toLowerCase() === 'high').length;
  const averageConfidence = totalScans
    ? Math.round(scans.reduce((sum, scan) => sum + Number(scan.confidence || 0), 0) / totalScans)
    : 0;

  res.json({
    patient: {
      id: patient._id,
      name: formatPatientName(patient),
      age: calculateAge(patient.dob),
      email: patient.email,
      avatarUrl: patient.profile?.avatarUrl || '',
      phone: patient.profile?.phone || '',
      gender: patient.profile?.gender || '',
      location: patient.profile?.location || '',
      bio: patient.profile?.bio || '',
      joinedAt: patient.createdAt,
    },
    stats: {
      totalScans,
      pendingCases,
      reviewedCases,
      highRiskScans,
      averageConfidence,
      totalCommunityPosts: posts.length,
      totalBookings: bookings.length,
    },
    scans: scans.map((scan) => ({
      id: scan._id,
      createdAt: scan.createdAt,
      location: scan.location,
      riskLevel: scan.riskLevel,
      confidence: scan.confidence,
      lesionType: scan.lesionType,
      status: scan.status,
      imageUrl: scan.imageUrl,
      notes: scan.notes || '',
      reviewedAt: scan.reviewedAt || null,
      doctorNotes: scan.doctorNotes || '',
      clinicalDiagnosis: scan.clinicalDiagnosis || '',
      recommendation: scan.recommendation || '',
    })),
    bookings: bookings.map((item) => ({
      id: item._id,
      status: item.status,
      preferredTime: item.preferredTime || '',
      suggestedTime: item.suggestedTime || '',
      doctorNote: item.doctorNote || '',
      message: item.message || '',
      createdAt: item.createdAt,
      repliedAt: item.repliedAt || null,
    })),
  });
});

exports.listCommunityPosts = asyncHandler(async (_req, res) => {
  const posts = await loadCommunityPosts();
  res.json({ posts });
});

exports.getCommunitySummary = asyncHandler(async (_req, res) => {
  const posts = await loadCommunityPosts();
  const totalComments = posts.reduce((sum, post) => sum + (post.commentCount || 0), 0);
  const totalLikes = posts.reduce((sum, post) => sum + (post.likeCount || 0), 0);

  res.json({
    stats: {
      totalPosts: posts.length,
      visiblePosts: posts.filter((post) => post.moderationStatus === 'visible').length,
      flaggedPosts: posts.filter((post) => post.moderationStatus === 'flagged').length,
      totalComments,
      totalLikes,
    },
    recentPosts: posts.slice(0, 5),
  });
});

exports.listNotifications = asyncHandler(async (req, res) => {
  const doctorName = req.user?.profile?.fullName;
  const doctorObjectId = String(req.user?._id || '');
  const filter = doctorName
    ? { $or: [{ doctorId: doctorObjectId }, { 'doctorSnapshot.name': doctorName }] }
    : { doctorId: doctorObjectId };
  const requests = await BookingRequest.find(filter).sort({ createdAt: -1 }).lean();
  const notifications = requests.map(toNotification);
  res.json({ notifications });
});

exports.listDoctorReviews = asyncHandler(async (req, res) => {
  const reviews = await DoctorReview.find({ doctorId: req.user._id })
    .populate({ path: 'patientId', select: 'email profile' })
    .sort({ updatedAt: -1 })
    .lean();

  const items = reviews.map((item) => ({
    id: String(item._id),
    patientId: String(item.patientId?._id || item.patientId),
    patientName: toReviewerName(item.patientId),
    rating: Number(item.rating || 0),
    review: item.review || '',
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }));

  const total = items.length;
  const average = total ? items.reduce((sum, item) => sum + (item.rating || 0), 0) / total : 0;

  res.json({
    reviews: items,
    stats: {
      rating: Number(average.toFixed(1)) || 0,
      reviews: total,
    },
  });
});

exports.listAppointments = asyncHandler(async (req, res) => {
  const [appointments, requests] = await Promise.all([
    DoctorAppointment.find(getDoctorOwnerFilter(req.user)).sort({ scheduledAt: 1, createdAt: -1 }).lean(),
    BookingRequest.find(getDoctorOwnerFilter(req.user)).select('_id status').lean(),
  ]);

  const confirmedBookingIds = toConfirmedBookingIds(requests);
  const filteredAppointments = appointments.filter((item) => {
    if (String(item.source || '').toLowerCase() !== 'booking') {
      return true;
    }
    return confirmedBookingIds.has(String(item.bookingRequestId || ''));
  });

  res.json({ appointments: filteredAppointments.map(toAppointmentItem) });
});

exports.createAppointment = asyncHandler(async (req, res) => {
  const { patientName = '', title = '', scheduledAt, details = '', patientId = '' } = req.body;

  const safePatientName = String(patientName || '').trim();
  const safeTitle = String(title || '').trim();
  const safeDetails = String(details || '').trim();
  const scheduleCandidate = new Date(String(scheduledAt || ''));

  if (!safePatientName) {
    return res.status(400).json({ message: 'patientName is required' });
  }

  if (!safeTitle) {
    return res.status(400).json({ message: 'title is required' });
  }

  if (Number.isNaN(scheduleCandidate.getTime())) {
    return res.status(400).json({ message: 'scheduledAt must be a valid datetime' });
  }

  const appointment = await DoctorAppointment.create({
    doctorId: String(req.user?._id || ''),
    patientId: mongoose.Types.ObjectId.isValid(String(patientId || '')) ? patientId : null,
    patientName: safePatientName,
    title: safeTitle,
    scheduledAt: scheduleCandidate,
    details: safeDetails,
    source: 'manual',
    status: 'scheduled',
  });

  res.status(201).json({ appointment: toAppointmentItem(appointment.toObject()) });
});

exports.updateAppointmentDetails = asyncHandler(async (req, res) => {
  const { details = '', status = '' } = req.body;

  const appointment = await DoctorAppointment.findOne({
    _id: req.params.id,
    ...getDoctorOwnerFilter(req.user),
  });

  if (!appointment) {
    return res.status(404).json({ message: 'Appointment not found' });
  }

  appointment.details = String(details || '').trim();
  if (status && ['scheduled', 'completed', 'cancelled'].includes(String(status).toLowerCase())) {
    appointment.status = String(status).toLowerCase();
  }
  await appointment.save();

  res.json({ appointment: toAppointmentItem(appointment.toObject()) });
});