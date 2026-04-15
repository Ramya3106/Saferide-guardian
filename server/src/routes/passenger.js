const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Complaint = require("../models/Complaint");
const Journey = require("../models/Journey");
const User = require("../models/User");
const { routeComplaintToActiveOfficers } = require("../services/complaintRoutingService");
const { USE_PROTOTYPE_DATA } = require("../config/prototypeMode");
const {
  addPrototypeRecord,
  appendComplaintFromMongo,
  appendHandoverRecord,
  getPrototypeSummary,
  listPrototypeData,
  normalizeEntity,
} = require("../mock/prototypeDataStore");
const {
  DEMO_DUTY_ROSTER,
  inferDutyUnit,
  normalizeDutyUnit,
  toDutyOfficer,
} = require("../utils/dutyRoster");

// Middleware to extract user email from headers
const getUserEmail = (req) => req.headers["x-user-email"] || "";

const resolveTransportFilters = (staffRole) => {
  switch ((staffRole || "").toLowerCase()) {
    case "cab":
      return ["car"];
    case "auto":
      return ["auto"];
    case "bus":
      return ["bus"];
    case "train":
      return ["train"];
    case "driver-conductor":
      return ["bus", "train"];
    case "ttr":
    case "tte":
    case "rpf":
    case "police":
      return ["train"];
    default:
      return ["car", "auto", "bus", "train"];
  }
};

const resolveAuthorityFilter = (staffRole) => {
  switch ((staffRole || "").toLowerCase()) {
    case "ttr":
    case "tte":
      return { $regex: "TTR|TTE", $options: "i" };
    case "rpf":
      return { $regex: "RPF", $options: "i" };
    default:
      return null;
  }
};

const TRAIN_AUTHORITY = "TTR / TTE / RPF / Police";

const normalizeSubmitAuthority = (value) => {
  const normalized = String(value || "").trim();

  if (/ttr|tte|rpf|police/i.test(normalized)) {
    return TRAIN_AUTHORITY;
  }

  return normalized || "Staff";
};

const detectPriority = ({ transportType, itemType, description }) => {
  const text = `${transportType || ""} ${itemType || ""} ${description || ""}`.toLowerCase();

  if (/wallet|phone|luggage|bag|backpack|laptop|passport/.test(text)) {
    return "High";
  }

  if (/medicine|id card|documents|cash|jewellery/.test(text)) {
    return "Critical";
  }

  return "Normal";
};

const getRequestOfficerIdentity = (req) => {
  const email = String(req.headers["x-user-email"] || req.body?.staffEmail || "").trim().toLowerCase();
  const professionalId = String(req.headers["x-professional-id"] || req.body?.professionalId || "").trim().toUpperCase();
  const staffName = String(req.headers["x-user-name"] || req.body?.staffName || "").trim();
  const dutyUnit = normalizeDutyUnit(req.headers["x-duty-unit"] || req.body?.dutyUnit || inferDutyUnit({ email, professionalId }));

  return {
    email,
    professionalId,
    staffName,
    dutyUnit: dutyUnit || "TTR",
  };
};

const resolveCurrentOfficer = async (req) => {
  const officerIdentity = getRequestOfficerIdentity(req);

  if (officerIdentity.email) {
    const user = await User.findOne({
      email: officerIdentity.email,
      role: "TTR/RPF/Police",
    }).select("email name professionalId role onDutyStatus dutyCheckInAt dutyDesk dutyUnit dutyStation dutyNote jurisdiction");

    if (user) {
      return toDutyOfficer(user.toSafeObject ? user.toSafeObject() : user);
    }
  }

  if (officerIdentity.professionalId) {
    const user = await User.findOne({
      professionalId: officerIdentity.professionalId,
      role: "TTR/RPF/Police",
    }).select("email name professionalId role onDutyStatus dutyCheckInAt dutyDesk dutyUnit dutyStation dutyNote jurisdiction");

    if (user) {
      return toDutyOfficer(user.toSafeObject ? user.toSafeObject() : user);
    }
  }

  const demoOfficer = DEMO_DUTY_ROSTER.find(
    (officer) => officer.staffEmail === officerIdentity.email || officer.professionalId === officerIdentity.professionalId || officer.dutyUnit === officerIdentity.dutyUnit,
  );

  return demoOfficer ? toDutyOfficer(demoOfficer, { isDemo: true }) : null;
};

