const mongoose = require('mongoose');
const fs = require('fs/promises');
const path = require('path');
const CommunityPost = require('../models/CommunityPost');
const Comment = require('../models/Comment');
const PostLike = require('../models/PostLike');
const PostSave = require('../models/PostSave');
const CommentLike = require('../models/CommentLike');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const asyncHandler = require('../middleware/asyncHandler');
const { recordDoctorActivity } = require('../services/activityService');
const { getUploadsSubdir, normalizeMediaUrl } = require('../utils/media');

function snapshotFromDoctor(doctor) {
  const profile = (doctor && doctor.profile) || {};
  return {
    name: profile.fullName || [profile.firstName, profile.lastName].filter(Boolean).join(' ') || (doctor && doctor.email) || 'Doctor',
    avatarUrl: profile.avatarUrl || '',
    specialty: (doctor && doctor.specialty) || '',
  };
}

function normalizeImageUrl(rawUrl, req) {
  return normalizeMediaUrl(rawUrl, req);
}

function authorKey(item) {
  return (item && item.authorType === 'doctor') ? String(item.doctorId || '') : String(item.patientId || '');
}

async function hydratePosts(posts, currentDoctorId, req) {
  const postIds = posts.map((post) => post._id);
  const [likes, saves, comments] = await Promise.all([
    PostLike.find({ doctorId: currentDoctorId, postId: { $in: postIds } }).select('postId').lean(),
    PostSave.find({ doctorId: currentDoctorId, postId: { $in: postIds } }).select('postId').lean(),
    Comment.find({ postId: { $in: postIds }, deletedAt: null }).sort({ createdAt: 1 }).lean(),
  ]);

  const likedIds = new Set(likes.map((like) => String(like.postId)));
  const savedIds = new Set(saves.map((save) => String(save.postId)));
  const patientIds = new Set();
  const doctorIds = new Set();

  posts.forEach((post) => {
    if (post.patientId) patientIds.add(String(post.patientId));
    if (post.doctorId) doctorIds.add(String(post.doctorId));
  });
  comments.forEach((comment) => {
    if (comment.patientId) patientIds.add(String(comment.patientId));
    if (comment.doctorId) doctorIds.add(String(comment.doctorId));
  });

  const [patients, doctors, commentLikes] = await Promise.all([
    patientIds.size ? Patient.find({ _id: { $in: Array.from(patientIds) } }).select('profile.avatarUrl profile.fullName email').lean() : [],
    doctorIds.size ? Doctor.find({ _id: { $in: Array.from(doctorIds) } }).select('profile.avatarUrl profile.fullName email specialty').lean() : [],
    comments.length ? CommentLike.find({ doctorId: currentDoctorId, commentId: { $in: comments.map((c) => c._id) } }).select('commentId').lean() : [],
  ]);

  const avatarByPatientId = new Map(patients.map((patient) => [String(patient._id), normalizeImageUrl((patient && patient.profile && patient.profile.avatarUrl) || '', req)]));
  const avatarByDoctorId = new Map(doctors.map((doctor) => [String(doctor._id), normalizeImageUrl((doctor && doctor.profile && doctor.profile.avatarUrl) || '', req)]));
  const nameByDoctorId = new Map(doctors.map((doctor) => [String(doctor._id), (doctor && doctor.profile && doctor.profile.fullName) || doctor.email || 'Doctor']));
  const specialtyByDoctorId = new Map(doctors.map((doctor) => [String(doctor._id), doctor && doctor.specialty || '']));
  const likedCommentIds = new Set(commentLikes.map((like) => String(like.commentId)));

  const commentsByPostId = comments.reduce((accumulator, comment) => {
    const key = String(comment.postId);
    const list = accumulator.get(key) || [];
    list.push(comment);
    accumulator.set(key, list);
    return accumulator;
  }, new Map());

  return posts.map((post) => {
    const postComments = commentsByPostId.get(String(post._id)) || [];
    const topLevelComments = postComments.filter((comment) => !comment.parentCommentId);
    const postAuthorId = authorKey(post);

    return {
      ...post,
      imageUrl: normalizeImageUrl(post.imageUrl, req),
      authorSnapshot: {
        ...(post.authorSnapshot || {}),
        name: post.authorType === 'doctor'
          ? nameByDoctorId.get(postAuthorId) || (post.authorSnapshot && post.authorSnapshot.name) || 'Doctor'
          : (post.authorSnapshot && post.authorSnapshot.name) || 'Patient',
        avatarUrl: post.authorType === 'doctor'
          ? avatarByDoctorId.get(postAuthorId) || normalizeImageUrl((post && post.authorSnapshot && post.authorSnapshot.avatarUrl) || '', req)
          : avatarByPatientId.get(postAuthorId) || normalizeImageUrl((post && post.authorSnapshot && post.authorSnapshot.avatarUrl) || '', req),
        specialty: post.authorType === 'doctor'
          ? specialtyByDoctorId.get(postAuthorId) || (post && post.authorSnapshot && post.authorSnapshot.specialty) || ''
          : (post && post.authorSnapshot && post.authorSnapshot.specialty) || '',
      },
      likedByMe: likedIds.has(String(post._id)),
      savedByMe: savedIds.has(String(post._id)),
      comments: topLevelComments.map((comment) => {
        const commentAuthorId = authorKey(comment);
        const replies = postComments.filter((reply) => String(reply.parentCommentId) === String(comment._id));

        return {
          ...comment,
          authorSnapshot: {
            ...(comment.authorSnapshot || {}),
            name: comment.authorType === 'doctor'
              ? nameByDoctorId.get(commentAuthorId) || (comment.authorSnapshot && comment.authorSnapshot.name) || 'Doctor'
              : (comment.authorSnapshot && comment.authorSnapshot.name) || 'Patient',
            avatarUrl: comment.authorType === 'doctor'
              ? avatarByDoctorId.get(commentAuthorId) || normalizeImageUrl((comment && comment.authorSnapshot && comment.authorSnapshot.avatarUrl) || '', req)
              : avatarByPatientId.get(commentAuthorId) || normalizeImageUrl((comment && comment.authorSnapshot && comment.authorSnapshot.avatarUrl) || '', req),
            specialty: comment.authorType === 'doctor'
              ? specialtyByDoctorId.get(commentAuthorId) || (comment && comment.authorSnapshot && comment.authorSnapshot.specialty) || ''
              : (comment && comment.authorSnapshot && comment.authorSnapshot.specialty) || '',
          },
          likedByMe: likedCommentIds.has(String(comment._id)),
          replies: replies.map((reply) => {
            const replyAuthorId = authorKey(reply);
            return {
              ...reply,
              authorSnapshot: {
                ...(reply.authorSnapshot || {}),
                name: reply.authorType === 'doctor'
                  ? nameByDoctorId.get(replyAuthorId) || (reply.authorSnapshot && reply.authorSnapshot.name) || 'Doctor'
                  : (reply.authorSnapshot && reply.authorSnapshot.name) || 'Patient',
                avatarUrl: reply.authorType === 'doctor'
                  ? avatarByDoctorId.get(replyAuthorId) || normalizeImageUrl((reply && reply.authorSnapshot && reply.authorSnapshot.avatarUrl) || '', req)
                  : avatarByPatientId.get(replyAuthorId) || normalizeImageUrl((reply && reply.authorSnapshot && reply.authorSnapshot.avatarUrl) || '', req),
                specialty: reply.authorType === 'doctor'
                  ? specialtyByDoctorId.get(replyAuthorId) || (reply && reply.authorSnapshot && reply.authorSnapshot.specialty) || ''
                  : (reply && reply.authorSnapshot && reply.authorSnapshot.specialty) || '',
              },
              likedByMe: likedCommentIds.has(String(reply._id)),
            };
          }),
        };
      }),
    };
  });
}

