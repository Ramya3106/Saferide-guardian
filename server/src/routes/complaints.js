const express = require("express");
const mongoose = require("mongoose");
const Complaint = require("../models/Complaint");
const ComplaintReply = require("../models/ComplaintReply");
const User = require("../models/User");
const { success, failure } = require("../utils/apiResponse");
const { logAction } = require("../utils/actionLogger");
const { routeComplaintToActiveOfficers } = require("../services/complaintRoutingService");
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

    savedComplaint.complaintId = savedComplaint.complaintId || complaintId;
    savedComplaint.assignedStaff = routedOfficers;
    savedComplaint.staffNotified = routedOfficers.length > 0;
    savedComplaint.staffId = routedOfficers[0]?.staffId || null;
    savedComplaint.staffName = routedOfficers[0]?.staffName || submitAuthority || null;
    savedComplaint.assignedToUnit = routedOfficers.length > 0 ? (routedOfficers[0]?.dutyUnit || null) : null;
    savedComplaint.assignedAt = routedOfficers.length > 0 ? new Date() : null;
    savedComplaint.staffEta = routedOfficers.length > 0 ? "6 mins" : "Pending assignment";
    savedComplaint.status = routedOfficers.length > 0 ? "Staff Notified" : "Submitted";
    savedComplaint.staffResponseStatus = routedOfficers.length > 0 ? "Pending response" : "Awaiting duty roster";
    savedComplaint.dispatchMode = routingResult?.escalationLevel || savedComplaint.dispatchMode;
    savedComplaint.alertPriorityReason = routingResult?.routingReason || savedComplaint.alertPriorityReason;

    await savedComplaint.save();

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

    const complaints = await Complaint.find(query).sort({ updatedAt: -1 });

    return success(res, 200, "Complaints retrieved successfully", {
      officerId,
      complaints,
      total: complaints.length
    });
  } catch (error) {
    return failure(res, 500, "Failed to fetch officer complaints", "INTERNAL_ERROR", error.message);
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
    await complaint.save();

    const storedReply = await persistComplaintReply({
      complaint,
      currentOfficer,
      message: text,
      statusUpdate: complaint.status,
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

    await complaint.save();

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
    await complaint.save();

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
    await complaint.save();

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

module.exports = router;