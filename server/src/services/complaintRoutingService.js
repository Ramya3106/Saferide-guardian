const User = require("../models/User");
const DutyAttendance = require("../models/DutyAttendance");
const Complaint = require("../models/Complaint");
const Notification = require("../models/Notification");

const TERMINAL_STATUSES = new Set(["Closed", "Recovered", "Handed over"]);
const DEFAULT_ROLE_ORDER = ["TTR", "TTE", "RPF", "Police"];
const SUPERVISOR_QUEUE_KEY = "supervisor-demo-admin-queue";
const SUPERVISOR_QUEUE_NAME = "Supervisor / Demo Admin Queue";

const normalize = (value) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

const normalizeText = (value) => String(value || "").trim().toLowerCase();

const normalizeRoleLabel = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }

  const upper = normalized.toUpperCase();
  if (upper === "POLICE") {
    return "Police";
  }

  if (DEFAULT_ROLE_ORDER.includes(upper)) {
    return upper;
  }

  return normalized;
};

const getOfficerKey = (officer) =>
  normalizeText(officer.officerEmail || officer.staffEmail || officer.email) ||
  normalize(officer.professionalId) ||
  normalizeText(officer.officerId || officer.staffId || officer._id);

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

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const extractCoordinates = (snapshot) => {
  if (!snapshot) {
    return null;
  }

  const latitude = toNumber(snapshot.latitude ?? snapshot.lat);
  const longitude = toNumber(snapshot.longitude ?? snapshot.lng ?? snapshot.long);
  if (latitude == null || longitude == null) {
    return null;
  }

  return { latitude, longitude };
};

const getComplaintCoordinates = (complaint) =>
  extractCoordinates(complaint.sharedLocation) ||
  extractCoordinates(complaint.gpsLocation) || {
    latitude: toNumber(complaint.currentLat),
    longitude: toNumber(complaint.currentLng),
  };

const getOfficerCoordinates = (officer) =>
  extractCoordinates(officer.liveLocationSnapshot) ||
  extractCoordinates(officer.currentLocation) ||
  extractCoordinates(officer.locationSnapshot) ||
  null;

