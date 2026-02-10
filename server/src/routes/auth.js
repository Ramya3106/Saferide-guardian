const express = require("express");
const nodemailer = require("nodemailer");
const bcrypt = require("bcryptjs");
const router = express.Router();
const dotenv = require("dotenv");
const User = require("../models/User");

dotenv.config();

const VERIFY_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;
const verificationStore = new Map();
const user = (process.env.EMAIL_USER || "").trim();
const pass = (process.env.EMAIL_PASS || "").replace(/\s+/g, "");
const fromAddress = (process.env.EMAIL_FROM || user).trim();
const returnDevCode =
  String(process.env.RETURN_VERIFY_CODE || "").toLowerCase() === "true";
const ROLES = ["Passenger", "Driver", "Conductor", "TTR/RPF", "Police"];
const OFFICIAL_DOMAINS = {
  "TTR/RPF": "railnet.gov.in",
  Police: "tnpolice.gov.in",
};
const OFFICIAL_ROLES = new Set(["TTR/RPF", "Police"]);

const createTransporter = () => {
  if (!user || !pass) return null;

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user,
      pass,
    },
  });
};

// Generate 6-digit code
const generateCode = () => String(Math.floor(100000 + Math.random() * 900000));

// Email validation
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const isOfficialRole = (role) => OFFICIAL_ROLES.has(role);

const getOfficialDomain = (role) => OFFICIAL_DOMAINS[role] || "railnet.gov.in";

const isValidOfficialEmail = (role, emailValue) => {
  const trimmed = (emailValue || "").trim().toLowerCase();
  if (!isValidEmail(trimmed)) {
    return false;
  }
  return trimmed.endsWith(`@${getOfficialDomain(role)}`);
};

const isValidProfessionalId = (role, idValue) => {
  const normalized = (idValue || "").trim().toUpperCase();
  if (role === "Police") {
    return /^TNPOLICE-\d{4,6}$/.test(normalized);
  }
  if (role === "TTR/RPF") {
    return /^(TTR|RPF)-[A-Z]{2,3}-\d{4,6}$/.test(normalized);
  }
  return normalized.length >= 6;
};

const consumeVerificationCode = (email, code) => {
  const record = verificationStore.get(email);
  if (!record) {
    return { ok: false, status: 400, message: "No verification code found." };
  }

  if (Date.now() > record.expiresAt) {
    verificationStore.delete(email);
    return {
      ok: false,
      status: 400,
      message: "Code expired. Resend new code.",
    };
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    verificationStore.delete(email);
    return {
      ok: false,
      status: 429,
      message: "Too many attempts. Resend code.",
    };
  }

  if (record.code !== code) {
    record.attempts += 1;
    verificationStore.set(email, record);
    return { ok: false, status: 400, message: "Incorrect code." };
  }

  verificationStore.delete(email);
  return { ok: true };
};

