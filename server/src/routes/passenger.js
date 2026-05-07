const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Complaint = require("../models/Complaint");
const ComplaintReply = require("../models/ComplaintReply");
const Journey = require("../models/Journey");
const User = require("../models/User");
const { success, failure } = require("../utils/apiResponse");
const { logAction } = require("../utils/actionLogger");
const { routeComplaintToActiveOfficers } = require("../services/complaintRoutingService");
const { emitSocketEvent } = require("../utils/socket");
const {
  inferDutyUnit,
  normalizeDutyUnit,
  toDutyOfficer,
} = require("../utils/dutyRoster");
const {
  isValidStatusTransition,
  getValidNextStatuses,
  isActiveStatus,
  getStatusDescription,
} = require("../utils/complaintStatusFlow");
const {
  calculatePriority,
  getPriorityReason,
  PRIORITY_LEVELS,
} = require("../utils/priorityCalculator");

// Middleware to extract user email from headers
const getUserEmail = (req) => req.headers["x-user-email"] || "";

// Middleware to get user role from headers
const getUserRole = (req) => {
  const role = req.headers["x-user-role"] || req.auth?.role || "";
  return String(role).trim();
};

// Role validation middleware for Passenger routes
const requirePassengerRole = (req, res, next) => {
  const userRole = getUserRole(req);
  if (userRole !== "Passenger") {
    return res.status(403).json({
      message: "Passenger role required to access this resource",
      error: "INSUFFICIENT_ROLE"
    });
  }
  return next();
};

// Role validation middleware for Officer routes
const requireOfficerRole = (req, res, next) => {
  const userRole = getUserRole(req);
  if (userRole !== "TTR/RPF/Police") {
    return res.status(403).json({
      message: "Officer role required to access this resource",
      error: "INSUFFICIENT_ROLE"
    });
  }
  return next();
};

const STAFF_ROLES = new Set(["TTR/RPF/Police", "Driver/Conductor", "Cab/Auto"]);

const requireStaffRole = (req, res, next) => {
  const userRole = getUserRole(req);
  if (!STAFF_ROLES.has(userRole)) {
    return res.status(403).json({
      message: "Staff role required to access this resource",
      error: "INSUFFICIENT_ROLE"
    });
  }
  return next();
};

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
  if (value && typeof value === "object") {
    const { transportType } = value;
    if (/train/i.test(String(transportType || ""))) {
      return TRAIN_AUTHORITY;
    }
    return "Staff";
  }
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

const maskPhoneNumber = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) {
    return null;
  }

  if (digits.length <= 4) {
    return digits;
  }

  return `${"*".repeat(Math.max(digits.length - 4, 4))}${digits.slice(-4)}`;
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

  return null;
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
  if (!complaint || !officer) return false;

  // If complaint has no assigned staff yet, any on-duty officer of same unit can respond
  const assignedStaff = Array.isArray(complaint.assignedStaff) ? complaint.assignedStaff : [];
  if (assignedStaff.length === 0) return true;

  const officerEmail = String(officer.staffEmail || "").trim().toLowerCase();
  const officerId    = String(officer.staffId   || "").trim().toLowerCase();
  const officerUnit  = normalizeDutyUnit(officer.dutyUnit || inferDutyUnit(officer));

  return assignedStaff.some((entry) => {
    const entryEmail = String(entry.staffEmail || "").trim().toLowerCase();
    const entryId    = String(entry.staffId    || "").trim().toLowerCase();
    const entryUnit  = normalizeDutyUnit(entry.staffRole || entry.dutyUnit || inferDutyUnit(entry));
    return (
      (officerEmail && entryEmail && entryEmail === officerEmail) ||
      (officerId    && entryId    && entryId    === officerId   ) ||
      (officerUnit  && entryUnit  && entryUnit  === officerUnit )
    );
  });
};

const staffTimelineEntry = (staffName, text, status) => ({
  staffId: status?.staffId || null,
  staffName: staffName || status?.staffName || "Duty officer",
  text,
  timestamp: new Date(),
});

