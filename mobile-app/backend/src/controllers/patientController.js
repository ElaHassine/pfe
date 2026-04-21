const Patient = require('../models/Patient');
const mongoose = require('mongoose');
const Doctor = require('../models/Doctor');
const CommunityPost = require('../models/CommunityPost');
const PostLike = require('../models/PostLike');
const PostSave = require('../models/PostSave');
const BookingRequest = require('../models/BookingRequest');
const Comment = require('../models/Comment');
const CommentLike = require('../models/CommentLike');
const ActivityEvent = require('../models/ActivityEvent');
const asyncHandler = require('../middleware/asyncHandler');

function baseUrl(req) {
  return `${req.protocol}://${req.get('host')}`;
}

function normalizeImageUrl(rawUrl, req) {
  const value = String(rawUrl || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('/uploads/')) return `${baseUrl(req)}${value}`;
  if (value.startsWith('uploads/')) return `${baseUrl(req)}/${value}`;
  return value;
}

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
  const postCount = await CommunityPost.countDocuments({ patientId: req.user._id });

  res.json({
    stats: {
      scanCount: stats.scanCount || 0,
      postCount,
      commentCount: stats.commentCount || 0,
      likeCount: stats.likeCount || 0,
    },
  });
});

exports.getActivityOverview = asyncHandler(async (req, res) => {
  const patientId = req.user._id;

  const [myPostsRaw, likesRaw, myCommentsRaw, savesRaw, appointmentsRaw, commentLikesRaw] = await Promise.all([
    CommunityPost.find({ patientId }).sort({ createdAt: -1 }).lean(),
    PostLike.find({ patientId }).sort({ createdAt: -1 }).populate('postId').lean(),
    Comment.find({ patientId, deletedAt: null }).sort({ createdAt: -1 }).populate('postId').lean(),
    PostSave.find({ patientId }).sort({ createdAt: -1 }).populate('postId').lean(),
    BookingRequest.find({ patientId }).sort({ createdAt: -1 }).lean(),
    CommentLike.find({ patientId }).sort({ createdAt: -1 }).populate({ path: 'commentId', populate: { path: 'postId' } }).lean(),
  ]);

  const myPosts = myPostsRaw.map((post) => ({
    id: String(post._id),
    note: post.note || '',
    imageUrl: normalizeImageUrl(post.imageUrl, req),
    diagnosis: post.diagnosis || '',
    likeCount: Number(post.likeCount || 0),
    commentCount: Number(post.commentCount || 0),
    createdAt: post.createdAt,
  }));

  const likedPosts = likesRaw
    .map((like) => like.postId)
    .filter(Boolean)
    .map((post) => ({
      id: String(post._id),
      note: post.note || '',
      imageUrl: normalizeImageUrl(post.imageUrl, req),
      diagnosis: post.diagnosis || '',
      likeCount: Number(post.likeCount || 0),
      createdAt: post.createdAt,
    }));

  const myComments = myCommentsRaw.map((comment) => ({
    id: String(comment._id),
    body: comment.body || '',
    postId: comment.postId?._id ? String(comment.postId._id) : String(comment.postId || ''),
    postNote: comment.postId?.note || '',
    isReply: !!comment.parentCommentId,
    createdAt: comment.createdAt,
  }));

  const savedPosts = savesRaw
    .map((save) => save.postId)
    .filter(Boolean)
    .map((post) => ({
      id: String(post._id),
      note: post.note || '',
      imageUrl: normalizeImageUrl(post.imageUrl, req),
      diagnosis: post.diagnosis || '',
      createdAt: post.createdAt,
    }));

  const missingLocationAppointments = appointmentsRaw.filter((appt) => !String(appt?.doctorSnapshot?.location || '').trim());
  const doctorObjectIds = missingLocationAppointments
    .map((appt) => String(appt?.doctorId || '').trim())
    .filter((id) => mongoose.Types.ObjectId.isValid(id));

  const doctorNames = missingLocationAppointments
    .map((appt) => String(appt?.doctorSnapshot?.name || '').trim())
    .filter(Boolean);

  const [doctorsByIdRaw, doctorsByNameRaw] = await Promise.all([
    doctorObjectIds.length > 0 ? Doctor.find({ _id: { $in: doctorObjectIds } }).select('profile.fullName profile.location').lean() : Promise.resolve([]),
    doctorNames.length > 0 ? Doctor.find({ 'profile.fullName': { $in: doctorNames } }).select('profile.fullName profile.location').lean() : Promise.resolve([]),
  ]);

  const locationByDoctorId = new Map(doctorsByIdRaw.map((doctor) => [String(doctor._id), String(doctor?.profile?.location || '').trim()]));
  const locationByDoctorName = new Map(doctorsByNameRaw.map((doctor) => [String(doctor?.profile?.fullName || '').trim(), String(doctor?.profile?.location || '').trim()]));

  const appointments = appointmentsRaw.map((appt) => {
    // Map BookingRequest status to appointment state
    let appointmentStatus = 'pending';
    if (appt.status === 'declined') {
      appointmentStatus = 'canceled';
    } else if ((appt.status === 'accepted' || !appt.status) && appt.scheduledAt) {
      appointmentStatus = 'scheduled';
    }

    return {
      id: String(appt._id),
      doctorName: appt.doctorSnapshot?.name || 'Doctor',
      specialty: appt.doctorSnapshot?.specialty || 'Dermatology',
      location: String(appt.doctorSnapshot?.location || '').trim()
        || locationByDoctorId.get(String(appt.doctorId || '').trim())
        || locationByDoctorName.get(String(appt.doctorSnapshot?.name || '').trim())
        || '',
      status: appointmentStatus,
      preferredTime: appt.preferredTime || '',
      scheduledAt: appt.scheduledAt || null,
      createdAt: appt.createdAt,
    };
  });

  const likedComments = commentLikesRaw
    .map((entry) => entry.commentId)
    .filter(Boolean)
    .map((comment) => ({
      id: String(comment._id),
      body: comment.body || '',
      postId: comment.postId?._id ? String(comment.postId._id) : String(comment.postId || ''),
      postNote: comment.postId?.note || '',
      createdAt: comment.createdAt,
    }));

  res.json({
    activity: {
      myPosts,
      likedPosts,
      myComments,
      savedPosts,
      appointments,
      likedComments,
    },
  });
});
