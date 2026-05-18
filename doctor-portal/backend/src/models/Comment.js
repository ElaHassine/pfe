const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema(
  {
    postId: { type: mongoose.Schema.Types.ObjectId, ref: 'CommunityPost', required: true, index: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', index: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', index: true },
    authorType: { type: String, enum: ['patient', 'doctor'], default: 'patient', index: true },
    authorSnapshot: {
      name: { type: String, required: true },
      avatarUrl: { type: String, default: '' },
      specialty: { type: String, default: '' },
    },
    body: { type: String, required: true, trim: true },
    parentCommentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', index: true },
    editedAt: { type: Date, default: null },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Comment', CommentSchema);
