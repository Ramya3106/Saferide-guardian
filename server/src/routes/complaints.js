const express = require("express");
const mongoose = require("mongoose");
const Complaint = require("../models/Complaint");
const ComplaintReply = require("../models/ComplaintReply");
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
  sortByPriority,
  getPriorityColor,
  getPriorityLabel,
} = require("../utils/priorityCalculator");

const router = express.Router();

// Utility functions
const getUserEmail = (req) => req.headers["x-user-email"] || "";

const getUserRole = (req) => {
  const role = req.headers["x-user-role"] || req.auth?.role || "";
  return String(role).trim();
};

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

  return null;
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

const syncCanonicalComplaintFields = (complaint, currentOfficer, { accepted = false } = {}) => {
  if (!complaint || !currentOfficer) {
    return;
  }

  const assignedRole = normalizeDutyUnit(
    currentOfficer.dutyUnit || currentOfficer.staffRole || inferDutyUnit(currentOfficer),
  ) || null;

  complaint.assignedRole = assignedRole || complaint.assignedRole || null;
  complaint.assignedOfficerId = currentOfficer.staffId || complaint.assignedOfficerId || null;
  complaint.assignedOfficerName = currentOfficer.staffName || complaint.assignedOfficerName || null;

  if (accepted || String(complaint.status || "").toLowerCase() === "accepted") {
    complaint.acceptedAt = complaint.acceptedAt || new Date();
  }

  if (!complaint.escalationLevel) {
    complaint.escalationLevel = complaint.dispatchMode || null;
  }
};

const generateComplaintId = () => `CRN-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

// POST /api/complaints - Create a new complaint
router.post("/", async (req, res) => {
  try {
    const userEmail = getUserEmail(req);
    if (!userEmail) {
      return failure(res, 400, "User email required", "VALIDATION_ERROR");
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
      trainNumber,
      boardingStation,
      destinationStation,
      coachNumber,
      berthNumber,
      lostItemType,
      imageUrl,
      lossTime,
      urgencyLevel,
    } = req.body;

    // Support both formats (passenger-style and legacy train-style)
    const finalTransportType = transportType || "train";
    const finalVehicleNumber = vehicleNumber || trainNumber;
    const finalItemType = itemType || lostItemType;
    const finalDescription = description;
    const finalPhotoUri = photoUri || imageUrl;
    const finalFromLocation = fromLocation || boardingStation;
    const finalToLocation = toLocation || destinationStation;
    const finalTimestamp = timestamp || lossTime || new Date();

    if (!finalVehicleNumber || !finalItemType || !finalDescription) {
      return failure(res, 400, "Missing required fields", "VALIDATION_ERROR");
    }

    const complaintId = generateComplaintId();
    const qrCode = `QR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const priority = detectPriority({ transportType: finalTransportType, itemType: finalItemType, description: finalDescription });
    const assignedStaff = [];

    const complaint = new Complaint({
      passengerId: userEmail,
      passengerEmail: userEmail,
      passengerName: req.headers["x-user-name"] || "Passenger",
      transportType: finalTransportType,
      vehicleNumber: finalVehicleNumber,
      trainNumber: finalVehicleNumber,
      itemType: finalItemType,
      lostItemType: finalItemType,
      description: finalDescription,
      photoUri: finalPhotoUri || null,
      imageUrl: finalPhotoUri || null,
      fromLocation: finalFromLocation || "",
      toLocation: finalToLocation || "",
      boardingStation: finalFromLocation || "",
      destinationStation: finalToLocation || "",
      coachNumber: coachNumber || null,
      berthNumber: berthNumber || null,
      departureTime: departureTime || "",
      arrivalTime: arrivalTime || "",
      lastSeenLocation: lastSeenLocation || finalFromLocation || "Unknown",
      timestamp: finalTimestamp,
      lossTime: finalTimestamp,
      journeyId: journeyId || null,
      route: route || `${finalFromLocation} → ${finalToLocation}`,
      complaintId,
      qrCode,
      status: "Submitted",
      priority,
      assignedStaff,
      urgencyLevel: urgencyLevel || priority,
      submitAuthority: submitAuthority || "TTR / TTE / RPF / Police",
      alertPriorityReason:
        priority === "Critical"
          ? "Critical lost-item escalation"
          : priority === "High"
            ? "High priority lost-item report"
            : "Standard lost-item report",
      dispatchMode: assignedStaff.length > 0 ? "On-duty dispatch" : "Unassigned fallback",
    });

    const savedComplaint = await complaint.save();

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
    savedComplaint.staffName = routedOfficers[0]?.staffName || submitAuthority || null;
    savedComplaint.assignedToUnit = routedOfficers.length > 0 ? (routedOfficers[0]?.dutyUnit || null) : null;
    savedComplaint.assignedRole = routedOfficers.length > 0 ? (routedOfficers[0]?.dutyUnit === "POLICE" ? "Police" : routedOfficers[0]?.dutyUnit || null) : null;
    savedComplaint.assignedOfficerId = routedOfficers[0]?.staffId || null;
    savedComplaint.assignedOfficerName = routedOfficers[0]?.staffName || submitAuthority || null;
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

    await savedComplaint.save();

    const complaintSnapshot = savedComplaint.toObject ? savedComplaint.toObject() : savedComplaint;
    // Targeted socket notifications: notify only routed officers' rooms + passenger/complaint rooms
    const io = require("../utils/socket").getIo();
    const payload = {
      complaintId: String(savedComplaint._id),
      complaint: complaintSnapshot,
      routedOfficers,
      queueNotifications,
      assignmentStrategy: routingResult?.assignmentStrategy || null,
      escalationLevel: routingResult?.escalationLevel || null,
    };

    if (io && Array.isArray(routedOfficers) && routedOfficers.length > 0) {
      // Emit to each officer's room by staffId and staffEmail if available
      routedOfficers.forEach((off) => {
        const targets = [];
        if (off.staffId) targets.push(`officer:${String(off.staffId)}`);
        if (off.staffEmail) targets.push(`officer:${String(off.staffEmail)}`);
        targets.forEach((room) => {
          try { io.to(room).emit("complaint:new", payload); } catch (e) { /* ignore */ }
        });
      });
      // Also notify passenger and complaint rooms
      try { io.to(`passenger:${String(savedComplaint.passengerEmail)}`).emit("complaint:new", payload); } catch (e) { }
      try { io.to(`complaint:${String(savedComplaint._id)}`).emit("complaint:new", payload); } catch (e) { }
    } else {
      // Fallback to global emit (no routed officers)
      emitSocketEvent("complaint:new", payload);
    }

    if (queueNotifications.length > 0) {
      const escPayload = {
        complaintId: String(savedComplaint._id),
        complaint: complaintSnapshot,
        escalationLevel: "UNASSIGNED_URGENT_QUEUE",
        routingReason: routingResult?.routingReason || "Queued for supervisor review",
        queueNotifications,
      };
      const io = require("../utils/socket").getIo();
      if (io) {
        try { io.to(`passenger:${String(savedComplaint.passengerEmail)}`).emit("complaint:escalation", escPayload); } catch(e){}
        try { io.to(`complaint:${String(savedComplaint._id)}`).emit("complaint:escalation", escPayload); } catch(e){}
      } else {
        emitSocketEvent("complaint:escalation", escPayload);
      }
    } else if (routingResult?.escalationLevel && routingResult.escalationLevel !== "TRAIN_LEVEL") {
      const escPayload = {
        complaintId: String(savedComplaint._id),
        complaint: complaintSnapshot,
        escalationLevel: routingResult.escalationLevel,
        routingReason: routingResult?.routingReason || null,
        routedOfficers,
      };
      const io = require("../utils/socket").getIo();
      if (io && Array.isArray(routedOfficers) && routedOfficers.length > 0) {
        routedOfficers.forEach((off) => {
          const targets = [];
          if (off.staffId) targets.push(`officer:${String(off.staffId)}`);
          if (off.staffEmail) targets.push(`officer:${String(off.staffEmail)}`);
          targets.forEach((room) => {
            try { io.to(room).emit("complaint:escalation", escPayload); } catch (e) { }
          });
        });
        try { io.to(`passenger:${String(savedComplaint.passengerEmail)}`).emit("complaint:escalation", escPayload); } catch(e){}
        try { io.to(`complaint:${String(savedComplaint._id)}`).emit("complaint:escalation", escPayload); } catch(e){}
      } else {
        emitSocketEvent("complaint:escalation", escPayload);
      }
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
    console.error("Error creating complaint:", error?.message);
    return failure(res, 500, "Error creating complaint", "INTERNAL_ERROR", error?.message);
  }
});

