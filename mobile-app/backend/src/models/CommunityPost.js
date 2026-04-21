const mongoose = require('mongoose');

const CommunityPostSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    authorSnapshot: {
      name: { type: String, required: true },
      avatarUrl: { type: String, default: '' },
    },
    imageUrl: { type: String, default: '' },
    imageKey: { type: String },
    diagnosis: { type: String, default: '', trim: true },
    note: { type: String, required: true, trim: true },
    location: { type: String, default: '' },
    visibility: { type: String, enum: ['public', 'community'], default: 'community' },
    moderationStatus: { type: String, enum: ['visible', 'hidden', 'flagged'], default: 'visible' },
    likeCount: { type: Number, default: 0 },
    saveCount: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
    editedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CommunityPost', CommunityPostSchema);
