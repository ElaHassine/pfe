const bcrypt = require('bcryptjs');
const Doctor = require('../models/Doctor');
const asyncHandler = require('../middleware/asyncHandler');
const { signToken } = require('../services/tokenService');
const { recordDoctorActivity } = require('../services/activityService');

function buildProfileFromBody(body = {}) {
  const firstName = body.firstName?.trim();
  const lastName = body.lastName?.trim();
  const rawFullName = body.fullName?.trim().replace(/^dr\.?\s+/i, '');
  const baseFullName = rawFullName || [firstName, lastName].filter(Boolean).join(' ');

  return {
    firstName,
    lastName,
    fullName: baseFullName ? `Dr. ${baseFullName}` : undefined,
    avatarUrl: body.avatarUrl?.trim(),
    phone: body.phone?.trim(),
    location: body.location?.trim(),
    bio: body.bio?.trim(),
  };
}

exports.register = asyncHandler(async (req, res) => {
  const {
    email,
    password,
    profile = {},
    specialty = 'Dermatology',
    credentials = {},
    availability = {},
  } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  const existing = await Doctor.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(409).json({ message: 'An account already exists for that email' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const doctor = await Doctor.create({
    email,
    passwordHash,
    profile: buildProfileFromBody(profile),
    specialty,
    credentials: {
      licenseNumber: credentials.licenseNumber?.trim(),
      hospital: credentials.hospital?.trim(),
      proofUrl: credentials.proofUrl?.trim(),
      yearsExperience: Number(credentials.yearsExperience) || 0,
    },
    availability: {
      status: availability.status || 'available',
      nextSlot: availability.nextSlot?.trim(),
    },
  });

  const token = signToken(doctor);
  await recordDoctorActivity(doctor._id, 'doctor.auth.registered', 'doctor', doctor._id, { email: doctor.email });

  res.status(201).json({
    token,
    doctor: doctor.toSafeJSON(),
  });
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  const doctor = await Doctor.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  if (!doctor || !doctor.active) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const isValid = await doctor.comparePassword(password);
  if (!isValid) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const now = new Date();
  doctor.lastLoginAt = now;
  doctor.presence = {
    ...(doctor.presence || {}),
    isOnline: true,
    lastSeenAt: now,
  };
  await doctor.save();

  const token = signToken(doctor);
  await recordDoctorActivity(doctor._id, 'doctor.auth.logged-in', 'doctor', doctor._id, { email: doctor.email });

  res.json({
    token,
    doctor: doctor.toSafeJSON(),
  });
});

exports.me = asyncHandler(async (req, res) => {
  res.json({ doctor: req.user });
});

exports.updateMe = asyncHandler(async (req, res) => {
  const updates = {
    profile: {
      ...(req.user.profile || {}),
      ...buildProfileFromBody(req.body.profile || req.body),
    },
    specialty: req.body.specialty?.trim() || req.user.specialty,
    credentials: {
      ...(req.user.credentials || {}),
      ...(req.body.credentials || {}),
      proofUrl: req.body.credentials?.proofUrl?.trim() || req.user.credentials?.proofUrl,
    },
    availability: {
      ...(req.user.availability || {}),
      ...(req.body.availability || {}),
    },
  };

  const doctor = await Doctor.findByIdAndUpdate(req.user._id, updates, { new: true }).select('-passwordHash');
  await recordDoctorActivity(req.user._id, 'doctor.profile.updated', 'doctor', req.user._id, {
    updatedFields: Object.keys(req.body || {}),
  });
  res.json({ doctor });
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const { email, newPassword } = req.body;

  if (!email || !newPassword) {
    return res.status(400).json({ message: 'Email and new password are required' });
  }

  const doctor = await Doctor.findOne({ email: email.toLowerCase() });
  if (!doctor) {
    return res.status(404).json({ message: 'Account not found' });
  }

  doctor.passwordHash = await bcrypt.hash(String(newPassword), 10);
  await doctor.save();

  res.json({ message: 'Password updated successfully' });
});
