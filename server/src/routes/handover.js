const express = require("express");
const mongoose = require("mongoose");

const Complaint = require("../models/Complaint");
const { logAction } = require("../utils/actionLogger");
const { success, failure } = require("../utils/apiResponse");

const router = express.Router();

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));

router.post("/verify", async (req, res) => {
  try {
    const { complaintId, qrToken } = req.body || {};

    if (!complaintId || !qrToken) {
      return failure(res, 400, "complaintId and qrToken are required", "VALIDATION_ERROR");
    }

    const complaint = await Complaint.findOne({
      $or: [
        { complaintId: String(complaintId) },
        ...(isObjectId(complaintId) ? [{ _id: complaintId }] : []),
      ],
    });

    if (!complaint) {
      return failure(res, 404, "Complaint not found", "NOT_FOUND");
    }

    if (String(complaint.qrCode || "") !== String(qrToken || "")) {
      return failure(res, 400, "Invalid QR token", "INVALID_QR");
    }

    complaint.itemCollected = true;
    complaint.status = "Recovered";
    await complaint.save();

    await logAction({
      action: "HANDOVER_VERIFIED",
      actorType: "SYSTEM",
      entityType: "Complaint",
      entityId: String(complaint._id),
      complaintId: complaint.complaintId || String(complaint._id),
      metadata: {
        qrTokenVerified: true,
      },
    });

    return success(res, 200, "Handover verified successfully", {
      complaint,
    });
  } catch (error) {
    return failure(res, 500, "Failed to verify handover", "INTERNAL_ERROR", error.message);
  }
});

module.exports = router;
