const mongoose = require('mongoose');

const DoctorReviewSchema = new mongoose.Schema(
  {
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true, index: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    review: { type: String, default: '', trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

DoctorReviewSchema.index({ doctorId: 1, patientId: 1 }, { unique: true });

module.exports = mongoose.model('DoctorReview', DoctorReviewSchema);
