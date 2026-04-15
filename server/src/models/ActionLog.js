const mongoose = require("mongoose");

const actionLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      index: true,
    },
    actorType: {
      type: String,
      enum: ["PASSENGER", "OFFICER", "SYSTEM", "ADMIN"],
      default: "SYSTEM",
      index: true,
    },
    actorId: {
      type: String,
      default: null,
      index: true,
    },
    actorRole: {
      type: String,
      default: null,
    },
    entityType: {
      type: String,
      default: null,
      index: true,
    },
    entityId: {
      type: String,
      default: null,
      index: true,
    },
    complaintId: {
      type: String,
      default: null,
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

actionLogSchema.index({ createdAt: -1, action: 1 });

module.exports = mongoose.model("ActionLog", actionLogSchema);
