const OFFICER_GROUP_ROLE = "TTR/RPF/Police";
const OFFICER_SPECIFIC_ROLES = ["TTR", "TTE", "RPF", "Police"];

const OFFICER_DEMO_ACCOUNTS = {
  ttr_demo: {
    specificRole: "TTR",
    displayName: "TTR Demo Officer",
    professionalId: "TTR-DEMO-0001",
    email: "ttr_demo@demo.saferide.local",
    dutyStation: "Central Junction",
    dutyDesk: "Platform Control",
    jurisdiction: "Central Division",
  },
  tte_demo: {
    specificRole: "TTE",
    displayName: "TTE Demo Officer",
    professionalId: "TTE-DEMO-0001",
    email: "tte_demo@demo.saferide.local",
    dutyStation: "Platform Control",
    dutyDesk: "Ticket Inspection",
    jurisdiction: "Central Division",
  },
  rpf_demo: {
    specificRole: "RPF",
    displayName: "RPF Demo Officer",
    professionalId: "RPF-DEMO-0001",
    email: "rpf_demo@demo.saferide.local",
    dutyStation: "Security Post",
    dutyDesk: "Rapid Response",
    jurisdiction: "Central Division",
  },
  police_demo: {
    specificRole: "Police",
    displayName: "Police Demo Officer",
    professionalId: "TNPOLICE-0001",
    email: "police_demo@demo.saferide.local",
    dutyStation: "District Control",
    dutyDesk: "Law & Order",
    jurisdiction: "Central Division",
  },
};

const normalizeLoginIdentifier = (value) => String(value || "").trim().toLowerCase();

const normalizeSpecificOfficerRole = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }

  const upper = normalized.toUpperCase();
  if (OFFICER_SPECIFIC_ROLES.includes(upper)) {
    return upper === "POLICE" ? "Police" : upper;
  }

  if (upper.startsWith("TNPOLICE-")) {
    return "Police";
  }

  if (upper.includes("TTE")) {
    return "TTE";
  }

  if (upper.includes("RPF")) {
    return "RPF";
  }

  if (upper.includes("TTR")) {
    return "TTR";
  }

  if (upper.includes("POLICE")) {
    return "Police";
  }

  return "";
};

const getDemoOfficerAccount = (identifier) => {
  const normalized = normalizeLoginIdentifier(identifier);
  if (!normalized) {
    return null;
  }

  const account = OFFICER_DEMO_ACCOUNTS[normalized];
  if (!account) {
    return null;
  }

  return {
    username: normalized,
    role: OFFICER_GROUP_ROLE,
    specificRole: account.specificRole,
    name: account.displayName,
    email: account.email,
    professionalId: account.professionalId,
    dutyStation: account.dutyStation,
    dutyDesk: account.dutyDesk,
    jurisdiction: account.jurisdiction,
    isDemo: true,
  };
};

const isDemoOfficerPassword = (passwordValue) => String(passwordValue || "").trim() === "123456";

const resolveOfficerSpecificRole = ({ role, specificRole, professionalId, email, identifier } = {}) => {
  const directSpecificRole = normalizeSpecificOfficerRole(specificRole);
  if (directSpecificRole) {
    return directSpecificRole;
  }

  const fromProfessionalId = normalizeSpecificOfficerRole(professionalId);
  if (fromProfessionalId) {
    return fromProfessionalId;
  }

  const fromEmail = normalizeSpecificOfficerRole(email);
  if (fromEmail) {
    return fromEmail;
  }

  const fromIdentifier = normalizeSpecificOfficerRole(identifier);
  if (fromIdentifier) {
    return fromIdentifier;
  }

  const normalizedRole = String(role || "").trim();
  if (normalizedRole === OFFICER_GROUP_ROLE) {
    return "";
  }

  return normalizeSpecificOfficerRole(normalizedRole);
};

module.exports = {
  OFFICER_GROUP_ROLE,
  OFFICER_SPECIFIC_ROLES,
  OFFICER_DEMO_ACCOUNTS,
  getDemoOfficerAccount,
  isDemoOfficerPassword,
  normalizeLoginIdentifier,
  normalizeSpecificOfficerRole,
  resolveOfficerSpecificRole,
};