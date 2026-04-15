const express = require("express");
const bcrypt = require("bcryptjs");

const User = require("../models/User");
const { signToken } = require("../utils/authToken");

const router = express.Router();

const VALID_ROLES = ["Passenger", "TTR", "TTE", "RPF", "Police"];

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const normalizeMobile = (value) => String(value || "").trim();

const generateMobileBackedEmail = (mobile) => {
  const normalized = String(mobile || "").replace(/\D/g, "");
  return normalized ? `${normalized}@mobile.saferide.local` : "";
};

const findByEmailOrMobile = async ({ email, mobile, includePassword = false }) => {
  const normalizedEmail = normalizeEmail(email);
  const normalizedMobile = normalizeMobile(mobile);

  if (normalizedEmail) {
    let query = User.findOne({ email: normalizedEmail });
    if (includePassword) {
      query = query.select("+password");
    }
    const byEmail = await query;
    if (byEmail) {
      return byEmail;
    }
  }

  if (!normalizedMobile) {
    return null;
  }

  let query = User.find({});
  if (includePassword) {
    query = query.select("+password");
  }

  const users = await query;
  return users.find((user) => normalizeMobile(user.mobile) === normalizedMobile) || null;
};

router.post("/register", async (req, res) => {
  try {
    const {
      name,
      email,
      mobile,
      password,
      role,
      officerId,
      assignedTrain,
      assignedRoute,
      assignedStation,
      dutyShift,
      isActiveDuty,
      profileStatus,
    } = req.body || {};

    if (!name || !password || !role) {
      return res.status(400).json({ message: "name, password, and role are required" });
    }

    if (!email && !mobile) {
      return res.status(400).json({ message: "email or mobile is required" });
    }

    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ message: `role must be one of: ${VALID_ROLES.join(", ")}` });
    }

    const normalizedMobile = normalizeMobile(mobile);
    const normalizedEmail = normalizeEmail(email) || generateMobileBackedEmail(normalizedMobile);

    const existingByEmail = await User.findOne({ email: normalizedEmail });
    if (existingByEmail) {
      return res.status(409).json({ message: "User already exists with this email" });
    }

    if (normalizedMobile) {
      const existingByMobile = await findByEmailOrMobile({ mobile: normalizedMobile });
      if (existingByMobile) {
        return res.status(409).json({ message: "User already exists with this mobile" });
      }
    }

    const hashedPassword = await bcrypt.hash(String(password), 10);

    const user = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      mobile: normalizedMobile || null,
      password: hashedPassword,
      role,
      officerId: officerId || null,
      professionalId: officerId || null,
      assignedTrain: assignedTrain || null,
      assignedRoute: assignedRoute || null,
      assignedStation: assignedStation || null,
      dutyShift: dutyShift || null,
      isActiveDuty: Boolean(isActiveDuty),
      onDutyStatus: Boolean(isActiveDuty),
      profileStatus: profileStatus || "approved",
      approvalStatus: profileStatus || "approved",
      phone: normalizedMobile || "N/A",
    });

    return res.status(201).json({
      message: "Registered successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        officerId: user.officerId || user.professionalId || null,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Registration failed", error: error.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, mobile, password } = req.body || {};

    if ((!email && !mobile) || !password) {
      return res.status(400).json({ message: "email/mobile and password are required" });
    }

    const user = await findByEmailOrMobile({ email, mobile, includePassword: true });
    if (!user || !user.password) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const matched = await bcrypt.compare(String(password), user.password);
    if (!matched) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = signToken({
      userId: String(user._id),
      role: user.role,
      email: user.email,
    });

    return res.json({
      message: "Login successful",
      token,
      role: user.role,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        officerId: user.officerId || user.professionalId || null,
        assignedTrain: user.assignedTrain || null,
        assignedRoute: user.assignedRoute || null,
        assignedStation: user.assignedStation || null,
        dutyShift: user.dutyShift || null,
        isActiveDuty: Boolean(user.isActiveDuty ?? user.onDutyStatus),
        profileStatus: user.profileStatus || user.approvalStatus || "approved",
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Login failed", error: error.message });
  }
});

module.exports = router;
