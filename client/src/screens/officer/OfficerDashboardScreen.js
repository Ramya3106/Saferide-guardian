import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { SafeAreaView } from "react-native-safe-area-context";

import { getApiBase } from "../../../apiConfig";
import DutyStatusCard from "./DutyStatusCard";
import ComplaintAlertListScreen from "./ComplaintAlertListScreen";
import ComplaintDetailView from "./ComplaintDetailView";
import ReplyStatusUpdateForm from "./ReplyStatusUpdateForm";
import DutyHistoryScreen from "./DutyHistoryScreen";
import { socketService } from "../../services/socketService";

const API_BASE = getApiBase();
const SOCKET_BASE = API_BASE.replace(/\/api\/?$/, "");

const hashString = (value) => {
  const text = String(value || "");
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
};

const splitRoutePoints = (routeValue) =>
  String(routeValue || "")
    .split(/\s*(?:->|→|\-|,|\/)\s*/)
    .map((item) => item.trim())
    .filter(Boolean);

const buildCheckpointList = ({ routeValue, trainValue, stationValue }) => {
  const points = [];
  splitRoutePoints(routeValue).forEach((point) => points.push(point));
  [stationValue, trainValue].forEach((point) => {
    const trimmed = String(point || "").trim();
    if (trimmed) {
      points.push(trimmed);
    }
  });

  const uniquePoints = Array.from(new Set(points));
  if (uniquePoints.length === 0) {
    return ["Depot", "Midway", "Terminal"];
  }

  if (uniquePoints.length === 1) {
    return [uniquePoints[0], `${uniquePoints[0]} - en route`, `${uniquePoints[0]} - terminal`];
  }

  return uniquePoints.slice(0, 5);
};

const buildMockCoordinate = (seed, index = 0) => {
  const base = hashString(seed);
  const latitude = 12.9 + (((base % 1000) / 1000) * 0.8) + index * 0.012;
  const longitude = 77.2 + ((((base >> 3) % 1000) / 1000) * 0.8) + index * 0.012;
  return {
    latitude: Number(latitude.toFixed(6)),
    longitude: Number(longitude.toFixed(6)),
  };
};

const buildLiveMapLabel = (location) => {
  if (!location) {
    return "Awaiting first live reading";
  }

  const modeLabel = location.mode === "mock" ? "Mock movement" : "GPS";
  const checkpointLabel = location.checkpoint || location.station || "Unknown checkpoint";
  return `${modeLabel} at ${checkpointLabel}`;
};

const parseRoleFromId = (professionalId, specificRole) => {
  const explicit = String(specificRole || "").trim();
  if (explicit) return explicit;

  const normalized = String(professionalId || "").toUpperCase();
  if (normalized.startsWith("TTR-")) return "TTR";
  if (normalized.startsWith("TTE-")) return "TTE";
  if (normalized.startsWith("RPF-")) return "RPF";
  if (normalized.startsWith("TNPOLICE-")) return "Police";
  return "TTR";
};

const NAV_ITEMS = [
  { key: "dashboard", label: "Officer Dashboard" },
  { key: "duty", label: "Assigned Duty" },
  { key: "alerts", label: "Complaint Alert List" },
  { key: "detail", label: "Complaint Detail View" },
  { key: "reply", label: "Reply / Status Update Form" },
  { key: "history", label: "Duty History" },
];

const ROLE_ACCENTS = {
  TTR: "#F59E0B",
  TTE: "#22C55E",
  RPF: "#3B82F6",
  Police: "#E11D48",
};

const URGENT_STATUSES = new Set(["Submitted", "Reported", "Staff Notified", "Seen", "Acknowledged"]);
const ACCEPTED_STATUSES = new Set(["Acknowledged", "Accepted", "Item Being Checked", "Passenger Contacted"]);
const RESOLVED_STATUSES = new Set(["Item Found", "Closed", "Resolved", "Recovered"]);

const formatTimelineTime = (value) => {
  if (!value) {
    return "Just now";
  }

  const dateValue = new Date(value);
  if (Number.isNaN(dateValue.getTime())) {
    return "Just now";
  }

  return dateValue.toLocaleString();
};

const isToday = (value) => {
  if (!value) {
    return false;
  }

  const dateValue = new Date(value);
  if (Number.isNaN(dateValue.getTime())) {
    return false;
  }

  const today = new Date();
  return (
    dateValue.getFullYear() === today.getFullYear() &&
    dateValue.getMonth() === today.getMonth() &&
    dateValue.getDate() === today.getDate()
  );
};

const normalizeAcceptedStatus = (status, acceptedAt) => {
  const normalizedStatus = String(status || "").trim();
  if (normalizedStatus === "Accepted" || normalizedStatus === "Acknowledged" || acceptedAt) {
    return "Accepted";
  }

  return normalizedStatus || "Submitted";
};

