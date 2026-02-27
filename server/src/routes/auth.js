const express = require("express");
const nodemailer = require("nodemailer");
const bcrypt = require("bcryptjs");
const router = express.Router();
const dotenv = require("dotenv");
const User = require("../models/User");

dotenv.config();

const VERIFY_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const RESET_CODE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;
const verificationStore = new Map();
const resetPasswordStore = new Map();
const user = (process.env.EMAIL_USER || "").trim();
const pass = (process.env.EMAIL_PASS || "").replace(/\s+/g, "");
const fromAddress = (process.env.EMAIL_FROM || user).trim();
const returnDevCode =
  String(process.env.RETURN_VERIFY_CODE || "").toLowerCase() === "true";
const ROLES = ["Passenger", "Driver/Conductor", "Cab/Auto", "TTR/RPF/Police"];
const OFFICIAL_DOMAINS = {
  "TTR/RPF/Police": ["railnet.gov.in", "tnpolice.gov.in"],
};
const OFFICIAL_ROLES = new Set(["TTR/RPF/Police"]);
const OPERATIONAL_ROLES = new Set(["Driver/Conductor", "Cab/Auto"]);

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

const getOfficialDomains = (role) => OFFICIAL_DOMAINS[role] || [];

const isValidOfficialEmail = (role, emailValue) => {
  const trimmed = (emailValue || "").trim().toLowerCase();
  if (!isValidEmail(trimmed)) {
    return false;
  }
  return getOfficialDomains(role).some((domain) =>
    trimmed.endsWith(`@${domain}`),
  );
};

const isValidProfessionalId = (role, idValue) => {
  const normalized = (idValue || "").trim().toUpperCase();
  if (role === "TTR/RPF/Police") {
    return (
      /^TNPOLICE-\d{4,6}$/.test(normalized) ||
      /^(TTR|RPF)-[A-Z]{2,3}-\d{4,6}$/.test(normalized)
    );
  }
  return normalized.length >= 6;
};

const normalizeProfessionalId = (value) => (value || "").trim().toUpperCase();

