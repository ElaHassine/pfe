const mongoose = require('mongoose');

const DoctorAppointmentSchema = new mongoose.Schema(
  {
    doctorId: { type: String, required: true, trim: true, index: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', default: null },
    patientName: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    scheduledAt: { type: Date, required: true, index: true },
    details: { type: String, default: '' },
    source: { type: String, enum: ['manual', 'booking'], default: 'manual' },
    bookingRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'BookingRequest', default: null },
    status: { type: String, enum: ['scheduled', 'completed', 'cancelled'], default: 'scheduled' },
  },
  { timestamps: true }
);

DoctorAppointmentSchema.index({ doctorId: 1, scheduledAt: 1 });
DoctorAppointmentSchema.index({ bookingRequestId: 1 }, { sparse: true });

module.exports = mongoose.model('DoctorAppointment', DoctorAppointmentSchema);