const buildOfficerRecipient = (officer) => {
  if (!officer) {
    return null;
  }

  return {
    staffId: officer.staffId,
    staffName: officer.staffName,
    staffEmail: officer.staffEmail,
    staffRole: officer.staffRole || "TTR/RPF/Police",
    dutyUnit: officer.dutyUnit,
    dutyDesk: officer.dutyDesk || null,
    onDutyAt: officer.onDutyAt || new Date(),
    acknowledgedAt: null,
  };
};

const complaintMatchesOfficer = (complaint, officer) => {
  if (!complaint || !officer) {
    return false;
  }

  const assignedStaff = Array.isArray(complaint.assignedStaff) ? complaint.assignedStaff : [];
  const officerEmail = String(officer.staffEmail || "").trim().toLowerCase();
  const officerId = String(officer.staffId || "").trim().toLowerCase();
  const officerUnit = normalizeDutyUnit(officer.dutyUnit || inferDutyUnit(officer));

  return assignedStaff.some((entry) => {
    const entryEmail = String(entry.staffEmail || "").trim().toLowerCase();
    const entryId = String(entry.staffId || "").trim().toLowerCase();
    const entryUnit = normalizeDutyUnit(entry.staffRole || entry.dutyUnit || inferDutyUnit(entry));

    return (
      (officerEmail && entryEmail === officerEmail) ||
      (officerId && entryId === officerId) ||
      (officerUnit && entryUnit === officerUnit)
    );
  });
};

const staffTimelineEntry = (staffName, text, status) => ({
  staffId: status?.staffId || null,
  staffName: staffName || status?.staffName || "Duty officer",
  text,
  timestamp: new Date(),
});

router.get("/prototype-data", (req, res) => {
  return res.json({
    mode: USE_PROTOTYPE_DATA ? "prototype" : "integration-ready",
    note:
      "Prototype dataset uses dummy values only and is isolated from future official integration.",
    data: listPrototypeData(),
  });
});

router.get("/prototype-data/summary", (req, res) => {
  return res.json({
    mode: USE_PROTOTYPE_DATA ? "prototype" : "integration-ready",
    summary: getPrototypeSummary(),
  });
});

router.post("/prototype-data/:entity", (req, res) => {
  const entity = normalizeEntity(req.params.entity);
  if (!entity) {
    return res.status(400).json({ message: "Unsupported prototype entity." });
  }

  const payload = req.body || {};
  const record = addPrototypeRecord(entity, payload);
  return res.status(201).json({
    mode: USE_PROTOTYPE_DATA ? "prototype" : "integration-ready",
    message: `${entity} record saved for prototype testing`,
    record,
    summary: getPrototypeSummary(),
  });
});

// GET /api/passenger/dashboard - Get active journey
router.get("/dashboard", async (req, res) => {
  try {
    const userEmail = getUserEmail(req);
    if (!userEmail) {
      return res.status(400).json({ message: "User email required" });
    }

    const journey = await Journey.findOne({
      passengerEmail: userEmail,
      status: "Active",
    }).sort({ createdAt: -1 });

    if (!journey) {
      return res.json({
        journey: null,
        message: "No active journey found",
      });
    }

    res.json({
      journey: journey,
      message: "Journey retrieved successfully",
    });
  } catch (error) {
    console.error("Error fetching dashboard:", error);
    res.status(500).json({ message: "Error fetching dashboard" });
  }
});

