const mongoose = require("mongoose");

const routeCheckpointSchema = new mongoose.Schema(
  {
    route: {
      type: String,
      required: true,
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
    checkpointName: {
      type: String,
      required: true,
      index: true,
    },
    stationCode: {
      type: String,
      default: null,
      index: true,
    },
    sequence: {
      type: Number,
      default: 0,
      index: true,
    },
    latitude: {
      type: Number,
      default: null,
    },
    longitude: {
      type: Number,
      default: null,
    },
    etaMinutes: {
      type: Number,
      default: null,
    },
    checkpointType: {
      type: String,
      enum: ["origin", "midway", "station", "terminal", "custom"],
      default: "custom",
      index: true,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

routeCheckpointSchema.index({ route: 1, sequence: 1 });
routeCheckpointSchema.index({ trainNumber: 1, active: 1, sequence: 1 });

module.exports = mongoose.model("RouteCheckpoint", routeCheckpointSchema);
