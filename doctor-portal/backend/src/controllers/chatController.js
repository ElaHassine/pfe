const mongoose = require('mongoose');
const asyncHandler = require('../middleware/asyncHandler');
const ChatThread = require('../models/ChatThread');
const ChatMessage = require('../models/ChatMessage');

function serializeThread(thread) {
  return {
    id: thread._id,
    doctorId: thread.doctorId,
    doctorName: thread.doctorSnapshot?.name || 'Doctor',
    specialty: thread.doctorSnapshot?.specialty || 'Dermatologist',
    lastMessage: thread.lastMessage || '',
    lastMessageAt: thread.lastMessageAt || thread.updatedAt,
    unread: thread.unreadForPatient || 0,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
  };
}

function serializeMessage(message) {
  return {
    id: message._id,
    threadId: message.threadId,
    body: message.body,
    senderType: message.senderType,
    senderName: message.senderSnapshot?.name || (message.senderType === 'patient' ? 'You' : 'Doctor'),
    createdAt: message.createdAt,
  };
}

exports.listThreads = asyncHandler(async (req, res) => {
  const threads = await ChatThread.find({ patientId: req.user._id })
    .sort({ lastMessageAt: -1 })
    .lean();

  res.json({ threads: threads.map(serializeThread) });
});

exports.upsertThread = asyncHandler(async (req, res) => {
  const { doctorId, doctorName, specialty } = req.body;

  if (!doctorId || !doctorName) {
    return res.status(400).json({ message: 'doctorId and doctorName are required' });
  }

  const thread = await ChatThread.findOneAndUpdate(
    { patientId: req.user._id, doctorId: String(doctorId) },
    {
      $setOnInsert: {
        patientId: req.user._id,
        doctorId: String(doctorId),
      },
      $set: {
        doctorSnapshot: {
          name: doctorName,
          specialty: specialty || 'Dermatologist',
        },
      },
    },
    { upsert: true, new: true }
  ).lean();

  res.status(201).json({ thread: serializeThread(thread) });
});

exports.getMessages = asyncHandler(async (req, res) => {
  const { threadId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(threadId)) {
    return res.status(400).json({ message: 'Invalid thread id' });
  }

  const thread = await ChatThread.findById(threadId).lean();
  if (!thread || String(thread.patientId) !== String(req.user._id)) {
    return res.status(404).json({ message: 'Thread not found' });
  }

  const messages = await ChatMessage.find({ threadId: thread._id }).sort({ createdAt: 1 }).lean();
  res.json({ messages: messages.map(serializeMessage) });
});

exports.sendMessage = asyncHandler(async (req, res) => {
  const { threadId } = req.params;
  const { body } = req.body;

  if (!mongoose.Types.ObjectId.isValid(threadId)) {
    return res.status(400).json({ message: 'Invalid thread id' });
  }

  if (!body || !String(body).trim()) {
    return res.status(400).json({ message: 'Message text is required' });
  }

  const thread = await ChatThread.findById(threadId);
  if (!thread || String(thread.patientId) !== String(req.user._id)) {
    return res.status(404).json({ message: 'Thread not found' });
  }

  const profile = req.user.profile || {};
  const senderName = profile.fullName || [profile.firstName, profile.lastName].filter(Boolean).join(' ') || req.user.email || 'You';

  const message = await ChatMessage.create({
    threadId: thread._id,
    patientId: req.user._id,
    senderType: 'patient',
    senderSnapshot: { name: senderName, role: 'patient' },
    body: String(body).trim(),
  });

  thread.lastMessage = message.body;
  thread.lastMessageAt = message.createdAt;
  thread.unreadForDoctor = (thread.unreadForDoctor || 0) + 1;
  await thread.save();

  res.status(201).json({ message: serializeMessage(message) });
});