// POST /api/passenger/complaints - Create a new complaint
router.post("/complaints", async (req, res) => {
  try {
    const userEmail = getUserEmail(req);
    if (!userEmail) {
      return res.status(400).json({ message: "User email required" });
    }

    const {
      transportType,
      vehicleNumber,
      itemType,
      description,
      photoUri,
      fromLocation,
      toLocation,
      departureTime,
      arrivalTime,
      lastSeenLocation,
      timestamp,
      journeyId,
      route,
      submitAuthority,
    } = req.body;

    if (!vehicleNumber || !itemType || !description || !transportType) {
      return res.status(400).json({
        message: "Missing required fields",
      });
    }

    // Generate unique QR code ID
    const qrCode = `QR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const complaintId = `CRN-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    console.log("📝 Creating complaint for email:", userEmail);

    const submitAuthorityValue = normalizeSubmitAuthority(submitAuthority);
    const priority = detectPriority({ transportType, itemType, description });
    const assignedStaff = [];

    const complaint = new Complaint({
      passengerId: userEmail,
      passengerEmail: userEmail,
      passengerName: req.headers["x-user-name"] || "Passenger",
      transportType: transportType || "bus",
      vehicleNumber,
      itemType,
      description,
      photoUri: photoUri || null,
      fromLocation: fromLocation || "",
      toLocation: toLocation || "",
      departureTime: departureTime || "",
      arrivalTime: arrivalTime || "",
      lastSeenLocation: lastSeenLocation || fromLocation || "Unknown",
      timestamp: timestamp || new Date(),
      journeyId: journeyId || null,
      route: route || `${fromLocation} → ${toLocation}`,
      submitAuthority: submitAuthorityValue,
      complaintId,
      qrCode,
      status: "Submitted",
      priority,
      assignedStaff,
      alertPriorityReason:
        priority === "Critical"
          ? "Critical lost-item escalation"
          : priority === "High"
            ? "High priority lost-item report"
            : "Standard lost-item report",
      dispatchMode: assignedStaff.length > 0 ? "On-duty dispatch" : "Unassigned fallback",
    });

    console.log("💾 Saving complaint to MongoDB...");
    const savedComplaint = await complaint.save();
    console.log("✅ First save successful, ID:", savedComplaint._id);

    const routingResult = await routeComplaintToActiveOfficers(
      savedComplaint.toObject ? savedComplaint.toObject() : savedComplaint,
    );
    const routedOfficers = Array.isArray(routingResult?.notifiedOfficers)
      ? routingResult.notifiedOfficers
      : [];

    savedComplaint.complaintId = savedComplaint.complaintId || complaintId;
    savedComplaint.assignedStaff = routedOfficers;
    savedComplaint.staffNotified = routedOfficers.length > 0;
    savedComplaint.staffId = routedOfficers[0]?.staffId || "DEMO-DUTY-001";
    savedComplaint.staffName = routedOfficers[0]?.staffName || submitAuthorityValue || "Duty Officer";
    savedComplaint.staffEta = routedOfficers.length > 0 ? "6 mins" : "Pending assignment";
    savedComplaint.status = "Submitted";
    savedComplaint.staffResponseStatus = routedOfficers.length > 0 ? "Pending response" : "Awaiting duty roster";
    savedComplaint.dispatchMode = routingResult?.escalationLevel || savedComplaint.dispatchMode;
    savedComplaint.alertPriorityReason = routingResult?.routingReason || savedComplaint.alertPriorityReason;
    
    console.log("💾 Updating complaint status...");
    await savedComplaint.save();
    console.log("✅ Second save successful");

    if (USE_PROTOTYPE_DATA) {
      appendComplaintFromMongo(savedComplaint.toObject ? savedComplaint.toObject() : savedComplaint);
    }

    res.status(201).json({
      complaint: savedComplaint,
      message: "Complaint created successfully",
    });
  } catch (error) {
    console.error("❌ Error creating complaint:", error?.message);
    console.error("Full error:", error);
    res.status(500).json({ message: "Error creating complaint: " + error?.message });
  }
});

