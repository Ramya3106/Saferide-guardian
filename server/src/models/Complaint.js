const mongoose = require("mongoose");

const threadEntrySchema = new mongoose.Schema(
  {
    staffId: String,
    staffName: String,
    text: String,
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const maskPhone = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) {
    return null;
  }

  if (digits.length <= 4) {
    return digits;
  }

  return `${"*".repeat(Math.max(digits.length - 4, 4))}${digits.slice(-4)}`;
};

const complaintSchema = new mongoose.Schema(
  {
    complaintId: {
      type: String,
      unique: true,
      sparse: true,
      default: null,
      index: true,
    },
    complaintType: {
      type: String,
      default: null,
    },
    complaintDescription: {
      type: String,
      default: null,
    },
    complaintTime: {
      type: Date,
      default: null,
    },
    passengerPhoneMasked: {
      type: String,
      default: null,
    },
    pnrMock: {
      type: String,
      default: null,
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
    trainName: {
      type: String,
      default: null,
    },
    coach: {
      type: String,
      default: null,
    },
    seat: {
      type: String,
      default: null,
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
    currentTrainLocation: {
      type: String,
      default: null,
    },
    currentLat: {
      type: Number,
      default: null,
    },
    currentLng: {
      type: Number,
      default: null,
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
    severity: {
      type: String,
      enum: ["Low", "Normal", "High", "Critical"],
      default: "Normal",
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
    assignedRole: {
      type: String,
      enum: ["TTR", "TTE", "RPF", "Police", null],
      default: null,
      index: true,
    },
    assignedOfficerId: {
      type: String,
      default: null,
    },
    assignedOfficerName: {
      type: String,
      default: null,
    },
    acceptedAt: {
      type: Date,
      default: null,
    },
    escalationLevel: {
      type: String,
      default: null,
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
    assignedToUnit: {
      type: String,
      enum: ["TTR", "TTE", "RPF", "Police", null],
      default: null,
      index: true,
    },
    assignedAt: {
      type: Date,
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
      threadEntrySchema,
    ],
    messageThread: [threadEntrySchema],
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
    investigationStartedAt: {
      type: Date,
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    closedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

complaintSchema.pre("validate", function syncComplaintCanonicalFields(next) {
  if (!this.complaintType) {
    this.complaintType = this.itemType || this.lostItemType || this.transportType || null;
  }

  if (!this.complaintDescription) {
    this.complaintDescription = this.description || null;
  }

  if (!this.complaintTime) {
    this.complaintTime = this.timestamp || this.lossTime || null;
  }

  if (!this.passengerPhoneMasked) {
    this.passengerPhoneMasked = maskPhone(this.passengerPhone || this.passengerMobile || this.phone || null);
  }

  if (!this.pnrMock) {
    this.pnrMock = this.boardingStation || this.route || this.trainNumber || null;
  }

  if (!this.trainNumber && this.vehicleNumber && this.transportType === "train") {
    this.trainNumber = this.vehicleNumber;
  }

  if (!this.trainName) {
    this.trainName = this.vehicleNumber || this.trainNumber || null;
  }

  if (!this.coach) {
    this.coach = this.coachNumber || null;
  }

  if (!this.seat) {
    this.seat = this.berthNumber || null;
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

  if (!this.currentTrainLocation) {
    this.currentTrainLocation = this.lastSeenLocation || this.fromLocation || this.boardingStation || null;
  }

  if (this.sharedLocation && this.sharedLocation.latitude != null && this.currentLat == null) {
    this.currentLat = this.sharedLocation.latitude;
  }

  if (this.sharedLocation && this.sharedLocation.longitude != null && this.currentLng == null) {
    this.currentLng = this.sharedLocation.longitude;
  }

  if (this.gpsLocation && this.gpsLocation.latitude != null && this.currentLat == null) {
    this.currentLat = this.gpsLocation.latitude;
  }

  if (this.gpsLocation && this.gpsLocation.longitude != null && this.currentLng == null) {
    this.currentLng = this.gpsLocation.longitude;
  }

  if (!this.severity && this.priority) {
    this.severity = this.priority;
  }

  if (!this.urgencyLevel && this.priority) {
    this.urgencyLevel = this.priority;
  }

  if (!this.priority && this.urgencyLevel) {
    this.priority = this.urgencyLevel;
  }

  if (!this.assignedRole) {
    this.assignedRole = this.assignedToUnit || (Array.isArray(this.assignedStaff) && this.assignedStaff[0]?.dutyUnit) || null;
  }

  if (!this.assignedOfficerId) {
    this.assignedOfficerId = this.staffId || (Array.isArray(this.assignedStaff) && this.assignedStaff[0]?.staffId) || null;
  }

  if (!this.assignedOfficerName) {
    this.assignedOfficerName = this.staffName || (Array.isArray(this.assignedStaff) && this.assignedStaff[0]?.staffName) || null;
  }

  if (!this.acceptedAt && String(this.status || "").toLowerCase() === "accepted") {
    this.acceptedAt = new Date();
  }

  if (!this.escalationLevel) {
    this.escalationLevel = this.dispatchMode || null;
  }

  if (!Array.isArray(this.messageThread) || this.messageThread.length === 0) {
    this.messageThread = Array.isArray(this.messages) ? this.messages : [];
  }

  if (!Array.isArray(this.messages) || this.messages.length === 0) {
    this.messages = Array.isArray(this.messageThread) ? this.messageThread : [];
  }

  next();
});

module.exports = mongoose.model("Complaint", complaintSchema);