const persistComplaintReply = async ({ complaint, currentOfficer, message, statusUpdate }) => {
  if (!complaint || !currentOfficer) {
    return null;
  }

  return ComplaintReply.create({
    complaintId: complaint._id,
    officerId: String(currentOfficer.staffId || currentOfficer.staffEmail || "unknown-officer"),
    officerRole: String(currentOfficer.dutyUnit || currentOfficer.staffRole || "TTR"),
    message: String(message || "Status update").trim(),
    statusUpdate: String(statusUpdate || complaint.status || "Seen").trim(),
    repliedAt: new Date(),
  });
};


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
      complaintType,
      complaintDescription,
      complaintTime,
      transportType,
      vehicleNumber,
      itemType,
      description,
      lostItemType,
      passengerPhoneMasked,
      pnrMock,
      trainName,
      coach,
      seat,
      photoUri,
      fromLocation,
      toLocation,
      departureTime,
      arrivalTime,
      lastSeenLocation,
      currentTrainLocation,
      currentLat,
      currentLng,
      timestamp,
      journeyId,
      route,
      submitAuthority,
      severity,
      priority,
    } = req.body;

    if (!vehicleNumber || !itemType || !description || !transportType) {
      return failure(res, 400, "Missing required fields", "VALIDATION_ERROR");
    }

    // Generate unique QR code ID
    const qrCode = `QR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const complaintId = `CRN-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    // Resolve variables from request body or defaults
    const resolvedComplaintType = complaintType || "Lost Item";
    const resolvedComplaintDescription = complaintDescription || description || "";
    const resolvedComplaintTime = complaintTime || timestamp || new Date().toISOString();
    const resolvedPassengerPhoneMasked = passengerPhoneMasked || maskPhoneNumber(req.headers["x-user-phone"]);
    const resolvedTrainName = trainName || "";
    const resolvedCoach = coach || "";
    const resolvedSeat = seat || "";
    const resolvedLocation = currentTrainLocation || lastSeenLocation || fromLocation || "Unknown";
    const submitAuthorityValue = submitAuthority || normalizeSubmitAuthority({ transportType, itemType, description });

    console.log("📝 Creating complaint for email:", userEmail);

    // Calculate priority based on multiple factors
    const { priority: calculatedPriority, factors: priorityFactors } = calculatePriority({
      itemValue: req.body?.itemValue,
      securitySuspicion: req.body?.securitySuspicion,
      passengerAge: req.headers["x-user-age"],
      passengerGender: req.headers["x-user-gender"],
      passengerDisability: req.body?.passengerDisability,
      complaintTime: resolvedComplaintTime,
      timestamp: resolvedComplaintTime,
      itemType: itemType,
      theftIndication: req.body?.theftIndication,
      suspiciousActivity: req.body?.suspiciousActivity,
      submitAuthority: submitAuthorityValue,
    });

    const resolvedPriority = calculatedPriority || priority || severity || "Normal";
    const priorityReason = getPriorityReason(priorityFactors);

    const complaint = new Complaint({
      passengerId: userEmail,
      passengerEmail: userEmail,
      passengerName: req.headers["x-user-name"] || "Passenger",
      transportType: transportType || "bus",
      complaintType: resolvedComplaintType,
      complaintDescription: resolvedComplaintDescription,
      complaintTime: resolvedComplaintTime,
      passengerPhoneMasked: resolvedPassengerPhoneMasked,
      pnrMock: pnrMock || complaintId,
      vehicleNumber,
      trainName: resolvedTrainName,
      coach: resolvedCoach,
      seat: resolvedSeat,
      itemType,
      description,
      photoUri: photoUri || null,
      fromLocation: fromLocation || "",
      toLocation: toLocation || "",
      departureTime: departureTime || "",
      arrivalTime: arrivalTime || "",
      lastSeenLocation: lastSeenLocation || fromLocation || "Unknown",
      currentTrainLocation: resolvedLocation,
      currentLat: currentLat != null ? Number(currentLat) : null,
      currentLng: currentLng != null ? Number(currentLng) : null,
      timestamp: resolvedComplaintTime,
      journeyId: journeyId && mongoose.Types.ObjectId.isValid(journeyId) ? new mongoose.Types.ObjectId(journeyId) : null,
      route: route || (fromLocation && toLocation ? `${fromLocation} → ${toLocation}` : fromLocation || toLocation || "Unknown route"),
      submitAuthority: submitAuthorityValue,
      complaintId,
      qrCode,
      status: "Submitted",
      severity: resolvedPriority,
      priority: resolvedPriority,
      priorityFactors,
      priorityCalculatedAt: new Date(),
      autoEscalationTimer: {
        timeoutMs: 300000, // 5 minutes for demo
        startedAt: new Date(),
      },
      assignedStaff: [],
      alertPriorityReason: priorityReason,
      dispatchMode: "Pending assignment",
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
    const queueNotifications = Array.isArray(routingResult?.queueNotifications)
      ? routingResult.queueNotifications
      : [];

    savedComplaint.complaintId = savedComplaint.complaintId || complaintId;
    savedComplaint.assignedStaff = routedOfficers;
    savedComplaint.staffNotified = routedOfficers.length > 0 || queueNotifications.length > 0;
    savedComplaint.staffId = routedOfficers[0]?.staffId || null;
    savedComplaint.staffName = routedOfficers[0]?.staffName || submitAuthorityValue || null;
    savedComplaint.assignedToUnit = routedOfficers.length > 0 ? (routedOfficers[0]?.dutyUnit || null) : null;
    savedComplaint.assignedRole = routedOfficers.length > 0 ? (routedOfficers[0]?.dutyUnit === "POLICE" ? "Police" : routedOfficers[0]?.dutyUnit || null) : null;
    savedComplaint.assignedOfficerId = routedOfficers[0]?.staffId || null;
    savedComplaint.assignedOfficerName = routedOfficers[0]?.staffName || submitAuthorityValue || null;
    savedComplaint.assignedAt = routedOfficers.length > 0 ? new Date() : null;
    savedComplaint.staffEta = routedOfficers.length > 0 ? "6 mins" : "Pending assignment";
    savedComplaint.status = routedOfficers.length > 0 ? "Staff Notified" : "Submitted";
    savedComplaint.staffResponseStatus = routedOfficers.length > 0
      ? "Pending response"
      : queueNotifications.length > 0
        ? "Awaiting supervisor review"
        : "Awaiting duty roster";
    savedComplaint.dispatchMode = routingResult?.assignmentStrategy || routingResult?.escalationLevel || savedComplaint.dispatchMode;
    savedComplaint.alertPriorityReason = routingResult?.routingReason || savedComplaint.alertPriorityReason;
    savedComplaint.escalationLevel = routingResult?.escalationLevel || savedComplaint.escalationLevel || null;
    
    console.log("💾 Updating complaint status...");
    await savedComplaint.save();
    console.log("✅ Second save successful");

    const complaintSnapshot = savedComplaint.toObject ? savedComplaint.toObject() : savedComplaint;
    emitSocketEvent("complaint:new", {
      complaintId: String(savedComplaint._id),
      complaint: complaintSnapshot,
      routedOfficers,
      queueNotifications,
      assignmentStrategy: routingResult?.assignmentStrategy || null,
      escalationLevel: routingResult?.escalationLevel || null,
    });

    if (queueNotifications.length > 0) {
      emitSocketEvent("complaint:escalation", {
        complaintId: String(savedComplaint._id),
        complaint: complaintSnapshot,
        escalationLevel: "UNASSIGNED_URGENT_QUEUE",
        routingReason: routingResult?.routingReason || "Queued for supervisor review",
        queueNotifications,
      });
    } else if (routingResult?.escalationLevel && routingResult.escalationLevel !== "TRAIN_LEVEL") {
      emitSocketEvent("complaint:escalation", {
        complaintId: String(savedComplaint._id),
        complaint: complaintSnapshot,
        escalationLevel: routingResult.escalationLevel,
        routingReason: routingResult?.routingReason || null,
        routedOfficers,
      });
    }

    await logAction({
      action: "COMPLAINT_CREATED_AND_ROUTED",
      actorType: "PASSENGER",
      actorId: userEmail,
      entityType: "Complaint",
      entityId: String(savedComplaint._id),
      complaintId: savedComplaint.complaintId,
      metadata: {
        priority,
        notifiedOfficers: routedOfficers.length,
        dispatchMode: savedComplaint.dispatchMode,
      },
    });

    return success(res, 201, "Complaint created successfully", {
      complaint: savedComplaint,
    });
  } catch (error) {
    console.error("❌ Error creating complaint:", error?.message);
    console.error("Full error:", error);
    return failure(res, 500, "Error creating complaint", "INTERNAL_ERROR", error?.message);
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
// Shows active complaints filtered by transport/staff role.
// Falls back to showing matching complaints even when the backing staff
// profile is unavailable so the dashboard is never completely empty during testing.
router.get("/live-alerts", requireStaffRole, async (req, res) => {
  try {
    const { staffRole } = req.query;
    const transportFilters = resolveTransportFilters(staffRole);
    const officerIdentity = getRequestOfficerIdentity(req);

    // Resolve the current officer from DB
    let currentOfficer = null;
    if (officerIdentity.email) {
      const user = await User.findOne({ email: officerIdentity.email, role: "TTR/RPF/Police" })
        .select("_id email name professionalId role onDutyStatus dutyCheckInAt dutyDesk dutyUnit dutyStation dutyNote jurisdiction");
      if (user) currentOfficer = toDutyOfficer(user.toSafeObject ? user.toSafeObject() : user);
    }
    if (!currentOfficer && officerIdentity.professionalId) {
      const user = await User.findOne({ professionalId: officerIdentity.professionalId, role: "TTR/RPF/Police" })
        .select("_id email name professionalId role onDutyStatus dutyCheckInAt dutyDesk dutyUnit dutyStation dutyNote jurisdiction");
      if (user) currentOfficer = toDutyOfficer(user.toSafeObject ? user.toSafeObject() : user);
    }

    // Build query: all active-status train complaints
    const ACTIVE_STATUSES = [
      "Submitted", "Reported", "Staff Notified", "Accepted", "Seen",
      "Acknowledged", "Item Being Checked", "Passenger Contacted",
      "Ready for Handover", "Found", "In verification", "Secured",
      "Meeting Scheduled",
    ];
    const query = {
      transportType: { $in: transportFilters },
      status: { $in: ACTIVE_STATUSES },
    };

    // If officer has a specific unit (TTR/RPF), filter by matching submitAuthority
    const authorityFilter = resolveAuthorityFilter(officerIdentity.dutyUnit || staffRole);
    if (authorityFilter) query.submitAuthority = authorityFilter;

    const complaintList = await Complaint.find(query)
      .sort({ createdAt: -1 })
      .limit(100);

    const priorityOrder = { Critical: 0, High: 1, Normal: 2, Low: 3 };
    const alerts = complaintList
      .sort((a, b) => {
        const pa = priorityOrder[a.priority] ?? 4;
        const pb = priorityOrder[b.priority] ?? 4;
        if (pa !== pb) return pa - pb;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
      .map((c) => ({ ...c.toObject(), currentOfficer }));

    return res.json({
      alerts,
      officer: currentOfficer,
      message: alerts.length === 0 ? "No active complaints at this time." : "Live alerts retrieved successfully",
    });
  } catch (error) {
    console.error("Error fetching live alerts:", error);
    return res.status(500).json({ message: "Error fetching live alerts" });
  }
});

// GET /api/passenger/complaints/:id - Get full complaint detail (Officer access)
router.get("/complaints/:id", requireOfficerRole, async (req, res) => {
  try {
    const { id } = req.params;
    let complaint = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      complaint = await Complaint.findById(id);
    }
    if (!complaint) {
      complaint = await Complaint.findOne({ complaintId: id });
    }
    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found", error: "NOT_FOUND" });
    }
    return res.json({ complaint: complaint.toObject ? complaint.toObject() : complaint });
  } catch (error) {
    console.error("Error fetching complaint detail:", error);
    return res.status(500).json({ message: "Error fetching complaint", error: error.message });
  }
});


router.post("/complaints/:id/staff/respond", requireOfficerRole, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return failure(res, 404, "Complaint not found", "NOT_FOUND");

    const currentOfficer = await resolveCurrentOfficer(req);
    // Relaxed check: on-duty officer of matching unit can respond, even if not in assignedStaff
    if (!currentOfficer || !currentOfficer.onDutyStatus) {
      return failure(res, 403, "On-duty officer access required.", "OFFICER_OFF_DUTY");
    }

    const text = String(req.body?.text || "").trim();
    if (!text) {
      return failure(res, 400, "Reply text required", "VALIDATION_ERROR");
    }

    const previousStatus = complaint.status;

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

    const storedReply = await persistComplaintReply({
      complaint,
      currentOfficer,
      message: text,
      statusUpdate: complaint.status,
    });

    emitSocketEvent("complaint:reply", {
      complaintId: String(complaint._id),
      passengerId: complaint.passengerId,
      complaint: complaint.toObject ? complaint.toObject() : complaint,
      reply: storedReply ? (storedReply.toObject ? storedReply.toObject() : storedReply) : null,
      actorRole: currentOfficer.dutyUnit || currentOfficer.staffRole,
      source: "staff-response",
    });

    emitSocketEvent("complaint:status-change", {
      complaintId: String(complaint._id),
      passengerId: complaint.passengerId,
      complaint: complaint.toObject ? complaint.toObject() : complaint,
      previousStatus,
      newStatus: complaint.status,
      actorRole: currentOfficer.dutyUnit || currentOfficer.staffRole,
      source: "staff-response",
    });

    await logAction({
      action: "OFFICER_REPLIED_TO_PASSENGER",
      actorType: "OFFICER",
      actorId: currentOfficer.staffId || currentOfficer.staffEmail,
      actorRole: currentOfficer.dutyUnit || currentOfficer.staffRole,
      entityType: "Complaint",
      entityId: String(complaint._id),
      complaintId: complaint.complaintId || String(complaint._id),
      metadata: {
        replyId: storedReply?._id?.toString?.() || null,
        status: complaint.status,
      },
    });

    return success(res, 200, "Reply saved successfully", {
      complaint,
      reply: storedReply,
    });
  } catch (error) {
    console.error("Staff respond error:", error.message);
    return failure(res, 500, "Unable to save reply.", "INTERNAL_ERROR", error.message);
  }
});