// GET /api/passenger/complaints - Get all complaints for passenger
router.get("/complaints", async (req, res) => {
  try {
    const userEmail = getUserEmail(req);
    if (!userEmail) {
      return res.status(400).json({ message: "User email required" });
    }

    const complaints = await Complaint.find({ passengerEmail: userEmail }).sort({ createdAt: -1 });

    res.json({
      complaints: complaints,
      message: "Complaints retrieved successfully",
    });
  } catch (error) {
    console.error("Error fetching complaints:", error);
    res.status(500).json({ message: "Error fetching complaints" });
  }
});

// GET /api/passenger/live-alerts - Live complaints for staff dashboards
router.get("/live-alerts", async (req, res) => {
  try {
    const { staffRole } = req.query;
    const transportFilters = resolveTransportFilters(staffRole);
    const authorityFilter = resolveAuthorityFilter(staffRole);
    const officerIdentity = getRequestOfficerIdentity(req);
    const currentOfficer = await (async () => {
      if (officerIdentity.email) {
        const user = await User.findOne({
          email: officerIdentity.email,
          role: "TTR/RPF/Police",
        }).select("email name professionalId role onDutyStatus dutyCheckInAt dutyDesk dutyUnit dutyStation dutyNote jurisdiction");

        if (user) {
          return toDutyOfficer(user.toSafeObject ? user.toSafeObject() : user);
        }
      }

      if (officerIdentity.professionalId) {
        const user = await User.findOne({
          professionalId: officerIdentity.professionalId,
          role: "TTR/RPF/Police",
        }).select("email name professionalId role onDutyStatus dutyCheckInAt dutyDesk dutyUnit dutyStation dutyNote jurisdiction");

        if (user) {
          return toDutyOfficer(user.toSafeObject ? user.toSafeObject() : user);
        }
      }

      const demoOfficer = DEMO_DUTY_ROSTER.find(
        (officer) => officer.staffEmail === officerIdentity.email || officer.professionalId === officerIdentity.professionalId || officer.dutyUnit === officerIdentity.dutyUnit,
      );

      return demoOfficer ? toDutyOfficer(demoOfficer, { isDemo: true }) : null;
    })();

    if (!currentOfficer || !currentOfficer.onDutyStatus) {
      return res.json({
        alerts: [],
        officer: currentOfficer,
        message: "No active duty officer found.",
      });
    }

    const query = {
      transportType: { $in: transportFilters },
      status: {
        $in: [
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
        ],
      },
    };

    if (authorityFilter) {
      query.submitAuthority = authorityFilter;
    }

    const complaintList = await Complaint.find(query).sort({ createdAt: -1 });
    const alerts = complaintList
      .filter((complaint) => complaintMatchesOfficer(complaint, currentOfficer))
      .sort((left, right) => {
        const priorityOrder = { Critical: 0, High: 1, Normal: 2, Low: 3 };
        const leftPriority = priorityOrder[left.priority] ?? 4;
        const rightPriority = priorityOrder[right.priority] ?? 4;

        if (leftPriority !== rightPriority) {
          return leftPriority - rightPriority;
        }

        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      })
      .map((complaint) => ({
        ...complaint.toObject(),
        assignedToMe: true,
        currentOfficer,
      }));

    res.json({
      alerts,
      officer: currentOfficer,
      message: "Live alerts retrieved successfully",
    });
  } catch (error) {
    console.error("Error fetching live alerts:", error);
    res.status(500).json({ message: "Error fetching live alerts" });
  }
});

