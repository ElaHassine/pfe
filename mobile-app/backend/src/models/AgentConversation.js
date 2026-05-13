const mongoose = require('mongoose');

const AgentConversationMessageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['user', 'assistant', 'tool'], required: true },
    content: { type: String, trim: true, default: '' },
    tool_calls: { type: [mongoose.Schema.Types.Mixed], default: undefined },
    tool_call_id: { type: String, trim: true, default: '' },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const AgentConversationSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    conversationId: { type: String, required: true, trim: true },
    title: { type: String, trim: true, default: 'New conversation' },
    preview: { type: String, trim: true, default: 'Start a conversation' },
    messages: { type: [AgentConversationMessageSchema], default: [] },
    lastMessageAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

AgentConversationSchema.index({ patientId: 1, conversationId: 1 }, { unique: true });

module.exports = mongoose.model('AgentConversation', AgentConversationSchema);