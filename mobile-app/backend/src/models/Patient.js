const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const PatientSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
    role: { type: String, enum: ['patient', 'admin'], default: 'patient' },
    profile: {
      firstName: { type: String, trim: true },
      lastName: { type: String, trim: true },
      fullName: { type: String, trim: true },
      avatarUrl: { type: String, trim: true },
      phone: { type: String, trim: true },
      dob: { type: Date },
      gender: { type: String, trim: true },
      location: { type: String, trim: true },
      bio: { type: String, trim: true },
    },
    privacy: {
      shareProfile: { type: Boolean, default: true },
      showInCommunity: { type: Boolean, default: true },
    },
    stats: {
      scanCount: { type: Number, default: 0 },
      postCount: { type: Number, default: 0 },
      commentCount: { type: Number, default: 0 },
      likeCount: { type: Number, default: 0 },
    },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

PatientSchema.methods.comparePassword = async function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

PatientSchema.methods.toSafeJSON = function toSafeJSON() {
  const patient = this.toObject({ versionKey: false });
  delete patient.passwordHash;
  return patient;
};

module.exports = mongoose.model('Patient', PatientSchema);
