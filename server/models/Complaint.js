const mongoose = require("mongoose");

const complaintSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  // Item details
  itemType: {
    type: String,
    enum: [
      "passport",
      "wallet",
      "phone",
      "laptop",
      "bag",
      "jewelry",
      "documents",
      "other",
    ],
    required: true,
  },
  itemDescription: { type: String, required: true },
  itemPhotos: [String],
  classifiedCategory: String, // CNN classification result
  estimatedValue: Number,

  // Priority (calculated by AI)
  priority: {
    type: String,
    enum: ["critical", "high", "medium", "low"],
    default: "medium",
  },
  priorityScore: { type: Number, default: 50 },

  // Location data
  geoLocation: {
    type: { type: String, default: "Point" },
    coordinates: [Number], // [longitude, latitude]
  },
  lastSeenLocation: String,
  vehicleType: { type: String, enum: ["train", "bus", "metro"] },
  vehicleNumber: String,
  routeId: String,

  // Tracking
  status: {
    type: String,
    enum: ["reported", "alerted", "located", "secured", "returned", "closed"],
    default: "reported",
  },
  predictedNextStop: String,
  predictedArrivalTime: Date,

  // Recovery
  recoveredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  recoveryLocation: String,
  handoffQRCode: String,
  recoveredAt: Date,

  // Timestamps
  incidentTime: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

complaintSchema.index({ geoLocation: "2dsphere" });
complaintSchema.index({ status: 1, priority: 1 });

module.exports = mongoose.model("Complaint", complaintSchema);
