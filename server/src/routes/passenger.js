const express = require("express");
const router = express.Router();
const Complaint = require("../models/Complaint");
const Journey = require("../models/Journey");

// Middleware to extract user email from headers
const getUserEmail = (req) => req.headers["x-user-email"] || "";

// GET /api/passenger/dashboard - Get active journey
router.get("/dashboard", async (req, res) => {
  try {
    const userEmail = getUserEmail(req);
    if (!userEmail) {
      return res.status(400).json({ message: "User email required" });
    }

    // Find active journey for the passenger
    const journey = await Journey.findOne({
      passengerEmail: userEmail,
      status: "Active",
    }).sort({ createdAt: -1 });

    if (!journey) {
      return res.json({
        journey: null,
        message: "No active journey found",
      });
    }

    res.json({
      journey: journey,
      message: "Journey retrieved successfully",
    });
  } catch (error) {
    console.error("Error fetching dashboard:", error);
    res.status(500).json({ message: "Error fetching dashboard" });
  }
});

// POST /api/passenger/complaints - Create a new complaint
router.post("/complaints", async (req, res) => {
  try {
    const userEmail = getUserEmail(req);
    if (!userEmail) {
      return res.status(400).json({ message: "User email required" });
    }

    const {
      transportType,
      vehicleNumber,
      itemType,
      description,
      fromLocation,
      toLocation,
      departureTime,
      arrivalTime,
      lastSeenLocation,
      timestamp,
      journeyId,
      route,
      submitAuthority,
    } = req.body;

    if (!vehicleNumber || !itemType || !description || !transportType) {
      return res.status(400).json({
        message: "Missing required fields",
      });
    }

    // Generate unique QR code ID
    const qrCode = `QR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const complaint = new Complaint({
      passengerId: userEmail, // Using email as ID for now
      passengerEmail: userEmail,
      passengerName: req.headers["x-user-name"] || "Passenger",
      transportType: transportType || "bus",
      vehicleNumber,
      itemType,
      description,
      fromLocation: fromLocation || "",
      toLocation: toLocation || "",
      departureTime: departureTime || "",
      arrivalTime: arrivalTime || "",
      lastSeenLocation: lastSeenLocation || fromLocation || "Unknown",
      timestamp: timestamp || new Date(),
      journeyId: journeyId || null,
      route: route || `${fromLocation} → ${toLocation}`,
      submitAuthority: submitAuthority || "Staff",
      qrCode,
      status: "Reported",
    });

    await complaint.save();

    // Simulate staff notification
    complaint.staffNotified = true;
    complaint.staffId = "STAFF-001";
    complaint.staffName = submitAuthority || "Staff Member";
    complaint.staffEta = "8 mins";
    complaint.status = "Staff Notified";
    await complaint.save();

    res.status(201).json({
      complaint: complaint,
      message: "Complaint created successfully",
    });
  } catch (error) {
    console.error("Error creating complaint:", error);
    res.status(500).json({ message: "Error creating complaint" });
  }
});

// GET /api/passenger/complaints - Get all complaints for passenger
router.get("/complaints", async (req, res) => {
  try {
    const userEmail = getUserEmail(req);
    if (!userEmail) {
      return res.status(400).json({ message: "User email required" });
    }

    const complaints = await Complaint.find({
      passengerEmail: userEmail,
    }).sort({ createdAt: -1 });

    res.json({
      complaints: complaints,
      message: "Complaints retrieved successfully",
    });
  } catch (error) {
    console.error("Error fetching complaints:", error);
    res.status(500).json({ message: "Error fetching complaints" });
  }
});

// GET /api/passenger/complaints/:id - Get specific complaint details
router.get("/complaints/:id", async (req, res) => {
  try {
    const complaintId = req.params.id;
    const userEmail = getUserEmail(req);

    const complaint = await Complaint.findOne({
      _id: complaintId,
      passengerEmail: userEmail,
    });

    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    res.json({
      complaint: complaint,
      message: "Complaint retrieved successfully",
    });
  } catch (error) {
    console.error("Error fetching complaint:", error);
    res.status(500).json({ message: "Error fetching complaint" });
  }
});

// GET /api/passenger/tracking/:complaintId - Get live tracking info
router.get("/tracking/:complaintId", async (req, res) => {
  try {
    const complaintId = req.params.complaintId;
    const userEmail = getUserEmail(req);

    const complaint = await Complaint.findOne({
      _id: complaintId,
      passengerEmail: userEmail,
    });

    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    // Simulate live tracking data
    const trackingData = {
      complaintId: complaint._id,
      staffLocation: {
        latitude: 13.008, // Chennai coordinates example
        longitude: 80.2588,
        lastUpdated: new Date(),
      },
      meetingPoint: complaint.meetingPoint || "Guindy Station",
      staffEta: complaint.staffEta || "8 mins",
      itemStatus: complaint.itemFound ? "Found ✅" : "Searching 🔍",
    };

    res.json({
      tracking: trackingData,
      message: "Tracking data retrieved successfully",
    });
  } catch (error) {
    console.error("Error fetching tracking:", error);
    res.status(500).json({ message: "Error fetching tracking data" });
  }
});

// GET /api/passenger/messages/:complaintId - Get staff messages
router.get("/messages/:complaintId", async (req, res) => {
  try {
    const complaintId = req.params.complaintId;
    const userEmail = getUserEmail(req);

    const complaint = await Complaint.findOne({
      _id: complaintId,
      passengerEmail: userEmail,
    });

    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    res.json({
      messages: complaint.messages || [],
      staffName: complaint.staffName,
      message: "Messages retrieved successfully",
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ message: "Error fetching messages" });
  }
});

// POST /api/passenger/messages/:complaintId - Send message to staff
router.post("/messages/:complaintId", async (req, res) => {
  try {
    const complaintId = req.params.complaintId;
    const userEmail = getUserEmail(req);
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ message: "Message text required" });
    }

    const complaint = await Complaint.findOne({
      _id: complaintId,
      passengerEmail: userEmail,
    });

    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    const newMessage = {
      staffId: complaint.staffId,
      staffName: complaint.staffName,
      text,
      timestamp: new Date(),
    };

    complaint.messages.push(newMessage);
    await complaint.save();

    res.json({
      message: "Message sent successfully",
      messages: complaint.messages,
    });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ message: "Error sending message" });
  }
});

// POST /api/passenger/qr-code/:complaintId - Verify QR code for pickup
router.post("/qr-code/:complaintId", async (req, res) => {
  try {
    const complaintId = req.params.complaintId;
    const userEmail = getUserEmail(req);

    const complaint = await Complaint.findOne({
      _id: complaintId,
      passengerEmail: userEmail,
    });

    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    // Mark as collected
    complaint.itemCollected = true;
    complaint.status = "Recovered";
    await complaint.save();

    res.json({
      message: "Item collected successfully!",
      complaint: complaint,
    });
  } catch (error) {
    console.error("Error processing QR code:", error);
    res.status(500).json({ message: "Error processing QR code" });
  }
});

// POST /api/passenger/gps - Update GPS status
router.post("/gps", async (req, res) => {
  try {
    const userEmail = getUserEmail(req);
    const { enabled } = req.body;

    if (!userEmail) {
      return res.status(400).json({ message: "User email required" });
    }

    // Update GPS status for all active journeys/complaints
    // This is a simple implementation - in production, would use real GPS tracking
    res.json({
      gpsEnabled: enabled,
      message: `GPS ${enabled ? "enabled" : "disabled"}`,
    });
  } catch (error) {
    console.error("Error updating GPS:", error);
    res.status(500).json({ message: "Error updating GPS" });
  }
});

// POST /api/passenger/journey - Create a new journey
router.post("/journey", async (req, res) => {
  try {
    const userEmail = getUserEmail(req);
    if (!userEmail) {
      return res.status(400).json({ message: "User email required" });
    }

    const {
      vehicleNumber,
      route,
      fromStop,
      toStop,
      driverName,
      conductorName,
      estimatedDuration,
    } = req.body;

    if (!vehicleNumber || !route) {
      return res.status(400).json({
        message: "Vehicle number and route are required",
      });
    }

    const journey = new Journey({
      passengerId: userEmail,
      passengerEmail: userEmail,
      vehicleNumber,
      route,
      fromStop: fromStop || "",
      toStop: toStop || "",
      currentStop: fromStop || "",
      startTime: new Date(),
      estimatedEndTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
      driverName: driverName || null,
      conductorName: conductorName || null,
      estimatedDuration: estimatedDuration || "2h",
      status: "Active",
    });

    await journey.save();

    res.status(201).json({
      journey: journey,
      message: "Journey created successfully",
    });
  } catch (error) {
    console.error("Error creating journey:", error);
    res.status(500).json({ message: "Error creating journey" });
  }
});

module.exports = router;
