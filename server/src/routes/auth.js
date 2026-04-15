const express = require("express");
const nodemailer = require("nodemailer");
const bcrypt = require("bcryptjs");
const router = express.Router();
const User = require("../models/User");
const DutyAttendance = require("../models/DutyAttendance");
const {
  DEMO_DUTY_ROSTER,
  buildDutyRoster,
  inferDutyUnit,
  inferDutyUnitFromProfessionalId,
  normalizeDutyUnit,
  toDutyOfficer,
} = require("../utils/dutyRoster");

const VERIFY_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const RESET_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;
const PASSWORD_MIN_LENGTH = 6;
const verificationStore = new Map();
const resetPasswordStore = new Map();

// Periodic logging of store state for debugging
setInterval(() => {
  if (verificationStore.size > 0 || resetPasswordStore.size > 0) {
    console.log("\n📊 STORE STATE CHECK:", new Date().toISOString());
    console.log("Verification Store:", Array.from(verificationStore.entries()).map(([k, v]) => ({ 
      email: k, 
      code: v.code,
      expiresAt: new Date(v.expiresAt).toISOString(),
      expiresIn: Math.round((v.expiresAt - Date.now()) / 1000) + "s",
      isExpired: Date.now() > v.expiresAt
    })));
    console.log("Reset Password Store:", Array.from(resetPasswordStore.entries()).map(([k, v]) => ({ 
      email: k, 
      code: v.code,
      expiresAt: new Date(v.expiresAt).toISOString(),
      expiresIn: Math.round((v.expiresAt - Date.now()) / 1000) + "s",
      isExpired: Date.now() > v.expiresAt
    })));
  }
}, 30000); // Log every 30 seconds if stores have data

const DEFAULT_RESET_SENDER = "divyadharshana3@gmail.com";
const mailUser = (
  process.env.RESET_EMAIL_USER ||
  process.env.EMAIL_USER ||
  DEFAULT_RESET_SENDER
).trim();
const pass = String(
  process.env.RESET_EMAIL_PASS ||
    process.env.EMAIL_PASS ||
    process.env.GMAIL_APP_PASSWORD ||
    "",
).replace(/\s+/g, "");
const fromAddress = (
  process.env.RESET_EMAIL_FROM ||
  process.env.EMAIL_FROM ||
  `SafeRide Guardian <${DEFAULT_RESET_SENDER}>`
).trim();
const ROLES = ["Passenger", "Driver/Conductor", "Cab/Auto", "TTR/RPF/Police"];
const OFFICIAL_DOMAINS = {
  "TTR/RPF/Police": ["railnet.gov.in", "tnpolice.gov.in"],
};
const OFFICIAL_ROLES = new Set(["TTR/RPF/Police"]);
const OPERATIONAL_ROLES = new Set(["Driver/Conductor", "Cab/Auto"]);
const demoDutySessions = new Map();

const createTransporter = () => {
  if (!mailUser || !pass) return null;

  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    requireTLS: true,
    auth: {
      user: mailUser,
      pass,
    },
    tls: {
      rejectUnauthorized: true,
    },
  });
};

const getEmailServiceUnavailableMessage = () =>
  `Email service not configured. Set RESET_EMAIL_PASS or EMAIL_PASS for ${mailUser}.`;

const canUseDevOtpFallback = () => {
  const explicitFlag = String(process.env.RETURN_VERIFY_CODE || "").trim().toLowerCase();
  if (explicitFlag === "true") {
    return true;
  }

  return process.env.NODE_ENV !== "production";
};

const getEmailSendFailureMessage = (error) => {
  const responseCode = Number(error?.responseCode || 0);
  const responseText = String(error?.response || "");

  if (error?.code === "EAUTH" || responseCode === 535) {
    return `Gmail sign-in failed for ${mailUser}. Update RESET_EMAIL_PASS or EMAIL_PASS with a valid Google App Password.`;
  }

  if (responseCode === 550 || /recipient/i.test(responseText)) {
    return "Recipient email address was rejected by the mail server.";
  }

  return "Failed to send verification email. Please try again.";
};

// Generate 6-digit code
const generateCode = () => String(Math.floor(100000 + Math.random() * 900000));

// Email validation
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const normalizeEmail = (value) => (value || "").trim().toLowerCase();

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
      /^(TTR|TTE|RPF)-[A-Z]{2,3}-\d{4,6}$/.test(normalized)
    );
  }
  return normalized.length >= 6;
};

