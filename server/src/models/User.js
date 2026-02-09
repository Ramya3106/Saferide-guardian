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
    role: {
      type: String,
      required: true,
      enum: ["Passenger", "Driver", "Conductor", "TTR/RPF", "Police"],
    },
    password: {
      type: String,
      required: true,
    },
    // Passenger specific
    travelNumber: String,
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
    
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);