// GET /api/complaints/passenger/:passengerId - Get complaints for specific passenger
router.get("/passenger/:passengerId", async (req, res) => {
  try {
    const { passengerId } = req.params;
    const complaints = await Complaint.find({ passengerEmail: passengerId }).sort({ createdAt: -1 });

    return success(res, 200, "Complaints retrieved successfully", {
      passengerId,
      complaints,
      total: complaints.length
    });
  } catch (error) {
    return failure(res, 500, "Failed to fetch passenger complaints", "INTERNAL_ERROR", error.message);
  }
});

// GET /api/complaints/officer/:officerId - Get complaints assigned to officer
router.get("/officer/:officerId", requireOfficerRole, async (req, res) => {
  try {
    const { officerId } = req.params;
    const officerObjectId = mongoose.Types.ObjectId.isValid(officerId) ? new mongoose.Types.ObjectId(officerId) : null;

    const query = {
      $or: [
        ...(officerObjectId ? [{ assignedTo: officerObjectId }] : []),
        { staffId: String(officerId) },
        { "assignedStaff.staffId": String(officerId) },
      ],
    };

    const complaints = await Complaint.find(query).exec();
    
    // Sort by priority (Critical/High first), then by date
    const sortedComplaints = sortByPriority(complaints);

    // Add priority metadata for UI display
    const complaintsWithMetadata = sortedComplaints.map((complaint) => {
      const complaintObj =
        complaint.toObject ? complaint.toObject() : complaint;
      return {
        ...complaintObj,
        priorityColor: getPriorityColor(complaint.priority),
        priorityLabel: getPriorityLabel(complaint.priority),
        priorityReason: complaint.alertPriorityReason,
      };
    });

    return success(res, 200, "Complaints retrieved successfully", {
      officerId,
      complaints: complaintsWithMetadata,
      total: complaintsWithMetadata.length,
    });
  } catch (error) {
    return failure(
      res,
      500,
      "Failed to fetch officer complaints",
      "INTERNAL_ERROR",
      error.message
    );
  }
});

// GET /api/complaints/:id - Get specific complaint
router.get("/:id", async (req, res) => {
  try {
    const complaintId = req.params.id;

    const complaint = await Complaint.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(complaintId) ? new mongoose.Types.ObjectId(complaintId) : null },
        { complaintId },
      ],
    });

    if (!complaint) {
      return failure(res, 404, "Complaint not found", "NOT_FOUND");
    }

    return success(res, 200, "Complaint retrieved successfully", {
      complaint
    });
  } catch (error) {
    return failure(res, 500, "Failed to fetch complaint", "INTERNAL_ERROR", error.message);
  }
});
// POST /api/complaints/:id/staff/respond - Officer responds to complaint
router.post("/:id/staff/respond", requireOfficerRole, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return failure(res, 404, "Complaint not found", "NOT_FOUND");
    }

    const currentOfficer = await resolveCurrentOfficer(req);
    if (!currentOfficer || !currentOfficer.onDutyStatus || !complaintMatchesOfficer(complaint, currentOfficer)) {
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
    syncCanonicalComplaintFields(complaint, currentOfficer);
    await complaint.save();

    const storedReply = await persistComplaintReply({
      complaint,
      currentOfficer,
      message: text,
      statusUpdate: complaint.status,
    });

    // Also store passenger-visible message
    const passengerMessage = await ComplaintReply.create({
      complaintId: complaint._id,
      officerId: currentOfficer.staffId || currentOfficer.staffEmail,
      officerName: currentOfficer.staffName,
      officerRole: currentOfficer.dutyUnit || "TTR",
      message: text,
      statusUpdate: complaint.status,
      visibleToPassenger: true,
      messageType: "officer-reply",
      repliedAt: new Date(),
    });

    emitSocketEvent("complaint:reply", {
      complaintId: String(complaint._id),
      passengerId: complaint.passengerId,
      complaint: complaint.toObject ? complaint.toObject() : complaint,
      reply: storedReply ? (storedReply.toObject ? storedReply.toObject() : storedReply) : null,
      actorRole: currentOfficer.dutyUnit || currentOfficer.staffRole,
      source: "officer-response",
    });

    emitSocketEvent("complaint:status-change", {
      complaintId: String(complaint._id),
      passengerId: complaint.passengerId,
      complaint: complaint.toObject ? complaint.toObject() : complaint,
      previousStatus,
      newStatus: complaint.status,
      actorRole: currentOfficer.dutyUnit || currentOfficer.staffRole,
      source: "officer-response",
    });

    // Send passenger notification with officer's message
    emitSocketEvent("passenger:message", {
      complaintId: String(complaint._id),
      passengerId: complaint.passengerId,
      message: passengerMessage ? (passengerMessage.toObject ? passengerMessage.toObject() : passengerMessage) : null,
      senderName: currentOfficer.staffName,
      senderRole: currentOfficer.dutyUnit || currentOfficer.staffRole,
      messageText: text,
      source: "officer-reply",
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
      passengerMessage,
    });
  } catch (error) {
    console.error("Staff respond error:", error.message);
    return failure(res, 500, "Unable to save reply.", "INTERNAL_ERROR", error.message);
  }
});

