const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "saferide-secret-key";

// Register
router.post("/register", async (req, res) => {
  try {
    const { name, phone, email, password, role } = req.body;

    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Name is required" });
    }
    if (!phone || !phone.trim()) {
      return res.status(400).json({ error: "Phone number is required" });
    }
    if (!password || password.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({ error: "Phone number already registered" });
    }

    // Normalize email (empty string becomes undefined)
    const userData = {
      name: name.trim(),
      phone: phone.trim(),
      password,
      role: role || "passenger",
    };

    // Only include email if it's provided and not empty
    if (email && email.trim()) {
      userData.email = email.trim();
    }

    const user = new User(userData);
    await user.save();

    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, {
      expiresIn: "30d",
    });

    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (error) {
    // Handle mongoose validation errors
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({ error: errors.join(", ") });
    }
    // Handle duplicate key error (unique constraint)
    if (error.code === 11000) {
      return res.status(400).json({ error: "Phone number already registered" });
    }
    console.error("Registration error:", error);
    res
      .status(500)
      .json({
        error: error.message || "Registration failed. Please try again.",
      });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { phone, password } = req.body;

    const user = await User.findOne({ phone });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, {
      expiresIn: "30d",
    });

    res.json({
      token,
      user: { id: user._id, name: user.name, phone, role: user.role },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Auth middleware export
router.authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "No token provided" });

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = await User.findById(decoded.id);
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
};

module.exports = router;
