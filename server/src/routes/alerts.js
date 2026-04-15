const express = require("express");
const mongoose = require("mongoose");

const AlertNotification = require("../models/AlertNotification");
const Complaint = require("../models/Complaint");
const User = require("../models/User");
const DutyAttendance = require("../models/DutyAttendance");
const { success, failure } = require("../utils/apiResponse");
const { logAction } = require("../utils/actionLogger");

const router = express.Router();

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));

const toObjectId = (value, label) => {
  if (!isObjectId(value)) {
    throw new Error(`Invalid ${label}`);
  }
  return new mongoose.Types.ObjectId(String(value));
};

const isOfficerOnActiveDuty = async (userId) => {
  const user = await User.findById(userId).select("onDutyStatus isActiveDuty role");
  if (!user) {
    return { exists: false, onDuty: false };
  }

  const activeSession = await DutyAttendance.findOne({
    userId,
    $or: [{ dutyStatus: "ACTIVE" }, { status: "ACTIVE" }],
  }).sort({ checkInTime: -1 });

  return {
    exists: true,
    onDuty: Boolean(user.isActiveDuty || user.onDutyStatus || activeSession),
    role: user.role,
  };
};

router.post("/route", async (req, res) => {
  try {
    const { complaintId, receiverId, receiverRole, priorityLevel, matchType, receivers } = req.body || {};

    if (!complaintId || !isObjectId(complaintId)) {
      return failure(res, 400, "Valid complaintId is required", "VALIDATION_ERROR");
    }

    const complaint = await Complaint.findById(complaintId);
    if (!complaint) {
      return failure(res, 404, "Complaint not found", "NOT_FOUND");
    }

    const normalizedReceivers = Array.isArray(receivers) && receivers.length > 0
      ? receivers
      : [{ receiverId, receiverRole, priorityLevel, matchType }];

    const activeReceiverEntries = [];
    for (const entry of normalizedReceivers) {
      if (!entry?.receiverId || !entry?.receiverRole || !isObjectId(entry.receiverId)) {
        continue;
      }
      const dutyState = await isOfficerOnActiveDuty(entry.receiverId);
      if (dutyState.exists && dutyState.onDuty) {
        activeReceiverEntries.push(entry);
      }
    }

    const docs = activeReceiverEntries
      .filter((entry) => entry?.receiverId && entry?.receiverRole)
      .map((entry) => ({
        complaintId: toObjectId(complaintId, "complaintId"),
        receiverId: toObjectId(entry.receiverId, "receiverId"),
        receiverRole: entry.receiverRole,
        priorityLevel: entry.priorityLevel || priorityLevel || complaint.urgencyLevel || "Normal",
        matchType: entry.matchType || matchType || "MANUAL",
        alertStatus: "SENT",
        sentAt: new Date(),
      }));

    if (docs.length === 0) {
      return failure(res, 400, "No active-duty receivers available for alert routing", "NO_ACTIVE_RECEIVER");
    }

    const alerts = await AlertNotification.insertMany(docs);
    await logAction({
      action: "ALERTS_ROUTED",
      actorType: "SYSTEM",
      entityType: "Complaint",
      entityId: String(complaint._id),
      complaintId: complaint.complaintId || String(complaint._id),
      metadata: {
        totalAlerts: alerts.length,
        matchType: matchType || "MANUAL",
      },
    });

    return success(res, 201, "Alerts routed", {
      alerts,
      total: alerts.length,
    });
  } catch (error) {
    return failure(res, 500, "Failed to route alerts", "INTERNAL_ERROR", error.message);
  }
});

router.get("/officer/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!isObjectId(userId)) {
      return failure(res, 400, "Valid userId is required", "VALIDATION_ERROR");
    }

    const dutyState = await isOfficerOnActiveDuty(userId);
    if (!dutyState.exists) {
      return failure(res, 404, "Officer not found", "NOT_FOUND");
    }

    if (!dutyState.onDuty) {
      return success(res, 200, "Officer is checked out; no active alerts", {
        userId,
        alerts: [],
        total: 0,
      });
    }

    const alerts = await AlertNotification.find({ receiverId: userId }).sort({ sentAt: -1 });
    return success(res, 200, "Officer alerts fetched", {
      userId,
      alerts,
      total: alerts.length,
    });
  } catch (error) {
    return failure(res, 500, "Failed to fetch officer alerts", "INTERNAL_ERROR", error.message);
  }
});

router.patch("/:alertId/acknowledge", async (req, res) => {
  try {
    const { alertId } = req.params;

    if (!isObjectId(alertId)) {
      return failure(res, 400, "Valid alertId is required", "VALIDATION_ERROR");
    }

    const alert = await AlertNotification.findById(alertId);
    if (!alert) {
      return failure(res, 404, "Alert not found", "NOT_FOUND");
    }

    alert.alertStatus = "ACKNOWLEDGED";
    alert.acknowledgedAt = new Date();
    await alert.save();

    await logAction({
      action: "ALERT_ACKNOWLEDGED",
      actorType: "OFFICER",
      actorId: String(alert.receiverId),
      actorRole: alert.receiverRole,
      entityType: "AlertNotification",
      entityId: String(alert._id),
      complaintId: String(alert.complaintId),
      metadata: { alertStatus: alert.alertStatus },
    });

    return success(res, 200, "Alert acknowledged", { alert });
  } catch (error) {
    return failure(res, 500, "Failed to acknowledge alert", "INTERNAL_ERROR", error.message);
  }
});

module.exports = router;
