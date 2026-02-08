const express = require("express");
const nodemailer = require("nodemailer");
const router = express.Router();
const dotenv = require("dotenv");

dotenv.config();

const VERIFY_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;
const verificationStore = new Map();
const user = (process.env.EMAIL_USER || "").trim();
const pass = (process.env.EMAIL_PASS || "").replace(/\s+/g, "");
const returnDevCode = String(process.env.RETURN_VERIFY_CODE || "").toLowerCase() === "true";

const createTransporter = () => {
  if (!user || !pass) return null;

  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // true for 465, false for other ports
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
      from: user,
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
      verificationStore.set(email, { code: fallbackCode, expiresAt, attempts: 0 });
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

  const record = verificationStore.get(email);
  if (!record) {
    return res.status(400).json({ message: "No verification code found." });
  }

  if (Date.now() > record.expiresAt) {
    verificationStore.delete(email);
    return res.status(400).json({ message: "Code expired. Resend new code." });
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    verificationStore.delete(email);
    return res.status(429).json({ message: "Too many attempts. Resend code." });
  }

  if (record.code !== code) {
    record.attempts += 1;
    verificationStore.set(email, record);
    return res.status(400).json({ message: "Incorrect code." });
  }

  // SUCCESS
  verificationStore.delete(email);
  console.log(`✅ Email verified: ${email}`);
  return res.status(200).json({ verified: true });
});

module.exports = router;
