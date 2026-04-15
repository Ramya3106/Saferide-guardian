const mongoose = require("mongoose");

const complaintSchema = new mongoose.Schema(
  {
    complaintId: {
      type: String,
      unique: true,
      sparse: true,
      default: null,
      index: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
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
    trainNumber: {
      type: String,
      default: null,
    },
    vehicleNumber: {
      type: String,
      required: true,
    },
    boardingStation: {
      type: String,
      default: null,
    },
    destinationStation: {
      type: String,
      default: null,
    },
    coachNumber: {
      type: String,
      default: null,
    },
    berthNumber: {
      type: String,
      default: null,
    },
    lostItemType: {
      type: String,
      default: null,
    },
    itemType: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    photoUri: {
      type: String,
      default: null,
    },
    imageUrl: {
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
    lossTime: {
      type: Date,
      default: null,
    },
    submitAuthority: {
      type: String,
      default: "Staff",
    },
    status: {
      type: String,
      enum: [
        "Submitted",
        "Reported",
        "Staff Notified",
        "Accepted",
        "Seen",
        "Acknowledged",
        "Item Being Checked",
        "Item Found",
        "Passenger Contacted",
        "Ready for Handover",
        "Found",
        "In verification",
        "Secured",
        "Meeting Scheduled",
        "Handed over",
        "Recovered",
        "Closed",
      ],
      default: "Submitted",
    },
    priority: {
      type: String,
      enum: ["Low", "Normal", "High", "Critical"],
      default: "Normal",
    },
    urgencyLevel: {
      type: String,
      enum: ["Low", "Normal", "High", "Critical"],
      default: "Normal",
    },
    staffNotified: {
      type: Boolean,
      default: false,
    },
    assignedStaff: [
      {
        staffId: String,
        staffName: String,
        staffEmail: String,
        staffRole: String,
        dutyUnit: String,
        dutyDesk: String,
        onDutyAt: Date,
        acknowledgedAt: Date,
      },
    ],
    staffResponseStatus: {
      type: String,
      default: null,
    },
    seenAt: {
      type: Date,
      default: null,
    },
    acknowledgedAt: {
      type: Date,
      default: null,
    },
    officerNotes: {
      type: String,
      default: null,
    },
    coachRemark: {
      type: String,
      default: null,
    },
    stationRemark: {
      type: String,
      default: null,
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
    recoveryStation: {
      type: String,
      default: null,
    },
    recoveryNotes: {
      type: String,
      default: null,
    },
    alertPriorityReason: {
      type: String,
      default: null,
    },
    dispatchMode: {
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
    sharedLocation: {
      latitude: Number,
      longitude: Number,
      timestamp: Date,
      sharedAt: Date,
    },
  },
  {
    timestamps: true,
  }
);

complaintSchema.pre("validate", function syncComplaintCanonicalFields(next) {
  if (!this.trainNumber && this.vehicleNumber && this.transportType === "train") {
    this.trainNumber = this.vehicleNumber;
  }

  if (!this.boardingStation && this.fromLocation) {
    this.boardingStation = this.fromLocation;
  }

  if (!this.destinationStation && this.toLocation) {
    this.destinationStation = this.toLocation;
  }

  if (!this.lostItemType && this.itemType) {
    this.lostItemType = this.itemType;
  }

  if (!this.imageUrl && this.photoUri) {
    this.imageUrl = this.photoUri;
  }

  if (!this.lossTime && this.timestamp) {
    this.lossTime = this.timestamp;
  }

  if (!this.urgencyLevel && this.priority) {
    this.urgencyLevel = this.priority;
  }

  if (!this.priority && this.urgencyLevel) {
    this.priority = this.urgencyLevel;
  }

  next();
});

module.exports = mongoose.model("Complaint", complaintSchema);
