const mongoose = require("mongoose");

const officerProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    officerKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    professionalId: {
      type: String,
      required: true,
      index: true,
    },
    officerId: {
      type: String,
      default: null,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      index: true,
    },
    role: {
      type: String,
      required: true,
      enum: ["TTR", "TTE", "RPF", "Police"],
      index: true,
    },
    dutyUnit: {
      type: String,
      required: true,
      index: true,
    },
    dutyDesk: {
      type: String,
      default: null,
    },
    dutyStation: {
      type: String,
      default: null,
    },
    assignedTrain: {
      type: String,
      default: null,
    },
    assignedRoute: {
      type: String,
      default: null,
    },
    assignedStation: {
      type: String,
      default: null,
    },
    shiftTiming: {
      type: String,
      default: null,
    },
    onDutyStatus: {
      type: Boolean,
      default: false,
      index: true,
    },
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected", "suspended"],
      default: "approved",
      index: true,
    },
    badgeNumber: {
      type: String,
      default: null,
    },
    contactNumber: {
      type: String,
      default: null,
    },
    permissions: {
      canAcceptComplaints: {
        type: Boolean,
        default: true,
      },
      canEscalateComplaints: {
        type: Boolean,
        default: true,
      },
      canUpdateStatus: {
        type: Boolean,
        default: true,
      },
      canViewPassengerMessages: {
        type: Boolean,
        default: true,
      },
    },
    lastDutySyncAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

officerProfileSchema.index({ role: 1, dutyUnit: 1, onDutyStatus: 1 });
officerProfileSchema.index({ professionalId: 1, email: 1 });

module.exports = mongoose.model("OfficerProfile", officerProfileSchema);