const haversineDistanceKm = (fromCoords, toCoords) => {
  if (!fromCoords || !toCoords) {
    return null;
  }

  const earthRadiusKm = 6371;
  const latitudeDelta = ((toCoords.latitude - fromCoords.latitude) * Math.PI) / 180;
  const longitudeDelta = ((toCoords.longitude - fromCoords.longitude) * Math.PI) / 180;
  const fromLatitude = (fromCoords.latitude * Math.PI) / 180;
  const toLatitude = (toCoords.latitude * Math.PI) / 180;

  const a =
    Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
    Math.cos(fromLatitude) * Math.cos(toLatitude) *
    Math.sin(longitudeDelta / 2) * Math.sin(longitudeDelta / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
};

const normalizeComplaintText = (complaint) =>
  [
    complaint.complaintType,
    complaint.lostItemType,
    complaint.itemType,
    complaint.complaintDescription,
    complaint.description,
    complaint.submitAuthority,
    complaint.priority,
    complaint.severity,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

const resolveRoutingProfile = (complaint) => {
  const text = normalizeComplaintText(complaint);
  const isLegalEscalation = /legal|law|court|fir|station[- ]level legal|legal escalation|case file/.test(text);
  const isSecurityIssue = /security|attack|threat|weapon|assault|violence|terror|danger|suspicious/i.test(text);
  const isSuspectedTheft =
    /theft|stolen|stole|pickpocket|snatch/.test(text) ||
    ((/baggage|luggage|bag/.test(text) || /missing baggage/.test(text)) && /missing|lost|stolen|theft|suspicious/.test(text));
  const isLostItem = /lost|missing|misplaced|left behind|belongings?|item|baggage|luggage|bag/.test(text);

  const severity = String(complaint.severity || complaint.priority || "Normal").trim();
  const criticalSeverity = /critical/i.test(severity);
  const highSeverity = /high/i.test(severity);

  if (isLegalEscalation) {
    return {
      category: "LEGAL_ESCALATION",
      rolePreferences: ["Police"],
      routingReason: "Station-level legal escalation requires Police handling first",
      escalationLevel: "POLICE_ESCALATION",
    };
  }

  if (isSecurityIssue) {
    return {
      category: "SECURITY_ISSUE",
      rolePreferences: ["RPF", "Police"],
      routingReason: "Security issue escalated to RPF with Police fallback",
      escalationLevel: "SECURITY_ESCALATION",
    };
  }

  if (isSuspectedTheft) {
    return {
      category: "SUSPECTED_THEFT",
      rolePreferences: ["RPF", "TTR"],
      routingReason: "Missing baggage with suspicion of theft escalated to RPF first and TTR second",
      escalationLevel: criticalSeverity ? "CRITICAL_THEFT_ESCALATION" : "THEFT_ESCALATION",
    };
  }

  if (isLostItem) {
    return {
      category: "LOST_ITEM",
      rolePreferences: ["TTR", "TTE", "RPF", "Police"],
      routingReason: "Lost item complaint routed to TTR/TTE first",
      escalationLevel: highSeverity ? "HIGH_LOST_ITEM" : "TRAIN_LEVEL",
    };
  }

  if (criticalSeverity) {
    return {
      category: "CRITICAL_GENERAL",
      rolePreferences: ["RPF", "Police", "TTR", "TTE"],
      routingReason: "Critical complaint routed to the highest on-duty enforcement priority",
      escalationLevel: "CRITICAL_ESCALATION",
    };
  }

  if (highSeverity) {
    return {
      category: "HIGH_GENERAL",
      rolePreferences: ["TTR", "TTE", "RPF", "Police"],
      routingReason: "High priority complaint routed to duty officers with train-first preference",
      escalationLevel: "HIGH_PRIORITY",
    };
  }

  return {
    category: "GENERAL",
    rolePreferences: ["TTR", "TTE", "RPF", "Police"],
    routingReason: "General complaint routed to current duty roster",
    escalationLevel: "TRAIN_LEVEL",
  };
};

const mergeOfficerDirectory = async (activeSessions) => {
  const officerEmails = activeSessions.map((item) => normalizeText(item.officerEmail)).filter(Boolean);

  const userDirectory = officerEmails.length
    ? await User.find({
        role: { $in: ["TTR/RPF/Police", "TTR", "TTE", "RPF", "Police"] },
        email: { $in: officerEmails },
      }).select(
        "email name role dutyUnit dutyStation dutyDesk jurisdiction assignedTrain assignedRoute assignedStation assignedShift",
      )
    : [];

  const userByEmail = new Map(userDirectory.map((entry) => [normalizeText(entry.email), entry]));

  return activeSessions
    .map((session) => {
      const user = userByEmail.get(normalizeText(session.officerEmail));

      // If a DB user record exists, treat explicit checked-out flags as authoritative.
      if (user && user.onDutyStatus === false && user.isActiveDuty === false) {
        return null;
      }

      return {
        officerKey: session.officerKey,
        officerId: session.officerId || null,
        officerEmail: session.officerEmail || null,
        officerName: session.officerName || user?.name || "Duty Officer",
        dutyUnit: normalizeRoleLabel(session.dutyUnit || user?.dutyUnit || user?.role || ""),
        assignedTrain: session.assignedTrain || user?.assignedTrain || null,
        assignedRoute: session.assignedRoute || user?.assignedRoute || null,
        assignedStation: session.assignedStation || user?.dutyStation || user?.assignedStation || null,
        assignedShift: session.assignedShift || user?.assignedShift || null,
        jurisdiction: session.jurisdiction || user?.jurisdiction || null,
        liveLocationSnapshot: session.liveLocationSnapshot || null,
        source: session.source || "db",
        onDutyAt: session.checkInTime || session.createdAt || new Date(),
      };
    })
    .filter(Boolean);
};

const buildCandidatePool = async () => {
  const activeSessions = await DutyAttendance.find({
    $or: [{ status: "ACTIVE" }, { dutyStatus: "ACTIVE" }],
  }).sort({ checkInTime: 1 });

  return mergeOfficerDirectory(activeSessions);
};

const buildWorkloadQuery = (officer) => {
  const officerId = String(officer.officerId || "").trim();
  const officerEmail = normalizeText(officer.officerEmail || "");
  const officerKey = getOfficerKey(officer);

  const identityClauses = [];
  if (officerId) {
    identityClauses.push({ assignedOfficerId: officerId });
    identityClauses.push({ staffId: officerId });
    identityClauses.push({ "assignedStaff.staffId": officerId });
  }

  if (officerEmail) {
    identityClauses.push({ assignedOfficerId: officerEmail });
    identityClauses.push({ staffId: officerEmail });
    identityClauses.push({ "assignedStaff.staffEmail": officerEmail });
  }

  if (officerKey) {
    identityClauses.push({ "assignedStaff.staffEmail": officerKey });
  }

  return {
    status: { $nin: Array.from(TERMINAL_STATUSES) },
    $or: identityClauses.length > 0 ? identityClauses : [{ _id: null }],
  };
};

const countOfficerWorkload = async (officer) => {
  const [complaintCount, pendingNotificationCount] = await Promise.all([
    Complaint.countDocuments(buildWorkloadQuery(officer)),
    Notification.countDocuments({
      officerKey: getOfficerKey(officer),
      status: "PENDING",
    }),
  ]);

  return complaintCount + pendingNotificationCount;
};

const scoreCandidate = (officer, complaint, complaintCoords) => {
  const officerCoords = getOfficerCoordinates(officer);
  const distanceKm = complaintCoords && officerCoords ? haversineDistanceKm(complaintCoords, officerCoords) : null;
  const trainComplaint = String(complaint.trainNumber || complaint.vehicleNumber || complaint.pnrMock || "");
  const trainMatch = isTrainMatch(trainComplaint, officer.assignedTrain);
  const routeMatch =
    hasOverlap(complaint.route, officer.assignedRoute) ||
    hasOverlap(complaint.boardingStation, officer.assignedStation) ||
    hasOverlap(complaint.destinationStation, officer.assignedStation) ||
    hasOverlap(complaint.currentTrainLocation, officer.assignedStation || officer.jurisdiction);
  const coachMatch =
    Boolean(complaint.coach && officer.assignedShift && hasOverlap(complaint.coach, officer.assignedShift)) ||
    Boolean(complaint.coach && officer.dutyDesk && hasOverlap(complaint.coach, officer.dutyDesk));

  return {
    ...officer,
    distanceKm,
    hasLocation: distanceKm != null,
    trainMatch,
    routeMatch,
    coachMatch,
    assignmentScore: (trainMatch ? 3 : 0) + (coachMatch ? 2 : 0) + (routeMatch ? 1 : 0),
  };
};

const selectBestOfficer = async (eligibleOfficers, complaint) => {
  if (!Array.isArray(eligibleOfficers) || eligibleOfficers.length === 0) {
    return null;
  }

  const complaintCoords = getComplaintCoordinates(complaint);
  const enriched = await Promise.all(
    eligibleOfficers.map(async (officer) => ({
      ...scoreCandidate(officer, complaint, complaintCoords),
      workload: await countOfficerWorkload(officer),
    })),
  );

  const anyLocationData = enriched.some((officer) => officer.hasLocation && Number.isFinite(officer.distanceKm));
  const anyAssignmentData = enriched.some((officer) => officer.assignmentScore > 0);

  enriched.sort((left, right) => {
    if (anyLocationData) {
      if (left.hasLocation !== right.hasLocation) {
        return left.hasLocation ? -1 : 1;
      }

      if (left.distanceKm !== right.distanceKm) {
        return (left.distanceKm ?? Number.POSITIVE_INFINITY) - (right.distanceKm ?? Number.POSITIVE_INFINITY);
      }
    }

    if (!anyLocationData && anyAssignmentData) {
      if (left.assignmentScore !== right.assignmentScore) {
        return right.assignmentScore - left.assignmentScore;
      }
    }

    if (left.workload !== right.workload) {
      return left.workload - right.workload;
    }

    return new Date(left.onDutyAt).getTime() - new Date(right.onDutyAt).getTime();
  });

  return enriched[0] || null;
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

const createSupervisorQueueNotification = async (complaintData, reason) => {
  const docs = [
    {
      complaintRef: complaintData._id || null,
      complaintId: complaintData.complaintId || String(complaintData._id || "UNKNOWN"),
      officerKey: SUPERVISOR_QUEUE_KEY,
      officerId: null,
      officerEmail: null,
      officerName: SUPERVISOR_QUEUE_NAME,
      dutyUnit: "SUPERVISOR",
      priorityRank: 0,
      routingReason: reason,
      status: "PENDING",
      source: "demo",
    },
  ];

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
  const routingProfile = resolveRoutingProfile(complaint);

  const selected = [];
  let routingReason = routingProfile.routingReason;
  let escalationLevel = routingProfile.escalationLevel;
  let priorityRank = 1;

  for (const role of routingProfile.rolePreferences) {
    const eligibleOfficers = candidates.filter((officer) => normalizeRoleLabel(officer.dutyUnit) === role);
    if (eligibleOfficers.length === 0) {
      continue;
    }

    const bestOfficer = await selectBestOfficer(eligibleOfficers, complaint);
    if (!bestOfficer) {
      continue;
    }

    selected.push(bestOfficer);
    priorityRank = role === "Police" ? 3 : role === "RPF" ? 2 : 1;

    if (role === "Police") {
      routingReason = routingProfile.category === "LEGAL_ESCALATION"
        ? "Station-level legal escalation routed to Police"
        : routingReason;
      escalationLevel = routingProfile.escalationLevel || "POLICE_ESCALATION";
    } else if (role === "RPF") {
      routingReason = routingProfile.category === "SECURITY_ISSUE"
        ? "Security issue routed to RPF"
        : routingProfile.category === "SUSPECTED_THEFT"
          ? "Missing baggage with theft suspicion routed to RPF"
          : routingReason;
      escalationLevel = routingProfile.escalationLevel || "RPF_ESCALATION";
    } else {
      routingReason = routingProfile.category === "LOST_ITEM"
        ? "Lost item complaint routed to train duty officers"
        : routingReason;
      escalationLevel = routingProfile.escalationLevel || "TRAIN_LEVEL";
    }

    break;
  }

  const notifications = selected.length > 0
    ? await createNotificationEntries(complaint, selected, priorityRank, routingReason)
    : [];

  if (selected.length === 0) {
    const queueReason = "No on-duty officer available; queued for supervisor/demo admin review";
    const queueNotifications = await createSupervisorQueueNotification(complaint, queueReason);

    return {
      notifiedOfficers: [],
      notifications: [],
      queueNotifications,
      escalationLevel: "UNASSIGNED_URGENT_QUEUE",
      routingReason: queueReason,
      category: routingProfile.category,
      assignmentStrategy: "UNASSIGNED_QUEUE",
    };
  }

  const notifiedOfficers = selected.map((officer) => ({
    staffId: officer.officerId,
    staffName: officer.officerName,
    staffEmail: officer.officerEmail,
    staffRole: normalizeRoleLabel(officer.dutyUnit),
    assignedRole: normalizeRoleLabel(officer.dutyUnit),
    dutyUnit: normalizeRoleLabel(officer.dutyUnit),
    dutyDesk: null,
    onDutyAt: officer.onDutyAt,
    acknowledgedAt: null,
    routingPriority: priorityRank,
    routingReason,
    source: officer.source,
    workload: officer.workload,
    distanceKm: officer.distanceKm,
  }));

  return {
    notifiedOfficers,
    notifications,
    queueNotifications: [],
    escalationLevel,
    routingReason,
    category: routingProfile.category,
    assignmentStrategy: selected[0].hasLocation && Number.isFinite(selected[0].distanceKm)
      ? "NEAREST_RELEVANT_OFFICER"
      : selected[0].assignmentScore > 0
        ? "TRAIN_OR_ROUTE_MATCH"
        : "LEAST_BUSY_ON_DUTY",
  };
};

module.exports = {
  routeComplaintToActiveOfficers,
};