// PATCH /api/complaints/:id/staff/acknowledge - Officer acknowledges complaint
router.patch("/:id/staff/acknowledge", requireOfficerRole, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return failure(res, 404, "Complaint not found", "NOT_FOUND");
    }

    const currentOfficer = await resolveCurrentOfficer(req);
    if (!currentOfficer || !currentOfficer.onDutyStatus || !complaintMatchesOfficer(complaint, currentOfficer)) {
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

    syncCanonicalComplaintFields(complaint, currentOfficer, { accepted: isAcknowledged });

    await complaint.save();

    emitSocketEvent("complaint:accepted", {
      complaintId: String(complaint._id),
      passengerId: complaint.passengerId,
      complaint: complaint.toObject ? complaint.toObject() : complaint,
      acceptedAt: complaint.acknowledgedAt || new Date(),
      actorRole: currentOfficer.dutyUnit || currentOfficer.staffRole,
      source: isAcknowledged ? "officer-acknowledge" : "officer-seen",
    });

    emitSocketEvent("complaint:status-change", {
      complaintId: String(complaint._id),
      passengerId: complaint.passengerId,
      complaint: complaint.toObject ? complaint.toObject() : complaint,
      previousStatus,
      newStatus,
      actorRole: currentOfficer.dutyUnit || currentOfficer.staffRole,
      source: isAcknowledged ? "officer-acknowledge" : "officer-seen",
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

// PATCH /api/complaints/:id/staff/status - Officer updates complaint status
router.patch("/:id/staff/status", requireOfficerRole, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return failure(res, 404, "Complaint not found", "NOT_FOUND");
    }

    const currentOfficer = await resolveCurrentOfficer(req);
    if (!currentOfficer || !currentOfficer.onDutyStatus || !complaintMatchesOfficer(complaint, currentOfficer)) {
      return failure(res, 403, "On-duty officer access required.", "OFFICER_OFF_DUTY");
    }

    const newStatus = String(req.body?.status || "").trim();
    if (!newStatus) {
      return failure(res, 400, "Status required", "VALIDATION_ERROR");
    }

    const previousStatus = complaint.status;

    // Validate status transition
    if (!isValidStatusTransition(complaint.status, newStatus)) {
      const validNextStatuses = getValidNextStatuses(complaint.status);
      return failure(
        res,
        400,
        `Cannot transition from "${complaint.status}" to "${newStatus}"`,
        "INVALID_STATUS_TRANSITION",
        {
          currentStatus: complaint.status,
          requestedStatus: newStatus,
          validNextStatuses,
        }
      );
    }

    complaint.status = newStatus;
    complaint.itemFound = Boolean(req.body?.itemFound ?? complaint.itemFound);
    complaint.meetingScheduled = Boolean(req.body?.meetingScheduled ?? complaint.meetingScheduled);
    complaint.meetingPoint = req.body?.meetingPoint || complaint.meetingPoint || null;
    complaint.meetingTime = req.body?.meetingTime || complaint.meetingTime || null;
    complaint.staffEta = req.body?.staffEta || complaint.staffEta || null;
    complaint.recoveryStation = req.body?.recoveryStation || complaint.recoveryStation || null;
    complaint.recoveryNotes = req.body?.recoveryNotes || complaint.recoveryNotes || null;
    complaint.staffResponseStatus = `Status updated to ${newStatus}`;
    complaint.messages = complaint.messages || [];
    complaint.messages.push(
      staffTimelineEntry(currentOfficer.staffName, `Status changed to ${newStatus}`, currentOfficer),
    );
    syncCanonicalComplaintFields(complaint, currentOfficer, { accepted: newStatus === "Accepted" });
    await complaint.save();

    emitSocketEvent("complaint:status-change", {
      complaintId: String(complaint._id),
      passengerId: complaint.passengerId,
      complaint: complaint.toObject ? complaint.toObject() : complaint,
      newStatus,
      previousStatus,
      actorRole: currentOfficer.dutyUnit || currentOfficer.staffRole,
      source: "officer-status",
    });

    if (/ready for handover|item found|passenger contacted|closed/i.test(newStatus)) {
      emitSocketEvent("complaint:escalation", {
        complaintId: String(complaint._id),
        passengerId: complaint.passengerId,
        complaint: complaint.toObject ? complaint.toObject() : complaint,
        escalationLevel: complaint.escalationLevel || newStatus,
        routingReason: complaint.staffResponseStatus || `Status updated to ${newStatus}`,
        actorRole: currentOfficer.dutyUnit || currentOfficer.staffRole,
        source: "officer-status",
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

// PATCH /api/complaints/:id/staff/handover - Officer arranges handover
router.patch("/:id/staff/handover", requireOfficerRole, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return failure(res, 404, "Complaint not found", "NOT_FOUND");
    }

    const currentOfficer = await resolveCurrentOfficer(req);
    if (!currentOfficer || !currentOfficer.onDutyStatus || !complaintMatchesOfficer(complaint, currentOfficer)) {
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
    complaint.staffResponseStatus = `Handover arranged at ${handoverStation || "next station"}`;
    complaint.messages = complaint.messages || [];
    complaint.messages.push(
      staffTimelineEntry(currentOfficer.staffName, `Handover arranged at ${handoverStation || "the next station"}`, currentOfficer),
    );
    syncCanonicalComplaintFields(complaint, currentOfficer);
    await complaint.save();

    emitSocketEvent("complaint:status-change", {
      complaintId: String(complaint._id),
      passengerId: complaint.passengerId,
      complaint: complaint.toObject ? complaint.toObject() : complaint,
      newStatus: complaint.status,
      previousStatus,
      actorRole: currentOfficer.dutyUnit || currentOfficer.staffRole,
      source: "officer-handover",
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

// PATCH /api/complaints/:id/staff/accept - Officer accepts complaint
router.patch("/:id/staff/accept", requireOfficerRole, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return failure(res, 404, "Complaint not found", "NOT_FOUND");
    }

    const currentOfficer = await resolveCurrentOfficer(req);
    if (!currentOfficer || !currentOfficer.onDutyStatus || !complaintMatchesOfficer(complaint, currentOfficer)) {
      return failure(res, 403, "On-duty officer access required.", "OFFICER_OFF_DUTY");
    }

    const previousStatus = complaint.status;
    complaint.status = "Accepted";
    complaint.acceptedAt = complaint.acceptedAt || new Date();
    complaint.staffResponseStatus = "Complaint accepted by officer";
    complaint.messages = complaint.messages || [];
    complaint.messages.push(
      staffTimelineEntry(currentOfficer.staffName, "Complaint accepted", currentOfficer),
    );
    
    // Reset auto-escalation timer (prevent further escalation once accepted)
    complaint.autoEscalationTimer = {
      timeoutMs: 300000,
      startedAt: new Date(),
      escalatedAt: null,
    };
    
    syncCanonicalComplaintFields(complaint, currentOfficer, { accepted: true });
    await complaint.save();

    const storedReply = await persistComplaintReply({
      complaint,
      currentOfficer,
      message: "Complaint accepted",
      statusUpdate: "Accepted",
    });

    // Create passenger-facing chat/system message and emit detailed payload including officer info
    const ChatMessage = require('../models/ChatMessage');
    const passengerChat = await ChatMessage.create({
      complaintId: complaint._id,
      senderType: 'OFFICER',
      senderId: currentOfficer.staffId || currentOfficer.staffEmail,
      senderName: currentOfficer.staffName,
      senderRole: currentOfficer.dutyUnit || currentOfficer.staffRole || 'TTR',
      messageText: `Your complaint has been accepted by ${currentOfficer.dutyUnit || currentOfficer.staffRole || 'TTR'} officer ${currentOfficer.staffName}. We are investigating your case.`,
      messageType: 'system',
      createdAt: new Date(),
    });

    const officerDetails = {
      name: currentOfficer.staffName || null,
      role: currentOfficer.dutyUnit || currentOfficer.staffRole || null,
      dutyCoach: currentOfficer.assignedTrain || currentOfficer.assignedStation || currentOfficer.assignedShift || null,
      currentLocation: currentOfficer.liveLocationSnapshot || currentOfficer.currentLocation || null,
    };

    emitSocketEvent('complaint:accepted', {
      complaintId: String(complaint._id),
      passengerId: complaint.passengerId,
      complaint: complaint.toObject ? complaint.toObject() : complaint,
      acceptedAt: complaint.acceptedAt,
      actorRole: currentOfficer.dutyUnit || currentOfficer.staffRole,
      source: 'officer-accept',
      officer: officerDetails,
    });

    emitSocketEvent('complaint:status-change', {
      complaintId: String(complaint._id),
      passengerId: complaint.passengerId,
      complaint: complaint.toObject ? complaint.toObject() : complaint,
      previousStatus,
      newStatus: 'Accepted',
      actorRole: currentOfficer.dutyUnit || currentOfficer.staffRole,
      source: 'officer-accept',
      officer: officerDetails,
    });

    // Send passenger chat message event with officer details
    emitSocketEvent('passenger:message', {
      complaintId: String(complaint._id),
      passengerId: complaint.passengerId,
      message: passengerChat.toObject ? passengerChat.toObject() : passengerChat,
      senderName: currentOfficer.staffName,
      senderRole: currentOfficer.dutyUnit || currentOfficer.staffRole,
      officer: officerDetails,
      messageText: passengerChat.messageText,
      source: 'officer-accept',
    });

    await logAction({
      action: "OFFICER_ACCEPTED_COMPLAINT",
      actorType: "OFFICER",
      actorId: currentOfficer.staffId || currentOfficer.staffEmail,
      actorRole: currentOfficer.dutyUnit || currentOfficer.staffRole,
      entityType: "Complaint",
      entityId: String(complaint._id),
      complaintId: complaint.complaintId || String(complaint._id),
      metadata: {
        replyId: storedReply?._id?.toString?.() || null,
        acceptedAt: complaint.acceptedAt,
      },
    });

    return success(res, 200, "Complaint accepted successfully", {
      complaint,
      reply: storedReply,
      passengerNotification,
    });
  } catch (error) {
    console.error("Staff accept error:", error.message);
    return failure(res, 500, "Unable to accept complaint.", "INTERNAL_ERROR", error.message);
  }
});


// POST /api/complaints/:id/chat - Create a chat message for a complaint (passenger or officer)
router.post("/:id/chat", async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return failure(res, 404, "Complaint not found", "NOT_FOUND");

    const ChatMessage = require("../models/ChatMessage");
    const passengerEmail = String(req.headers["x-user-email"] || req.body?.passengerEmail || "").trim().toLowerCase();

    // Try to resolve officer identity
    const currentOfficer = await resolveCurrentOfficer(req).catch(() => null);
    let senderType = "PASSENGER";
    let senderId = passengerEmail || null;
    let senderName = req.body?.senderName || req.headers["x-user-name"] || null;
    let senderRole = null;

    if (currentOfficer && currentOfficer.onDutyStatus && complaintMatchesOfficer(complaint, currentOfficer)) {
      senderType = "OFFICER";
      senderId = currentOfficer.staffId || currentOfficer.staffEmail || senderId;
      senderName = currentOfficer.staffName || senderName;
      senderRole = currentOfficer.dutyUnit || currentOfficer.staffRole || null;
    }

    const { messageText, messageType = "text", attachmentUrl = null, quickReplyKey = null, visibleToPassenger = true } = req.body || {};
    if (!messageText && !attachmentUrl) {
      return failure(res, 400, "Message text or attachment required", "VALIDATION_ERROR");
    }

    const msg = await ChatMessage.create({
      complaintId: complaint._id,
      senderType,
      senderId: String(senderId || ""),
      senderName: String(senderName || ""),
      senderRole: senderRole || null,
      messageText: messageText || null,
      messageType: messageType || (attachmentUrl ? "image" : "text"),
      attachmentUrl: attachmentUrl || null,
      quickReplyKey: quickReplyKey || null,
      createdAt: new Date(),
    });

    // Emit message to complaint room and passenger/officer rooms
    const io = require("../utils/socket").getIo();
    const payload = {
      complaintId: String(complaint._id),
      message: msg.toObject ? msg.toObject() : msg,
      senderType,
      senderId,
      senderName,
      senderRole,
      messageText: msg.messageText,
      messageType: msg.messageType,
      attachmentUrl: msg.attachmentUrl,
      quickReplyKey: msg.quickReplyKey,
    };

    // Notify complaint room
    if (io) {
      try { io.to(`complaint:${String(complaint._id)}`).emit("chat:message", payload); } catch (e) { }
      // Notify passenger
      try { io.to(`passenger:${String(complaint.passengerEmail)}`).emit("chat:message", payload); } catch (e) { }
      // Notify assigned officers
      if (Array.isArray(complaint.assignedStaff)) {
        complaint.assignedStaff.forEach((entry) => {
          const targets = [];
          if (entry.staffId) targets.push(`officer:${String(entry.staffId)}`);
          if (entry.staffEmail) targets.push(`officer:${String(entry.staffEmail)}`);
          targets.forEach((room) => { try { io.to(room).emit("chat:message", payload); } catch(e){} });
        });
      }
    } else {
      // Fallback: use emitSocketEvent to attempt broadcast
      emitSocketEvent("chat:message", payload);
    }

    return success(res, 201, "Message created", { message: msg });
  } catch (error) {
    console.error("Create chat message error:", error.message);
    return failure(res, 500, "Unable to send message", "INTERNAL_ERROR", error.message);
  }
});


// GET /api/complaints/:id/location - Get live location data (officer + train) and ETA
router.get("/:id/location", async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return failure(res, 404, "Complaint not found", "NOT_FOUND");

    const LiveLocation = require("../models/LiveLocation");

    // Find latest live locations for officers assigned to this complaint
    const assigned = Array.isArray(complaint.assignedStaff) ? complaint.assignedStaff : [];
    const officerKeys = assigned.map((a) => (a.staffId || a.staffEmail || null)).filter(Boolean);

    const officerLocations = [];
    if (officerKeys.length > 0) {
      const latest = await Promise.all(
        officerKeys.map(async (key) => {
          const loc = await LiveLocation.findOne({ officerKey: String(key) }).sort({ recordedAt: -1 }).lean();
          return loc || null;
        }),
      );
      latest.forEach((l) => { if (l) officerLocations.push(l); });
    }

    // For train-level info, try to find latest LiveLocation by trainNumber
    const trainNumber = complaint.trainNumber || complaint.vehicleNumber || null;
    let trainLocation = null;
    if (trainNumber) {
      trainLocation = await LiveLocation.findOne({ trainNumber: String(trainNumber) }).sort({ recordedAt: -1 }).lean();
    }

    // Compute ETA to complaint.lastSeenLocation if coordinates available
    const getCoordsFromComplaint = (c) => {
      if (!c) return null;
      if (c.sharedLocation && c.sharedLocation.latitude && c.sharedLocation.longitude) return { latitude: c.sharedLocation.latitude, longitude: c.sharedLocation.longitude };
      if (c.currentLat && c.currentLng) return { latitude: c.currentLat, longitude: c.currentLng };
      return null;
    };

    const targetCoords = getCoordsFromComplaint(complaint) || getCoordsFromComplaint({ currentLat: complaint.currentLat, currentLng: complaint.currentLng });

    const haversine = (from, to) => {
      if (!from || !to) return null;
      const toRad = (v) => (v * Math.PI) / 180;
      const R = 6371; // km
      const dLat = toRad(to.latitude - from.latitude);
      const dLon = toRad(to.longitude - from.longitude);
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(toRad(from.latitude)) * Math.cos(toRad(to.latitude)) * Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c; // km
    };

    const estimates = officerLocations.map((loc) => {
      const distanceKm = targetCoords ? haversine({ latitude: loc.latitude, longitude: loc.longitude }, targetCoords) : null;
      const speedKmh = (loc.speed && Number.isFinite(loc.speed)) ? (Number(loc.speed) * 3.6) : 30; // assume 30 km/h if not provided
      const etaMin = distanceKm && speedKmh ? Math.round((distanceKm / speedKmh) * 60) : null;
      return { officerKey: loc.officerKey, latitude: loc.latitude, longitude: loc.longitude, recordedAt: loc.recordedAt, distanceKm, etaMin };
    });

    return success(res, 200, "Live location data", {
      complaintId: String(complaint._id),
      status: complaint.status,
      staffEta: complaint.staffEta || null,
      staffResponseStatus: complaint.staffResponseStatus || null,
      sharedLocation: complaint.sharedLocation || null,
      trainLocation,
      officerLocations: estimates,
      targetCoords,
    });
  } catch (error) {
    console.error("Get location data error:", error.message);
    return failure(res, 500, "Unable to fetch location data", "INTERNAL_ERROR", error.message);
  }
});

// PATCH /api/complaints/:id/staff/start-investigation - Officer starts investigation
router.patch("/:id/staff/start-investigation", requireOfficerRole, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return failure(res, 404, "Complaint not found", "NOT_FOUND");
    }

    const currentOfficer = await resolveCurrentOfficer(req);
    if (!currentOfficer || !currentOfficer.onDutyStatus || !complaintMatchesOfficer(complaint, currentOfficer)) {
      return failure(res, 403, "On-duty officer access required.", "OFFICER_OFF_DUTY");
    }

    const previousStatus = complaint.status;
    complaint.status = "Item Being Checked";
    complaint.staffResponseStatus = "Investigation in progress";
    complaint.investigationStartedAt = complaint.investigationStartedAt || new Date();
    complaint.messages = complaint.messages || [];
    complaint.messages.push(
      staffTimelineEntry(currentOfficer.staffName, "Investigation started", currentOfficer),
    );
    syncCanonicalComplaintFields(complaint, currentOfficer);
    await complaint.save();

    const storedReply = await persistComplaintReply({
      complaint,
      currentOfficer,
      message: "Investigation started - Item being checked",
      statusUpdate: "Item Being Checked",
    });

    emitSocketEvent("complaint:status-change", {
      complaintId: String(complaint._id),
      passengerId: complaint.passengerId,
      complaint: complaint.toObject ? complaint.toObject() : complaint,
      previousStatus,
      newStatus: "Item Being Checked",
      actorRole: currentOfficer.dutyUnit || currentOfficer.staffRole,
      source: "officer-start-investigation",
    });

    await logAction({
      action: "OFFICER_STARTED_INVESTIGATION",
      actorType: "OFFICER",
      actorId: currentOfficer.staffId || currentOfficer.staffEmail,
      actorRole: currentOfficer.dutyUnit || currentOfficer.staffRole,
      entityType: "Complaint",
      entityId: String(complaint._id),
      complaintId: complaint.complaintId || String(complaint._id),
      metadata: {
        replyId: storedReply?._id?.toString?.() || null,
        investigationStartedAt: complaint.investigationStartedAt,
      },
    });

    return success(res, 200, "Investigation started successfully", {
      complaint,
      reply: storedReply,
    });
  } catch (error) {
    console.error("Staff start investigation error:", error.message);
    return failure(res, 500, "Unable to start investigation.", "INTERNAL_ERROR", error.message);
  }
});

