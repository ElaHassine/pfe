const Patient = require('../models/Patient');
const CommunityPost = require('../models/CommunityPost');
const PostLike = require('../models/PostLike');
const Comment = require('../models/Comment');
const ActivityEvent = require('../models/ActivityEvent');
const asyncHandler = require('../middleware/asyncHandler');

exports.getPatientById = asyncHandler(async (req, res) => {
  const patient = await Patient.findById(req.params.id).select('-passwordHash');
  if (!patient) {
    return res.status(404).json({ message: 'Patient not found' });
  }
  res.json({ patient });
});

exports.getActivity = asyncHandler(async (req, res) => {
  const patientId = req.params.id || req.user._id;
  const events = await ActivityEvent.find({ patientId }).sort({ createdAt: -1 }).limit(50).lean();
  res.json({ events });
});

exports.getLikedPosts = asyncHandler(async (req, res) => {
  const patientId = req.params.id || req.user._id;
  const likes = await PostLike.find({ patientId }).sort({ createdAt: -1 }).populate({
    path: 'postId',
    populate: { path: 'patientId', select: 'profile role' },
  }).lean();

  const posts = likes
    .map((like) => like.postId)
    .filter(Boolean);

  const comments = await Comment.find({ postId: { $in: posts.map((post) => post._id) } }).lean();
  res.json({ posts, comments });
});

exports.getDashboardSummary = asyncHandler(async (req, res) => {
  const patient = await Patient.findById(req.user._id).select('stats').lean();
  const stats = patient?.stats || {};

  res.json({
    stats: {
      scanCount: stats.scanCount || 0,
      postCount: stats.postCount || 0,
      commentCount: stats.commentCount || 0,
      likeCount: stats.likeCount || 0,
    },
  });
});