router.patch("/complaints/:id/staff/acknowledge", requireOfficerRole, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return failure(res, 404, "Complaint not found", "NOT_FOUND");
    }

    const currentOfficer = await resolveCurrentOfficer(req);
    if ((!currentOfficer || !currentOfficer.onDutyStatus)) {
      return failure(res, 403, "On-duty officer access required.", "OFFICER_OFF_DUTY");
    }

    const action = String(req.body?.action || "Seen").trim();
    const isAcknowledged = /ack/i.test(action);
    const nextStatus = isAcknowledged ? "Acknowledged" : "Seen";
    const previousStatus = complaint.status;

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

    emitSocketEvent("complaint:accepted", {
      complaintId: String(complaint._id),
      passengerId: complaint.passengerId,
      complaint: complaint.toObject ? complaint.toObject() : complaint,
      acceptedAt: complaint.acknowledgedAt || new Date(),
      actorRole: currentOfficer.dutyUnit || currentOfficer.staffRole,
      source: isAcknowledged ? "staff-acknowledge" : "staff-seen",
    });

    emitSocketEvent("complaint:status-change", {
      complaintId: String(complaint._id),
      passengerId: complaint.passengerId,
      complaint: complaint.toObject ? complaint.toObject() : complaint,
      previousStatus,
      newStatus,
      actorRole: currentOfficer.dutyUnit || currentOfficer.staffRole,
      source: isAcknowledged ? "staff-acknowledge" : "staff-seen",
    });

    const storedReply = await persistComplaintReply({
      complaint,
      currentOfficer,
      message: isAcknowledged ? "Complaint acknowledged" : "Complaint seen",
      statusUpdate: nextStatus,
    });

    await logAction({
      action: "OFFICER_ACKNOWLEDGEMENT_UPDATED",
      actorType: "OFFICER",
      actorId: currentOfficer.staffId || currentOfficer.staffEmail,
      actorRole: currentOfficer.dutyUnit || currentOfficer.staffRole,
      entityType: "Complaint",
      entityId: String(complaint._id),
      complaintId: complaint.complaintId || String(complaint._id),
      metadata: {
        replyId: storedReply?._id?.toString?.() || null,
        status: nextStatus,
      },
    });

    return success(res, 200, `Complaint ${nextStatus.toLowerCase()} successfully`, {
      complaint,
      reply: storedReply,
    });
  } catch (error) {
    console.error("Staff acknowledge error:", error.message);
    return failure(res, 500, "Unable to update acknowledgement state.", "INTERNAL_ERROR", error.message);
  }
});