// POST /api/complaints/:id/staff/note - Officer adds internal note
router.post("/:id/staff/note", requireOfficerRole, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return failure(res, 404, "Complaint not found", "NOT_FOUND");
    }

    const currentOfficer = await resolveCurrentOfficer(req);
    if (!currentOfficer || !currentOfficer.onDutyStatus || !complaintMatchesOfficer(complaint, currentOfficer)) {
      return failure(res, 403, "On-duty officer access required.", "OFFICER_OFF_DUTY");
    }

    const noteText = String(req.body?.note || "").trim();
    if (!noteText) {
      return failure(res, 400, "Note text required", "VALIDATION_ERROR");
    }

    complaint.messages = complaint.messages || [];
    complaint.messages.push({
      staffId: currentOfficer.staffId,
      staffName: currentOfficer.staffName,
      text: `[INTERNAL NOTE] ${noteText}`,
      timestamp: new Date(),
      isInternalNote: true,
    });

    complaint.officerNotes = complaint.officerNotes ? `${complaint.officerNotes}\n\n[${new Date().toISOString()}] ${currentOfficer.staffName}: ${noteText}` : `[${new Date().toISOString()}] ${currentOfficer.staffName}: ${noteText}`;
    await complaint.save();

    emitSocketEvent("complaint:note-added", {
      complaintId: String(complaint._id),
      passengerId: complaint.passengerId,
      complaint: complaint.toObject ? complaint.toObject() : complaint,
      note: noteText,
      actorRole: currentOfficer.dutyUnit || currentOfficer.staffRole,
      source: "officer-note",
    });

    await logAction({
      action: "OFFICER_ADDED_INTERNAL_NOTE",
      actorType: "OFFICER",
      actorId: currentOfficer.staffId || currentOfficer.staffEmail,
      actorRole: currentOfficer.dutyUnit || currentOfficer.staffRole,
      entityType: "Complaint",
      entityId: String(complaint._id),
      complaintId: complaint.complaintId || String(complaint._id),
      metadata: {
        note: noteText,
      },
    });

    return success(res, 200, "Internal note added successfully", {
      complaint,
    });
  } catch (error) {
    console.error("Staff note error:", error.message);
    return failure(res, 500, "Unable to add note.", "INTERNAL_ERROR", error.message);
  }
});

