const express = require("express");
const VehicleTracker = require("../services/VehicleTracker");
const { authMiddleware } = require("./auth");

const router = express.Router();

// Get vehicle location and prediction
router.get("/vehicle/:vehicleNumber", authMiddleware, async (req, res) => {
  try {
    const tracker = new VehicleTracker();
    const data = await tracker.getVehicleStatus(req.params.vehicleNumber);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get route prediction
router.post("/predict", authMiddleware, async (req, res) => {
  try {
    const { vehicleNumber, routeId, currentLocation } = req.body;
    const tracker = new VehicleTracker();
    const prediction = await tracker.predictNextStop(
      vehicleNumber,
      routeId,
      currentLocation
    );
    res.json(prediction);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
