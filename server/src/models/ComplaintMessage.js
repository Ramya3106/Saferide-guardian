const mongoose = require("mongoose");

const complaintMessageSchema = new mongoose.Schema(
  {
    complaintId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Complaint",
      required: true,
      index: true,
    },
    complaintRef: {
      type: String,
      default: null,
      index: true,
    },
    senderId: {
      type: String,
      default: null,
      index: true,
    },
    senderName: {
      type: String,
      required: true,
    },
    senderRole: {
      type: String,
      required: true,
      enum: ["Passenger", "TTR", "TTE", "RPF", "Police", "System"],
    },
    messageType: {
      type: String,
      enum: ["system", "officer-reply", "passenger-message", "status-update", "internal-note"],
      default: "officer-reply",
      index: true,
    },
    text: {
      type: String,
      required: true,
    },
    visibleToPassenger: {
      type: Boolean,
      default: true,
      index: true,
    },
    isInternalNote: {
      type: Boolean,
      default: false,
      index: true,
    },
    statusUpdate: {
      type: String,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    repliedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

complaintMessageSchema.index({ complaintId: 1, repliedAt: -1 });
complaintMessageSchema.index({ complaintId: 1, visibleToPassenger: 1, repliedAt: -1 });

module.exports = mongoose.model("ComplaintMessage", complaintMessageSchema);
