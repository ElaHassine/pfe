const mongoose = require('mongoose');

const BookingRequestSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    doctorId: { type: String, required: true, trim: true, index: true },
    doctorSnapshot: {
      name: { type: String, required: true, trim: true },
      specialty: { type: String, trim: true },
      location: { type: String, default: '', trim: true },
      nextSlot: { type: String, trim: true },
      available: { type: Boolean, default: true },
    },
    patientSnapshot: {
      name: { type: String, required: true, trim: true },
      avatarUrl: { type: String, default: '' },
      location: { type: String, default: '' },
    },
    preferredTime: { type: String, default: '' },
    message: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'suggested', 'accepted', 'declined'], default: 'pending' },
    suggestedTime: { type: String, default: '' },
    scheduledAt: { type: Date },
    doctorNote: { type: String, default: '' },
    repliedAt: { type: Date },
  },
  { timestamps: true }
);

BookingRequestSchema.index({ doctorId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('BookingRequest', BookingRequestSchema);