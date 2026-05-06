const mongoose = require("mongoose");

const trainAssignmentSchema = new mongoose.Schema(
  {
    officerKey: {
      type: String,
      required: true,
      index: true,
    },
    officerProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OfficerProfile",
      default: null,
      index: true,
    },
    officerName: {
      type: String,
      required: true,
    },
    officerRole: {
      type: String,
      required: true,
      enum: ["TTR", "TTE", "RPF", "Police"],
      index: true,
    },
    trainNumber: {
      type: String,
      required: true,
      index: true,
    },
    trainName: {
      type: String,
      default: null,
    },
    route: {
      type: String,
      default: null,
    },
    station: {
      type: String,
      default: null,
    },
    coach: {
      type: String,
      default: null,
    },
    dutyShift: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "COMPLETED", "REASSIGNED", "CANCELLED"],
      default: "ACTIVE",
      index: true,
    },
    source: {
      type: String,
      enum: ["manual", "demo", "system"],
      default: "system",
    },
    notes: {
      type: String,
      default: null,
    },
    assignedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

trainAssignmentSchema.index({ trainNumber: 1, status: 1, assignedAt: -1 });
trainAssignmentSchema.index({ officerKey: 1, status: 1, assignedAt: -1 });

module.exports = mongoose.model("TrainAssignment", trainAssignmentSchema);
