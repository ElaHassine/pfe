const mongoose = require('mongoose');

const ChatThreadSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    doctorId: { type: String, required: true, trim: true, index: true },
    doctorSnapshot: {
      name: { type: String, required: true, trim: true },
      specialty: { type: String, trim: true },
    },
    lastMessage: { type: String, trim: true, default: '' },
    lastMessageAt: { type: Date, default: Date.now, index: true },
    unreadForPatient: { type: Number, default: 0 },
    unreadForDoctor: { type: Number, default: 0 },
  },
  { timestamps: true }
);

ChatThreadSchema.index({ patientId: 1, doctorId: 1 }, { unique: true });

module.exports = mongoose.model('ChatThread', ChatThreadSchema);
