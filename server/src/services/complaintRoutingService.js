const User = require("../models/User");
const DutyAttendance = require("../models/DutyAttendance");
const Notification = require("../models/Notification");
const { DEMO_DUTY_ROSTER } = require("../utils/dutyRoster");

const normalize = (value) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

const normalizeText = (value) => String(value || "").trim().toLowerCase();

const getOfficerKey = (officer) => {
  return (
    normalizeText(officer.officerEmail || officer.staffEmail || officer.email) ||
    normalize(officer.professionalId) ||
    normalizeText(officer.officerId || officer.staffId || officer._id)
  );
};

const toTokens = (value) =>
  normalizeText(value)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

const hasOverlap = (a, b) => {
  const left = new Set(toTokens(a));
  const right = toTokens(b);
  return right.some((item) => left.has(item));
};

const isTrainMatch = (complaintTrain, assignedTrain) => {
  const normalizedComplaint = normalize(complaintTrain);
  const normalizedAssigned = normalize(assignedTrain);
  return Boolean(normalizedComplaint && normalizedAssigned && normalizedComplaint === normalizedAssigned);
};

const isRouteOrStationMatch = (complaint, officer) => {
  const routeMatch = hasOverlap(complaint.route, officer.assignedRoute);
  const stationFromMatch = hasOverlap(complaint.fromLocation, officer.assignedStation);
  const stationToMatch = hasOverlap(complaint.toLocation, officer.assignedStation);
  const trainSectorMatch = hasOverlap(complaint.route, officer.jurisdiction);
  return routeMatch || stationFromMatch || stationToMatch || trainSectorMatch;
};

const isPoliceZoneMatch = (complaint, officer) => {
  return (
    hasOverlap(complaint.fromLocation, officer.assignedStation || officer.jurisdiction) ||
    hasOverlap(complaint.toLocation, officer.assignedStation || officer.jurisdiction) ||
    hasOverlap(complaint.route, officer.jurisdiction)
  );
};

const mergeOfficerDirectory = async (activeSessions) => {
  const officerEmails = activeSessions
    .map((item) => normalizeText(item.officerEmail))
    .filter(Boolean);

  const userDirectory = officerEmails.length
    ? await User.find({
        role: "TTR/RPF/Police",
        email: { $in: officerEmails },
      }).select("email name role dutyUnit dutyStation dutyDesk jurisdiction")
    : [];

  const userByEmail = new Map(
    userDirectory.map((entry) => [normalizeText(entry.email), entry]),
  );

  return activeSessions.map((session) => {
    const user = userByEmail.get(normalizeText(session.officerEmail));
    return {
      officerKey: session.officerKey,
      officerId: session.officerId || null,
      officerEmail: session.officerEmail || null,
      officerName: session.officerName || user?.name || "Duty Officer",
      dutyUnit: String(session.dutyUnit || user?.dutyUnit || "").toUpperCase(),
      assignedTrain: session.assignedTrain || null,
      assignedRoute: session.assignedRoute || null,
      assignedStation: session.assignedStation || user?.dutyStation || null,
      assignedShift: session.assignedShift || null,
      jurisdiction: session.jurisdiction || user?.jurisdiction || null,
      source: "db",
      onDutyAt: session.checkInTime || session.createdAt || new Date(),
    };
  });
};

const buildCandidatePool = async () => {
  const activeSessions = await DutyAttendance.find({ status: "ACTIVE" }).sort({ checkInTime: 1 });

  const sessionCandidates = await mergeOfficerDirectory(activeSessions);
  const sessionKeySet = new Set(sessionCandidates.map((item) => item.officerKey));

  const demoCandidates = DEMO_DUTY_ROSTER.filter((officer) => officer.onDutyStatus)
    .map((officer) => ({
      officerKey: getOfficerKey({ officerEmail: officer.staffEmail, officerId: officer.staffId }),
      officerId: officer.staffId,
      officerEmail: officer.staffEmail,
      officerName: officer.staffName,
      dutyUnit: String(officer.dutyUnit || "").toUpperCase(),
      assignedTrain: officer.assignedTrain || null,
      assignedRoute: officer.assignedRoute || null,
      assignedStation: officer.dutyStation || null,
      assignedShift: officer.assignedShift || null,
      jurisdiction: officer.jurisdiction || null,
      source: "demo",
      onDutyAt: new Date(),
    }))
    .filter((item) => item.officerKey && !sessionKeySet.has(item.officerKey));

  return [...sessionCandidates, ...demoCandidates];
};

