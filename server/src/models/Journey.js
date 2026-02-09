const mongoose = require("mongoose");

const journeySchema = new mongoose.Schema(
  {
    passengerId: {
      type: String,
      required: true,
      index: true,
    },
    passengerEmail: {
      type: String,
      required: true,
    },
    transportType: {
      type: String,
      enum: ["train", "car", "bus", "auto"],
      default: "bus",
    },
    vehicleNumber: {
      type: String,
      required: true,
    },
    route: {
      type: String,
      required: true,
    },
    fromStop: {
      type: String,
      required: true,
    },
    toStop: {
      type: String,
      required: true,
    },
    currentStop: {
      type: String,
      default: null,
    },
    startTime: {
      type: Date,
      required: true,
    },
    estimatedEndTime: {
      type: Date,
      required: true,
    },
    actualEndTime: {
      type: Date,
      default: null,
    },
    driverName: {
      type: String,
      default: null,
    },
    conductorName: {
      type: String,
      default: null,
    },
    estimatedDuration: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ["Active", "Completed", "Cancelled"],
      default: "Active",
    },
    gpsLocation: {
      latitude: Number,
      longitude: Number,
      timestamp: Date,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Journey", journeySchema);
