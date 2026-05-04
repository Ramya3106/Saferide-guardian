const express = require("express");
const bcrypt = require("bcryptjs");

const User = require("../models/User");
const { signToken } = require("../utils/authToken");
const {
  OFFICER_GROUP_ROLE,
  getDemoOfficerAccount,
  isDemoOfficerPassword,
  normalizeLoginIdentifier,
  resolveOfficerSpecificRole,
} = require("../utils/officerAuth");

const router = express.Router();

const VALID_ROLES = ["Passenger", "TTR", "TTE", "RPF", "Police", OFFICER_GROUP_ROLE];

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const normalizeMobile = (value) => String(value || "").trim();

const normalizeProfessionalId = (value) => String(value || "").trim().toUpperCase();

const buildOfficerLoginProfile = ({
  id,
  role,
  specificRole,
  name,
  email,
  mobile = null,
  professionalId = null,
  isDemo = false,
  dutyStation = null,
  dutyDesk = null,
  jurisdiction = null,
}) => ({
  id,
  name,
  email,
  mobile,
  role,
  specificRole,
  professionalId,
  dutyStation,
  dutyDesk,
  jurisdiction,
  isActiveDuty: false,
  profileStatus: "approved",
  authType: isDemo ? "demo" : "db",
});

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

const findByLoginIdentifier = async ({ identifier, email, mobile, professionalId, includePassword = false }) => {
  const normalizedIdentifier = normalizeLoginIdentifier(identifier);
  const normalizedEmail = normalizeEmail(email || (normalizedIdentifier.includes("@") ? normalizedIdentifier : ""));
  const normalizedMobile = normalizeMobile(mobile);
  const normalizedProfessionalId = normalizeProfessionalId(professionalId || (normalizedIdentifier && !normalizedIdentifier.includes("@") ? normalizedIdentifier : ""));

  const demoAccount = getDemoOfficerAccount(normalizedIdentifier);
  if (demoAccount) {
    return {
      ...demoAccount,
      _id: `demo-${demoAccount.specificRole.toLowerCase()}`,
      role: OFFICER_GROUP_ROLE,
      specificRole: demoAccount.specificRole,
      toSafeObject: () => ({
        id: `demo-${demoAccount.specificRole.toLowerCase()}`,
        name: demoAccount.name,
        email: demoAccount.email,
        role: OFFICER_GROUP_ROLE,
        specificRole: demoAccount.specificRole,
        professionalId: demoAccount.professionalId,
        dutyStation: demoAccount.dutyStation,
        dutyDesk: demoAccount.dutyDesk,
        jurisdiction: demoAccount.jurisdiction,
        isDemo: true,
      }),
    };
  }

  if (normalizedEmail || normalizedMobile) {
    const existing = await findByEmailOrMobile({
      email: normalizedEmail,
      mobile: normalizedMobile,
      includePassword,
    });
    if (existing) {
      return existing;
    }
  }

  if (normalizedProfessionalId) {
    let query = User.find({});
    if (includePassword) {
      query = query.select("+password");
    }

    const users = await query;
    const matched = users.find(
      (user) => normalizeProfessionalId(user.professionalId || user.officerId) === normalizedProfessionalId,
    );

    if (matched) {
      return matched;
    }
  }

  return null;
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
    const { email, mobile, password, identifier, professionalId, username, role } = req.body || {};

    const loginIdentifier = identifier || username || email || mobile || professionalId;

    if (!loginIdentifier || !password) {
      return res.status(400).json({ message: "identifier and password are required" });
    }

    const demoAccount = getDemoOfficerAccount(loginIdentifier);
    if (demoAccount) {
      if (!isDemoOfficerPassword(password)) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const token = signToken({
        userId: demoAccount.email,
        role: OFFICER_GROUP_ROLE,
        specificRole: demoAccount.specificRole,
        roleGroup: OFFICER_GROUP_ROLE,
        email: demoAccount.email,
        professionalId: demoAccount.professionalId,
        authType: "demo",
      });

      const profile = buildOfficerLoginProfile({
        id: demoAccount.email,
        role: OFFICER_GROUP_ROLE,
        specificRole: demoAccount.specificRole,
        name: demoAccount.name,
        email: demoAccount.email,
        professionalId: demoAccount.professionalId,
        isDemo: true,
        dutyStation: demoAccount.dutyStation,
        dutyDesk: demoAccount.dutyDesk,
        jurisdiction: demoAccount.jurisdiction,
      });

      return res.json({
        message: "Login successful",
        token,
        role: OFFICER_GROUP_ROLE,
        specificRole: demoAccount.specificRole,
        user: profile,
      });
    }

    const user = await findByLoginIdentifier({
      identifier: loginIdentifier,
      email,
      mobile,
      professionalId,
      includePassword: true,
    });

    if (!user || !user.password) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const matched = await bcrypt.compare(String(password), user.password);
    if (!matched) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const safeUser = typeof user.toSafeObject === "function" ? user.toSafeObject() : user;
    const resolvedSpecificRole = resolveOfficerSpecificRole({
      role: safeUser.role,
      specificRole: safeUser.specificRole,
      professionalId: safeUser.professionalId || safeUser.officerId,
      email: safeUser.email,
      identifier: loginIdentifier,
    });
    const isOfficerLogin = ["TTR", "TTE", "RPF", "Police", OFFICER_GROUP_ROLE].includes(String(role || safeUser.role || "")) || Boolean(resolvedSpecificRole);
    const returnedRole = isOfficerLogin ? OFFICER_GROUP_ROLE : safeUser.role;

    const token = signToken({
      userId: String(user._id),
      role: returnedRole,
      specificRole: resolvedSpecificRole || safeUser.role,
      roleGroup: isOfficerLogin ? OFFICER_GROUP_ROLE : String(safeUser.role || ""),
      email: user.email,
      professionalId: safeUser.professionalId || safeUser.officerId || null,
    });

    return res.json({
      message: "Login successful",
      token,
      role: returnedRole,
      specificRole: resolvedSpecificRole || safeUser.role,
      user: {
        id: user._id,
        name: safeUser.name,
        email: safeUser.email,
        mobile: safeUser.mobile,
        role: returnedRole,
        specificRole: resolvedSpecificRole || safeUser.role,
        officerId: safeUser.officerId || safeUser.professionalId || null,
        professionalId: safeUser.professionalId || safeUser.officerId || null,
        assignedTrain: safeUser.assignedTrain || null,
        assignedRoute: safeUser.assignedRoute || null,
        assignedStation: safeUser.assignedStation || null,
        dutyShift: safeUser.dutyShift || null,
        isActiveDuty: Boolean(safeUser.isActiveDuty ?? safeUser.onDutyStatus),
        profileStatus: safeUser.profileStatus || safeUser.approvalStatus || "approved",
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Login failed", error: error.message });
  }
});

module.exports = router;
