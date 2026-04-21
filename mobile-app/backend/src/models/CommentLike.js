const mongoose = require('mongoose');

const CommentLikeSchema = new mongoose.Schema(
  {
    commentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', required: true, index: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  },
  { timestamps: true }
);

CommentLikeSchema.index({ commentId: 1, patientId: 1 }, { unique: true });

module.exports = mongoose.model('CommentLike', CommentLikeSchema);
