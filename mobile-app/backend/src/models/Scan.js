const mongoose = require('mongoose');

const ScanSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    imageUrl: { type: String, required: true },
    imageKey: { type: String },
    trackingGroupId: { type: String, index: true },
    location: { type: String, required: true },
    lesionType: { type: String, required: true },
    sizeMm: { type: Number },
    riskLevel: { type: String, enum: ['low', 'medium', 'high'], required: true },
    confidence: { type: Number, required: true },
    analysis: { type: Object, default: {} },
    notes: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'reviewed', 'archived'], default: 'pending' },
    reviewedByDoctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor' },
    reviewedAt: { type: Date },
    doctorNotes: { type: String, default: '' },
    clinicalDiagnosis: { type: String, default: '' },
    recommendation: { type: String, default: '' },
    features: { type: [Number], default: [], sparse: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Scan', ScanSchema);