// PATCH /api/complaints/:id/staff/escalate-rpf - Officer escalates to RPF
router.patch("/:id/staff/escalate-rpf", requireOfficerRole, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return failure(res, 404, "Complaint not found", "NOT_FOUND");
    }

    const currentOfficer = await resolveCurrentOfficer(req);
    if (!currentOfficer || !currentOfficer.onDutyStatus || !complaintMatchesOfficer(complaint, currentOfficer)) {
      return failure(res, 403, "On-duty officer access required.", "OFFICER_OFF_DUTY");
    }

    const previousStatus = complaint.status;
    complaint.status = "Item Being Checked";
    complaint.escalationLevel = "RPF";
    complaint.assignedRole = "RPF";
    complaint.staffResponseStatus = "Escalated to RPF for further investigation";
    complaint.messages = complaint.messages || [];
    complaint.messages.push(
      staffTimelineEntry(currentOfficer.staffName, "Escalated to Railway Police Force (RPF)", currentOfficer),
    );
    syncCanonicalComplaintFields(complaint, currentOfficer);
    await complaint.save();

    const storedReply = await persistComplaintReply({
      complaint,
      currentOfficer,
      message: "Case escalated to Railway Police Force (RPF)",
      statusUpdate: complaint.status,
    });

    emitSocketEvent("complaint:escalation", {
      complaintId: String(complaint._id),
      passengerId: complaint.passengerId,
      complaint: complaint.toObject ? complaint.toObject() : complaint,
      escalationLevel: "RPF",
      escalatedBy: currentOfficer.staffName,
      escalatedAt: new Date(),
      actorRole: currentOfficer.dutyUnit || currentOfficer.staffRole,
      source: "officer-escalate-rpf",
    });

    emitSocketEvent("complaint:status-change", {
      complaintId: String(complaint._id),
      passengerId: complaint.passengerId,
      complaint: complaint.toObject ? complaint.toObject() : complaint,
      previousStatus,
      newStatus: complaint.status,
      actorRole: currentOfficer.dutyUnit || currentOfficer.staffRole,
      source: "officer-escalate-rpf",
    });

    await logAction({
      action: "OFFICER_ESCALATED_TO_RPF",
      actorType: "OFFICER",
      actorId: currentOfficer.staffId || currentOfficer.staffEmail,
      actorRole: currentOfficer.dutyUnit || currentOfficer.staffRole,
      entityType: "Complaint",
      entityId: String(complaint._id),
      complaintId: complaint.complaintId || String(complaint._id),
      metadata: {
        replyId: storedReply?._id?.toString?.() || null,
        escalationLevel: "RPF",
        reason: req.body?.reason || null,
      },
    });

    return success(res, 200, "Complaint escalated to RPF successfully", {
      complaint,
      reply: storedReply,
    });
  } catch (error) {
    console.error("Staff escalate to RPF error:", error.message);
    return failure(res, 500, "Unable to escalate to RPF.", "INTERNAL_ERROR", error.message);
  }
});

