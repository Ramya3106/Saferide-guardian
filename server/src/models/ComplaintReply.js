const mongoose = require("mongoose");

const complaintReplySchema = new mongoose.Schema(
  {
    complaintId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Complaint",
      required: true,
      index: true,
    },
    officerId: {
      type: String,
      required: true,
      index: true,
    },
    officerName: {
      type: String,
      default: null,
    },
    officerRole: {
      type: String,
      required: true,
      enum: ["TTR", "TTE", "RPF", "Police"],
      index: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    statusUpdate: {
      type: String,
      required: true,
      enum: [
        "Seen",
        "Acknowledged",
        "Accepted",
        "Item Being Checked",
        "Item Found",
        "Passenger Contacted",
        "Ready for Handover",
        "Recovered",
        "Closed",
      ],
    },
    visibleToPassenger: {
      type: Boolean,
      default: true,
      index: true,
    },
    messageType: {
      type: String,
      enum: ["system", "officer-reply", "status-update"],
      default: "officer-reply",
    },
    repliedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
  },
);

complaintReplySchema.index({ complaintId: 1, repliedAt: -1 });
complaintReplySchema.index({ complaintId: 1, visibleToPassenger: 1, repliedAt: -1 });

module.exports = mongoose.model("ComplaintReply", complaintReplySchema);
