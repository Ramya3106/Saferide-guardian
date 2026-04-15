const express = require("express");
const mongoose = require("mongoose");

const AlertNotification = require("../models/AlertNotification");
const Complaint = require("../models/Complaint");

const router = express.Router();

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));

const toObjectId = (value, label) => {
  if (!isObjectId(value)) {
    throw new Error(`Invalid ${label}`);
  }
  return new mongoose.Types.ObjectId(String(value));
};

router.post("/route", async (req, res) => {
  try {
    const { complaintId, receiverId, receiverRole, priorityLevel, matchType, receivers } = req.body || {};

    if (!complaintId || !isObjectId(complaintId)) {
      return res.status(400).json({ message: "Valid complaintId is required" });
    }

    const complaint = await Complaint.findById(complaintId);
    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    const normalizedReceivers = Array.isArray(receivers) && receivers.length > 0
      ? receivers
      : [{ receiverId, receiverRole, priorityLevel, matchType }];

    const docs = normalizedReceivers
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
      return res.status(400).json({ message: "At least one valid receiver is required" });
    }

    const alerts = await AlertNotification.insertMany(docs);
    return res.status(201).json({ message: "Alerts routed", alerts, total: alerts.length });
  } catch (error) {
    return res.status(500).json({ message: "Failed to route alerts", error: error.message });
  }
});

router.get("/officer/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!isObjectId(userId)) {
      return res.status(400).json({ message: "Valid userId is required" });
    }

    const alerts = await AlertNotification.find({ receiverId: userId }).sort({ sentAt: -1 });
    return res.json({ userId, alerts, total: alerts.length });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch officer alerts", error: error.message });
  }
});

router.patch("/:alertId/acknowledge", async (req, res) => {
  try {
    const { alertId } = req.params;

    if (!isObjectId(alertId)) {
      return res.status(400).json({ message: "Valid alertId is required" });
    }

    const alert = await AlertNotification.findById(alertId);
    if (!alert) {
      return res.status(404).json({ message: "Alert not found" });
    }

    alert.alertStatus = "ACKNOWLEDGED";
    alert.acknowledgedAt = new Date();
    await alert.save();

    return res.json({ message: "Alert acknowledged", alert });
  } catch (error) {
    return res.status(500).json({ message: "Failed to acknowledge alert", error: error.message });
  }
});

module.exports = router;