// PATCH /api/complaints/:id/staff/escalate-police - Officer escalates to Police
router.patch("/:id/staff/escalate-police", requireOfficerRole, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return failure(res, 404, "Complaint not found", "NOT_FOUND");
    }

    const currentOfficer = await resolveCurrentOfficer(req);
    if (!currentOfficer || !currentOfficer.onDutyStatus || !complaintMatchesOfficer(complaint, currentOfficer)) {
      return failure(res, 403, "On-duty officer access required.", "OFFICER_OFF_DUTY");
    }

    const previousStatus = complaint.status;
    complaint.status = "Item Being Checked";
    complaint.escalationLevel = "Police";
    complaint.assignedRole = "Police";
    complaint.staffResponseStatus = "Escalated to Police for investigation";
    complaint.messages = complaint.messages || [];
    complaint.messages.push(
      staffTimelineEntry(currentOfficer.staffName, "Escalated to Police", currentOfficer),
    );
    syncCanonicalComplaintFields(complaint, currentOfficer);
    await complaint.save();

    const storedReply = await persistComplaintReply({
      complaint,
      currentOfficer,
      message: "Case escalated to Police",
      statusUpdate: complaint.status,
    });

    emitSocketEvent("complaint:escalation", {
      complaintId: String(complaint._id),
      passengerId: complaint.passengerId,
      complaint: complaint.toObject ? complaint.toObject() : complaint,
      escalationLevel: "Police",
      escalatedBy: currentOfficer.staffName,
      escalatedAt: new Date(),
      actorRole: currentOfficer.dutyUnit || currentOfficer.staffRole,
      source: "officer-escalate-police",
    });

    emitSocketEvent("complaint:status-change", {
      complaintId: String(complaint._id),
      passengerId: complaint.passengerId,
      complaint: complaint.toObject ? complaint.toObject() : complaint,
      previousStatus,
      newStatus: complaint.status,
      actorRole: currentOfficer.dutyUnit || currentOfficer.staffRole,
      source: "officer-escalate-police",
    });

    await logAction({
      action: "OFFICER_ESCALATED_TO_POLICE",
      actorType: "OFFICER",
      actorId: currentOfficer.staffId || currentOfficer.staffEmail,
      actorRole: currentOfficer.dutyUnit || currentOfficer.staffRole,
      entityType: "Complaint",
      entityId: String(complaint._id),
      complaintId: complaint.complaintId || String(complaint._id),
      metadata: {
        replyId: storedReply?._id?.toString?.() || null,
        escalationLevel: "Police",
        reason: req.body?.reason || null,
      },
    });

    return success(res, 200, "Complaint escalated to Police successfully", {
      complaint,
      reply: storedReply,
    });
  } catch (error) {
    console.error("Staff escalate to Police error:", error.message);
    return failure(res, 500, "Unable to escalate to Police.", "INTERNAL_ERROR", error.message);
  }
});

