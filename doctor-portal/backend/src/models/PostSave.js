const mongoose = require('mongoose');

const PostSaveSchema = new mongoose.Schema(
  {
    postId: { type: mongoose.Schema.Types.ObjectId, ref: 'CommunityPost', required: true, index: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', index: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', index: true },
  },
  { timestamps: true }
);

PostSaveSchema.index({ postId: 1, patientId: 1 }, { unique: true, sparse: true });
PostSaveSchema.index({ postId: 1, doctorId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('PostSave', PostSaveSchema);