const mongoose = require('mongoose');

const CommentLikeSchema = new mongoose.Schema(
  {
    commentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', required: true, index: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', index: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', index: true },
  },
  { timestamps: true }
);

CommentLikeSchema.index({ commentId: 1, patientId: 1 }, { unique: true, sparse: true });
CommentLikeSchema.index({ commentId: 1, doctorId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('CommentLike', CommentLikeSchema);