// PATCH /api/complaints/:id/staff/reassign - Officer reassigns complaint
router.patch("/:id/staff/reassign", requireOfficerRole, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return failure(res, 404, "Complaint not found", "NOT_FOUND");
    }

    const currentOfficer = await resolveCurrentOfficer(req);
    if (!currentOfficer || !currentOfficer.onDutyStatus || !complaintMatchesOfficer(complaint, currentOfficer)) {
      return failure(res, 403, "On-duty officer access required.", "OFFICER_OFF_DUTY");
    }

    const assignToUnit = String(req.body?.assignToUnit || "").trim().toUpperCase();
    const reason = String(req.body?.reason || "Reassigned").trim();

    if (!["TTR", "TTE", "RPF", "POLICE"].includes(assignToUnit)) {
      return failure(res, 400, "Invalid unit for reassignment", "VALIDATION_ERROR");
    }

    complaint.messages = complaint.messages || [];
    complaint.messages.push(
      staffTimelineEntry(currentOfficer.staffName, `Reassigned from ${currentOfficer.dutyUnit || "current unit"} to ${assignToUnit}. Reason: ${reason}`, currentOfficer),
    );
    complaint.staffResponseStatus = `Reassigned to ${assignToUnit}`;
    complaint.assignedRole = assignToUnit;
    await complaint.save();

    emitSocketEvent("complaint:reassigned", {
      complaintId: String(complaint._id),
      passengerId: complaint.passengerId,
      complaint: complaint.toObject ? complaint.toObject() : complaint,
      reassignedFrom: currentOfficer.dutyUnit || currentOfficer.staffRole,
      reassignedTo: assignToUnit,
      reason,
      reassignedBy: currentOfficer.staffName,
      reassignedAt: new Date(),
      source: "officer-reassign",
    });

    await logAction({
      action: "OFFICER_REASSIGNED_COMPLAINT",
      actorType: "OFFICER",
      actorId: currentOfficer.staffId || currentOfficer.staffEmail,
      actorRole: currentOfficer.dutyUnit || currentOfficer.staffRole,
      entityType: "Complaint",
      entityId: String(complaint._id),
      complaintId: complaint.complaintId || String(complaint._id),
      metadata: {
        reassignedFrom: currentOfficer.dutyUnit,
        reassignedTo: assignToUnit,
        reason,
      },
    });

    return success(res, 200, "Complaint reassigned successfully", {
      complaint,
    });
  } catch (error) {
    console.error("Staff reassign error:", error.message);
    return failure(res, 500, "Unable to reassign complaint.", "INTERNAL_ERROR", error.message);
  }
});