const OfficerDashboardScreen = ({
  roleLabel,
  officerEmail,
  professionalId,
  specificRole,
  staffName,
  authToken,
  authUserId,
  onLogout,
  onDuty,
  setOnDuty,
}) => {
  const dutyUnit = useMemo(() => parseRoleFromId(professionalId, specificRole), [professionalId, specificRole]);
  const officerName = staffName || officerEmail || professionalId || "Duty Officer";
  const roleAccent = ROLE_ACCENTS[dutyUnit] || ROLE_ACCENTS.TTR;
  const [activeView, setActiveView] = useState("dashboard");
  const [alerts, setAlerts] = useState([]);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [dutyAttendance, setDutyAttendance] = useState(null);
  const [dutyHistory, setDutyHistory] = useState([]);
  const [dutyTrain, setDutyTrain] = useState("");
  const [dutyRoute, setDutyRoute] = useState("");
  const [dutyStation, setDutyStation] = useState("");
  const [dutyShift, setDutyShift] = useState("");
  const [dutySyncing, setDutySyncing] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [error, setError] = useState("");
  const socketRef = useRef(null);
  const locationLoopRef = useRef(null);
  const checkpointIndexRef = useRef(0);
  const [liveLocation, setLiveLocation] = useState(null);
  const [locationMode, setLocationMode] = useState("mock");
  const [locationStatus, setLocationStatus] = useState("Location updates are inactive.");
  const [routeCheckpoints, setRouteCheckpoints] = useState([]);

  const buildHeaders = (extra = {}) => ({
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    "X-User-Role": "TTR/RPF/Police",
    ...extra,
  });

  const loadDutyStatus = async () => {
    try {
      const response = await axios.get(`${API_BASE}/auth/duty/status`, {
        params: {
          email: officerEmail || undefined,
          professionalId: professionalId || undefined,
        },
        headers: buildHeaders({
          "X-User-Email": officerEmail || "",
          "X-Professional-Id": professionalId || "",
        }),
      });

      const payload = response.data?.data || response.data || {};
      const attendance = payload?.attendance || null;
      setDutyAttendance(attendance);
      if (setOnDuty) {
        setOnDuty(Boolean(payload?.onDuty));
      }

      if (attendance) {
        setDutyTrain(attendance.assignedTrain || "");
        setDutyRoute(attendance.assignedRoute || "");
        setDutyStation(attendance.assignedStation || "");
        setDutyShift(attendance.assignedShift || "");
        if (attendance.liveLocationSnapshot) {
          setLiveLocation(attendance.liveLocationSnapshot);
          setLocationMode(attendance.liveLocationSnapshot.locationMode || "mock");
          setLocationStatus(`Last update: ${buildLiveMapLabel({
            mode: attendance.liveLocationSnapshot.locationMode,
            checkpoint: attendance.liveLocationSnapshot.routeCheckpoint,
            station: attendance.station,
          })}`);
        }
      }
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError.message || "Unable to load duty status");
    }
  };

  const loadAlerts = async () => {
    if (!onDuty) {
      setAlerts([]);
      setSelectedComplaint(null);
      return;
    }

    try {
      const response = await axios.get(`${API_BASE}/passenger/live-alerts`, {
        params: { staffRole: dutyUnit },
        headers: buildHeaders({
          "X-User-Email": officerEmail || "",
          "X-Professional-Id": professionalId || "",
          "X-User-Name": officerName,
          "X-Duty-Unit": dutyUnit,
          "X-On-Duty": String(onDuty),
        }),
      });

      const payload = response.data?.data || response.data || {};
      const list = Array.isArray(payload?.alerts)
        ? payload.alerts.map((alert) => ({
          id: alert._id || alert.complaintId || alert.id,
          status: normalizeAcceptedStatus(alert.status, alert.acceptedAt || alert.acknowledgedAt),
          passengerName: alert.passengerName || "Passenger",
          itemType: alert.itemType || alert.lostItemType || "Item",
          description: alert.description || "Lost-item complaint",
          vehicleNumber: alert.vehicleNumber || alert.trainNumber || "Train",
          route: alert.route || `${alert.fromLocation || "Origin"} -> ${alert.toLocation || "Destination"}`,
          nextStation: alert.recoveryStation || alert.meetingPoint || alert.toLocation || "Next station",
          priority: alert.priority || alert.urgencyLevel || "Normal",
          trainName: alert.trainName || alert.vehicleNumber || alert.trainNumber || "Train",
          coach: alert.coach || alert.coachNumber || "--",
          seat: alert.seat || alert.berthNumber || "--",
          currentTrainLocation: alert.currentTrainLocation || alert.lastSeenLocation || alert.fromLocation || "Unknown",
          currentLat: alert.currentLat ?? null,
          currentLng: alert.currentLng ?? null,
          boardingStation: alert.boardingStation || alert.fromLocation || "--",
          destinationStation: alert.destinationStation || alert.toLocation || "--",
          liveLocationSnapshot: alert.liveLocationSnapshot || null,
          createdAt: alert.createdAt || alert.submittedAt || null,
          updatedAt: alert.updatedAt || alert.lastUpdatedAt || null,
          acceptedAt: alert.acceptedAt || null,
          acknowledgedAt: alert.acknowledgedAt || null,
          acceptedBy: alert.assignedOfficerName || alert.acceptedBy || alert.assignedStaff?.[0]?.staffName || null,
          resolvedAt: alert.resolvedAt || null,
        }))
        : [];

      setAlerts(list);
      setSelectedComplaint((current) => list.find((entry) => entry.id === current?.id) || list[0] || null);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError.message || "Unable to load complaints");
    }
  };

  const loadDutyHistory = async () => {
    if (!authUserId) {
      setDutyHistory([]);
      return;
    }

    try {
      const response = await axios.get(`${API_BASE}/duty/history/${authUserId}`, {
        headers: buildHeaders({
          "X-User-Email": officerEmail || "",
          "X-Professional-Id": professionalId || "",
        }),
      });

      const payload = response.data?.data || response.data || {};
      setDutyHistory(Array.isArray(payload?.history) ? payload.history : []);
    } catch {
      setDutyHistory([]);
    }
  };

  useEffect(() => {
    loadDutyStatus();
  }, [officerEmail, professionalId, dutyUnit]);

  useEffect(() => {
    loadAlerts();
  }, [onDuty, dutyUnit, officerEmail, professionalId]);

  useEffect(() => {
    loadDutyHistory();
  }, [authUserId, dutyAttendance?._id]);

  const routeContext = useMemo(
    () => ({
      routeValue: dutyRoute || selectedComplaint?.route || dutyAttendance?.assignedRoute || "",
      trainValue: dutyTrain || selectedComplaint?.vehicleNumber || dutyAttendance?.assignedTrain || "",
      stationValue: dutyStation || selectedComplaint?.nextStation || dutyAttendance?.assignedStation || "",
    }),
    [dutyAttendance?.assignedRoute, dutyAttendance?.assignedStation, dutyAttendance?.assignedTrain, dutyRoute, dutyStation, dutyTrain, selectedComplaint?.nextStation, selectedComplaint?.route, selectedComplaint?.vehicleNumber],
  );

  const sortedAlerts = useMemo(
    () =>
      [...alerts].sort(
        (left, right) =>
          new Date(right.updatedAt || right.acceptedAt || right.createdAt || 0).getTime() -
          new Date(left.updatedAt || left.acceptedAt || left.createdAt || 0).getTime(),
      ),
    [alerts],
  );

  const openComplaintCount = useMemo(
    () => sortedAlerts.filter((alert) => !RESOLVED_STATUSES.has(String(alert.status || "").trim())).length,
    [sortedAlerts],
  );

  const highPriorityAlerts = useMemo(
    () => sortedAlerts.filter((alert) => /urgent|high|critical|p1/i.test(String(alert.priority || ""))),
    [sortedAlerts],
  );

  const acceptedCount = useMemo(
    () => sortedAlerts.filter((alert) => ACCEPTED_STATUSES.has(String(alert.status || ""))).length,
    [sortedAlerts],
  );

  const resolvedTodayCount = useMemo(
    () =>
      sortedAlerts.filter(
        (alert) => RESOLVED_STATUSES.has(String(alert.status || "")) && isToday(alert.resolvedAt || alert.updatedAt || alert.acceptedAt),
      ).length,
    [sortedAlerts],
  );

  const urgentRequests = useMemo(
    () =>
      sortedAlerts.filter((alert) => URGENT_STATUSES.has(String(alert.status || "")) || /urgent|high|critical|p1/i.test(String(alert.priority || ""))).slice(0, 5),
    [sortedAlerts],
  );

  const recentComplaintFeed = useMemo(() => sortedAlerts.slice(0, 5), [sortedAlerts]);

  const escalationQueue = useMemo(
    () => sortedAlerts.filter((alert) => /urgent|high|critical|p1/i.test(String(alert.priority || "")) && !RESOLVED_STATUSES.has(String(alert.status || ""))).slice(0, 5),
    [sortedAlerts],
  );

  const timelineEntries = useMemo(() => {
    const complaintEvents = sortedAlerts.slice(0, 4).map((alert) => ({
      id: `complaint-${alert.id}`,
      title: `${alert.itemType} · ${alert.status}`,
      detail: `${alert.passengerName} · ${alert.route}`,
      time: formatTimelineTime(alert.updatedAt || alert.acceptedAt || alert.createdAt),
    }));

    const dutyEvents = dutyHistory.slice(0, 4).map((entry) => ({
      id: `duty-${entry._id || entry.checkInTime || entry.checkOutTime}`,
      title: `Duty ${entry.dutyStatus || entry.status || "Update"}`,
      detail: `${entry.assignedTrain || "--"} · ${entry.assignedStation || "--"}`,
      time: formatTimelineTime(entry.checkInTime || entry.checkOutTime || entry.createdAt),
    }));

    return [...complaintEvents, ...dutyEvents].slice(0, 8);
  }, [dutyHistory, sortedAlerts]);

  useEffect(() => {
    const nextCheckpoints = buildCheckpointList(routeContext);
    setRouteCheckpoints(nextCheckpoints);
    if (checkpointIndexRef.current >= nextCheckpoints.length) {
      checkpointIndexRef.current = 0;
    }
  }, [routeContext]);

  const publishLiveLocation = useCallback(
    async (locationSnapshot) => {
      if (!locationSnapshot || !onDuty) {
        return;
      }

      try {
        await axios.post(
          `${API_BASE}/auth/duty/location`,
          {
            email: officerEmail || undefined,
            professionalId: professionalId || undefined,
            dutyUnit,
            assignedTrain: routeContext.trainValue || null,
            assignedRoute: routeContext.routeValue || null,
            assignedStation: routeContext.stationValue || null,
            liveLocationSnapshot: locationSnapshot,
            latitude: locationSnapshot.latitude,
            longitude: locationSnapshot.longitude,
            accuracy: locationSnapshot.accuracy || null,
            speed: locationSnapshot.speed || null,
            heading: locationSnapshot.heading || null,
            routeCheckpoint: locationSnapshot.checkpoint || null,
            mappedTrainPosition: locationSnapshot.mappedTrainPosition || null,
            locationMode: locationSnapshot.mode || "mock",
            station: locationSnapshot.checkpoint || routeContext.stationValue || null,
          },
          {
            headers: {
              ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
              "X-User-Role": "TTR/RPF/Police",
              "X-User-Email": officerEmail || "",
              "X-Professional-Id": professionalId || "",
              "X-User-Name": officerName,
              "X-Duty-Unit": dutyUnit,
            },
          },
        );
      } catch (requestError) {
        setError(requestError?.response?.data?.message || requestError.message || "Unable to update live location");
      }
    },
    [API_BASE, authToken, dutyUnit, officerEmail, officerName, onDuty, professionalId, routeContext.stationValue, routeContext.trainValue, routeContext.routeValue],
  );

  useEffect(() => {
    if (!onDuty) {
      setLocationStatus("Check in to start live location updates.");
      setLiveLocation(null);
      return undefined;
    }

    let cancelled = false;

    const updateLocation = async () => {
      const checkpoints = routeCheckpoints.length > 0 ? routeCheckpoints : buildCheckpointList(routeContext);
      if (checkpoints.length === 0) {
        return;
      }

      const checkpointIndex = checkpointIndexRef.current % checkpoints.length;
      const checkpoint = checkpoints[checkpointIndex];

      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (cancelled) {
          return;
        }

        if (permission.status === "granted") {
          const position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Highest,
          });

          if (cancelled) {
            return;
          }

          const liveSnapshot = {
            mode: "gps",
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy || null,
            speed: position.coords.speed || null,
            heading: position.coords.heading || null,
            checkpoint,
            routeLabel: routeContext.routeValue || dutyRoute || "",
            mappedTrainPosition: `${routeContext.trainValue || dutyTrain || "Train"} @ ${checkpoint}`,
            updatedAt: new Date().toISOString(),
          };

          setLiveLocation(liveSnapshot);
          setLocationMode("gps");
          setLocationStatus(`GPS live at ${checkpoint}`);
          await publishLiveLocation(liveSnapshot);
          return;
        }
      } catch (requestError) {
        if (!cancelled) {
          setLocationStatus("GPS unavailable. Running route simulation.");
        }
      }

      const fallbackCoordinate = buildMockCoordinate(
        `${routeContext.routeValue || dutyRoute || "route"}:${checkpoint}`,
        checkpointIndex,
      );
      const mockSnapshot = {
        mode: "mock",
        latitude: fallbackCoordinate.latitude,
        longitude: fallbackCoordinate.longitude,
        accuracy: 25,
        speed: null,
        heading: null,
        checkpoint,
        routeLabel: routeContext.routeValue || dutyRoute || "",
        mappedTrainPosition: `${routeContext.trainValue || dutyTrain || "Train"} @ ${checkpoint}`,
        updatedAt: new Date().toISOString(),
      };

      checkpointIndexRef.current = (checkpointIndexRef.current + 1) % checkpoints.length;
      setLiveLocation(mockSnapshot);
      setLocationMode("mock");
      setLocationStatus(`Mock movement at ${checkpoint}`);
      await publishLiveLocation(mockSnapshot);
    };

    updateLocation();
    locationLoopRef.current = setInterval(updateLocation, 20000);

    return () => {
      cancelled = true;
      if (locationLoopRef.current) {
        clearInterval(locationLoopRef.current);
        locationLoopRef.current = null;
      }
    };
  }, [dutyRoute, dutyTrain, dutyUnit, onDuty, publishLiveLocation, routeCheckpoints, routeContext]);

  useEffect(() => {
    const socket = socketService.connect(SOCKET_BASE, {
      transports: ["websocket"],
      reconnection: true,
      withCredentials: true,
    });

    socketRef.current = socket;

    const mergeAlert = (incoming) => {
      const complaint = incoming?.complaint || incoming || {};
      const complaintId = complaint._id || complaint.id || incoming?.complaintId || incoming?.reply?.complaintId;
      if (!complaintId) {
        return;
      }

      const assignedStaff = Array.isArray(incoming?.routedOfficers)
        ? incoming.routedOfficers
        : Array.isArray(complaint.assignedStaff)
          ? complaint.assignedStaff
          : [];

      const isRelevant =
        assignedStaff.length === 0 ||
        assignedStaff.some((entry) => {
          const assignedUnit = String(entry?.dutyUnit || entry?.staffRole || entry?.assignedRole || "").trim().toLowerCase();
          const assignedEmail = String(entry?.staffEmail || "").trim().toLowerCase();
          const assignedId = String(entry?.staffId || "").trim().toLowerCase();
          return (
            assignedUnit === dutyUnit.toLowerCase() ||
            (officerEmail && assignedEmail === officerEmail.trim().toLowerCase()) ||
            (professionalId && assignedId === professionalId.trim().toLowerCase())
          );
        }) ||
        String(complaint.assignedRole || "").trim().toLowerCase() === dutyUnit.toLowerCase() ||
        String(complaint.assignedToUnit || "").trim().toLowerCase() === dutyUnit.toLowerCase();

      if (!isRelevant) {
        return;
      }

      const alertView = {
        id: complaintId,
        status: normalizeAcceptedStatus(
          complaint.status || incoming?.newStatus || incoming?.status || "Submitted",
          complaint.acceptedAt || complaint.acknowledgedAt,
        ),
        passengerName: complaint.passengerName || "Passenger",
        itemType: complaint.itemType || complaint.lostItemType || "Item",
        description: complaint.description || complaint.complaintDescription || "Lost-item complaint",
        vehicleNumber: complaint.vehicleNumber || complaint.trainNumber || "Train",
        route: complaint.route || `${complaint.fromLocation || "Origin"} -> ${complaint.toLocation || "Destination"}`,
        nextStation: complaint.recoveryStation || complaint.meetingPoint || complaint.toLocation || "Next station",
        priority: complaint.priority || complaint.urgencyLevel || "Normal",
        messages: complaint.messages || [],
        summary: complaint.alertPriorityReason || complaint.description || "Passenger reported a lost item on the train.",
        assignedStaff: complaint.assignedStaff || [],
        staffResponseStatus: complaint.staffResponseStatus || "Awaiting duty reply",
        acceptedAt: complaint.acceptedAt || complaint.acknowledgedAt || null,
        acknowledgedAt: complaint.acknowledgedAt || null,
        acceptedBy: complaint.assignedOfficerName || complaint.acceptedBy || complaint.assignedStaff?.[0]?.staffName || null,
      };

      setAlerts((current) => {
        const next = [...current];
        const index = next.findIndex((item) => item.id === complaintId);
        if (index === -1) {
          return [alertView, ...current];
        }

        next[index] = {
          ...next[index],
          ...alertView,
        };
        return next;
      });

      setSelectedComplaint((current) => {
        if (current && current.id === complaintId) {
          return {
            ...current,
            ...alertView,
          };
        }
        return current;
      });
    };

    socket.on("complaint:new", mergeAlert);
    socket.on("complaint:reply", mergeAlert);
    socket.on("complaint:status-change", mergeAlert);
    socket.on("complaint:accepted", mergeAlert);
    socket.on("complaint:location-update", mergeAlert);

    socket.on("connect", () => {
      socket.emit("join:officer", professionalId || officerEmail || dutyUnit);
    });

    return () => {
      socket.off("complaint:new", mergeAlert);
      socket.off("complaint:reply", mergeAlert);
      socket.off("complaint:status-change", mergeAlert);
      socket.off("complaint:accepted", mergeAlert);
      socket.off("complaint:location-update", mergeAlert);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [dutyUnit, officerEmail, professionalId]);

  const syncDuty = async (nextOnDuty) => {
    setDutySyncing(true);
    setError("");

    try {
      const endpoint = nextOnDuty ? "/auth/duty/check-in" : "/auth/duty/check-out";
      const response = await axios.post(
        `${API_BASE}${endpoint}`,
        {
          email: officerEmail || undefined,
          professionalId: professionalId || undefined,
          dutyUnit,
          assignedTrain: dutyTrain || null,
          assignedRoute: dutyRoute || null,
          assignedStation: dutyStation || null,
          assignedShift: dutyShift || null,
        },
        {
          headers: buildHeaders({
            "X-User-Email": officerEmail || "",
            "X-Professional-Id": professionalId || "",
            "X-User-Name": officerName,
            "X-Duty-Unit": dutyUnit,
          }),
        },
      );

      if (setOnDuty) {
        setOnDuty(nextOnDuty);
      }

      setDutyAttendance(response.data?.attendance || null);
      await loadAlerts();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError.message || "Unable to update duty status");
    } finally {
      setDutySyncing(false);
    }
  };

  const handleSubmitReply = async (message, status) => {
    if (!selectedComplaint) {
      return;
    }

    setSendingReply(true);
    setError("");

    try {
      await axios.post(
        `${API_BASE}/passenger/complaints/${selectedComplaint.id}/staff/respond`,
        {
          text: message,
          markPassengerContacted: status === "Passenger Contacted",
        },
        {
          headers: buildHeaders({
            "X-User-Email": officerEmail || "",
            "X-Professional-Id": professionalId || "",
            "X-User-Name": officerName,
            "X-Duty-Unit": dutyUnit,
            "X-On-Duty": String(onDuty),
          }),
        },
      );
      await loadAlerts();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError.message || "Unable to send reply");
    } finally {
      setSendingReply(false);
    }
  };

  const handleSubmitStatus = async (status) => {
    if (!selectedComplaint) {
      return;
    }

    setSendingReply(true);
    setError("");

    try {
      await axios.patch(
        `${API_BASE}/passenger/complaints/${selectedComplaint.id}/staff/status`,
        {
          status,
          itemFound: status === "Item Found",
          meetingScheduled: status === "Ready for Handover",
          staffResponseStatus: `Status updated to ${status}`,
        },
        {
          headers: buildHeaders({
            "X-User-Email": officerEmail || "",
            "X-Professional-Id": professionalId || "",
            "X-User-Name": officerName,
            "X-Duty-Unit": dutyUnit,
            "X-On-Duty": String(onDuty),
          }),
        },
      );
      await loadAlerts();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError.message || "Unable to update status");
    } finally {
      setSendingReply(false);
    }
  };

  const handleAcceptComplaint = async (alert) => {
    if (!alert || !alert.id) {
      return;
    }

    setError("");

    try {
      const response = await axios.patch(
        `${API_BASE}/passenger/complaints/${alert.id}/staff/acknowledge`,
        {
          action: "Acknowledged",
          notes: alert.officerNotes || "",
          coachRemark: alert.coachRemark || "",
          stationRemark: alert.stationRemark || "",
        },
        {
          headers: buildHeaders({
            "X-User-Email": officerEmail || "",
            "X-Professional-Id": professionalId || "",
            "X-User-Name": officerName,
            "X-Duty-Unit": dutyUnit,
            "X-On-Duty": String(onDuty),
          }),
        },
      );

      const returnedComplaint = response.data?.data?.complaint || null;
      const acceptedAt = returnedComplaint?.acknowledgedAt || returnedComplaint?.acceptedAt || new Date().toISOString();
      const acceptedBy = returnedComplaint?.assignedOfficerName || officerName;

      setAlerts((current) =>
        current.map((item) =>
          item.id === alert.id
            ? {
              ...item,
              status: "Accepted",
              acceptedAt,
              acknowledgedAt: acceptedAt,
              acceptedBy,
              assignedOfficerName: acceptedBy,
              staffResponseStatus: "Complaint accepted by officer",
            }
            : item,
        ),
      );

      setSelectedComplaint((current) =>
        current && current.id === alert.id
          ? {
            ...current,
            status: "Accepted",
            acceptedAt,
            acknowledgedAt: acceptedAt,
            acceptedBy,
            assignedOfficerName: acceptedBy,
            staffResponseStatus: "Complaint accepted by officer",
          }
          : current,
      );

      setActiveView("reply");
      await loadAlerts();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError.message || "Unable to accept complaint");
    }
  };

  const handleOpenReplyForComplaint = (alert) => {
    if (!alert) {
      return;
    }

    setSelectedComplaint(alert);
    setActiveView("reply");
  };

  return (
    <View className="flex-1 bg-slate-50">
      
      {activeView === "dashboard" ? (
        <View className="flex-1 relative z-10">
           {/* Blue Header Background */}
           <View className="bg-blue-800 rounded-b-[40px] pt-14 pb-28 px-5 absolute w-full top-0 left-0 z-0">
             <View className="flex-row justify-between items-center">
                <Ionicons name="menu" size={28} color="white" />
                <View className="flex-row items-center gap-2">
                   <Ionicons name="shield-checkmark-outline" size={24} color="white" />
                   <View>
                     <Text className="text-white font-bold text-lg leading-tight">SafeRide Guardian</Text>
                     <Text className="text-blue-200 text-xs">TTR Dashboard</Text>
                   </View>
                </View>
                <View className="relative">
                   <Ionicons name="notifications-outline" size={24} color="white" />
                   <View className="absolute -top-1 -right-1 bg-red-500 rounded-full w-4 h-4 justify-center items-center">
                     <Text className="text-white text-[10px] font-bold">4</Text>
                   </View>
                </View>
             </View>
           </View>

           <ScrollView className="flex-1 pt-32 px-4 z-10" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
             {/* Officer Profile Card */}
             <View className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 mb-4 flex-row items-center">
                <View className="relative mr-4">
                  <View className="w-16 h-16 rounded-full bg-slate-200 justify-center items-center overflow-hidden border-2 border-slate-100">
                    <Ionicons name="person" size={40} color="#94A3B8" />
                  </View>
                  <View className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-white rounded-full" />
                </View>
                <View className="flex-1">
                  <Text className="text-slate-800 font-bold text-lg mb-1">{officerName}</Text>
                  <Text className="text-slate-500 text-xs">TTR ID: {professionalId || "TTR12587"}</Text>
                  <Text className="text-slate-500 text-xs">Division: MAS</Text>
                  <Text className="text-slate-500 text-xs">Zone: SR</Text>
                </View>
                <View className="bg-green-50 px-3 py-1.5 rounded-full flex-row items-center border border-green-100">
                  <View className="w-2 h-2 rounded-full bg-green-500 mr-1.5" />
                  <Text className="text-green-700 font-bold text-[10px]">ON DUTY</Text>
                </View>
             </View>

             {/* Assigned Train */}
             <View className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 mb-4 flex-row items-center">
                <View className="w-12 h-12 bg-blue-600 rounded-full justify-center items-center mr-4 shadow-sm shadow-blue-600/30">
                   <Ionicons name="train" size={24} color="white" />
                </View>
                <View className="flex-1 border-r border-slate-100 pr-2">
                   <Text className="text-slate-400 text-[10px] mb-0.5 uppercase font-bold tracking-widest">Assigned Train</Text>
                   <Text className="text-slate-800 font-black text-sm mb-1">{routeContext.trainValue || "12623 / Kanyakumari Express"}</Text>
                   <View className="flex-row items-center gap-2">
                      <Text className="text-slate-700 font-bold text-xs">{routeContext.stationValue || "MAS"}</Text>
                      <Ionicons name="arrow-forward" size={12} color="#2563EB" />
                      <Text className="text-slate-700 font-bold text-xs">{dutyStation || "CAPE"}</Text>
                   </View>
                </View>
                <View className="items-center pl-2">
                   <View className="bg-blue-50 px-2 py-1 rounded mb-2 w-full">
                      <Text className="text-blue-600 font-bold text-[9px] text-center">Coach Range</Text>
                      <Text className="text-slate-800 font-black text-xs text-center">S1 - S6</Text>
                   </View>
                   <Text className="text-slate-400 text-[9px] text-center">Journey Date</Text>
                   <Text className="text-slate-800 font-bold text-[10px] text-center">17 May 2024</Text>
                </View>
             </View>

             {/* Grid Buttons */}
             <View className="flex-row justify-between mb-6 gap-2">
                {[
                  { icon: "ticket", color: "text-blue-600", bg: "bg-blue-50", label: "Check\nTicket", iconColor: "#2563eb" },
                  { icon: "person-add", color: "text-green-600", bg: "bg-green-50", label: "Passenger\nList", iconColor: "#16a34a" },
                  { icon: "cash", color: "text-orange-600", bg: "bg-orange-50", label: "Penalty\nChallan", iconColor: "#ea580c" },
                  { icon: "document-text", color: "text-purple-600", bg: "bg-purple-50", label: "Daily\nReport", iconColor: "#9333ea" }
                ].map((btn, idx) => (
                  <Pressable key={idx} className="flex-1 bg-white rounded-2xl p-3 items-center shadow-sm border border-slate-100">
                     <View className={`${btn.bg} w-10 h-10 rounded-xl justify-center items-center mb-2`}>
                       <Ionicons name={btn.icon} size={20} color={btn.iconColor} />
                     </View>
                     <Text className="text-slate-700 text-[10px] font-bold text-center leading-tight">{btn.label}</Text>
                  </Pressable>
                ))}
             </View>

             {/* Today's Summary */}
             <View className="mb-6">
               <View className="flex-row justify-between items-center mb-3 px-1">
                 <Text className="text-slate-800 font-black text-xs tracking-widest uppercase">Today's Summary</Text>
                 <Text className="text-blue-600 font-bold text-xs">View All</Text>
               </View>
               <View className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 flex-row justify-between">
                  {[
                    { icon: "ticket", val: "142", sub: "Tickets\nChecked", c: "#3b82f6", b: "bg-blue-50" },
                    { icon: "checkmark-circle", val: "128", sub: "Valid\nTickets", c: "#22c55e", b: "bg-green-50" },
                    { icon: "cash", val: "14", sub: "Penalty\nChallans", c: "#f97316", b: "bg-orange-50" },
                    { icon: "wallet", val: "₹ 12,650", sub: "Total Collection\n(Today)", c: "#a855f7", b: "bg-purple-50" }
                  ].map((item, idx) => (
                    <View key={idx} className={`items-center flex-1 ${idx !== 3 ? 'border-r border-slate-100' : ''}`}>
                      <View className={`${item.b} w-8 h-8 rounded-full justify-center items-center mb-2`}>
                        <Ionicons name={item.icon} size={16} color={item.c} />
                      </View>
                      <Text className="text-slate-800 font-black text-sm mb-1">{item.val}</Text>
                      <Text className="text-slate-500 text-[9px] text-center leading-tight">{item.sub}</Text>
                    </View>
                  ))}
               </View>
             </View>

             {/* Active Alerts */}
             <View className="mb-6">
               <View className="flex-row justify-between items-center mb-3 px-1">
                 <Text className="text-slate-800 font-black text-xs tracking-widest uppercase">Active Alerts / Complaints</Text>
                 <Pressable onPress={() => setActiveView("alerts")}>
                   <Text className="text-blue-600 font-bold text-xs">View All</Text>
                 </Pressable>
               </View>
               <View className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 mb-3">
                 <View className="flex-row justify-between items-center mb-4 pb-4 border-b border-slate-100">
                    {[
                      { icon: "warning", val: openComplaintCount || "3", sub: "New\nComplaints", c: "#ef4444", b: "bg-red-50" },
                      { icon: "time", val: acceptedCount || "2", sub: "In\nProgress", c: "#f97316", b: "bg-orange-50" },
                      { icon: "shield-checkmark", val: "1", sub: "Item\nSecured", c: "#3b82f6", b: "bg-blue-50" },
                      { icon: "checkmark-circle", val: resolvedTodayCount || "8", sub: "Resolved", c: "#22c55e", b: "bg-green-50" }
                    ].map((item, idx) => (
                      <View key={idx} className="flex-row items-center flex-1 justify-center gap-1.5">
                        <View className={`${item.b} w-8 h-8 rounded-full justify-center items-center`}>
                          <Ionicons name={item.icon} size={16} color={item.c} />
                        </View>
                        <View>
                          <Text className="text-slate-800 font-black text-sm leading-none">{item.val}</Text>
                          <Text className="text-slate-500 text-[8px] leading-tight">{item.sub}</Text>
                        </View>
                      </View>
                    ))}
                 </View>
                 
                 {/* Recent Complaint Feed */}
                 {recentComplaintFeed.length > 0 ? recentComplaintFeed.slice(0,2).map((alert, idx) => (
                   <Pressable key={alert.id} onPress={() => { setSelectedComplaint(alert); setActiveView("detail"); }} className={`rounded-2xl p-3 flex-row items-center ${idx === 0 ? 'bg-red-50 border border-red-100 mb-2' : 'bg-orange-50 border border-orange-100'}`}>
                      <View className={`w-10 h-10 rounded-xl justify-center items-center mr-3 ${idx === 0 ? 'bg-red-500/10' : 'bg-orange-500/10'}`}>
                        <Ionicons name={idx === 0 ? "briefcase" : "time"} size={20} color={idx === 0 ? '#ef4444' : '#f97316'} />
                      </View>
                      <View className="flex-1">
                        <Text className="text-slate-800 font-bold text-xs mb-0.5">Complaint ID: {alert.id.substring(0,13)}</Text>
                        <Text className="text-slate-600 text-xs mb-0.5">{alert.itemType}</Text>
                        <Text className="text-slate-500 text-[10px]">{alert.coach}, Seat {alert.seat} • Reported by: {alert.passengerName}</Text>
                      </View>
                      <View className="items-end">
                        <View className={`px-2 py-1 rounded mb-2 ${idx === 0 ? 'bg-red-200' : 'bg-orange-200'}`}>
                          <Text className={`text-[9px] font-bold uppercase ${idx === 0 ? 'text-red-700' : 'text-orange-700'}`}>{idx === 0 ? 'NEW' : 'IN PROGRESS'}</Text>
                        </View>
                        <Text className="text-slate-500 text-[10px]">{formatTimelineTime(alert.createdAt).split(",")[1] || "09:12 AM"}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={14} color="#94A3B8" style={{ marginLeft: 4 }} />
                   </Pressable>
                 )) : (
                   <Text className="text-slate-400 text-sm text-center">No Active Complaints</Text>
                 )}
               </View>
             </View>

             {/* Quick Tools */}
             <View className="mb-8">
               <Text className="text-slate-800 font-black text-xs tracking-widest uppercase px-1 mb-3">Quick Tools</Text>
               <View className="flex-row justify-between">
                  {[
                    { icon: "megaphone", label: "Broadcast\nMessage", c: "#9333ea" },
                    { icon: "book", label: "Rules &\nCirculars", c: "#2563eb" },
                    { icon: "location", label: "Next Stop\nInfo", c: "#16a34a" },
                    { icon: "person", label: "Emergency\nContacts", c: "#ea580c" },
                    { icon: "headset", label: "Help &\nSupport", c: "#ef4444" }
                  ].map((tool, idx) => (
                    <View key={idx} className="items-center">
                       <View className="bg-white shadow-sm border border-slate-100 w-12 h-12 rounded-full justify-center items-center mb-2">
                          <Ionicons name={tool.icon} size={20} color={tool.c} />
                       </View>
                       <Text className="text-slate-600 text-[9px] font-bold text-center leading-tight">{tool.label}</Text>
                    </View>
                  ))}
               </View>
             </View>
             
           </ScrollView>
        </View>
      ) : (
        <SafeAreaView className="flex-1 relative z-10">
          <View className="bg-white flex-row items-center p-4 border-b border-slate-200">
             <Pressable onPress={() => setActiveView('dashboard')} className="mr-3">
                <Ionicons name="arrow-back" size={24} color="#0F172A" />
             </Pressable>
             <Text className="text-slate-900 font-bold text-lg capitalize">
                {activeView.replace('detail', 'Complaint Details').replace('duty', 'My Trips').replace('alerts', 'Active Alerts')}
             </Text>
          </View>
          <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: 100 }}>
             {activeView === "duty" && (
               <View className="gap-5">
                 <DutyStatusCard onDuty={onDuty} syncing={dutySyncing} />
                 {/* Modern Live Tracking Card */}
                 <View className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm gap-4 mb-8">
                   <View className="flex-row justify-between items-center">
                     <Text className="text-slate-900 text-lg font-black">Live Tracking</Text>
                     <View className="bg-emerald-50 px-2 py-1 rounded border border-emerald-100">
                       <Text className="text-emerald-600 text-[10px] font-black uppercase tracking-wider">{locationMode}</Text>
                     </View>
                   </View>
                   <View className="flex-row flex-wrap gap-2">
                     <View className="bg-slate-50 px-3 py-2 rounded-xl flex-1 border border-slate-100">
                       <Text className="text-slate-400 text-[10px] font-bold uppercase">Train</Text>
                       <Text className="text-slate-800 text-sm font-semibold mt-0.5">{routeContext.trainValue || dutyTrain || "--"}</Text>
                     </View>
                     <View className="bg-slate-50 px-3 py-2 rounded-xl flex-1 border border-slate-100">
                       <Text className="text-slate-400 text-[10px] font-bold uppercase">Route</Text>
                       <Text className="text-slate-800 text-sm font-semibold mt-0.5">{routeContext.routeValue || dutyRoute || "--"}</Text>
                     </View>
                   </View>
                   <View className="rounded-2xl bg-slate-900 overflow-hidden mt-2 p-5 shadow-lg">
                     <View className="flex-row items-center gap-2 mb-4">
                       <View className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                       <Text className="text-white font-bold text-sm">Active Map Feed</Text>
                     </View>
                     <Text className="text-slate-400 text-xs mb-6">{buildLiveMapLabel(liveLocation)}</Text>
                     <View className="flex-row items-start justify-between relative pt-2">
                       <View className="absolute top-3 left-0 right-0 h-[2px] bg-slate-800 z-0" />
                       {routeCheckpoints.slice(0, 4).map((checkpoint, index) => {
                         const active = liveLocation?.checkpoint ? liveLocation.checkpoint === checkpoint : index === 0;
                         return (
                           <View key={index} className="items-center z-10 w-16">
                             <View className={`w-4 h-4 rounded-full border-2 border-slate-900 mb-2 ${active ? 'bg-blue-400 shadow-md shadow-blue-400/50' : 'bg-slate-700'}`} />
                             <Text className={`text-[9px] text-center font-bold ${active ? 'text-white' : 'text-slate-500'}`} numberOfLines={2}>{checkpoint}</Text>
                           </View>
                         );
                       })}
                     </View>
                   </View>
                 </View>
               </View>
             )}
             {activeView === "alerts" && (
                <View className="mb-8">
                  <ComplaintAlertListScreen
                    alerts={alerts}
                    selectedId={selectedComplaint?.id || ""}
                    onSelect={(item) => { setSelectedComplaint(item); setActiveView("detail"); }}
                    onAccept={handleAcceptComplaint}
                    onOpenReply={handleOpenReplyForComplaint}
                  />
                </View>
             )}
             {activeView === "detail" && selectedComplaint && (
                <View className="mb-8 bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                  <ComplaintDetailView complaint={selectedComplaint} onOpenReply={() => setActiveView("reply")} />
                </View>
             )}
             {activeView === "reply" && (
                <View className="mb-8 bg-white rounded-3xl p-5 shadow-sm border border-slate-200">
                  <ReplyStatusUpdateForm complaint={selectedComplaint} sending={sendingReply} onSubmitReply={handleSubmitReply} onSubmitStatus={handleSubmitStatus} />
                </View>
             )}
             {activeView === "history" && (
                <View className="mb-8 bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                  <DutyHistoryScreen history={dutyHistory} />
                </View>
             )}
          </ScrollView>
        </SafeAreaView>
      )}

      {/* BOTTOM NAVIGATION FIXED TO BOTTOM */}
      <View className="absolute bottom-0 w-full bg-white border-t border-slate-200 flex-row justify-around items-center px-2 pt-3 pb-8 z-50">
         <Pressable onPress={() => setActiveView('dashboard')} className="items-center px-2">
            <Ionicons name={activeView === 'dashboard' ? 'home' : 'home-outline'} size={24} color={activeView === 'dashboard' ? '#2563EB' : '#94A3B8'} />
            <Text className={`text-[10px] font-bold mt-1 ${activeView === 'dashboard' ? 'text-blue-600' : 'text-slate-500'}`}>Dashboard</Text>
         </Pressable>
         <Pressable onPress={() => setActiveView('duty')} className="items-center px-2">
            <Ionicons name={activeView === 'duty' ? 'train' : 'train-outline'} size={24} color={activeView === 'duty' ? '#2563EB' : '#94A3B8'} />
            <Text className={`text-[10px] font-bold mt-1 ${activeView === 'duty' ? 'text-blue-600' : 'text-slate-500'}`}>My Trips</Text>
         </Pressable>
         <View className="relative -top-5 items-center px-2">
            <Pressable onPress={() => setActiveView('alerts')} className="bg-blue-600 w-16 h-16 rounded-full justify-center items-center border-4 border-slate-50 shadow-lg shadow-blue-600/40">
               <Ionicons name="scan" size={28} color="white" />
            </Pressable>
            <Text className="text-[10px] font-bold text-slate-500 text-center mt-1">Scan Ticket</Text>
         </View>
         <Pressable onPress={() => setActiveView('history')} className="items-center px-2">
            <Ionicons name={activeView === 'history' ? 'bar-chart' : 'bar-chart-outline'} size={24} color={activeView === 'history' ? '#2563EB' : '#94A3B8'} />
            <Text className={`text-[10px] font-bold mt-1 ${activeView === 'history' ? 'text-blue-600' : 'text-slate-500'}`}>Reports</Text>
         </Pressable>
         <Pressable onPress={onLogout} className="items-center px-2">
            <Ionicons name="person-outline" size={24} color="#94A3B8" />
            <Text className="text-[10px] font-bold text-slate-500 mt-1">Profile</Text>
         </Pressable>
      </View>
    </View>
  );
};


export default OfficerDashboardScreen;
