const mongoose = require('mongoose');
const fs = require('fs/promises');
const path = require('path');
const CommunityPost = require('../models/CommunityPost');
const Comment = require('../models/Comment');
const PostLike = require('../models/PostLike');
const PostSave = require('../models/PostSave');
const CommentLike = require('../models/CommentLike');
const Patient = require('../models/Patient');
const asyncHandler = require('../middleware/asyncHandler');
const { recordPatientActivity } = require('../services/activityService');

function publicBaseUrl(req) {
  return `${req.protocol}://${req.get('host')}`;
}

function normalizeImageUrl(rawUrl, req) {
  const value = String(rawUrl || '').trim();
  if (!value) return '';

  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
      if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
        return `${publicBaseUrl(req)}${parsed.pathname}${parsed.search}`;
      }
    } catch (_error) {
      return value;
    }
    return value;
  }

  if (value.startsWith('/uploads/')) {
    return `${publicBaseUrl(req)}${value}`;
  }

  if (value.startsWith('uploads/')) {
    return `${publicBaseUrl(req)}/${value}`;
  }

  return value;
}

async function storeCommunityImage(file) {
  if (!file?.buffer) return { imageUrl: '', imageKey: '' };

  const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
  const safeExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext) ? ext : '.jpg';
  const fileName = `community-${Date.now()}-${Math.random().toString(36).slice(2, 10)}${safeExt}`;
  const relativeDir = path.join('uploads', 'community');
  const absoluteDir = path.join(__dirname, '..', '..', relativeDir);
  await fs.mkdir(absoluteDir, { recursive: true });

  const absoluteFilePath = path.join(absoluteDir, fileName);
  await fs.writeFile(absoluteFilePath, file.buffer);

  return {
    imageUrl: `/uploads/community/${fileName}`,
    imageKey: `community/${fileName}`,
  };
}

function snapshotFromPatient(patient) {
  const profile = patient.profile || {};
  return {
    name: profile.fullName || [profile.firstName, profile.lastName].filter(Boolean).join(' ') || patient.email,
    avatarUrl: profile.avatarUrl || '',
  };
}

async function hydratePosts(posts, currentUserId, req) {
  const postIds = posts.map((post) => post._id);
  const likes = await PostLike.find({ patientId: currentUserId, postId: { $in: postIds } }).select('postId').lean();
  const likedIds = new Set(likes.map((like) => String(like.postId)));
  const saves = await PostSave.find({ patientId: currentUserId, postId: { $in: postIds } }).select('postId').lean();
  const savedIds = new Set(saves.map((save) => String(save.postId)));
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
    participants.map((patient) => [
      String(patient._id),
      normalizeImageUrl(String(patient?.profile?.avatarUrl || '').trim(), req),
    ])
  );
  const commentIds = comments.map((comment) => comment._id);
  const commentLikes = commentIds.length > 0
    ? await CommentLike.find({ patientId: currentUserId, commentId: { $in: commentIds } }).select('commentId').lean()
    : [];
  const likedCommentIds = new Set(commentLikes.map((like) => String(like.commentId)));

  return posts.map((post) => {
    const postComments = comments
      .filter((comment) => String(comment.postId) === String(post._id) && !comment.parentCommentId)
      .map((comment) => {
        const replies = comments.filter((reply) => String(reply.parentCommentId) === String(comment._id));
        return {
          ...comment,
          authorSnapshot: {
            ...(comment.authorSnapshot || {}),
            avatarUrl: avatarByPatientId.get(String(comment.patientId)) || normalizeImageUrl(comment?.authorSnapshot?.avatarUrl, req) || '',
          },
          likedByMe: likedCommentIds.has(String(comment._id)),
          replies: replies.map((reply) => ({
            ...reply,
            authorSnapshot: {
              ...(reply.authorSnapshot || {}),
              avatarUrl: avatarByPatientId.get(String(reply.patientId)) || normalizeImageUrl(reply?.authorSnapshot?.avatarUrl, req) || '',
            },
            likedByMe: likedCommentIds.has(String(reply._id)),
          })),
        };
      });
    return {
      ...post,
      imageUrl: normalizeImageUrl(post.imageUrl, req),
      authorSnapshot: {
        ...(post.authorSnapshot || {}),
        avatarUrl: avatarByPatientId.get(String(post.patientId)) || normalizeImageUrl(post?.authorSnapshot?.avatarUrl, req) || '',
      },
      likedByMe: likedIds.has(String(post._id)),
      savedByMe: savedIds.has(String(post._id)),
      comments: postComments,
    };
  });
}

exports.listFeed = asyncHandler(async (req, res) => {
  const posts = await CommunityPost.find({ moderationStatus: 'visible' }).sort({ createdAt: -1 }).lean();
  const hydrated = await hydratePosts(posts, req.user._id, req);
  res.json({ posts: hydrated });
});

