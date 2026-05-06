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
    <SafeAreaView className="flex-1 bg-slate-100">

      {/* ---------------- SCROLLABLE PILL NAV BAR ---------------- */}
      <View className="bg-slate-100 pt-2 pb-3">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeView === item.key;
            return (
              <Pressable
                key={item.key}
                className={`flex-row items-center px-5 py-3 rounded-full transition-all ${isActive ? "bg-slate-900 shadow-md shadow-slate-900/20" : "bg-white border border-slate-200"
                  }`}
                onPress={() => setActiveView(item.key)}
              >
                <Ionicons
                  name={item.icon}
                  size={16}
                  color={isActive ? "#FFFFFF" : "#64748B"}
                  style={{ marginRight: 6 }}
                />
                <Text className={`text-sm font-bold ${isActive ? "text-white" : "text-slate-600"}`}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 20 }} className="flex-1">

        {error ? (
          <View className="bg-red-50 p-3 rounded-xl border border-red-100">
            <Text className="text-red-600 text-xs font-semibold text-center">{error}</Text>
          </View>
        ) : null}

        {/* ---------------- DASHBOARD TAB ---------------- */}
        {activeView === "dashboard" && (
          <View className="gap-5">
            {/* Dark Mode Style Hero Card for Officer */}
            <View className="bg-slate-900 rounded-[28px] p-6 shadow-xl shadow-slate-900/10">
              <View className="flex-row justify-between items-start mb-4">
                <View>
                  <Text style={{ color: roleAccent }} className="text-[10px] font-black uppercase tracking-widest mb-1">
                    Welcome Back
                  </Text>
                  <Text className="text-white text-2xl font-black">{officerName}</Text>
                </View>
                <View className={`px-3 py-1.5 rounded-full ${onDuty ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                  <Text className={`text-xs font-bold ${onDuty ? 'text-emerald-400' : 'text-red-400'}`}>
                    {onDuty ? "• ON DUTY" : "• OFF DUTY"}
                  </Text>
                </View>
              </View>

              <View className="flex-row gap-4 bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
                <View className="flex-1">
                  <Text className="text-slate-400 text-[10px] font-bold uppercase mb-1">Role</Text>
                  <Text className="text-white text-sm font-semibold">{dutyUnit}</Text>
                </View>
                <View className="w-[1px] bg-slate-700" />
                <View className="flex-1">
                  <Text className="text-slate-400 text-[10px] font-bold uppercase mb-1">ID</Text>
                  <Text className="text-white text-sm font-semibold">{professionalId || "--"}</Text>
                </View>
              </View>
            </View>

            {/* Urgent Alerts - High Visibility Cards */}
            <View>
              <Text className="text-slate-900 text-lg font-black mb-3 ml-1">Urgent Alerts</Text>
              {urgentRequests.length > 0 ? (
                urgentRequests.map((item) => (
                  <View key={item.id} className="bg-red-50 border-2 border-red-100 rounded-3xl p-5 mb-3 shadow-sm">
                    <View className="flex-row justify-between items-center mb-2">
                      <Text className="text-red-800 text-[10px] font-black uppercase tracking-widest px-2 py-1 bg-red-200/50 rounded-md">
                        {item.status}
                      </Text>
                      <Text className="text-red-500 text-xs font-bold">{item.priority}</Text>
                    </View>
                    <Text className="text-red-950 text-base font-black">{item.itemType}</Text>
                    <Text className="text-red-800/80 text-sm font-medium mt-1">
                      {item.passengerName} • {item.route}
                    </Text>
                  </View>
                ))
              ) : (
                <View className="bg-slate-200/50 rounded-3xl p-6 items-center border border-slate-200 border-dashed">
                  <Ionicons name="checkmark-circle" size={32} color="#94A3B8" />
                  <Text className="text-slate-500 font-bold mt-2">No Urgent Requests</Text>
                  <Text className="text-slate-400 text-xs text-center mt-1">You're all caught up!</Text>
                </View>
              )}
            </View>

            {/* Escalation Queue */}
            <View className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200">
              <Text className="text-slate-900 text-lg font-black mb-4">Escalation Queue</Text>
              {escalationQueue.length > 0 ? (
                escalationQueue.map((item, index) => (
                  <View key={item.id} className={`flex-row justify-between items-center py-3 ${index !== escalationQueue.length - 1 ? 'border-b border-slate-100' : ''}`}>
                    <View className="flex-1 pr-4">
                      <Text className="text-slate-900 text-sm font-black">{item.itemType}</Text>
                      <Text className="text-slate-500 text-xs mt-0.5">{item.passengerName} • {item.route}</Text>
                    </View>
                    <View className="bg-slate-100 px-3 py-1.5 rounded-full">
                      <Text className="text-slate-600 text-[10px] font-bold uppercase">{item.priority}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text className="text-slate-400 text-sm font-medium text-center py-2">Queue is clear.</Text>
              )}
            </View>

            {/* Logout Restricted to Dashboard */}
            <Pressable
              className="bg-slate-200 mt-2 rounded-2xl py-4 items-center active:bg-slate-300 transition-colors"
              onPress={onLogout}
            >
              <Text className="text-slate-700 font-bold text-sm uppercase tracking-wider">Log Out</Text>
            </Pressable>
          </View>
        )}

        {/* ---------------- DUTY TAB ---------------- */}
        {activeView === "duty" && (
          <View className="gap-5">
            <DutyStatusCard
              onDuty={onDuty}
              syncing={dutySyncing}
            // ... pass other props
            />

            {/* Modern Live Tracking Card */}
            <View className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm gap-4">
              <View className="flex-row justify-between items-center">
                <Text className="text-slate-900 text-lg font-black">Live Tracking</Text>
                <View className="bg-emerald-50 px-2 py-1 rounded border border-emerald-100">
                  <Text className="text-emerald-600 text-[10px] font-black uppercase tracking-wider">
                    {locationMode}
                  </Text>
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

                {/* Visual Route Checkpoints */}
                <View className="flex-row items-start justify-between relative pt-2">
                  <View className="absolute top-3 left-0 right-0 h-[2px] bg-slate-800 z-0" />
                  {routeCheckpoints.slice(0, 4).map((checkpoint, index) => {
                    const active = liveLocation?.checkpoint ? liveLocation.checkpoint === checkpoint : index === 0;
                    return (
                      <View key={index} className="items-center z-10 w-16">
                        <View className={`w-4 h-4 rounded-full border-2 border-slate-900 mb-2 ${active ? 'bg-blue-400 shadow-md shadow-blue-400/50' : 'bg-slate-700'}`} />
                        <Text className={`text-[9px] text-center font-bold ${active ? 'text-white' : 'text-slate-500'}`} numberOfLines={2}>
                          {checkpoint}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ---------------- ALERTS TAB ---------------- */}
        {activeView === "alerts" && (
          <View className="gap-5">
            {/* Modern Square Metric Grid */}
            <View className="flex-row flex-wrap justify-between gap-y-3">
              {[
                { label: "Open Alerts", value: openComplaintCount, color: "text-blue-600", bg: "bg-blue-50/50" },
                { label: "High Priority", value: highPriorityAlerts.length, color: "text-red-600", bg: "bg-red-50/50" },
                { label: "Accepted", value: acceptedCount, color: "text-amber-600", bg: "bg-amber-50/50" },
                { label: "Resolved", value: resolvedTodayCount, color: "text-emerald-600", bg: "bg-emerald-50/50" },
              ].map((metric, idx) => (
                <View key={idx} className={`w-[48%] rounded-3xl p-5 border border-slate-200 shadow-sm ${metric.bg}`}>
                  <Text className="text-slate-500 text-[10px] font-black uppercase tracking-wider mb-2">
                    {metric.label}
                  </Text>
                  <Text className={`text-3xl font-black ${metric.color}`}>
                    {metric.value}
                  </Text>
                </View>
              ))}
            </View>

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

        {/* ---------------- DETAIL TAB ---------------- */}
        {activeView === "detail" && selectedComplaint && (
          <View className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <ComplaintDetailView complaint={selectedComplaint} onOpenReply={() => setActiveView("reply")} />
          </View>
        )}

        {/* ---------------- REPLY TAB ---------------- */}
        {activeView === "reply" && (
          <View className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200">
            <ReplyStatusUpdateForm
              complaint={selectedComplaint}
              sending={sendingReply}
              onSubmitReply={handleSubmitReply}
              onSubmitStatus={handleSubmitStatus}
            />
          </View>
        )}

        {/* ---------------- HISTORY TAB ---------------- */}
        {activeView === "history" && (
          <View className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <DutyHistoryScreen history={dutyHistory} />
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
};


export default OfficerDashboardScreen;