router.patch("/complaints/:id/staff/status", requireOfficerRole, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return failure(res, 404, "Complaint not found", "NOT_FOUND");
    }

    const currentOfficer = await resolveCurrentOfficer(req);
    if ((!currentOfficer || !currentOfficer.onDutyStatus)) {
      return failure(res, 403, "On-duty officer access required.", "OFFICER_OFF_DUTY");
    }

    const newStatus = String(req.body?.status || "").trim();
    if (!newStatus) {
      return failure(res, 400, "Status required", "VALIDATION_ERROR");
    }

    const previousStatus = complaint.status;

    // Log invalid transition as a warning but allow it for flexibility
    if (!isValidStatusTransition(complaint.status, newStatus)) {
      console.warn(`[status-update] Non-standard transition: ${complaint.status} → ${newStatus} (allowed)`);
    }

    complaint.status = newStatus;
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
    complaint.staffResponseStatus = `Status updated to ${newStatus}`;
    complaint.messages = complaint.messages || [];
    complaint.messages.push(
      staffTimelineEntry(currentOfficer.staffName, `Status changed to ${newStatus}`, currentOfficer),
    );
    await complaint.save();

    emitSocketEvent("complaint:status-change", {
      complaintId: String(complaint._id),
      passengerId: complaint.passengerId,
      complaint: complaint.toObject ? complaint.toObject() : complaint,
      previousStatus,
      newStatus,
      actorRole: currentOfficer.dutyUnit || currentOfficer.staffRole,
      source: "staff-status",
    });

    if (/ready for handover|item found|passenger contacted|closed/i.test(newStatus)) {
      emitSocketEvent("complaint:escalation", {
        complaintId: String(complaint._id),
        passengerId: complaint.passengerId,
        complaint: complaint.toObject ? complaint.toObject() : complaint,
        escalationLevel: complaint.escalationLevel || newStatus,
        routingReason: complaint.staffResponseStatus || `Status updated to ${newStatus}`,
        actorRole: currentOfficer.dutyUnit || currentOfficer.staffRole,
        source: "staff-status",
      });
    }

    const storedReply = await persistComplaintReply({
      complaint,
      currentOfficer,
      message: `Status changed to ${newStatus}`,
      statusUpdate: newStatus,
    });

    await logAction({
      action: "OFFICER_STATUS_UPDATED",
      actorType: "OFFICER",
      actorId: currentOfficer.staffId || currentOfficer.staffEmail,
      actorRole: currentOfficer.dutyUnit || currentOfficer.staffRole,
      entityType: "Complaint",
      entityId: String(complaint._id),
      complaintId: complaint.complaintId || String(complaint._id),
      metadata: {
        replyId: storedReply?._id?.toString?.() || null,
        oldStatus: complaint.status,
        newStatus,
        statusDescription: getStatusDescription(newStatus),
      },
    });

    return success(res, 200, "Status updated successfully", {
      complaint,
      reply: storedReply,
      statusDescription: getStatusDescription(newStatus),
    });
  } catch (error) {
    console.error("Staff status error:", error.message);
    return failure(res, 500, "Unable to update complaint status.", "INTERNAL_ERROR", error.message);
  }
});

