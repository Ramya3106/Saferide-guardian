const mongoose = require("mongoose");

const liveLocationSchema = new mongoose.Schema(
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
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    complaintId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Complaint",
      default: null,
      index: true,
    },
    trainNumber: {
      type: String,
      default: null,
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
      index: true,
    },
    checkpoint: {
      type: String,
      default: null,
    },
    latitude: {
      type: Number,
      default: null,
    },
    longitude: {
      type: Number,
      default: null,
    },
    accuracy: {
      type: Number,
      default: null,
    },
    speed: {
      type: Number,
      default: null,
    },
    heading: {
      type: Number,
      default: null,
    },
    mode: {
      type: String,
      enum: ["gps", "mock"],
      default: "mock",
      index: true,
    },
    liveLocationSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    recordedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

liveLocationSchema.index({ officerKey: 1, recordedAt: -1 });
liveLocationSchema.index({ trainNumber: 1, station: 1, recordedAt: -1 });

module.exports = mongoose.model("LiveLocation", liveLocationSchema);
