const mongoose = require("mongoose");

const alertNotificationSchema = new mongoose.Schema(
  {
    complaintId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Complaint",
      required: true,
      index: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    receiverRole: {
      type: String,
      required: true,
      enum: ["Passenger", "TTR", "TTE", "RPF", "Police"],
      index: true,
    },
    priorityLevel: {
      type: String,
      required: true,
      enum: ["Low", "Normal", "High", "Critical"],
      default: "Normal",
      index: true,
    },
    matchType: {
      type: String,
      required: true,
      enum: ["TRAIN_MATCH", "ROUTE_MATCH", "STATION_MATCH", "ZONE_ESCALATION", "MANUAL"],
      default: "MANUAL",
    },
    alertStatus: {
      type: String,
      required: true,
      enum: ["SENT", "ACKNOWLEDGED", "RESPONDED", "CLOSED"],
      default: "SENT",
      index: true,
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
    acknowledgedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

alertNotificationSchema.index({ receiverId: 1, alertStatus: 1, sentAt: -1 });

module.exports = mongoose.model("AlertNotification", alertNotificationSchema);