exports.createPost = asyncHandler(async (req, res) => {
  const { imageUrl, imageKey, diagnosis, note, location = '', visibility = 'community' } = req.body;

  const hasText = !!String(note || '').trim();
  if (!hasText) {
    return res.status(400).json({ message: 'Post text is required' });
  }

  const uploaded = req.file ? await storeCommunityImage(req.file) : { imageUrl: '', imageKey: '' };
  const resolvedImageUrl = uploaded.imageUrl || String(imageUrl || '').trim() || '';
  const resolvedImageKey = uploaded.imageKey || imageKey;

  const patient = await Patient.findById(req.user._id).select('profile email');
  const post = await CommunityPost.create({
    patientId: req.user._id,
    authorSnapshot: snapshotFromPatient(patient),
    imageUrl: resolvedImageUrl,
    imageKey: resolvedImageKey,
    diagnosis: String(diagnosis || '').trim() || '',
    note: String(note || '').trim(),
    location,
    visibility,
  });

  await Patient.findByIdAndUpdate(req.user._id, { $inc: { 'stats.postCount': 1 } });
  await recordPatientActivity(req.user._id, 'community.post-created', 'communityPost', post._id, { diagnosis, location });

  res.status(201).json({ post: { ...post.toObject(), imageUrl: normalizeImageUrl(post.imageUrl, req) } });
});

exports.getPostById = asyncHandler(async (req, res) => {
  const post = await CommunityPost.findById(req.params.postId).lean();
  if (!post) {
    return res.status(404).json({ message: 'Post not found' });
  }

  const hydrated = await hydratePosts([post], req.user._id, req);
  res.json({ post: hydrated[0] });
});

exports.updatePost = asyncHandler(async (req, res) => {
  const { note, diagnosis, location } = req.body;
  const trimmedNote = String(note || '').trim();
  if (!trimmedNote) {
    return res.status(400).json({ message: 'Post text is required' });
  }

  const post = await CommunityPost.findById(req.params.postId);
  if (!post) {
    return res.status(404).json({ message: 'Post not found' });
  }

  if (String(post.patientId) !== String(req.user._id)) {
    return res.status(403).json({ message: 'Not allowed to edit this post' });
  }

  post.note = trimmedNote;
  if (diagnosis !== undefined) post.diagnosis = String(diagnosis || '').trim();
  if (location !== undefined) post.location = String(location || '').trim();
  post.editedAt = new Date();
  await post.save();

  res.json({ post: { ...post.toObject(), imageUrl: normalizeImageUrl(post.imageUrl, req) } });
});

exports.deletePost = asyncHandler(async (req, res) => {
  const post = await CommunityPost.findById(req.params.postId);
  if (!post) {
    return res.status(404).json({ message: 'Post not found' });
  }

  if (String(post.patientId) !== String(req.user._id)) {
    return res.status(403).json({ message: 'Not allowed to delete this post' });
  }

  const commentIds = await Comment.find({ postId: post._id }).distinct('_id');

  await Promise.all([
    CommunityPost.deleteOne({ _id: post._id }),
    Comment.deleteMany({ postId: post._id }),
    PostLike.deleteMany({ postId: post._id }),
    PostSave.deleteMany({ postId: post._id }),
    commentIds.length > 0 ? CommentLike.deleteMany({ commentId: { $in: commentIds } }) : Promise.resolve(),
    Patient.updateOne(
      { _id: req.user._id },
      { $inc: { 'stats.postCount': -1 }, $max: { 'stats.postCount': 0 } }
    ),
  ]);

  res.json({ deleted: true });
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
  if (String(req.user._id) !== String(post.patientId)) {
    await recordPatientActivity(req.user._id, 'community.comment-created', 'comment', comment._id, { postId: post._id });
  }

  res.status(201).json({ comment });
});

exports.addReply = asyncHandler(async (req, res) => {
  const { body } = req.body;
  if (!body || !body.trim()) {
    return res.status(400).json({ message: 'Reply text is required' });
  }

  const post = await CommunityPost.findById(req.params.postId);
  if (!post) {
    return res.status(404).json({ message: 'Post not found' });
  }

  const parentComment = await Comment.findById(req.params.commentId);
  if (!parentComment) {
    return res.status(404).json({ message: 'Parent comment not found' });
  }

  const patient = await Patient.findById(req.user._id).select('profile email');
  const reply = await Comment.create({
    postId: post._id,
    patientId: req.user._id,
    authorSnapshot: snapshotFromPatient(patient),
    body: body.trim(),
    parentCommentId: parentComment._id,
  });

  await Patient.findByIdAndUpdate(req.user._id, { $inc: { 'stats.commentCount': 1 } });
  if (String(req.user._id) !== String(post.patientId)) {
    await recordPatientActivity(req.user._id, 'community.reply-created', 'comment', reply._id, { postId: post._id, parentCommentId: parentComment._id });
  }

  res.status(201).json({ reply });
});

