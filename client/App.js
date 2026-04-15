import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Ionicons } from "@expo/vector-icons";
import { getApiBase } from "./apiConfig";
import {
  Animated,
  BackHandler,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import {
  SafeAreaView,
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import PassengerDashboard from "./PassengerDashboard";
import CarAutoDashboard from "./CarAutoDashboard";
import DriverConductorDashboard from "./DriverConductorDashboard";
import PasswordVerification from "./PasswordVerification";
import OfficerDashboardScreen from "./src/screens/officer/OfficerDashboardScreen";

const ROLES = ["Passenger", "Driver/Conductor", "Cab/Auto", "TTR/RPF/Police"];
const OFFICIAL_DOMAINS = {
  "TTR/RPF/Police": ["railnet.gov.in", "tnpolice.gov.in"],
};
const OFFICER_ROLE_THEMES = {
  TTR: { accent: "#F59E0B", glow: "#F59E0B" },
  TTE: { accent: "#22C55E", glow: "#22C55E" },
  RPF: { accent: "#3B82F6", glow: "#3B82F6" },
  Police: { accent: "#E11D48", glow: "#E11D48" },
};
const inferSpecificRoleFromProfessionalId = (idValue) => {
  const normalized = (idValue || "").trim().toUpperCase();
  if (normalized.startsWith("TNPOLICE-")) {
    return "Police";
  }
  if (normalized.startsWith("TTR-")) {
    return "TTR";
  }
  if (normalized.startsWith("TTE-")) {
    return "TTE";
  }
  if (normalized.startsWith("RPF-")) {
    return "RPF";
  }
  return "";
};
const API_BASE = getApiBase();

const sendCode = (emailAddress, purpose = "register") =>
  axios.post(`${API_BASE}/auth/send-verify-code`, {
    email: emailAddress,
    purpose,
  });

const verifyCode = (emailAddress, code) =>
  axios.post(`${API_BASE}/auth/verify-code`, {
    email: emailAddress,
    code,
  });

const requiredLabel = (text) => `${text} *`;
const MERIDIEM_OPTIONS = ["AM", "PM"];
const PASSWORD_MIN_LENGTH = 6;
const getPasswordChecks = (value) => {
  const input = value || "";

  return {
    length: input.length === PASSWORD_MIN_LENGTH,
    uppercase: /[A-Z]/.test(input),
    number: /\d/.test(input),
    special: /[^A-Za-z0-9]/.test(input),
  };
};
const formatClockTime = (timeValue, meridiem) => {
  const trimmedTime = (timeValue || "").trim();
  const trimmedMeridiem = (meridiem || "").trim().toUpperCase();

  if (!trimmedTime) {
    return "";
  }

  return trimmedMeridiem ? `${trimmedTime} ${trimmedMeridiem}` : trimmedTime;
};

// Animated Label Component - must be outside to properly use hooks
const AnimatedLabel = ({ text, iconName }) => {
  const iconPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(iconPulse, {
          toValue: 1.2,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(iconPulse, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [iconPulse]);

  return (
    <View style={styles.labelWithIcon}>
      <Animated.View style={{ transform: [{ scale: iconPulse }] }}>
        <Ionicons name={iconName} size={16} color="#2563EB" />
      </Animated.View>
      <Text style={styles.label}>{text}</Text>
    </View>
  );
};

const MeridiemSelector = ({ value, onChange }) => (
  <View style={styles.timePeriodRow}>
    {MERIDIEM_OPTIONS.map((option) => {
      const selected = value === option;

      return (
        <TouchableOpacity
          key={option}
          style={[
            styles.timePeriodOption,
            selected && styles.timePeriodOptionActive,
          ]}
          onPress={() => onChange(option)}
          activeOpacity={0.8}
        >
          <Ionicons
            name={selected ? "checkbox" : "square-outline"}
            size={18}
            color={selected ? "#2563EB" : "#64748B"}
          />
          <Text
            style={[
              styles.timePeriodText,
              selected && styles.timePeriodTextActive,
            ]}
          >
            {option}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

const EmptyOpsDashboard = ({
  roleLabel,
  roleKey,
  officerEmail,
  professionalId,
  staffName,
  specificRole,
  onDuty,
  setOnDuty,
  onLogout,
}) => {
  const pulse = useRef(new Animated.Value(0)).current;
  const [alerts, setAlerts] = useState([]);
  const [selectedAlertId, setSelectedAlertId] = useState("");
  const [replyDraft, setReplyDraft] = useState("");
  const [alertError, setAlertError] = useState("");
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(false);
  const [dutySyncing, setDutySyncing] = useState(false);
  const [roster, setRoster] = useState([]);
  const [dutyAttendance, setDutyAttendance] = useState(null);
  const [dutyTrain, setDutyTrain] = useState("");
  const [dutyRoute, setDutyRoute] = useState("");
  const [dutyStation, setDutyStation] = useState("");
  const [dutyShift, setDutyShift] = useState("");
  const [prototypeType, setPrototypeType] = useState("alerts");
  const [prototypePayload, setPrototypePayload] = useState("");
  const [prototypeInfo, setPrototypeInfo] = useState("");
  const [prototypeSummary, setPrototypeSummary] = useState(null);
  const [officerNotes, setOfficerNotes] = useState("");
  const [coachRemark, setCoachRemark] = useState("");
  const [stationRemark, setStationRemark] = useState("");

  const dutyUnit = useMemo(
    () => roleKey || specificRole || inferSpecificRoleFromProfessionalId(professionalId) || "TTR",
    [professionalId, roleKey, specificRole],
  );
  const roleTheme = OFFICER_ROLE_THEMES[dutyUnit] || OFFICER_ROLE_THEMES.TTR;
  const officerLabel = staffName || officerEmail || professionalId || `${dutyUnit} officer`;

  const demoAlerts = useMemo(
    () => [
      {
        id: "DEMO-OPS-2041",
        status: "Item Being Checked",
        passengerName: "Meera S.",
        itemType: "Black backpack",
        description: "Phone, wallet, and travel documents still inside the train",
        vehicleNumber: "2241 City Express",
        route: "Chennai Central -> Tambaram",
        fromLocation: "Egmore",
        toLocation: "Tambaram",
        nextStation: "Tambaram",
        priority: "High",
        staffEta: "6 mins",
        staffResponseStatus: "Awaiting duty reply",
        messages: [],
        assignedStaff: [],
        summary: "Passenger got down briefly at Egmore. Belongings remain on the seat.",
      },
      {
        id: "DEMO-OPS-2042",
        status: "Passenger Contacted",
        passengerName: "Arun K.",
        itemType: "Silver phone",
        description: "Charger pouch and seat tag recovered by duty staff",
        vehicleNumber: "1187 Mail Fast",
        route: "Villupuram -> Chennai Egmore",
        fromLocation: "Tambaram",
        toLocation: "Perambur",
        nextStation: "Perambur",
        priority: "High",
        staffEta: "8 mins",
        staffResponseStatus: "Passenger contacted for identity confirmation",
        messages: [],
        assignedStaff: [],
        summary: "Passenger stepped out for water and missed the boarding call.",
      },
      {
        id: "DEMO-OPS-2043",
        status: "Item Found",
        passengerName: "Lakshmi P.",
        itemType: "Travel wallet",
        description: "ID card and cash located under the berth",
        vehicleNumber: "5608 Passenger Special",
        route: "Tirupati -> Chennai Beach",
        fromLocation: "A1",
        toLocation: "Melmaruvathur",
        nextStation: "Melmaruvathur",
        priority: "Critical",
        staffEta: "4 mins",
        staffResponseStatus: "Passenger alerted",
        messages: [],
        assignedStaff: [],
        summary: "Wallet sighted during halt and secured for identity check.",
      },
    ],
    [],
  );

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const mapAlert = useMemo(
    () => (alert) => {
      const latestMessage = Array.isArray(alert.messages) && alert.messages.length > 0 ? alert.messages[alert.messages.length - 1] : null;

      return {
        id: alert._id || alert.id,
        status: alert.status || "Reported",
        passengerName: alert.passengerName || "Passenger",
        itemType: alert.itemType || alert.item || "Belongings",
        description: alert.description || alert.summary || "Lost-item complaint",
        vehicleNumber: alert.vehicleNumber || "Train",
        route: alert.route || `${alert.fromLocation || "Origin"} -> ${alert.toLocation || "Destination"}`,
        fromLocation: alert.fromLocation || "",
        toLocation: alert.toLocation || "",
        nextStation: alert.recoveryStation || alert.meetingPoint || alert.toLocation || "Next station",
        priority: alert.priority || "Normal",
        staffEta: alert.staffEta || "8 mins",
        staffResponseStatus: alert.staffResponseStatus || alert.alertPriorityReason || "Awaiting duty reply",
        summary: alert.alertPriorityReason || alert.description || "Passenger reported a lost item on the train.",
        replyDraft:
          latestMessage?.text ||
          `Acknowledged. ${alert.passengerName || "Passenger"}, our duty officer is reviewing the case and coordinating recovery.`,
        messages: alert.messages || [],
        assignedStaff: alert.assignedStaff || [],
        handoverState: alert.meetingScheduled
          ? `Handover planned at ${alert.meetingPoint || alert.recoveryStation || alert.toLocation || "the next station"}`
          : alert.staffResponseStatus || "Awaiting recovery coordination",
        lastAction: latestMessage ? latestMessage.text : "No staff reply yet",
        officerNotes: alert.officerNotes || "",
        coachRemark: alert.coachRemark || "",
        stationRemark: alert.stationRemark || "",
      };
    },
    [],
  );

  const displayAlerts = useMemo(() => {
    if (onDuty) {
      return alerts.length > 0 ? alerts : demoAlerts;
    }

    return [];
  }, [alerts, demoAlerts, onDuty]);

  const selectedAlert = useMemo(
    () => displayAlerts.find((item) => item.id === selectedAlertId) || displayAlerts[0] || null,
    [displayAlerts, selectedAlertId],
  );

  useEffect(() => {
    if (selectedAlert) {
      setReplyDraft(selectedAlert.replyDraft || "");
      setOfficerNotes(selectedAlert.officerNotes || "");
      setCoachRemark(selectedAlert.coachRemark || "");
      setStationRemark(selectedAlert.stationRemark || "");
    }
  }, [selectedAlert]);

  useEffect(() => {
    const loadRoster = async () => {
      try {
        const response = await axios.get(`${API_BASE}/auth/duty/roster`);
        setRoster(Array.isArray(response.data?.officers) ? response.data.officers : []);
      } catch (error) {
        console.log("Duty roster load failed:", error.message);
      }
    };

    loadRoster();
  }, []);

  const loadPrototypeSummary = async () => {
    try {
      const response = await axios.get(`${API_BASE}/passenger/prototype-data/summary`);
      setPrototypeSummary(response.data?.summary || null);
    } catch (error) {
      console.log("Prototype summary load failed:", error.message);
    }
  };

  useEffect(() => {
    loadPrototypeSummary();
  }, []);

  const loadDutyStatus = async () => {
    try {
      const response = await axios.get(`${API_BASE}/auth/duty/status`, {
        params: {
          email: officerEmail || undefined,
          professionalId: professionalId || undefined,
        },
        headers: {
          "X-User-Email": officerEmail || "",
          "X-Professional-Id": professionalId || "",
        },
      });

      if (setOnDuty) {
        setOnDuty(Boolean(response.data?.onDuty));
      }

      const attendance = response.data?.attendance || null;
      setDutyAttendance(attendance);

      if (attendance) {
        setDutyTrain(attendance.assignedTrain || "");
        setDutyRoute(attendance.assignedRoute || "");
        setDutyStation(attendance.assignedStation || "");
        setDutyShift(attendance.assignedShift || "");
      }
    } catch (error) {
      console.log("Duty status load failed:", error.message);
    }
  };

  useEffect(() => {
    loadDutyStatus();
  }, [officerEmail, professionalId, dutyUnit]);

  const fetchAlerts = async () => {
    if (!onDuty) {
      setAlerts([]);
      setSelectedAlertId("");
      return;
    }

    setIsLoadingAlerts(true);
    setAlertError("");

    try {
      const response = await axios.get(`${API_BASE}/passenger/live-alerts`, {
        params: { staffRole: dutyUnit },
        headers: {
          "X-User-Email": officerEmail || "",
          "X-Professional-Id": professionalId || "",
          "X-User-Name": staffName || officerLabel,
          "X-Duty-Unit": dutyUnit,
          "X-On-Duty": String(onDuty),
        },
      });

      const incomingAlerts = Array.isArray(response.data?.alerts) ? response.data.alerts.map(mapAlert) : [];
      setAlerts(incomingAlerts);

      if (incomingAlerts.length > 0) {
        setSelectedAlertId((currentSelected) => currentSelected || incomingAlerts[0].id);
      } else {
        setSelectedAlertId("");
      }
    } catch (error) {
      setAlertError(error?.response?.data?.message || error.message || "Unable to load alerts");
      setAlerts([]);
    } finally {
      setIsLoadingAlerts(false);
    }
  };

  useEffect(() => {
    fetchAlerts();

    const timer = setInterval(() => {
      fetchAlerts();
    }, 8000);

    return () => clearInterval(timer);
  }, [dutyUnit, officerEmail, professionalId, staffName, onDuty]);

  const statusSummary = useMemo(() => {
    const source = onDuty ? displayAlerts : [];
    const closedStatuses = ["Closed"];
    const securedStatuses = ["Item Found", "Ready for Handover", "Closed"];
    const handoverStatuses = ["Ready for Handover"];

    return {
      openCount: source.filter((item) => !closedStatuses.includes(item.status)).length,
      securedCount: source.filter((item) => securedStatuses.includes(item.status)).length,
      handoverCount: source.filter((item) => handoverStatuses.includes(item.status)).length,
      priorityCount: source.filter((item) => item.priority === "High" || item.priority === "Critical").length,
    };
  }, [displayAlerts, onDuty]);

  const selectedRosterOfficer = useMemo(() => {
    return (
      roster.find((item) => item.dutyUnit === dutyUnit && item.onDutyStatus) ||
      roster.find((item) => item.dutyUnit === dutyUnit) ||
      roster.find((item) => item.onDutyStatus) ||
      roster[0] ||
      null
    );
  }, [dutyUnit, roster]);

  const recentResponses = useMemo(() => {
    return displayAlerts
      .flatMap((alert) => (Array.isArray(alert.messages) ? alert.messages : []).map((message) => ({
        alertId: alert.id,
        passengerName: alert.passengerName,
        text: message.text,
        staffName: message.staffName,
        timestamp: message.timestamp,
      })))
      .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
      .slice(0, 4);
  }, [displayAlerts]);

  const syncDutyStatus = async (nextOnDuty) => {
    setDutySyncing(true);
    try {
      const endpoint = nextOnDuty ? "/auth/duty/check-in" : "/auth/duty/check-out";
      const response = await axios.post(
        `${API_BASE}${endpoint}`,
        {
          email: officerEmail || undefined,
          professionalId: professionalId || undefined,
          dutyUnit,
          assignedTrain: dutyTrain || selectedAlert?.vehicleNumber || null,
          assignedRoute: dutyRoute || selectedAlert?.route || null,
          assignedStation:
            dutyStation ||
            selectedRosterOfficer?.dutyStation ||
            selectedAlert?.nextStation ||
            `${dutyUnit} duty desk`,
          assignedShift: dutyShift || null,
          dutyStation: dutyStation || selectedRosterOfficer?.dutyStation || `${dutyUnit} duty desk`,
          dutyDesk: selectedRosterOfficer?.dutyDesk || "Duty desk",
          dutyNote: nextOnDuty ? "Checked in from SafeRide Guardian" : "Checked out from SafeRide Guardian",
        },
        {
          headers: {
            "X-User-Email": officerEmail || "",
            "X-Professional-Id": professionalId || "",
            "X-User-Name": staffName || officerLabel,
            "X-Duty-Unit": dutyUnit,
          },
        },
      );

      if (setOnDuty) {
        setOnDuty(nextOnDuty);
      }

      setDutyAttendance(response.data?.attendance || null);

      if (!nextOnDuty) {
        setAlerts([]);
        setSelectedAlertId("");
      } else {
        fetchAlerts();
      }

      loadDutyStatus();
    } catch (error) {
      setAlertError(error?.response?.data?.message || error.message || "Unable to update duty status");
    } finally {
      setDutySyncing(false);
    }
  };

  const submitPrototypeRecord = async () => {
    if (!prototypePayload.trim()) {
      setPrototypeInfo("Enter JSON payload to add prototype data.");
      return;
    }

    let parsedPayload;
    try {
      parsedPayload = JSON.parse(prototypePayload);
    } catch (error) {
      setPrototypeInfo("Invalid JSON. Please provide a valid payload.");
      return;
    }

    try {
      const response = await axios.post(
        `${API_BASE}/passenger/prototype-data/${prototypeType}`,
        parsedPayload,
      );
      setPrototypeInfo(response.data?.message || "Prototype record saved.");
      setPrototypePayload("");
      setPrototypeSummary(response.data?.summary || null);
      fetchAlerts();
      loadPrototypeSummary();
    } catch (error) {
      setPrototypeInfo(error?.response?.data?.message || error.message || "Unable to save prototype record.");
    }
  };

  const updateSelectedAlert = async (path, payload) => {
    if (!selectedAlert) {
      return;
    }

    try {
      await axios({
        method: path === "/respond" ? "post" : "patch",
        url: `${API_BASE}/passenger/complaints/${selectedAlert.id}/staff${path}`,
        data: payload,
        headers: {
          "X-User-Email": officerEmail || "",
          "X-Professional-Id": professionalId || "",
          "X-User-Name": staffName || officerLabel,
          "X-Duty-Unit": dutyUnit,
          "X-On-Duty": String(onDuty),
        },
      });

      await fetchAlerts();
    } catch (error) {
      setAlertError(error?.response?.data?.message || error.message || "Unable to update complaint");
    }
  };

  const sendReply = async () => {
    const trimmedReply = replyDraft.trim();
    if (!trimmedReply || !selectedAlert || String(selectedAlert.id).startsWith("DEMO-")) {
      return;
    }

    await updateSelectedAlert("/respond", {
      text: trimmedReply,
      staffEta: selectedAlert.staffEta || "8 mins",
      notes: officerNotes.trim(),
      coachRemark: coachRemark.trim(),
      stationRemark: stationRemark.trim(),
      markPassengerContacted: selectedAlert.status !== "Passenger Contacted",
    });
  };

  const markAcknowledgement = async (action) => {
    if (!selectedAlert || String(selectedAlert.id).startsWith("DEMO-")) {
      return;
    }

    await updateSelectedAlert("/acknowledge", {
      action,
      notes: officerNotes.trim(),
      coachRemark: coachRemark.trim(),
      stationRemark: stationRemark.trim(),
    });
  };

  const applyStatus = async (nextStatus) => {
    if (!selectedAlert || String(selectedAlert.id).startsWith("DEMO-")) {
      return;
    }

    await updateSelectedAlert("/status", {
      status: nextStatus,
      itemFound: nextStatus === "Item Found" || selectedAlert.status === "Item Found",
      meetingScheduled: nextStatus === "Ready for Handover" || selectedAlert.status === "Ready for Handover",
      meetingPoint: selectedAlert.nextStation || selectedAlert.toLocation || "Next station",
      meetingTime: selectedAlert.staffEta || "Next available halt",
      recoveryStation: selectedAlert.nextStation || selectedAlert.toLocation || "Next station",
      recoveryNotes: `Updated by ${officerLabel}`,
      staffResponseStatus: `Status updated to ${nextStatus}`,
      staffEta: selectedAlert.staffEta || "8 mins",
      notes: officerNotes.trim(),
      coachRemark: coachRemark.trim(),
      stationRemark: stationRemark.trim(),
    });
  };

  const coordinateHandover = async () => {
    if (!selectedAlert || String(selectedAlert.id).startsWith("DEMO-")) {
      return;
    }

    await updateSelectedAlert("/handover", {
      handoverStation: selectedAlert.nextStation || selectedAlert.toLocation || "Next station",
      handoverTime: selectedAlert.staffEta || "Next halt",
      recoveryNotes: `Handover coordinated by ${officerLabel}`,
      notes: officerNotes.trim(),
      coachRemark: coachRemark.trim(),
      stationRemark: stationRemark.trim(),
    });
  };

  return (
    <SafeAreaView style={styles.opsShell}>
      <ScrollView contentContainerStyle={styles.opsContent}>
        <View style={styles.opsHero}>
          <Animated.View
            style={[
              styles.opsPulse,
              { backgroundColor: roleTheme.accent, shadowColor: roleTheme.glow },
              {
                transform: [
                  {
                    scale: pulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.14],
                    }),
                  },
                ],
              },
            ]}
          />
          <Text style={[styles.opsKicker, { color: roleTheme.accent }]}>Priority duty board</Text>
          <Text style={[styles.opsTitle, { color: roleTheme.accent }]}>{roleLabel}</Text>
          <Text style={styles.opsSubtitle}>
            Live lost-item complaints for on-duty railway protection staff.
          </Text>
          <View style={styles.opsHeroTag}>
            <Text style={[styles.opsHeroTagText, { color: roleTheme.accent }]}>{officerLabel}</Text>
          </View>
          <Pressable
            style={[
              styles.opsDutyToggle,
              onDuty ? styles.opsDutyOn : styles.opsDutyOff,
              onDuty && { backgroundColor: roleTheme.accent, borderColor: roleTheme.accent },
            ]}
            onPress={() => syncDutyStatus(!onDuty)}
            disabled={dutySyncing}
          >
            <Text style={styles.opsDutyToggleText}>
              Duty {onDuty ? "ON" : "OFF"}{dutySyncing ? " ..." : ""}
            </Text>
          </Pressable>
          <View style={styles.opsDutyActionRow}>
            <Pressable
              style={[styles.opsDutyActionButton, { borderColor: roleTheme.accent }]}
              onPress={() => syncDutyStatus(true)}
              disabled={dutySyncing || onDuty}
            >
              <Text style={styles.opsDutyActionText}>Check-In</Text>
            </Pressable>
            <Pressable
              style={[styles.opsDutyActionButton, styles.opsDutyActionDanger]}
              onPress={() => syncDutyStatus(false)}
              disabled={dutySyncing || !onDuty}
            >
              <Text style={styles.opsDutyActionText}>Check-Out</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.opsDetailCard}>
          <View style={styles.opsSectionHeader}>
            <Text style={styles.opsSectionTitle}>Duty attendance</Text>
            <Text style={styles.opsSectionSubtitle}>One active duty session per officer.</Text>
          </View>
          <View style={styles.opsDetailGrid}>
            <View style={styles.opsDetailBlock}>
              <Text style={styles.opsDetailLabel}>Assigned train</Text>
              <TextInput
                style={styles.opsFieldInput}
                value={dutyTrain}
                onChangeText={setDutyTrain}
                placeholder="2241 City Express"
                placeholderTextColor="#64748B"
              />
            </View>
            <View style={styles.opsDetailBlock}>
              <Text style={styles.opsDetailLabel}>Assigned route</Text>
              <TextInput
                style={styles.opsFieldInput}
                value={dutyRoute}
                onChangeText={setDutyRoute}
                placeholder="Chennai Central -> Tambaram"
                placeholderTextColor="#64748B"
              />
            </View>
            <View style={styles.opsDetailBlock}>
              <Text style={styles.opsDetailLabel}>Assigned station</Text>
              <TextInput
                style={styles.opsFieldInput}
                value={dutyStation}
                onChangeText={setDutyStation}
                placeholder="Tambaram"
                placeholderTextColor="#64748B"
              />
            </View>
            <View style={styles.opsDetailBlock}>
              <Text style={styles.opsDetailLabel}>Assigned shift</Text>
              <TextInput
                style={styles.opsFieldInput}
                value={dutyShift}
                onChangeText={setDutyShift}
                placeholder="06:00 - 14:00"
                placeholderTextColor="#64748B"
              />
            </View>
          </View>
          <View style={styles.opsInfoPanel}>
            <Text style={styles.opsInfoHint}>
              Session status: {dutyAttendance?.status || (onDuty ? "ACTIVE" : "INACTIVE")}
            </Text>
            <Text style={styles.opsInfoHint}>
              Check-In: {dutyAttendance?.checkInTime ? new Date(dutyAttendance.checkInTime).toLocaleString() : "Not checked in"}
            </Text>
            <Text style={styles.opsInfoHint}>
              Check-Out: {dutyAttendance?.checkOutTime ? new Date(dutyAttendance.checkOutTime).toLocaleString() : "Not checked out"}
            </Text>
          </View>
        </View>

        <View style={styles.opsDetailGrid}>
          <View style={styles.opsDetailBlock}>
            <Text style={styles.opsDetailLabel}>Officer profile</Text>
            <Text style={styles.opsDetailValue}>{officerLabel}</Text>
            <Text style={styles.opsInfoHint}>Unit: {dutyUnit}</Text>
            <Text style={styles.opsInfoHint}>Email: {officerEmail || "demo.officer@railnet.gov.in"}</Text>
          </View>
          <View style={styles.opsDetailBlock}>
            <Text style={styles.opsDetailLabel}>Current assignment</Text>
            <Text style={styles.opsDetailValue}>{selectedRosterOfficer?.dutyStation || "Chennai Central"}</Text>
            <Text style={styles.opsInfoHint}>Desk: {selectedRosterOfficer?.dutyDesk || "Passenger recovery desk"}</Text>
            <Text style={styles.opsInfoHint}>Badge: {onDuty ? "ON DUTY" : "OFF DUTY"}</Text>
          </View>
        </View>

        {alertError ? (
          <View style={styles.opsErrorBanner}>
            <Text style={styles.opsErrorText}>{alertError}</Text>
          </View>
        ) : null}

        <View style={styles.opsMetricRow}>
          <View style={styles.opsMetricCard}>
            <Text style={styles.opsMetricLabel}>Open cases</Text>
            <Text style={styles.opsMetricValue}>{statusSummary.openCount}</Text>
          </View>
          <View style={styles.opsMetricCard}>
            <Text style={styles.opsMetricLabel}>Priority alerts</Text>
            <Text style={styles.opsMetricValue}>{statusSummary.priorityCount}</Text>
          </View>
          <View style={styles.opsMetricCard}>
            <Text style={styles.opsMetricLabel}>Recovered / secured</Text>
            <Text style={styles.opsMetricValue}>{statusSummary.securedCount}</Text>
          </View>
        </View>

        <View style={styles.opsSection}>
          <View style={styles.opsSectionHeader}>
            <Text style={styles.opsSectionTitle}>Live complaint queue</Text>
            <Text style={styles.opsSectionSubtitle}>
              {onDuty ? "Priority complaints assigned to you only." : "Check in to receive priority alerts."}
            </Text>
          </View>

          {!onDuty ? (
            <View style={styles.opsEmptyState}>
              <Text style={styles.opsEmptyTitle}>Not on duty</Text>
              <Text style={styles.opsEmptyText}>
                Check in to receive live passenger complaints, replies, and handover actions.
              </Text>
            </View>
          ) : null}

          {displayAlerts.map((item) => {
            const isSelected = item.id === selectedAlertId || (!selectedAlertId && displayAlerts[0]?.id === item.id);

            return (
              <Pressable
                key={item.id}
                style={[styles.opsCaseCard, isSelected && styles.opsCaseCardActive]}
                onPress={() => setSelectedAlertId(item.id)}
              >
                <View style={styles.opsCaseTopRow}>
                  <View style={styles.opsCaseMetaGroup}>
                    <Text style={styles.opsCaseId}>{item.id}</Text>
                    <Text style={styles.opsCaseTitle}>{item.itemType}</Text>
                  </View>
                  <View
                    style={[
                      styles.opsStatusChip,
                      item.status === "Item Found" && styles.opsStatusFound,
                      item.status === "Item Being Checked" && styles.opsStatusReview,
                      (item.status === "Passenger Contacted" || item.status === "Acknowledged") && styles.opsStatusSecured,
                      item.status === "Ready for Handover" && styles.opsStatusHandover,
                    ]}
                  >
                    <Text style={styles.opsStatusText}>{item.status}</Text>
                  </View>
                </View>

                <Text style={styles.opsCaseSummary}>{item.summary}</Text>

                <View style={styles.opsCaseMetaRow}>
                  <Text style={styles.opsCaseMetaText}>{item.vehicleNumber}</Text>
                  <Text style={styles.opsCaseMetaText}>{item.route}</Text>
                  <Text style={styles.opsCaseMetaText}>Priority: {item.priority}</Text>
                </View>
              </Pressable>
            );
          })}

          {isLoadingAlerts ? (
            <Text style={styles.opsSectionSubtitle}>Refreshing complaint feed...</Text>
          ) : null}
        </View>

        {selectedAlert ? (
          <View style={styles.opsDetailCard}>
            <View style={styles.opsSectionHeader}>
              <Text style={styles.opsSectionTitle}>Case detail</Text>
              <Text style={styles.opsSectionSubtitle}>Assigned to the current on-duty officer.</Text>
            </View>

            <View style={styles.opsDetailGrid}>
              <View style={styles.opsDetailBlock}>
                <Text style={styles.opsDetailLabel}>Passenger</Text>
                <Text style={styles.opsDetailValue}>{selectedAlert.passengerName}</Text>
              </View>
              <View style={styles.opsDetailBlock}>
                <Text style={styles.opsDetailLabel}>Train / vehicle</Text>
                <Text style={styles.opsDetailValue}>{selectedAlert.vehicleNumber}</Text>
              </View>
              <View style={styles.opsDetailBlock}>
                <Text style={styles.opsDetailLabel}>Route</Text>
                <Text style={styles.opsDetailValue}>{selectedAlert.route}</Text>
              </View>
              <View style={styles.opsDetailBlock}>
                <Text style={styles.opsDetailLabel}>Next station</Text>
                <Text style={styles.opsDetailValue}>{selectedAlert.nextStation}</Text>
              </View>
            </View>

            <View style={styles.opsInfoPanel}>
              <Text style={styles.opsDetailLabel}>Issue details</Text>
              <Text style={styles.opsInfoValue}>{selectedAlert.itemType}</Text>
              <Text style={styles.opsInfoHint}>{selectedAlert.description}</Text>
              <Text style={styles.opsInfoHint}>Priority: {selectedAlert.priority}</Text>
              <Text style={styles.opsInfoHint}>{selectedAlert.handoverState}</Text>
              <Text style={styles.opsInfoHint}>Last action: {selectedAlert.lastAction}</Text>
            </View>

            <View style={styles.opsReplyBlock}>
              <Text style={styles.opsDetailLabel}>Officer updates</Text>
              <TextInput
                style={styles.opsFieldInput}
                value={officerNotes}
                onChangeText={setOfficerNotes}
                placeholder="Internal note for passenger timeline"
                placeholderTextColor="#6B7280"
              />
              <TextInput
                style={styles.opsFieldInput}
                value={coachRemark}
                onChangeText={setCoachRemark}
                placeholder="Coach or berth remark"
                placeholderTextColor="#6B7280"
              />
              <TextInput
                style={styles.opsFieldInput}
                value={stationRemark}
                onChangeText={setStationRemark}
                placeholder="Station remark"
                placeholderTextColor="#6B7280"
              />
            </View>

            <View style={styles.opsReplyBlock}>
              <Text style={styles.opsDetailLabel}>Reply to passenger</Text>
              <TextInput
                style={styles.opsReplyInput}
                value={replyDraft}
                onChangeText={setReplyDraft}
                placeholder="Write a duty reply to the passenger"
                placeholderTextColor="#6B7280"
                multiline
              />
              <View style={styles.opsActionRow}>
                <Pressable
                  style={[styles.opsActionButton, { backgroundColor: roleTheme.accent }]}
                  onPress={sendReply}
                >
                  <Text style={styles.opsActionButtonText}>Send reply</Text>
                </Pressable>
                <Pressable
                  style={styles.opsActionButtonSecondary}
                  onPress={() => {
                    setReplyDraft(selectedAlert.replyDraft || "");
                    setOfficerNotes(selectedAlert.officerNotes || "");
                    setCoachRemark(selectedAlert.coachRemark || "");
                    setStationRemark(selectedAlert.stationRemark || "");
                  }}
                >
                  <Text style={styles.opsActionButtonSecondaryText}>Reset text</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.opsActionPills}>
              <Pressable style={styles.opsStatusAction} onPress={() => markAcknowledgement("Seen")}>
                <Text style={styles.opsStatusActionText}>Seen</Text>
              </Pressable>
              <Pressable
                style={styles.opsStatusAction}
                onPress={() => markAcknowledgement("Acknowledged")}
              >
                <Text style={styles.opsStatusActionText}>Acknowledged</Text>
              </Pressable>
              <Pressable style={styles.opsStatusAction} onPress={() => applyStatus("Item Being Checked")}>
                <Text style={styles.opsStatusActionText}>Item Being Checked</Text>
              </Pressable>
              <Pressable style={styles.opsStatusAction} onPress={() => applyStatus("Item Found")}>
                <Text style={styles.opsStatusActionText}>Item Found</Text>
              </Pressable>
              <Pressable style={styles.opsStatusAction} onPress={() => applyStatus("Passenger Contacted")}>
                <Text style={styles.opsStatusActionText}>Passenger Contacted</Text>
              </Pressable>
              <Pressable style={styles.opsStatusAction} onPress={coordinateHandover}>
                <Text style={styles.opsStatusActionText}>Ready for Handover</Text>
              </Pressable>
              <Pressable style={styles.opsStatusAction} onPress={() => applyStatus("Closed")}>
                <Text style={styles.opsStatusActionText}>Closed</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={styles.opsSection}>
          <View style={styles.opsSectionHeader}>
            <Text style={styles.opsSectionTitle}>Recent responses</Text>
            <Text style={styles.opsSectionSubtitle}>Latest officer-to-passenger replies.</Text>
          </View>
          {recentResponses.length > 0 ? (
            recentResponses.map((entry, index) => (
              <View key={`${entry.alertId}-${index}`} style={styles.opsCaseCard}>
                <Text style={styles.opsCaseId}>{entry.alertId}</Text>
                <Text style={styles.opsCaseSummary}>{entry.text}</Text>
                <View style={styles.opsCaseMetaRow}>
                  <Text style={styles.opsCaseMetaText}>{entry.staffName || dutyUnit}</Text>
                  <Text style={styles.opsCaseMetaText}>{entry.passengerName}</Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.opsEmptyState}>
              <Text style={styles.opsEmptyText}>No response messages yet for this duty shift.</Text>
            </View>
          )}
        </View>

        <View style={styles.opsDetailCard}>
          <View style={styles.opsSectionHeader}>
            <Text style={styles.opsSectionTitle}>Prototype Data Lab</Text>
            <Text style={styles.opsSectionSubtitle}>
              Add your own dummy officers, staff, vehicles, complaints, alerts, or handover records.
            </Text>
          </View>
          <View style={styles.opsActionPills}>
            {["officers", "staff", "vehicles", "complaints", "alerts", "handover-records"].map((item) => (
              <Pressable
                key={item}
                style={[
                  styles.opsStatusAction,
                  prototypeType === item && { borderColor: roleTheme.accent },
                ]}
                onPress={() => setPrototypeType(item)}
              >
                <Text style={styles.opsStatusActionText}>{item}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={styles.opsReplyInput}
            value={prototypePayload}
            onChangeText={setPrototypePayload}
            placeholder='{"name":"Demo Officer","dutyUnit":"TTE"}'
            placeholderTextColor="#6B7280"
            multiline
          />
          <View style={styles.opsActionRow}>
            <Pressable
              style={[styles.opsActionButton, { backgroundColor: roleTheme.accent }]}
              onPress={submitPrototypeRecord}
            >
              <Text style={styles.opsActionButtonText}>Save dummy data</Text>
            </Pressable>
            <Pressable style={styles.opsActionButtonSecondary} onPress={loadPrototypeSummary}>
              <Text style={styles.opsActionButtonSecondaryText}>Refresh summary</Text>
            </Pressable>
          </View>
          {prototypeInfo.length > 0 ? <Text style={styles.opsInfoHint}>{prototypeInfo}</Text> : null}
          {prototypeSummary ? (
            <Text style={styles.opsInfoHint}>
              Officers: {prototypeSummary.officers} | Staff: {prototypeSummary.staff} | Vehicles: {prototypeSummary.vehicles} | Complaints: {prototypeSummary.complaints} | Alerts: {prototypeSummary.alerts} | Handover: {prototypeSummary.handoverRecords}
            </Text>
          ) : null}
        </View>

        <Pressable style={styles.opsLogoutButton} onPress={onLogout}>
          <Text style={styles.opsLogoutText}>Logout</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
};

const TtrDashboard = (props) => (
  <OfficerDashboardScreen {...props} roleKey="TTR" roleLabel="TTR Dashboard" />
);

const TteDashboard = (props) => (
  <OfficerDashboardScreen {...props} roleKey="TTE" roleLabel="TTE Dashboard" />
);

const RpfDashboard = (props) => (
  <OfficerDashboardScreen {...props} roleKey="RPF" roleLabel="RPF Dashboard" />
);

const PoliceDashboard = (props) => (
  <OfficerDashboardScreen {...props} roleKey="Police" roleLabel="Police Dashboard" />
);

const AppContent = () => {
  const [mode, setMode] = useState("login");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState("Passenger");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [officialEmail, setOfficialEmail] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [emailOtp, setEmailOtp] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [loginWithOtp, setLoginWithOtp] = useState(false);
  const [otpResendCountdown, setOtpResendCountdown] = useState(0);
  const [resetResendCountdown, setResetResendCountdown] = useState(0);
  const [isPostLoginOtpStep, setIsPostLoginOtpStep] = useState(false);
  const [pendingLoginProfile, setPendingLoginProfile] = useState(null);
  const [pendingLoginSpecificRole, setPendingLoginSpecificRole] = useState("");
  const [pendingApproval, setPendingApproval] = useState(false);

  const [travelType, setTravelType] = useState("");
  const [travelNumber, setTravelNumber] = useState("");
  const [travelName, setTravelName] = useState("");
  const [busDeparture, setBusDeparture] = useState("");
  const [busArrival, setBusArrival] = useState("");
  const [busStartTime, setBusStartTime] = useState("");
  const [busStartMeridiem, setBusStartMeridiem] = useState("");
  const [travelRoute, setTravelRoute] = useState("");
  const [travelTiming, setTravelTiming] = useState("");
  const [driverName, setDriverName] = useState("");
  const [conductorName, setConductorName] = useState("");

  const [vehicleNumber, setVehicleNumber] = useState("");
  const [dutyRoute, setDutyRoute] = useState("");
  const [shiftTiming, setShiftTiming] = useState("");
  const [fromStop, setFromStop] = useState("");
  const [toStop, setToStop] = useState("");
  const [pnrRange, setPnrRange] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");

  const [selectedTransport, setSelectedTransport] = useState("");
  const [complaintItem, setComplaintItem] = useState("");
  const [complaintDesc, setComplaintDesc] = useState("");
  const [complaintLocation, setComplaintLocation] = useState("");
  const [complaintTime, setComplaintTime] = useState("");
  const [complaintTimeMeridiem, setComplaintTimeMeridiem] = useState("");
  const [complaintSubmitted, setComplaintSubmitted] = useState(false);
  const [staffConfirmed, setStaffConfirmed] = useState(false);
  const [handoffComplete, setHandoffComplete] = useState(false);

  const [staffComplaintType, setStaffComplaintType] = useState("");
  const [staffComplaintTarget, setStaffComplaintTarget] = useState("");
  const [staffComplaintDetails, setStaffComplaintDetails] = useState("");
  const [staffComplaintSubmitted, setStaffComplaintSubmitted] = useState(false);

  const [error, setError] = useState("");
  const [apiStatus, setApiStatus] = useState("checking");
  const [apiError, setApiError] = useState("");
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Forgot password states
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [isResetCodeSent, setIsResetCodeSent] = useState(false);
  const [isSendingResetCode, setIsSendingResetCode] = useState(false);
  const [isResetCodeVerified, setIsResetCodeVerified] = useState(false);
  const [isVerifyingResetCode, setIsVerifyingResetCode] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Specific role selection for TTR/RPF/Police
  const [showRoleSelection, setShowRoleSelection] = useState(false);
  const [specificRole, setSpecificRole] = useState("");
  const [onDuty, setOnDuty] = useState(true);

  // Animation refs
  const formAnim = useRef(new Animated.Value(0)).current;
  const shieldShake = useRef(new Animated.Value(0)).current;
  const shieldRotate = useRef(new Animated.Value(0)).current;
  const shieldShakeLoopRef = useRef(null);
  const titleFade = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const bgDriftAnim = useRef(new Animated.Value(0)).current;
  const cardFloatAnim = useRef(new Animated.Value(0)).current;

  const isRegister = mode === "register";
  const isOfficialRole = role === "TTR/RPF/Police";
  const isOperationalStaff = role === "Driver/Conductor" || role === "Cab/Auto";
  const otpEmail = (isOfficialRole ? officialEmail : email).trim();
  const isOtpContext = isRegister || (!isRegister && (loginWithOtp || isPostLoginOtpStep));
  const showPasswordInput =
    !forgotPasswordMode &&
    (isRegister || !isPostLoginOtpStep) &&
    (!loginWithOtp || isRegister || isOfficialRole);

  const getOfficialDomain = (selectedRole) => {
    const domains = OFFICIAL_DOMAINS[selectedRole];
    if (Array.isArray(domains)) {
      return domains.join(" or ");
    }
    return domains || "railnet.gov.in";
  };

  const isProfessionalIdValid = (selectedRole, idValue) => {
    const normalized = idValue.trim().toUpperCase();
    if (selectedRole === "TTR/RPF/Police") {
      return (
        /^TNPOLICE-\d{4,6}$/.test(normalized) ||
        /^(TTR|TTE|RPF)-[A-Z]{2,3}-\d{4,6}$/.test(normalized)
      );
    }
    return normalized.length >= 6;
  };

  const inferSpecificRoleFromId = (idValue) => {
    return inferSpecificRoleFromProfessionalId(idValue);
  };

  const isOfficialEmailValid = (selectedRole, emailValue) => {
    const trimmed = emailValue.trim().toLowerCase();
    const domains = OFFICIAL_DOMAINS[selectedRole];
    if (!trimmed || !domains) {
      return false;
    }
    if (Array.isArray(domains)) {
      return domains.some((domain) => trimmed.endsWith(`@${domain}`));
    }
    return trimmed.endsWith(`@${domains}`);
  };

  const isValidEmail = (emailValue) => {
    const trimmed = (emailValue || "").trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  };

  const canVerify = useMemo(() => {
    return /^\d{6}$/.test(emailOtp.trim());
  }, [emailOtp]);

  const passwordChecks = useMemo(() => getPasswordChecks(password), [password]);

  const metPasswordChecks = useMemo(
    () => Object.values(passwordChecks).filter(Boolean).length,
    [passwordChecks],
  );

  const isPasswordStrong = metPasswordChecks === 4;

  const newPasswordChecks = useMemo(
    () => getPasswordChecks(newPassword),
    [newPassword],
  );

  const metNewPasswordChecks = useMemo(
    () => Object.values(newPasswordChecks).filter(Boolean).length,
    [newPasswordChecks],
  );

  const isNewPasswordStrong = metNewPasswordChecks === 4;

  const isRegisterPasswordMatch = useMemo(
    () => confirmPassword.length > 0 && password === confirmPassword,
    [confirmPassword, password],
  );

  const isResetPasswordMatch = useMemo(
    () => confirmNewPassword.length > 0 && newPassword === confirmNewPassword,
    [confirmNewPassword, newPassword],
  );

  const canSubmit = useMemo(() => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    const baseRegisterReady =
      name.trim().length >= 2 &&
      phone.trim().length >= 8 &&
      trimmedPassword.length === PASSWORD_MIN_LENGTH &&
      isPasswordStrong &&
      confirmPassword.trim().length === PASSWORD_MIN_LENGTH &&
      isRegisterPasswordMatch;

    if (isRegister) {
      if (!baseRegisterReady) {
        return false;
      }

      if (isOfficialRole) {
        return (
          isProfessionalIdValid(role, professionalId) &&
          isValidEmail(officialEmail) &&
          isVerified &&
          pnrRange.trim().length >= 5 &&
          jurisdiction.trim().length >= 3
        );
      }

      const emailReady = trimmedEmail.length >= 5 && isVerified;
      if (!emailReady) {
        return false;
      }

      if (role === "Passenger") {
        if (travelType === "Bus") {
          return (
            travelNumber.trim().length >= 5 &&
            busDeparture.trim().length >= 2 &&
            busArrival.trim().length >= 2 &&
            busStartTime.trim().length >= 3 &&
            busStartMeridiem.length > 0
          );
        }

        return (
          travelType.trim().length > 0 &&
          travelNumber.trim().length >= 5 &&
          travelName.trim().length >= 2 &&
          travelRoute.trim().length >= 3 &&
          travelTiming.trim().length >= 4
        );
      }

      if (isOperationalStaff) {
        return (
          vehicleNumber.trim().length >= 5 &&
          shiftTiming.trim().length >= 3 &&
          fromStop.trim().length >= 2 &&
          toStop.trim().length >= 2
        );
      }

      return false;
    }

    if (isPostLoginOtpStep) {
      return isVerified;
    }

    if (isOfficialRole) {
      const hasOfficialLoginEmail = isValidEmail(trimmedEmail);
      const hasProfessionalId = isProfessionalIdValid(role, professionalId);
      return (hasOfficialLoginEmail || hasProfessionalId) && trimmedPassword.length >= 6;
    }

    if (loginWithOtp) {
      return otpEmail.length >= 5 && isVerified;
    }

    return trimmedEmail.length >= 5 && trimmedPassword.length >= 6;
  }, [
    confirmPassword,
    busArrival,
    busDeparture,
    busStartTime,
    busStartMeridiem,
    dutyRoute,
    email,
    fromStop,
    isOfficialRole,
    isRegister,
    isVerified,
    isPostLoginOtpStep,
    jurisdiction,
    loginWithOtp,
    name,
    otpEmail,
    officialEmail,
    password,
    isRegisterPasswordMatch,
    phone,
    pnrRange,
    professionalId,
    isPasswordStrong,
    role,
    shiftTiming,
    toStop,
    travelNumber,
    travelName,
    travelRoute,
    travelTiming,
    travelType,
    vehicleNumber,
  ]);

  useEffect(() => {
    let isMounted = true;

    const checkHealth = async () => {
      try {
        const { data } = await axios.get(`${API_BASE}/health`);
        if (!isMounted) {
          return;
        }
        if (data?.status === "ok") {
          setApiStatus("online");
          setApiError("");
        } else {
          setApiStatus("offline");
          setApiError("Backend service unavailable");
        }
      } catch (err) {
        if (isMounted) {
          setApiStatus("offline");
          setApiError(err?.message || "Unable to connect to backend");
        }
      }
    };

    checkHealth();

    return () => {
      isMounted = false;
    };
  }, []);

  const buildShieldShakeAnimation = () =>
    Animated.loop(
      Animated.sequence([
        Animated.timing(shieldShake, {
          toValue: 10,
          duration: 100,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(shieldShake, {
          toValue: -10,
          duration: 100,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(shieldShake, {
          toValue: 10,
          duration: 100,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(shieldShake, {
          toValue: 0,
          duration: 100,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ])
    );

  const startShieldShake = () => {
    if (shieldShakeLoopRef.current) {
      return;
    }
    shieldShakeLoopRef.current = buildShieldShakeAnimation();
    shieldShakeLoopRef.current.start();
  };

  const stopShieldShake = () => {
    if (shieldShakeLoopRef.current) {
      shieldShakeLoopRef.current.stop();
      shieldShakeLoopRef.current = null;
    }
    shieldShake.setValue(0);
  };

  // Animations for login/register page
  useEffect(() => {
    // Form fade-in and slide up animation
    Animated.spring(formAnim, {
      toValue: 1,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();

    // Title fade-in
    Animated.timing(titleFade, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    // Shield rotate animation (gentle continuous rotation)
    const shieldRotateLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(shieldRotate, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(shieldRotate, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    shieldRotateLoop.start();

    const bgDriftLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bgDriftAnim, {
          toValue: 1,
          duration: 2800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(bgDriftAnim, {
          toValue: 0,
          duration: 2800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    const cardFloatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(cardFloatAnim, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(cardFloatAnim, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    bgDriftLoop.start();
    cardFloatLoop.start();

    return () => {
      stopShieldShake();
      shieldRotateLoop.stop();
      bgDriftLoop.stop();
      cardFloatLoop.stop();
    };
  }, [bgDriftAnim, cardFloatAnim, formAnim, shieldRotate, titleFade]);

  // Reset animations when switching between login/register
  useEffect(() => {
    Animated.sequence([
      Animated.timing(formAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.spring(formAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, [mode]);

  const resetForm = () => {
    setName("");
    setPhone("");
    setEmail("");
    setOfficialEmail("");
    setProfessionalId("");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    setEmailOtp("");
    setIsVerified(false);
    setIsOtpSent(false);
    setIsSendingOtp(false);
    setLoginWithOtp(false);
    setIsPostLoginOtpStep(false);
    setPendingLoginProfile(null);
    setPendingLoginSpecificRole("");
    setTravelType("");
    setTravelNumber("");
    setTravelName("");
    setBusDeparture("");
    setBusArrival("");
    setBusStartTime("");
    setBusStartMeridiem("");
    setTravelRoute("");
    setTravelTiming("");
    setDriverName("");
    setConductorName("");
    setVehicleNumber("");
    setDutyRoute("");
    setShiftTiming("");
    setFromStop("");
    setToStop("");
    setPnrRange("");
    setJurisdiction("");
    setStaffComplaintType("");
    setStaffComplaintTarget("");
    setStaffComplaintDetails("");
    setStaffComplaintSubmitted(false);
    setForgotPasswordMode(false);
    setResetCode("");
    setNewPassword("");
    setConfirmNewPassword("");
    setShowNewPassword(false);
    setShowConfirmNewPassword(false);
    setIsResetCodeSent(false);
    setIsSendingResetCode(false);
    setIsResetCodeVerified(false);
    setIsVerifyingResetCode(false);
    setResetSuccess(false);
    setShowRoleSelection(false);
    setSpecificRole("");
    setOnDuty(true);
    setError("");
  };

  useEffect(() => {
    if (Platform.OS !== "android") {
      return undefined;
    }

    const onBackPress = () => {
      if (isAuthenticated) {
        setIsAuthenticated(false);
        setMode("login");
        setComplaintSubmitted(false);
        setStaffConfirmed(false);
        setHandoffComplete(false);
        setStaffComplaintSubmitted(false);
        setShowRoleSelection(false);
        setSpecificRole("");
        resetForm();
        return true;
      }

      if (showRoleSelection) {
        setShowRoleSelection(false);
        setSpecificRole("");
        setError("");
        return true;
      }

      if (forgotPasswordMode) {
        setForgotPasswordMode(false);
        setResetCode("");
        setNewPassword("");
        setConfirmNewPassword("");
        setShowNewPassword(false);
        setShowConfirmNewPassword(false);
        setIsResetCodeSent(false);
        setIsSendingResetCode(false);
        setIsResetCodeVerified(false);
        setIsVerifyingResetCode(false);
        setResetSuccess(false);
        setError("");
        return true;
      }

      if (!isRegister && loginWithOtp) {
        setLoginWithOtp(false);
        setIsPostLoginOtpStep(false);
        setPendingLoginProfile(null);
        setPendingLoginSpecificRole("");
        setEmailOtp("");
        setIsVerified(false);
        setIsOtpSent(false);
        setError("");
        return true;
      }

      if (isRegister) {
        setMode("login");
        setError("");
        return true;
      }

      return false;
    };

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      onBackPress,
    );

    return () => subscription.remove();
  }, [
    forgotPasswordMode,
    isAuthenticated,
    isRegister,
    loginWithOtp,
    isPostLoginOtpStep,
    showRoleSelection,
  ]);

  // OTP Resend Countdown Timer
  useEffect(() => {
    let interval;
    if (otpResendCountdown > 0) {
      interval = setInterval(() => {
        setOtpResendCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [otpResendCountdown]);

  useEffect(() => {
    let interval;
    if (resetResendCountdown > 0) {
      interval = setInterval(() => {
        setResetResendCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resetResendCountdown]);

  useEffect(() => {
    if (!forgotPasswordMode && resetResendCountdown > 0) {
      setResetResendCountdown(0);
    }
  }, [forgotPasswordMode, resetResendCountdown]);

  const applyUserProfile = (profile = {}) => {
    setName(profile.name || "");
    setPhone(profile.phone || "");
    setEmail(profile.email || "");
    setOfficialEmail(profile.officialEmail || profile.email || "");
    setProfessionalId(profile.professionalId || "");
    setJurisdiction(profile.jurisdiction || "");
    setPnrRange(profile.pnrRange || "");
  };

  const completeLoginAfterOtp = (profile = {}, inferredRole = "") => {
    applyUserProfile(profile);

    if (isOfficialRole) {
      if (inferredRole) {
        setSpecificRole(inferredRole);
        setShowRoleSelection(false);
        setIsAuthenticated(true);
        return;
      }

      setShowRoleSelection(true);
      return;
    }

    setIsAuthenticated(true);
  };

  const initiatePostLoginOtp = async (profile = {}, inferredRole = "") => {
    const resolvedEmail = (
      isOfficialRole
        ? profile.officialEmail || profile.email || ""
        : profile.email || email
    )
      .trim()
      .toLowerCase();

    if (!isValidEmail(resolvedEmail)) {
      setError("Unable to send OTP. Account email is missing or invalid.");
      return false;
    }

    if (isOfficialRole) {
      setOfficialEmail(resolvedEmail);
    } else {
      setEmail(resolvedEmail);
    }

    setPendingLoginProfile(profile);
    setPendingLoginSpecificRole(inferredRole);
    setIsPostLoginOtpStep(true);
    setLoginWithOtp(true);
    setEmailOtp("");
    setIsVerified(false);
    setIsOtpSent(false);
    setIsSendingOtp(true);

    try {
      const { data } = await sendCode(resolvedEmail, "login");
      const sent = Boolean(data?.sent);
      setIsOtpSent(sent);

      if (!sent) {
        setError(data?.message || "Unable to send OTP.");
        setIsPostLoginOtpStep(false);
        setLoginWithOtp(false);
        setPendingLoginProfile(null);
        setPendingLoginSpecificRole("");
        return false;
      }

      setError("");
      return true;
    } catch (err) {
      const message =
        err?.response?.data?.message || "Unable to send verification code.";
      setError(message);
      setIsPostLoginOtpStep(false);
      setLoginWithOtp(false);
      setPendingLoginProfile(null);
      setPendingLoginSpecificRole("");
      return false;
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      setError("Please complete all required fields.");
      return;
    }

    if (isRegister && !isPasswordStrong) {
      setError(
        "Password must be exactly 6 chars with uppercase, number, and special char.",
      );
      return;
    }

    if (isRegister && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!isRegister && isOfficialRole && pendingApproval) {
      setError("Your account is pending admin approval. Please try later.");
      return;
    }

    if (isRegister && isOfficialRole && !isVerified) {
      setError("Verify your official email before registering.");
      return;
    }

    setError("");

    if (isRegister) {
      const isBusTravel = travelType === "Bus";
      const registeredEmail = email.trim().toLowerCase();
      const registeredOfficialEmail = officialEmail.trim().toLowerCase();
      const registeredProfessionalId = professionalId.trim();
      const resolvedTravelRoute = isBusTravel
        ? `${busDeparture.trim()} -> ${busArrival.trim()}`
        : travelRoute.trim();
      const resolvedTravelTiming = isBusTravel
        ? formatClockTime(busStartTime, busStartMeridiem)
        : travelTiming.trim();
      const resolvedDutyRoute = `${fromStop.trim()} -> ${toStop.trim()}`;

      try {
        await axios.post(`${API_BASE}/auth/register`, {
          role,
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim().toLowerCase(),
          officialEmail: officialEmail.trim().toLowerCase(),
          professionalId: professionalId.trim(),
          password: password.trim(),
          isVerified,
          travelType: travelType.trim(),
          travelNumber: travelNumber.trim(),
          travelName: travelName.trim(),
          travelRoute: resolvedTravelRoute,
          travelTiming: resolvedTravelTiming,
          driverName: driverName.trim(),
          conductorName: conductorName.trim(),
          vehicleNumber: vehicleNumber.trim(),
          dutyRoute: resolvedDutyRoute,
          shiftTiming: shiftTiming.trim(),
          fromStop: fromStop.trim(),
          toStop: toStop.trim(),
          pnrRange: pnrRange.trim(),
          jurisdiction: jurisdiction.trim(),
        });

        resetForm();
        setMode("login");
        setPendingApproval(isOfficialRole);

        if (isOfficialRole) {
          setProfessionalId(registeredProfessionalId);
          setOfficialEmail(registeredOfficialEmail);
          setError(
            "Registration submitted. Admin approval takes up to 24 hours.",
          );
          return;
        }

        setEmail(registeredEmail);
        setError("Registration successful. Please log in.");
        return;
      } catch (err) {
        const message =
          err?.response?.data?.message || "Unable to register account.";
        setError(message);
        return;
      }
    }

    if (!isRegister && isOfficialRole) {
      try {
        const { data } = await axios.post(`${API_BASE}/auth/login`, {
          role,
          email: email.trim().toLowerCase(),
          professionalId: professionalId.trim(),
          password: password.trim(),
          method: "password",
        });

        const profile = data?.user;
        if (!profile) {
          setError("Unable to load profile for this account.");
          return;
        }

        const inferredRole = inferSpecificRoleFromId(
          profile.professionalId || professionalId,
        );

        setProfessionalId(profile.professionalId || professionalId);
        setSpecificRole(inferredRole);
        setError("");
        setIsAuthenticated(true);
      } catch (err) {
        const message = err?.response?.data?.message || "Unable to log in.";
        setPendingApproval(message.toLowerCase().includes("pending"));
        setError(message);
      }
      return;
    }

    if (!isRegister && !loginWithOtp) {
      try {
        const { data } = await axios.post(`${API_BASE}/auth/login`, {
          role,
          email: email.trim().toLowerCase(),
          password: password.trim(),
          method: "password",
        });

        const profile = data?.user;
        if (!profile) {
          setError("Unable to load profile for this account.");
          return;
        }

        setEmail(profile.email || email);
        setError("");
        setIsAuthenticated(true);
      } catch (err) {
        const message = err?.response?.data?.message || "Unable to log in.";
        setError(message);
      }
      return;
    }
  };

  const handleSpecificRoleSelection = () => {
    if (!specificRole) {
      setError("Please select your specific role.");
      return;
    }
    setError("");
    setShowRoleSelection(false);
    setIsAuthenticated(true);
  };

  const handleSwitchMode = () => {
    setMode((prev) => (prev === "login" ? "register" : "login"));
    resetForm();
  };

  const handleOpenTrainGuideDemo = () => {
    setRole("TTR/RPF/Police");
    setSpecificRole("TTR");
    setShowRoleSelection(false);
    setForgotPasswordMode(false);
    setOnDuty(true);
    setError("");

    // Demo-friendly defaults for guide presentation.
    setName((prev) => prev.trim() || "Guide Demo Officer");
    setProfessionalId("TTR-SR-12345");
    setOfficialEmail("guide.demo@railnet.gov.in");
    setTravelNumber("12631");
    setPnrRange("4528193000-4528193999");
    setJurisdiction("Chennai Central Division");

    setIsAuthenticated(true);
  };

  const handleRoleChange = (nextRole) => {
    setRole(nextRole);
    setForgotPasswordMode(false);
    setEmailOtp("");
    setIsVerified(false);
    setIsOtpSent(false);
    setIsSendingOtp(false);
    setLoginWithOtp(false);
    setIsPostLoginOtpStep(false);
    setPendingLoginProfile(null);
    setPendingLoginSpecificRole("");
    setPendingApproval(false);
    setIsResetCodeSent(false);
    setIsResetCodeVerified(false);
    setResetCode("");
    setNewPassword("");
    setConfirmNewPassword("");
    setError("");
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setMode("login");
    setComplaintSubmitted(false);
    setStaffConfirmed(false);
    setHandoffComplete(false);
    setStaffComplaintSubmitted(false);
    setShowRoleSelection(false);
    setSpecificRole("");
    resetForm();
  };

  const handleSendOtp = async () => {
    if (!isValidEmail(otpEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    setError("");
    setIsVerified(false);
    setIsOtpSent(false);
    setEmailOtp("");
    setIsSendingOtp(true);

    try {
      const { data } = await sendCode(otpEmail, isRegister ? "register" : "login");
      const sent = Boolean(data?.sent);
      setIsOtpSent(sent);
      if (sent) {
        setOtpResendCountdown(60); // Start 60-second countdown
        if (data?.fallback && data?.devCode) {
          setEmailOtp(String(data.devCode));
          setError("Email service unavailable, so OTP was auto-filled for development. Tap Verify.");
        }
      } else if (data?.message) {
        setError(data.message);
      }
    } catch (err) {
      const message =
        err?.response?.data?.message || "Unable to send verification code.";
      setError(message);
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerify = async () => {
    if (!canVerify) {
      setError("Enter valid OTP to verify.");
      return;
    }

    setError("");

    try {
      await verifyCode(otpEmail, emailOtp.trim());
      setIsVerified(true);

      if (isPostLoginOtpStep && pendingLoginProfile) {
        completeLoginAfterOtp(pendingLoginProfile, pendingLoginSpecificRole);
        setIsPostLoginOtpStep(false);
        setLoginWithOtp(false);
        setPendingLoginProfile(null);
        setPendingLoginSpecificRole("");
        setEmailOtp("");
        setIsOtpSent(false);
      }
    } catch (err) {
      const message = err?.response?.data?.message || "Unable to verify code.";
      setIsVerified(false);
      setError(message);
    }
  };

  const handleSendResetCode = async () => {
    const trimmedEmail = officialEmail.trim().toLowerCase();
    const trimmedProfessionalId = professionalId.trim();

    // Validate professional ID
    if (trimmedProfessionalId.length < 6) {
      setError("Enter a valid professional ID.");
      return;
    }

    // Basic email validation
    if (trimmedEmail.length < 5 || !trimmedEmail.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }

    // Check if it's an official domain
    if (!isOfficialEmailValid(role, officialEmail)) {
      setError(
        `Please use your official ${getOfficialDomain(role)} email address.`,
      );
      return;
    }

    setError("");
    setIsResetCodeSent(false);
    setResetCode("");
    setIsSendingResetCode(true);

    try {
      const { data } = await axios.post(`${API_BASE}/auth/forgot-password`, {
        role,
        professionalId: trimmedProfessionalId,
        officialEmail: trimmedEmail,
      });
      const sent = Boolean(data?.sent);
      setIsResetCodeSent(sent);
      if (!sent && data?.message) {
        setError(data.message);
      } else if (sent) {
        setResetResendCountdown(60);
      }
    } catch (err) {
      const message =
        err?.response?.data?.message || "Unable to send reset code.";
      setError(message);
    } finally {
      setIsSendingResetCode(false);
    }
  };

  const handleResendResetCode = async () => {
    const trimmedEmail = officialEmail.trim().toLowerCase();
    const trimmedProfessionalId = professionalId.trim();

    if (trimmedProfessionalId.length < 6) {
      setError("Enter a valid professional ID.");
      return;
    }

    if (trimmedEmail.length < 5 || !trimmedEmail.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }

    if (!isOfficialEmailValid(role, officialEmail)) {
      setError(
        `Please use your official ${getOfficialDomain(role)} email address.`,
      );
      return;
    }

    setError("");
    setResetCode("");
    setIsResetCodeVerified(false);
    setIsSendingResetCode(true);

    try {
      const { data } = await axios.post(`${API_BASE}/auth/forgot-password`, {
        role,
        professionalId: trimmedProfessionalId,
        officialEmail: trimmedEmail,
      });
      const sent = Boolean(data?.sent);
      setIsResetCodeSent(sent);
      if (!sent && data?.message) {
        setError(data.message);
      } else if (sent) {
        setResetResendCountdown(60);
      }
    } catch (err) {
      const message =
        err?.response?.data?.message || "Unable to resend reset code.";
      setError(message);
    } finally {
      setIsSendingResetCode(false);
    }
  };

  const handleVerifyResetCode = async () => {
    if (resetCode.trim().length !== 6) {
      setError("Enter valid 6-digit reset code.");
      return;
    }

    setError("");
    setIsVerifyingResetCode(true);

    try {
      const payload = {
        officialEmail: officialEmail.trim().toLowerCase(),
        resetCode: resetCode.trim(),
      };

      console.log("Verifying reset code with payload:", payload);

      // Verify the reset code with the backend
      const { data } = await axios.post(`${API_BASE}/auth/verify-reset-code`, payload);

      console.log("Verification response:", data);

      if (data?.valid) {
        setIsResetCodeVerified(true);
        setError("");
      } else {
        setError(data?.message || "Invalid reset code.");
      }
    } catch (err) {
      console.error("Verification error:", err.response?.data || err.message);

      // Handle both successful error responses (with valid: false) and actual errors
      const responseData = err?.response?.data;
      if (responseData?.valid === false) {
        setError(responseData?.message || "Invalid reset code.");
      } else {
        const message =
          err?.response?.data?.message || "Unable to verify reset code.";
        setError(message);
      }
    } finally {
      setIsVerifyingResetCode(false);
    }
  };

  const handleResetPassword = async () => {
    if (!isNewPasswordStrong) {
      setError(
        "Password must be exactly 6 chars with uppercase, number, and special char.",
      );
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError("");

    try {
      const payload = {
        officialEmail: officialEmail.trim().toLowerCase(),
        resetCode: resetCode.trim(),
        newPassword: newPassword.trim(),
      };
      
      console.log("Resetting password with:", { email: payload.officialEmail, codeLength: payload.resetCode.length });

      // Use the forgot-password reset endpoint
      await axios.post(`${API_BASE}/auth/reset-password`, payload);

      console.log("Password reset successful");
      setResetSuccess(true);
      setError("");
      setTimeout(() => {
        setForgotPasswordMode(false);
        setResetResendCountdown(0);
        setResetSuccess(false);
        setResetCode("");
        setNewPassword("");
        setConfirmNewPassword("");
        setIsResetCodeSent(false);
        setIsResetCodeVerified(false);
        setOfficialEmail("");
        setProfessionalId("");
      }, 2000);
    } catch (err) {
      console.error("Password reset error:", err.response?.data || err.message);
      const message =
        err?.response?.data?.message ||
        "Unable to reset password.";
      setError(message);
    }
  };

  const handleSendResetCodeUser = async () => {
    const trimmedEmail = email.trim().toLowerCase();

    // Basic email validation
    if (trimmedEmail.length < 5 || !trimmedEmail.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }

    setError("");
    setIsResetCodeSent(false);
    setResetCode("");
    setIsSendingResetCode(true);

    try {
      const { data } = await axios.post(
        `${API_BASE}/auth/forgot-password-user`,
        {
          email: trimmedEmail,
        },
      );
      const sent = Boolean(data?.sent);
      setIsResetCodeSent(sent);
      if (!sent && data?.message) {
        setError(data.message);
      } else if (sent) {
        setResetResendCountdown(60);
      }
    } catch (err) {
      const message =
        err?.response?.data?.message || "Unable to send verification code.";
      setError(message);
    } finally {
      setIsSendingResetCode(false);
    }
  };

  const handleResendResetCodeUser = async () => {
    const trimmedEmail = email.trim().toLowerCase();

    if (trimmedEmail.length < 5 || !trimmedEmail.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }

    setError("");
    setResetCode("");
    setIsResetCodeVerified(false);
    setIsSendingResetCode(true);

    try {
      const { data } = await axios.post(
        `${API_BASE}/auth/forgot-password-user`,
        {
          email: trimmedEmail,
        },
      );
      const sent = Boolean(data?.sent);
      setIsResetCodeSent(sent);
      if (!sent && data?.message) {
        setError(data.message);
      } else if (sent) {
        setResetResendCountdown(60);
      }
    } catch (err) {
      const message =
        err?.response?.data?.message || "Unable to resend verification code.";
      setError(message);
    } finally {
      setIsSendingResetCode(false);
    }
  };

  const handleVerifyResetCodeUser = async () => {
    if (resetCode.trim().length !== 6) {
      setError("Enter valid 6-digit verification code.");
      return;
    }

    setError("");
    setIsVerifyingResetCode(true);

    try {
      const payload = {
        email: email.trim().toLowerCase(),
        otpCode: resetCode.trim(),
      };

      console.log("Verifying reset code with payload:", payload);

      // Verify the reset code with the backend
      const { data } = await axios.post(`${API_BASE}/auth/verify-reset-code-user`, payload);

      console.log("Verification response:", data);

      if (data?.valid) {
        setIsResetCodeVerified(true);
        setError("");
      } else {
        setError(data?.message || "Invalid verification code.");
      }
    } catch (err) {
      console.error("Verification error:", err.response?.data || err.message);

      // Handle both successful error responses (with valid: false) and actual errors
      const responseData = err?.response?.data;
      if (responseData?.valid === false) {
        setError(responseData?.message || "Invalid verification code.");
      } else {
        const message =
          err?.response?.data?.message || "Unable to verify code.";
        setError(message);
      }
    } finally {
      setIsVerifyingResetCode(false);
    }
  };

  const handleResetPasswordUser = async () => {
    if (!isNewPasswordStrong) {
      setError(
        "Password must be exactly 6 chars with uppercase, number, and special char.",
      );
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError("");

    try {
      const payload = {
        email: email.trim().toLowerCase(),
        otpCode: resetCode.trim(),
        newPassword: newPassword.trim(),
      };

      console.log("Resetting password with:", { email: payload.email, codeLength: payload.otpCode.length });

      await axios.post(`${API_BASE}/auth/reset-password-user`, payload);

      console.log("Password reset successful");
      setResetSuccess(true);
      setError("");
      setTimeout(() => {
        setForgotPasswordMode(false);
        setResetResendCountdown(0);
        setResetSuccess(false);
        setResetCode("");
        setNewPassword("");
        setConfirmNewPassword("");
        setIsResetCodeSent(false);
        setIsResetCodeVerified(false);
        setEmail("");
      }, 2000);
    } catch (err) {
      console.error("Password reset user error:", err.response?.data || err.message);
      const message =
        err?.response?.data?.message ||
        "Unable to reset password.";
      setError(message);
    }
  };

  const handleSubmitComplaint = () => {
    if (
      complaintItem.trim().length < 2 ||
      complaintDesc.trim().length < 6 ||
      complaintLocation.trim().length < 2 ||
      complaintTime.trim().length < 3 ||
      !complaintTimeMeridiem
    ) {
      setError("Add item, description, location, and time.");
      return;
    }
    setError("");
    setComplaintSubmitted(true);
    setStaffConfirmed(false);
    setHandoffComplete(false);
  };

  const handleStaffConfirm = () => {
    setStaffConfirmed(true);
  };

  const handleHandoffComplete = () => {
    setHandoffComplete(true);
  };

  const handleSubmitStaffComplaint = () => {
    if (
      staffComplaintType.trim().length < 2 ||
      staffComplaintTarget.trim().length < 2 ||
      staffComplaintDetails.trim().length < 6
    ) {
      setError("Please fill all complaint fields with valid information.");
      return;
    }
    setError("");
    setStaffComplaintSubmitted(true);
  };

  const renderRoleSelector = () => (
    <View style={styles.roleRow}>
      {ROLES.map((item) => (
        <TouchableOpacity
          key={item}
          style={[styles.roleChip, role === item && styles.roleChipActive]}
          onPress={() => handleRoleChange(item)}
        >
          <Text
            style={[
              styles.roleChipText,
              role === item && styles.roleChipTextActive,
            ]}
          >
            {item}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderPassengerDashboard = () => (
    <View>
      <Text style={styles.sectionTitle}>Passenger Command Center</Text>
      <Text style={styles.sectionSubtitle}>
        Live complaint matching + recovery tracking for your trip.
      </Text>

      <View style={styles.cardBlock}>
        <Text style={styles.cardTitle}>Report Lost Item</Text>
        <Text style={styles.label}>
          In which transport did you lose your item?
        </Text>
        <View style={styles.transportGrid}>
          <View style={styles.transportRow}>
            <TouchableOpacity
              style={[
                styles.transportButton,
                selectedTransport === "Train" && styles.transportButtonSelected,
              ]}
              onPress={() => setSelectedTransport("Train")}
              activeOpacity={0.7}
            >
              <Text style={styles.transportIcon}>🚆</Text>
              <Text
                style={[
                  styles.transportButtonText,
                  selectedTransport === "Train" &&
                    styles.transportButtonTextSelected,
                ]}
              >
                Train
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.transportButton,
                selectedTransport === "Car" && styles.transportButtonSelected,
              ]}
              onPress={() => setSelectedTransport("Car")}
              activeOpacity={0.7}
            >
              <Text style={styles.transportIcon}>🚗</Text>
              <Text
                style={[
                  styles.transportButtonText,
                  selectedTransport === "Car" &&
                    styles.transportButtonTextSelected,
                ]}
              >
                Car
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.transportRow}>
            <TouchableOpacity
              style={[
                styles.transportButton,
                selectedTransport === "Bus" && styles.transportButtonSelected,
              ]}
              onPress={() => setSelectedTransport("Bus")}
              activeOpacity={0.7}
            >
              <Text style={styles.transportIcon}>🚌</Text>
              <Text
                style={[
                  styles.transportButtonText,
                  selectedTransport === "Bus" &&
                    styles.transportButtonTextSelected,
                ]}
              >
                Bus
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.transportButton,
                selectedTransport === "Auto" && styles.transportButtonSelected,
              ]}
              onPress={() => setSelectedTransport("Auto")}
              activeOpacity={0.7}
            >
              <Text style={styles.transportIcon}>🛺</Text>
              <Text
                style={[
                  styles.transportButtonText,
                  selectedTransport === "Auto" &&
                    styles.transportButtonTextSelected,
                ]}
              >
                Auto
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {selectedTransport && (
        <View style={styles.cardBlock}>
          <Text style={styles.cardTitle}>Raise Geo-Tagged Complaint</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Lost item</Text>
            <TextInput
              style={styles.input}
              placeholder="Backpack / Phone / Documents"
              placeholderTextColor="#94A3B8"
              value={complaintItem}
              onChangeText={setComplaintItem}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={styles.input}
              placeholder="Color, brand, contents"
              placeholderTextColor="#94A3B8"
              value={complaintDesc}
              onChangeText={setComplaintDesc}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Last seen location</Text>
            <TextInput
              style={styles.input}
              placeholder="Medavakkam / Stop name"
              placeholderTextColor="#94A3B8"
              value={complaintLocation}
              onChangeText={setComplaintLocation}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Time</Text>
            <View style={styles.timeFieldRow}>
              <TextInput
                style={[styles.input, styles.timeInput]}
                placeholder="10:05"
                placeholderTextColor="#94A3B8"
                value={complaintTime}
                onChangeText={setComplaintTime}
                maxLength={5}
              />
              <MeridiemSelector
                value={complaintTimeMeridiem}
                onChange={setComplaintTimeMeridiem}
              />
            </View>
          </View>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleSubmitComplaint}
          >
            <Text style={styles.primaryButtonText}>Submit complaint</Text>
          </TouchableOpacity>
        </View>
      )}

      {complaintSubmitted && (
        <View style={styles.cardBlock}>
          <Text style={styles.cardTitle}>Matched Onboard Staff</Text>
          <Text style={styles.cardText}>Conductor Priya S • TN-01-AB-1234</Text>
          <Text style={styles.cardText}>Route: Velachery → CMBT</Text>
          <Text style={styles.cardText}>
            Current stop: Medavakkam • ETA 8 mins
          </Text>
          <View style={styles.statusRow}>
            <View style={styles.statusDotLarge} />
            <Text style={styles.statusText}>
              Alert delivered in 58 seconds via push + SMS + voice.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleStaffConfirm}
          >
            <Text style={styles.secondaryButtonText}>
              Simulate staff update
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {staffConfirmed && (
        <View style={styles.cardBlock}>
          <Text style={styles.cardTitle}>Live Recovery Tracking</Text>
          <Text style={styles.cardText}>Status: Item SAFE ✅</Text>
          <Text style={styles.cardText}>Collect at Guindy 10:15AM 📍</Text>
          <Text style={styles.cardText}>Live ETA: 11 mins</Text>
          <View style={styles.timelineRow}>
            <View style={styles.timelineDotActive} />
            <View>
              <Text style={styles.timelineTitle}>
                Complaint → Staff Confirmation
              </Text>
              <Text style={styles.timelineSubtitle}>
                Matched on vehicle + timing + geo-location
              </Text>
            </View>
          </View>
          <View style={styles.timelineRow}>
            <View style={styles.timelineDot} />
            <View>
              <Text style={styles.timelineTitle}>Rendezvous QR Pickup</Text>
              <Text style={styles.timelineSubtitle}>
                Scan QR to close custody log
              </Text>
            </View>
          </View>
        </View>
      )}

      <View style={styles.cardBlock}>
        <Text style={styles.cardTitle}>Complaint About TTR/TTE Staff</Text>
        <Text style={styles.sectionSubtitle}>
          Report misconduct or issues with railway staff members
        </Text>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Complaint Type</Text>
          <TextInput
            style={styles.input}
            placeholder="Misbehavior / Negligence / Corruption / Other"
            placeholderTextColor="#94A3B8"
            value={staffComplaintType}
            onChangeText={setStaffComplaintType}
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Staff Member (TTR/TTE)</Text>
          <TextInput
            style={styles.input}
            placeholder="Name / Badge Number / Physical description"
            placeholderTextColor="#94A3B8"
            value={staffComplaintTarget}
            onChangeText={setStaffComplaintTarget}
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Details of Incident</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe the incident in detail..."
            placeholderTextColor="#94A3B8"
            value={staffComplaintDetails}
            onChangeText={setStaffComplaintDetails}
            multiline
            numberOfLines={4}
          />
        </View>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleSubmitStaffComplaint}
        >
          <Text style={styles.primaryButtonText}>Submit Staff Complaint</Text>
        </TouchableOpacity>
      </View>

      {staffComplaintSubmitted && (
        <View style={styles.cardBlock}>
          <Text style={styles.cardTitle}>Complaint Status</Text>
          <Text style={styles.successText}>
            ✅ Complaint submitted successfully
          </Text>
          <Text style={styles.cardText}>
            Complaint ID: SC-{Math.floor(Math.random() * 100000)}
          </Text>
          <Text style={styles.cardText}>Status: Under Review</Text>
          <Text style={styles.cardText}>
            Assigned to: Railway Grievance Cell
          </Text>
          <View style={styles.statusRow}>
            <View style={styles.statusDotLarge} />
            <Text style={styles.statusText}>
              Your complaint has been forwarded to senior railway authorities.
              You will receive updates via SMS and email.
            </Text>
          </View>
          <Text style={styles.cardText}>
            Expected resolution: 7-10 working days
          </Text>
        </View>
      )}
    </View>
  );

  const renderStaffDashboard = () => {
    const displayName = name.trim() || "Staff Member";
    const displayEmail = email.trim() || "Not set";
    const displayPhone = phone.trim() || "Not set";
    const displayVehicleNumber = vehicleNumber.trim() || "Not set";
    const displayRoute = dutyRoute.trim() || "Not set";
    const displayShift = shiftTiming.trim() || "Not set";
    const displayFromStop = fromStop.trim() || "Not set";
    const displayToStop = toStop.trim() || "Not set";

    return (
      <View>
        {/* Staff Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{displayName}</Text>
              <Text style={styles.profileRole}>{role}</Text>
            </View>
          </View>

          <View style={styles.profileDetails}>
            <View style={styles.profileDetailRow}>
              <Text style={styles.profileDetailLabel}>Email:</Text>
              <Text style={styles.profileDetailValue}>{displayEmail}</Text>
            </View>
            <View style={styles.profileDetailRow}>
              <Text style={styles.profileDetailLabel}>Phone:</Text>
              <Text style={styles.profileDetailValue}>{displayPhone}</Text>
            </View>
            <View style={styles.profileDetailRow}>
              <Text style={styles.profileDetailLabel}>Vehicle:</Text>
              <Text style={styles.profileDetailValue}>
                {displayVehicleNumber}
              </Text>
            </View>
            <View style={styles.profileDetailRow}>
              <Text style={styles.profileDetailLabel}>Route:</Text>
              <Text style={styles.profileDetailValue}>{displayRoute}</Text>
            </View>
            <View style={styles.profileDetailRow}>
              <Text style={styles.profileDetailLabel}>Shift:</Text>
              <Text style={styles.profileDetailValue}>{displayShift}</Text>
            </View>
            <View style={styles.profileDetailRow}>
              <Text style={styles.profileDetailLabel}>Stops:</Text>
              <Text style={styles.profileDetailValue}>
                {displayFromStop} → {displayToStop}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>{role} Duty Dashboard</Text>
        <Text style={styles.sectionSubtitle}>
          Live queue, QR handoffs, and custody logs for your duty roster.
        </Text>

        <View style={styles.cardBlock}>
          <Text style={styles.cardTitle}>Active Complaint Queue</Text>
          <View style={styles.queueItem}>
            <View>
              <Text style={styles.queueTitle}>Black backpack</Text>
              <Text style={styles.queueMeta}>
                TN-01-AB-1234 • Stop: Medavakkam
              </Text>
            </View>
            <Text style={styles.queueStatus}>NEW</Text>
          </View>
          <View style={styles.queueItem}>
            <View>
              <Text style={styles.queueTitle}>Passport pouch</Text>
              <Text style={styles.queueMeta}>Route: Velachery → CMBT</Text>
            </View>
            <Text style={styles.queueStatusAmber}>HIGH</Text>
          </View>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleStaffConfirm}
          >
            <Text style={styles.primaryButtonText}>Mark item SAFE</Text>
          </TouchableOpacity>
        </View>

        {staffConfirmed && (
          <View style={styles.cardBlock}>
            <Text style={styles.cardTitle}>Custody & Handoff</Text>
            <Text style={styles.cardText}>Item tagged: QR-8721</Text>
            <Text style={styles.cardText}>Pickup window: 10:15AM @ Guindy</Text>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleHandoffComplete}
            >
              <Text style={styles.secondaryButtonText}>Scan QR handoff</Text>
            </TouchableOpacity>
            {handoffComplete && (
              <Text style={styles.successText}>
                Handoff complete. Custody log updated.
              </Text>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderTtrDashboard = () => {
    const displayName = name.trim() || "Officer";
    const displayEmail = officialEmail.trim() || "Not set";
    const displayProfessionalId = professionalId.trim() || "Not set";
    const displayRole = specificRole || "TTR";
    const displayJurisdiction = jurisdiction.trim() || "Chennai Division";
    const displayPnrRange = pnrRange.trim() || "4500000000 - 4599999999";
    const trainNumber = travelNumber.trim() || "12631";
    const coachAllotted = "S3";
    const shiftTime = "08:00 AM - 04:00 PM";

    return (
      <View>
        <View style={styles.authorityHeaderCard}>
          <View style={styles.authorityHeaderTop}>
            <View>
              <Text style={styles.authorityTitle}>{displayName}</Text>
              <Text style={styles.authoritySubtitle}>
                🎫 TTR - Train Ticket Examiner
              </Text>
            </View>
            <View style={styles.notificationBadge}>
              <Ionicons
                name="notifications"
                size={16}
                color="#1E40AF"
                style={styles.notificationIcon}
              />
              <Text style={styles.notificationText}>3</Text>
            </View>
          </View>
          <View style={styles.authorityMetaRow}>
            <View style={styles.metaPill}>
              <Text style={styles.metaPillText}>Train {trainNumber}</Text>
            </View>
            <View style={styles.metaPill}>
              <Text style={styles.metaPillText}>Coach {coachAllotted}</Text>
            </View>
            <View style={styles.metaPill}>
              <Text style={styles.metaPillText}>Shift {shiftTime}</Text>
            </View>
          </View>
          <View style={styles.dutyRow}>
            <Text style={styles.dutyLabel}>On Duty</Text>
            <TouchableOpacity
              style={[
                styles.dutyToggle,
                onDuty ? styles.dutyToggleActive : styles.dutyToggleInactive,
              ]}
              onPress={() => setOnDuty((prev) => !prev)}
            >
              <View
                style={[
                  styles.dutyKnob,
                  onDuty ? styles.dutyKnobActive : styles.dutyKnobInactive,
                ]}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{displayName}</Text>
              <Text style={styles.profileRole}>{displayRole} Officer</Text>
            </View>
          </View>

          <View style={styles.profileDetails}>
            <View style={styles.profileDetailRow}>
              <Text style={styles.profileDetailLabel}>Professional ID:</Text>
              <Text style={styles.profileDetailValue}>
                {displayProfessionalId}
              </Text>
            </View>
            <View style={styles.profileDetailRow}>
              <Text style={styles.profileDetailLabel}>Official Email:</Text>
              <Text style={styles.profileDetailValue}>{displayEmail}</Text>
            </View>
            <View style={styles.profileDetailRow}>
              <Text style={styles.profileDetailLabel}>Jurisdiction:</Text>
              <Text style={styles.profileDetailValue}>
                {displayJurisdiction}
              </Text>
            </View>
            <View style={styles.profileDetailRow}>
              <Text style={styles.profileDetailLabel}>PNR Range:</Text>
              <Text style={styles.profileDetailValue}>{displayPnrRange}</Text>
            </View>
          </View>
        </View>

        <View style={styles.cardBlock}>
          <Text style={styles.cardTitle}>Active Train Info</Text>
          <Text style={styles.cardText}>
            Train: {trainNumber} - Chennai Express
          </Text>
          <Text style={styles.cardText}>Coach: {coachAllotted}</Text>
          <Text style={styles.cardText}>From: Chennai</Text>
          <Text style={styles.cardText}>To: Madurai</Text>
          <Text style={styles.cardText}>Current Station: Tambaram</Text>
          <Text style={styles.cardText}>Next Station: Chengalpattu</Text>
        </View>

        <View style={styles.alertCard}>
          <Text style={styles.alertTitle}>⚠ LOST ITEM ALERT</Text>
          <Text style={styles.alertText}>Passenger: Ramya V</Text>
          <Text style={styles.alertText}>PNR: 4567891234</Text>
          <Text style={styles.alertText}>Item: Passport</Text>
          <Text style={styles.alertText}>Coach: {coachAllotted}</Text>
          <Text style={styles.alertText}>Berth: 21</Text>
          <Text style={styles.alertText}>Reported: 10:15 AM</Text>
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonSecondary]}
            >
              <Text style={styles.actionButtonSecondaryText}>View details</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.actionButtonPrimary,
                styles.actionButtonSpacing,
              ]}
              onPress={handleStaffConfirm}
            >
              <Text style={styles.actionButtonPrimaryText}>Accept</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.cardBlock}>
          <Text style={styles.cardTitle}>Item Verification</Text>
          <View style={styles.optionList}>
            <Text style={styles.optionItem}>📸 Upload item photo</Text>
            <Text style={styles.optionItem}>✅ Mark item found</Text>
            <Text style={styles.optionItem}>❌ Mark not found</Text>
            <Text style={styles.optionItem}>
              🔁 Escalate to RPF (high-value)
            </Text>
          </View>
          <Text style={styles.helperText}>
            Auto GPS stamp + coach location captured on confirmation.
          </Text>
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonSecondary]}
            >
              <Text style={styles.actionButtonSecondaryText}>Upload photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.actionButtonPrimary,
                styles.actionButtonSpacing,
              ]}
            >
              <Text style={styles.actionButtonPrimaryText}>Mark found</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.cardBlock}>
          <Text style={styles.cardTitle}>Passenger Communication</Text>
          <View style={styles.messageRow}>
            <View style={styles.messageChip}>
              <Text style={styles.messageChipText}>"Item secured in S3"</Text>
            </View>
            <View style={styles.messageChip}>
              <Text style={styles.messageChipText}>
                "Collect at Trichy station"
              </Text>
            </View>
            <View style={styles.messageChip}>
              <Text style={styles.messageChipText}>"Bring ID proof"</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Send update</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.cardBlock}>
          <Text style={styles.cardTitle}>QR Handover</Text>
          <Text style={styles.cardText}>
            Generate and scan for custody log.
          </Text>
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonPrimary]}
            >
              <Text style={styles.actionButtonPrimaryText}>Generate QR</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.actionButtonSecondary,
                styles.actionButtonSpacing,
              ]}
            >
              <Text style={styles.actionButtonSecondaryText}>Scan QR</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.cardBlock}>
          <Text style={styles.cardTitle}>TTR Performance</Text>
          <View style={styles.metricGrid}>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>8</Text>
              <Text style={styles.metricLabel}>Cases handled</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>5</Text>
              <Text style={styles.metricLabel}>Items secured</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>2</Text>
              <Text style={styles.metricLabel}>Escalated</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>6m</Text>
              <Text style={styles.metricLabel}>Avg response</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderRpfDashboard = () => {
    const displayName = name.trim() || "Officer";
    const displayEmail = officialEmail.trim() || "Not set";
    const displayProfessionalId = professionalId.trim() || "RPF-CH-11456";
    const displayJurisdiction = jurisdiction.trim() || "Chennai Central Zone";

    return (
      <View>
        <View style={styles.authorityHeaderCard}>
          <View style={styles.authorityHeaderTop}>
            <View>
              <Text style={styles.authorityTitle}>{displayName}</Text>
              <Text style={styles.authoritySubtitle}>
                🛡 RPF - Railway Protection Force
              </Text>
            </View>
            <View style={styles.notificationBadge}>
              <Ionicons
                name="notifications"
                size={16}
                color="#1E40AF"
                style={styles.notificationIcon}
              />
              <Text style={styles.notificationText}>2</Text>
            </View>
          </View>
          <View style={styles.authorityMetaRow}>
            <View style={styles.metaPill}>
              <Text style={styles.metaPillText}>
                Badge {displayProfessionalId}
              </Text>
            </View>
            <View style={styles.metaPill}>
              <Text style={styles.metaPillText}>{displayJurisdiction}</Text>
            </View>
          </View>
          <View style={styles.dutyRow}>
            <Text style={styles.dutyLabel}>On Duty</Text>
            <TouchableOpacity
              style={[
                styles.dutyToggle,
                onDuty ? styles.dutyToggleActive : styles.dutyToggleInactive,
              ]}
              onPress={() => setOnDuty((prev) => !prev)}
            >
              <View
                style={[
                  styles.dutyKnob,
                  onDuty ? styles.dutyKnobActive : styles.dutyKnobInactive,
                ]}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{displayName}</Text>
              <Text style={styles.profileRole}>RPF Officer</Text>
            </View>
          </View>

          <View style={styles.profileDetails}>
            <View style={styles.profileDetailRow}>
              <Text style={styles.profileDetailLabel}>Badge ID:</Text>
              <Text style={styles.profileDetailValue}>
                {displayProfessionalId}
              </Text>
            </View>
            <View style={styles.profileDetailRow}>
              <Text style={styles.profileDetailLabel}>Official Email:</Text>
              <Text style={styles.profileDetailValue}>{displayEmail}</Text>
            </View>
            <View style={styles.profileDetailRow}>
              <Text style={styles.profileDetailLabel}>Assigned Zone:</Text>
              <Text style={styles.profileDetailValue}>
                {displayJurisdiction}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.alertCard}>
          <Text style={styles.alertTitle}>🚨 HIGH PRIORITY ALERT</Text>
          <Text style={styles.alertText}>Item: Laptop</Text>
          <Text style={styles.alertText}>Location: Train 12631 - S3</Text>
          <Text style={styles.alertText}>Escalated by: TTR</Text>
          <Text style={styles.alertText}>Reason: Possible theft</Text>
          <Text style={styles.alertText}>Reported: 10:30 AM</Text>
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonPrimary]}
            >
              <Text style={styles.actionButtonPrimaryText}>Investigate</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.actionButtonSecondary,
                styles.actionButtonSpacing,
              ]}
            >
              <Text style={styles.actionButtonSecondaryText}>
                Contact passenger
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.cardBlock}>
          <Text style={styles.cardTitle}>Investigation Screen</Text>
          <View style={styles.optionList}>
            <Text style={styles.optionItem}>🗺 View coach map</Text>
            <Text style={styles.optionItem}>📞 Contact TTR</Text>
            <Text style={styles.optionItem}>👥 Contact passenger</Text>
            <Text style={styles.optionItem}>📝 Record statement</Text>
            <Text style={styles.optionItem}>📸 Upload evidence photo</Text>
          </View>
        </View>

        <View style={styles.cardBlock}>
          <Text style={styles.cardTitle}>Secure Custody Module</Text>
          <Text style={styles.cardText}>If item recovered:</Text>
          <View style={styles.optionList}>
            <Text style={styles.optionItem}>• Log station and GPS</Text>
            <Text style={styles.optionItem}>• Upload recovery proof</Text>
            <Text style={styles.optionItem}>• Assign case ID</Text>
            <Text style={styles.optionItem}>
              • Transfer to police if needed
            </Text>
          </View>
          <TouchableOpacity style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Create custody log</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.cardBlock}>
          <Text style={styles.cardTitle}>Case Monitoring</Text>
          <View style={styles.metricGrid}>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>6</Text>
              <Text style={styles.metricLabel}>Active investigations</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>12</Text>
              <Text style={styles.metricLabel}>Closed cases</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>4</Text>
              <Text style={styles.metricLabel}>Escalations today</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>9m</Text>
              <Text style={styles.metricLabel}>Avg response</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderPoliceDashboard = () => {
    const displayName = name.trim() || "Officer";
    const displayEmail = officialEmail.trim() || "Not set";
    const displayProfessionalId = professionalId.trim() || "Not set";
    const displayRole = specificRole || "Police";
    const displayJurisdiction = jurisdiction.trim() || "Trichy";
    const displayStation = "Trichy Junction";

    return (
      <View>
        <View style={styles.authorityHeaderCard}>
          <View style={styles.authorityHeaderTop}>
            <View>
              <Text style={styles.authorityTitle}>{displayName}</Text>
              <Text style={styles.authoritySubtitle}>👮 Police</Text>
            </View>
            <View style={styles.notificationBadge}>
              <Ionicons
                name="alert-circle"
                size={16}
                color="#B91C1C"
                style={styles.notificationIcon}
              />
              <Text style={styles.notificationText}>1</Text>
            </View>
          </View>
          <View style={styles.authorityMetaRow}>
            <View style={styles.metaPill}>
              <Text style={styles.metaPillText}>{displayStation}</Text>
            </View>
            <View style={styles.metaPill}>
              <Text style={styles.metaPillText}>{displayJurisdiction}</Text>
            </View>
            <View style={styles.metaPill}>
              <Text style={styles.metaPillText}>
                Duty {onDuty ? "ON" : "OFF"}
              </Text>
            </View>
          </View>
          <View style={styles.dutyRow}>
            <Text style={styles.dutyLabel}>Duty Status</Text>
            <TouchableOpacity
              style={[
                styles.dutyToggle,
                onDuty ? styles.dutyToggleActive : styles.dutyToggleInactive,
              ]}
              onPress={() => setOnDuty((prev) => !prev)}
            >
              <View
                style={[
                  styles.dutyKnob,
                  onDuty ? styles.dutyKnobActive : styles.dutyKnobInactive,
                ]}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{displayName}</Text>
              <Text style={styles.profileRole}>{displayRole} Officer</Text>
            </View>
          </View>

          <View style={styles.profileDetails}>
            <View style={styles.profileDetailRow}>
              <Text style={styles.profileDetailLabel}>Professional ID:</Text>
              <Text style={styles.profileDetailValue}>
                {displayProfessionalId}
              </Text>
            </View>
            <View style={styles.profileDetailRow}>
              <Text style={styles.profileDetailLabel}>Station:</Text>
              <Text style={styles.profileDetailValue}>{displayStation}</Text>
            </View>
            <View style={styles.profileDetailRow}>
              <Text style={styles.profileDetailLabel}>Jurisdiction:</Text>
              <Text style={styles.profileDetailValue}>
                {displayJurisdiction}
              </Text>
            </View>
            <View style={styles.profileDetailRow}>
              <Text style={styles.profileDetailLabel}>Official Email:</Text>
              <Text style={styles.profileDetailValue}>{displayEmail}</Text>
            </View>
          </View>
        </View>

        <View style={styles.alertCard}>
          <Text style={styles.alertTitle}>🚨 LEGAL CASE ALERT</Text>
          <Text style={styles.alertText}>Item: Passport</Text>
          <Text style={styles.alertText}>Train: 12631</Text>
          <Text style={styles.alertText}>Station: Trichy</Text>
          <Text style={styles.alertText}>Escalated by: RPF</Text>
          <Text style={styles.alertText}>Case ID: SG-2026-108</Text>
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonPrimary]}
            >
              <Text style={styles.actionButtonPrimaryText}>Open case</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.actionButtonSecondary,
                styles.actionButtonSpacing,
              ]}
            >
              <Text style={styles.actionButtonSecondaryText}>Contact RPF</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.cardBlock}>
          <Text style={styles.cardTitle}>Case Management</Text>
          <View style={styles.optionList}>
            <Text style={styles.optionItem}>Case ID: SG-2026-108</Text>
            <Text style={styles.optionItem}>Passenger: Ramya V</Text>
            <Text style={styles.optionItem}>Aadhaar verified</Text>
            <Text style={styles.optionItem}>Evidence uploaded</Text>
            <Text style={styles.optionItem}>Investigation notes ready</Text>
          </View>
          <TouchableOpacity style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>FIR (Optional)</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.cardBlock}>
          <Text style={styles.cardTitle}>Inter-Jurisdiction Transfer</Text>
          <Text style={styles.cardText}>
            Forward to nearest police station for passenger city.
          </Text>
          <View style={styles.optionList}>
            <Text style={styles.optionItem}>• Digital case transfer</Text>
            <Text style={styles.optionItem}>• Status update to passenger</Text>
          </View>
          <TouchableOpacity style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Start transfer</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.cardBlock}>
          <Text style={styles.cardTitle}>Secure Handover Logging</Text>
          <View style={styles.optionList}>
            <Text style={styles.optionItem}>Verify passenger ID</Text>
            <Text style={styles.optionItem}>Capture signature</Text>
            <Text style={styles.optionItem}>GPS log</Text>
            <Text style={styles.optionItem}>Close legal case</Text>
          </View>
        </View>

        <View style={styles.cardBlock}>
          <Text style={styles.cardTitle}>Police Analytics</Text>
          <View style={styles.metricGrid}>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>3</Text>
              <Text style={styles.metricLabel}>Legal cases today</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>12</Text>
              <Text style={styles.metricLabel}>Resolved cases</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>5</Text>
              <Text style={styles.metricLabel}>Pending cases</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>2</Text>
              <Text style={styles.metricLabel}>Cross-district transfers</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderDashboard = () => {
    if (role === "Passenger") {
      const trimmedEmail = email.trim();
      const displayName =
        name.trim() ||
        (trimmedEmail ? trimmedEmail.split("@")[0] : "Passenger");
      const displayPhone = phone.trim() || "Not set";

      return (
        <PassengerDashboard
          userEmail={trimmedEmail}
          userName={displayName}
          userPhone={displayPhone}
          onLogout={handleLogout}
        />
      );
    }

    // Handle Cab/Auto Driver
    if (role === "Cab/Auto") {
      return <CarAutoDashboard onLogout={handleLogout} />;
    }

    // Handle Driver/Conductor
    if (role === "Driver/Conductor") {
      return <DriverConductorDashboard onLogout={handleLogout} />;
    }

    // Handle TTR/RPF/Police based on specific role selection
    if (role === "TTR/RPF/Police") {
      const sharedProps = {
        officerEmail: (officialEmail || email).trim(),
        professionalId: professionalId.trim(),
        staffName: name.trim(),
        specificRole: specificRole,
        onDuty,
        setOnDuty,
        onLogout: handleLogout,
      };

      if (specificRole === "TTE") {
        return <TteDashboard {...sharedProps} />;
      }

      if (specificRole === "RPF") {
        return <RpfDashboard {...sharedProps} />;
      }

      if (specificRole === "Police") {
        return <PoliceDashboard {...sharedProps} />;
      }

      return (
        <TtrDashboard
          {...sharedProps}
          roleLabel={specificRole ? `${specificRole} dashboard` : "TTR Dashboard"}
        />
      );
    }

    return renderStaffDashboard();
  };

  const usesInternalScroll =
    role === "Passenger" ||
    role === "Cab/Auto" ||
    role === "Driver/Conductor" ||
    role === "TTR/RPF/Police";
  const showStandaloneLogout = !usesInternalScroll && role !== "Passenger";

  const renderAuthenticatedContent = () => {
    if (usesInternalScroll) {
      return (
        <View style={styles.authenticatedContent}>{renderDashboard()}</View>
      );
    }

    return (
      <ScrollView contentContainerStyle={styles.authenticatedScrollContent}>
        {renderDashboard()}
        {showStandaloneLogout && (
          <TouchableOpacity
            style={[styles.secondaryButton, styles.logoutButtonFull]}
            onPress={handleLogout}
          >
            <Text style={styles.secondaryButtonText}>Log out</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    );
  };

  const insets = useSafeAreaInsets();

  return (
    <SafeAreaProvider>
      <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
        {isAuthenticated ? (
          <View style={styles.authenticatedContainer}>
            {renderAuthenticatedContent()}
          </View>
        ) : (
          <>
            <Animated.View
              style={[
                styles.backgroundGlow,
                {
                  opacity: bgDriftAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.25, 0.42],
                  }),
                  transform: [
                    {
                      translateY: bgDriftAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -14],
                      }),
                    },
                    {
                      scale: bgDriftAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.08],
                      }),
                    },
                  ],
                },
              ]}
            />
            <KeyboardAvoidingView
              style={styles.keyboardAvoidingView}
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
            >
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <ScrollView
                  contentContainerStyle={[
                    styles.scrollContent,
                    !keyboardVisible && styles.scrollContentCentered,
                  ]}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={true}
                  bounces={true}
                  nestedScrollEnabled={true}
                >
                  <Animated.View
                    style={[
                      styles.card,
                      {
                        transform: [
                          {
                            translateY: cardFloatAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, -8],
                            }),
                          },
                          {
                            scale: cardFloatAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [1, 1.006],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <View style={styles.brandRow}>
                      <Pressable
                        onHoverIn={startShieldShake}
                        onHoverOut={stopShieldShake}
                      >
                        <Animated.View
                          style={[
                            styles.shieldIconContainer,
                            {
                              opacity: titleFade,
                              transform: [
                                {
                                  rotate: shieldRotate.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: ['-5deg', '5deg'],
                                  }),
                                },
                                { translateX: shieldShake },
                              ],
                            },
                          ]}
                        >
                          <Ionicons
                            name="shield-checkmark"
                            size={48}
                            color="#2563EB"
                          />
                        </Animated.View>
                      </Pressable>
                      <View style={styles.brandTextContainer}>
                        <Animated.Text
                          style={[
                            styles.title,
                            {
                              opacity: titleFade,
                              transform: [
                                {
                                  translateY: titleFade.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [20, 0],
                                  }),
                                },
                              ],
                            },
                          ]}
                        >
                          SafeRide Guardian
                        </Animated.Text>
                        <Text style={styles.subtitle}>
                          AI-powered role-based recovery for buses, trains,
                          cabs, autos.
                        </Text>
                        <View style={styles.statusBadgeRow}>
                          <View
                            style={[
                              styles.statusBadge,
                              apiStatus === "online"
                                ? styles.statusBadgeOnline
                                : apiStatus === "offline"
                                  ? styles.statusBadgeOffline
                                  : styles.statusBadgeChecking,
                            ]}
                          >
                            <Text style={styles.statusBadgeText}>
                              {apiStatus === "online"
                                ? "Backend online"
                                : apiStatus === "offline"
                                  ? "Backend offline"
                                  : "Checking backend..."}
                            </Text>
                          </View>
                        </View>
                        {apiStatus === "offline" && apiError.length > 0 && (
                          <Text style={styles.apiErrorText}>{apiError}</Text>
                        )}
                      </View>
                    </View>
                    <View style={styles.divider} />

                    {showRoleSelection ? (
                      <Animated.View
                        style={{
                          opacity: formAnim,
                          transform: [
                            {
                              translateY: formAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [50, 0],
                              }),
                            },
                          ],
                        }}
                      >
                        <View style={styles.backButtonRow}>
                          <TouchableOpacity
                            style={styles.backButton}
                            onPress={() => {
                              setShowRoleSelection(false);
                              setSpecificRole("");
                              setError("");
                            }}
                          >
                            <Ionicons
                              name="arrow-back"
                              size={24}
                              color="#2563EB"
                            />
                          </TouchableOpacity>
                          <Text style={styles.formTitle}>
                            SafeRide Guardian
                          </Text>
                          <View style={{ width: 24 }} />
                        </View>
                        <Text style={styles.sectionTitle}>
                          Choose Your Authority
                        </Text>
                        <Text style={styles.sectionSubtitle}>
                          Select one role to continue into the duty dashboard.
                        </Text>

                        <View style={styles.authorityOptions}>
                          {[
                            {
                              key: "TTR",
                              title: "🎫 TTR – Train Ticket Examiner",
                              description:
                                "Responsible for onboard train verification.",
                            },
                            {
                              key: "TTE",
                              title: "🎫 TTE – Train Ticket Examiner",
                              description:
                                "Responsible for passenger verification and assistance.",
                            },
                            {
                              key: "RPF",
                              title: "🛡 RPF – Railway Protection Force",
                              description: "Responsible for railway security.",
                            },
                            {
                              key: "Police",
                              title: "👮 Police",
                              description:
                                "Responsible for legal & cross-jurisdiction cases.",
                            },
                          ].map((item) => (
                            <TouchableOpacity
                              key={item.key}
                              style={[
                                styles.authorityOption,
                                specificRole === item.key &&
                                  styles.authorityOptionActive,
                              ]}
                              onPress={() => setSpecificRole(item.key)}
                            >
                              <Text style={styles.authorityOptionTitle}>
                                {item.title}
                              </Text>
                              <Text style={styles.authorityOptionText}>
                                {item.description}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>

                        <View style={styles.selectionHints}>
                          <Text style={styles.helperText}>
                            Only one selectable.
                          </Text>
                          <Text style={styles.helperText}>
                            Continue enabled after selection.
                          </Text>
                        </View>

                        {error.length > 0 && (
                          <Text style={styles.errorText}>{error}</Text>
                        )}

                        <TouchableOpacity
                          style={[
                            styles.primaryButton,
                            !specificRole && styles.buttonDisabled,
                          ]}
                          onPress={handleSpecificRoleSelection}
                          disabled={!specificRole}
                        >
                          <Text style={styles.primaryButtonText}>Continue</Text>
                        </TouchableOpacity>
                      </Animated.View>
                    ) : (
                      <Animated.View
                        style={{
                          opacity: formAnim,
                          transform: [
                            {
                              translateY: formAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [50, 0],
                              }),
                            },
                          ],
                        }}
                      >
                        <Text style={styles.formTitle}>
                          {isRegister
                            ? "Create your account"
                            : "Sign in to continue"}
                        </Text>

                        <View style={styles.inputGroup}>
                          <Text style={styles.label}>{requiredLabel("Select role")}</Text>
                          {renderRoleSelector()}
                        </View>

                        {isRegister && (
                          <View style={styles.inputGroup}>
                            <Text style={styles.label}>{requiredLabel("Full name")}</Text>
                            <TextInput
                              style={styles.input}
                              placeholder="Enter your name"
                              placeholderTextColor="#94A3B8"
                              value={name}
                              onChangeText={setName}
                              autoCapitalize="words"
                            />
                          </View>
                        )}

                        {isRegister && (
                          <View style={styles.inputGroup}>
                            <Text style={styles.label}>{requiredLabel("Mobile number")}</Text>
                            <TextInput
                              style={styles.input}
                              placeholder="+91 98765 43210"
                              placeholderTextColor="#94A3B8"
                              value={phone}
                              onChangeText={setPhone}
                              keyboardType="phone-pad"
                            />
                          </View>
                        )}

                        {(!isOfficialRole || !isRegister) && (
                          <View style={styles.inputGroup}>
                            <AnimatedLabel text={requiredLabel("Email address")} iconName="mail" />
                            <TextInput
                              style={[
                                styles.input,
                                isRegister &&
                                  isVerified &&
                                  styles.inputDisabled,
                              ]}
                              placeholder="you@example.com"
                              placeholderTextColor="#94A3B8"
                              value={email}
                              onChangeText={setEmail}
                              autoCapitalize="none"
                              keyboardType="email-address"
                              editable={!(isRegister && isVerified)}
                            />
                          </View>
                        )}

                        {isOfficialRole && !forgotPasswordMode && (
                          <View style={styles.inputGroup}>
                            <Text style={styles.label}>{requiredLabel("Professional ID")}</Text>
                            <TextInput
                              style={styles.input}
                              placeholder={
                                role === "Police"
                                  ? "TNPolice-45678"
                                  : "TTR-SR-12345"
                              }
                              placeholderTextColor="#94A3B8"
                              value={professionalId}
                              onChangeText={setProfessionalId}
                              autoCapitalize="characters"
                            />
                          </View>
                        )}

                        {isRegister && isOfficialRole && (
                          <View style={styles.inputGroup}>
                            <Text style={styles.label}>{requiredLabel("Official email")}</Text>
                            <TextInput
                              style={[
                                styles.input,
                                isVerified && styles.inputDisabled,
                              ]}
                              placeholder={`name@${getOfficialDomain(role)}`}
                              placeholderTextColor="#94A3B8"
                              value={officialEmail}
                              onChangeText={setOfficialEmail}
                              autoCapitalize="none"
                              keyboardType="email-address"
                              editable={!isVerified}
                            />
                            <Text style={styles.helperText}>
                              Use your {getOfficialDomain(role)} mailbox for
                              approval.
                            </Text>
                          </View>
                        )}

                        {showPasswordInput && (
                            <View style={styles.inputGroup}>
                              <AnimatedLabel text={requiredLabel("Password")} iconName="lock-closed" />
                              <View style={styles.passwordRow}>
                                <TextInput
                                  style={[styles.input, styles.passwordInput]}
                                  placeholder="Enter your password"
                                  placeholderTextColor="#94A3B8"
                                  value={password}
                                  onChangeText={setPassword}
                                  secureTextEntry={!showPassword}
                                />
                                <TouchableOpacity
                                  style={styles.eyeButton}
                                  onPress={() =>
                                    setShowPassword((prev) => !prev)
                                  }
                                  accessibilityLabel={
                                    showPassword
                                      ? "Hide password"
                                      : "Show password"
                                  }
                                >
                                  <Ionicons
                                    name={showPassword ? "eye-off" : "eye"}
                                    size={20}
                                    color="#64748B"
                                  />
                                </TouchableOpacity>
                              </View>
                              {isRegister && !isPasswordStrong && (
                                <PasswordVerification
                                  checks={passwordChecks}
                                  metCount={metPasswordChecks}
                                />
                              )}
                            </View>
                          )}

                        {isRegister && (
                          <View style={styles.inputGroup}>
                            <Text style={styles.label}>{requiredLabel("Confirm password")}</Text>
                            <View style={styles.passwordRow}>
                              <TextInput
                                style={[styles.input, styles.passwordInput]}
                                placeholder="Re-enter your password"
                                placeholderTextColor="#94A3B8"
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                secureTextEntry={!showConfirmPassword}
                              />
                              <TouchableOpacity
                                style={styles.eyeButton}
                                onPress={() =>
                                  setShowConfirmPassword((prev) => !prev)
                                }
                                accessibilityLabel={
                                  showConfirmPassword
                                    ? "Hide confirm password"
                                    : "Show confirm password"
                                }
                              >
                                <Ionicons
                                  name={showConfirmPassword ? "eye-off" : "eye"}
                                  size={20}
                                  color="#64748B"
                                />
                              </TouchableOpacity>
                            </View>
                            {confirmPassword.length > 0 && (
                              <Text
                                style={[
                                  styles.confirmPasswordText,
                                  isRegisterPasswordMatch
                                    ? styles.confirmPasswordTextMatch
                                    : styles.confirmPasswordTextNoMatch,
                                ]}
                              >
                                {isRegisterPasswordMatch
                                  ? "✓ Passwords match"
                                  : "○ Passwords do not match"}
                              </Text>
                            )}
                          </View>
                        )}

                        {!isRegister && !isOfficialRole && !isPostLoginOtpStep && (
                          <View style={styles.otpToggleRow}>
                            <Text style={styles.helperText}>
                              {loginWithOtp
                                ? "Signing in with OTP"
                                : "Use OTP instead of password"}
                            </Text>
                            <View style={styles.otpToggleActions}>
                              <TouchableOpacity
                                onPress={() => {
                                  if (loginWithOtp) {
                                    setLoginWithOtp(false);
                                    setEmailOtp("");
                                    setIsVerified(false);
                                    setIsOtpSent(false);
                                  } else {
                                    setLoginWithOtp(true);
                                    setForgotPasswordMode(false);
                                    setResetCode("");
                                    setIsResetCodeSent(false);
                                    setError("");
                                  }
                                }}
                              >
                                <Text style={styles.switchLink}>
                                  {loginWithOtp
                                    ? "Use password"
                                    : "Sign in with OTP"}
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => {
                                  setForgotPasswordMode(true);
                                  setLoginWithOtp(false);
                                  setIsOtpSent(false);
                                  setEmailOtp("");
                                  setIsVerified(false);
                                  setIsResetCodeSent(false);
                                  setResetCode("");
                                  setError("");
                                }}
                              >
                                <Text style={styles.switchLink}>
                                  Reset password
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        )}

                        {!isRegister &&
                          isOfficialRole &&
                          !forgotPasswordMode && (
                            <View style={styles.otpToggleRow}>
                              <Text style={styles.helperText}>
                                Forgot password?
                              </Text>
                              <TouchableOpacity
                                onPress={() => {
                                  setForgotPasswordMode(true);
                                  setIsResetCodeSent(false);
                                  setResetCode("");
                                  setError("");
                                }}
                              >
                                <Text style={styles.switchLink}>
                                  Reset password
                                </Text>
                              </TouchableOpacity>
                            </View>
                          )}

                        {!isRegister &&
                          isOfficialRole &&
                          forgotPasswordMode && (
                            <View style={styles.verifyCard}>
                              <View style={styles.backButtonRow}>
                                <TouchableOpacity
                                  style={styles.backButton}
                                  onPress={() => {
                                    setForgotPasswordMode(false);
                                    setResetCode("");
                                    setNewPassword("");
                                    setConfirmNewPassword("");
                                    setIsResetCodeSent(false);
                                    setResetSuccess(false);
                                    setOfficialEmail("");
                                    setProfessionalId("");
                                    setError("");
                                  }}
                                >
                                  <Ionicons
                                    name="arrow-back"
                                    size={24}
                                    color="#2563EB"
                                  />
                                </TouchableOpacity>
                                <Text style={styles.cardTitle}>
                                  Reset Password
                                </Text>
                                <View style={{ width: 24 }} />
                              </View>
                              <Text style={styles.sectionSubtitle}>
                                We'll send a verification code to your
                                registered official email
                              </Text>

                              {!isResetCodeSent ? (
                                <>
                                  <View style={styles.inputGroup}>
                                    <Text style={styles.label}>
                                      {requiredLabel("Professional ID")}
                                    </Text>
                                    <TextInput
                                      style={styles.input}
                                      placeholder={
                                        role === "Police"
                                          ? "TNPolice-45678"
                                          : "TTR-SR-12345"
                                      }
                                      placeholderTextColor="#94A3B8"
                                      value={professionalId}
                                      onChangeText={setProfessionalId}
                                      autoCapitalize="characters"
                                    />
                                  </View>
                                  <View style={styles.inputGroup}>
                                    <Text style={styles.label}>
                                      {requiredLabel("Official Email")}
                                    </Text>
                                    <TextInput
                                      style={styles.input}
                                      placeholder={`name@${getOfficialDomain(role)}`}
                                      placeholderTextColor="#94A3B8"
                                      value={officialEmail}
                                      onChangeText={setOfficialEmail}
                                      autoCapitalize="none"
                                      keyboardType="email-address"
                                    />
                                    <Text style={styles.helperText}>
                                      Enter your registered{" "}
                                      {getOfficialDomain(role)} email
                                    </Text>
                                  </View>
                                  <TouchableOpacity
                                    style={[
                                      styles.primaryButton,
                                      (professionalId.trim().length < 6 ||
                                        officialEmail.trim().length < 5 ||
                                        isSendingResetCode) &&
                                        styles.buttonDisabled,
                                    ]}
                                    onPress={handleSendResetCode}
                                    disabled={
                                      professionalId.trim().length < 6 ||
                                      officialEmail.trim().length < 5 ||
                                      isSendingResetCode
                                    }
                                  >
                                    <Text style={styles.primaryButtonText}>
                                      {isSendingResetCode
                                        ? "Sending reset code..."
                                        : "Send reset code"}
                                    </Text>
                                  </TouchableOpacity>
                                </>
                              ) : resetSuccess ? (
                                <View style={styles.successCard}>
                                  <Text style={styles.successText}>
                                    ✅ Password reset successful!
                                  </Text>
                                  <Text style={styles.cardText}>
                                    You can now login with your new password.
                                  </Text>
                                </View>
                              ) : (
                                <>
                                  {!isResetCodeVerified ? (
                                    <>
                                      <View style={styles.inputGroup}>
                                        <Text style={styles.label}>
                                          {requiredLabel("Reset Code")}
                                        </Text>
                                        <TextInput
                                          style={styles.input}
                                          placeholder="Enter 6-digit reset code"
                                          placeholderTextColor="#94A3B8"
                                          value={resetCode}
                                          onChangeText={setResetCode}
                                          keyboardType="number-pad"
                                          maxLength={6}
                                        />
                                        <Text style={styles.helperText}>
                                          Check your email for the 6-digit code
                                        </Text>
                                      </View>
                                      <TouchableOpacity
                                        style={[
                                          styles.primaryButton,
                                          (resetCode.trim().length !== 6 ||
                                            isVerifyingResetCode) &&
                                            styles.buttonDisabled,
                                        ]}
                                        onPress={handleVerifyResetCode}
                                        disabled={
                                          resetCode.trim().length !== 6 ||
                                          isVerifyingResetCode
                                        }
                                      >
                                        <Text style={styles.primaryButtonText}>
                                          {isVerifyingResetCode
                                            ? "Verifying code..."
                                            : "Verify Code"}
                                        </Text>
                                      </TouchableOpacity>
                                      <TouchableOpacity
                                        style={[
                                          styles.textButton,
                                          (resetResendCountdown > 0 ||
                                            isSendingResetCode) &&
                                            styles.buttonDisabled,
                                        ]}
                                        onPress={handleResendResetCode}
                                        disabled={
                                          resetResendCountdown > 0 ||
                                          isSendingResetCode
                                        }
                                      >
                                        <Text style={styles.switchLink}>
                                          {isSendingResetCode
                                            ? "Sending code..."
                                            : resetResendCountdown > 0
                                              ? `Resend code (${resetResendCountdown}s)`
                                              : "Resend code"}
                                        </Text>
                                      </TouchableOpacity>
                                    </>
                                  ) : (
                                    <>
                                      <Text style={styles.sectionSubtitle}>
                                        Code verified! Now set your new password
                                      </Text>
                                      <View style={styles.inputGroup}>
                                        <Text style={styles.label}>
                                          {requiredLabel("New Password")}
                                        </Text>
                                        <View style={styles.passwordRow}>
                                          <TextInput
                                            style={[
                                              styles.input,
                                              styles.passwordInput,
                                            ]}
                                            placeholder="Enter new password"
                                            placeholderTextColor="#94A3B8"
                                            value={newPassword}
                                            onChangeText={setNewPassword}
                                            secureTextEntry={!showNewPassword}
                                          />
                                          <TouchableOpacity
                                            style={styles.eyeButton}
                                            onPress={() =>
                                              setShowNewPassword((prev) => !prev)
                                            }
                                          >
                                            <Ionicons
                                              name={
                                                showNewPassword
                                                  ? "eye-off"
                                                  : "eye"
                                              }
                                              size={20}
                                              color="#64748B"
                                            />
                                          </TouchableOpacity>
                                        </View>
                                      </View>
                                      <View style={styles.inputGroup}>
                                        <Text style={styles.label}>
                                          {requiredLabel("Confirm New Password")}
                                        </Text>
                                        <View style={styles.passwordRow}>
                                          <TextInput
                                            style={[
                                              styles.input,
                                              styles.passwordInput,
                                            ]}
                                            placeholder="Re-enter new password"
                                            placeholderTextColor="#94A3B8"
                                            value={confirmNewPassword}
                                            onChangeText={
                                              setConfirmNewPassword
                                            }
                                            secureTextEntry={
                                              !showConfirmNewPassword
                                            }
                                          />
                                          <TouchableOpacity
                                            style={styles.eyeButton}
                                            onPress={() =>
                                              setShowConfirmNewPassword(
                                                (prev) => !prev,
                                              )
                                            }
                                          >
                                            <Ionicons
                                              name={
                                                showConfirmNewPassword
                                                  ? "eye-off"
                                                  : "eye"
                                              }
                                              size={20}
                                              color="#64748B"
                                            />
                                          </TouchableOpacity>
                                        </View>
                                      </View>
                                      {!isNewPasswordStrong && (
                                        <PasswordVerification
                                          checks={newPasswordChecks}
                                          metCount={metNewPasswordChecks}
                                        />
                                      )}
                                      {confirmNewPassword.length > 0 && (
                                        <Text
                                          style={[
                                            styles.confirmPasswordText,
                                            isResetPasswordMatch
                                              ? styles.confirmPasswordTextMatch
                                              : styles.confirmPasswordTextNoMatch,
                                          ]}
                                        >
                                          {isResetPasswordMatch
                                            ? "✓ Passwords match"
                                            : "○ Passwords do not match"}
                                        </Text>
                                      )}
                                      <TouchableOpacity
                                        style={[
                                          styles.primaryButton,
                                          (!isNewPasswordStrong ||
                                            !isResetPasswordMatch ||
                                            confirmNewPassword.trim().length <
                                              PASSWORD_MIN_LENGTH) &&
                                            styles.buttonDisabled,
                                        ]}
                                        onPress={handleResetPassword}
                                        disabled={
                                          !isNewPasswordStrong ||
                                          !isResetPasswordMatch ||
                                          confirmNewPassword.trim().length <
                                            PASSWORD_MIN_LENGTH
                                        }
                                      >
                                        <Text style={styles.primaryButtonText}>
                                          Reset Password
                                        </Text>
                                      </TouchableOpacity>
                                      <TouchableOpacity
                                        style={[styles.textButton]}
                                        onPress={() => {
                                          setIsResetCodeVerified(false);
                                          setResetCode("");
                                          setNewPassword("");
                                          setConfirmNewPassword("");
                                          setError("");
                                        }}
                                      >
                                        <Text style={styles.switchLink}>
                                          Use different code
                                        </Text>
                                      </TouchableOpacity>
                                    </>
                                  )}
                                </>
                              )}
                            </View>
                          )}

                        {!isRegister &&
                          !isOfficialRole &&
                          forgotPasswordMode && (
                            <View style={styles.verifyCard}>
                              <View style={styles.backButtonRow}>
                                <TouchableOpacity
                                  style={styles.backButton}
                                  onPress={() => {
                                    setForgotPasswordMode(false);
                                    setResetCode("");
                                    setNewPassword("");
                                    setConfirmNewPassword("");
                                    setIsResetCodeSent(false);
                                    setResetSuccess(false);
                                    setEmail("");
                                    setError("");
                                  }}
                                >
                                  <Ionicons
                                    name="arrow-back"
                                    size={24}
                                    color="#2563EB"
                                  />
                                </TouchableOpacity>
                                <Text style={styles.cardTitle}>
                                  Reset Password
                                </Text>
                                <View style={{ width: 24 }} />
                              </View>
                              <Text style={styles.sectionSubtitle}>
                                We'll send a verification code to your
                                registered email
                              </Text>

                              {!isResetCodeSent ? (
                                <>
                                  <View style={styles.inputGroup}>
                                    <Text style={styles.label}>{requiredLabel("Email")}</Text>
                                    <TextInput
                                      style={styles.input}
                                      placeholder="Enter your email"
                                      placeholderTextColor="#94A3B8"
                                      value={email}
                                      onChangeText={setEmail}
                                      autoCapitalize="none"
                                      keyboardType="email-address"
                                    />
                                    <Text style={styles.helperText}>
                                      Enter your registered email address
                                    </Text>
                                  </View>
                                  <TouchableOpacity
                                    style={[
                                      styles.primaryButton,
                                      (email.trim().length < 5 ||
                                        isSendingResetCode) &&
                                        styles.buttonDisabled,
                                    ]}
                                    onPress={handleSendResetCodeUser}
                                    disabled={
                                      email.trim().length < 5 ||
                                      isSendingResetCode
                                    }
                                  >
                                    <Text style={styles.primaryButtonText}>
                                      {isSendingResetCode
                                        ? "Sending verification code..."
                                        : "Send verification code"}
                                    </Text>
                                  </TouchableOpacity>
                                </>
                              ) : resetSuccess ? (
                                <View style={styles.successCard}>
                                  <Text style={styles.successText}>
                                    ✅ Password reset successful!
                                  </Text>
                                  <Text style={styles.cardText}>
                                    You can now login with your new password.
                                  </Text>
                                </View>
                              ) : (
                                <>
                                  {!isResetCodeVerified ? (
                                    <>
                                      <View style={styles.inputGroup}>
                                        <Text style={styles.label}>
                                          {requiredLabel("Verification Code")}
                                        </Text>
                                        <TextInput
                                          style={styles.input}
                                          placeholder="Enter 6-digit code"
                                          placeholderTextColor="#94A3B8"
                                          value={resetCode}
                                          onChangeText={setResetCode}
                                          keyboardType="number-pad"
                                          maxLength={6}
                                        />
                                        <Text style={styles.helperText}>
                                          Check your email for the 6-digit code
                                        </Text>
                                      </View>
                                      <TouchableOpacity
                                        style={[
                                          styles.primaryButton,
                                          (resetCode.trim().length !== 6 ||
                                            isVerifyingResetCode) &&
                                            styles.buttonDisabled,
                                        ]}
                                        onPress={handleVerifyResetCodeUser}
                                        disabled={
                                          resetCode.trim().length !== 6 ||
                                          isVerifyingResetCode
                                        }
                                      >
                                        <Text style={styles.primaryButtonText}>
                                          {isVerifyingResetCode
                                            ? "Verifying code..."
                                            : "Verify Code"}
                                        </Text>
                                      </TouchableOpacity>
                                      <TouchableOpacity
                                        style={[
                                          styles.textButton,
                                          (resetResendCountdown > 0 ||
                                            isSendingResetCode) &&
                                            styles.buttonDisabled,
                                        ]}
                                        onPress={handleResendResetCodeUser}
                                        disabled={
                                          resetResendCountdown > 0 ||
                                          isSendingResetCode
                                        }
                                      >
                                        <Text style={styles.switchLink}>
                                          {isSendingResetCode
                                            ? "Sending code..."
                                            : resetResendCountdown > 0
                                              ? `Resend code (${resetResendCountdown}s)`
                                              : "Resend code"}
                                        </Text>
                                      </TouchableOpacity>
                                    </>
                                  ) : (
                                    <>
                                      <Text style={styles.sectionSubtitle}>
                                        Code verified! Now set your new password
                                      </Text>
                                      <View style={styles.inputGroup}>
                                        <Text style={styles.label}>
                                          {requiredLabel("New Password")}
                                        </Text>
                                        <View style={styles.passwordRow}>
                                          <TextInput
                                            style={[
                                              styles.input,
                                              styles.passwordInput,
                                            ]}
                                            placeholder="Enter new password"
                                            placeholderTextColor="#94A3B8"
                                            value={newPassword}
                                            onChangeText={setNewPassword}
                                            secureTextEntry={!showNewPassword}
                                          />
                                          <TouchableOpacity
                                            style={styles.eyeButton}
                                            onPress={() =>
                                              setShowNewPassword((prev) => !prev)
                                            }
                                          >
                                            <Ionicons
                                              name={
                                                showNewPassword
                                                  ? "eye-off"
                                                  : "eye"
                                              }
                                              size={20}
                                              color="#64748B"
                                            />
                                          </TouchableOpacity>
                                        </View>
                                      </View>
                                      <View style={styles.inputGroup}>
                                        <Text style={styles.label}>
                                          {requiredLabel("Confirm New Password")}
                                        </Text>
                                        <View style={styles.passwordRow}>
                                          <TextInput
                                            style={[
                                              styles.input,
                                              styles.passwordInput,
                                            ]}
                                            placeholder="Re-enter new password"
                                            placeholderTextColor="#94A3B8"
                                            value={confirmNewPassword}
                                            onChangeText={
                                              setConfirmNewPassword
                                            }
                                            secureTextEntry={
                                              !showConfirmNewPassword
                                            }
                                          />
                                          <TouchableOpacity
                                            style={styles.eyeButton}
                                            onPress={() =>
                                              setShowConfirmNewPassword(
                                                (prev) => !prev,
                                              )
                                            }
                                          >
                                            <Ionicons
                                              name={
                                                showConfirmNewPassword
                                                  ? "eye-off"
                                                  : "eye"
                                              }
                                              size={20}
                                              color="#64748B"
                                            />
                                          </TouchableOpacity>
                                        </View>
                                      </View>
                                      {!isNewPasswordStrong && (
                                        <PasswordVerification
                                          checks={newPasswordChecks}
                                          metCount={metNewPasswordChecks}
                                        />
                                      )}
                                      {confirmNewPassword.length > 0 && (
                                        <Text
                                          style={[
                                            styles.confirmPasswordText,
                                            isResetPasswordMatch
                                              ? styles.confirmPasswordTextMatch
                                              : styles.confirmPasswordTextNoMatch,
                                          ]}
                                        >
                                          {isResetPasswordMatch
                                            ? "✓ Passwords match"
                                            : "○ Passwords do not match"}
                                        </Text>
                                      )}
                                      <TouchableOpacity
                                        style={[
                                          styles.primaryButton,
                                          (!isNewPasswordStrong ||
                                            !isResetPasswordMatch ||
                                            confirmNewPassword.trim().length <
                                              PASSWORD_MIN_LENGTH) &&
                                            styles.buttonDisabled,
                                        ]}
                                        onPress={handleResetPasswordUser}
                                        disabled={
                                          !isNewPasswordStrong ||
                                          !isResetPasswordMatch ||
                                          confirmNewPassword.trim().length <
                                            PASSWORD_MIN_LENGTH
                                        }
                                      >
                                        <Text style={styles.primaryButtonText}>
                                          Reset Password
                                        </Text>
                                      </TouchableOpacity>
                                      <TouchableOpacity
                                        style={[styles.textButton]}
                                        onPress={() => {
                                          setIsResetCodeVerified(false);
                                          setResetCode("");
                                          setNewPassword("");
                                          setConfirmNewPassword("");
                                          setError("");
                                        }}
                                      >
                                        <Text style={styles.switchLink}>
                                          Use different code
                                        </Text>
                                      </TouchableOpacity>
                                    </>
                                  )}
                                </>
                              )}
                            </View>
                          )}

                        {isOtpContext && (
                          <View style={styles.verifyCard}>
                            <Text style={styles.cardTitle}>
                              {isRegister
                                ? "Email verification"
                                : isPostLoginOtpStep
                                  ? "Login verification"
                                  : "OTP sign-in"}
                            </Text>
                            <Text style={styles.sectionSubtitle}>
                              {isRegister
                                ? "We'll send a verification code to your email address"
                                : isPostLoginOtpStep
                                  ? "A one-time code was sent to your email. Verify to complete login."
                                  : "We'll send a one-time code to your email"}
                            </Text>
                            {!isOtpSent ? (
                              <TouchableOpacity
                                style={[
                                  styles.primaryButton,
                                  (otpEmail.trim().length < 5 ||
                                    isSendingOtp) &&
                                    styles.buttonDisabled,
                                ]}
                                onPress={handleSendOtp}
                                disabled={
                                  otpEmail.trim().length < 5 || isSendingOtp
                                }
                                activeOpacity={0.9}
                              >
                                <Text style={styles.primaryButtonText}>
                                  {isSendingOtp
                                    ? "Sending verification code..."
                                    : "Send verification code"}
                                </Text>
                              </TouchableOpacity>
                            ) : (
                              <>
                                <View style={styles.inputGroup}>
                                  <Text style={styles.label}>
                                    {requiredLabel("Verification code")}
                                  </Text>
                                  <TextInput
                                    style={[
                                      styles.input,
                                      isVerified && styles.inputDisabled,
                                    ]}
                                    placeholder="Enter 6-digit code"
                                    placeholderTextColor="#94A3B8"
                                    value={emailOtp}
                                    onChangeText={setEmailOtp}
                                    keyboardType="number-pad"
                                    maxLength={6}
                                    editable={!isVerified}
                                  />
                                </View>
                                <TouchableOpacity
                                  style={[
                                    styles.secondaryButton,
                                    !canVerify && styles.buttonDisabled,
                                  ]}
                                  onPress={handleVerify}
                                  disabled={!canVerify}
                                >
                                  <Text style={styles.secondaryButtonText}>
                                    {isVerified
                                      ? "Verified ✅"
                                      : "Verify email"}
                                  </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[
                                    styles.textButton,
                                    otpResendCountdown > 0 &&
                                      styles.buttonDisabled,
                                  ]}
                                  onPress={handleSendOtp}
                                  activeOpacity={0.85}
                                  disabled={otpResendCountdown > 0}
                                >
                                  {!isVerified && (
                                    <Text style={styles.switchLink}>
                                      {otpResendCountdown > 0
                                        ? `Resend code (${otpResendCountdown}s)`
                                        : "Resend code"}
                                    </Text>
                                  )}
                                </TouchableOpacity>
                              </>
                            )}
                          </View>
                        )}

                        {isRegister &&
                          role === "Passenger" &&
                          isOtpSent &&
                          isVerified && (
                            <View style={styles.cardBlock}>
                              <Text style={styles.cardTitle}>
                                Passenger travel details
                              </Text>
                              <View style={styles.inputGroup}>
                                <Text style={styles.label}>{requiredLabel("Travel mode")}</Text>
                                <View style={styles.roleRow}>
                                  {["Bus", "Train"].map((item) => (
                                    <TouchableOpacity
                                      key={item}
                                      style={[
                                        styles.roleChip,
                                        travelType === item &&
                                          styles.roleChipActive,
                                      ]}
                                      onPress={() => setTravelType(item)}
                                    >
                                      <Text
                                        style={[
                                          styles.roleChipText,
                                          travelType === item &&
                                            styles.roleChipTextActive,
                                        ]}
                                      >
                                        {item}
                                      </Text>
                                    </TouchableOpacity>
                                  ))}
                                </View>
                              </View>
                              <View style={styles.inputGroup}>
                                <Text style={styles.label}>
                                  {requiredLabel(
                                    `${travelType === "Bus" ? "Bus" : "Train"} number`,
                                  )}
                                </Text>
                                <TextInput
                                  style={styles.input}
                                  placeholder="TN-01-AB-1234"
                                  placeholderTextColor="#94A3B8"
                                  value={travelNumber}
                                  onChangeText={setTravelNumber}
                                />
                              </View>
                              <View style={styles.inputGroup}>
                                <Text style={styles.label}>
                                  {travelType === "Bus"
                                    ? "Bus name (optional)"
                                    : requiredLabel("Train name")}
                                </Text>
                                <TextInput
                                  style={styles.input}
                                  placeholder="MTC 27B / MS-EXP-204"
                                  placeholderTextColor="#94A3B8"
                                  value={travelName}
                                  onChangeText={setTravelName}
                                />
                              </View>
                              {travelType === "Bus" ? (
                                <>
                                  <View style={styles.inputGroup}>
                                    <Text style={styles.label}>
                                      {requiredLabel("Departure stop")}
                                    </Text>
                                    <TextInput
                                      style={styles.input}
                                      placeholder="Velachery"
                                      placeholderTextColor="#94A3B8"
                                      value={busDeparture}
                                      onChangeText={setBusDeparture}
                                    />
                                  </View>
                                  <View style={styles.inputGroup}>
                                    <Text style={styles.label}>
                                      {requiredLabel("Arrival stop")}
                                    </Text>
                                    <TextInput
                                      style={styles.input}
                                      placeholder="CMBT"
                                      placeholderTextColor="#94A3B8"
                                      value={busArrival}
                                      onChangeText={setBusArrival}
                                    />
                                  </View>
                                  <View style={styles.inputGroup}>
                                    <Text style={styles.label}>
                                      {requiredLabel("Bus start timing")}
                                    </Text>
                                    <View style={styles.timeFieldRow}>
                                      <TextInput
                                        style={[styles.input, styles.timeInput]}
                                        placeholder="09:30"
                                        placeholderTextColor="#94A3B8"
                                        value={busStartTime}
                                        onChangeText={setBusStartTime}
                                        maxLength={5}
                                      />
                                      <MeridiemSelector
                                        value={busStartMeridiem}
                                        onChange={setBusStartMeridiem}
                                      />
                                    </View>
                                  </View>
                                </>
                              ) : (
                                <>
                                  <View style={styles.inputGroup}>
                                    <Text style={styles.label}>{requiredLabel("Route")}</Text>
                                    <TextInput
                                      style={styles.input}
                                      placeholder="Velachery → CMBT"
                                      placeholderTextColor="#94A3B8"
                                      value={travelRoute}
                                      onChangeText={setTravelRoute}
                                    />
                                  </View>
                                  <View style={styles.inputGroup}>
                                    <Text style={styles.label}>{requiredLabel("Timing")}</Text>
                                    <TextInput
                                      style={styles.input}
                                      placeholder="09:30AM - 11:45AM"
                                      placeholderTextColor="#94A3B8"
                                      value={travelTiming}
                                      onChangeText={setTravelTiming}
                                    />
                                  </View>
                                </>
                              )}
                              {travelType === "Bus" && (
                                <>
                                  <View style={styles.inputGroup}>
                                    <Text style={styles.label}>
                                      Driver name (optional)
                                    </Text>
                                    <TextInput
                                      style={styles.input}
                                      placeholder="Driver name"
                                      placeholderTextColor="#94A3B8"
                                      value={driverName}
                                      onChangeText={setDriverName}
                                    />
                                  </View>
                                  <View style={styles.inputGroup}>
                                    <Text style={styles.label}>
                                      Conductor name (optional)
                                    </Text>
                                    <TextInput
                                      style={styles.input}
                                      placeholder="Conductor name"
                                      placeholderTextColor="#94A3B8"
                                      value={conductorName}
                                      onChangeText={setConductorName}
                                    />
                                  </View>
                                </>
                              )}
                            </View>
                          )}

                        {isRegister &&
                          isOperationalStaff &&
                          isOtpSent &&
                          isVerified && (
                            <View style={styles.cardBlock}>
                              <Text style={styles.cardTitle}>
                                Daily duty roster
                              </Text>
                              <View style={styles.inputGroup}>
                                <Text style={styles.label}>{requiredLabel("Vehicle number")}</Text>
                                <TextInput
                                  style={styles.input}
                                  placeholder="TN-01-AB-1234"
                                  placeholderTextColor="#94A3B8"
                                  value={vehicleNumber}
                                  onChangeText={setVehicleNumber}
                                />
                              </View>
                              <View style={styles.inputGroup}>
                                <Text style={styles.label}>{requiredLabel("Shift timing")}</Text>
                                <TextInput
                                  style={styles.input}
                                  placeholder="6AM - 2PM"
                                  placeholderTextColor="#94A3B8"
                                  value={shiftTiming}
                                  onChangeText={setShiftTiming}
                                />
                              </View>
                              <View style={styles.inputGroup}>
                                <Text style={styles.label}>{requiredLabel("From stop")}</Text>
                                <TextInput
                                  style={styles.input}
                                  placeholder="Velachery"
                                  placeholderTextColor="#94A3B8"
                                  value={fromStop}
                                  onChangeText={setFromStop}
                                />
                              </View>
                              <View style={styles.inputGroup}>
                                <Text style={styles.label}>{requiredLabel("To stop")}</Text>
                                <TextInput
                                  style={styles.input}
                                  placeholder="CMBT"
                                  placeholderTextColor="#94A3B8"
                                  value={toStop}
                                  onChangeText={setToStop}
                                />
                              </View>
                            </View>
                          )}

                        {isRegister && isOfficialRole && (
                          <View style={styles.cardBlock}>
                            <Text style={styles.cardTitle}>
                              Official duty details
                            </Text>
                            <Text style={styles.sectionSubtitle}>
                              Admin approval required within 24 hours.
                            </Text>
                            <View style={styles.inputGroup}>
                              <Text style={styles.label}>{requiredLabel("Train PNR range")}</Text>
                              <TextInput
                                style={styles.input}
                                placeholder="4528193000-4528193999"
                                placeholderTextColor="#94A3B8"
                                value={pnrRange}
                                onChangeText={setPnrRange}
                              />
                            </View>
                            <View style={styles.inputGroup}>
                              <Text style={styles.label}>{requiredLabel("Jurisdiction")}</Text>
                              <TextInput
                                style={styles.input}
                                placeholder="Chennai Central Division"
                                placeholderTextColor="#94A3B8"
                                value={jurisdiction}
                                onChangeText={setJurisdiction}
                              />
                            </View>
                          </View>
                        )}

                        {pendingApproval && !isRegister && isOfficialRole && (
                          <View style={styles.noticeCard}>
                            <Text style={styles.noticeTitle}>
                              Approval pending
                            </Text>
                            <Text style={styles.noticeText}>
                              Your registration is under admin review. Check
                              your official inbox for approval within 24 hours.
                            </Text>
                          </View>
                        )}

                        {error.length > 0 && (
                          <Text style={styles.errorText}>{error}</Text>
                        )}

                        {!forgotPasswordMode && (
                          <View>
                            <TouchableOpacity
                              style={[
                                styles.primaryButton,
                                !canSubmit && styles.buttonDisabled,
                              ]}
                              onPress={handleSubmit}
                              disabled={!canSubmit}
                            >
                              <Text style={styles.primaryButtonText}>
                                {isRegister ? "Create account" : "Log in"}
                              </Text>
                            </TouchableOpacity>

                            <View style={styles.switchRow}>
                              <Text style={styles.switchText}>
                                {isRegister
                                  ? "Already have an account?"
                                  : "New here?"}
                              </Text>
                              <TouchableOpacity onPress={handleSwitchMode}>
                                <Text style={styles.switchLink}>
                                  {isRegister ? "Log in" : "Create one"}
                                </Text>
                              </TouchableOpacity>
                            </View>

                            {!isRegister && role === "TTR/RPF/Police" && (
                              <TouchableOpacity
                                style={styles.textButton}
                                onPress={handleOpenTrainGuideDemo}
                              >
                                <Text style={styles.switchLink}>
                                  Open train demo without professional details
                                </Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        )}
                      </Animated.View>
                    )}
                  </Animated.View>
                </ScrollView>
              </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
          </>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  authenticatedContainer: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  authenticatedContent: {
    flex: 1,
  },
  authenticatedScrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  logoutButtonFull: {
    marginTop: 12,
  },
  opsShell: {
    flex: 1,
    backgroundColor: "#07101C",
  },
  opsContent: {
    padding: 20,
    gap: 16,
  },
  opsHero: {
    minHeight: 240,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    padding: 18,
    borderRadius: 28,
    backgroundColor: "#0D1726",
    borderWidth: 1,
    borderColor: "#1E293B",
  },
  opsPulse: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#F59E0B",
    shadowColor: "#F59E0B",
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  opsKicker: {
    color: "#FBBF24",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.4,
  },
  opsTitle: {
    color: "#FFFFFF",
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
    letterSpacing: 0.4,
    textAlign: "center",
  },
  opsSubtitle: {
    color: "#B4C1D6",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
    maxWidth: 300,
  },
  opsHeroTag: {
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(15, 23, 42, 0.82)",
    borderWidth: 1,
    borderColor: "#334155",
  },
  opsHeroTagText: {
    color: "#E2E8F0",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  opsDutyToggle: {
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
  },
  opsDutyOn: {
    backgroundColor: "#0F5132",
    borderColor: "#34D399",
  },
  opsDutyOff: {
    backgroundColor: "#3F1D1D",
    borderColor: "#FCA5A5",
  },
  opsDutyToggleText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  opsDutyActionRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  opsDutyActionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: "#0F172A",
    alignItems: "center",
  },
  opsDutyActionDanger: {
    borderColor: "#F87171",
  },
  opsDutyActionText: {
    color: "#E2E8F0",
    fontWeight: "800",
    fontSize: 12,
  },
  opsErrorBanner: {
    backgroundColor: "#3F1D1D",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    borderRadius: 16,
    padding: 12,
  },
  opsErrorText: {
    color: "#FEE2E2",
    fontSize: 12,
    fontWeight: "700",
  },
  opsMetricRow: {
    flexDirection: "row",
    gap: 12,
  },
  opsMetricCard: {
    flex: 1,
    backgroundColor: "#0F172A",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1F2937",
  },
  opsMetricLabel: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  opsMetricValue: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 6,
  },
  opsSection: {
    gap: 12,
  },
  opsSectionHeader: {
    gap: 4,
  },
  opsSectionTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
  },
  opsSectionSubtitle: {
    color: "#94A3B8",
    fontSize: 12,
  },
  opsEmptyState: {
    backgroundColor: "#0F172A",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1F2937",
    gap: 6,
  },
  opsEmptyTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
  opsEmptyText: {
    color: "#CBD5E1",
    fontSize: 12,
    lineHeight: 18,
  },
  opsCaseCard: {
    backgroundColor: "#0F172A",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1F2937",
    gap: 10,
  },
  opsCaseCardActive: {
    borderColor: "#F59E0B",
    backgroundColor: "#111B2D",
  },
  opsCaseTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  opsCaseMetaGroup: {
    flex: 1,
    gap: 4,
  },
  opsCaseId: {
    color: "#FBBF24",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  opsCaseTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  opsCaseSummary: {
    color: "#C7D2FE",
    fontSize: 13,
    lineHeight: 19,
  },
  opsCaseMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  opsCaseMetaText: {
    color: "#94A3B8",
    fontSize: 12,
  },
  opsStatusChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  opsStatusFound: {
    backgroundColor: "#1D4ED8",
  },
  opsStatusReview: {
    backgroundColor: "#F59E0B",
  },
  opsStatusSecured: {
    backgroundColor: "#059669",
  },
  opsStatusHandover: {
    backgroundColor: "#7C3AED",
  },
  opsStatusText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  opsDetailCard: {
    backgroundColor: "#0B1628",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#203047",
    gap: 14,
  },
  opsDetailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  opsDetailBlock: {
    flexBasis: "48%",
    backgroundColor: "#0F172A",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1E293B",
    gap: 4,
  },
  opsDetailLabel: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  opsDetailValue: {
    color: "#FFFFFF",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  opsFieldInput: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 10,
    backgroundColor: "#0B1322",
    color: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
  },
  opsInfoPanel: {
    backgroundColor: "#101C2E",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#243449",
    gap: 4,
  },
  opsInfoValue: {
    color: "#F8FAFC",
    fontSize: 18,
    fontWeight: "900",
  },
  opsInfoHint: {
    color: "#CBD5E1",
    fontSize: 12,
    lineHeight: 17,
  },
  opsReplyBlock: {
    gap: 10,
  },
  opsReplyInput: {
    minHeight: 92,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#0F172A",
    color: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: "top",
  },
  opsActionRow: {
    flexDirection: "row",
    gap: 10,
  },
  opsActionButton: {
    flex: 1,
    backgroundColor: "#F59E0B",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  opsActionButtonSecondary: {
    flex: 1,
    backgroundColor: "#0F172A",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  opsActionButtonText: {
    color: "#111827",
    fontWeight: "900",
  },
  opsActionButtonSecondaryText: {
    color: "#E2E8F0",
    fontWeight: "800",
  },
  opsActionPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  opsStatusAction: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#12233A",
    borderWidth: 1,
    borderColor: "#27415E",
  },
  opsStatusActionText: {
    color: "#E2E8F0",
    fontSize: 12,
    fontWeight: "800",
  },
  opsLogoutButton: {
    marginTop: 6,
    backgroundColor: "#F97316",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  opsLogoutText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  backgroundGlow: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "#E0E7FF",
    opacity: 0.3,
    top: 40,
    right: -80,
  },
  statusBadgeRow: {
    marginTop: 12,
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  statusBadgeChecking: {
    backgroundColor: "#E2E8F0",
  },
  statusBadgeOnline: {
    backgroundColor: "#DCFCE7",
  },
  statusBadgeOffline: {
    backgroundColor: "#FEE2E2",
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1F2937",
  },
  apiErrorText: {
    marginTop: 8,
    fontSize: 12,
    color: "#DC2626",
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingBottom: 40,
  },
  scrollContentCentered: {
    justifyContent: "center",
  },
  card: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  brandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  shieldIconContainer: {
    marginRight: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  brandTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#64748B",
    marginBottom: 20,
    lineHeight: 20,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0F172A",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#1D4ED8",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#22C55E",
    marginRight: 6,
  },
  statusPillText: {
    color: "#BFDBFE",
    fontSize: 12,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginBottom: 18,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1E293B",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 6,
  },
  sectionSubtitle: {
    color: "#94A3B8",
    marginBottom: 16,
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    color: "#475569",
    fontSize: 12,
    marginBottom: 6,
    fontWeight: "500",
  },
  labelWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  helperText: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 6,
  },
  input: {
    backgroundColor: "#F8FAFC",
    borderColor: "#CBD5E1",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    color: "#1E293B",
  },
  timeFieldRow: {
    gap: 10,
  },
  timeInput: {
    width: "100%",
  },
  timePeriodRow: {
    flexDirection: "row",
    gap: 10,
  },
  timePeriodOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  timePeriodOptionActive: {
    borderColor: "#93C5FD",
    backgroundColor: "#EFF6FF",
  },
  timePeriodText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "600",
  },
  timePeriodTextActive: {
    color: "#1D4ED8",
  },
  inputDisabled: {
    backgroundColor: "#E2E8F0",
    color: "#94A3B8",
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  passwordInput: {
    flex: 1,
  },
  eyeButton: {
    marginLeft: 10,
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
  },
  passwordRuleBarRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 6,
  },
  passwordRuleBar: {
    flex: 1,
    height: 4,
    borderRadius: 999,
    backgroundColor: "#334155",
    opacity: 0.4,
  },
  passwordRuleBarActive: {
    backgroundColor: "#22C55E",
    opacity: 1,
  },
  passwordRuleRow: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    rowGap: 6,
  },
  passwordRuleText: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600",
  },
  passwordRuleTextActive: {
    color: "#10B981",
  },
  confirmPasswordText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "600",
  },
  confirmPasswordTextMatch: {
    color: "#10B981",
  },
  confirmPasswordTextNoMatch: {
    color: "#F59E0B",
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  roleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
  },
  roleChip: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    margin: 4,
  },
  roleChipActive: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },
  roleChipText: {
    color: "#475569",
    fontSize: 12,
  },
  roleChipTextActive: {
    color: "#F8FAFC",
    fontWeight: "600",
  },
  roleChipLarge: {
    borderWidth: 2,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderRadius: 16,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 80,
    margin: 4,
  },
  roleChipTextLarge: {
    color: "#475569",
    fontSize: 18,
    fontWeight: "600",
  },
  roleDescriptions: {
    marginTop: 20,
  },
  roleDescCard: {
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  roleDescTitle: {
    color: "#1E40AF",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  roleDescText: {
    color: "#1E40AF",
    fontSize: 14,
    lineHeight: 20,
  },
  errorText: {
    color: "#F87171",
    marginBottom: 12,
  },
  devHintText: {
    color: "#F59E0B",
    marginTop: 10,
    fontSize: 12,
    textAlign: "center",
  },
  primaryButton: {
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 6,
    shadowColor: "#1D4ED8",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: "#F8FAFC",
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 14,
  },
  otpToggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  switchText: {
    color: "#64748B",
    marginRight: 6,
  },
  switchLink: {
    color: "#2563EB",
    fontWeight: "600",
  },
  footerRow: {
    marginTop: 18,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  footerText: {
    color: "#64748B",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 16,
  },
  home: {
    marginTop: 6,
  },
  cardBlock: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  authorityHeaderCard: {
    backgroundColor: "#0F172A",
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#1E293B",
  },
  authorityHeaderTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  authorityTitle: {
    color: "#F8FAFC",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  authoritySubtitle: {
    color: "#CBD5F5",
    fontSize: 12,
    fontWeight: "600",
  },
  notificationBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E0E7FF",
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  notificationIcon: {
    marginRight: 6,
  },
  notificationText: {
    color: "#1E40AF",
    fontWeight: "700",
  },
  authorityMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 12,
  },
  metaPill: {
    backgroundColor: "#1E293B",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#334155",
  },
  metaPillText: {
    color: "#E2E8F0",
    fontSize: 12,
    fontWeight: "600",
  },
  dutyRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dutyLabel: {
    color: "#E2E8F0",
    fontWeight: "600",
  },
  dutyToggle: {
    width: 52,
    height: 28,
    borderRadius: 16,
    padding: 3,
    justifyContent: "center",
  },
  dutyToggleActive: {
    backgroundColor: "#22C55E",
  },
  dutyToggleInactive: {
    backgroundColor: "#334155",
  },
  dutyKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#F8FAFC",
  },
  dutyKnobActive: {
    alignSelf: "flex-end",
  },
  dutyKnobInactive: {
    alignSelf: "flex-start",
  },
  alertCard: {
    backgroundColor: "#FEF2F2",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  alertTitle: {
    color: "#B91C1C",
    fontWeight: "700",
    marginBottom: 8,
  },
  alertText: {
    color: "#7F1D1D",
    marginBottom: 4,
  },
  actionRow: {
    flexDirection: "row",
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  actionButtonSpacing: {
    marginLeft: 10,
  },
  actionButtonPrimary: {
    backgroundColor: "#2563EB",
  },
  actionButtonSecondary: {
    borderWidth: 1,
    borderColor: "#2563EB",
    backgroundColor: "#EFF6FF",
  },
  actionButtonPrimaryText: {
    color: "#F8FAFC",
    fontWeight: "600",
  },
  actionButtonSecondaryText: {
    color: "#1D4ED8",
    fontWeight: "600",
  },
  optionList: {
    marginBottom: 8,
  },
  optionItem: {
    color: "#475569",
    marginBottom: 6,
  },
  messageRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 12,
  },
  messageChip: {
    backgroundColor: "#E2E8F0",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    marginRight: 8,
    marginBottom: 8,
  },
  messageChipText: {
    color: "#1E293B",
    fontSize: 12,
    fontWeight: "600",
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  metricCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  metricValue: {
    color: "#1E293B",
    fontSize: 18,
    fontWeight: "700",
  },
  metricLabel: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 4,
  },
  authorityOptions: {
    marginTop: 8,
    marginBottom: 12,
  },
  authorityOption: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 12,
  },
  authorityOptionActive: {
    borderColor: "#2563EB",
    backgroundColor: "#EFF6FF",
  },
  authorityOptionTitle: {
    color: "#0F172A",
    fontWeight: "700",
    marginBottom: 6,
  },
  authorityOptionText: {
    color: "#475569",
    lineHeight: 18,
  },
  selectionHints: {
    marginBottom: 10,
  },
  cardBlockBlurred: {
    opacity: 0.5,
  },
  verifyCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  successCard: {
    backgroundColor: "#DCFCE7",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#86EFAC",
  },
  noticeCard: {
    backgroundColor: "#FFF7ED",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FDBA74",
  },
  noticeTitle: {
    color: "#9A3412",
    fontWeight: "600",
    marginBottom: 8,
  },
  noticeText: {
    color: "#9A3412",
    lineHeight: 18,
  },
  cardTitle: {
    color: "#1E293B",
    fontWeight: "600",
    marginBottom: 10,
  },
  cardText: {
    color: "#475569",
    marginBottom: 6,
  },
  lockedHintText: {
    color: "#F59E0B",
    fontSize: 12,
    marginBottom: 10,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 12,
  },
  statusDotLarge: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#22C55E",
    marginRight: 8,
  },
  statusText: {
    color: "#A7F3D0",
    flex: 1,
    lineHeight: 18,
  },
  timelineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 10,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#334155",
    marginRight: 10,
    marginTop: 4,
  },
  timelineDotActive: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#38BDF8",
    marginRight: 10,
    marginTop: 4,
  },
  timelineTitle: {
    color: "#E2E8F0",
    fontWeight: "600",
  },
  timelineSubtitle: {
    color: "#94A3B8",
    marginTop: 4,
  },
  queueItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1E2A44",
  },
  queueTitle: {
    color: "#F8FAFC",
    fontWeight: "600",
  },
  queueMeta: {
    color: "#94A3B8",
    marginTop: 4,
  },
  queueStatus: {
    color: "#22C55E",
    fontWeight: "700",
  },
  queueStatusAmber: {
    color: "#F59E0B",
    fontWeight: "700",
  },
  successText: {
    color: "#16A34A",
    marginTop: 10,
    fontWeight: "600",
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#38BDF8",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#38BDF8",
    fontWeight: "600",
  },
  textButton: {
    marginTop: 12,
    alignItems: "center",
  },
  backButtonRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  logoutButton: {
    marginTop: 8,
  },
  transportGrid: {
    marginTop: 12,
    gap: 12,
  },
  transportRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  transportButton: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#E2E8F0",
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 100,
  },
  transportButtonSelected: {
    backgroundColor: "#EFF6FF",
    borderColor: "#3B82F6",
  },
  transportIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  transportButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#64748B",
  },
  transportButtonTextSelected: {
    color: "#3B82F6",
  },
  profileCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  profileAvatarText: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "700",
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 4,
  },
  profileRole: {
    fontSize: 14,
    color: "#64748B",
    fontWeight: "500",
  },
  profileDetails: {
    marginTop: 0,
  },
  profileDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  profileDetailLabel: {
    fontSize: 14,
    color: "#64748B",
    fontWeight: "500",
    flex: 1,
  },
  profileDetailValue: {
    fontSize: 14,
    color: "#1E293B",
    fontWeight: "600",
    flex: 2,
    textAlign: "right",
  },
});

const App = () => (
  <SafeAreaProvider>
    <AppContent />
  </SafeAreaProvider>
);

export default App;
