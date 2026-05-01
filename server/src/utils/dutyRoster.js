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
  const userId = record._id ? String(record._id) : null;

  return {
    staffId,
    userId,
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
  buildDutyRoster,
  inferDutyUnit,
  inferDutyUnitFromProfessionalId,
  normalizeDutyUnit,
  toDutyOfficer,
};