router.post("/complaints/:id/staff/respond", async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    const currentOfficer = await resolveCurrentOfficer(req);
    if (!currentOfficer || !currentOfficer.onDutyStatus || !complaintMatchesOfficer(complaint, currentOfficer)) {
      return res.status(403).json({ message: "On-duty officer access required." });
    }

    const text = String(req.body?.text || "").trim();
    if (!text) {
      return res.status(400).json({ message: "Reply text required" });
    }

    const replyMessage = {
      staffId: currentOfficer.staffId,
      staffName: currentOfficer.staffName,
      text,
      timestamp: new Date(),
    };

    complaint.messages.push(replyMessage);
    complaint.officerNotes = String(req.body?.notes || complaint.officerNotes || "").trim() || complaint.officerNotes || null;
    complaint.coachRemark = String(req.body?.coachRemark || complaint.coachRemark || "").trim() || complaint.coachRemark || null;
    complaint.stationRemark = String(req.body?.stationRemark || complaint.stationRemark || "").trim() || complaint.stationRemark || null;
    complaint.staffResponseStatus = "Replied";
    if (req.body?.markPassengerContacted) {
      complaint.status = "Passenger Contacted";
    } else if (complaint.status === "Reported" || complaint.status === "Submitted") {
      complaint.status = "Staff Notified";
    }
    complaint.staffNotified = true;
    complaint.staffId = currentOfficer.staffId;
    complaint.staffName = currentOfficer.staffName;
    complaint.staffEta = req.body?.staffEta || complaint.staffEta || "8 mins";
    await complaint.save();

    if (USE_PROTOTYPE_DATA) {
      appendComplaintFromMongo(complaint.toObject ? complaint.toObject() : complaint);
    }

    return res.json({
      message: "Reply saved successfully",
      complaint,
    });
  } catch (error) {
    console.error("Staff respond error:", error.message);
    return res.status(500).json({ message: "Unable to save reply." });
  }
});

router.patch("/complaints/:id/staff/acknowledge", async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    const currentOfficer = await resolveCurrentOfficer(req);
    if (!currentOfficer || !currentOfficer.onDutyStatus || !complaintMatchesOfficer(complaint, currentOfficer)) {
      return res.status(403).json({ message: "On-duty officer access required." });
    }

    const action = String(req.body?.action || "Seen").trim();
    const isAcknowledged = /ack/i.test(action);
    const nextStatus = isAcknowledged ? "Acknowledged" : "Seen";

    complaint.status = nextStatus;
    complaint.seenAt = complaint.seenAt || new Date();
    complaint.acknowledgedAt = isAcknowledged ? new Date() : complaint.acknowledgedAt;
    complaint.staffResponseStatus = isAcknowledged ? "Complaint acknowledged by officer" : "Complaint seen by officer";
    complaint.officerNotes = String(req.body?.notes || complaint.officerNotes || "").trim() || complaint.officerNotes || null;
    complaint.coachRemark = String(req.body?.coachRemark || complaint.coachRemark || "").trim() || complaint.coachRemark || null;
    complaint.stationRemark = String(req.body?.stationRemark || complaint.stationRemark || "").trim() || complaint.stationRemark || null;
    complaint.messages = complaint.messages || [];
    complaint.messages.push(
      staffTimelineEntry(
        currentOfficer.staffName,
        isAcknowledged ? "Complaint acknowledged" : "Complaint seen",
        currentOfficer,
      ),
    );

    complaint.assignedStaff = (complaint.assignedStaff || []).map((entry) => {
      if ((entry.staffId && entry.staffId === currentOfficer.staffId) || (entry.staffEmail && entry.staffEmail === currentOfficer.staffEmail)) {
        return {
          ...entry,
          acknowledgedAt: isAcknowledged ? new Date() : entry.acknowledgedAt || null,
        };
      }
      return entry;
    });

    await complaint.save();

    if (USE_PROTOTYPE_DATA) {
      appendComplaintFromMongo(complaint.toObject ? complaint.toObject() : complaint);
    }

    return res.json({
      message: `Complaint ${nextStatus.toLowerCase()} successfully`,
      complaint,
    });
  } catch (error) {
    console.error("Staff acknowledge error:", error.message);
    return res.status(500).json({ message: "Unable to update acknowledgement state." });
  }
});

