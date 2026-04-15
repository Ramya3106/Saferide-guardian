const express = require("express");
const mongoose = require("mongoose");

const Complaint = require("../models/Complaint");
const ComplaintReply = require("../models/ComplaintReply");

const router = express.Router();

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));

router.post("/", async (req, res) => {
  try {
    const { complaintId, officerId, officerRole, message, statusUpdate } = req.body || {};

    if (!complaintId || !officerId || !officerRole || !message || !statusUpdate) {
      return res.status(400).json({
        message: "complaintId, officerId, officerRole, message, and statusUpdate are required",
      });
    }

    if (!isObjectId(complaintId) || !isObjectId(officerId)) {
      return res.status(400).json({ message: "complaintId and officerId must be valid ObjectIds" });
    }

    const complaint = await Complaint.findById(complaintId);
    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    const reply = await ComplaintReply.create({
      complaintId,
      officerId,
      officerRole,
      message,
      statusUpdate,
      repliedAt: new Date(),
    });

    complaint.messages = complaint.messages || [];
    complaint.messages.push({
      staffId: String(officerId),
      staffName: officerRole,
      text: message,
      timestamp: new Date(),
    });
    complaint.status = statusUpdate;
    await complaint.save();

    return res.status(201).json({ message: "Reply saved", reply });
  } catch (error) {
    return res.status(500).json({ message: "Failed to save reply", error: error.message });
  }
});

router.get("/:complaintId", async (req, res) => {
  try {
    const { complaintId } = req.params;

    if (!isObjectId(complaintId)) {
      return res.status(400).json({ message: "Valid complaintId is required" });
    }

    const replies = await ComplaintReply.find({ complaintId }).sort({ repliedAt: -1 });
    return res.json({ complaintId, replies, total: replies.length });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch replies", error: error.message });
  }
});

module.exports = router;
