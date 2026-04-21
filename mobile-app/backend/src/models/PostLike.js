const mongoose = require('mongoose');

const PostLikeSchema = new mongoose.Schema(
  {
    postId: { type: mongoose.Schema.Types.ObjectId, ref: 'CommunityPost', required: true, index: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  },
  { timestamps: true }
);

PostLikeSchema.index({ postId: 1, patientId: 1 }, { unique: true });

module.exports = mongoose.model('PostLike', PostLikeSchema);
