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
    <SafeAreaView className="flex-1 bg-slate-200">
      <ScrollView contentContainerStyle={{ padding: 12, gap: 16 }} className="bg-slate-50">

        {/* Navigation Bar */}
        <View
          className="flex-row flex-wrap bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
          style={{ borderBottomWidth: 3, borderBottomColor: roleAccent }}
        >
          {NAV_ITEMS.map((item) => {
            const selected = activeView === item.key;
            return (
              <Pressable
                key={item.key}
                className={`flex-1 min-w-[30%] px-2 py-3 items-center justify-center border-b-2 ${selected ? "border-slate-800 bg-slate-50" : "border-transparent"
                  }`}
                onPress={() => setActiveView(item.key)}
              >
                <Text
                  className={`text-xs ${selected ? "text-slate-900 font-extrabold" : "text-slate-500 font-semibold"}`}
                  style={selected ? { color: roleAccent } : {}}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {error ? <Text className="text-red-600 text-sm font-semibold text-center my-2">{error}</Text> : null}

        {/* ---------------- DUTY TAB ---------------- */}
        {activeView === "duty" && (
          <View className="flex-col gap-4">
            <View className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
              <Text style={{ color: roleAccent }} className="text-xs font-extrabold tracking-widest uppercase">
                Officer Side
              </Text>
              <Text className="text-slate-900 text-2xl font-black mt-1 tracking-tight">
                {roleLabel || `${dutyUnit} Dashboard`}
              </Text>
              <Text className="text-slate-500 text-sm font-medium mt-1">
                {officerName}
              </Text>

              <View className="flex-row flex-wrap gap-2 mt-4">
                <View className={`px-3 py-1.5 rounded-full border ${onDuty ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                  <Text className={`text-xs font-bold tracking-wide ${onDuty ? 'text-emerald-700' : 'text-red-700'}`}>
                    {onDuty ? "ON DUTY" : "OFF DUTY"}
                  </Text>
                </View>
                <View className="px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200">
                  <Text className="text-slate-600 text-xs font-semibold">
                    {dutyAttendance?.assignedTrain || dutyTrain || "Train pending"}
                  </Text>
                </View>
              </View>
            </View>

            <DutyStatusCard
              onDuty={onDuty}
              syncing={dutySyncing}
            // ... props
            />

            <View className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm gap-2 mt-2">
              <View className="flex-row justify-between items-center mb-1">
                <Text className="text-slate-900 text-lg font-extrabold">Live tracking</Text>
                <Text className="bg-slate-100 text-slate-800 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider">
                  {locationMode}
                </Text>
              </View>
              <Text className="text-emerald-600 text-sm font-semibold mb-2">{locationStatus}</Text>
              <Text className="text-slate-500 text-xs">Route: {routeContext.routeValue || dutyRoute || "Pending"}</Text>
              <Text className="text-slate-500 text-xs">Train: {routeContext.trainValue || dutyTrain || "Pending"}</Text>

              <View className="mt-3 rounded-xl bg-slate-900 border border-slate-700 p-3 shadow-md gap-2">
                <Text className="text-slate-50 font-bold text-sm">Live map placeholder</Text>
                <Text className="text-blue-300 text-xs">{buildLiveMapLabel(liveLocation)}</Text>
                <View className="flex-row items-start gap-2 mt-2">
                  {routeCheckpoints.slice(0, 5).map((checkpoint, index) => {
                    const active = liveLocation?.checkpoint ? liveLocation.checkpoint === checkpoint : index === 0;
                    return (
                      <View key={`${checkpoint}-${index}`} className="flex-1 items-center gap-1">
                        <View className={`w-3 h-3 rounded-full ${active ? 'bg-emerald-500 shadow-emerald-500/50 shadow-lg' : 'bg-slate-600'}`} />
                        <Text className={`text-[9px] text-center ${active ? 'text-slate-200 font-bold' : 'text-slate-400'}`} numberOfLines={1}>
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
          <View className="flex-col gap-4">
            {/* Metrics restricted to Alerts Tab */}
            <View className="flex-row flex-wrap justify-between gap-y-3">
              <View className="w-[48%] bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                <Text className="text-slate-500 text-[10px] font-extrabold uppercase tracking-wide">Open Complaints</Text>
                <Text style={{ color: roleAccent }} className="text-2xl font-black mt-1">{openComplaintCount}</Text>
              </View>
              <View className="w-[48%] bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                <Text className="text-slate-500 text-[10px] font-extrabold uppercase tracking-wide">High Priority</Text>
                <Text className="text-slate-900 text-2xl font-black mt-1">{highPriorityAlerts.length}</Text>
              </View>
              <View className="w-[48%] bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                <Text className="text-slate-500 text-[10px] font-extrabold uppercase tracking-wide">Accepted</Text>
                <Text className="text-slate-900 text-2xl font-black mt-1">{acceptedCount}</Text>
              </View>
              <View className="w-[48%] bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                <Text className="text-slate-500 text-[10px] font-extrabold uppercase tracking-wide">Resolved Today</Text>
                <Text className="text-slate-900 text-2xl font-black mt-1">{resolvedTodayCount}</Text>
              </View>
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

        {/* ---------------- DASHBOARD TAB ---------------- */}
        {activeView === "dashboard" && (
          <View className="flex-col gap-4">
            {/* Profile Summary */}
            <View className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
              <Text className="text-slate-900 text-lg font-bold mb-3">Officer Profile</Text>
              <View className="border-t border-slate-100 pt-3 gap-y-2">
                <View className="flex-row justify-between"><Text className="text-slate-500 text-xs font-bold uppercase">Name</Text><Text className="text-slate-800 text-sm font-semibold">{officerName}</Text></View>
                <View className="flex-row justify-between"><Text className="text-slate-500 text-xs font-bold uppercase">Email</Text><Text className="text-slate-800 text-sm font-semibold">{officerEmail || "--"}</Text></View>
                <View className="flex-row justify-between"><Text className="text-slate-500 text-xs font-bold uppercase">ID</Text><Text className="text-slate-800 text-sm font-semibold">{professionalId || "--"}</Text></View>
                <View className="flex-row justify-between"><Text className="text-slate-500 text-xs font-bold uppercase">Role</Text><Text className="text-slate-800 text-sm font-semibold">{dutyUnit}</Text></View>
              </View>
            </View>

            {/* Urgent Requests */}
            <View className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
              <Text className="text-slate-900 text-lg font-bold">Urgent Alerts</Text>
              <Text className="text-slate-500 text-xs mb-3">Require immediate acceptance.</Text>
              {urgentRequests.length > 0 ? (
                urgentRequests.map((item) => (
                  <View key={item.id} className="bg-orange-50 border border-orange-200 rounded-xl p-3 mb-2">
                    <Text className="text-orange-700 text-[10px] font-black uppercase mb-1">{item.status}</Text>
                    <Text className="text-orange-900 text-sm font-bold">{item.itemType}</Text>
                    <Text className="text-orange-800 text-xs mt-1">{item.passengerName} · {item.route}</Text>
                  </View>
                ))
              ) : (
                <View className="bg-blue-50 border border-blue-100 rounded-xl p-4 items-center mt-2">
                  <Text className="text-blue-700 font-bold text-sm">No Urgent Requests</Text>
                  <Text className="text-blue-600/70 text-xs text-center mt-1">High priority complaints will appear here.</Text>
                </View>
              )}
            </View>

            {/* Escalation Queue */}
            <View className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
              <Text className="text-slate-900 text-lg font-bold mb-3">Escalation Queue</Text>
              {escalationQueue.length > 0 ? (
                escalationQueue.map((item) => (
                  <View key={item.id} className="flex-row justify-between items-center py-2 border-b border-slate-100 last:border-0">
                    <View className="flex-1">
                      <Text className="text-slate-900 text-sm font-bold">{item.itemType}</Text>
                      <Text className="text-slate-500 text-xs">{item.passengerName} · {item.route}</Text>
                    </View>
                    <View className="bg-red-50 border border-red-200 px-2 py-1 rounded-full ml-2">
                      <Text className="text-red-700 text-[10px] font-bold">{item.priority}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text className="text-slate-500 text-sm italic">Queue is clear.</Text>
              )}
            </View>

            {/* Logout Restricted to Dashboard */}
            <Pressable
              className="bg-slate-900 mt-4 rounded-xl py-4 items-center shadow-md active:bg-slate-800"
              onPress={onLogout}
            >
              <Text className="text-white font-bold text-sm uppercase tracking-wider">Logout</Text>
            </Pressable>
          </View>
        )}

        {/* ---------------- DETAIL TAB ---------------- */}
        {activeView === "detail" && selectedComplaint && (
          <View className="mt-2">
            <ComplaintDetailView complaint={selectedComplaint} onOpenReply={() => setActiveView("reply")} />
          </View>
        )}

        {/* ---------------- REPLY TAB ---------------- */}
        {activeView === "reply" && (
          <View className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm mt-2">
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
          <DutyHistoryScreen history={dutyHistory} />
        )}

      </ScrollView>
    </SafeAreaView>
  );
}



export default OfficerDashboardScreen;
