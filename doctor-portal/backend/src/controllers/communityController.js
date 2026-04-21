const mongoose = require('mongoose');
const CommunityPost = require('../models/CommunityPost');
const Comment = require('../models/Comment');
const PostLike = require('../models/PostLike');
const Patient = require('../models/Patient');
const asyncHandler = require('../middleware/asyncHandler');
const { recordPatientActivity } = require('../services/activityService');

function snapshotFromPatient(patient) {
  const profile = patient.profile || {};
  return {
    name: profile.fullName || [profile.firstName, profile.lastName].filter(Boolean).join(' ') || patient.email,
    avatarUrl: profile.avatarUrl || '',
  };
}

async function hydratePosts(posts, currentUserId) {
  const postIds = posts.map((post) => post._id);
  const likes = await PostLike.find({ patientId: currentUserId, postId: { $in: postIds } }).select('postId').lean();
  const likedIds = new Set(likes.map((like) => String(like.postId)));
  const comments = await Comment.find({ postId: { $in: postIds }, deletedAt: null }).sort({ createdAt: 1 }).lean();

  const participantIds = new Set();
  posts.forEach((post) => {
    if (post?.patientId) participantIds.add(String(post.patientId));
  });
  comments.forEach((comment) => {
    if (comment?.patientId) participantIds.add(String(comment.patientId));
  });

  const participants = participantIds.size > 0
    ? await Patient.find({ _id: { $in: Array.from(participantIds) } }).select('profile.avatarUrl').lean()
    : [];
  const avatarByPatientId = new Map(
    participants.map((patient) => [String(patient._id), String(patient?.profile?.avatarUrl || '').trim()])
  );

  return posts.map((post) => {
    const postComments = comments
      .filter((comment) => String(comment.postId) === String(post._id))
      .map((comment) => ({
        ...comment,
        authorSnapshot: {
          ...(comment.authorSnapshot || {}),
          avatarUrl: avatarByPatientId.get(String(comment.patientId)) || String(comment?.authorSnapshot?.avatarUrl || '').trim(),
        },
      }));

    return {
      ...post,
      authorSnapshot: {
        ...(post.authorSnapshot || {}),
        avatarUrl: avatarByPatientId.get(String(post.patientId)) || String(post?.authorSnapshot?.avatarUrl || '').trim(),
      },
      likedByMe: likedIds.has(String(post._id)),
      comments: postComments,
    };
  });
}

exports.listFeed = asyncHandler(async (req, res) => {
  const posts = await CommunityPost.find({ moderationStatus: 'visible' }).sort({ createdAt: -1 }).lean();
  const hydrated = await hydratePosts(posts, req.user._id);
  res.json({ posts: hydrated });
});

exports.createPost = asyncHandler(async (req, res) => {
  const { imageUrl, imageKey, diagnosis, note, location = '', visibility = 'community' } = req.body;

  if (!imageUrl || !diagnosis || !note) {
    return res.status(400).json({ message: 'Image, diagnosis, and note are required' });
  }

  const patient = await Patient.findById(req.user._id).select('profile email');
  const post = await CommunityPost.create({
    patientId: req.user._id,
    authorSnapshot: snapshotFromPatient(patient),
    imageUrl,
    imageKey,
    diagnosis,
    note,
    location,
    visibility,
  });

  await Patient.findByIdAndUpdate(req.user._id, { $inc: { 'stats.postCount': 1 } });
  await recordPatientActivity(req.user._id, 'community.post-created', 'communityPost', post._id, { diagnosis, location });

  res.status(201).json({ post });
});

exports.getPostById = asyncHandler(async (req, res) => {
  const post = await CommunityPost.findById(req.params.postId).lean();
  if (!post) {
    return res.status(404).json({ message: 'Post not found' });
  }

  const hydrated = await hydratePosts([post], req.user._id);
  res.json({ post: hydrated[0] });
});

exports.addComment = asyncHandler(async (req, res) => {
  const { body } = req.body;
  if (!body || !body.trim()) {
    return res.status(400).json({ message: 'Comment text is required' });
  }

  const post = await CommunityPost.findById(req.params.postId);
  if (!post) {
    return res.status(404).json({ message: 'Post not found' });
  }

  const patient = await Patient.findById(req.user._id).select('profile email');
  const comment = await Comment.create({
    postId: post._id,
    patientId: req.user._id,
    authorSnapshot: snapshotFromPatient(patient),
    body: body.trim(),
  });

  post.commentCount += 1;
  await post.save();
  await Patient.findByIdAndUpdate(req.user._id, { $inc: { 'stats.commentCount': 1 } });
  await recordPatientActivity(req.user._id, 'community.comment-created', 'comment', comment._id, { postId: post._id });

  res.status(201).json({ comment });
});

exports.likePost = asyncHandler(async (req, res) => {
  const { postId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(postId)) {
    return res.status(400).json({ message: 'Invalid post id' });
  }

  const post = await CommunityPost.findById(postId);
  if (!post) {
    return res.status(404).json({ message: 'Post not found' });
  }

  const existing = await PostLike.findOne({ postId: post._id, patientId: req.user._id });
  if (existing) {
    return res.status(200).json({ liked: true });
  }

  await PostLike.create({ postId: post._id, patientId: req.user._id });
  await CommunityPost.updateOne({ _id: post._id }, { $inc: { likeCount: 1 } });
  await Patient.findByIdAndUpdate(req.user._id, { $inc: { 'stats.likeCount': 1 } });
  await recordPatientActivity(req.user._id, 'community.post-liked', 'communityPost', post._id, { liked: true });

  res.status(201).json({ liked: true });
});

exports.unlikePost = asyncHandler(async (req, res) => {
  const { postId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(postId)) {
    return res.status(400).json({ message: 'Invalid post id' });
  }

  const post = await CommunityPost.findById(postId);
  if (!post) {
    return res.status(404).json({ message: 'Post not found' });
  }

  const deleted = await PostLike.deleteOne({ postId: post._id, patientId: req.user._id });
  if (deleted.deletedCount > 0) {
    if ((post.likeCount || 0) > 0) {
      await CommunityPost.updateOne({ _id: post._id }, { $inc: { likeCount: -1 } });
    }
    await Patient.findByIdAndUpdate(req.user._id, { $inc: { 'stats.likeCount': -1 } });
    await recordPatientActivity(req.user._id, 'community.post-unliked', 'communityPost', post._id, { liked: false });
  }

  res.json({ liked: false });
});

exports.getComments = asyncHandler(async (req, res) => {
  const comments = await Comment.find({ postId: req.params.postId, deletedAt: null }).sort({ createdAt: 1 }).lean();
  res.json({ comments });
});
