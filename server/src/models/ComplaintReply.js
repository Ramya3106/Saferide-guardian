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
        "Item Being Checked",
        "Item Found",
        "Passenger Contacted",
        "Ready for Handover",
        "Closed",
      ],
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

module.exports = mongoose.model("ComplaintReply", complaintReplySchema);