router.post("/send-verify-code", async (req, res) => {
  const email = (req.body?.email || "").trim().toLowerCase();

  if (!isValidEmail(email)) {
    return res.status(400).json({ message: "Enter a valid email address." });
  }

  const transporter = createTransporter();
  if (!transporter) {
    if (returnDevCode) {
      const code = generateCode();
      const expiresAt = Date.now() + VERIFY_CODE_TTL_MS;
      verificationStore.set(email, { code, expiresAt, attempts: 0 });
      return res.status(200).json({
        sent: false,
        devCode: code,
        message: "Email service not configured. Using dev code.",
      });
    }

    return res.status(500).json({
      message: "Email service not configured. Contact support.",
    });
  }

  const code = generateCode();
  const expiresAt = Date.now() + VERIFY_CODE_TTL_MS;

  // Store code
  verificationStore.set(email, { code, expiresAt, attempts: 0 });

  // SEND EMAIL
  try {
    await transporter.sendMail({
      from: fromAddress || user,
      to: email,
      subject: "SafeRide Guardian - Verification Code",
      text: `Your SafeRide verification code is: ${code}\n\nIt expires in 10 minutes.\n\nSafeRide Team`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
          <h2>🛡️ SafeRide Guardian</h2>
          <p>Your verification code is:</p>
          <div style="background: #f0f0f0; padding: 20px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px;">
            ${code}
          </div>
          <p>This code expires in <strong>10 minutes</strong>.</p>
          <hr>
          <p>Thank you for using SafeRide Guardian!</p>
        </div>
      `,
    });

    console.log(`✅ Verification code sent to ${email}`);
    return res.status(200).json({
      sent: true,
      ...(returnDevCode ? { devCode: code } : {}),
    });
  } catch (error) {
    console.error("❌ Email error:", error);
    verificationStore.delete(email); // Cleanup on fail
    if (returnDevCode) {
      const fallbackCode = generateCode();
      const expiresAt = Date.now() + VERIFY_CODE_TTL_MS;
      verificationStore.set(email, {
        code: fallbackCode,
        expiresAt,
        attempts: 0,
      });
      return res.status(200).json({
        sent: false,
        devCode: fallbackCode,
        message: "Email failed. Using dev code.",
      });
    }

    return res.status(500).json({
      message: "Failed to send verification email.",
    });
  }
});

// Verify code endpoint
router.post("/verify-code", (req, res) => {
  const email = (req.body?.email || "").trim().toLowerCase();
  const code = String(req.body?.code || "").trim();

  if (!isValidEmail(email) || code.length !== 6) {
    return res.status(400).json({ message: "Invalid email or code." });
  }

  const result = consumeVerificationCode(email, code);
  if (!result.ok) {
    return res.status(result.status).json({ message: result.message });
  }

  console.log(`✅ Email verified: ${email}`);
  return res.status(200).json({ verified: true });
});

router.post("/register", async (req, res) => {
  try {
    const role = (req.body?.role || "").trim();
    const name = (req.body?.name || "").trim();
    const phone = (req.body?.phone || "").trim();
    const password = String(req.body?.password || "").trim();

    if (!role || !name || !phone || password.length < 6) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    if (!ROLES.includes(role)) {
      return res.status(400).json({ message: "Invalid role." });
    }

    let email = (req.body?.email || "").trim().toLowerCase();
    const professionalId = (req.body?.professionalId || "").trim();
    const officialEmail = (req.body?.officialEmail || "").trim().toLowerCase();

    if (isOfficialRole(role)) {
      if (!isValidProfessionalId(role, professionalId)) {
        return res
          .status(400)
          .json({ message: "Invalid professional ID format." });
      }
      if (!isValidOfficialEmail(role, officialEmail)) {
        return res
          .status(400)
          .json({ message: "Official email domain required." });
      }
      email = officialEmail;
    } else {
      if (!isValidEmail(email)) {
        return res.status(400).json({ message: "Enter a valid email." });
      }
      if (!req.body?.isVerified) {
        return res.status(400).json({ message: "Email not verified." });
      }
    }

    const existingUser = await User.findOne({ email }).lean();
    if (existingUser) {
      return res.status(409).json({ message: "Account already exists." });
    }

    if (isOfficialRole(role)) {
      const existingProfessional = await User.findOne({
        professionalId,
      }).lean();
      if (existingProfessional) {
        return res
          .status(409)
          .json({ message: "Professional ID already registered." });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const payload = {
      email,
      name,
      phone,
      role,
      password: hashedPassword,
      professionalId: professionalId || undefined,
      officialEmail: officialEmail || undefined,
      travelNumber: req.body?.travelNumber || undefined,
      travelRoute: req.body?.travelRoute || undefined,
      travelTiming: req.body?.travelTiming || undefined,
      driverName: req.body?.driverName || undefined,
      conductorName: req.body?.conductorName || undefined,
      vehicleNumber: req.body?.vehicleNumber || undefined,
      dutyRoute: req.body?.dutyRoute || undefined,
      shiftTiming: req.body?.shiftTiming || undefined,
      fromStop: req.body?.fromStop || undefined,
      toStop: req.body?.toStop || undefined,
      pnrRange: req.body?.pnrRange || undefined,
      jurisdiction: req.body?.jurisdiction || undefined,
      approvalStatus: isOfficialRole(role) ? "pending" : "approved",
      approvalRequestedAt: isOfficialRole(role) ? new Date() : undefined,
      isVerified: Boolean(req.body?.isVerified),
    };

    if (role === "Passenger") {
      if (
        !payload.travelNumber ||
        !payload.travelRoute ||
        !payload.travelTiming
      ) {
        return res
          .status(400)
          .json({ message: "Passenger travel details required." });
      }
    }

    if (role === "Driver" || role === "Conductor") {
      if (
        !payload.vehicleNumber ||
        !payload.dutyRoute ||
        !payload.shiftTiming ||
        !payload.fromStop ||
        !payload.toStop
      ) {
        return res.status(400).json({ message: "Duty details required." });
      }
    }

    if (isOfficialRole(role)) {
      if (!payload.pnrRange || !payload.jurisdiction) {
        return res
          .status(400)
          .json({ message: "Official duty details required." });
      }
    }

    const created = await User.create(payload);
    return res.status(201).json({
      id: created._id,
      role: created.role,
      email: created.email,
      approvalStatus: created.approvalStatus,
    });
  } catch (error) {
    console.error("Register error:", error.message);
    return res.status(500).json({ message: "Unable to register." });
  }
});

router.post("/login", async (req, res) => {
  try {
    const role = (req.body?.role || "").trim();
    const password = String(req.body?.password || "").trim();
    const method = (req.body?.method || "password").trim();
    const email = (req.body?.email || "").trim().toLowerCase();
    const professionalId = (req.body?.professionalId || "").trim();

    if (!role || !ROLES.includes(role)) {
      return res.status(400).json({ message: "Role is required." });
    }

    let user;
    if (isOfficialRole(role)) {
      if (!isValidProfessionalId(role, professionalId)) {
        return res
          .status(400)
          .json({ message: "Invalid professional ID format." });
      }
      user = await User.findOne({ professionalId, role });
    } else {
      if (!isValidEmail(email)) {
        return res.status(400).json({ message: "Enter a valid email." });
      }
      user = await User.findOne({ email, role });
    }

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    if (user.approvalStatus && user.approvalStatus !== "approved") {
      return res.status(403).json({ message: "Account pending approval." });
    }

    if (isOfficialRole(role)) {
      if (password.length < 6) {
        return res.status(400).json({ message: "Password required." });
      }
      const matches = await bcrypt.compare(password, user.password);
      if (!matches) {
        return res.status(401).json({ message: "Invalid credentials." });
      }
    } else if (method === "otp") {
      const code = String(req.body?.otpCode || "").trim();
      if (!code || code.length !== 6) {
        return res.status(400).json({ message: "OTP code required." });
      }
      const result = consumeVerificationCode(email, code);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.message });
      }
    } else {
      if (password.length < 6) {
        return res.status(400).json({ message: "Password required." });
      }
      const matches = await bcrypt.compare(password, user.password);
      if (!matches) {
        return res.status(401).json({ message: "Invalid credentials." });
      }
    }

    return res.status(200).json({
      id: user._id,
      role: user.role,
      email: user.email,
      name: user.name,
    });
  } catch (error) {
    console.error("Login error:", error.message);
    return res.status(500).json({ message: "Unable to log in." });
  }
});

module.exports = router;
