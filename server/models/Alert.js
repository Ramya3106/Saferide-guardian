const mongoose = require("mongoose");

const alertSchema = new mongoose.Schema({
  complaintId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Complaint",
    required: true,
  },
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  recipientRole: String,

  channel: {
    type: String,
    enum: ["sms", "call", "push", "app"],
    required: true,
  },
  message: String,

  status: {
    type: String,
    enum: ["queued", "sent", "delivered", "acknowledged", "failed"],
    default: "queued",
  },

  priority: { type: Number, default: 0 }, // Queue priority
  attempts: { type: Number, default: 0 },
  lastAttempt: Date,
  acknowledgedAt: Date,

  createdAt: { type: Date, default: Date.now },
});

alertSchema.index({ status: 1, priority: -1 });

module.exports = mongoose.model("Alert", alertSchema);
