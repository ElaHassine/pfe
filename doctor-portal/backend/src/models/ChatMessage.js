const mongoose = require('mongoose');

const ChatMessageSchema = new mongoose.Schema(
  {
    threadId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatThread', required: true, index: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    senderType: { type: String, enum: ['patient', 'doctor'], required: true, default: 'patient' },
    senderSnapshot: {
      name: { type: String, trim: true },
      role: { type: String, trim: true },
    },
    body: { type: String, required: true, trim: true },
    readAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ChatMessage', ChatMessageSchema);
