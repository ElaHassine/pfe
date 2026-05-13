const mongoose = require('mongoose');

const CATEGORY_COLORS = {
  'Detection': '#00C2B2',
  'Education': '#6366F1',
  'Prevention': '#F59E0B',
  'Reference': '#00C48C',
  'Treatment': '#45B7D1',
  'Dermatology': '#EC4899',
  'Screening': '#8B5CF6',
  'Skincare': '#06B6D4',
  'Wellness': '#10B981',
  'Case Studies': '#F97316',
};

const BlogPostSchema = new mongoose.Schema(
  {
    authorDoctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true, index: true },
    authorSnapshot: {
      name: { type: String, required: true },
      avatarUrl: { type: String, default: '' },
      specialty: { type: String, default: '' },
    },
    title: { type: String, trim: true, default: '' },
    summary: { type: String, trim: true, default: '' },
    content: { type: String, trim: true, default: '' },
    coverImageUrl: { type: String, default: '' },
    tags: [{ type: String, trim: true }],
    keyPoints: [{ type: String, trim: true }],
    category: { type: String, trim: true, default: 'Detection' },
    color: { type: String, default: () => CATEGORY_COLORS['Detection'] },
    readTime: { type: String, default: '' },
    status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Middleware to set color based on category
BlogPostSchema.pre('save', function(next) {
  if (this.isModified('category')) {
    this.color = CATEGORY_COLORS[this.category] || '#00C2B2';
  }
  next();
});

module.exports = mongoose.model('BlogPost', BlogPostSchema);