const mongoose = require("mongoose");

const dutySessionSchema = new mongoose.Schema(
  {
    officerProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OfficerProfile",
      default: null,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    officerKey: {
      type: String,
      required: true,
      index: true,
    },
    officerName: {
      type: String,
      required: true,
    },
    officerEmail: {
      type: String,
      default: null,
      index: true,
    },
    professionalId: {
      type: String,
      default: null,
      index: true,
    },
    role: {
      type: String,
      required: true,
      enum: ["TTR", "TTE", "RPF", "Police"],
    },
    dutyUnit: {
      type: String,
      required: true,
      index: true,
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
    assignedShift: {
      type: String,
      default: null,
    },
    checkInTime: {
      type: Date,
      required: true,
      index: true,
    },
    checkOutTime: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
      index: true,
    },
    source: {
      type: String,
      enum: ["manual", "demo", "sync"],
      default: "manual",
    },
    notes: {
      type: String,
      default: null,
    },
    liveLocationSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

dutySessionSchema.index({ officerKey: 1, status: 1, checkInTime: -1 });
dutySessionSchema.index({ dutyUnit: 1, status: 1, checkInTime: -1 });

module.exports = mongoose.model("DutySession", dutySessionSchema);
