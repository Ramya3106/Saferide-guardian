const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  complaintId: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint', required: true, index: true },
  senderType: { type: String, enum: ['PASSENGER','OFFICER','SYSTEM'], required: true, index: true },
  senderId: { type: String, default: null, index: true },
  senderName: { type: String, default: null },
  senderRole: { type: String, default: null },
  messageText: { type: String, default: null },
  messageType: { type: String, enum: ['text','image','voice','quick_reply','system'], default: 'text' },
  attachmentUrl: { type: String, default: null },
  quickReplyKey: { type: String, default: null },
  readBy: [
    {
      userId: { type: String },
      readAt: { type: Date },
    }
  ],
  createdAt: { type: Date, default: Date.now, index: true },
}, { timestamps: false });

chatMessageSchema.index({ complaintId: 1, createdAt: -1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