function toPostResponse(post, req) {
  return {
    ...post.toObject(),
    imageUrl: normalizeImageUrl(post.imageUrl, req),
  };
}

exports.listFeed = asyncHandler(async (req, res) => {
  const posts = await CommunityPost.find({ moderationStatus: 'visible' }).sort({ createdAt: -1 }).lean();
  const hydrated = await hydratePosts(posts, req.user._id, req);
  res.json({ posts: hydrated });
});

exports.createPost = asyncHandler(async (req, res) => {
  const { imageUrl = '', imageKey = '', diagnosis = '', note, location = '', visibility = 'community' } = req.body;
  const trimmedNote = String(note || '').trim();

  if (!trimmedNote) {
    return res.status(400).json({ message: 'Post text is required' });
  }

  // store uploaded image if provided
  async function storeCommunityImage(file) {
    if (!file || !file.buffer) return { imageUrl: '', imageKey: '' };
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    const safeExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext) ? ext : '.jpg';
    const fileName = `community-${Date.now()}-${Math.random().toString(36).slice(2, 10)}${safeExt}`;
    const absoluteDir = getUploadsSubdir('community');
    await fs.mkdir(absoluteDir, { recursive: true });

    const absoluteFilePath = path.join(absoluteDir, fileName);
    await fs.writeFile(absoluteFilePath, file.buffer);

    return {
      imageUrl: `/uploads/community/${fileName}`,
      imageKey: `community/${fileName}`,
    };
  }

  const uploaded = req.file ? await storeCommunityImage(req.file) : { imageUrl: '', imageKey: '' };
  const resolvedImageUrl = uploaded.imageUrl || String(imageUrl || '').trim() || '';
  const resolvedImageKey = uploaded.imageKey || imageKey || '';

  const doctor = await Doctor.findById(req.user._id).select('profile email specialty').lean();
  const post = await CommunityPost.create({
    doctorId: req.user._id,
    authorType: 'doctor',
    authorSnapshot: snapshotFromDoctor(doctor),
    imageUrl: resolvedImageUrl,
    imageKey: resolvedImageKey,
    diagnosis: String(diagnosis || '').trim(),
    note: trimmedNote,
    location: String(location || '').trim(),
    visibility,
  });

  await recordDoctorActivity(req.user._id, 'community.post-created', 'communityPost', post._id, {
    diagnosis: String(diagnosis || '').trim(),
    location: String(location || '').trim(),
  });

  res.status(201).json({ post: toPostResponse(post, req) });
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

  if (String(post.doctorId) !== String(req.user._id)) {
    return res.status(403).json({ message: 'Not allowed to edit this post' });
  }

  post.note = trimmedNote;
  if (diagnosis !== undefined) post.diagnosis = String(diagnosis || '').trim();
  if (location !== undefined) post.location = String(location || '').trim();
  post.editedAt = new Date();
  await post.save();

  res.json({ post: toPostResponse(post, req) });
});