const normalizeProfessionalId = (value) => (value || "").trim().toUpperCase();

const isStrongPassword = (passwordValue) => {
  const password = String(passwordValue || "");
  return password.length >= PASSWORD_MIN_LENGTH;
};

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

const getDutyUnitFromRequest = (req) => {
  return (
    normalizeDutyUnit(req.body?.dutyUnit) ||
    normalizeDutyUnit(req.body?.specificRole) ||
    inferDutyUnitFromProfessionalId(req.body?.professionalId) ||
    inferDutyUnit(req.body || {})
  );
};

const getDutyOfficerRecord = async (req) => {
  const email = normalizeEmail(req.body?.email || req.headers["x-user-email"]);
  const professionalId = normalizeProfessionalId(
    req.body?.professionalId || req.headers["x-professional-id"],
  );

  let user = null;
  if (email) {
    user = await findUserByEmail(email, { role: "TTR/RPF/Police" });
  }

  if (!user && professionalId) {
    user = await findOfficialByProfessionalId("TTR/RPF/Police", professionalId);
  }

  if (user) {
    return toDutyOfficer(user.toSafeObject ? user.toSafeObject() : user);
  }

  const matchingDemo = DEMO_DUTY_ROSTER.find((officer) => {
    if (email && officer.staffEmail === email) {
      return true;
    }
    if (professionalId && officer.professionalId === professionalId) {
      return true;
    }
    const requestedUnit = getDutyUnitFromRequest(req);
    return requestedUnit && officer.dutyUnit === requestedUnit;
  });

  return matchingDemo ? toDutyOfficer(matchingDemo, { isDemo: true }) : null;
};

const toDutyResponse = (officer) => ({
  officer,
  onDuty: Boolean(officer?.onDutyStatus),
});

const buildOfficerKey = (officer = {}) => {
  return (
    normalizeEmail(officer.staffEmail || officer.email) ||
    normalizeProfessionalId(officer.professionalId) ||
    String(officer.staffId || officer._id || "").trim().toLowerCase() ||
    ""
  );
};

const normalizeAttendance = (session) => {
  if (!session) {
    return null;
  }

  return {
    id: session._id?.toString?.() || session.id || null,
    officerKey: session.officerKey,
    officerId: session.officerId || null,
    officerEmail: session.officerEmail || null,
    professionalId: session.professionalId || null,
    officerName: session.officerName,
    role: session.role || "TTR/RPF/Police",
    dutyUnit: session.dutyUnit || null,
    assignedTrain: session.assignedTrain || null,
    assignedRoute: session.assignedRoute || null,
    assignedStation: session.assignedStation || null,
    assignedShift: session.assignedShift || null,
    checkInTime: session.checkInTime || null,
    checkOutTime: session.checkOutTime || null,
    status: session.status || "INACTIVE",
    notes: session.notes || null,
    source: session.source || "db",
    createdAt: session.createdAt || null,
    updatedAt: session.updatedAt || null,
  };
};

const getAttendancePayload = (req, officer) => ({
  officerKey: buildOfficerKey(officer),
  officerId: officer.staffId || null,
  officerEmail: normalizeEmail(officer.staffEmail || officer.email),
  professionalId: normalizeProfessionalId(officer.professionalId),
  officerName: officer.staffName || officer.name || "Duty Officer",
  role: officer.staffRole || officer.role || "TTR/RPF/Police",
  dutyUnit: getDutyUnitFromRequest(req) || officer.dutyUnit || "TTR",
  assignedTrain: String(req.body?.assignedTrain || req.body?.dutyTrain || "").trim() || null,
  assignedRoute: String(req.body?.assignedRoute || req.body?.dutyRoute || "").trim() || null,
  assignedStation:
    String(req.body?.assignedStation || req.body?.dutyStation || "").trim() ||
    officer.dutyStation ||
    null,
  assignedShift: String(req.body?.assignedShift || req.body?.shift || "").trim() || null,
  notes: String(req.body?.dutyNote || "").trim() || null,
});

const getActiveAttendance = async (officerKey) => {
  if (!officerKey) {
    return null;
  }
  return DutyAttendance.findOne({ officerKey, status: "ACTIVE" }).sort({ createdAt: -1 });
};

const getLatestAttendance = async (officerKey) => {
  if (!officerKey) {
    return null;
  }
  return DutyAttendance.findOne({ officerKey }).sort({ createdAt: -1 });
};

