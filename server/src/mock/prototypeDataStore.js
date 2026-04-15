const { DEMO_DUTY_ROSTER } = require("../utils/dutyRoster");

const nowIso = () => new Date().toISOString();

const createId = (prefix) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

const deepClone = (value) => JSON.parse(JSON.stringify(value));

const prototypeData = {
  officers: DEMO_DUTY_ROSTER.map((officer) => ({
    id: officer.staffId,
    name: officer.staffName,
    email: officer.staffEmail,
    role: officer.staffRole,
    dutyUnit: officer.dutyUnit,
    station: officer.dutyStation,
    desk: officer.dutyDesk,
    jurisdiction: officer.jurisdiction,
    onDuty: Boolean(officer.onDutyStatus),
    source: "mock",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  })),
  staff: [
    {
      id: "STAFF-SC-101",
      name: "K. Nithin",
      role: "Station Controller",
      station: "Chennai Central",
      contact: "+91-9000000101",
      source: "mock",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    {
      id: "STAFF-PA-202",
      name: "R. Priya",
      role: "Platform Assistant",
      station: "Tambaram",
      contact: "+91-9000000202",
      source: "mock",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
  ],
  vehicles: [
    {
      id: "VEH-2241",
      type: "train",
      number: "2241 City Express",
      route: "Chennai Central -> Tambaram",
      source: "mock",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    {
      id: "VEH-1187",
      type: "train",
      number: "1187 Mail Fast",
      route: "Villupuram -> Chennai Egmore",
      source: "mock",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
  ],
  complaints: [],
  alerts: [],
  handoverRecords: [],
};

const normalizeEntity = (entity) => {
  const normalized = String(entity || "").trim().toLowerCase();

  if (normalized === "officers" || normalized === "officer") {
    return "officers";
  }
  if (normalized === "staff") {
    return "staff";
  }
  if (normalized === "vehicles" || normalized === "vehicle") {
    return "vehicles";
  }
  if (normalized === "complaints" || normalized === "complaint") {
    return "complaints";
  }
  if (normalized === "alerts" || normalized === "alert") {
    return "alerts";
  }
  if (
    normalized === "handoverrecords" ||
    normalized === "handover-records" ||
    normalized === "handover" ||
    normalized === "handovers"
  ) {
    return "handoverRecords";
  }

  return "";
};

const upsertById = (collection, record, prefix) => {
  const id = record.id || createId(prefix);
  const existingIndex = collection.findIndex((item) => item.id === id);
  const nextRecord = {
    ...record,
    id,
    source: "mock",
    updatedAt: nowIso(),
    createdAt: record.createdAt || nowIso(),
  };

  if (existingIndex >= 0) {
    collection[existingIndex] = {
      ...collection[existingIndex],
      ...nextRecord,
      createdAt: collection[existingIndex].createdAt || nextRecord.createdAt,
    };
    return collection[existingIndex];
  }

  collection.unshift(nextRecord);
  return nextRecord;
};

const addPrototypeRecord = (entity, payload) => {
  const key = normalizeEntity(entity);
  if (!key) {
    return null;
  }

  const prefixMap = {
    officers: "OFF",
    staff: "STF",
    vehicles: "VEH",
    complaints: "CMP",
    alerts: "ALT",
    handoverRecords: "HND",
  };

  return upsertById(prototypeData[key], payload || {}, prefixMap[key]);
};

const appendComplaintFromMongo = (complaint) => {
  if (!complaint) {
    return null;
  }

  const mapped = {
    id: complaint.complaintId || complaint._id?.toString() || createId("CMP"),
    complaintRef: complaint._id?.toString() || null,
    passengerName: complaint.passengerName,
    passengerEmail: complaint.passengerEmail,
    transportType: complaint.transportType,
    vehicleNumber: complaint.vehicleNumber,
    itemType: complaint.itemType,
    description: complaint.description,
    status: complaint.status,
    priority: complaint.priority,
    route: complaint.route,
    submitAuthority: complaint.submitAuthority,
    assignedStaff: complaint.assignedStaff || [],
    source: "mock",
  };

  const complaintRecord = upsertById(prototypeData.complaints, mapped, "CMP");

  const alertRecord = {
    id: `ALT-${mapped.id}`,
    complaintId: mapped.id,
    status: mapped.status,
    priority: mapped.priority,
    route: mapped.route,
    assignedStaff: mapped.assignedStaff,
    summary: `${mapped.itemType} reported in ${mapped.vehicleNumber}`,
    source: "mock",
  };
  upsertById(prototypeData.alerts, alertRecord, "ALT");

  return complaintRecord;
};

const appendHandoverRecord = (handover) => {
  return upsertById(
    prototypeData.handoverRecords,
    {
      ...handover,
      status: handover.status || "planned",
      source: "mock",
    },
    "HND",
  );
};

const listPrototypeData = () => deepClone(prototypeData);

const getPrototypeSummary = () => ({
  officers: prototypeData.officers.length,
  staff: prototypeData.staff.length,
  vehicles: prototypeData.vehicles.length,
  complaints: prototypeData.complaints.length,
  alerts: prototypeData.alerts.length,
  handoverRecords: prototypeData.handoverRecords.length,
});

module.exports = {
  addPrototypeRecord,
  appendComplaintFromMongo,
  appendHandoverRecord,
  getPrototypeSummary,
  listPrototypeData,
  normalizeEntity,
};
