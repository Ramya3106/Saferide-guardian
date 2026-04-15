const express = require("express");
const mongoose = require("mongoose");

const Complaint = require("../models/Complaint");
const ComplaintReply = require("../models/ComplaintReply");
const User = require("../models/User");
const { success, failure } = require("../utils/apiResponse");
const { logAction } = require("../utils/actionLogger");

const router = express.Router();

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));

router.post("/", async (req, res) => {
  try {
    const { complaintId, officerId, officerRole, message, statusUpdate } = req.body || {};

    if (!complaintId || !officerId || !officerRole || !message || !statusUpdate) {
      return failure(
        res,
        400,
        "complaintId, officerId, officerRole, message, and statusUpdate are required",
        "VALIDATION_ERROR",
      );
    }

    if (!isObjectId(complaintId)) {
      return failure(res, 400, "complaintId must be a valid ObjectId", "VALIDATION_ERROR");
    }

    const complaint = await Complaint.findById(complaintId);
    if (!complaint) {
      return failure(res, 404, "Complaint not found", "NOT_FOUND");
    }

    const officer = isObjectId(officerId) ? await User.findById(officerId).select("onDutyStatus isActiveDuty") : null;
    if (officer && !(officer.onDutyStatus || officer.isActiveDuty)) {
      return failure(res, 403, "Checked-out officers cannot submit replies", "OFFICER_OFF_DUTY");
    }

    const trimmedMessage = String(message).trim();
    if (trimmedMessage.length < 2) {
      return failure(res, 400, "message must be at least 2 characters", "VALIDATION_ERROR");
    }

    const reply = await ComplaintReply.create({
      complaintId,
      officerId: String(officerId),
      officerRole,
      message: trimmedMessage,
      statusUpdate,
      repliedAt: new Date(),
    });

    complaint.messages = complaint.messages || [];
    complaint.messages.push({
      staffId: String(officerId),
      staffName: officerRole,
      text: trimmedMessage,
      timestamp: new Date(),
    });
    complaint.status = statusUpdate;
    await complaint.save();

    await logAction({
      action: "COMPLAINT_REPLY_CREATED",
      actorType: "OFFICER",
      actorId: String(officerId),
      actorRole: officerRole,
      entityType: "ComplaintReply",
      entityId: String(reply._id),
      complaintId: complaint.complaintId || String(complaint._id),
      metadata: { statusUpdate },
    });

    return success(res, 201, "Reply saved", { reply });
  } catch (error) {
    return failure(res, 500, "Failed to save reply", "INTERNAL_ERROR", error.message);
  }
});

router.get("/:complaintId", async (req, res) => {
  try {
    const { complaintId } = req.params;

    if (!isObjectId(complaintId)) {
      return failure(res, 400, "Valid complaintId is required", "VALIDATION_ERROR");
    }

    const replies = await ComplaintReply.find({ complaintId }).sort({ repliedAt: -1 });
    return success(res, 200, "Replies fetched", {
      complaintId,
      replies,
      total: replies.length,
    });
  } catch (error) {
    return failure(res, 500, "Failed to fetch replies", "INTERNAL_ERROR", error.message);
  }
});

module.exports = router;
