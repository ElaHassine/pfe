const asyncHandler = require('../middleware/asyncHandler');
const AgentConversation = require('../models/AgentConversation');

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) return [];

  return messages
    .filter((message) => message && typeof message === 'object' && message.role !== 'system')
    .map((message) => ({
      role: ['user', 'assistant', 'tool'].includes(String(message.role)) ? String(message.role) : 'assistant',
      content: String(message.content || ''),
      tool_calls: Array.isArray(message.tool_calls) ? message.tool_calls : undefined,
      tool_call_id: typeof message.tool_call_id === 'string' ? message.tool_call_id : '',
      timestamp: message.timestamp ? new Date(message.timestamp) : new Date(),
    }))
    .filter((message) => message.content || (Array.isArray(message.tool_calls) && message.tool_calls.length > 0) || message.tool_call_id);
}

function toConversationResponse(conversation) {
  if (!conversation) return null;

  const plain = typeof conversation.toObject === 'function' ? conversation.toObject({ versionKey: false }) : conversation;
  return {
    id: plain.conversationId,
    conversationId: plain.conversationId,
    title: plain.title,
    preview: plain.preview,
    messages: Array.isArray(plain.messages)
      ? plain.messages.map((message) => ({
          role: message.role,
          content: message.content || '',
          tool_calls: Array.isArray(message.tool_calls) ? message.tool_calls : undefined,
          tool_call_id: message.tool_call_id || '',
          timestamp: message.timestamp || message.createdAt || message.updatedAt || plain.updatedAt,
        }))
      : [],
    lastMessageAt: plain.lastMessageAt || plain.updatedAt,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
}

function getConversationPreview(messages, fallbackPreview = 'Start a conversation') {
  const previewMessage = messages.find((message) => message.role === 'user' && String(message.content || '').trim())
    || messages.find((message) => message.role === 'assistant' && String(message.content || '').trim());

  return String(previewMessage?.content || '').trim() || fallbackPreview;
}

function getConversationTitle(messages, fallbackTitle = 'New conversation') {
  const firstUserMessage = messages.find((message) => message.role === 'user' && String(message.content || '').trim());
  const text = String(firstUserMessage?.content || '').trim();
  if (!text) return fallbackTitle;
  return text.length > 32 ? `${text.slice(0, 32).trim()}...` : text;
}

exports.listConversations = asyncHandler(async (req, res) => {
  const conversations = await AgentConversation.find({ patientId: req.user._id })
    .sort({ updatedAt: -1, createdAt: -1 })
    .lean();

  return res.json({ conversations: conversations.map((conversation) => toConversationResponse(conversation)) });
});

exports.saveConversation = asyncHandler(async (req, res) => {
  const { conversationId, messages = [], title, preview } = req.body || {};
  const normalizedConversationId = String(conversationId || '').trim() || `${Date.now()}`;
  const normalizedMessages = normalizeMessages(messages);
  const nextTitle = String(title || '').trim() || getConversationTitle(normalizedMessages);
  const nextPreview = String(preview || '').trim() || getConversationPreview(normalizedMessages);
  const lastMessageAt = normalizedMessages.length > 0
    ? new Date(normalizedMessages[normalizedMessages.length - 1].timestamp || Date.now())
    : new Date();

  const conversation = await AgentConversation.findOneAndUpdate(
    { patientId: req.user._id, conversationId: normalizedConversationId },
    {
      $set: {
        patientId: req.user._id,
        conversationId: normalizedConversationId,
        title: nextTitle,
        preview: nextPreview,
        messages: normalizedMessages,
        lastMessageAt,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  return res.json({ conversation: toConversationResponse(conversation) });
});

exports.deleteConversation = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const result = await AgentConversation.deleteOne({ patientId: req.user._id, conversationId: String(conversationId || '').trim() });

  if (!result.deletedCount) {
    return res.status(404).json({ message: 'Conversation not found' });
  }

  return res.status(204).send();
});