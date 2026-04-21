const mongoose = require('mongoose');
const asyncHandler = require('../middleware/asyncHandler');
const ChatThread = require('../models/ChatThread');
const ChatMessage = require('../models/ChatMessage');
const Patient = require('../models/Patient');
const { recordDoctorActivity } = require('../services/activityService');

function getDoctorFilter(user) {
  const doctorName = user?.profile?.fullName;
  const doctorObjectId = String(user?._id || '');
  return doctorName
    ? { $or: [{ doctorId: doctorObjectId }, { 'doctorSnapshot.name': doctorName }] }
    : { doctorId: doctorObjectId };
}

function getPatientName(patient = {}) {
  const profile = patient.profile || {};
  return profile.fullName || [profile.firstName, profile.lastName].filter(Boolean).join(' ') || patient.email || 'Patient';
}

exports.listThreads = asyncHandler(async (req, res) => {
  const filter = getDoctorFilter(req.user);
  const threads = await ChatThread.find(filter).sort({ lastMessageAt: -1 }).lean();

  const patientIds = threads.map((thread) => thread.patientId).filter(Boolean);
  const patients = await Patient.find({ _id: { $in: patientIds } }).select('email profile').lean();
  const patientMap = new Map(patients.map((patient) => [String(patient._id), patient]));

  const serialized = threads.map((thread) => {
    const patient = patientMap.get(String(thread.patientId)) || {};
    return {
      id: thread._id,
      patientId: thread.patientId,
      patientName: getPatientName(patient),
      patientAvatarUrl: patient.profile?.avatarUrl || '',
      doctorId: thread.doctorId,
      doctorName: thread.doctorSnapshot?.name || req.user?.profile?.fullName || 'Doctor',
      specialty: thread.doctorSnapshot?.specialty || req.user?.specialty || 'Dermatology',
      lastMessage: thread.lastMessage || '',
      lastMessageAt: thread.lastMessageAt || thread.updatedAt,
      unread: thread.unreadForDoctor || 0,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
    };
  });

  res.json({ threads: serialized });
});

exports.getMessages = asyncHandler(async (req, res) => {
  const { threadId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(threadId)) {
    return res.status(400).json({ message: 'Invalid thread id' });
  }

  const thread = await ChatThread.findById(threadId).lean();
  if (!thread) {
    return res.status(404).json({ message: 'Thread not found' });
  }

  const filter = getDoctorFilter(req.user);
  const matchesDoctor = await ChatThread.exists({ _id: thread._id, ...filter });
  if (!matchesDoctor) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const messages = await ChatMessage.find({ threadId: thread._id }).sort({ createdAt: 1 }).lean();
  res.json({
    messages: messages.map((message) => ({
      id: message._id,
      threadId: message.threadId,
      body: message.body,
      senderType: message.senderType,
      senderName: message.senderSnapshot?.name || (message.senderType === 'doctor' ? 'You' : 'Patient'),
      createdAt: message.createdAt,
    })),
  });
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

  const filter = getDoctorFilter(req.user);
  const thread = await ChatThread.findOne({ _id: threadId, ...filter });
  if (!thread) {
    return res.status(404).json({ message: 'Thread not found' });
  }

  const senderName = req.user?.profile?.fullName || req.user?.email || 'Doctor';
  const message = await ChatMessage.create({
    threadId: thread._id,
    patientId: thread.patientId,
    senderType: 'doctor',
    senderSnapshot: { name: senderName, role: 'doctor' },
    body: String(body).trim(),
  });

  thread.lastMessage = message.body;
  thread.lastMessageAt = message.createdAt;
  thread.unreadForPatient = (thread.unreadForPatient || 0) + 1;
  await thread.save();

  await recordDoctorActivity(req.user._id, 'doctor.chat.message-sent', 'chatMessage', message._id, {
    threadId: thread._id,
    patientId: thread.patientId,
  });

  res.status(201).json({
    message: {
      id: message._id,
      threadId: message.threadId,
      body: message.body,
      senderType: message.senderType,
      senderName,
      createdAt: message.createdAt,
    },
  });
});