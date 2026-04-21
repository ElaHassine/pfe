const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const Patient = require('../models/Patient');
const asyncHandler = require('../middleware/asyncHandler');
const { signToken } = require('../services/tokenService');
const { recordPatientActivity } = require('../services/activityService');

function buildProfileFromBody(body = {}) {
  return {
    firstName: body.firstName?.trim(),
    lastName: body.lastName?.trim(),
    fullName: body.fullName?.trim(),
    avatarUrl: body.avatarUrl?.trim(),
    phone: body.phone?.trim(),
    dob: body.dob || undefined,
    gender: body.gender?.trim(),
    location: body.location?.trim(),
    bio: body.bio?.trim(),
  };
}

exports.register = asyncHandler(async (req, res) => {
  const { email, password, profile = {}, role = 'patient' } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  const existing = await Patient.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(409).json({ message: 'An account already exists for that email' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const patient = await Patient.create({
    email,
    passwordHash,
    authProvider: 'local',
    role,
    profile: buildProfileFromBody(profile),
  });

  const token = signToken(patient);
  await recordPatientActivity(patient._id, 'auth.registered', 'patient', patient._id, { email: patient.email });

  res.status(201).json({
    token,
    patient: patient.toSafeJSON(),
  });
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  const patient = await Patient.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  if (!patient) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const isValid = await patient.comparePassword(password);
  if (!isValid) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  patient.lastLoginAt = new Date();
  await patient.save();

  const token = signToken(patient);
  await recordPatientActivity(patient._id, 'auth.logged-in', 'patient', patient._id, { email: patient.email });

  res.json({
    token,
    patient: patient.toSafeJSON(),
  });
});

exports.googleSignIn = asyncHandler(async (req, res) => {
  const { email, fullName, avatarUrl = '' } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  const normalizedEmail = email.toLowerCase();
  let patient = await Patient.findOne({ email: normalizedEmail });

  if (!patient) {
    const tempPassword = crypto.randomBytes(32).toString('hex');
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    const [firstName = '', ...rest] = String(fullName || '').trim().split(' ');

    patient = await Patient.create({
      email: normalizedEmail,
      passwordHash,
      authProvider: 'google',
      profile: {
        firstName,
        lastName: rest.join(' '),
        fullName: fullName?.trim() || normalizedEmail,
        avatarUrl,
      },
    });
  } else {
    patient.authProvider = patient.authProvider || 'local';
    if (fullName || avatarUrl) {
      patient.profile = {
        ...(patient.profile || {}),
        fullName: fullName?.trim() || patient.profile?.fullName || normalizedEmail,
        avatarUrl: avatarUrl || patient.profile?.avatarUrl || '',
      };
      await patient.save();
    }
  }

  patient.lastLoginAt = new Date();
  await patient.save();

  const token = signToken(patient);
  await recordPatientActivity(patient._id, 'auth.google-signed-in', 'patient', patient._id, { email: patient.email });

  res.json({ token, patient: patient.toSafeJSON() });
});

exports.me = asyncHandler(async (req, res) => {
  res.json({ patient: req.user });
});

exports.updateMe = asyncHandler(async (req, res) => {
  const updates = {
    profile: {
      ...(req.user.profile || {}),
      ...buildProfileFromBody(req.body.profile || req.body),
    },
    privacy: {
      ...(req.user.privacy || {}),
      ...(req.body.privacy || {}),
    },
  };

  const patient = await Patient.findByIdAndUpdate(req.user._id, updates, { new: true }).select('-passwordHash');
  res.json({ patient });
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const { email, newPassword } = req.body;

  if (!email || !newPassword) {
    return res.status(400).json({ message: 'Email and new password are required' });
  }

  const patient = await Patient.findOne({ email: email.toLowerCase() });
  if (!patient) {
    return res.status(404).json({ message: 'Account not found' });
  }

  patient.passwordHash = await bcrypt.hash(String(newPassword), 10);
  patient.authProvider = patient.authProvider || 'local';
  await patient.save();

  res.json({ message: 'Password updated successfully' });
});