const findOfficialByProfessionalId = async (role, professionalId) => {
  const normalized = normalizeProfessionalId(professionalId);
  const candidates = await User.find({ role }).select("+password");
  return (
    candidates.find(
      (candidate) =>
        normalizeProfessionalId(candidate.professionalId) === normalized,
    ) || null
  );
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
      if (!isValidEmail(officialEmail)) {
        return res.status(400).json({ message: "Enter a valid email." });
      }
      if (!req.body?.isVerified) {
        return res.status(400).json({ message: "Email not verified." });
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
      const existingProfessional = await findOfficialByProfessionalId(
        role,
        professionalId,
      );
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
      travelType: req.body?.travelType || undefined,
      travelNumber: req.body?.travelNumber || undefined,
      travelName: req.body?.travelName || undefined,
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

    if (OPERATIONAL_ROLES.has(role)) {
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

    const isOtp = method === "otp";
    let user;
    if (isOtp) {
      if (isOfficialRole(role)) {
        if (!isValidOfficialEmail(role, email)) {
          return res
            .status(400)
            .json({ message: "Official email domain required." });
        }
      } else if (!isValidEmail(email)) {
        return res.status(400).json({ message: "Enter a valid email." });
      }
      user = await User.findOne({ email, role });
    } else if (isOfficialRole(role)) {
      if (!isValidProfessionalId(role, professionalId)) {
        return res
          .status(400)
          .json({ message: "Invalid professional ID format." });
      }
      user = await findOfficialByProfessionalId(role, professionalId);
    } else {
      if (!isValidEmail(email)) {
        return res.status(400).json({ message: "Enter a valid email." });
      }
      user = await User.findOne({ email, role }).select("+password");
    }

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    if (user.approvalStatus && user.approvalStatus !== "approved") {
      return res.status(403).json({ message: "Account pending approval." });
    }

    if (isOfficialRole(role) && !isOtp) {
      if (password.length < 6) {
        return res.status(400).json({ message: "Password required." });
      }
      const matches = await bcrypt.compare(password, user.password);
      if (!matches) {
        return res.status(401).json({ message: "Invalid credentials." });
      }
    } else if (isOtp) {
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

    const safeUser =
      typeof user.toSafeObject === "function" ? user.toSafeObject() : user;

    return res.status(200).json({
      user: safeUser,
    });
  } catch (error) {
    console.error("Login error:", error.message);
    return res.status(500).json({ message: "Unable to log in." });
  }
});

// Verify reset code for official users - For two-step password reset
router.post("/verify-reset-code", async (req, res) => {
  try {
    const officialEmail = (req.body?.officialEmail || "").trim().toLowerCase();
    const resetCode = String(req.body?.resetCode || "").trim();

    console.log("Verify reset code request:", { officialEmail, resetCode });

    if (!isValidEmail(officialEmail) || resetCode.length !== 6) {
      return res.status(400).json({
        valid: false,
        message: "Invalid email or reset code format.",
      });
    }

    const record = resetPasswordStore.get(officialEmail);
    console.log("Reset code record found:", !!record);
    console.log("Store contents:", Array.from(resetPasswordStore.keys()));

    if (!record) {
      return res.status(400).json({
        valid: false,
        message: "No reset code found. Request a new one.",
      });
    }

    if (Date.now() > record.expiresAt) {
      resetPasswordStore.delete(officialEmail);
      return res.status(400).json({
        valid: false,
        message: "Reset code expired. Request a new one.",
      });
    }

    if (record.attempts >= MAX_ATTEMPTS) {
      resetPasswordStore.delete(officialEmail);
      return res.status(429).json({
        valid: false,
        message: "Too many attempts. Request a new code.",
      });
    }

    console.log("Code comparison:", { stored: record.code, provided: resetCode });

    if (record.code !== resetCode) {
      record.attempts += 1;
      resetPasswordStore.set(officialEmail, record);
      return res.status(400).json({
        valid: false,
        message: "Incorrect reset code.",
      });
    }

    // Code is valid, don't delete it yet (will be deleted when password is reset)
    console.log("Reset code verified successfully");
    return res.status(200).json({
      valid: true,
      message: "Reset code verified successfully.",
    });
  } catch (error) {
    console.error("Verify reset code error:", error.message);
    return res.status(500).json({
      valid: false,
      message: "Unable to verify reset code.",
    });
  }
});

// Verify reset code for regular users - For two-step password reset
router.post("/verify-reset-code-user", async (req, res) => {
  try {
    const email = (req.body?.email || "").trim().toLowerCase();
    const otpCode = String(req.body?.otpCode || "").trim();

    if (!isValidEmail(email) || otpCode.length !== 6) {
      return res.status(400).json({
        valid: false,
        message: "Invalid email or verification code format.",
      });
    }

    const record = verificationStore.get(email);
    if (!record) {
      return res.status(400).json({
        valid: false,
        message: "No verification code found.",
      });
    }

    if (Date.now() > record.expiresAt) {
      verificationStore.delete(email);
      return res.status(400).json({
        valid: false,
        message: "Code expired. Resend new code.",
      });
    }

    if (record.attempts >= MAX_ATTEMPTS) {
      verificationStore.delete(email);
      return res.status(429).json({
        valid: false,
        message: "Too many attempts. Resend code.",
      });
    }

    if (record.code !== otpCode) {
      record.attempts += 1;
      verificationStore.set(email, record);
      return res.status(400).json({
        valid: false,
        message: "Incorrect code.",
      });
    }

    // Code is valid, don't delete it yet (will be deleted when password is reset)
    return res.status(200).json({
      valid: true,
      message: "Verification code verified successfully.",
    });
  } catch (error) {
    console.error("Verify reset code user error:", error.message);
    return res.status(500).json({
      valid: false,
      message: "Unable to verify code.",
    });
  }
});

module.exports = router;

// Password Reset - Send reset code
router.post("/forgot-password", async (req, res) => {
  try {
    const role = (req.body?.role || "").trim();
    const professionalId = (req.body?.professionalId || "").trim();
    const officialEmail = (req.body?.officialEmail || "").trim().toLowerCase();

    if (!role || role !== "TTR/RPF/Police") {
      return res.status(400).json({
        message: "Password reset only available for TTR/RPF/Police users.",
      });
    }

    if (!isValidProfessionalId(role, professionalId)) {
      return res.status(400).json({
        message: "Invalid professional ID format.",
      });
    }

    if (!isValidOfficialEmail(role, officialEmail)) {
      return res.status(400).json({
        message: "Official email domain required.",
      });
    }

    const user = await User.findOne({
      role,
      professionalId,
      officialEmail,
    });

    if (!user) {
      return res.status(404).json({
        message: "No account found with these credentials.",
      });
    }

    const transporter = createTransporter();
    if (!transporter) {
      if (returnDevCode) {
        const resetCode = generateCode();
        const expiresAt = Date.now() + RESET_CODE_TTL_MS;

        console.log("Dev mode - Storing reset code:", { officialEmail, resetCode });

        resetPasswordStore.set(officialEmail, {
          code: resetCode,
          expiresAt,
          attempts: 0,
          userId: user._id.toString(),
        });
        return res.status(200).json({
          sent: false,
          devCode: resetCode,
          message: "Email service not configured. Using dev code.",
        });
      }

      return res.status(500).json({
        message: "Email service not configured. Contact support.",
      });
    }

    const resetCode = generateCode();
    const expiresAt = Date.now() + RESET_CODE_TTL_MS;

    console.log("Storing reset code:", { officialEmail, resetCode, timestamp: new Date().toISOString() });

    resetPasswordStore.set(officialEmail, {
      code: resetCode,
      expiresAt,
      attempts: 0,
      userId: user._id.toString(),
    });

    console.log("Reset code stored in memory store");

    try {
      await transporter.sendMail({
        from: fromAddress || user,
        to: officialEmail,
        subject: "SafeRide Guardian - Password Reset Code",
        text: `Your SafeRide password reset code is: ${resetCode}\n\nIt expires in 15 minutes.\n\nIf you didn't request this, please ignore this email.\n\nSafeRide Team`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
            <h2>🛡️ SafeRide Guardian</h2>
            <p>You requested a password reset. Your reset code is:</p>
            <div style="background: #f0f0f0; padding: 20px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px;">
              ${resetCode}
            </div>
            <p>This code expires in <strong>15 minutes</strong>.</p>
            <p>If you didn't request this password reset, please ignore this email.</p>
            <hr>
            <p>Thank you for using SafeRide Guardian!</p>
          </div>
        `,
      });

      console.log(`✅ Password reset code sent to ${officialEmail}`);
      return res.status(200).json({
        sent: true,
        ...(returnDevCode ? { devCode: resetCode } : {}),
      });
    } catch (error) {
      console.error("❌ Email error:", error);
      resetPasswordStore.delete(officialEmail);

      if (returnDevCode) {
        const fallbackCode = generateCode();
        const expiresAt = Date.now() + RESET_CODE_TTL_MS;
        resetPasswordStore.set(officialEmail, {
          code: fallbackCode,
          expiresAt,
          attempts: 0,
          userId: user._id.toString(),
        });
        return res.status(200).json({
          sent: false,
          devCode: fallbackCode,
          message: "Email failed. Using dev code.",
        });
      }

      return res.status(500).json({
        message: "Failed to send reset email.",
      });
    }
  } catch (error) {
    console.error("Forgot password error:", error.message);
    return res.status(500).json({ message: "Unable to process request." });
  }
});

// Password Reset - Verify reset code and update password
router.post("/reset-password", async (req, res) => {
  try {
    const officialEmail = (req.body?.officialEmail || "").trim().toLowerCase();
    const resetCode = String(req.body?.resetCode || "").trim();
    const newPassword = String(req.body?.newPassword || "").trim();

    if (!isValidEmail(officialEmail) || resetCode.length !== 6) {
      return res.status(400).json({
        message: "Invalid email or reset code.",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters.",
      });
    }

    const record = resetPasswordStore.get(officialEmail);
    if (!record) {
      return res.status(400).json({
        message: "No reset code found. Request a new one.",
      });
    }

    if (Date.now() > record.expiresAt) {
      resetPasswordStore.delete(officialEmail);
      return res.status(400).json({
        message: "Reset code expired. Request a new one.",
      });
    }

    if (record.attempts >= MAX_ATTEMPTS) {
      resetPasswordStore.delete(officialEmail);
      return res.status(429).json({
        message: "Too many attempts. Request a new code.",
      });
    }

    if (record.code !== resetCode) {
      record.attempts += 1;
      resetPasswordStore.set(officialEmail, record);
      return res.status(400).json({
        message: "Incorrect reset code.",
      });
    }

    const user = await User.findById(record.userId);
    if (!user) {
      resetPasswordStore.delete(officialEmail);
      return res.status(404).json({
        message: "User not found.",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    resetPasswordStore.delete(officialEmail);

    console.log(`✅ Password reset successful for: ${officialEmail}`);
    return res.status(200).json({
      success: true,
      message: "Password reset successful. You can now login.",
    });
  } catch (error) {
    console.error("Reset password error:", error.message);
    return res.status(500).json({ message: "Unable to reset password." });
  }
});

// Password Reset with OTP - For official roles using email verification
router.post("/reset-password-otp", async (req, res) => {
  try {
    const officialEmail = (req.body?.officialEmail || "").trim().toLowerCase();
    const otpCode = String(req.body?.otpCode || "").trim();
    const newPassword = String(req.body?.newPassword || "").trim();

    if (!isValidEmail(officialEmail) || otpCode.length !== 6) {
      return res.status(400).json({
        message: "Invalid email or verification code.",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters.",
      });
    }

    // Verify OTP code
    const result = consumeVerificationCode(officialEmail, otpCode);
    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }

    // Find user by official email
    const user = await User.findOne({ officialEmail });
    if (!user) {
      return res.status(404).json({
        message: "No account found with this email.",
      });
    }

    // Update password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    console.log(`✅ Password reset successful via OTP for: ${officialEmail}`);
    return res.status(200).json({
      success: true,
      message: "Password reset successful. You can now login.",
    });
  } catch (error) {
    console.error("Reset password OTP error:", error.message);
    return res.status(500).json({ message: "Unable to reset password." });
  }
});

// Password Reset with OTP - For non-official roles (Passenger, Driver/Conductor, Cab/Auto)
router.post("/reset-password-user", async (req, res) => {
  try {
    const email = (req.body?.email || "").trim().toLowerCase();
    const otpCode = String(req.body?.otpCode || "").trim();
    const newPassword = String(req.body?.newPassword || "").trim();

    if (!isValidEmail(email) || otpCode.length !== 6) {
      return res.status(400).json({
        message: "Invalid email or verification code.",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters.",
      });
    }

    // Verify OTP code
    const result = consumeVerificationCode(email, otpCode);
    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }

    // Find user by email (for non-official roles)
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        message: "No account found with this email.",
      });
    }

    // Update password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    console.log(`✅ Password reset successful via OTP for: ${email}`);
    return res.status(200).json({
      success: true,
      message: "Password reset successful. You can now login.",
    });
  } catch (error) {
    console.error("Reset password user error:", error.message);
    return res.status(500).json({ message: "Unable to reset password." });
  }
});
