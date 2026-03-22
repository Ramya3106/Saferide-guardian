const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

const getDbStatus = () => {
  const states = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };

  return states[mongoose.connection.readyState] || "unknown";
};

router.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "saferide-guardian-api",
    database: getDbStatus(),
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
