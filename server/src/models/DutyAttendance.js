const mongoose = require("mongoose");

const dutyAttendanceSchema = new mongoose.Schema(
  {
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
    dutyStatus: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
      index: true,
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
    shiftDate: {
      type: Date,
      default: () => new Date(),
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

dutyAttendanceSchema.pre("validate", function syncAttendanceFields(next) {
  if (!this.officerKey && this.userId) {
    this.officerKey = String(this.userId);
  }

  if (this.status && !this.dutyStatus) {
    this.dutyStatus = this.status;
  }

  if (this.dutyStatus && !this.status) {
    this.status = this.dutyStatus;
  }

  if (!this.shiftDate && this.checkInTime) {
    this.shiftDate = this.checkInTime;
  }

  next();
});

dutyAttendanceSchema.index({ officerKey: 1, status: 1, createdAt: -1 });
dutyAttendanceSchema.index({ userId: 1, dutyStatus: 1, shiftDate: -1 });

module.exports = mongoose.model("DutyAttendance", dutyAttendanceSchema);
