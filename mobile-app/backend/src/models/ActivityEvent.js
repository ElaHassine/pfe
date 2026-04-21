const mongoose = require('mongoose');

const ActivityEventSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', index: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', index: true },
    actorType: { type: String, enum: ['patient', 'doctor'], default: 'patient', index: true },
    type: { type: String, required: true, index: true },
    entityType: { type: String, required: true },
    entityId: { type: mongoose.Schema.Types.ObjectId },
    metadata: { type: Object, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ActivityEvent', ActivityEventSchema);