exports.deletePost = asyncHandler(async (req, res) => {
  const post = await CommunityPost.findById(req.params.postId);
  if (!post) {
    return res.status(404).json({ message: 'Post not found' });
  }

  if (String(post.doctorId) !== String(req.user._id)) {
    return res.status(403).json({ message: 'Not allowed to delete this post' });
  }

  const commentIds = await Comment.find({ postId: post._id }).distinct('_id');

  await Promise.all([
    CommunityPost.deleteOne({ _id: post._id }),
    Comment.deleteMany({ postId: post._id }),
    PostLike.deleteMany({ postId: post._id }),
    PostSave.deleteMany({ postId: post._id }),
    commentIds.length > 0 ? CommentLike.deleteMany({ commentId: { $in: commentIds } }) : Promise.resolve(),
  ]);

  res.json({ deleted: true });
});

exports.getPostById = asyncHandler(async (req, res) => {
  const post = await CommunityPost.findById(req.params.postId).lean();
  if (!post) {
    return res.status(404).json({ message: 'Post not found' });
  }

  const hydrated = await hydratePosts([post], req.user._id, req);
  res.json({ post: hydrated[0] });
});

exports.addComment = asyncHandler(async (req, res) => {
  const { body } = req.body;
  const trimmedBody = String(body || '').trim();

  if (!trimmedBody) {
    return res.status(400).json({ message: 'Comment text is required' });
  }

  const post = await CommunityPost.findById(req.params.postId);
  if (!post) {
    return res.status(404).json({ message: 'Post not found' });
  }

  const doctor = await Doctor.findById(req.user._id).select('profile email specialty').lean();
  const comment = await Comment.create({
    postId: post._id,
    doctorId: req.user._id,
    authorType: 'doctor',
    authorSnapshot: snapshotFromDoctor(doctor),
    body: trimmedBody,
  });

  post.commentCount = (post.commentCount || 0) + 1;
  await post.save();
  await recordDoctorActivity(req.user._id, 'community.comment-created', 'comment', comment._id, { postId: post._id });

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

  const existing = await PostLike.findOne({ postId: post._id, doctorId: req.user._id });
  if (existing) {
    return res.status(200).json({ liked: true });
  }

  await PostLike.create({ postId: post._id, doctorId: req.user._id });
  await CommunityPost.updateOne({ _id: post._id }, { $inc: { likeCount: 1 } });
  await recordDoctorActivity(req.user._id, 'community.post-liked', 'communityPost', post._id, { liked: true });

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

  const deleted = await PostLike.deleteOne({ postId: post._id, doctorId: req.user._id });
  if (deleted.deletedCount > 0 && (post.likeCount || 0) > 0) {
    await CommunityPost.updateOne({ _id: post._id }, { $inc: { likeCount: -1 } });
  }
  if (deleted.deletedCount > 0) {
    await recordDoctorActivity(req.user._id, 'community.post-unliked', 'communityPost', post._id, { liked: false });
  }

  res.json({ liked: false });
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

  const existing = await PostSave.findOne({ postId: post._id, doctorId: req.user._id });
  if (existing) {
    return res.status(200).json({ saved: true });
  }

  await PostSave.create({ postId: post._id, doctorId: req.user._id });
  await CommunityPost.updateOne({ _id: post._id }, { $inc: { saveCount: 1 } });
  await recordDoctorActivity(req.user._id, 'community.post-saved', 'communityPost', post._id, { saved: true });

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

  const deleted = await PostSave.deleteOne({ postId: post._id, doctorId: req.user._id });
  if (deleted.deletedCount > 0 && (post.saveCount || 0) > 0) {
    await CommunityPost.updateOne({ _id: post._id }, { $inc: { saveCount: -1 } });
  }
  if (deleted.deletedCount > 0) {
    await recordDoctorActivity(req.user._id, 'community.post-unsaved', 'communityPost', post._id, { saved: false });
  }

  res.json({ saved: false });
});

