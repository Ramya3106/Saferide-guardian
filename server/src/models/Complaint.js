const mongoose = require("mongoose");

const complaintSchema = new mongoose.Schema(
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
    passengerName: {
      type: String,
      required: true,
    },
    transportType: {
      type: String,
      required: true,
      enum: ["train", "car", "bus", "auto"],
      default: "bus",
    },
    vehicleNumber: {
      type: String,
      required: true,
    },
    itemType: {
      type: String,
      required: true,
      enum: ["Phone", "Wallet", "Bag", "Documents", "Other"],
    },
    description: {
      type: String,
      required: true,
    },
    photoUri: {
      type: String,
      default: null,
    },
    fromLocation: {
      type: String,
      default: "",
    },
    toLocation: {
      type: String,
      default: "",
    },
    departureTime: {
      type: String,
      default: "",
    },
    arrivalTime: {
      type: String,
      default: "",
    },
    journeyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Journey",
      default: null,
    },
    route: {
      type: String,
      required: true,
    },
    lastSeenLocation: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      required: true,
    },
    submitAuthority: {
      type: String,
      default: "Staff",
    },
    status: {
      type: String,
      enum: ["Reported", "Staff Notified", "Found", "Meeting Scheduled", "Recovered", "Closed"],
      default: "Reported",
    },
    staffNotified: {
      type: Boolean,
      default: false,
    },
    itemFound: {
      type: Boolean,
      default: false,
    },
    meetingScheduled: {
      type: Boolean,
      default: false,
    },
    itemCollected: {
      type: Boolean,
      default: false,
    },
    staffId: {
      type: String,
      default: null,
    },
    staffName: {
      type: String,
      default: null,
    },
    staffEta: {
      type: String,
      default: null,
    },
    meetingPoint: {
      type: String,
      default: null,
    },
    meetingTime: {
      type: String,
      default: null,
    },
    messages: [
      {
        staffId: String,
        staffName: String,
        text: String,
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    qrCode: {
      type: String,
      unique: true,
      sparse: true,
      default: null,
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

module.exports = mongoose.model("Complaint", complaintSchema);
