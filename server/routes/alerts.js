const express = require("express");
const Alert = require("../models/Alert");
const { authMiddleware } = require("./auth");

const router = express.Router();

// Get alerts for current user (staff)
router.get("/my", authMiddleware, async (req, res) => {
  try {
    const alerts = await Alert.find({ recipientId: req.user._id })
      .populate("complaintId")
      .sort({ priority: -1, createdAt: -1 });
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Acknowledge alert
router.patch("/:id/acknowledge", authMiddleware, async (req, res) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { status: "acknowledged", acknowledgedAt: new Date() },
      { new: true }
    );
    res.json(alert);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