exports.getComments = asyncHandler(async (req, res) => {
  const comments = await Comment.find({ postId: req.params.postId, deletedAt: null }).sort({ createdAt: 1 }).lean();
  res.json({ comments });
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

  const doctor = await Doctor.findById(req.user._id).select('profile email specialty').lean();
  const reply = await Comment.create({
    postId: post._id,
    doctorId: req.user._id,
    authorType: 'doctor',
    authorSnapshot: snapshotFromDoctor(doctor),
    body: body.trim(),
    parentCommentId: parentComment._id,
  });

  if (String(req.user._id) !== String(post.doctorId)) {
    await recordDoctorActivity(req.user._id, 'community.reply-created', 'comment', reply._id, { postId: post._id, parentCommentId: parentComment._id });
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

  // allow doctor who authored to edit
  if (String(comment.doctorId) !== String(req.user._id)) {
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

  if (String(comment.doctorId) !== String(req.user._id)) {
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

exports.likeComment = asyncHandler(async (req, res) => {
  const { postId, commentId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(commentId)) {
    return res.status(400).json({ message: 'Invalid comment id' });
  }

  const comment = await Comment.findOne({ _id: commentId, postId, deletedAt: null });
  if (!comment) {
    return res.status(404).json({ message: 'Comment not found' });
  }

  const existing = await CommentLike.findOne({ commentId: comment._id, doctorId: req.user._id });
  if (existing) {
    return res.status(200).json({ liked: true });
  }

  await CommentLike.create({ commentId: comment._id, doctorId: req.user._id });
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

  await CommentLike.deleteOne({ commentId: comment._id, doctorId: req.user._id });
  res.json({ liked: false });
});