router.patch("/complaints/:id/staff/status", async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    const currentOfficer = await resolveCurrentOfficer(req);
    if (!currentOfficer || !currentOfficer.onDutyStatus || !complaintMatchesOfficer(complaint, currentOfficer)) {
      return res.status(403).json({ message: "On-duty officer access required." });
    }

    const status = String(req.body?.status || "").trim();
    if (!status) {
      return res.status(400).json({ message: "Status required" });
    }

    complaint.status = status;
    complaint.itemFound = Boolean(req.body?.itemFound ?? complaint.itemFound);
    complaint.meetingScheduled = Boolean(req.body?.meetingScheduled ?? complaint.meetingScheduled);
    complaint.meetingPoint = req.body?.meetingPoint || complaint.meetingPoint || null;
    complaint.meetingTime = req.body?.meetingTime || complaint.meetingTime || null;
    complaint.staffEta = req.body?.staffEta || complaint.staffEta || null;
    complaint.recoveryStation = req.body?.recoveryStation || complaint.recoveryStation || null;
    complaint.recoveryNotes = req.body?.recoveryNotes || complaint.recoveryNotes || null;
    complaint.officerNotes = String(req.body?.notes || complaint.officerNotes || "").trim() || complaint.officerNotes || null;
    complaint.coachRemark = String(req.body?.coachRemark || complaint.coachRemark || "").trim() || complaint.coachRemark || null;
    complaint.stationRemark = String(req.body?.stationRemark || complaint.stationRemark || "").trim() || complaint.stationRemark || null;
    complaint.staffResponseStatus = req.body?.staffResponseStatus || `Status updated to ${status}`;
    complaint.messages = complaint.messages || [];
    complaint.messages.push(
      staffTimelineEntry(currentOfficer.staffName, `Status changed to ${status.toLowerCase()}`, currentOfficer),
    );
    await complaint.save();

    if (USE_PROTOTYPE_DATA) {
      appendComplaintFromMongo(complaint.toObject ? complaint.toObject() : complaint);
    }

    return res.json({
      message: "Status updated successfully",
      complaint,
    });
  } catch (error) {
    console.error("Staff status error:", error.message);
    return res.status(500).json({ message: "Unable to update complaint status." });
  }
});

router.patch("/complaints/:id/staff/handover", async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    const currentOfficer = await resolveCurrentOfficer(req);
    if (!currentOfficer || !currentOfficer.onDutyStatus || !complaintMatchesOfficer(complaint, currentOfficer)) {
      return res.status(403).json({ message: "On-duty officer access required." });
    }

    const handoverStation = String(req.body?.handoverStation || req.body?.meetingPoint || complaint.recoveryStation || "").trim();
    const handoverTime = String(req.body?.handoverTime || complaint.meetingTime || "").trim();

    complaint.status = "Ready for Handover";
    complaint.meetingScheduled = true;
    complaint.meetingPoint = handoverStation || complaint.meetingPoint || null;
    complaint.meetingTime = handoverTime || complaint.meetingTime || null;
    complaint.recoveryStation = handoverStation || complaint.recoveryStation || null;
    complaint.recoveryNotes = req.body?.recoveryNotes || complaint.recoveryNotes || null;
    complaint.officerNotes = String(req.body?.notes || complaint.officerNotes || "").trim() || complaint.officerNotes || null;
    complaint.coachRemark = String(req.body?.coachRemark || complaint.coachRemark || "").trim() || complaint.coachRemark || null;
    complaint.stationRemark = String(req.body?.stationRemark || complaint.stationRemark || "").trim() || complaint.stationRemark || null;
    complaint.staffResponseStatus = `Handover arranged at ${handoverStation || "next station"}`;
    complaint.messages = complaint.messages || [];
    complaint.messages.push(
      staffTimelineEntry(currentOfficer.staffName, `Handover arranged at ${handoverStation || "the next station"}`, currentOfficer),
    );
    await complaint.save();

    if (USE_PROTOTYPE_DATA) {
      const plainComplaint = complaint.toObject ? complaint.toObject() : complaint;
      appendComplaintFromMongo(plainComplaint);
      appendHandoverRecord({
        complaintId: plainComplaint.complaintId || plainComplaint._id?.toString() || req.params.id,
        complaintRef: plainComplaint._id?.toString() || req.params.id,
        officerId: currentOfficer.staffId,
        officerName: currentOfficer.staffName,
        station: handoverStation || "Next station",
        handoverTime: handoverTime || "Pending",
        status: "planned",
        notes: complaint.recoveryNotes || null,
      });
    }

    return res.json({
      message: "Handover coordinated successfully",
      complaint,
    });
  } catch (error) {
    console.error("Staff handover error:", error.message);
    return res.status(500).json({ message: "Unable to coordinate handover." });
  }
});

