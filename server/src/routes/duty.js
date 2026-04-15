const express = require("express");
const mongoose = require("mongoose");

const User = require("../models/User");
const DutyAttendance = require("../models/DutyAttendance");

const router = express.Router();

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));

router.post("/checkin", async (req, res) => {
  try {
    const {
      userId,
      assignedTrain,
      assignedRoute,
      assignedStation,
      dutyShift,
      role,
      shiftDate,
    } = req.body || {};

    if (!userId || !isObjectId(userId)) {
      return res.status(400).json({ message: "Valid userId is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const activeSession = await DutyAttendance.findOne({
      userId: user._id,
      dutyStatus: "ACTIVE",
    }).sort({ createdAt: -1 });

    if (activeSession) {
      return res.status(409).json({ message: "User already checked in" });
    }

    const now = new Date();
    const attendance = await DutyAttendance.create({
      userId: user._id,
      officerKey: String(user._id),
      officerId: user.officerId || user.professionalId || String(user._id),
      officerEmail: user.email,
      professionalId: user.professionalId || null,
      officerName: user.name,
      role: role || user.role,
      dutyUnit: role || user.role,
      assignedTrain: assignedTrain || user.assignedTrain || null,
      assignedRoute: assignedRoute || user.assignedRoute || null,
      assignedStation: assignedStation || user.assignedStation || null,
      assignedShift: dutyShift || user.dutyShift || null,
      dutyStatus: "ACTIVE",
      status: "ACTIVE",
      checkInTime: now,
      shiftDate: shiftDate ? new Date(shiftDate) : now,
      source: "db",
    });

    user.onDutyStatus = true;
    user.isActiveDuty = true;
    user.dutyCheckInAt = now;
    user.dutyCheckOutAt = null;
    user.assignedTrain = attendance.assignedTrain;
    user.assignedRoute = attendance.assignedRoute;
    user.assignedStation = attendance.assignedStation;
    user.dutyShift = attendance.assignedShift;
    await user.save();

    return res.status(201).json({ message: "Check-in successful", attendance });
  } catch (error) {
    return res.status(500).json({ message: "Check-in failed", error: error.message });
  }
});

router.post("/checkout", async (req, res) => {
  try {
    const { userId } = req.body || {};

    if (!userId || !isObjectId(userId)) {
      return res.status(400).json({ message: "Valid userId is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const activeSession = await DutyAttendance.findOne({
      userId: user._id,
      dutyStatus: "ACTIVE",
    }).sort({ createdAt: -1 });

    if (!activeSession) {
      return res.status(409).json({ message: "No active duty session found" });
    }

    const now = new Date();
    activeSession.checkOutTime = now;
    activeSession.dutyStatus = "INACTIVE";
    activeSession.status = "INACTIVE";
    await activeSession.save();

    user.onDutyStatus = false;
    user.isActiveDuty = false;
    user.dutyCheckOutAt = now;
    await user.save();

    return res.json({ message: "Check-out successful", attendance: activeSession });
  } catch (error) {
    return res.status(500).json({ message: "Check-out failed", error: error.message });
  }
});

router.get("/status/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!isObjectId(userId)) {
      return res.status(400).json({ message: "Valid userId is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const activeSession = await DutyAttendance.findOne({
      userId: user._id,
      dutyStatus: "ACTIVE",
    }).sort({ createdAt: -1 });

    return res.json({
      userId: user._id,
      role: user.role,
      isActiveDuty: Boolean(user.isActiveDuty ?? user.onDutyStatus),
      activeSession,
    });
  } catch (error) {
    return res.status(500).json({ message: "Unable to fetch duty status", error: error.message });
  }
});

router.get("/history/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!isObjectId(userId)) {
      return res.status(400).json({ message: "Valid userId is required" });
    }

    const history = await DutyAttendance.find({ userId }).sort({ checkInTime: -1 });

    return res.json({ userId, history, total: history.length });
  } catch (error) {
    return res.status(500).json({ message: "Unable to fetch duty history", error: error.message });
  }
});

module.exports = router;