router.patch("/complaints/:id/staff/handover", requireOfficerRole, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return failure(res, 404, "Complaint not found", "NOT_FOUND");
    }

    const currentOfficer = await resolveCurrentOfficer(req);
    if ((!currentOfficer || !currentOfficer.onDutyStatus)) {
      return failure(res, 403, "On-duty officer access required.", "OFFICER_OFF_DUTY");
    }

    const handoverStation = String(req.body?.handoverStation || req.body?.meetingPoint || complaint.recoveryStation || "").trim();
    const handoverTime = String(req.body?.handoverTime || complaint.meetingTime || "").trim();
    const previousStatus = complaint.status;

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

    emitSocketEvent("complaint:status-change", {
      complaintId: String(complaint._id),
      passengerId: complaint.passengerId,
      complaint: complaint.toObject ? complaint.toObject() : complaint,
      newStatus: complaint.status,
      previousStatus,
      actorRole: currentOfficer.dutyUnit || currentOfficer.staffRole,
      source: "staff-handover",
    });

    const storedReply = await persistComplaintReply({
      complaint,
      currentOfficer,
      message: `Handover arranged at ${handoverStation || "the next station"}`,
      statusUpdate: "Ready for Handover",
    });

    await logAction({
      action: "OFFICER_HANDOVER_ARRANGED",
      actorType: "OFFICER",
      actorId: currentOfficer.staffId || currentOfficer.staffEmail,
      actorRole: currentOfficer.dutyUnit || currentOfficer.staffRole,
      entityType: "Complaint",
      entityId: String(complaint._id),
      complaintId: complaint.complaintId || String(complaint._id),
      metadata: {
        replyId: storedReply?._id?.toString?.() || null,
        handoverStation: handoverStation || null,
        handoverTime: handoverTime || null,
      },
    });

    return success(res, 200, "Handover coordinated successfully", {
      complaint,
      reply: storedReply,
    });
  } catch (error) {
    console.error("Staff handover error:", error.message);
    return failure(res, 500, "Unable to coordinate handover.", "INTERNAL_ERROR", error.message);
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

    const complaint = await Complaint.findOne({ 
      $or: [
        { _id: complaintId, passengerEmail: userEmail },
        { complaintId: complaintId, passengerEmail: userEmail }
      ]
    });

    if (!complaint) {
      return failure(res, 404, "Complaint not found", "NOT_FOUND");
    }

    // Get all timeline messages
    const timelineMessages = (complaint.messages || []).map((msg) => ({
      id: `timeline-${msg.timestamp}`,
      type: "timeline",
      sender: msg.staffName || "Officer",
      senderRole: "Officer",
      text: msg.text,
      attachmentUrl: msg.attachmentUrl || null,
      messageType: msg.messageType || (msg.attachmentUrl ? "image" : "text"),
      timestamp: msg.timestamp,
      isOfficer: true,
      isInternalNote: msg.isInternalNote || false,
    }));

    // Get all complaint replies visible to passenger
    const complaintReplies = await ComplaintReply.find({
      complaintId: complaint._id,
      visibleToPassenger: true,
    }).sort({ repliedAt: 1 });

    const replyMessages = complaintReplies.map((reply) => ({
      id: reply._id.toString(),
      type: reply.messageType || "officer-reply",
      sender: reply.officerName || "Officer",
      senderRole: reply.officerRole,
      text: reply.message,
      attachmentUrl: reply.attachmentUrl || null,
      messageType: reply.messageType || (reply.attachmentUrl ? "image" : "text"),
      timestamp: reply.repliedAt,
      isOfficer: true,
    }));

    // Merge and sort all messages
    const allMessages = [...timelineMessages.filter(m => !m.isInternalNote), ...replyMessages]
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    return success(res, 200, "Messages retrieved successfully", {
      complaintId: complaint._id,
      staffName: complaint.staffName,
      staffRole: complaint.assignedRole,
      status: complaint.status,
      messages: allMessages,
      total: allMessages.length,
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return failure(res, 500, "Error fetching messages", "INTERNAL_ERROR", error.message);
  }
});

