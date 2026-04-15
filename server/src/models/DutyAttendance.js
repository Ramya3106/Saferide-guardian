const mongoose = require("mongoose");

const dutyAttendanceSchema = new mongoose.Schema(
  {
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
    },
    professionalId: {
      type: String,
      default: null,
    },
    officerName: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      default: "TTR/RPF/Police",
    },
    dutyUnit: {
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
    assignedShift: {
      type: String,
      default: null,
    },
    checkInTime: {
      type: Date,
      required: true,
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
    notes: {
      type: String,
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

dutyAttendanceSchema.index({ officerKey: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("DutyAttendance", dutyAttendanceSchema);
