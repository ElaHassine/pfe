const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema(
  {
    postId: { type: mongoose.Schema.Types.ObjectId, ref: 'CommunityPost', required: true, index: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    authorSnapshot: {
      name: { type: String, required: true },
      avatarUrl: { type: String, default: '' },
    },
    body: { type: String, required: true, trim: true },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Comment', CommentSchema);