// GET /api/passenger/complaints/:id - Get specific complaint details
router.get("/complaints/:id", async (req, res) => {
  try {
    const complaintId = req.params.id;
    const userEmail = getUserEmail(req);

    const complaint = await Complaint.findOne({ _id: complaintId, passengerEmail: userEmail });

    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    res.json({
      complaint: complaint,
      message: "Complaint retrieved successfully",
    });
  } catch (error) {
    console.error("Error fetching complaint:", error);
    res.status(500).json({ message: "Error fetching complaint" });
  }
});

// GET /api/passenger/tracking/:complaintId - Get live tracking info
router.get("/tracking/:complaintId", async (req, res) => {
  try {
    const complaintId = req.params.complaintId;
    const userEmail = getUserEmail(req);

    const complaint = await Complaint.findOne({ _id: complaintId, passengerEmail: userEmail });

    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    const latestLocation = complaint.sharedLocation || complaint.gpsLocation;

    const trackingData = {
      complaintId: complaint._id,
      complaintRef: complaint.complaintId || complaint._id,
      staffLocation: {
        latitude: latestLocation?.latitude || null,
        longitude: latestLocation?.longitude || null,
        lastUpdated: latestLocation?.timestamp || latestLocation?.sharedAt || null,
      },
      meetingPoint: complaint.meetingPoint || "Guindy Station",
      staffEta: complaint.staffEta || "8 mins",
      itemStatus: complaint.itemFound ? "Found ✅" : "Searching 🔍",
      status: complaint.status,
      staffResponseStatus: complaint.staffResponseStatus || null,
      officerNotes: complaint.officerNotes || null,
      coachRemark: complaint.coachRemark || null,
      stationRemark: complaint.stationRemark || null,
      seenAt: complaint.seenAt || null,
      acknowledgedAt: complaint.acknowledgedAt || null,
      updates: complaint.messages || [],
      liveLocationAvailable: Boolean(
        typeof latestLocation?.latitude === "number" &&
          typeof latestLocation?.longitude === "number",
      ),
    };

    res.json({
      tracking: trackingData,
      message: "Tracking data retrieved successfully",
    });
  } catch (error) {
    console.error("Error fetching tracking:", error);
    res.status(500).json({ message: "Error fetching tracking data" });
  }
});

// GET /api/passenger/messages/:complaintId - Get staff messages
router.get("/messages/:complaintId", async (req, res) => {
  try {
    const complaintId = req.params.complaintId;
    const userEmail = getUserEmail(req);

    const complaint = await Complaint.findOne({ _id: complaintId, passengerEmail: userEmail });

    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    res.json({
      messages: complaint.messages || [],
      staffName: complaint.staffName,
      message: "Messages retrieved successfully",
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ message: "Error fetching messages" });
  }
});

// POST /api/passenger/messages/:complaintId - Send message to staff
router.post("/messages/:complaintId", async (req, res) => {
  try {
    const complaintId = req.params.complaintId;
    const userEmail = getUserEmail(req);
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ message: "Message text required" });
    }

    const complaint = await Complaint.findOne({
      _id: complaintId,
      passengerEmail: userEmail,
    });

    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    const newMessage = {
      staffId: complaint.staffId,
      staffName: complaint.staffName,
      text,
      timestamp: new Date(),
    };

    complaint.messages.push(newMessage);
    await complaint.save();

    res.json({
      message: "Message sent successfully",
      messages: complaint.messages,
    });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ message: "Error sending message" });
  }
});