const createNotificationEntries = async (complaintData, selectedOfficers, priorityRank, reason) => {
  if (!Array.isArray(selectedOfficers) || selectedOfficers.length === 0) {
    return [];
  }

  const docs = selectedOfficers.map((officer) => ({
    complaintRef: complaintData._id || null,
    complaintId: complaintData.complaintId || String(complaintData._id || "UNKNOWN"),
    officerKey: officer.officerKey,
    officerId: officer.officerId,
    officerEmail: officer.officerEmail,
    officerName: officer.officerName,
    dutyUnit: officer.dutyUnit,
    priorityRank,
    routingReason: reason,
    status: "PENDING",
    source: officer.source === "demo" ? "demo" : "db",
  }));

  const saved = await Notification.insertMany(docs);
  return saved.map((entry) => ({
    id: entry._id?.toString?.() || null,
    officerKey: entry.officerKey,
    officerId: entry.officerId,
    officerEmail: entry.officerEmail,
    officerName: entry.officerName,
    dutyUnit: entry.dutyUnit,
    priorityRank: entry.priorityRank,
    routingReason: entry.routingReason,
    status: entry.status,
  }));
};

const routeComplaintToActiveOfficers = async (complaintData) => {
  const complaint = complaintData || {};
  const candidates = await buildCandidatePool();

  const trainComplaint = String(complaint.vehicleNumber || "");
  const tier1 = candidates.filter(
    (officer) => (officer.dutyUnit === "TTR" || officer.dutyUnit === "TTE") && isTrainMatch(trainComplaint, officer.assignedTrain),
  );

  let selected = tier1;
  let priorityRank = 1;
  let routingReason = "Active TTR/TTE assigned to same train";

  if (selected.length === 0) {
    const tier2 = candidates.filter(
      (officer) => officer.dutyUnit === "RPF" && isRouteOrStationMatch(complaint, officer),
    );

    if (tier2.length > 0) {
      selected = tier2;
      priorityRank = 2;
      routingReason = "Escalated to active RPF on matching route/station/sector";
    }
  }

  if (selected.length === 0) {
    const tier3 = candidates.filter(
      (officer) => officer.dutyUnit === "POLICE" && isPoliceZoneMatch(complaint, officer),
    );

    if (tier3.length > 0) {
      selected = tier3;
      priorityRank = 3;
      routingReason = "Escalated to active Police in same station zone/area";
    }
  }

  const notifications = await createNotificationEntries(
    complaint,
    selected,
    priorityRank,
    routingReason,
  );

  const notifiedOfficers = selected.map((officer) => ({
    staffId: officer.officerId,
    staffName: officer.officerName,
    staffEmail: officer.officerEmail,
    staffRole: "TTR/RPF/Police",
    dutyUnit: officer.dutyUnit === "POLICE" ? "Police" : officer.dutyUnit,
    dutyDesk: null,
    onDutyAt: officer.onDutyAt,
    acknowledgedAt: null,
    routingPriority: priorityRank,
    routingReason,
    source: officer.source,
  }));

  return {
    notifiedOfficers,
    notifications,
    escalationLevel:
      priorityRank === 1
        ? "TRAIN_LEVEL"
        : priorityRank === 2
          ? "RPF_ESCALATION"
          : priorityRank === 3
            ? "POLICE_ESCALATION"
            : "NO_ACTIVE_OFFICER",
    routingReason,
  };
};

module.exports = {
  routeComplaintToActiveOfficers,
};
