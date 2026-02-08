const express = require("express");
const nodemailer = require("nodemailer");

const router = express.Router();

const VERIFY_CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const verificationStore = new Map();

const normalizeEmail = (email) =>
  String(email || "")
    .trim()
    .toLowerCase();

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const generateCode = () => String(Math.floor(100000 + Math.random() * 900000));


let cachedTransporter = null;

const buildTransporter = async () => {
  if (cachedTransporter) return cachedTransporter;

  const user = process.env.EMAIL_USER || "";
  const pass = (process.env.EMAIL_PASS || "").replace(/\s+/g, "");
  if (!user || !pass) return null;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  if (process.env.NODE_ENV !== "production") {
    try {
      await transporter.verify();
      console.info("[mail] Transporter verified: ready to send emails");
    } catch (e) {
      console.error("[mail] Transporter verification failed:", e?.message || e);
    }
  }

  cachedTransporter = transporter;
  return cachedTransporter;
};

router.post("/send-verify-code", async (req, res) => {
  const email = normalizeEmail(req.body?.email);

  if (!isValidEmail(email)) {
    return res.status(400).json({ message: "Enter a valid email address." });
  }

  const code = generateCode();
  const expiresAt = Date.now() + VERIFY_CODE_TTL_MS;

  verificationStore.set(email, { code, expiresAt, attempts: 0 });

  const transporter = await buildTransporter();
  if (!transporter) {
    verificationStore.delete(email);
    return res.status(500).json({
      message:
        "Email service is not configured. Set EMAIL_USER and EMAIL_PASS.",
    });
  }

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER || "",
      to: email,
      subject: "SafeRide Guardian verification code",
      text: `Your verification code is ${code}. It expires in 10 minutes.`,
    });

    return res.status(200).json({ sent: true });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[mail] sendMail failed:", error?.message || error);
    }
    return res.status(500).json({
      message: "Unable to send verification email right now.",
    });
  }
});

router.post("/verify-code", (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const code = String(req.body?.code || "").trim();

  if (!isValidEmail(email) || code.length !== 6) {
    return res.status(400).json({ message: "Invalid verification request." });
  }

  const record = verificationStore.get(email);

  if (!record) {
    return res.status(400).json({ message: "Verification code not found." });
  }

  if (Date.now() > record.expiresAt) {
    verificationStore.delete(email);
    return res.status(400).json({ message: "Verification code expired." });
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    verificationStore.delete(email);
    return res.status(429).json({ message: "Too many attempts. Resend code." });
  }

  if (record.code !== code) {
    record.attempts += 1;
    verificationStore.set(email, record);
    return res.status(400).json({ message: "Incorrect verification code." });
  }

  verificationStore.delete(email);
  return res.status(200).json({ verified: true });
});

module.exports = router;