// POST /api/passenger/qr-code/:complaintId - Verify QR code for pickup
router.post("/qr-code/:complaintId", async (req, res) => {
  try {
    const complaintId = req.params.complaintId;
    const userEmail = getUserEmail(req);

    const complaint = await Complaint.findOne({ _id: complaintId, passengerEmail: userEmail });

    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    // Mark as collected
    complaint.itemCollected = true;
    complaint.status = "Recovered";
    await complaint.save();

    res.json({
      message: "Item collected successfully!",
      complaint: complaint,
    });
  } catch (error) {
    console.error("Error processing QR code:", error);
    res.status(500).json({ message: "Error processing QR code" });
  }
});

// POST /api/passenger/gps - Update GPS status
router.post("/gps", async (req, res) => {
  try {
    const userEmail = getUserEmail(req);
    const { enabled } = req.body;

    if (!userEmail) {
      return res.status(400).json({ message: "User email required" });
    }

    // Update GPS status for all active journeys/complaints
    // This is a simple implementation - in production, would use real GPS tracking
    res.json({
      gpsEnabled: enabled,
      message: `GPS ${enabled ? "enabled" : "disabled"}`,
    });
  } catch (error) {
    console.error("Error updating GPS:", error);
    res.status(500).json({ message: "Error updating GPS" });
  }
});

// POST /api/passenger/journey - Create a new journey
router.post("/journey", async (req, res) => {
  try {
    const userEmail = getUserEmail(req);
    if (!userEmail) {
      return res.status(400).json({ message: "User email required" });
    }

    const {
      vehicleNumber,
      route,
      fromStop,
      toStop,
      driverName,
      conductorName,
      estimatedDuration,
    } = req.body;

    if (!vehicleNumber || !route) {
      return res.status(400).json({
        message: "Vehicle number and route are required",
      });
    }

    let journey;
    if (isDbConnected()) {
      journey = new Journey({
        passengerId: userEmail,
        passengerEmail: userEmail,
        vehicleNumber,
        route,
        fromStop: fromStop || "",
        toStop: toStop || "",
        currentStop: fromStop || "",
        startTime: new Date(),
        estimatedEndTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
        driverName: driverName || null,
        conductorName: conductorName || null,
        estimatedDuration: estimatedDuration || "2h",
        status: "Active",
      });

      await journey.save();
    } else {
      journey = {
        _id: toIsoLikeId("jrny"),
        passengerId: userEmail,
        passengerEmail: userEmail,
        vehicleNumber,
        route,
        fromStop: fromStop || "",
        toStop: toStop || "",
        currentStop: fromStop || "",
        startTime: new Date(),
        estimatedEndTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
        driverName: driverName || null,
        conductorName: conductorName || null,
        estimatedDuration: estimatedDuration || "2h",
        status: "Active",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      localJourneys.unshift(journey);
    }

    res.status(201).json({
      journey: journey,
      message: "Journey created successfully",
    });
  } catch (error) {
    console.error("Error creating journey:", error);
    res.status(500).json({ message: "Error creating journey" });
  }
});

// POST /api/passenger/share-location/:complaintId - Share live location
router.post("/share-location/:complaintId", async (req, res) => {
  try {
    const complaintId = req.params.complaintId;
    const { latitude, longitude, timestamp } = req.body;
    const numericLat = Number(latitude);
    const numericLng = Number(longitude);

    if (Number.isNaN(numericLat) || Number.isNaN(numericLng)) {
      return res.status(400).json({ message: "Latitude and longitude required" });
    }

    const complaint = await Complaint.findById(complaintId);

    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    // Store the shared location
    complaint.sharedLocation = {
      latitude: numericLat,
      longitude: numericLng,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      sharedAt: new Date(),
    };
    complaint.status = "Accepted";
    complaint.staffNotified = true;

    await complaint.save();

    console.log(
      `📍 Location shared for complaint ${complaintId}: Lat ${latitude}, Lng ${longitude}`
    );

    res.json({
      message: "Location shared successfully",
      complaint: complaint,
    });
  } catch (error) {
    console.error("Error sharing location:", error);
    res.status(500).json({ message: "Error sharing location" });
  }
});

module.exports = router;
