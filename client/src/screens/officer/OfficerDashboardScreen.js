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
    <SafeAreaView style={styles.shell}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topCard}>
          <Text style={[styles.kicker, { color: roleAccent }]}>Officer Side</Text>
          <Text style={styles.title}>{roleLabel || `${dutyUnit} Dashboard`}</Text>
          <Text style={styles.subtitle}>{officerName}</Text>

          <View style={styles.headerMetaRow}>
            <View style={[styles.statusPill, onDuty ? styles.statusPillOn : styles.statusPillOff]}>
              <Text style={styles.statusPillText}>{onDuty ? "ON DUTY" : "OFF DUTY"}</Text>
            </View>
            <View style={styles.statusPillMuted}>
              <Text style={styles.statusPillMutedText}>{dutyAttendance?.assignedTrain || dutyTrain || "Train pending"}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.navWrap, { borderBottomColor: roleAccent }]}>
          {NAV_ITEMS.map((item) => {
            const selected = activeView === item.key;
            return (
              <Pressable
                key={item.key}
                style={[
                  styles.navChip,
                  selected && [styles.navChipActive, { borderBottomColor: roleAccent }],
                ]}
                onPress={() => setActiveView(item.key)}
              >
                <Text style={[styles.navChipText, selected && { color: roleAccent, fontWeight: "800" }]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <DutyStatusCard
          onDuty={onDuty}
          syncing={dutySyncing}
          dutyTrain={dutyTrain}
          dutyRoute={dutyRoute}
          dutyStation={dutyStation}
          dutyShift={dutyShift}
          onChangeTrain={setDutyTrain}
          onChangeRoute={setDutyRoute}
          onChangeStation={setDutyStation}
          onChangeShift={setDutyShift}
          onCheckIn={() => syncDuty(true)}
          onCheckOut={() => syncDuty(false)}
          attendance={dutyAttendance}
        />

        <View style={styles.locationCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.locationTitle}>Live train tracking</Text>
            <Text style={styles.locationModeBadge}>{locationMode.toUpperCase()}</Text>
          </View>
          <Text style={styles.locationStatusText}>{locationStatus}</Text>
          <Text style={styles.locationMeta}>Route: {routeContext.routeValue || dutyRoute || "Route pending"}</Text>
          <Text style={styles.locationMeta}>Train: {routeContext.trainValue || dutyTrain || "Train pending"}</Text>
          <Text style={styles.locationMeta}>Coach: {selectedComplaint?.coach || selectedComplaint?.seat || "Use the selected complaint to show coach context"}</Text>
          <Text style={styles.locationMeta}>
            Current position: {liveLocation ? `${liveLocation.latitude.toFixed(4)}, ${liveLocation.longitude.toFixed(4)}` : "Waiting for first update"}
          </Text>
          <Text style={styles.locationMeta}>Checkpoint: {liveLocation?.checkpoint || routeCheckpoints[0] || "--"}</Text>

          <View style={styles.mapPlaceholder}>
            <Text style={styles.mapPlaceholderTitle}>Live map placeholder</Text>
            <Text style={styles.mapPlaceholderText}>{buildLiveMapLabel(liveLocation)}</Text>
            <View style={styles.checkpointRail}>
              {routeCheckpoints.slice(0, 5).map((checkpoint, index) => {
                const active = liveLocation?.checkpoint ? liveLocation.checkpoint === checkpoint : index === 0;
                return (
                  <View key={`${checkpoint}-${index}`} style={styles.checkpointNodeWrap}>
                    <View style={[styles.checkpointNode, active && styles.checkpointNodeActive]} />
                    <Text style={[styles.checkpointLabel, active && styles.checkpointLabelActive]} numberOfLines={1}>
                      {checkpoint}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        <View style={styles.metricGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Open complaints</Text>
            <Text style={[styles.metricValue, { color: roleAccent }]}>{openComplaintCount}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>High priority</Text>
            <Text style={styles.metricValue}>{highPriorityAlerts.length}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Accepted</Text>
            <Text style={styles.metricValue}>{acceptedCount}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Resolved today</Text>
            <Text style={styles.metricValue}>{resolvedTodayCount}</Text>
          </View>
        </View>

        {activeView === "dashboard" ? (
          <View style={styles.dashboardStack}>
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Officer header</Text>
              <View style={styles.profileSection}>
                <Text style={styles.profileLabel}>Officer Name:</Text>
                <Text style={styles.profileValue}>{officerName}</Text>

                <Text style={styles.profileLabel}>Email:</Text>
                <Text style={styles.profileValue}>{officerEmail || "Not provided"}</Text>

                <Text style={styles.profileLabel}>Professional ID:</Text>
                <Text style={styles.profileValue}>{professionalId || "Not provided"}</Text>

                <Text style={styles.profileLabel}>Role:</Text>
                <Text style={styles.profileValue}>{dutyUnit}</Text>
              </View>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Assigned duty</Text>
              <View style={styles.profileSection}>
                <Text style={styles.profileLabel}>Train:</Text>
                <Text style={styles.profileValue}>{dutyAttendance?.assignedTrain || dutyTrain || "Train pending"}</Text>

                <Text style={styles.profileLabel}>Route:</Text>
                <Text style={styles.profileValue}>{dutyAttendance?.assignedRoute || dutyRoute || "Route pending"}</Text>

                <Text style={styles.profileLabel}>Shift:</Text>
                <Text style={styles.profileValue}>{dutyAttendance?.assignedShift || dutyShift || "Shift pending"}</Text>
              </View>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Urgent blinking requests</Text>
              <Text style={styles.sectionNote}>Requests here remain highlighted until accepted or resolved.</Text>
              {urgentRequests.length > 0 ? (
                urgentRequests.map((item) => (
                  <View key={item.id} style={styles.urgentCard}>
                    <Text style={styles.urgentTag}>{item.status}</Text>
                    <Text style={styles.urgentTitle}>{item.itemType}</Text>
                    <Text style={styles.urgentText}>{item.passengerName} · {item.route}</Text>
                    <Text style={styles.urgentText}>Priority: {item.priority}</Text>
                  </View>
                ))
              ) : (
                <View style={styles.emptyStateSection}>
                  <Text style={styles.emptyStateTitle}>No urgent requests</Text>
                  <Text style={styles.emptyStateMessage}>High priority complaints will appear here and blink until accepted.</Text>
                </View>
              )}
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Recent complaint feed</Text>
              {recentComplaintFeed.length > 0 ? (
                recentComplaintFeed.map((item) => (
                  <View key={item.id} style={styles.feedRow}>
                    <View style={styles.feedDot} />
                    <View style={styles.feedBody}>
                      <Text style={styles.feedTitle}>{item.itemType}</Text>
                      <Text style={styles.feedText}>{item.passengerName} · {item.status}</Text>
                      <Text style={styles.feedText}>{item.route}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.sectionNote}>No complaint feed items yet.</Text>
              )}
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Message / reply center</Text>
              <ReplyStatusUpdateForm
                complaint={selectedComplaint}
                sending={sendingReply}
                onSubmitReply={handleSubmitReply}
                onSubmitStatus={handleSubmitStatus}
              />
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Escalation queue</Text>
              {escalationQueue.length > 0 ? (
                escalationQueue.map((item) => (
                  <View key={item.id} style={styles.queueRow}>
                    <View style={styles.queueLeft}>
                      <Text style={styles.queueTitle}>{item.itemType}</Text>
                      <Text style={styles.queueText}>{item.passengerName} · {item.route}</Text>
                    </View>
                    <View style={styles.queuePill}>
                      <Text style={styles.queuePillText}>{item.priority}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.sectionNote}>No escalations waiting right now.</Text>
              )}
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Activity timeline</Text>
              {timelineEntries.length > 0 ? (
                timelineEntries.map((entry) => (
                  <View key={entry.id} style={styles.timelineRow}>
                    <View style={styles.timelineDot} />
                    <View style={styles.timelineBody}>
                      <Text style={styles.timelineTitle}>{entry.title}</Text>
                      <Text style={styles.timelineText}>{entry.detail}</Text>
                      <Text style={styles.timelineTime}>{entry.time}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.sectionNote}>Activity entries will appear after duty updates and complaint actions.</Text>
              )}
            </View>
          </View>
        ) : null}

        {(activeView === "dashboard" || activeView === "alerts") && (
          <View>
            <ComplaintAlertListScreen
              alerts={alerts}
              selectedId={selectedComplaint?.id || ""}
              onSelect={(item) => {
                setSelectedComplaint(item);
                setActiveView("detail");
              }}
              onAccept={handleAcceptComplaint}
              onOpenReply={handleOpenReplyForComplaint}
            />
          </View>
        )}

        {activeView === "detail" && selectedComplaint && (
          <View style={{ marginTop: 16 }}>
            <ComplaintDetailView complaint={selectedComplaint} onOpenReply={() => setActiveView("reply")} />
          </View>
        )}

        {activeView === "reply" ? (
          <ReplyStatusUpdateForm
            complaint={selectedComplaint}
            sending={sendingReply}
            onSubmitReply={handleSubmitReply}
            onSubmitStatus={handleSubmitStatus}
          />
        ) : null}

        {activeView === "history" ? <DutyHistoryScreen history={dutyHistory} /> : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={styles.logoutButton} onPress={onLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: "#E2E8F0",
  },
  content: {
    padding: 12,
    gap: 12,
    backgroundColor: "#F8FAFC",
  },
  topCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    borderWidth: 0,
    borderColor: "#E2E8F0",
    gap: 8,
    elevation: 4,
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },

  kicker: {
    color: "#3B82F6",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  title: {
    color: "#0F172A",
    fontSize: 26,
    fontWeight: "900",
    marginTop: 4,
    letterSpacing: -0.5,
  },
  subtitle: {
    color: "#64748B",
    marginTop: 6,
    fontSize: 14,
    fontWeight: "500",
  },
  headerMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 0,
  },
  statusPillOn: {
    backgroundColor: "#D1FAE5",
    borderColor: "#10B981",
  },
  statusPillOff: {
    backgroundColor: "#FEE2E2",
    borderColor: "#EF4444",
  },
  statusPillText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  statusPillMuted: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
    borderWidth: 0,
    borderColor: "#E2E8F0",
  },
  statusPillMutedText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "600",
  },
  navWrap: {
    flexDirection: "row",
    gap: 0,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 2,
    borderBottomColor: "#E2E8F0",
    paddingHorizontal: 0,
  },
  navChip: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "transparent",
    borderWidth: 0,
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  navChipActive: {
    borderBottomWidth: 3,
  },
  navChipText: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "600",
  },
  navChipTextActive: {
    color: "#0F172A",
    fontWeight: "800",
  },
  sectionCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    padding: 12,
    gap: 5,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  dashboardStack: {
    gap: 12,
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metricCard: {
    flexBasis: "48%",
    backgroundColor: "#FFFFFF",
    borderWidth: 0,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 14,
    gap: 6,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  metricLabel: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  metricValue: {
    color: "#0F172A",
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  locationCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 0,
    borderColor: "#E2E8F0",
    padding: 16,
    gap: 8,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  locationStatusText: {
    color: "#10B981",
    fontSize: 13,
    fontWeight: "600",
  },
  locationMeta: {
    color: "#64748B",
    fontSize: 12,
    lineHeight: 18,
  },
  locationModeBadge: {
    color: "#0F172A",
    backgroundColor: "#F1F5F9",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 11,
    fontWeight: "700",
  },
  sectionMeta: {
    fontSize: 13,
    color: "#475569",
  },
  sectionNote: {
    color: "#64748B",
    fontSize: 12,
    lineHeight: 18,
  },
  urgentCard: {
    backgroundColor: "#FFF7ED",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FDBA74",
    padding: 12,
    gap: 4,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  urgentTag: {
    color: "#C2410C",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  urgentTitle: {
    color: "#7C2D12",
    fontSize: 15,
    fontWeight: "800",
  },
  urgentText: {
    color: "#9A3412",
    fontSize: 12,
    lineHeight: 17,
  },
  feedRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    paddingVertical: 2,
  },
  feedDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#1D4ED8",
    marginTop: 5,
  },
  feedBody: {
    flex: 1,
    gap: 2,
  },
  feedTitle: {
    color: "#0F172A",
    fontWeight: "700",
    fontSize: 14,
  },
  feedText: {
    color: "#475569",
    fontSize: 12,
    lineHeight: 17,
  },
  queueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  queueLeft: {
    flex: 1,
    gap: 2,
  },
  queueTitle: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "800",
  },
  queueText: {
    color: "#475569",
    fontSize: 12,
  },
  queuePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#DBEAFE",
    borderWidth: 1,
    borderColor: "#93C5FD",
  },
  queuePillText: {
    color: "#1E3A8A",
    fontSize: 11,
    fontWeight: "800",
  },
  timelineRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    paddingVertical: 2,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#22C55E",
    marginTop: 5,
  },
  timelineBody: {
    flex: 1,
    gap: 2,
  },
  timelineTitle: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "800",
  },
  timelineText: {
    color: "#475569",
    fontSize: 12,
    lineHeight: 17,
  },
  timelineTime: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "700",
  },
  locationMeta: {
    color: "#CBD5E1",
    fontSize: 12,
    lineHeight: 18,
  },
  mapPlaceholder: {
    marginTop: 6,
    borderRadius: 12,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#334155",
    padding: 10,
    gap: 6,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  mapPlaceholderTitle: {
    color: "#F8FAFC",
    fontWeight: "700",
    fontSize: 13,
  },
  mapPlaceholderText: {
    color: "#93C5FD",
    fontSize: 12,
  },
  checkpointRail: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 4,
  },
  checkpointNodeWrap: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  checkpointNode: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#475569",
  },
  checkpointNodeActive: {
    backgroundColor: "#22C55E",
    shadowColor: "#22C55E",
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
  checkpointLabel: {
    color: "#94A3B8",
    fontSize: 10,
    textAlign: "center",
  },
  checkpointLabelActive: {
    color: "#E2E8F0",
    fontWeight: "700",
  },
  profileSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    gap: 10,
  },
  profileLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  profileValue: {
    fontSize: 14,
    color: "#0F172A",
    fontWeight: "500",
    marginBottom: 8,
  },
  onDutyText: {
    color: "#16A34A",
    fontWeight: "700",
  },
  offDutyText: {
    color: "#DC2626",
    fontWeight: "700",
  },
  emptyStateSection: {
    marginTop: 16,
    paddingVertical: 20,
    paddingHorizontal: 12,
    backgroundColor: "#F0F9FF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E0F2FE",
    alignItems: "center",
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0369A1",
    marginBottom: 8,
  },
  emptyStateMessage: {
    fontSize: 12,
    color: "#0C4A6E",
    textAlign: "center",
    lineHeight: 18,
  },
  complaintsSummarySection: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "#F0FDF4",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#DCFCE7",
  },
  complaintsSummaryTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#15803D",
    marginBottom: 6,
  },
  complaintsSummaryCount: {
    fontSize: 13,
    color: "#166534",
    fontWeight: "600",
  },
  complaintsSummaryHint: {
    fontSize: 12,
    color: "#4B5563",
    marginTop: 6,
    fontStyle: "italic",
  },
  error: {
    color: "#B91C1C",
    fontSize: 12,
  },
  logoutButton: {
    marginTop: 4,
    borderRadius: 10,
    paddingVertical: 12,
    backgroundColor: "#1E293B",
    alignItems: "center",
  },
  logoutText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});

export default OfficerDashboardScreen;