// POST /api/passenger/messages/:complaintId - Passenger sends message
router.post("/messages/:complaintId", async (req, res) => {
  try {
    const complaintId = req.params.complaintId;
    const userEmail = getUserEmail(req);
    const { text, attachmentUrl = null, messageType = null, attachmentName = null } = req.body || {};

    if ((!text || !String(text).trim()) && !attachmentUrl) {
      return failure(res, 400, "Message text or attachment required", "VALIDATION_ERROR");
    }

    const complaint = await Complaint.findOne({
      $or: [
        { _id: complaintId, passengerEmail: userEmail },
        { complaintId: complaintId, passengerEmail: userEmail }
      ]
    });

    if (!complaint) {
      return failure(res, 404, "Complaint not found", "NOT_FOUND");
    }

    // Add to complaint timeline
    const newMessage = {
      staffId: "passenger",
      staffName: "Passenger",
      text: text ? String(text).trim() : "",
      attachmentUrl: attachmentUrl || null,
      attachmentName: attachmentName || null,
      messageType: messageType || (attachmentUrl ? "image" : "text"),
      timestamp: new Date(),
      isPassengerMessage: true,
    };

    complaint.messages.push(newMessage);
    await complaint.save();

    // Create complaint reply record for conversation log
    const passengerReply = await ComplaintReply.create({
      complaintId: complaint._id,
      officerId: "passenger",
      officerName: complaint.passengerName,
      officerRole: "Passenger",
      message: text ? String(text).trim() : attachmentName || "Attachment",
      statusUpdate: complaint.status,
      visibleToPassenger: true,
      messageType: messageType || (attachmentUrl ? "image" : "passenger-message"),
      attachmentUrl: attachmentUrl || null,
      repliedAt: new Date(),
    });

    // Emit socket events for real-time update
    emitSocketEvent("passenger:message", {
      complaintId: String(complaint._id),
      passengerId: complaint.passengerId,
      senderName: complaint.passengerName,
      senderRole: "Passenger",
      messageText: String(text).trim(),
      attachmentUrl: attachmentUrl || null,
      messageType: messageType || (attachmentUrl ? "image" : "text"),
      message: passengerReply ? (passengerReply.toObject ? passengerReply.toObject() : passengerReply) : null,
      source: "passenger-message",
    });

    // Notify assigned officer
    emitSocketEvent("complaint:new-message", {
      complaintId: String(complaint._id),
      passengerId: complaint.passengerId,
      complaint: complaint.toObject ? complaint.toObject() : complaint,
      message: newMessage,
      messageCount: complaint.messages.length,
      source: "passenger-message",
    });

    return success(res, 200, "Message sent successfully", {
      complaint: complaint.toObject ? complaint.toObject() : complaint,
      message: passengerReply ? (passengerReply.toObject ? passengerReply.toObject() : passengerReply) : null,
    });
  } catch (error) {
    console.error("Error sending message:", error);
    return failure(res, 500, "Error sending message", "INTERNAL_ERROR", error.message);
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
    complaint.currentLat = numericLat;
    complaint.currentLng = numericLng;
    complaint.currentTrainLocation = complaint.currentTrainLocation || complaint.lastSeenLocation || complaint.fromLocation || complaint.boardingStation || null;
    complaint.status = "Accepted";
    complaint.staffNotified = true;
    complaint.acceptedAt = complaint.acceptedAt || new Date();
    complaint.assignedRole = complaint.assignedRole || complaint.assignedToUnit || null;
    complaint.assignedOfficerId = complaint.assignedOfficerId || complaint.staffId || null;
    complaint.assignedOfficerName = complaint.assignedOfficerName || complaint.staffName || null;

    await complaint.save();

    emitSocketEvent("complaint:location-update", {
      complaintId: String(complaint._id),
      passengerId: complaint.passengerId,
      complaint: complaint.toObject ? complaint.toObject() : complaint,
      sharedLocation: complaint.sharedLocation,
      source: "share-location",
    });

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
