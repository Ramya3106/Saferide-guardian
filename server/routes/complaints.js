const express = require("express");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const QRCode = require("qrcode");
const Complaint = require("../models/Complaint");
const { authMiddleware } = require("./auth");
const AlertRouter = require("../services/AlertRouter");
const ItemClassifier = require("../services/ItemClassifier");

const router = express.Router();

const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => cb(null, `${uuidv4()}-${file.originalname}`),
});
const upload = multer({ storage });

// Create complaint
router.post(
  "/",
  authMiddleware,
  upload.array("photos", 5),
  async (req, res) => {
    try {
      const {
        itemType,
        itemDescription,
        geoLocation,
        lastSeenLocation,
        vehicleType,
        vehicleNumber,
        routeId,
        incidentTime,
      } = req.body;

      const itemPhotos = req.files?.map((f) => f.path) || [];

      // AI Classification
      let classifiedCategory = itemType;
      let priorityScore = 50;

      if (itemPhotos.length > 0) {
        const classification = await ItemClassifier.classify(itemPhotos[0]);
        classifiedCategory = classification.category || itemType;
        priorityScore = classification.confidence * 100;
      }

      // Priority calculation
      const priorityMap = {
        passport: 100,
        wallet: 85,
        phone: 80,
        laptop: 90,
        jewelry: 75,
        documents: 70,
        bag: 60,
        other: 50,
      };
      priorityScore = priorityMap[itemType] || priorityScore;

      const priority =
        priorityScore >= 85
          ? "critical"
          : priorityScore >= 70
          ? "high"
          : priorityScore >= 50
          ? "medium"
          : "low";

      const complaint = new Complaint({
        userId: req.user._id,
        itemType,
        itemDescription,
        itemPhotos,
        classifiedCategory,
        priority,
        priorityScore,
        geoLocation: geoLocation ? JSON.parse(geoLocation) : undefined,
        lastSeenLocation,
        vehicleType,
        vehicleNumber,
        routeId,
        incidentTime: new Date(incidentTime),
      });

      await complaint.save();

      // Generate QR for handoff using the actual complaint id so deep links work
      complaint.handoffQRCode = await QRCode.toDataURL(
        `saferide://complaint/${complaint._id.toString()}`
      );
      await complaint.save();

      // Trigger alert routing
      const alertRouter = new AlertRouter(req.app.get("io"));
      await alertRouter.routeAlerts(complaint);

      res.status(201).json(complaint);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Get user's complaints
router.get("/my", authMiddleware, async (req, res) => {
  try {
    const complaints = await Complaint.find({ userId: req.user._id }).sort({
      createdAt: -1,
    });
    res.json(complaints);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get complaint by ID
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id).populate(
      "userId recoveredBy",
      "name phone role"
    );
    if (!complaint)
      return res.status(404).json({ error: "Complaint not found" });
    res.json(complaint);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update complaint status (for staff)
router.patch("/:id/status", authMiddleware, async (req, res) => {
  try {
    const { status, recoveryLocation } = req.body;
    const update = { status, updatedAt: new Date() };

    if (status === "secured" || status === "returned") {
      update.recoveredBy = req.user._id;
      update.recoveryLocation = recoveryLocation;
      update.recoveredAt = new Date();
    }

    const complaint = await Complaint.findByIdAndUpdate(req.params.id, update, {
      new: true,
    });

    // Emit real-time update
    req.app
      .get("io")
      .to(`complaint-${complaint._id}`)
      .emit("status-update", complaint);

    res.json(complaint);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
