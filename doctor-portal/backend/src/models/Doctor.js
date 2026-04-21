const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const DoctorSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['doctor', 'admin'], default: 'doctor' },
    profile: {
      firstName: { type: String, trim: true },
      lastName: { type: String, trim: true },
      fullName: { type: String, trim: true },
      avatarUrl: { type: String, trim: true },
      phone: { type: String, trim: true },
      location: { type: String, trim: true },
      bio: { type: String, trim: true },
    },
    specialty: { type: String, trim: true, default: 'Dermatology' },
    credentials: {
      licenseNumber: { type: String, trim: true },
      hospital: { type: String, trim: true },
      proofUrl: { type: String, trim: true },
      yearsExperience: { type: Number, default: 0 },
    },
    availability: {
      status: { type: String, enum: ['available', 'busy', 'offline'], default: 'available' },
      nextSlot: { type: String, trim: true },
    },
    presence: {
      isOnline: { type: Boolean, default: false },
      lastSeenAt: { type: Date },
    },
    lastLoginAt: { type: Date },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

DoctorSchema.methods.isCurrentlyOnline = function isCurrentlyOnline() {
  const lastSeen = this?.presence?.lastSeenAt ? new Date(this.presence.lastSeenAt).getTime() : 0;
  const isFresh = Number.isFinite(lastSeen) && (Date.now() - lastSeen) <= 90000;
  return Boolean(this?.presence?.isOnline && isFresh);
};

DoctorSchema.methods.comparePassword = async function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

DoctorSchema.methods.toSafeJSON = function toSafeJSON() {
  const doctor = this.toObject({ versionKey: false });
  delete doctor.passwordHash;
  return doctor;
};

module.exports = mongoose.model('Doctor', DoctorSchema);