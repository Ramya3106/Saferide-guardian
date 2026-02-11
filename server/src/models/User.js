const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    professionalId: {
      type: String,
      index: true,
    },
    officialEmail: {
      type: String,
      lowercase: true,
    },
    role: {
      type: String,
      required: true,
      enum: ["Passenger", "Driver/Conductor", "Cab/Auto", "TTR/RPF/Police"],
    },
    password: {
      type: String,
      required: true,
    },
    // Passenger specific
    travelNumber: String,
    travelName: String,
    travelType: String,
    travelRoute: String,
    travelTiming: String,
    driverName: String,
    conductorName: String,

    // Staff specific
    vehicleNumber: String,
    dutyRoute: String,
    shiftTiming: String,
    fromStop: String,
    toStop: String,

    // Official duty details
    pnrRange: String,
    jurisdiction: String,

    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "approved",
    },
    approvalRequestedAt: Date,

    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },

    // Password reset fields
    resetPasswordToken: String,
    resetPasswordExpires: Date,
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("User", userSchema);
// Password reset fields
resetPasswordToken: String,
resetPasswordExpires: Date,
