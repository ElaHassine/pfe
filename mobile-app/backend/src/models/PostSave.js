const mongoose = require('mongoose');

const PostSaveSchema = new mongoose.Schema(
  {
    postId: { type: mongoose.Schema.Types.ObjectId, ref: 'CommunityPost', required: true, index: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  },
  { timestamps: true }
);

PostSaveSchema.index({ postId: 1, patientId: 1 }, { unique: true });

module.exports = mongoose.model('PostSave', PostSaveSchema);