const hasMatchingEmail = (user, emailValue) => {
  const normalized = normalizeEmail(emailValue);

  if (!user || !normalized) {
    return false;
  }

  return [user.email, user.officialEmail].some(
    (candidate) => normalizeEmail(candidate) === normalized,
  );
};

const findUserByEmail = async (
  emailValue,
  { role, includePassword = false } = {},
) => {
  const normalized = normalizeEmail(emailValue);

  if (!normalized) {
    return null;
  }

  let directLookup = User.findOne(
    role ? { email: normalized, role } : { email: normalized },
  );
  if (includePassword) {
    directLookup = directLookup.select("+password");
  }

  const directMatch = await directLookup;
  if (directMatch) {
    return directMatch;
  }

  let fallbackLookup = User.find(role ? { role } : {});
  if (includePassword) {
    fallbackLookup = fallbackLookup.select("+password");
  }

  const candidates = await fallbackLookup;
  return candidates.find((candidate) => hasMatchingEmail(candidate, normalized)) || null;
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
  const purpose = String(req.body?.purpose || "register").trim().toLowerCase();

  console.log(`\n📧 SEND VERIFY CODE for: "${email}"`);
  console.log("Email type:", typeof email, "Length:", email.length);

  if (!isValidEmail(email)) {
    return res.status(400).json({ message: "Enter a valid email address." });
  }

  if (purpose === "register") {
    const existingAccount = await findUserByEmail(email);
    if (existingAccount) {
      return res.status(409).json({
        message: "This email is already registered. Please log in.",
      });
    }
  }

  const transporter = createTransporter();
  if (!transporter) {
    return res.status(500).json({
      message: getEmailServiceUnavailableMessage(),
    });
  }

  const code = generateCode();
  const expiresAt = Date.now() + VERIFY_CODE_TTL_MS;

  // Store code
  verificationStore.set(email, { code, expiresAt, attempts: 0 });

  console.log(`✅ Code stored for "${email}": ${code}, expires at ${new Date(expiresAt).toISOString()}`);
  console.log("Current store contents:", Array.from(verificationStore.entries()).map(([k, v]) => ({ 
    email: JSON.stringify(k),
    emailMatch: k === email,
    code: v.code, 
    expiresAt: new Date(v.expiresAt).toISOString() 
  })));

  // SEND EMAIL
  try {
    await transporter.sendMail({
      from: fromAddress || mailUser,
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
    });
  } catch (error) {
    console.error("❌ Email error:", error);
    if (canUseDevOtpFallback()) {
      console.warn(
        `⚠️ Using dev OTP fallback for ${email}. SMTP delivery failed; returning code in API response.`,
      );
      return res.status(200).json({
        sent: true,
        devCode: code,
        fallback: true,
        message:
          "Email delivery unavailable. Using development OTP fallback.",
      });
    }

    verificationStore.delete(email); // Cleanup on fail
    return res.status(500).json({
      message: getEmailSendFailureMessage(error),
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

// Example: POST http://localhost:5000/api/auth/conegister
// Body: { "role": "passenger", "name": "John Doe", ... }
router.post("/register", async (req, res) => {
  try {
    const role = (req.body?.role || "").trim();
    const name = (req.body?.name || "").trim();
    const phone = (req.body?.phone || "").trim();
    const password = String(req.body?.password || "").trim();

    if (!role || !name || !phone || !password) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({
        message: "Password must be at least 6 characters.",
      });
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


// Example: POST http://localhost:5000/api/auth/login
// Body: { "role": "passenger", "password": "yourpassword" }
router.post("/login", async (req, res) => {
  try {
    const role = (req.body?.role || "").trim();
    const password = String(req.body?.password || "").trim();
    const method = (req.body?.method || "password").trim();
    const email = (req.body?.email || "").trim().toLowerCase();
    const professionalId = (req.body?.professionalId || "").trim();

    console.log(`\n🔐 LOGIN ATTEMPT`, {
      role,
      email: email || "(empty)",
      method,
      professionalId: professionalId || "(empty)",
      passwordLength: password.length,
    });

    if (!role || !ROLES.includes(role)) {
      console.log("❌ Invalid role:", role);
      return res.status(400).json({ message: "Role is required." });
    }

    const isOtp = method === "otp";
    const TEMP_UNIVERSAL_ROLE_LOGIN = true;
    let user;
    if (isOtp) {
      if (isOfficialRole(role)) {
        if (!isValidOfficialEmail(role, email)) {
          console.log("❌ Invalid official email domain");
          return res
            .status(400)
            .json({ message: "Official email domain required." });
        }
      } else if (!isValidEmail(email)) {
        console.log("❌ Invalid email format");
        return res.status(400).json({ message: "Enter a valid email." });
      }
      user = await User.findOne({ email, role });
      console.log(`🔍 OTP login lookup: email=${email}, role=${role}, found=${!!user}`);
    } else if (isOfficialRole(role)) {
      if (isValidEmail(email)) {
        user = TEMP_UNIVERSAL_ROLE_LOGIN
          ? await findUserByEmail(email, { includePassword: true })
          : await findUserByEmail(email, { role, includePassword: true });
        console.log(`🔍 Official email login lookup: email=${email}, role=${role}, universal=${TEMP_UNIVERSAL_ROLE_LOGIN}, found=${!!user}`);
      }

      if (!user && isValidProfessionalId(role, professionalId)) {
        user = await findOfficialByProfessionalId(role, professionalId);
        console.log(`🔍 Official login lookup: professionalId=${professionalId}, role=${role}, found=${!!user}`);
      }

      if (!user) {
        console.log("❌ No official user found with provided email/professional ID");
        return res.status(401).json({ message: "Invalid credentials." });
      }
    } else {
      if (!isValidEmail(email)) {
        console.log("❌ Invalid email format");
        return res.status(400).json({ message: "Enter a valid email." });
      }
      user = TEMP_UNIVERSAL_ROLE_LOGIN
        ? await findUserByEmail(email, { includePassword: true })
        : await User.findOne({ email, role }).select("+password");
      console.log(`🔍 Password login lookup: email=${email}, role=${role}, universal=${TEMP_UNIVERSAL_ROLE_LOGIN}, found=${!!user}`);
      if (user) {
        console.log(`✅ User found, password hash exists=${!!user.password}`, {
          userId: user._id.toString().slice(0, 8),
          userName: user.name,
          userRole: user.role,
          approvalStatus: user.approvalStatus,
        });
      }
    }

    if (!user) {
      console.log("❌ USER NOT FOUND after lookup");
      return res.status(401).json({ message: "Invalid credentials." });
    }

    if (user.approvalStatus && user.approvalStatus !== "approved") {
      return res.status(403).json({ message: "Account pending approval." });
    }

    if (isOfficialRole(role) && !isOtp) {
      if (!password) {
        console.log("❌ Password not provided for official role");
        return res.status(400).json({ message: "Password required." });
      }
      console.log(`🔐 Comparing password (${password.length} chars) with stored hash`);
      const matches = await bcrypt.compare(password, user.password);
      console.log(`🔐 Bcrypt comparison result: ${matches}`);
      if (!matches) {
        console.log(`❌ PASSWORD MISMATCH - password does not match stored hash for ${user.email}`);
        return res.status(401).json({ message: "Invalid credentials." });
      }
      console.log(`✅ PASSWORD MATCH for official ${user.email}`);
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
      if (!password) {
        console.log("❌ Password not provided for regular role");
        return res.status(400).json({ message: "Password required." });
      }
      console.log(`🔐 Comparing password (${password.length} chars) with stored hash for ${user.email}`);
      const matches = await bcrypt.compare(password, user.password);
      console.log(`🔐 Bcrypt comparison result: ${matches}`);
      if (!matches) {
        console.log(`❌ PASSWORD MISMATCH - password does not match stored hash for ${user.email}`);
        return res.status(401).json({ message: "Invalid credentials." });
      }
      console.log(`✅ PASSWORD MATCH for ${user.email}`);
    }

    const safeUser =
      typeof user.toSafeObject === "function" ? user.toSafeObject() : user;

    console.log(`✅ LOGIN SUCCESS for ${user.email} (${user.role})`);
    return res.status(200).json({
      user: safeUser,
    });
  } catch (error) {
    console.error("❌ LOGIN ERROR:", error.message);
    console.error(error.stack);
    return res.status(500).json({ message: "Unable to log in." });
  }
});

router.get("/duty/status", async (req, res) => {
  try {
    const email = normalizeEmail(req.query?.email || req.headers["x-user-email"]);
    const professionalId = normalizeProfessionalId(
      req.query?.professionalId || req.headers["x-professional-id"],
    );

    let user = null;
    if (email) {
      user = await findUserByEmail(email, { role: "TTR/RPF/Police" });
    }

    if (!user && professionalId) {
      user = await findOfficialByProfessionalId("TTR/RPF/Police", professionalId);
    }

    if (user) {
      const officer = toDutyOfficer(user.toSafeObject ? user.toSafeObject() : user);
      const attendance = await getLatestAttendance(buildOfficerKey(officer));
      return res.json({
        ...toDutyResponse(officer),
        attendance: normalizeAttendance(attendance),
        message: "Duty status retrieved successfully",
      });
    }

    const demoOfficer = DEMO_DUTY_ROSTER.find(
      (officer) => officer.staffEmail === email || officer.professionalId === professionalId,
    );

    if (demoOfficer) {
      const officer = toDutyOfficer(demoOfficer, { isDemo: true });
      const attendance = demoDutySessions.get(buildOfficerKey(officer)) || null;
      return res.json({
        ...toDutyResponse(officer),
        attendance: normalizeAttendance(attendance),
        message: "Duty status retrieved successfully",
      });
    }

    return res.status(404).json({ message: "Duty officer not found." });
  } catch (error) {
    console.error("Duty status error:", error.message);
    return res.status(500).json({ message: "Unable to retrieve duty status." });
  }
});

router.get("/duty/roster", async (req, res) => {
  try {
    const officers = await User.find({
      role: "TTR/RPF/Police",
      approvalStatus: "approved",
      isActive: true,
    }).select("email name professionalId role onDutyStatus dutyCheckInAt dutyCheckOutAt dutyStation dutyDesk dutyUnit dutyNote jurisdiction");

    const roster = buildDutyRoster(officers);
    const data = roster.length > 0
      ? roster
      : DEMO_DUTY_ROSTER.map((officer) => toDutyOfficer(officer, { isDemo: true }));

    return res.json({
      officers: data,
      message: "Duty roster retrieved successfully",
    });
  } catch (error) {
    console.error("Duty roster error:", error.message);
    return res.status(500).json({ message: "Unable to retrieve duty roster." });
  }
});

router.post("/duty/check-in", async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email || req.headers["x-user-email"]);
    const professionalId = normalizeProfessionalId(req.body?.professionalId || req.headers["x-professional-id"]);
    const dutyUnit = getDutyUnitFromRequest(req) || "TTR";

    let user = null;
    if (email) {
      user = await findUserByEmail(email, { role: "TTR/RPF/Police" });
    }
    if (!user && professionalId) {
      user = await findOfficialByProfessionalId("TTR/RPF/Police", professionalId);
    }

    if (!user) {
      const demoOfficer = DEMO_DUTY_ROSTER.find(
        (officer) => officer.staffEmail === email || officer.professionalId === professionalId || officer.dutyUnit === dutyUnit,
      );

      if (!demoOfficer) {
        return res.status(404).json({ message: "Duty officer not found." });
      }

      const rosterOfficer = toDutyOfficer(
        {
          ...demoOfficer,
          onDutyStatus: true,
          dutyCheckInAt: new Date(),
          dutyCheckOutAt: null,
          dutyStation: req.body?.dutyStation || demoOfficer.dutyStation,
          dutyDesk: req.body?.dutyDesk || demoOfficer.dutyDesk,
          dutyUnit,
          dutyNote: req.body?.dutyNote || demoOfficer.dutyNote || null,
        },
        { isDemo: true },
      );

      const officerKey = buildOfficerKey(rosterOfficer);
      const existingDemoSession = demoDutySessions.get(officerKey);
      if (existingDemoSession && existingDemoSession.status === "ACTIVE") {
        return res.status(409).json({ message: "Officer already checked in and active." });
      }

      const attendancePayload = getAttendancePayload(req, rosterOfficer);
      const demoSession = {
        id: `DEMO-ATD-${Date.now()}`,
        ...attendancePayload,
        checkInTime: new Date(),
        checkOutTime: null,
        status: "ACTIVE",
        source: "demo",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      demoDutySessions.set(officerKey, demoSession);

      return res.json({
        officer: rosterOfficer,
        attendance: normalizeAttendance(demoSession),
        message: "Checked in successfully.",
      });
    }

    const officer = toDutyOfficer(user.toSafeObject ? user.toSafeObject() : user);
    const officerKey = buildOfficerKey(officer);
    const activeAttendance = await getActiveAttendance(officerKey);
    if (activeAttendance) {
      return res.status(409).json({ message: "Officer already checked in and active." });
    }

    const attendancePayload = getAttendancePayload(req, officer);
    const attendance = await DutyAttendance.create({
      ...attendancePayload,
      checkInTime: new Date(),
      checkOutTime: null,
      status: "ACTIVE",
      source: "db",
    });

    user.onDutyStatus = true;
    user.dutyCheckInAt = attendance.checkInTime;
    user.dutyCheckOutAt = null;
    user.dutyStation = attendance.assignedStation || req.body?.dutyStation || user.dutyStation || null;
    user.dutyDesk = req.body?.dutyDesk || user.dutyDesk || null;
    user.dutyUnit = attendance.dutyUnit || dutyUnit || user.dutyUnit || null;
    user.dutyNote = attendance.notes || req.body?.dutyNote || user.dutyNote || null;
    await user.save();

    return res.json({
      officer: toDutyOfficer(user.toSafeObject ? user.toSafeObject() : user),
      attendance: normalizeAttendance(attendance),
      message: "Checked in successfully.",
    });
  } catch (error) {
    console.error("Check-in error:", error.message);
    return res.status(500).json({ message: "Unable to check in." });
  }
});

router.post("/duty/check-out", async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email || req.headers["x-user-email"]);
    const professionalId = normalizeProfessionalId(req.body?.professionalId || req.headers["x-professional-id"]);
    const dutyUnit = getDutyUnitFromRequest(req) || "TTR";

    let user = null;
    if (email) {
      user = await findUserByEmail(email, { role: "TTR/RPF/Police" });
    }
    if (!user && professionalId) {
      user = await findOfficialByProfessionalId("TTR/RPF/Police", professionalId);
    }

    if (!user) {
      const demoOfficer = DEMO_DUTY_ROSTER.find(
        (officer) => officer.staffEmail === email || officer.professionalId === professionalId || officer.dutyUnit === dutyUnit,
      );

      if (!demoOfficer) {
        return res.status(404).json({ message: "Duty officer not found." });
      }

      const resolvedDemoOfficer = toDutyOfficer(
          {
            ...demoOfficer,
            onDutyStatus: false,
            dutyCheckInAt: demoOfficer.dutyCheckInAt || null,
            dutyCheckOutAt: new Date(),
          },
          { isDemo: true },
        );
      const officerKey = buildOfficerKey(resolvedDemoOfficer);
      const activeDemoSession = demoDutySessions.get(officerKey);

      if (!activeDemoSession || activeDemoSession.status !== "ACTIVE") {
        return res.status(400).json({ message: "Cannot check out without an active check-in." });
      }

      const closedDemoSession = {
        ...activeDemoSession,
        status: "INACTIVE",
        checkOutTime: new Date(),
        updatedAt: new Date(),
      };
      demoDutySessions.set(officerKey, closedDemoSession);

      return res.json({
        officer: resolvedDemoOfficer,
        attendance: normalizeAttendance(closedDemoSession),
        message: "Checked out successfully.",
      });
    }

    const officer = toDutyOfficer(user.toSafeObject ? user.toSafeObject() : user);
    const officerKey = buildOfficerKey(officer);
    const activeAttendance = await getActiveAttendance(officerKey);
    if (!activeAttendance) {
      return res.status(400).json({ message: "Cannot check out without an active check-in." });
    }

    activeAttendance.status = "INACTIVE";
    activeAttendance.checkOutTime = new Date();
    activeAttendance.notes = String(req.body?.dutyNote || activeAttendance.notes || "").trim() || null;
    await activeAttendance.save();

    user.onDutyStatus = false;
    user.dutyCheckOutAt = activeAttendance.checkOutTime;
    user.dutyNote = activeAttendance.notes || req.body?.dutyNote || user.dutyNote || null;
    await user.save();

    return res.json({
      officer: toDutyOfficer(user.toSafeObject ? user.toSafeObject() : user),
      attendance: normalizeAttendance(activeAttendance),
      message: "Checked out successfully.",
    });
  } catch (error) {
    console.error("Check-out error:", error.message);
    return res.status(500).json({ message: "Unable to check out." });
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

    console.log(`\n🔍 VERIFY RESET CODE for: "${email}"`);
    console.log("Email type:", typeof email, "Length:", email.length);
    console.log("OTP Code:", otpCode ? "***" + otpCode.slice(-2) : "none");
    console.log("All emails in store:", Array.from(verificationStore.keys()).map(k => JSON.stringify(k)));
    
    const storeBeforeCheck = Array.from(verificationStore.entries()).map(([k, v]) => ({ 
      email: JSON.stringify(k),
      emailMatch: k === email,
      code: v.code,
      expiresAt: new Date(v.expiresAt).toISOString()
    }));
    console.log("Store contents before verification:", storeBeforeCheck);

    if (!isValidEmail(email) || otpCode.length !== 6) {
      return res.status(400).json({
        valid: false,
        message: "Invalid email or verification code format.",
      });
    }

    const record = verificationStore.get(email);
    console.log("Verification code record found:", !!record, { email });
    if (record) {
      console.log("Record details:", { 
        code: record.code,
        expiresAt: new Date(record.expiresAt).toISOString(),
        isExpired: Date.now() > record.expiresAt,
        codeMatches: record.code === otpCode
      });
    }

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

    console.log("Code comparison:", { stored: record.code, provided: otpCode });

    if (record.code !== otpCode) {
      record.attempts += 1;
      verificationStore.set(email, record);
      return res.status(400).json({
        valid: false,
        message: "Incorrect code.",
      });
    }

    // Code is valid, don't delete it yet (will be deleted when password is reset)
    console.log(`✅ Verification code verified successfully for: "${email}"`);
    console.log("Code will remain in store for password reset step");
    const storeAfterVerification = Array.from(verificationStore.entries()).map(([k, v]) => ({ 
      email: JSON.stringify(k),
      emailMatch: k === email,
      code: v.code
    }));
    console.log("Store still contains after verification:", storeAfterVerification);
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

// DIAGNOSTIC ENDPOINT - Remove in production
router.get("/debug-store/:email", async (req, res) => {
  const email = (req.params.email || "").trim().toLowerCase();
  
  const verifyRecord = verificationStore.get(email);
  const resetRecord = resetPasswordStore.get(email);
  
  res.json({
    email,
    verificationStore: verifyRecord ? {
      exists: true,
      code: verifyRecord.code,
      expiresAt: new Date(verifyRecord.expiresAt).toISOString(),
      expiresIn: Math.round((verifyRecord.expiresAt - Date.now()) / 1000) + "s",
      isExpired: Date.now() > verifyRecord.expiresAt,
      attempts: verifyRecord.attempts
    } : { exists: false },
    resetPasswordStore: resetRecord ? {
      exists: true,
      code: resetRecord.code,
      expiresAt: new Date(resetRecord.expiresAt).toISOString(),
      expiresIn: Math.round((resetRecord.expiresAt - Date.now()) / 1000) + "s",
      isExpired: Date.now() > resetRecord.expiresAt,
      attempts: resetRecord.attempts
    } : { exists: false },
    allVerificationEmails: Array.from(verificationStore.keys()),
    allResetPasswordEmails: Array.from(resetPasswordStore.keys())
  });
});

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

    const user = await findOfficialByProfessionalId(role, professionalId);

    if (user && !hasMatchingEmail(user, officialEmail)) {
      return res.status(404).json({
        message: "No account found with these credentials.",
      });
    }

    if (!user) {
      return res.status(404).json({
        message: "No account found with these credentials.",
      });
    }

    const transporter = createTransporter();
    if (!transporter) {
      return res.status(500).json({
        message: getEmailServiceUnavailableMessage(),
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

    // Send email asynchronously without blocking response
    transporter.sendMail({
      from: fromAddress || mailUser,
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
    }).then(() => {
      console.log(`✅ Password reset code sent to ${officialEmail}`);
    }).catch((error) => {
      console.error("❌ Email error:", error.message);
    });

    console.log(`📤 Password reset code queued for ${officialEmail}`);
    return res.status(200).json({
      sent: true,
    });
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

    console.log("Reset password request:", { officialEmail, resetCode: resetCode ? "***" + resetCode.slice(-2) : "none" });

    if (!isValidEmail(officialEmail) || resetCode.length !== 6) {
      return res.status(400).json({
        message: "Invalid email or reset code.",
      });
    }

    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({
        message: "Password must be at least 6 characters.",
      });
    }

    const record = resetPasswordStore.get(officialEmail);
    console.log("Reset password - record found:", !!record);
    console.log("Reset password - store keys:", Array.from(resetPasswordStore.keys()));

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

    if (record.code !== resetCode) {
      return res.status(400).json({
        message: "Incorrect reset code.",
      });
    }

    // Code is valid, proceed with password reset
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

    // Delete the code after successful reset
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

    if (!isStrongPassword(newPassword)) {
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
    const user = await findUserByEmail(officialEmail, {
      role: "TTR/RPF/Police",
      includePassword: true,
    });
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

    console.log("Reset password user request:", { email, otpCode: otpCode ? "***" + otpCode.slice(-2) : "none" });

    if (!isValidEmail(email) || otpCode.length !== 6) {
      return res.status(400).json({
        message: "Invalid email or verification code.",
      });
    }

    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({
        message: "Password must be at least 6 characters.",
      });
    }

    // Check if verification code exists and matches (already verified in previous step)
    console.log(`\n🔍 RESET PASSWORD LOOKUP for: "${email}"`);
    console.log("Email type:", typeof email, "Length:", email.length);
    console.log("All emails in store:", Array.from(verificationStore.keys()).map(k => JSON.stringify(k)));
    
    const storeDebug = Array.from(verificationStore.entries()).map(([k, v]) => ({ 
      email: JSON.stringify(k),
      emailMatch: k === email,
      hasCode: !!v.code,
      code: v.code,
      expiresAt: new Date(v.expiresAt).toISOString(),
      isExpired: Date.now() > v.expiresAt,
      attempts: v.attempts
    }));
    console.log("Full store contents:", storeDebug);

    const record = verificationStore.get(email);
    console.log("Reset password user - record found:", !!record);
    if (record) {
      console.log("✅ Retrieved record:", {
        hasCode: !!record.code,
        code: record.code,
        expiresAt: new Date(record.expiresAt).toISOString(),
        isExpired: Date.now() > record.expiresAt,
        attempts: record.attempts
      });
    }

    if (!record) {
      console.error(`\n❌ VERIFICATION CODE NOT FOUND`);
      console.error("Searched for email:", JSON.stringify(email));
      console.error("Available emails:", Array.from(verificationStore.keys()).map(k => JSON.stringify(k)));
      console.error("Store size:", verificationStore.size);
      return res.status(400).json({
        message: "No verification code found. Request a new one.",
      });
    }

    if (Date.now() > record.expiresAt) {
      verificationStore.delete(email);
      return res.status(400).json({
        message: "Code expired. Request a new one.",
      });
    }

    if (record.code !== otpCode) {
      return res.status(400).json({
        message: "Incorrect verification code.",
      });
    }

    // Code is valid, delete it now
    verificationStore.delete(email);

    // Find user by email (for non-official roles)
    const user = await findUserByEmail(email, { includePassword: true });
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

// Password Reset - Send reset code for non-official users from configured Gmail
router.post("/forgot-password-user", async (req, res) => {
  try {
    const email = (req.body?.email || "").trim().toLowerCase();

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Enter a valid email address." });
    }

    const account = await findUserByEmail(email);
    if (!account) {
      return res.status(404).json({ message: "No account found with this email." });
    }

    const transporter = createTransporter();
    if (!transporter) {
      return res.status(500).json({
        message: getEmailServiceUnavailableMessage(),
      });
    }

    const resetCode = generateCode();
    const expiresAt = Date.now() + RESET_CODE_TTL_MS;
    verificationStore.set(email, { code: resetCode, expiresAt, attempts: 0 });

    try {
      await transporter.sendMail({
        from: fromAddress || mailUser,
        to: email,
        subject: "SafeRide Guardian - Password Reset Code",
        text: `Your SafeRide password reset code is: ${resetCode}\n\nIt expires in 15 minutes.\n\nIf you did not request this, please ignore this email.\n\nSafeRide Team`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
            <h2>SafeRide Guardian</h2>
            <p>You requested a password reset. Your code is:</p>
            <div style="background: #f0f0f0; padding: 20px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px;">
              ${resetCode}
            </div>
            <p>This code expires in <strong>15 minutes</strong>.</p>
            <p>If you did not request this reset, please ignore this email.</p>
          </div>
        `,
      });

      return res.status(200).json({ sent: true });
    } catch (error) {
      console.error("Forgot password user email error:", error.message);
      if (canUseDevOtpFallback()) {
        console.warn(
          `⚠️ Using dev reset-code fallback for ${email}. SMTP delivery failed; returning code in API response.`,
        );
        return res.status(200).json({
          sent: true,
          devCode: resetCode,
          fallback: true,
          message:
            "Email delivery unavailable. Using development reset-code fallback.",
        });
      }

      verificationStore.delete(email);
      return res
        .status(500)
        .json({ message: getEmailSendFailureMessage(error) });
    }
  } catch (error) {
    console.error("Forgot password user error:", error.message);
    return res.status(500).json({ message: "Unable to process request." });
  }
});
