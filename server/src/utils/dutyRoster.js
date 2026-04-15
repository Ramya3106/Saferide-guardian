const DEMO_DUTY_ROSTER = [
  {
    staffId: "DEMO-TTR-2041",
    staffName: "A. Karthik",
    staffEmail: "karthik.ttr@railnet.gov.in",
    staffRole: "TTR/RPF/Police",
    dutyUnit: "TTR",
    dutyStation: "Chennai Egmore",
    dutyDesk: "Coach control desk",
    jurisdiction: "Chennai Division",
    onDutyStatus: true,
  },
  {
    staffId: "DEMO-TTE-1187",
    staffName: "S. Meera",
    staffEmail: "meera.tte@railnet.gov.in",
    staffRole: "TTR/RPF/Police",
    dutyUnit: "TTE",
    dutyStation: "Tambaram",
    dutyDesk: "Ticket verification bay",
    jurisdiction: "Tambaram Section",
    onDutyStatus: true,
  },
  {
    staffId: "DEMO-RPF-7720",
    staffName: "R. Prakash",
    staffEmail: "prakash.rpf@railnet.gov.in",
    staffRole: "TTR/RPF/Police",
    dutyUnit: "RPF",
    dutyStation: "Perambur",
    dutyDesk: "Platform protection unit",
    jurisdiction: "Chennai Suburban",
    onDutyStatus: true,
  },
  {
    staffId: "DEMO-POL-5514",
    staffName: "Inspector N. Kavitha",
    staffEmail: "kavitha.police@tnpolice.gov.in",
    staffRole: "TTR/RPF/Police",
    dutyUnit: "Police",
    dutyStation: "Mambalam",
    dutyDesk: "Passenger assistance desk",
    jurisdiction: "Southern Zone",
    onDutyStatus: false,
  },
];

const normalizeDutyUnit = (value) => {
  const normalized = String(value || "").trim().toUpperCase();

  if (normalized.startsWith("TTR")) {
    return "TTR";
  }

  if (normalized.startsWith("TTE")) {
    return "TTE";
  }

  if (normalized.startsWith("RPF")) {
    return "RPF";
  }

  if (normalized.startsWith("POLICE") || normalized.startsWith("TNPOLICE")) {
    return "Police";
  }

  return "";
};

const inferDutyUnitFromProfessionalId = (value) => {
  const normalized = String(value || "").trim().toUpperCase();

  if (normalized.startsWith("TTR-")) {
    return "TTR";
  }

  if (normalized.startsWith("TTE-")) {
    return "TTE";
  }

  if (normalized.startsWith("RPF-")) {
    return "RPF";
  }

  if (normalized.startsWith("TNPOLICE-") || normalized.startsWith("POLICE-")) {
    return "Police";
  }

  return "";
};

const inferDutyUnitFromEmail = (email) => {
  const normalized = String(email || "").trim().toLowerCase();

  if (normalized.includes(".ttr@") || normalized.includes("ttr-")) {
    return "TTR";
  }

  if (normalized.includes(".tte@") || normalized.includes("tte-")) {
    return "TTE";
  }

  if (normalized.includes(".rpf@") || normalized.includes("rpf-")) {
    return "RPF";
  }

  if (normalized.includes("police")) {
    return "Police";
  }

  return "";
};

const inferDutyUnit = (record = {}) => {
  return (
    normalizeDutyUnit(record.dutyUnit) ||
    inferDutyUnitFromProfessionalId(record.professionalId) ||
    inferDutyUnitFromEmail(record.email) ||
    "TTR"
  );
};

const toDutyOfficer = (record, { isDemo = false } = {}) => {
  if (!record) {
    return null;
  }

  const staffId = record.staffId || String(record._id || record.email || "");
  const staffName = record.staffName || record.name || "Duty Officer";
  const staffEmail = (record.staffEmail || record.email || "").toString().trim().toLowerCase();
  const dutyUnit = inferDutyUnit(record);

  return {
    staffId,
    staffName,
    staffEmail,
    staffRole: record.staffRole || record.role || "TTR/RPF/Police",
    dutyUnit,
    dutyStation: record.dutyStation || record.jurisdiction || null,
    dutyDesk: record.dutyDesk || null,
    jurisdiction: record.jurisdiction || null,
    dutyNote: record.dutyNote || null,
    onDutyStatus: Boolean(record.onDutyStatus),
    dutyCheckInAt: record.dutyCheckInAt || null,
    dutyCheckOutAt: record.dutyCheckOutAt || null,
    professionalId: record.professionalId || null,
    isDemo: Boolean(isDemo || record.isDemo),
  };
};

const buildDutyRoster = (records = []) => {
  return records.map((record) => toDutyOfficer(record)).filter(Boolean);
};

module.exports = {
  DEMO_DUTY_ROSTER,
  buildDutyRoster,
  inferDutyUnit,
  inferDutyUnitFromProfessionalId,
  normalizeDutyUnit,
  toDutyOfficer,
};