exports.updateComment = asyncHandler(async (req, res) => {
  const { body } = req.body;
  const trimmedBody = String(body || '').trim();
  if (!trimmedBody) {
    return res.status(400).json({ message: 'Comment text is required' });
  }

  const comment = await Comment.findOne({
    _id: req.params.commentId,
    postId: req.params.postId,
    deletedAt: null,
  });

  if (!comment) {
    return res.status(404).json({ message: 'Comment not found' });
  }

  if (String(comment.patientId) !== String(req.user._id)) {
    return res.status(403).json({ message: 'Not allowed to edit this comment' });
  }

  comment.body = trimmedBody;
  comment.editedAt = new Date();
  await comment.save();

  res.json({ comment });
});

exports.deleteComment = asyncHandler(async (req, res) => {
  const comment = await Comment.findOne({
    _id: req.params.commentId,
    postId: req.params.postId,
    deletedAt: null,
  });

  if (!comment) {
    return res.status(404).json({ message: 'Comment not found' });
  }

  if (String(comment.patientId) !== String(req.user._id)) {
    return res.status(403).json({ message: 'Not allowed to delete this comment' });
  }

  const now = new Date();
  if (comment.parentCommentId) {
    await Comment.updateOne({ _id: comment._id }, { $set: { deletedAt: now } });
    await CommentLike.deleteMany({ commentId: comment._id });
    await CommunityPost.updateOne({ _id: req.params.postId }, { $inc: { commentCount: -1 } });
    return res.json({ deleted: true });
  }

  const replies = await Comment.find({ parentCommentId: comment._id, deletedAt: null }).select('_id').lean();
  const replyIds = replies.map((item) => item._id);
  const deleteCount = 1 + replyIds.length;

  await Comment.updateOne({ _id: comment._id }, { $set: { deletedAt: now } });
  if (replyIds.length > 0) {
    await Comment.updateMany({ _id: { $in: replyIds } }, { $set: { deletedAt: now } });
    await CommentLike.deleteMany({ commentId: { $in: replyIds } });
  }
  await CommentLike.deleteMany({ commentId: comment._id });
  await CommunityPost.updateOne({ _id: req.params.postId }, { $inc: { commentCount: -deleteCount } });

  res.json({ deleted: true });
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
  if (String(req.user._id) !== String(post.patientId)) {
    await recordPatientActivity(req.user._id, 'community.post-liked', 'communityPost', post._id, { liked: true });
  }

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
  }

  res.json({ liked: false });
});

exports.getComments = asyncHandler(async (req, res) => {
  const comments = await Comment.find({ postId: req.params.postId, deletedAt: null }).sort({ createdAt: 1 }).lean();
  res.json({ comments });
});

exports.savePost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(postId)) {
    return res.status(400).json({ message: 'Invalid post id' });
  }

  const post = await CommunityPost.findById(postId);
  if (!post) {
    return res.status(404).json({ message: 'Post not found' });
  }

  const existing = await PostSave.findOne({ postId: post._id, patientId: req.user._id });
  if (existing) {
    return res.status(200).json({ saved: true });
  }

  await PostSave.create({ postId: post._id, patientId: req.user._id });
  await CommunityPost.updateOne({ _id: post._id }, { $inc: { saveCount: 1 } });
  res.status(201).json({ saved: true });
});

exports.unsavePost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(postId)) {
    return res.status(400).json({ message: 'Invalid post id' });
  }

  const post = await CommunityPost.findById(postId);
  if (!post) {
    return res.status(404).json({ message: 'Post not found' });
  }

  const deleted = await PostSave.deleteOne({ postId: post._id, patientId: req.user._id });
  if (deleted.deletedCount > 0 && (post.saveCount || 0) > 0) {
    await CommunityPost.updateOne({ _id: post._id }, { $inc: { saveCount: -1 } });
  }

  res.json({ saved: false });
});

exports.likeComment = asyncHandler(async (req, res) => {
  const { postId, commentId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(commentId)) {
    return res.status(400).json({ message: 'Invalid comment id' });
  }

  const comment = await Comment.findOne({ _id: commentId, postId, deletedAt: null });
  if (!comment) {
    return res.status(404).json({ message: 'Comment not found' });
  }

  const existing = await CommentLike.findOne({ commentId: comment._id, patientId: req.user._id });
  if (existing) {
    return res.status(200).json({ liked: true });
  }

  await CommentLike.create({ commentId: comment._id, patientId: req.user._id });
  res.status(201).json({ liked: true });
});

exports.unlikeComment = asyncHandler(async (req, res) => {
  const { postId, commentId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(commentId)) {
    return res.status(400).json({ message: 'Invalid comment id' });
  }

  const comment = await Comment.findOne({ _id: commentId, postId, deletedAt: null });
  if (!comment) {
    return res.status(404).json({ message: 'Comment not found' });
  }

  await CommentLike.deleteOne({ commentId: comment._id, patientId: req.user._id });
  res.json({ liked: false });
});
