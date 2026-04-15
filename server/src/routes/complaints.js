const express = require("express");
const mongoose = require("mongoose");

const Complaint = require("../models/Complaint");
const { requireAuth, requireRoles } = require("../middleware/authGuard");

const router = express.Router();

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));

const toObjectIdOrNull = (value) => (isObjectId(value) ? new mongoose.Types.ObjectId(String(value)) : null);

const generateComplaintId = () => `CRN-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

router.post("/", async (req, res) => {
  try {
    const {
      complaintId,
      passengerId,
      trainNumber,
      boardingStation,
      destinationStation,
      coachNumber,
      berthNumber,
      lostItemType,
      description,
      imageUrl,
      lossTime,
      urgencyLevel,
      status,
      assignedTo,
    } = req.body || {};

    if (!passengerId || !trainNumber || !boardingStation || !destinationStation || !lostItemType || !description) {
      return res.status(400).json({
        message: "passengerId, trainNumber, boardingStation, destinationStation, lostItemType, and description are required",
      });
    }

    const route = `${boardingStation} -> ${destinationStation}`;
    const assignedToObjectId = toObjectIdOrNull(assignedTo);

    const complaint = await Complaint.create({
      complaintId: complaintId || generateComplaintId(),
      passengerId: String(passengerId),
      passengerEmail: String(passengerId),
      passengerName: String(req.body?.passengerName || "Passenger"),
      transportType: "train",
      trainNumber: String(trainNumber),
      vehicleNumber: String(trainNumber),
      boardingStation: String(boardingStation),
      destinationStation: String(destinationStation),
      coachNumber: coachNumber || null,
      berthNumber: berthNumber || null,
      lostItemType: String(lostItemType),
      itemType: String(lostItemType),
      description: String(description),
      imageUrl: imageUrl || null,
      photoUri: imageUrl || null,
      lossTime: lossTime ? new Date(lossTime) : new Date(),
      timestamp: lossTime ? new Date(lossTime) : new Date(),
      urgencyLevel: urgencyLevel || "Normal",
      priority: urgencyLevel || "Normal",
      status: status || "Submitted",
      assignedTo: assignedToObjectId,
      fromLocation: String(boardingStation),
      toLocation: String(destinationStation),
      lastSeenLocation: String(boardingStation),
      route,
      submitAuthority: "TTR / TTE / RPF / Police",
    });

    return res.status(201).json({ message: "Complaint created", complaint });
  } catch (error) {
    return res.status(500).json({ message: "Failed to create complaint", error: error.message });
  }
});

router.get("/passenger/:passengerId", async (req, res) => {
  try {
    const { passengerId } = req.params;
    const complaints = await Complaint.find({ passengerId }).sort({ createdAt: -1 });
    return res.json({ passengerId, complaints, total: complaints.length });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch passenger complaints", error: error.message });
  }
});

router.get("/officer/:officerId", async (req, res) => {
  try {
    const { officerId } = req.params;
    const officerObjectId = toObjectIdOrNull(officerId);

    const query = {
      $or: [
        ...(officerObjectId ? [{ assignedTo: officerObjectId }] : []),
        { staffId: String(officerId) },
        { "assignedStaff.staffId": String(officerId) },
      ],
    };

    const complaints = await Complaint.find(query).sort({ updatedAt: -1 });
    return res.json({ officerId, complaints, total: complaints.length });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch officer complaints", error: error.message });
  }
});

router.get("/:complaintId", requireAuth, async (req, res) => {
  try {
    const { complaintId } = req.params;

    const complaint = await Complaint.findOne({
      $or: [
        { complaintId },
        ...(isObjectId(complaintId) ? [{ _id: complaintId }] : []),
      ],
    });

    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    return res.json({ complaint });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch complaint", error: error.message });
  }
});

router.patch(
  "/:complaintId/status",
  requireAuth,
  requireRoles(["TTR", "TTE", "RPF", "Police", "TTR/RPF/Police"]),
  async (req, res) => {
  try {
    const { complaintId } = req.params;
    const { status, assignedTo } = req.body || {};

    if (!status) {
      return res.status(400).json({ message: "status is required" });
    }

    const complaint = await Complaint.findOne({
      $or: [
        { complaintId },
        ...(isObjectId(complaintId) ? [{ _id: complaintId }] : []),
      ],
    });

    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    complaint.status = status;
    if (assignedTo) {
      complaint.assignedTo = toObjectIdOrNull(assignedTo);
    }

    await complaint.save();

    return res.json({ message: "Complaint status updated", complaint });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update complaint status", error: error.message });
  }
  },
);

module.exports = router;
