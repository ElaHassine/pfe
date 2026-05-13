const asyncHandler = require('../middleware/asyncHandler');
const mongoose = require('mongoose');
const ChatThread = require('../models/ChatThread');
const ChatMessage = require('../models/ChatMessage');
const Doctor = require('../models/Doctor');

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL_CANDIDATES = [
  'openrouter/auto',
  'meta-llama/llama-3.3-70b-instruct:free',
];

exports.queryAgent = asyncHandler(async (req, res) => {
  try {
    const openRouterApiKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterApiKey) {
      return res.status(500).json({ error: 'OPENROUTER_API_KEY is not configured' });
    }

    const { messages, tools = [] } = req.body || {};

    if (!Array.isArray(messages)) {
      return res.status(500).json({ error: 'messages array is required' });
    }

    let lastErrorMessage = 'OpenRouter request failed';

    for (const model of MODEL_CANDIDATES) {
      const response = await fetch(OPENROUTER_BASE_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openRouterApiKey}`,
          'HTTP-Referer': 'Lesio Patient App',
          'X-Title': 'DermApp Patient Agent',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          tools,
          max_tokens: 1024,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }

      try {
        const errorData = await response.json();
        lastErrorMessage = errorData?.error?.message || errorData?.message || lastErrorMessage;
      } catch (_error) {
        // Non-JSON upstream error bodies are ignored.
      }

      // Try the next model candidate before failing the request.
    }

    return res.status(500).json({ error: lastErrorMessage });
  } catch (error) {
    console.error('Agent request error:', error);
    return res.status(500).json({ error: error?.message || 'Failed to process agent request' });
  }
});

/**
 * Send a message from patient to a doctor
 * Handles the send_message_to_doctor tool call from the agent
 */
exports.sendMessageToDoctor = asyncHandler(async (req, res) => {
  try {
    const { doctorName, message: messageText } = req.body;
    const patientId = req.user._id;

    if (!doctorName || !String(doctorName).trim()) {
      return res.status(400).json({ error: 'doctorName is required' });
    }

    if (!messageText || !String(messageText).trim()) {
      return res.status(400).json({ error: 'message is required' });
    }

    // Normalize search name
    const searchName = String(doctorName).trim().toLowerCase();
    const nameParts = searchName.split(/\s+/).filter(Boolean);

    // Build a flexible search query
    let doctor = null;

    // Try exact full name match first
    doctor = await Doctor.findOne({
      'profile.fullName': new RegExp(`^${searchName}$`, 'i'),
    });

    // Try matching against firstName + lastName
    if (!doctor && nameParts.length > 0) {
      doctor = await Doctor.findOne({
        $or: [
          { 'profile.firstName': new RegExp(`^${nameParts[0]}`, 'i') },
          { 'profile.lastName': new RegExp(`^${nameParts[0]}`, 'i') },
          {
            $expr: {
              $regexMatch: {
                input: {
                  $concat: ['$profile.firstName', ' ', '$profile.lastName'],
                },
                regex: searchName,
                options: 'i',
              },
            },
          },
        ],
      });
    }

    // If still not found, try partial match
    if (!doctor && nameParts.length > 0) {
      doctor = await Doctor.findOne({
        $or: nameParts.map((part) => ({
          $or: [
            { 'profile.firstName': new RegExp(part, 'i') },
            { 'profile.lastName': new RegExp(part, 'i') },
            { 'profile.fullName': new RegExp(part, 'i') },
          ],
        })),
      });
    }

    if (!doctor) {
      return res.status(404).json({
        error: `Doctor "${doctorName}" not found. Please check the spelling or use the dermatologist finder to locate the doctor.`,
      });
    }

    // Find or create chat thread with this doctor
    let thread = await ChatThread.findOne({
      patientId,
      doctorId: doctor._id,
    });

    if (!thread) {
      thread = await ChatThread.create({
        patientId,
        doctorId: doctor._id,
        doctorSnapshot: {
          name: doctor.profile?.fullName || doctor.email,
          specialty: doctor.specialty || doctor.profile?.specialty || 'Dermatologist',
          avatarUrl: doctor.profile?.avatarUrl || '',
        },
      });
    }

    // Create the message
    const profile = req.user.profile || {};
    const senderName = profile.fullName || [profile.firstName, profile.lastName].filter(Boolean).join(' ') || req.user.email || 'You';

    const chatMessage = await ChatMessage.create({
      threadId: thread._id,
      patientId,
      senderType: 'patient',
      senderSnapshot: { name: senderName, role: 'patient' },
      body: String(messageText).trim(),
    });

    // Update thread metadata
    thread.lastMessage = chatMessage.body;
    thread.lastMessageAt = chatMessage.createdAt;
    thread.unreadForDoctor = (thread.unreadForDoctor || 0) + 1;
    await thread.save();

    res.status(201).json({
      success: true,
      message: `Message sent to ${doctor.profile?.fullName || doctor.email}`,
      threadId: thread._id,
      doctorName: doctor.profile?.fullName || doctor.email,
    });
  } catch (error) {
    console.error('sendMessageToDoctor error:', error);
    res.status(500).json({
      error: error?.message || 'Failed to send message to doctor',
    });
  }
});
