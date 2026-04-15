const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    complaintRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Complaint",
      default: null,
      index: true,
    },
    complaintId: {
      type: String,
      required: true,
      index: true,
    },
    officerKey: {
      type: String,
      required: true,
      index: true,
    },
    officerId: {
      type: String,
      default: null,
    },
    officerEmail: {
      type: String,
      default: null,
      index: true,
    },
    officerName: {
      type: String,
      required: true,
    },
    dutyUnit: {
      type: String,
      required: true,
      index: true,
    },
    priorityRank: {
      type: Number,
      required: true,
    },
    routingReason: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ["PENDING", "ACKNOWLEDGED", "CLOSED"],
      default: "PENDING",
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    source: {
      type: String,
      enum: ["db", "demo"],
      default: "db",
    },
  },
  {
    timestamps: true,
  },
);

notificationSchema.index({ officerKey: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