// PATCH /api/complaints/:id/staff/resolve - Officer resolves complaint
router.patch("/:id/staff/resolve", requireOfficerRole, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return failure(res, 404, "Complaint not found", "NOT_FOUND");
    }

    const currentOfficer = await resolveCurrentOfficer(req);
    if (!currentOfficer || !currentOfficer.onDutyStatus || !complaintMatchesOfficer(complaint, currentOfficer)) {
      return failure(res, 403, "On-duty officer access required.", "OFFICER_OFF_DUTY");
    }

    const previousStatus = complaint.status;
    const resolutionDetails = String(req.body?.resolutionDetails || "").trim();

    complaint.status = "Recovered";
    complaint.itemFound = true;
    complaint.resolvedAt = complaint.resolvedAt || new Date();
    complaint.staffResponseStatus = resolutionDetails || "Complaint resolved - Item found";
    complaint.messages = complaint.messages || [];
    complaint.messages.push(
      staffTimelineEntry(currentOfficer.staffName, `Resolved: ${resolutionDetails || "Item found and recovered"}`, currentOfficer),
    );
    syncCanonicalComplaintFields(complaint, currentOfficer);
    await complaint.save();

    const storedReply = await persistComplaintReply({
      complaint,
      currentOfficer,
      message: resolutionDetails || "Complaint resolved - Item recovered",
      statusUpdate: "Recovered",
    });

    emitSocketEvent("complaint:resolved", {
      complaintId: String(complaint._id),
      passengerId: complaint.passengerId,
      complaint: complaint.toObject ? complaint.toObject() : complaint,
      resolutionDetails: resolutionDetails || "Item found and recovered",
      resolvedBy: currentOfficer.staffName,
      resolvedAt: complaint.resolvedAt,
      actorRole: currentOfficer.dutyUnit || currentOfficer.staffRole,
      source: "officer-resolve",
    });

    emitSocketEvent("complaint:status-change", {
      complaintId: String(complaint._id),
      passengerId: complaint.passengerId,
      complaint: complaint.toObject ? complaint.toObject() : complaint,
      previousStatus,
      newStatus: "Recovered",
      actorRole: currentOfficer.dutyUnit || currentOfficer.staffRole,
      source: "officer-resolve",
    });

    await logAction({
      action: "OFFICER_RESOLVED_COMPLAINT",
      actorType: "OFFICER",
      actorId: currentOfficer.staffId || currentOfficer.staffEmail,
      actorRole: currentOfficer.dutyUnit || currentOfficer.staffRole,
      entityType: "Complaint",
      entityId: String(complaint._id),
      complaintId: complaint.complaintId || String(complaint._id),
      metadata: {
        replyId: storedReply?._id?.toString?.() || null,
        resolutionDetails,
        resolvedAt: complaint.resolvedAt,
      },
    });

    return success(res, 200, "Complaint resolved successfully", {
      complaint,
      reply: storedReply,
    });
  } catch (error) {
    console.error("Staff resolve error:", error.message);
    return failure(res, 500, "Unable to resolve complaint.", "INTERNAL_ERROR", error.message);
  }
});

// PATCH /api/complaints/:id/staff/close - Officer closes complaint
router.patch("/:id/staff/close", requireOfficerRole, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return failure(res, 404, "Complaint not found", "NOT_FOUND");
    }

    const currentOfficer = await resolveCurrentOfficer(req);
    if (!currentOfficer || !currentOfficer.onDutyStatus || !complaintMatchesOfficer(complaint, currentOfficer)) {
      return failure(res, 403, "On-duty officer access required.", "OFFICER_OFF_DUTY");
    }

    const previousStatus = complaint.status;
    const closureReason = String(req.body?.closureReason || "").trim();

    complaint.status = "Closed";
    complaint.closedAt = complaint.closedAt || new Date();
    complaint.staffResponseStatus = closureReason || "Complaint closed";
    complaint.messages = complaint.messages || [];
    complaint.messages.push(
      staffTimelineEntry(currentOfficer.staffName, `Closed: ${closureReason || "Complaint closure completed"}`, currentOfficer),
    );
    syncCanonicalComplaintFields(complaint, currentOfficer);
    await complaint.save();

    const storedReply = await persistComplaintReply({
      complaint,
      currentOfficer,
      message: closureReason || "Complaint closed",
      statusUpdate: "Closed",
    });

    emitSocketEvent("complaint:closed", {
      complaintId: String(complaint._id),
      passengerId: complaint.passengerId,
      complaint: complaint.toObject ? complaint.toObject() : complaint,
      closureReason: closureReason || "Complaint closure completed",
      closedBy: currentOfficer.staffName,
      closedAt: complaint.closedAt,
      actorRole: currentOfficer.dutyUnit || currentOfficer.staffRole,
      source: "officer-close",
    });

    emitSocketEvent("complaint:status-change", {
      complaintId: String(complaint._id),
      passengerId: complaint.passengerId,
      complaint: complaint.toObject ? complaint.toObject() : complaint,
      previousStatus,
      newStatus: "Closed",
      actorRole: currentOfficer.dutyUnit || currentOfficer.staffRole,
      source: "officer-close",
    });

    await logAction({
      action: "OFFICER_CLOSED_COMPLAINT",
      actorType: "OFFICER",
      actorId: currentOfficer.staffId || currentOfficer.staffEmail,
      actorRole: currentOfficer.dutyUnit || currentOfficer.staffRole,
      entityType: "Complaint",
      entityId: String(complaint._id),
      complaintId: complaint.complaintId || String(complaint._id),
      metadata: {
        replyId: storedReply?._id?.toString?.() || null,
        closureReason,
        closedAt: complaint.closedAt,
      },
    });

    return success(res, 200, "Complaint closed successfully", {
      complaint,
      reply: storedReply,
    });
  } catch (error) {
    console.error("Staff close error:", error.message);
    return failure(res, 500, "Unable to close complaint.", "INTERNAL_ERROR", error.message);
  }
});

module.exports = router;
