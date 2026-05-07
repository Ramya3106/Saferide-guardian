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
  Text,
  TextInput,
  TouchableOpacity,
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
import "./global.css"

const ROLES = ["Passenger", "Driver/Conductor", "Cab/Auto", "TTR/RPF/Police"];
const OFFICER_ROLES = [
  {
    key: "TTR",
    title: "TTR",
    description: "Ticketing and train recovery duty",
  },
  {
    key: "TTE",
    title: "TTE",
    description: "Train escort and passenger assistance",
  },
  {
    key: "RPF",
    title: "RPF",
    description: "Railway protection and escalation handling",
  },
  {
    key: "Police",
    title: "Police",
    description: "Security response and incident coordination",
  },
];
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
    <View className="flex-row items-center gap-1.5 mb-1.5">
      <Animated.View style={{ transform: [{ scale: iconPulse }] }}>
        <Ionicons name={iconName} size={16} color="#2563EB" />
      </Animated.View>
      <Text className="text-[#475569] text-xs mb-1.5 font-medium">{text}</Text>
    </View>
  );
};

const MeridiemSelector = ({ value, onChange }) => (
  <View className="flex-row gap-2.5">
    {MERIDIEM_OPTIONS.map((option) => {
      const selected = value === option;

      return (
        <TouchableOpacity
          key={option}
          className={`flex-row items-center gap-1.5 border-[1px] border-[#CBD5E1] bg-[#F8FAFC] rounded-3 py-2.5 px-3 ${selected ? "border-[#93C5FD] bg-[#EFF6FF]" : ""}`}
          onPress={() => onChange(option)}
          activeOpacity={0.8}
        >
          <Ionicons
            name={selected ? "checkbox" : "square-outline"}
            size={18}
            color={selected ? "#2563EB" : "#64748B"}
          />
          <Text
            className={`text-[#475569] text-xs font-semibold ${selected ? "text-[#1D4ED8]" : ""}`}
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
  const [officerNotes, setOfficerNotes] = useState("");
  const [coachRemark, setCoachRemark] = useState("");
  const [stationRemark, setStationRemark] = useState("");

  const dutyUnit = useMemo(
    () => roleKey || specificRole || inferSpecificRoleFromProfessionalId(professionalId) || "TTR",
    [professionalId, roleKey, specificRole],
  );
  const roleTheme = OFFICER_ROLE_THEMES[dutyUnit] || OFFICER_ROLE_THEMES.TTR;
  const officerLabel = staffName || officerEmail || professionalId || `${dutyUnit} officer`;



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
      return alerts.length > 0 ? alerts : [];
    }

    return [];
  }, [alerts, onDuty]);

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
    if (!trimmedReply || !selectedAlert) {
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
    if (!selectedAlert) {
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
    if (!selectedAlert) {
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
    if (!selectedAlert) {
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
    <SafeAreaView className="flex-[1] bg-[#07101C]">
      <ScrollView contentContainerClassName="p-5 gap-4">
        <View className="min-h-[240] justify-center items-center gap-2.5 p-[18px] rounded-7 bg-[#0D1726] border-[1px] border-[#1E293B]">
          <Animated.View
            className={`${"w-[68px] h-[68px] rounded-[34px] bg-[#F59E0B] shadow-lg"}`}
          />
          <Text className="text-[#FBBF24] text-xs font-extrabold text-transform-[uppercase] letter-spacing-[1.4]" style={{ color: roleTheme.accent }}>Priority duty board</Text>
          <Text className="text-[#FFFFFF] text-[28px] line-height-[34] font-black letter-spacing-[0.4] text-center" style={{ color: roleTheme.accent }}>{roleLabel}</Text>
          <Text className="text-[#B4C1D6] text-[13px] text-center line-height-[19] max-width-[300]">
            Live lost-item complaints for on-duty railway protection staff.
          </Text>
          <View className="mt-1 px-3 py-[7px] rounded-[999px] bg-[rgba(15, 23, 42, 0.82)] border-[1px] border-[#334155]">
            <Text className="text-[#E2E8F0] text-[11px] font-bold letter-spacing-[0.4]" style={{ color: roleTheme.accent }}>{officerLabel}</Text>
          </View>
          <Pressable
            className={`${"mt-2.5 px-4 py-[11px] rounded-[999px] border-[1px] items-center"} ${onDuty ? "bg-[#0F5132] border-[#34D399]" : "bg-[#3F1D1D] border-[#FCA5A5]"}`}
            onPress={() => syncDutyStatus(!onDuty)}
            disabled={dutySyncing}
          >
            <Text className="text-[#FFFFFF] text-xs font-black letter-spacing-[0.4]">
              Duty {onDuty ? "ON" : "OFF"}{dutySyncing ? " ..." : ""}
            </Text>
          </Pressable>
          <View className="flex-row gap-2.5 w-[100%]">
            <Pressable
              className="flex-[1] py-2.5 rounded-3 border-[1px] bg-[#0F172A] items-center" style={{ borderColor: roleTheme.accent }}
              onPress={() => syncDutyStatus(true)}
              disabled={dutySyncing || onDuty}
            >
              <Text className="text-[#E2E8F0] font-extrabold text-xs">Check-In</Text>
            </Pressable>
            <Pressable
              className="flex-[1] py-2.5 rounded-3 border-[1px] bg-[#0F172A] items-center border-[#F87171]"
              onPress={() => syncDutyStatus(false)}
              disabled={dutySyncing || !onDuty}
            >
              <Text className="text-[#E2E8F0] font-extrabold text-xs">Check-Out</Text>
            </Pressable>
          </View>
        </View>

        <View className="bg-[#0B1628] rounded-6 p-[18px] border-[1px] border-[#203047] gap-3.5">
          <View className="gap-1">
            <Text className="text-[#FFFFFF] text-lg font-black">Duty attendance</Text>
            <Text className="text-[#94A3B8] text-xs">One active duty session per officer.</Text>
          </View>
          <View className="flex-row flex-wrap gap-3">
            <View className="flex-basis-[48%] bg-[#0F172A] rounded-4 p-3 border-[1px] border-[#1E293B] gap-1">
              <Text className="text-[#94A3B8] text-[11px] font-extrabold text-transform-[uppercase] letter-spacing-[0.7]">Assigned train</Text>
              <TextInput
                className="mt-1 border-[1px] border-[#334155] rounded-2.5 bg-[#0B1322] text-[#FFFFFF] px-2.5 py-2 text-xs"
                value={dutyTrain}
                onChangeText={setDutyTrain}
                placeholder="2241 City Express"
                placeholderTextColor="#64748B"
              />
            </View>
            <View className="flex-basis-[48%] bg-[#0F172A] rounded-4 p-3 border-[1px] border-[#1E293B] gap-1">
              <Text className="text-[#94A3B8] text-[11px] font-extrabold text-transform-[uppercase] letter-spacing-[0.7]">Assigned route</Text>
              <TextInput
                className="mt-1 border-[1px] border-[#334155] rounded-2.5 bg-[#0B1322] text-[#FFFFFF] px-2.5 py-2 text-xs"
                value={dutyRoute}
                onChangeText={setDutyRoute}
                placeholder="Chennai Central -> Tambaram"
                placeholderTextColor="#64748B"
              />
            </View>
            <View className="flex-basis-[48%] bg-[#0F172A] rounded-4 p-3 border-[1px] border-[#1E293B] gap-1">
              <Text className="text-[#94A3B8] text-[11px] font-extrabold text-transform-[uppercase] letter-spacing-[0.7]">Assigned station</Text>
              <TextInput
                className="mt-1 border-[1px] border-[#334155] rounded-2.5 bg-[#0B1322] text-[#FFFFFF] px-2.5 py-2 text-xs"
                value={dutyStation}
                onChangeText={setDutyStation}
                placeholder="Tambaram"
                placeholderTextColor="#64748B"
              />
            </View>
            <View className="flex-basis-[48%] bg-[#0F172A] rounded-4 p-3 border-[1px] border-[#1E293B] gap-1">
              <Text className="text-[#94A3B8] text-[11px] font-extrabold text-transform-[uppercase] letter-spacing-[0.7]">Assigned shift</Text>
              <TextInput
                className="mt-1 border-[1px] border-[#334155] rounded-2.5 bg-[#0B1322] text-[#FFFFFF] px-2.5 py-2 text-xs"
                value={dutyShift}
                onChangeText={setDutyShift}
                placeholder="06:00 - 14:00"
                placeholderTextColor="#64748B"
              />
            </View>
          </View>
          <View className="bg-[#101C2E] rounded-[18px] p-3.5 border-[1px] border-[#243449] gap-1">
            <Text className="text-[#CBD5E1] text-xs line-height-[17]">
              Session status: {dutyAttendance?.status || (onDuty ? "ACTIVE" : "INACTIVE")}
            </Text>
            <Text className="text-[#CBD5E1] text-xs line-height-[17]">
              Check-In: {dutyAttendance?.checkInTime ? new Date(dutyAttendance.checkInTime).toLocaleString() : "Not checked in"}
            </Text>
            <Text className="text-[#CBD5E1] text-xs line-height-[17]">
              Check-Out: {dutyAttendance?.checkOutTime ? new Date(dutyAttendance.checkOutTime).toLocaleString() : "Not checked out"}
            </Text>
          </View>
        </View>

        <View className="flex-row flex-wrap gap-3">
          <View className="flex-basis-[48%] bg-[#0F172A] rounded-4 p-3 border-[1px] border-[#1E293B] gap-1">
            <Text className="text-[#94A3B8] text-[11px] font-extrabold text-transform-[uppercase] letter-spacing-[0.7]">Officer profile</Text>
            <Text className="text-[#FFFFFF] text-[13px] line-height-[18] font-bold">{officerLabel}</Text>
            <Text className="text-[#CBD5E1] text-xs line-height-[17]">Unit: {dutyUnit}</Text>
            <Text className="text-[#CBD5E1] text-xs line-height-[17]">Email: {officerEmail || "demo.officer@railnet.gov.in"}</Text>
          </View>
          <View className="flex-basis-[48%] bg-[#0F172A] rounded-4 p-3 border-[1px] border-[#1E293B] gap-1">
            <Text className="text-[#94A3B8] text-[11px] font-extrabold text-transform-[uppercase] letter-spacing-[0.7]">Current assignment</Text>
            <Text className="text-[#FFFFFF] text-[13px] line-height-[18] font-bold">{selectedRosterOfficer?.dutyStation || "Chennai Central"}</Text>
            <Text className="text-[#CBD5E1] text-xs line-height-[17]">Desk: {selectedRosterOfficer?.dutyDesk || "Passenger recovery desk"}</Text>
            <Text className="text-[#CBD5E1] text-xs line-height-[17]">Badge: {onDuty ? "ON DUTY" : "OFF DUTY"}</Text>
          </View>
        </View>

        {alertError ? (
          <View className="bg-[#3F1D1D] border-[1px] border-[#FCA5A5] rounded-4 p-3">
            <Text className="text-[#FEE2E2] text-xs font-bold">{alertError}</Text>
          </View>
        ) : null}

        <View className="flex-row gap-3">
          <View className="flex-[1] bg-[#0F172A] rounded-[18px] p-3.5 border-[1px] border-[#1F2937]">
            <Text className="text-[#94A3B8] text-[11px] font-extrabold text-transform-[uppercase]">Open cases</Text>
            <Text className="text-[#FFFFFF] text-xl font-black mt-1.5">{statusSummary.openCount}</Text>
          </View>
          <View className="flex-[1] bg-[#0F172A] rounded-[18px] p-3.5 border-[1px] border-[#1F2937]">
            <Text className="text-[#94A3B8] text-[11px] font-extrabold text-transform-[uppercase]">Priority alerts</Text>
            <Text className="text-[#FFFFFF] text-xl font-black mt-1.5">{statusSummary.priorityCount}</Text>
          </View>
          <View className="flex-[1] bg-[#0F172A] rounded-[18px] p-3.5 border-[1px] border-[#1F2937]">
            <Text className="text-[#94A3B8] text-[11px] font-extrabold text-transform-[uppercase]">Recovered / secured</Text>
            <Text className="text-[#FFFFFF] text-xl font-black mt-1.5">{statusSummary.securedCount}</Text>
          </View>
        </View>

        <View className="gap-3">
          <View className="gap-1">
            <Text className="text-[#FFFFFF] text-lg font-black">Live complaint queue</Text>
            <Text className="text-[#94A3B8] text-xs">
              {onDuty ? "Priority complaints assigned to you only." : "Check in to receive priority alerts."}
            </Text>
          </View>

          {!onDuty ? (
            <View className="bg-[#0F172A] rounded-[18px] p-4 border-[1px] border-[#1F2937] gap-1.5">
              <Text className="text-[#FFFFFF] text-[15px] font-black">Not on duty</Text>
              <Text className="text-[#CBD5E1] text-xs line-height-[18]">
                Check in to receive live passenger complaints, replies, and handover actions.
              </Text>
            </View>
          ) : null}

          {displayAlerts.map((item) => {
            const isSelected = item.id === selectedAlertId || (!selectedAlertId && displayAlerts[0]?.id === item.id);

            return (
              <Pressable
                key={item.id}
                className={`bg-[#0F172A] rounded-5 p-4 border-[1px] border-[#1F2937] gap-2.5 ${isSelected ? "border-[#F59E0B] bg-[#111B2D]" : ""}`}
                onPress={() => setSelectedAlertId(item.id)}
              >
                <View className="flex-row justify-space-between items-start gap-3">
                  <View className="flex-[1] gap-1">
                    <Text className="text-[#FBBF24] text-[11px] font-extrabold letter-spacing-[1.1]">{item.id}</Text>
                    <Text className="text-[#FFFFFF] text-base font-extrabold">{item.itemType}</Text>
                  </View>
                  <View
                    className={`${"px-2.5 py-1.5 rounded-[999px] self-start"} ${item.status === "Item Found" ? "bg-[#1D4ED8]" : ""} ${item.status === "Item Being Checked" ? "bg-[#F59E0B]" : ""} ${(item.status === "Passenger Contacted" || item.status === "Acknowledged") ? "bg-[#059669]" : ""} ${item.status === "Ready for Handover" ? "bg-[#7C3AED]" : ""}`}
                  >
                    <Text className="text-[#FFFFFF] text-[11px] font-extrabold text-transform-[uppercase] letter-spacing-[0.6]">{item.status}</Text>
                  </View>
                </View>

                <Text className="text-[#C7D2FE] text-[13px] line-height-[19]">{item.summary}</Text>

                <View className="flex-row flex-wrap gap-2">
                  <Text className="text-[#94A3B8] text-xs">{item.vehicleNumber}</Text>
                  <Text className="text-[#94A3B8] text-xs">{item.route}</Text>
                  <Text className="text-[#94A3B8] text-xs">Priority: {item.priority}</Text>
                </View>
              </Pressable>
            );
          })}

          {isLoadingAlerts ? (
            <Text className="text-[#94A3B8] text-xs">Refreshing complaint feed...</Text>
          ) : null}
        </View>

        {selectedAlert ? (
          <View className="bg-[#0B1628] rounded-6 p-[18px] border-[1px] border-[#203047] gap-3.5">
            <View className="gap-1">
              <Text className="text-[#FFFFFF] text-lg font-black">Case detail</Text>
              <Text className="text-[#94A3B8] text-xs">Assigned to the current on-duty officer.</Text>
            </View>

            <View className="flex-row flex-wrap gap-3">
              <View className="flex-basis-[48%] bg-[#0F172A] rounded-4 p-3 border-[1px] border-[#1E293B] gap-1">
                <Text className="text-[#94A3B8] text-[11px] font-extrabold text-transform-[uppercase] letter-spacing-[0.7]">Passenger</Text>
                <Text className="text-[#FFFFFF] text-[13px] line-height-[18] font-bold">{selectedAlert.passengerName}</Text>
              </View>
              <View className="flex-basis-[48%] bg-[#0F172A] rounded-4 p-3 border-[1px] border-[#1E293B] gap-1">
                <Text className="text-[#94A3B8] text-[11px] font-extrabold text-transform-[uppercase] letter-spacing-[0.7]">Train / vehicle</Text>
                <Text className="text-[#FFFFFF] text-[13px] line-height-[18] font-bold">{selectedAlert.vehicleNumber}</Text>
              </View>
              <View className="flex-basis-[48%] bg-[#0F172A] rounded-4 p-3 border-[1px] border-[#1E293B] gap-1">
                <Text className="text-[#94A3B8] text-[11px] font-extrabold text-transform-[uppercase] letter-spacing-[0.7]">Route</Text>
                <Text className="text-[#FFFFFF] text-[13px] line-height-[18] font-bold">{selectedAlert.route}</Text>
              </View>
              <View className="flex-basis-[48%] bg-[#0F172A] rounded-4 p-3 border-[1px] border-[#1E293B] gap-1">
                <Text className="text-[#94A3B8] text-[11px] font-extrabold text-transform-[uppercase] letter-spacing-[0.7]">Next station</Text>
                <Text className="text-[#FFFFFF] text-[13px] line-height-[18] font-bold">{selectedAlert.nextStation}</Text>
              </View>
            </View>

            <View className="bg-[#101C2E] rounded-[18px] p-3.5 border-[1px] border-[#243449] gap-1">
              <Text className="text-[#94A3B8] text-[11px] font-extrabold text-transform-[uppercase] letter-spacing-[0.7]">Issue details</Text>
              <Text className="text-[#F8FAFC] text-lg font-black">{selectedAlert.itemType}</Text>
              <Text className="text-[#CBD5E1] text-xs line-height-[17]">{selectedAlert.description}</Text>
              <Text className="text-[#CBD5E1] text-xs line-height-[17]">Priority: {selectedAlert.priority}</Text>
              <Text className="text-[#CBD5E1] text-xs line-height-[17]">{selectedAlert.handoverState}</Text>
              <Text className="text-[#CBD5E1] text-xs line-height-[17]">Last action: {selectedAlert.lastAction}</Text>
            </View>

            <View className="gap-2.5">
              <Text className="text-[#94A3B8] text-[11px] font-extrabold text-transform-[uppercase] letter-spacing-[0.7]">Officer updates</Text>
              <TextInput
                className="mt-1 border-[1px] border-[#334155] rounded-2.5 bg-[#0B1322] text-[#FFFFFF] px-2.5 py-2 text-xs"
                value={officerNotes}
                onChangeText={setOfficerNotes}
                placeholder="Internal note for passenger timeline"
                placeholderTextColor="#6B7280"
              />
              <TextInput
                className="mt-1 border-[1px] border-[#334155] rounded-2.5 bg-[#0B1322] text-[#FFFFFF] px-2.5 py-2 text-xs"
                value={coachRemark}
                onChangeText={setCoachRemark}
                placeholder="Coach or berth remark"
                placeholderTextColor="#6B7280"
              />
              <TextInput
                className="mt-1 border-[1px] border-[#334155] rounded-2.5 bg-[#0B1322] text-[#FFFFFF] px-2.5 py-2 text-xs"
                value={stationRemark}
                onChangeText={setStationRemark}
                placeholder="Station remark"
                placeholderTextColor="#6B7280"
              />
            </View>

            <View className="gap-2.5">
              <Text className="text-[#94A3B8] text-[11px] font-extrabold text-transform-[uppercase] letter-spacing-[0.7]">Reply to passenger</Text>
              <TextInput
                className="min-h-[92] rounded-[18px] border-[1px] border-[#334155] bg-[#0F172A] text-[#FFFFFF] px-3.5 py-3 text-align-vertical-[top]"
                value={replyDraft}
                onChangeText={setReplyDraft}
                placeholder="Write a duty reply to the passenger"
                placeholderTextColor="#6B7280"
                multiline
              />
              <View className="flex-row gap-2.5">
                <Pressable
                  className="flex-[1] bg-[#F59E0B] rounded-3.5 py-3 items-center" style={{ backgroundColor: roleTheme.accent }}
                  onPress={sendReply}
                >
                  <Text className="text-[#111827] font-black">Send reply</Text>
                </Pressable>
                <Pressable
                  className="flex-[1] bg-[#0F172A] rounded-3.5 py-3 items-center border-[1px] border-[#334155]"
                  onPress={() => {
                    setReplyDraft(selectedAlert.replyDraft || "");
                    setOfficerNotes(selectedAlert.officerNotes || "");
                    setCoachRemark(selectedAlert.coachRemark || "");
                    setStationRemark(selectedAlert.stationRemark || "");
                  }}
                >
                  <Text className="text-[#E2E8F0] font-extrabold">Reset text</Text>
                </Pressable>
              </View>
            </View>

            <View className="flex-row flex-wrap gap-2.5">
              <Pressable className="px-3.5 py-2.5 rounded-[999px] bg-[#12233A] border-[1px] border-[#27415E]" onPress={() => markAcknowledgement("Seen")}>
                <Text className="text-[#E2E8F0] text-xs font-extrabold">Seen</Text>
              </Pressable>
              <Pressable
                className="px-3.5 py-2.5 rounded-[999px] bg-[#12233A] border-[1px] border-[#27415E]"
                onPress={() => markAcknowledgement("Acknowledged")}
              >
                <Text className="text-[#E2E8F0] text-xs font-extrabold">Acknowledged</Text>
              </Pressable>
              <Pressable className="px-3.5 py-2.5 rounded-[999px] bg-[#12233A] border-[1px] border-[#27415E]" onPress={() => applyStatus("Item Being Checked")}>
                <Text className="text-[#E2E8F0] text-xs font-extrabold">Item Being Checked</Text>
              </Pressable>
              <Pressable className="px-3.5 py-2.5 rounded-[999px] bg-[#12233A] border-[1px] border-[#27415E]" onPress={() => applyStatus("Item Found")}>
                <Text className="text-[#E2E8F0] text-xs font-extrabold">Item Found</Text>
              </Pressable>
              <Pressable className="px-3.5 py-2.5 rounded-[999px] bg-[#12233A] border-[1px] border-[#27415E]" onPress={() => applyStatus("Passenger Contacted")}>
                <Text className="text-[#E2E8F0] text-xs font-extrabold">Passenger Contacted</Text>
              </Pressable>
              <Pressable className="px-3.5 py-2.5 rounded-[999px] bg-[#12233A] border-[1px] border-[#27415E]" onPress={coordinateHandover}>
                <Text className="text-[#E2E8F0] text-xs font-extrabold">Ready for Handover</Text>
              </Pressable>
              <Pressable className="px-3.5 py-2.5 rounded-[999px] bg-[#12233A] border-[1px] border-[#27415E]" onPress={() => applyStatus("Closed")}>
                <Text className="text-[#E2E8F0] text-xs font-extrabold">Closed</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View className="gap-3">
          <View className="gap-1">
            <Text className="text-[#FFFFFF] text-lg font-black">Recent responses</Text>
            <Text className="text-[#94A3B8] text-xs">Latest officer-to-passenger replies.</Text>
          </View>
          {recentResponses.length > 0 ? (
            recentResponses.map((entry, index) => (
              <View key={`${entry.alertId}-${index}`} className="bg-[#0F172A] rounded-5 p-4 border-[1px] border-[#1F2937] gap-2.5">
                <Text className="text-[#FBBF24] text-[11px] font-extrabold letter-spacing-[1.1]">{entry.alertId}</Text>
                <Text className="text-[#C7D2FE] text-[13px] line-height-[19]">{entry.text}</Text>
                <View className="flex-row flex-wrap gap-2">
                  <Text className="text-[#94A3B8] text-xs">{entry.staffName || dutyUnit}</Text>
                  <Text className="text-[#94A3B8] text-xs">{entry.passengerName}</Text>
                </View>
              </View>
            ))
          ) : (
            <View className="bg-[#0F172A] rounded-[18px] p-4 border-[1px] border-[#1F2937] gap-1.5">
              <Text className="text-[#CBD5E1] text-xs line-height-[18]">No response messages yet for this duty shift.</Text>
            </View>
          )}
        </View>



        <Pressable className="mt-1.5 bg-[#F97316] rounded-4 py-3.5 items-center" onPress={onLogout}>
          <Text className="text-[#FFFFFF] font-black">Logout</Text>
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
  const [authToken, setAuthToken] = useState("");
  const [authUserId, setAuthUserId] = useState("");
  const [authUserRole, setAuthUserRole] = useState("");

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
  const otpEmail = email.trim();
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
    const trimmedProfessionalId = professionalId.trim();
    const officerLoginIdentifier = trimmedEmail || trimmedProfessionalId;
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
          isValidEmail(email) &&
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
      return officerLoginIdentifier.length >= 4 && trimmedPassword.length >= 6;
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
    email,
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
    setAuthToken("");
    setAuthUserId("");
    setAuthUserRole("");
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
    setProfessionalId(profile.professionalId || "");
    setJurisdiction(profile.jurisdiction || "");
    setPnrRange(profile.pnrRange || "");
  };

  const completeLoginAfterOtp = (profile = {}, inferredRole = "") => {
    applyUserProfile(profile);

    if (isOfficialRole) {
      if (inferredRole) {
        setSpecificRole(inferredRole);
      }
      // proceed to authenticated state regardless of inferredRole
      setIsAuthenticated(true);
      return;
    }

    setIsAuthenticated(true);
  };

  const initiatePostLoginOtp = async (profile = {}, inferredRole = "") => {
    const resolvedEmail = (profile.email || email)
      .trim()
      .toLowerCase();

    if (!isValidEmail(resolvedEmail)) {
      setError("Unable to send OTP. Account email is missing or invalid.");
      return false;
    }

    setEmail(resolvedEmail);

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

    if (isRegister && isOfficialRole && !isVerified) {
      setError("Verify your email before registering.");
      return;
    }

    setError("");

    if (isRegister) {
      const isBusTravel = travelType === "Bus";
      const registeredEmail = email.trim().toLowerCase();
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

        if (isOfficialRole) {
          setProfessionalId(registeredProfessionalId);
          setEmail(registeredEmail);
          setError("Registration successful. Please log in.");
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
          identifier: email.trim().toLowerCase() || professionalId.trim().toUpperCase(),
          email: email.trim().toLowerCase(),
          professionalId: professionalId.trim().toUpperCase(),
          password: password.trim(),
          method: "password",
        });

        const profile = data?.user;
        if (!profile) {
          setError("Unable to load profile for this account.");
          return;
        }

        const inferredRole = data?.specificRole || inferSpecificRoleFromId(profile.professionalId || professionalId);

        setProfessionalId(profile.professionalId || professionalId);
        setSpecificRole(inferredRole);
        setAuthToken(data?.token || "");
        setAuthUserId(String(profile?.id || profile?._id || ""));
        setAuthUserRole(String(data?.role || profile?.role || role));
        setEmail(profile.email || email.trim().toLowerCase());
        setError("");

        // Proceed to authenticate; keep any inferred specific role
        if (inferredRole && ["TTR", "TTE", "RPF", "Police"].includes(inferredRole)) {
          setSpecificRole(inferredRole);
        }
        setIsAuthenticated(true);
      } catch (err) {
        const message = err?.response?.data?.message || "Unable to log in.";
        setError(message);
      }
      return;
    }

    if (!isRegister && !loginWithOtp) {
      try {
        const { data } = await axios.post(`${API_BASE}/auth/login`, {
          role,
          identifier: email.trim().toLowerCase(),
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
        setAuthToken(data?.token || "");
        setAuthUserId(String(profile?.id || profile?._id || ""));
        setAuthUserRole(String(data?.role || profile?.role || role));
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

  const handleRailwayLoginBack = () => {
    setShowRoleSelection(false);
    setSpecificRole("");
    setForgotPasswordMode(false);
    setError("");
  };

  const handleSwitchMode = () => {
    setMode((prev) => (prev === "login" ? "register" : "login"));
    resetForm();
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
    setAuthToken("");
    setAuthUserId("");
    setAuthUserRole("");
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
    const trimmedEmail = email.trim().toLowerCase();
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

    setError("");
    setIsResetCodeSent(false);
    setResetCode("");
    setIsSendingResetCode(true);

    try {
      const { data } = await axios.post(`${API_BASE}/auth/forgot-password`, {
        role,
        professionalId: trimmedProfessionalId,
        email: trimmedEmail,
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
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedProfessionalId = professionalId.trim();

    if (trimmedProfessionalId.length < 6) {
      setError("Enter a valid professional ID.");
      return;
    }

    if (trimmedEmail.length < 5 || !trimmedEmail.includes("@")) {
      setError("Enter a valid email address.");
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
        email: trimmedEmail,
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
        email: email.trim().toLowerCase(),
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
        email: email.trim().toLowerCase(),
        resetCode: resetCode.trim(),
        newPassword: newPassword.trim(),
      };

      console.log("Resetting password with:", { email: email.trim().toLowerCase(), codeLength: resetCode.trim().length });

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
        setEmail("");
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
    <View className="gap-2.5">
      {isOfficialRole ? (
        <View className="bg-[#EFF6FF] border-[1.5px] border-[#BFDBFE] rounded-4 p-3.5 gap-2.5">
          <View className="flex-row items-center gap-3">
            <Ionicons name="shield-checkmark" size={28} color="#2563EB" />
            <View className="flex-[1]">
              <Text className="text-base font-extrabold text-[#1E40AF] letter-spacing-[0.2]">Railway Authority</Text>
              <Text className="text-xs font-semibold text-[#3B82F6] mt-0.5">
                TTR / RPF / TTE / Police
              </Text>
            </View>
          </View>
          <Text className="text-[11px] text-[#64748B] font-style-[italic]">
            Your specific role will be detected from your Professional ID.
          </Text>
        </View>
      ) : (
        <View className="flex-row flex-wrap mx-[-4px]">
          {ROLES.map((item) => (
            <TouchableOpacity
              key={item}
              className={`${"border-[1px] border-[#CBD5E1] bg-[#F8FAFC] py-1.5 px-2.5 rounded-[999px] m-1"} ${role === item ? "bg-[#2563EB] border-[#2563EB]" : ""}`}
              onPress={() => handleRoleChange(item)}
            >
              <Text
                className={`${"text-[#475569] text-xs"} ${role === item ? "text-[#F8FAFC] font-semibold" : ""}`}
              >
                {item}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  const renderPassengerDashboard = () => (
    <View>
      <Text className="text-xl font-bold text-[#1E293B] mb-1.5">Passenger Command Center</Text>
      <Text className="text-[#94A3B8] mb-4 line-height-[20]">
        Live complaint matching + recovery tracking for your trip.
      </Text>

      <View className="bg-[#F8FAFC] rounded-4 p-4 mb-4 border-[1px] border-[#E2E8F0]">
        <Text className="text-[#1E293B] font-semibold mb-2.5">Report Lost Item</Text>
        <Text className="text-[#475569] text-xs mb-1.5 font-medium">
          In which transport did you lose your item?
        </Text>
        <View className="mt-3 gap-3">
          <View className="flex-row gap-3 mb-3">
            <TouchableOpacity
              className={`${"flex-[1] bg-[#F8FAFC] rounded-4 border-0.5 border-[#E2E8F0] p-5 items-center justify-center min-h-[100]"} ${selectedTransport === "Train" ? "bg-[#EFF6FF] border-[#3B82F6]" : ""}`}
              onPress={() => setSelectedTransport("Train")}
              activeOpacity={0.7}
            >
              <Text className="text-[40px] mb-2">🚆</Text>
              <Text
                className={`${"text-base font-semibold text-[#64748B]"} ${selectedTransport === "Train" ? "text-[#3B82F6]" : ""}`}
              >
                Train
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`${"flex-[1] bg-[#F8FAFC] rounded-4 border-0.5 border-[#E2E8F0] p-5 items-center justify-center min-h-[100]"} ${selectedTransport === "Car" ? "bg-[#EFF6FF] border-[#3B82F6]" : ""}`}
              onPress={() => setSelectedTransport("Car")}
              activeOpacity={0.7}
            >
              <Text className="text-[40px] mb-2">🚗</Text>
              <Text
                className={`${"text-base font-semibold text-[#64748B]"} ${selectedTransport === "Car" ? "text-[#3B82F6]" : ""}`}
              >
                Car
              </Text>
            </TouchableOpacity>
          </View>
          <View className="flex-row gap-3 mb-3">
            <TouchableOpacity
              className={`${"flex-[1] bg-[#F8FAFC] rounded-4 border-0.5 border-[#E2E8F0] p-5 items-center justify-center min-h-[100]"} ${selectedTransport === "Bus" ? "bg-[#EFF6FF] border-[#3B82F6]" : ""}`}
              onPress={() => setSelectedTransport("Bus")}
              activeOpacity={0.7}
            >
              <Text className="text-[40px] mb-2">🚌</Text>
              <Text
                className={`${"text-base font-semibold text-[#64748B]"} ${selectedTransport === "Bus" ? "text-[#3B82F6]" : ""}`}
              >
                Bus
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`${"flex-[1] bg-[#F8FAFC] rounded-4 border-0.5 border-[#E2E8F0] p-5 items-center justify-center min-h-[100]"} ${selectedTransport === "Auto" ? "bg-[#EFF6FF] border-[#3B82F6]" : ""}`}
              onPress={() => setSelectedTransport("Auto")}
              activeOpacity={0.7}
            >
              <Text className="text-[40px] mb-2">🛺</Text>
              <Text
                className={`${"text-base font-semibold text-[#64748B]"} ${selectedTransport === "Auto" ? "text-[#3B82F6]" : ""}`}
              >
                Auto
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {selectedTransport && (
        <View className="bg-[#F8FAFC] rounded-4 p-4 mb-4 border-[1px] border-[#E2E8F0]">
          <Text className="text-[#1E293B] font-semibold mb-2.5">Raise Geo-Tagged Complaint</Text>
          <View className="mb-3.5">
            <Text className="text-[#475569] text-xs mb-1.5 font-medium">Lost item</Text>
            <TextInput
              className="bg-[#F8FAFC] border-[#CBD5E1] border-[1px] rounded-3 py-3 px-3.5 text-[#1E293B]"
              placeholder="Backpack / Phone / Documents"
              placeholderTextColor="#94A3B8"
              value={complaintItem}
              onChangeText={setComplaintItem}
            />
          </View>
          <View className="mb-3.5">
            <Text className="text-[#475569] text-xs mb-1.5 font-medium">Description</Text>
            <TextInput
              className="bg-[#F8FAFC] border-[#CBD5E1] border-[1px] rounded-3 py-3 px-3.5 text-[#1E293B]"
              placeholder="Color, brand, contents"
              placeholderTextColor="#94A3B8"
              value={complaintDesc}
              onChangeText={setComplaintDesc}
            />
          </View>
          <View className="mb-3.5">
            <Text className="text-[#475569] text-xs mb-1.5 font-medium">Last seen location</Text>
            <TextInput
              className="bg-[#F8FAFC] border-[#CBD5E1] border-[1px] rounded-3 py-3 px-3.5 text-[#1E293B]"
              placeholder="Medavakkam / Stop name"
              placeholderTextColor="#94A3B8"
              value={complaintLocation}
              onChangeText={setComplaintLocation}
            />
          </View>
          <View className="mb-3.5">
            <Text className="text-[#475569] text-xs mb-1.5 font-medium">Time</Text>
            <View className="gap-2.5">
              <TextInput
                className="bg-[#F8FAFC] border-[#CBD5E1] border-[1px] rounded-3 py-3 px-3.5 text-[#1E293B] w-[100%]"
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
            className="bg-[#2563EB] rounded-3 py-3.5 items-center mt-1.5 shadow-md"
            onPress={handleSubmitComplaint}
          >
            <Text className="text-[#F8FAFC] font-semibold letter-spacing-[0.3]">Submit complaint</Text>
          </TouchableOpacity>
        </View>
      )}

      {complaintSubmitted && (
        <View className="bg-[#F8FAFC] rounded-4 p-4 mb-4 border-[1px] border-[#E2E8F0]">
          <Text className="text-[#1E293B] font-semibold mb-2.5">Complaint Status</Text>
          <Text className="text-[#16A34A] mt-2.5 font-semibold">
            ✅ Complaint submitted successfully
          </Text>
          <Text className="text-[#475569] mb-1.5">Your complaint ID has been generated and assigned.</Text>
          <Text className="text-[#475569] mb-1.5">Status: Awaiting staff assignment</Text>
          <View className="flex-row items-center mt-2 mb-3">
            <View className="w-2.5 h-2.5 rounded-[5px] bg-[#22C55E] mr-2" />
            <Text className="text-[#A7F3D0] flex-[1] line-height-[18]">
              Our on-duty staff will receive your complaint and respond within minutes. You will receive updates via notifications.
            </Text>
          </View>
          <TouchableOpacity
            className="border-[1px] border-[#38BDF8] rounded-3 py-3 items-center"
            onPress={handleStaffConfirm}
          >
            <Text className="text-[#38BDF8] font-semibold">
              Proceed to tracking
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {staffConfirmed && (
        <View className="bg-[#F8FAFC] rounded-4 p-4 mb-4 border-[1px] border-[#E2E8F0]">
          <Text className="text-[#1E293B] font-semibold mb-2.5">Item Status</Text>
          <Text className="text-[#475569] mb-1.5">Status: Staff has acknowledged receipt</Text>
          <Text className="text-[#475569] mb-1.5">Your item is now in the custody of railway staff.</Text>
          <View className="flex-row items-start mt-2.5">
            <View className="w-2.5 h-2.5 rounded-[5px] bg-[#38BDF8] mr-2.5 mt-1" />
            <View>
              <Text className="text-[#E2E8F0] font-semibold">
                Complaint → Staff Confirmation
              </Text>
              <Text className="text-[#94A3B8] mt-1">
                Your complaint was matched with on-duty staff.
              </Text>
            </View>
          </View>
          <View className="flex-row items-start mt-2.5">
            <View className="w-2.5 h-2.5 rounded-[5px] bg-[#334155] mr-2.5 mt-1" />
            <View>
              <Text className="text-[#E2E8F0] font-semibold">Item Pickup</Text>
              <Text className="text-[#94A3B8] mt-1">
                Staff will coordinate a secure handoff location.
              </Text>
            </View>
          </View>
        </View>
      )}

      <View className="bg-[#F8FAFC] rounded-4 p-4 mb-4 border-[1px] border-[#E2E8F0]">
        <Text className="text-[#1E293B] font-semibold mb-2.5">Complaint About TTR/TTE Staff</Text>
        <Text className="text-[#94A3B8] mb-4 line-height-[20]">
          Report misconduct or issues with railway staff members
        </Text>
        <View className="mb-3.5">
          <Text className="text-[#475569] text-xs mb-1.5 font-medium">Complaint Type</Text>
          <TextInput
            className="bg-[#F8FAFC] border-[#CBD5E1] border-[1px] rounded-3 py-3 px-3.5 text-[#1E293B]"
            placeholder="Misbehavior / Negligence / Corruption / Other"
            placeholderTextColor="#94A3B8"
            value={staffComplaintType}
            onChangeText={setStaffComplaintType}
          />
        </View>
        <View className="mb-3.5">
          <Text className="text-[#475569] text-xs mb-1.5 font-medium">Staff Member (TTR/TTE)</Text>
          <TextInput
            className="bg-[#F8FAFC] border-[#CBD5E1] border-[1px] rounded-3 py-3 px-3.5 text-[#1E293B]"
            placeholder="Name / Badge Number / Physical description"
            placeholderTextColor="#94A3B8"
            value={staffComplaintTarget}
            onChangeText={setStaffComplaintTarget}
          />
        </View>
        <View className="mb-3.5">
          <Text className="text-[#475569] text-xs mb-1.5 font-medium">Details of Incident</Text>
          <TextInput
            className="bg-[#F8FAFC] border-[#CBD5E1] border-[1px] rounded-3 py-3 px-3.5 text-[#1E293B] min-h-[100] text-align-vertical-[top]"
            placeholder="Describe the incident in detail..."
            placeholderTextColor="#94A3B8"
            value={staffComplaintDetails}
            onChangeText={setStaffComplaintDetails}
            multiline
            numberOfLines={4}
          />
        </View>
        <TouchableOpacity
          className="bg-[#2563EB] rounded-3 py-3.5 items-center mt-1.5 shadow-md"
          onPress={handleSubmitStaffComplaint}
        >
          <Text className="text-[#F8FAFC] font-semibold letter-spacing-[0.3]">Submit Staff Complaint</Text>
        </TouchableOpacity>
      </View>

      {staffComplaintSubmitted && (
        <View className="bg-[#F8FAFC] rounded-4 p-4 mb-4 border-[1px] border-[#E2E8F0]">
          <Text className="text-[#1E293B] font-semibold mb-2.5">Complaint Status</Text>
          <Text className="text-[#16A34A] mt-2.5 font-semibold">
            ✅ Complaint submitted successfully
          </Text>
          <Text className="text-[#475569] mb-1.5">
            Complaint ID: SC-{Math.floor(Math.random() * 100000)}
          </Text>
          <Text className="text-[#475569] mb-1.5">Status: Under Review</Text>
          <Text className="text-[#475569] mb-1.5">
            Assigned to: Railway Grievance Cell
          </Text>
          <View className="flex-row items-center mt-2 mb-3">
            <View className="w-2.5 h-2.5 rounded-[5px] bg-[#22C55E] mr-2" />
            <Text className="text-[#A7F3D0] flex-[1] line-height-[18]">
              Your complaint has been forwarded to senior railway authorities.
              You will receive updates via SMS and email.
            </Text>
          </View>
          <Text className="text-[#475569] mb-1.5">
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
        <View className="bg-[#FFFFFF] rounded-4 p-5 mb-5 border-[1px] border-[#E2E8F0] shadow">
          <View className="flex-row items-center mb-4 pb-4 border-b-[1] border-b-[#E2E8F0]">
            <View className="w-[60px] h-[60px] rounded-[30px] bg-[#2563EB] items-center justify-center mr-4">
              <Text className="text-[#FFFFFF] text-2xl font-bold">
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View className="flex-[1]">
              <Text className="text-xl font-bold text-[#1E293B] mb-1">{displayName}</Text>
              <Text className="text-sm text-[#64748B] font-medium">{role}</Text>
            </View>
          </View>

          <View className="mt-0">
            <View className="flex-row justify-space-between items-center mb-3">
              <Text className="text-sm text-[#64748B] font-medium flex-[1]">Email:</Text>
              <Text className="text-sm text-[#1E293B] font-semibold flex-[2] text-right">{displayEmail}</Text>
            </View>
            <View className="flex-row justify-space-between items-center mb-3">
              <Text className="text-sm text-[#64748B] font-medium flex-[1]">Phone:</Text>
              <Text className="text-sm text-[#1E293B] font-semibold flex-[2] text-right">{displayPhone}</Text>
            </View>
            <View className="flex-row justify-space-between items-center mb-3">
              <Text className="text-sm text-[#64748B] font-medium flex-[1]">Vehicle:</Text>
              <Text className="text-sm text-[#1E293B] font-semibold flex-[2] text-right">
                {displayVehicleNumber}
              </Text>
            </View>
            <View className="flex-row justify-space-between items-center mb-3">
              <Text className="text-sm text-[#64748B] font-medium flex-[1]">Route:</Text>
              <Text className="text-sm text-[#1E293B] font-semibold flex-[2] text-right">{displayRoute}</Text>
            </View>
            <View className="flex-row justify-space-between items-center mb-3">
              <Text className="text-sm text-[#64748B] font-medium flex-[1]">Shift:</Text>
              <Text className="text-sm text-[#1E293B] font-semibold flex-[2] text-right">{displayShift}</Text>
            </View>
            <View className="flex-row justify-space-between items-center mb-3">
              <Text className="text-sm text-[#64748B] font-medium flex-[1]">Stops:</Text>
              <Text className="text-sm text-[#1E293B] font-semibold flex-[2] text-right">
                {displayFromStop} → {displayToStop}
              </Text>
            </View>
          </View>
        </View>

        <Text className="text-xl font-bold text-[#1E293B] mb-1.5">{role} Duty Dashboard</Text>
        <Text className="text-[#94A3B8] mb-4 line-height-[20]">
          Live queue, QR handoffs, and custody logs for your duty roster.
        </Text>

        <View className="bg-[#F8FAFC] rounded-4 p-4 mb-4 border-[1px] border-[#E2E8F0]">
          <Text className="text-[#1E293B] font-semibold mb-2.5">Active Complaint Queue</Text>
          {Array.isArray(displayAlerts) && displayAlerts.length > 0 ? (
            displayAlerts.slice(0, 5).map((alert) => (
              <View key={alert.id} className="flex-row justify-space-between items-center py-2.5 border-b-[1] border-b-[#1E2A44]">
                <View>
                  <Text className="text-[#F8FAFC] font-semibold">{alert.itemType || "Item"}</Text>
                  <Text className="text-[#94A3B8] mt-1">
                    {alert.vehicleNumber || "Train"} • {alert.nextStation || alert.route || "Transit"}
                  </Text>
                </View>
                <Text className={alert.priority === "High" ? "text-[#F59E0B] font-bold" : "text-[#22C55E] font-bold"}>
                  {alert.priority || "NORMAL"}
                </Text>
              </View>
            ))
          ) : (
            <Text className="text-slate-500 text-center italic py-2">No active complaints assigned. Check back for new assignments.</Text>
          )}
          {Array.isArray(displayAlerts) && displayAlerts.length > 0 && (
            <TouchableOpacity
              className="bg-[#2563EB] rounded-3 py-3.5 items-center mt-1.5 shadow-md"
              onPress={handleStaffConfirm}
            >
              <Text className="text-[#F8FAFC] font-semibold letter-spacing-[0.3]">Mark item SAFE</Text>
            </TouchableOpacity>
          )}
        </View>

        {staffConfirmed && (
          <View className="bg-[#F8FAFC] rounded-4 p-4 mb-4 border-[1px] border-[#E2E8F0]">
            <Text className="text-[#1E293B] font-semibold mb-2.5">Custody & Handoff</Text>
            <Text className="text-[#475569] mb-1.5">Item custody logged.</Text>
            <Text className="text-[#475569] mb-1.5">Ready for passenger pickup or handover coordination.</Text>
            <TouchableOpacity
              className="border-[1px] border-[#38BDF8] rounded-3 py-3 items-center"
              onPress={handleHandoffComplete}
            >
              <Text className="text-[#38BDF8] font-semibold">Complete Handoff</Text>
            </TouchableOpacity>
            {handoffComplete && (
              <Text className="text-[#16A34A] mt-2.5 font-semibold">
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
    const displayEmail = email.trim() || "Not set";
    const displayProfessionalId = professionalId.trim() || "Not set";
    const displayRole = specificRole || "TTR";
    const displayJurisdiction = jurisdiction.trim() || "Chennai Division";
    const displayPnrRange = pnrRange.trim() || "4500000000 - 4599999999";
    const trainNumber = travelNumber.trim() || "12631";
    const coachAllotted = "S3";
    const shiftTime = "08:00 AM - 04:00 PM";

    return (
      <View>
        <View className="bg-[#0F172A] rounded-[18px] p-[18px] mb-[18px] border-[1px] border-[#1E293B]">
          <View className="flex-row justify-space-between items-center">
            <View>
              <Text className="text-[#F8FAFC] text-xl font-bold mb-1">{displayName}</Text>
              <Text className="text-[#CBD5F5] text-xs font-semibold">
                🎫 TTR - Train Ticket Examiner
              </Text>
            </View>
            <View className="flex-row items-center bg-[#E0E7FF] rounded-[999px] py-1 px-2.5">
              <Ionicons
                name="notifications"
                size={16}
                color="#1E40AF"
                className="mr-1.5"
              />
              <Text className="text-[#1E40AF] font-bold">3</Text>
            </View>
          </View>
          <View className="flex-row flex-wrap mt-3">
            <View className="bg-[#1E293B] rounded-[999px] py-1.5 px-3 mr-2 mb-2 border-[1px] border-[#334155]">
              <Text className="text-[#E2E8F0] text-xs font-semibold">Train {trainNumber}</Text>
            </View>
            <View className="bg-[#1E293B] rounded-[999px] py-1.5 px-3 mr-2 mb-2 border-[1px] border-[#334155]">
              <Text className="text-[#E2E8F0] text-xs font-semibold">Coach {coachAllotted}</Text>
            </View>
            <View className="bg-[#1E293B] rounded-[999px] py-1.5 px-3 mr-2 mb-2 border-[1px] border-[#334155]">
              <Text className="text-[#E2E8F0] text-xs font-semibold">Shift {shiftTime}</Text>
            </View>
          </View>
          <View className="mt-3 flex-row items-center justify-space-between">
            <Text className="text-[#E2E8F0] font-semibold">On Duty</Text>
            <TouchableOpacity
              className={`w-[52px] h-7 rounded-4 p-[3px] justify-center ${onDuty ? "bg-[#22C55E]" : "bg-[#334155]"}`}
              onPress={() => setOnDuty((prev) => !prev)}
            >
              <View
                className={`w-[22px] h-[22px] rounded-[11px] bg-[#F8FAFC] ${onDuty ? "self-end" : "self-start"}`}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View className="bg-[#FFFFFF] rounded-4 p-5 mb-5 border-[1px] border-[#E2E8F0] shadow">
          <View className="flex-row items-center mb-4 pb-4 border-b-[1] border-b-[#E2E8F0]">
            <View className="w-[60px] h-[60px] rounded-[30px] bg-[#2563EB] items-center justify-center mr-4">
              <Text className="text-[#FFFFFF] text-2xl font-bold">
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View className="flex-[1]">
              <Text className="text-xl font-bold text-[#1E293B] mb-1">{displayName}</Text>
              <Text className="text-sm text-[#64748B] font-medium">{displayRole} Officer</Text>
            </View>
          </View>

          <View className="mt-0">
            <View className="flex-row justify-space-between items-center mb-3">
              <Text className="text-sm text-[#64748B] font-medium flex-[1]">Professional ID:</Text>
              <Text className="text-sm text-[#1E293B] font-semibold flex-[2] text-right">
                {displayProfessionalId}
              </Text>
            </View>
            <View className="flex-row justify-space-between items-center mb-3">
              <Text className="text-sm text-[#64748B] font-medium flex-[1]">Official Email:</Text>
              <Text className="text-sm text-[#1E293B] font-semibold flex-[2] text-right">{displayEmail}</Text>
            </View>
            <View className="flex-row justify-space-between items-center mb-3">
              <Text className="text-sm text-[#64748B] font-medium flex-[1]">Jurisdiction:</Text>
              <Text className="text-sm text-[#1E293B] font-semibold flex-[2] text-right">
                {displayJurisdiction}
              </Text>
            </View>
            <View className="flex-row justify-space-between items-center mb-3">
              <Text className="text-sm text-[#64748B] font-medium flex-[1]">PNR Range:</Text>
              <Text className="text-sm text-[#1E293B] font-semibold flex-[2] text-right">{displayPnrRange}</Text>
            </View>
          </View>
        </View>

        <View className="bg-[#F8FAFC] rounded-4 p-4 mb-4 border-[1px] border-[#E2E8F0]">
          <Text className="text-[#1E293B] font-semibold mb-2.5">Active Assignments</Text>
          {Array.isArray(displayAlerts) && displayAlerts.length > 0 ? (
            <View>
              <Text className="text-[#475569] mb-1.5">
                You have {displayAlerts.length} assigned complaint{displayAlerts.length !== 1 ? "s" : ""}.
              </Text>
              <View className="bg-[#FEF2F2] rounded-4 p-4 mb-4 border-[1px] border-[#FECACA]">
                {displayAlerts[0] && (
                  <View>
                    <Text className="text-[#B91C1C] font-bold mb-2">CURRENT ASSIGNMENT</Text>
                    <Text className="text-[#7F1D1D] mb-1">Passenger: {displayAlerts[0].passengerName || "Passenger"}</Text>
                    <Text className="text-[#7F1D1D] mb-1">Item: {displayAlerts[0].itemType || "Item"}</Text>
                    {displayAlerts[0].vehicleNumber && (
                      <Text className="text-[#7F1D1D] mb-1">Vehicle: {displayAlerts[0].vehicleNumber}</Text>
                    )}
                    {displayAlerts[0].nextStation && (
                      <Text className="text-[#7F1D1D] mb-1">Location: {displayAlerts[0].nextStation}</Text>
                    )}
                    <Text className="text-[#7F1D1D] mb-1">Status: {displayAlerts[0].status || "Pending"}</Text>
                    <View className="flex-row mt-3">
                      <TouchableOpacity
                        className="flex-[1] rounded-3 py-3 items-center border-[1px] border-[#2563EB] bg-[#EFF6FF]"
                      >
                        <Text className="text-[#1D4ED8] font-semibold">View details</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        className={`${"flex-[1] rounded-3 py-3 items-center"} ${"bg-[#2563EB]"} ${"ml-2.5"}`}
                        onPress={handleStaffConfirm}
                      >
                        <Text className="text-[#F8FAFC] font-semibold">Action</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            </View>
          ) : (
            <Text className="text-[#475569] mb-1.5">No active assignments. Check back for new cases.</Text>
          )}
        </View>

        <View className="bg-[#F8FAFC] rounded-4 p-4 mb-4 border-[1px] border-[#E2E8F0]">
          <Text className="text-[#1E293B] font-semibold mb-2.5">Complaint Resolution</Text>
          <View className="mb-2">
            <Text className="text-[#475569] mb-1.5">✅ Item found and documented</Text>
            <Text className="text-[#475569] mb-1.5">❌ Item not located</Text>
            <Text className="text-[#475569] mb-1.5">🔁 Escalate for further investigation</Text>
            <Text className="text-[#475569] mb-1.5">📞 Passenger contacted</Text>
          </View>
          <Text className="text-[#64748B] text-xs mt-1.5">
            Update status to keep passenger informed of progress.
          </Text>
          <View className="flex-row mt-3">
            <TouchableOpacity
              className="flex-[1] rounded-3 py-3 items-center border-[1px] border-[#2563EB] bg-[#EFF6FF]"
            >
              <Text className="text-[#1D4ED8] font-semibold">View Case</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`${"flex-[1] rounded-3 py-3 items-center"} ${"bg-[#2563EB]"} ${"ml-2.5"}`}
            >
              <Text className="text-[#F8FAFC] font-semibold">Update Status</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View className="bg-[#F8FAFC] rounded-4 p-4 mb-4 border-[1px] border-[#E2E8F0]">
          <Text className="text-[#1E293B] font-semibold mb-2.5">Officer Communication</Text>
          <View className="flex-row flex-wrap mb-3">
            <View className="bg-[#E2E8F0] py-1.5 px-2.5 rounded-[999px] mr-2 mb-2">
              <Text className="text-[#1E293B] text-xs font-semibold">"Item secured in S3"</Text>
            </View>
            <View className="bg-[#E2E8F0] py-1.5 px-2.5 rounded-[999px] mr-2 mb-2">
              <Text className="text-[#1E293B] text-xs font-semibold">
                "Collect at Trichy station"
              </Text>
            </View>
            <View className="bg-[#E2E8F0] py-1.5 px-2.5 rounded-[999px] mr-2 mb-2">
              <Text className="text-[#1E293B] text-xs font-semibold">"Bring ID proof"</Text>
            </View>
          </View>
          <TouchableOpacity className="border-[1px] border-[#38BDF8] rounded-3 py-3 items-center">
            <Text className="text-[#38BDF8] font-semibold">Send update</Text>
          </TouchableOpacity>
        </View>

        <View className="bg-[#F8FAFC] rounded-4 p-4 mb-4 border-[1px] border-[#E2E8F0]">
          <Text className="text-[#1E293B] font-semibold mb-2.5">QR Handover</Text>
          <Text className="text-[#475569] mb-1.5">
            Generate and scan for custody log.
          </Text>
          <View className="flex-row mt-3">
            <TouchableOpacity
              className="flex-[1] rounded-3 py-3 items-center bg-[#2563EB]"
            >
              <Text className="text-[#F8FAFC] font-semibold">Generate QR</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`${"flex-[1] rounded-3 py-3 items-center"} ${"border-[1px] border-[#2563EB] bg-[#EFF6FF]"} ${"ml-2.5"}`}
            >
              <Text className="text-[#1D4ED8] font-semibold">Scan QR</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View className="bg-[#F8FAFC] rounded-4 p-4 mb-4 border-[1px] border-[#E2E8F0]">
          <Text className="text-[#1E293B] font-semibold mb-2.5">TTR Performance</Text>
          <View className="flex-row flex-wrap justify-space-between">
            <View className="w-[48%] bg-[#FFFFFF] rounded-3 p-3 mb-2.5 border-[1px] border-[#E2E8F0]">
              <Text className="text-[#1E293B] text-lg font-bold">8</Text>
              <Text className="text-[#64748B] text-xs mt-1">Cases handled</Text>
            </View>
            <View className="w-[48%] bg-[#FFFFFF] rounded-3 p-3 mb-2.5 border-[1px] border-[#E2E8F0]">
              <Text className="text-[#1E293B] text-lg font-bold">5</Text>
              <Text className="text-[#64748B] text-xs mt-1">Items secured</Text>
            </View>
            <View className="w-[48%] bg-[#FFFFFF] rounded-3 p-3 mb-2.5 border-[1px] border-[#E2E8F0]">
              <Text className="text-[#1E293B] text-lg font-bold">2</Text>
              <Text className="text-[#64748B] text-xs mt-1">Escalated</Text>
            </View>
            <View className="w-[48%] bg-[#FFFFFF] rounded-3 p-3 mb-2.5 border-[1px] border-[#E2E8F0]">
              <Text className="text-[#1E293B] text-lg font-bold">6m</Text>
              <Text className="text-[#64748B] text-xs mt-1">Avg response</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderRpfDashboard = () => {
    const displayName = name.trim() || "Officer";
    const displayEmail = email.trim() || "Not set";
    const displayProfessionalId = professionalId.trim() || "RPF-CH-11456";
    const displayJurisdiction = jurisdiction.trim() || "Chennai Central Zone";

    return (
      <View>
        <View className="bg-[#0F172A] rounded-[18px] p-[18px] mb-[18px] border-[1px] border-[#1E293B]">
          <View className="flex-row justify-space-between items-center">
            <View>
              <Text className="text-[#F8FAFC] text-xl font-bold mb-1">{displayName}</Text>
              <Text className="text-[#CBD5F5] text-xs font-semibold">
                🛡 RPF - Railway Protection Force
              </Text>
            </View>
            <View className="flex-row items-center bg-[#E0E7FF] rounded-[999px] py-1 px-2.5">
              <Ionicons
                name="notifications"
                size={16}
                color="#1E40AF"
                className="mr-1.5"
              />
              <Text className="text-[#1E40AF] font-bold">2</Text>
            </View>
          </View>
          <View className="flex-row flex-wrap mt-3">
            <View className="bg-[#1E293B] rounded-[999px] py-1.5 px-3 mr-2 mb-2 border-[1px] border-[#334155]">
              <Text className="text-[#E2E8F0] text-xs font-semibold">
                Badge {displayProfessionalId}
              </Text>
            </View>
            <View className="bg-[#1E293B] rounded-[999px] py-1.5 px-3 mr-2 mb-2 border-[1px] border-[#334155]">
              <Text className="text-[#E2E8F0] text-xs font-semibold">{displayJurisdiction}</Text>
            </View>
          </View>
          <View className="mt-3 flex-row items-center justify-space-between">
            <Text className="text-[#E2E8F0] font-semibold">On Duty</Text>
            <TouchableOpacity
              className={`w-[52px] h-7 rounded-4 p-[3px] justify-center ${onDuty ? "bg-[#22C55E]" : "bg-[#334155]"}`}
              onPress={() => setOnDuty((prev) => !prev)}
            >
              <View
                className={`w-[22px] h-[22px] rounded-[11px] bg-[#F8FAFC] ${onDuty ? "self-end" : "self-start"}`}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View className="bg-[#FFFFFF] rounded-4 p-5 mb-5 border-[1px] border-[#E2E8F0] shadow">
          <View className="flex-row items-center mb-4 pb-4 border-b-[1] border-b-[#E2E8F0]">
            <View className="w-[60px] h-[60px] rounded-[30px] bg-[#2563EB] items-center justify-center mr-4">
              <Text className="text-[#FFFFFF] text-2xl font-bold">
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View className="flex-[1]">
              <Text className="text-xl font-bold text-[#1E293B] mb-1">{displayName}</Text>
              <Text className="text-sm text-[#64748B] font-medium">RPF Officer</Text>
            </View>
          </View>

          <View className="mt-0">
            <View className="flex-row justify-space-between items-center mb-3">
              <Text className="text-sm text-[#64748B] font-medium flex-[1]">Badge ID:</Text>
              <Text className="text-sm text-[#1E293B] font-semibold flex-[2] text-right">
                {displayProfessionalId}
              </Text>
            </View>
            <View className="flex-row justify-space-between items-center mb-3">
              <Text className="text-sm text-[#64748B] font-medium flex-[1]">Official Email:</Text>
              <Text className="text-sm text-[#1E293B] font-semibold flex-[2] text-right">{displayEmail}</Text>
            </View>
            <View className="flex-row justify-space-between items-center mb-3">
              <Text className="text-sm text-[#64748B] font-medium flex-[1]">Assigned Zone:</Text>
              <Text className="text-sm text-[#1E293B] font-semibold flex-[2] text-right">
                {displayJurisdiction}
              </Text>
            </View>
          </View>
        </View>

        <View className="bg-[#FEF2F2] rounded-4 p-4 mb-4 border-[1px] border-[#FECACA]">
          <Text className="text-[#B91C1C] font-bold mb-2">🚨 HIGH PRIORITY ALERT</Text>
          <Text className="text-[#7F1D1D] mb-1">Item: Laptop</Text>
          <Text className="text-[#7F1D1D] mb-1">Location: Train 12631 - S3</Text>
          <Text className="text-[#7F1D1D] mb-1">Escalated by: TTR</Text>
          <Text className="text-[#7F1D1D] mb-1">Reason: Possible theft</Text>
          <Text className="text-[#7F1D1D] mb-1">Reported: 10:30 AM</Text>
          <View className="flex-row mt-3">
            <TouchableOpacity
              className="flex-[1] rounded-3 py-3 items-center bg-[#2563EB]"
            >
              <Text className="text-[#F8FAFC] font-semibold">Investigate</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`${"flex-[1] rounded-3 py-3 items-center"} ${"border-[1px] border-[#2563EB] bg-[#EFF6FF]"} ${"ml-2.5"}`}
            >
              <Text className="text-[#1D4ED8] font-semibold">
                Contact passenger
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View className="bg-[#F8FAFC] rounded-4 p-4 mb-4 border-[1px] border-[#E2E8F0]">
          <Text className="text-[#1E293B] font-semibold mb-2.5">Investigation Screen</Text>
          <View className="mb-2">
            <Text className="text-[#475569] mb-1.5">🗺 View coach map</Text>
            <Text className="text-[#475569] mb-1.5">📞 Contact TTR</Text>
            <Text className="text-[#475569] mb-1.5">👥 Contact passenger</Text>
            <Text className="text-[#475569] mb-1.5">📝 Record statement</Text>
            <Text className="text-[#475569] mb-1.5">📸 Upload evidence photo</Text>
          </View>
        </View>

        <View className="bg-[#F8FAFC] rounded-4 p-4 mb-4 border-[1px] border-[#E2E8F0]">
          <Text className="text-[#1E293B] font-semibold mb-2.5">Secure Custody Module</Text>
          <Text className="text-[#475569] mb-1.5">If item recovered:</Text>
          <View className="mb-2">
            <Text className="text-[#475569] mb-1.5">• Log station and GPS</Text>
            <Text className="text-[#475569] mb-1.5">• Upload recovery proof</Text>
            <Text className="text-[#475569] mb-1.5">• Assign case ID</Text>
            <Text className="text-[#475569] mb-1.5">
              • Transfer to police if needed
            </Text>
          </View>
          <TouchableOpacity className="border-[1px] border-[#38BDF8] rounded-3 py-3 items-center">
            <Text className="text-[#38BDF8] font-semibold">Create custody log</Text>
          </TouchableOpacity>
        </View>

        <View className="bg-[#F8FAFC] rounded-4 p-4 mb-4 border-[1px] border-[#E2E8F0]">
          <Text className="text-[#1E293B] font-semibold mb-2.5">Case Monitoring</Text>
          <View className="flex-row flex-wrap justify-space-between">
            <View className="w-[48%] bg-[#FFFFFF] rounded-3 p-3 mb-2.5 border-[1px] border-[#E2E8F0]">
              <Text className="text-[#1E293B] text-lg font-bold">6</Text>
              <Text className="text-[#64748B] text-xs mt-1">Active investigations</Text>
            </View>
            <View className="w-[48%] bg-[#FFFFFF] rounded-3 p-3 mb-2.5 border-[1px] border-[#E2E8F0]">
              <Text className="text-[#1E293B] text-lg font-bold">12</Text>
              <Text className="text-[#64748B] text-xs mt-1">Closed cases</Text>
            </View>
            <View className="w-[48%] bg-[#FFFFFF] rounded-3 p-3 mb-2.5 border-[1px] border-[#E2E8F0]">
              <Text className="text-[#1E293B] text-lg font-bold">4</Text>
              <Text className="text-[#64748B] text-xs mt-1">Escalations today</Text>
            </View>
            <View className="w-[48%] bg-[#FFFFFF] rounded-3 p-3 mb-2.5 border-[1px] border-[#E2E8F0]">
              <Text className="text-[#1E293B] text-lg font-bold">9m</Text>
              <Text className="text-[#64748B] text-xs mt-1">Avg response</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderPoliceDashboard = () => {
    const displayName = name.trim() || "Officer";
    const displayEmail = email.trim() || "Not set";
    const displayProfessionalId = professionalId.trim() || "Not set";
    const displayRole = specificRole || "Police";
    const displayJurisdiction = jurisdiction.trim() || "Trichy";
    const displayStation = "Trichy Junction";

    return (
      <View>
        <View className="bg-[#0F172A] rounded-[18px] p-[18px] mb-[18px] border-[1px] border-[#1E293B]">
          <View className="flex-row justify-space-between items-center">
            <View>
              <Text className="text-[#F8FAFC] text-xl font-bold mb-1">{displayName}</Text>
              <Text className="text-[#CBD5F5] text-xs font-semibold">👮 Police</Text>
            </View>
            <View className="flex-row items-center bg-[#E0E7FF] rounded-[999px] py-1 px-2.5">
              <Ionicons
                name="alert-circle"
                size={16}
                color="#B91C1C"
                className="mr-1.5"
              />
              <Text className="text-[#1E40AF] font-bold">1</Text>
            </View>
          </View>
          <View className="flex-row flex-wrap mt-3">
            <View className="bg-[#1E293B] rounded-[999px] py-1.5 px-3 mr-2 mb-2 border-[1px] border-[#334155]">
              <Text className="text-[#E2E8F0] text-xs font-semibold">{displayStation}</Text>
            </View>
            <View className="bg-[#1E293B] rounded-[999px] py-1.5 px-3 mr-2 mb-2 border-[1px] border-[#334155]">
              <Text className="text-[#E2E8F0] text-xs font-semibold">{displayJurisdiction}</Text>
            </View>
            <View className="bg-[#1E293B] rounded-[999px] py-1.5 px-3 mr-2 mb-2 border-[1px] border-[#334155]">
              <Text className="text-[#E2E8F0] text-xs font-semibold">
                Duty {onDuty ? "ON" : "OFF"}
              </Text>
            </View>
          </View>
          <View className="mt-3 flex-row items-center justify-space-between">
            <Text className="text-[#E2E8F0] font-semibold">Duty Status</Text>
            <TouchableOpacity
              className={`w-[52px] h-7 rounded-4 p-[3px] justify-center ${onDuty ? "bg-[#22C55E]" : "bg-[#334155]"}`}
              onPress={() => setOnDuty((prev) => !prev)}
            >
              <View
                className={`w-[22px] h-[22px] rounded-[11px] bg-[#F8FAFC] ${onDuty ? "self-end" : "self-start"}`}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View className="bg-[#FFFFFF] rounded-4 p-5 mb-5 border-[1px] border-[#E2E8F0] shadow">
          <View className="flex-row items-center mb-4 pb-4 border-b-[1] border-b-[#E2E8F0]">
            <View className="w-[60px] h-[60px] rounded-[30px] bg-[#2563EB] items-center justify-center mr-4">
              <Text className="text-[#FFFFFF] text-2xl font-bold">
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View className="flex-[1]">
              <Text className="text-xl font-bold text-[#1E293B] mb-1">{displayName}</Text>
              <Text className="text-sm text-[#64748B] font-medium">{displayRole} Officer</Text>
            </View>
          </View>

          <View className="mt-0">
            <View className="flex-row justify-space-between items-center mb-3">
              <Text className="text-sm text-[#64748B] font-medium flex-[1]">Professional ID:</Text>
              <Text className="text-sm text-[#1E293B] font-semibold flex-[2] text-right">
                {displayProfessionalId}
              </Text>
            </View>
            <View className="flex-row justify-space-between items-center mb-3">
              <Text className="text-sm text-[#64748B] font-medium flex-[1]">Station:</Text>
              <Text className="text-sm text-[#1E293B] font-semibold flex-[2] text-right">{displayStation}</Text>
            </View>
            <View className="flex-row justify-space-between items-center mb-3">
              <Text className="text-sm text-[#64748B] font-medium flex-[1]">Jurisdiction:</Text>
              <Text className="text-sm text-[#1E293B] font-semibold flex-[2] text-right">
                {displayJurisdiction}
              </Text>
            </View>
            <View className="flex-row justify-space-between items-center mb-3">
              <Text className="text-sm text-[#64748B] font-medium flex-[1]">Official Email:</Text>
              <Text className="text-sm text-[#1E293B] font-semibold flex-[2] text-right">{displayEmail}</Text>
            </View>
          </View>
        </View>

        <View className="bg-[#FEF2F2] rounded-4 p-4 mb-4 border-[1px] border-[#FECACA]">
          <Text className="text-[#B91C1C] font-bold mb-2">🚨 LEGAL CASE ALERT</Text>
          <Text className="text-[#7F1D1D] mb-1">Item: Passport</Text>
          <Text className="text-[#7F1D1D] mb-1">Train: 12631</Text>
          <Text className="text-[#7F1D1D] mb-1">Station: Trichy</Text>
          <Text className="text-[#7F1D1D] mb-1">Escalated by: RPF</Text>
          <Text className="text-[#7F1D1D] mb-1">Case ID: SG-2026-108</Text>
          <View className="flex-row mt-3">
            <TouchableOpacity
              className="flex-[1] rounded-3 py-3 items-center bg-[#2563EB]"
            >
              <Text className="text-[#F8FAFC] font-semibold">Open case</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`${"flex-[1] rounded-3 py-3 items-center"} ${"border-[1px] border-[#2563EB] bg-[#EFF6FF]"} ${"ml-2.5"}`}
            >
              <Text className="text-[#1D4ED8] font-semibold">Contact RPF</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View className="bg-[#F8FAFC] rounded-4 p-4 mb-4 border-[1px] border-[#E2E8F0]">
          <Text className="text-[#1E293B] font-semibold mb-2.5">Case Management</Text>
          <View className="mb-2">
            <Text className="text-[#475569] mb-1.5">Case ID: SG-2026-108</Text>
            <Text className="text-[#475569] mb-1.5">Passenger: Ramya V</Text>
            <Text className="text-[#475569] mb-1.5">Aadhaar verified</Text>
            <Text className="text-[#475569] mb-1.5">Evidence uploaded</Text>
            <Text className="text-[#475569] mb-1.5">Investigation notes ready</Text>
          </View>
          <TouchableOpacity className="border-[1px] border-[#38BDF8] rounded-3 py-3 items-center">
            <Text className="text-[#38BDF8] font-semibold">FIR (Optional)</Text>
          </TouchableOpacity>
        </View>

        <View className="bg-[#F8FAFC] rounded-4 p-4 mb-4 border-[1px] border-[#E2E8F0]">
          <Text className="text-[#1E293B] font-semibold mb-2.5">Inter-Jurisdiction Transfer</Text>
          <Text className="text-[#475569] mb-1.5">
            Forward to nearest police station for passenger city.
          </Text>
          <View className="mb-2">
            <Text className="text-[#475569] mb-1.5">• Digital case transfer</Text>
            <Text className="text-[#475569] mb-1.5">• Status update to passenger</Text>
          </View>
          <TouchableOpacity className="border-[1px] border-[#38BDF8] rounded-3 py-3 items-center">
            <Text className="text-[#38BDF8] font-semibold">Start transfer</Text>
          </TouchableOpacity>
        </View>

        <View className="bg-[#F8FAFC] rounded-4 p-4 mb-4 border-[1px] border-[#E2E8F0]">
          <Text className="text-[#1E293B] font-semibold mb-2.5">Secure Handover Logging</Text>
          <View className="mb-2">
            <Text className="text-[#475569] mb-1.5">Verify passenger ID</Text>
            <Text className="text-[#475569] mb-1.5">Capture signature</Text>
            <Text className="text-[#475569] mb-1.5">GPS log</Text>
            <Text className="text-[#475569] mb-1.5">Close legal case</Text>
          </View>
        </View>

        <View className="bg-[#F8FAFC] rounded-4 p-4 mb-4 border-[1px] border-[#E2E8F0]">
          <Text className="text-[#1E293B] font-semibold mb-2.5">Police Analytics</Text>
          <View className="flex-row flex-wrap justify-space-between">
            <View className="w-[48%] bg-[#FFFFFF] rounded-3 p-3 mb-2.5 border-[1px] border-[#E2E8F0]">
              <Text className="text-[#1E293B] text-lg font-bold">3</Text>
              <Text className="text-[#64748B] text-xs mt-1">Legal cases today</Text>
            </View>
            <View className="w-[48%] bg-[#FFFFFF] rounded-3 p-3 mb-2.5 border-[1px] border-[#E2E8F0]">
              <Text className="text-[#1E293B] text-lg font-bold">12</Text>
              <Text className="text-[#64748B] text-xs mt-1">Resolved cases</Text>
            </View>
            <View className="w-[48%] bg-[#FFFFFF] rounded-3 p-3 mb-2.5 border-[1px] border-[#E2E8F0]">
              <Text className="text-[#1E293B] text-lg font-bold">5</Text>
              <Text className="text-[#64748B] text-xs mt-1">Pending cases</Text>
            </View>
            <View className="w-[48%] bg-[#FFFFFF] rounded-3 p-3 mb-2.5 border-[1px] border-[#E2E8F0]">
              <Text className="text-[#1E293B] text-lg font-bold">2</Text>
              <Text className="text-[#64748B] text-xs mt-1">Cross-district transfers</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  // Role-based access validation
  const canAccessDashboard = () => {
    return Boolean(isAuthenticated);
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
          authToken={authToken}
          authUserId={authUserId}
          authUserRole={authUserRole}
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
      const resolvedSpecificRole =
        specificRole || inferSpecificRoleFromProfessionalId(professionalId) || "TTR";
      const sharedProps = {
        officerEmail: (email || email).trim(),
        professionalId: professionalId.trim(),
        staffName: name.trim(),
        specificRole: resolvedSpecificRole,
        authToken,
        authUserId,
        authUserRole,
        onDuty,
        setOnDuty,
        onLogout: handleLogout,
      };

      if (resolvedSpecificRole === "TTE") {
        return <TteDashboard {...sharedProps} />;
      }

      if (resolvedSpecificRole === "RPF") {
        return <RpfDashboard {...sharedProps} />;
      }

      if (resolvedSpecificRole === "Police") {
        return <PoliceDashboard {...sharedProps} />;
      }

      return (
        <TtrDashboard
          {...sharedProps}
          roleLabel={`${resolvedSpecificRole} dashboard`}
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
        <View className="flex-[1]">{renderDashboard()}</View>
      );
    }

    return (
      <ScrollView contentContainerClassName="p-5 pb-10">
        {renderDashboard()}
        {showStandaloneLogout && (
          <TouchableOpacity
            className="border-[1px] border-[#38BDF8] rounded-3 py-3 items-center mt-3"
            onPress={handleLogout}
          >
            <Text className="text-[#38BDF8] font-semibold">Log out</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    );
  };

  const insets = useSafeAreaInsets();

  return (
    <SafeAreaProvider>
      <SafeAreaView className="flex-[1] bg-[#FFFFFF]" style={{ paddingTop: insets.top }}>
        {isAuthenticated ? (
          <View className="flex-[1] bg-[#F8FAFC]">
            {renderAuthenticatedContent()}
          </View>
        ) : (
          <>
            <Animated.View
              className={`${"absolute w-[320px] h-[320px] rounded-[160px] bg-[#E0E7FF] opacity-[0.3] top-10 right-[-80px]"}`}
            />
            <KeyboardAvoidingView
              className="flex-[1]"
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
            >
              <ScrollView
                contentContainerStyle={{ flexGrow: 1, padding: 24, paddingBottom: 40 }}
                className={!keyboardVisible ? "justify-center" : ""}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                onScrollBeginDrag={Keyboard.dismiss}
                showsVerticalScrollIndicator={true}
                bounces={true}
                nestedScrollEnabled={true}
              >
                  <Animated.View
                    className={`${"w-[100%] bg-[#FFFFFF] rounded-5 p-6 border-[1px] border-[#E2E8F0] shadow-lg"}`}
                  >
                    <View className="flex-row justify-space-between items-center gap-3">
                      <Pressable
                        onHoverIn={startShieldShake}
                        onHoverOut={stopShieldShake}
                      >
                        <Animated.View
                          className={`${"mr-2 items-center justify-center"}`} style={[{ translateX: shieldShake }]}
                        >
                          <Ionicons
                            name="shield-checkmark"
                            size={48}
                            color="#2563EB"
                          />
                        </Animated.View>
                      </Pressable>
                      <View className="flex-[1]">
                        <Animated.Text
                          className={`${"text-[28px] font-bold text-[#1E293B] mb-2"}`}
                        >
                          SafeRide Guardian
                        </Animated.Text>
                        <Text className="text-sm text-[#64748B] mb-5 line-height-[20]">
                          AI-powered role-based recovery for buses, trains,
                          cabs, autos.
                        </Text>
                        <View className="mt-3">
                          <View
                            className={`${"self-start py-1.5 px-3 rounded-[999px]"}`}
                          >
                            <Text className="text-xs font-semibold text-[#1F2937]">
                              {apiStatus === "online"
                                ? "Backend online"
                                : apiStatus === "offline"
                                  ? "Backend offline"
                                  : "Checking backend..."}
                            </Text>
                          </View>
                        </View>
                        {apiStatus === "offline" && apiError.length > 0 && (
                          <Text className="mt-2 text-xs text-[#DC2626]">{apiError}</Text>
                        )}
                      </View>
                    </View>
                    <View className="h-[1px] bg-[#E2E8F0] mb-[18px]" />

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
                        <View className="flex-row items-center mb-4">
                          <TouchableOpacity
                            className="p-2 mr-2"
                            onPress={handleRailwayLoginBack}
                          >
                            <Ionicons
                              name="arrow-back"
                              size={24}
                              color="#2563EB"
                            />
                          </TouchableOpacity>
                          <Text className="text-lg font-semibold text-[#1E293B] mb-4">
                            SafeRide Guardian
                          </Text>
                          <View style={{ width: 24 }} />
                        </View>
                        <Text className="text-xl font-bold text-[#1E293B] mb-1.5">
                          Choose Your Authority
                        </Text>
                        <Text className="text-[#94A3B8] mb-4 line-height-[20]">
                          Select one role to continue into the duty dashboard.
                        </Text>

                        <View className="mt-2 mb-3">
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
                              className={`${"bg-[#F8FAFC] rounded-4 p-4 border-[1px] border-[#E2E8F0] mb-3"} ${specificRole === item.key ? "border-[#2563EB] bg-[#EFF6FF]" : ""}`}
                              onPress={() => setSpecificRole(item.key)}
                            >
                              <Text className="text-[#0F172A] font-bold mb-1.5">
                                {item.title}
                              </Text>
                              <Text className="text-[#475569] line-height-[18]">
                                {item.description}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>

                        <View className="mb-2.5">
                          <Text className="text-[#64748B] text-xs mt-1.5">
                            Only one selectable.
                          </Text>
                          <Text className="text-[#64748B] text-xs mt-1.5">
                            Continue enabled after selection.
                          </Text>
                        </View>

                        {error.length > 0 && (
                          <Text className="text-[#F87171] mb-3">{error}</Text>
                        )}

                        <TouchableOpacity
                          className={`${"bg-[#2563EB] rounded-3 py-3.5 items-center mt-1.5 shadow-md"} ${!specificRole ? "opacity-[0.5]" : ""}`}
                          onPress={handleSpecificRoleSelection}
                          disabled={!specificRole}
                        >
                          <Text className="text-[#F8FAFC] font-semibold letter-spacing-[0.3]">Continue</Text>
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
                        <Text className="text-lg font-semibold text-[#1E293B] mb-4">
                          {isRegister
                            ? "Create your account"
                            : "Sign in to continue"}
                        </Text>
                        {isOfficialRole && !isRegister ? (
                          <View className="bg-[#EFF6FF] border-[1.5px] border-[#BFDBFE] rounded-4 p-3.5 gap-2.5 mb-1.5">
                            <View className="flex-row items-center gap-3">
                              <Ionicons name="shield-checkmark" size={26} color="#2563EB" />
                              <View className="flex-[1]">
                                <Text className="text-[#2563EB] text-[10px] font-extrabold letter-spacing-[1.2] text-transform-[uppercase]">Officer access</Text>
                                <Text className="text-[#1E40AF] text-[17px] font-black mt-[1px]">Railway staff sign-in</Text>
                              </View>
                            </View>
                            <Text className="text-[#475569] text-xs line-height-[18]">
                              Use your Professional ID and password to open the duty dashboard.
                            </Text>
                          </View>
                        ) : null}

                        {!isOfficialRole && (
                          <View className="mb-3.5">
                            <Text className="text-[#475569] text-xs mb-1.5 font-medium">
                              {requiredLabel("Select role")}
                            </Text>
                            {renderRoleSelector()}
                          </View>
                        )}


                        {isRegister && (
                          <View className="mb-3.5">
                            <Text className="text-[#475569] text-xs mb-1.5 font-medium">{requiredLabel("Full name")}</Text>
                            <TextInput
                              className="bg-[#F8FAFC] border-[#CBD5E1] border-[1px] rounded-3 py-3 px-3.5 text-[#1E293B]"
                              placeholder="Enter your name"
                              placeholderTextColor="#94A3B8"
                              value={name}
                              onChangeText={setName}
                              autoCapitalize="words"
                            />
                          </View>
                        )}

                        {isRegister && (
                          <View className="mb-3.5">
                            <Text className="text-[#475569] text-xs mb-1.5 font-medium">{requiredLabel("Mobile number")}</Text>
                            <TextInput
                              className="bg-[#F8FAFC] border-[#CBD5E1] border-[1px] rounded-3 py-3 px-3.5 text-[#1E293B]"
                              placeholder="+91 98765 43210"
                              placeholderTextColor="#94A3B8"
                              value={phone}
                              onChangeText={setPhone}
                              keyboardType="phone-pad"
                            />
                          </View>
                        )}

                        {(!isOfficialRole || !isRegister) && (
                          <View className="mb-3.5">
                            <AnimatedLabel
                              text={requiredLabel(isOfficialRole ? "Username" : "Email address")}
                              iconName="mail"
                            />
                            <TextInput
                              className={`${"bg-[#F8FAFC] border-[#CBD5E1] border-[1px] rounded-3 py-3 px-3.5 text-[#1E293B]"}`}
                              placeholder={isOfficialRole ? "officer.username / officer.email" : "you@example.com"}
                              placeholderTextColor="#94A3B8"
                              value={email}
                              onChangeText={setEmail}
                              autoCapitalize="none"
                              keyboardType={isOfficialRole ? "default" : "email-address"}
                              editable={!(isRegister && isVerified)}
                            />
                          </View>
                        )}

                        {isOfficialRole && !forgotPasswordMode && (
                          <View className="mb-3.5">
                            <Text className="text-[#475569] text-xs mb-1.5 font-medium">{requiredLabel("Professional ID / badge")}</Text>
                            <TextInput
                              className="bg-[#F8FAFC] border-[#CBD5E1] border-[1px] rounded-3 py-3 px-3.5 text-[#1E293B]"
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
                          <View className="mb-3.5">
                            <Text className="text-[#475569] text-xs mb-1.5 font-medium">{requiredLabel("Email")}</Text>
                            <TextInput
                              className={`bg-[#F8FAFC] border-[#CBD5E1] border-[1px] rounded-3 py-3 px-3.5 text-[#1E293B] ${isVerified ? "bg-[#E2E8F0] text-[#94A3B8]" : ""}`}
                              placeholder="name@example.com"
                              placeholderTextColor="#94A3B8"
                              value={email}
                              onChangeText={setEmail}
                              autoCapitalize="none"
                              keyboardType="email-address"
                              editable={!isVerified}
                            />
                            <Text className="text-[#64748B] text-xs mt-1.5">
                              Use your email for registration
                            </Text>
                          </View>
                        )}

                        {showPasswordInput && (
                          <View className="mb-3.5">
                            <AnimatedLabel text={requiredLabel("Password")} iconName="lock-closed" />
                            <View className="flex-row items-center">
                              <TextInput
                                className="bg-[#F8FAFC] border-[#CBD5E1] border-[1px] rounded-3 py-3 px-3.5 text-[#1E293B] flex-[1]"
                                placeholder="Enter your password"
                                placeholderTextColor="#94A3B8"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword}
                              />
                              <TouchableOpacity
                                className="ml-2.5 p-2 rounded-2.5 border-[1px] border-[#CBD5E1] bg-[#F8FAFC]"
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
                          <View className="mb-3.5">
                            <Text className="text-[#475569] text-xs mb-1.5 font-medium">{requiredLabel("Confirm password")}</Text>
                            <View className="flex-row items-center">
                              <TextInput
                                className="bg-[#F8FAFC] border-[#CBD5E1] border-[1px] rounded-3 py-3 px-3.5 text-[#1E293B] flex-[1]"
                                placeholder="Re-enter your password"
                                placeholderTextColor="#94A3B8"
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                secureTextEntry={!showConfirmPassword}
                              />
                              <TouchableOpacity
                                className="ml-2.5 p-2 rounded-2.5 border-[1px] border-[#CBD5E1] bg-[#F8FAFC]"
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
                                className={`mt-2 text-xs font-semibold ${isRegisterPasswordMatch ? "text-[#10B981]" : "text-[#F59E0B]"}`}
                              >
                                {isRegisterPasswordMatch
                                  ? "✓ Passwords match"
                                  : "○ Passwords do not match"}
                              </Text>
                            )}
                          </View>
                        )}

                        {!isRegister && !isOfficialRole && !isPostLoginOtpStep && (
                          <View className="flex-row justify-space-between items-center mb-3">
                            <Text className="text-[#64748B] text-xs mt-1.5">
                              {loginWithOtp
                                ? "Signing in with OTP"
                                : "Use OTP instead of password"}
                            </Text>
                            <View className="flex-row items-center gap-2">
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
                                <Text className="text-[#2563EB] font-semibold">
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
                                <Text className="text-[#2563EB] font-semibold">
                                  Reset password
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        )}

                        {!isRegister &&
                          isOfficialRole &&
                          !forgotPasswordMode && (
                            <View className="flex-row justify-space-between items-center mb-3">
                              <Text className="text-[#64748B] text-xs mt-1.5">
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
                                <Text className="text-[#2563EB] font-semibold">
                                  Reset password
                                </Text>
                              </TouchableOpacity>
                            </View>
                          )}

                        {!isRegister &&
                          isOfficialRole &&
                          forgotPasswordMode && (
                            <View className="bg-[#F8FAFC] rounded-4 p-4 mb-4 border-[1px] border-[#E2E8F0]">
                              <View className="flex-row items-center mb-4">
                                <TouchableOpacity
                                  className="p-2 mr-2"
                                  onPress={() => {
                                    setForgotPasswordMode(false);
                                    setResetCode("");
                                    setNewPassword("");
                                    setConfirmNewPassword("");
                                    setIsResetCodeSent(false);
                                    setResetSuccess(false);
                                    setEmail("");
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
                                <Text className="text-[#1E293B] font-semibold mb-2.5">
                                  Reset Password
                                </Text>
                                <View style={{ width: 24 }} />
                              </View>
                              <Text className="text-[#94A3B8] mb-4 line-height-[20]">
                                We'll send a verification code to your
                                registered official email
                              </Text>

                              {!isResetCodeSent ? (
                                <>
                                  <View className="mb-3.5">
                                    <Text className="text-[#475569] text-xs mb-1.5 font-medium">
                                      {requiredLabel("Professional ID")}
                                    </Text>
                                    <TextInput
                                      className="bg-[#F8FAFC] border-[#CBD5E1] border-[1px] rounded-3 py-3 px-3.5 text-[#1E293B]"
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
                                  <View className="mb-3.5">
                                    <Text className="text-[#475569] text-xs mb-1.5 font-medium">
                                      {requiredLabel("Email")}
                                    </Text>
                                    <TextInput
                                      className="bg-[#F8FAFC] border-[#CBD5E1] border-[1px] rounded-3 py-3 px-3.5 text-[#1E293B]"
                                      placeholder="name@example.com"
                                      placeholderTextColor="#94A3B8"
                                      value={email}
                                      onChangeText={setEmail}
                                      autoCapitalize="none"
                                      keyboardType="email-address"
                                    />
                                    <Text className="text-[#64748B] text-xs mt-1.5">
                                      Enter your registered email
                                    </Text>
                                  </View>
                                  <TouchableOpacity
                                    className={`${"bg-[#2563EB] rounded-3 py-3.5 items-center mt-1.5 shadow-md"} ${(professionalId.trim().length < 6 ||
                                        email.trim().length < 5 ||
                                        isSendingResetCode) ? "opacity-[0.5]" : ""}`}
                                    onPress={handleSendResetCode}
                                    disabled={
                                      professionalId.trim().length < 6 ||
                                      email.trim().length < 5 ||
                                      isSendingResetCode
                                    }
                                  >
                                    <Text className="text-[#F8FAFC] font-semibold letter-spacing-[0.3]">
                                      {isSendingResetCode
                                        ? "Sending reset code..."
                                        : "Send reset code"}
                                    </Text>
                                  </TouchableOpacity>
                                </>
                              ) : resetSuccess ? (
                                <View className="bg-[#DCFCE7] rounded-4 p-4 mb-4 border-[1px] border-[#86EFAC]">
                                  <Text className="text-[#16A34A] mt-2.5 font-semibold">
                                    ✅ Password reset successful!
                                  </Text>
                                  <Text className="text-[#475569] mb-1.5">
                                    You can now login with your new password.
                                  </Text>
                                </View>
                              ) : (
                                <>
                                  {!isResetCodeVerified ? (
                                    <>
                                      <View className="mb-3.5">
                                        <Text className="text-[#475569] text-xs mb-1.5 font-medium">
                                          {requiredLabel("Reset Code")}
                                        </Text>
                                        <TextInput
                                          className="bg-[#F8FAFC] border-[#CBD5E1] border-[1px] rounded-3 py-3 px-3.5 text-[#1E293B]"
                                          placeholder="Enter 6-digit reset code"
                                          placeholderTextColor="#94A3B8"
                                          value={resetCode}
                                          onChangeText={setResetCode}
                                          keyboardType="number-pad"
                                          maxLength={6}
                                        />
                                        <Text className="text-[#64748B] text-xs mt-1.5">
                                          Check your email for the 6-digit code
                                        </Text>
                                      </View>
                                      <TouchableOpacity
                                        className={`${"bg-[#2563EB] rounded-3 py-3.5 items-center mt-1.5 shadow-md"} ${(resetCode.trim().length !== 6 ||
                                            isVerifyingResetCode) ? "opacity-[0.5]" : ""}`}
                                        onPress={handleVerifyResetCode}
                                        disabled={
                                          resetCode.trim().length !== 6 ||
                                          isVerifyingResetCode
                                        }
                                      >
                                        <Text className="text-[#F8FAFC] font-semibold letter-spacing-[0.3]">
                                          {isVerifyingResetCode
                                            ? "Verifying code..."
                                            : "Verify Code"}
                                        </Text>
                                      </TouchableOpacity>
                                      <TouchableOpacity
                                        className={`${"mt-3 items-center"} ${(resetResendCountdown > 0 ||
                                            isSendingResetCode) ? "opacity-[0.5]" : ""}`}
                                        onPress={handleResendResetCode}
                                        disabled={
                                          resetResendCountdown > 0 ||
                                          isSendingResetCode
                                        }
                                      >
                                        <Text className="text-[#2563EB] font-semibold">
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
                                      <Text className="text-[#94A3B8] mb-4 line-height-[20]">
                                        Code verified! Now set your new password
                                      </Text>
                                      <View className="mb-3.5">
                                        <Text className="text-[#475569] text-xs mb-1.5 font-medium">
                                          {requiredLabel("New Password")}
                                        </Text>
                                        <View className="flex-row items-center">
                                          <TextInput
                                            className="bg-[#F8FAFC] border-[#CBD5E1] border-[1px] rounded-3 py-3 px-3.5 text-[#1E293B] flex-[1]"
                                            placeholder="Enter new password"
                                            placeholderTextColor="#94A3B8"
                                            value={newPassword}
                                            onChangeText={setNewPassword}
                                            secureTextEntry={!showNewPassword}
                                          />
                                          <TouchableOpacity
                                            className="ml-2.5 p-2 rounded-2.5 border-[1px] border-[#CBD5E1] bg-[#F8FAFC]"
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
                                      <View className="mb-3.5">
                                        <Text className="text-[#475569] text-xs mb-1.5 font-medium">
                                          {requiredLabel("Confirm New Password")}
                                        </Text>
                                        <View className="flex-row items-center">
                                          <TextInput
                                            className="bg-[#F8FAFC] border-[#CBD5E1] border-[1px] rounded-3 py-3 px-3.5 text-[#1E293B] flex-[1]"
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
                                            className="ml-2.5 p-2 rounded-2.5 border-[1px] border-[#CBD5E1] bg-[#F8FAFC]"
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
                                          className={`mt-2 text-xs font-semibold ${isResetPasswordMatch ? "text-[#10B981]" : "text-[#F59E0B]"}`}
                                        >
                                          {isResetPasswordMatch
                                            ? "✓ Passwords match"
                                            : "○ Passwords do not match"}
                                        </Text>
                                      )}
                                      <TouchableOpacity
                                        className={`${"bg-[#2563EB] rounded-3 py-3.5 items-center mt-1.5 shadow-md"} ${(!isNewPasswordStrong ||
                                            !isResetPasswordMatch ||
                                            confirmNewPassword.trim().length <
                                            PASSWORD_MIN_LENGTH) ? "opacity-[0.5]" : ""}`}
                                        onPress={handleResetPassword}
                                        disabled={
                                          !isNewPasswordStrong ||
                                          !isResetPasswordMatch ||
                                          confirmNewPassword.trim().length <
                                          PASSWORD_MIN_LENGTH
                                        }
                                      >
                                        <Text className="text-[#F8FAFC] font-semibold letter-spacing-[0.3]">
                                          Reset Password
                                        </Text>
                                      </TouchableOpacity>
                                      <TouchableOpacity
                                        className={`${"mt-3 items-center"}`}
                                        onPress={() => {
                                          setIsResetCodeVerified(false);
                                          setResetCode("");
                                          setNewPassword("");
                                          setConfirmNewPassword("");
                                          setError("");
                                        }}
                                      >
                                        <Text className="text-[#2563EB] font-semibold">
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
                            <View className="bg-[#F8FAFC] rounded-4 p-4 mb-4 border-[1px] border-[#E2E8F0]">
                              <View className="flex-row items-center mb-4">
                                <TouchableOpacity
                                  className="p-2 mr-2"
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
                                <Text className="text-[#1E293B] font-semibold mb-2.5">
                                  Reset Password
                                </Text>
                                <View style={{ width: 24 }} />
                              </View>
                              <Text className="text-[#94A3B8] mb-4 line-height-[20]">
                                We'll send a verification code to your
                                registered email
                              </Text>

                              {!isResetCodeSent ? (
                                <>
                                  <View className="mb-3.5">
                                    <Text className="text-[#475569] text-xs mb-1.5 font-medium">{requiredLabel("Email")}</Text>
                                    <TextInput
                                      className="bg-[#F8FAFC] border-[#CBD5E1] border-[1px] rounded-3 py-3 px-3.5 text-[#1E293B]"
                                      placeholder="Enter your email"
                                      placeholderTextColor="#94A3B8"
                                      value={email}
                                      onChangeText={setEmail}
                                      autoCapitalize="none"
                                      keyboardType="email-address"
                                    />
                                    <Text className="text-[#64748B] text-xs mt-1.5">
                                      Enter your registered email address
                                    </Text>
                                  </View>
                                  <TouchableOpacity
                                    className={`${"bg-[#2563EB] rounded-3 py-3.5 items-center mt-1.5 shadow-md"} ${(email.trim().length < 5 ||
                                        isSendingResetCode) ? "opacity-[0.5]" : ""}`}
                                    onPress={handleSendResetCodeUser}
                                    disabled={
                                      email.trim().length < 5 ||
                                      isSendingResetCode
                                    }
                                  >
                                    <Text className="text-[#F8FAFC] font-semibold letter-spacing-[0.3]">
                                      {isSendingResetCode
                                        ? "Sending verification code..."
                                        : "Send verification code"}
                                    </Text>
                                  </TouchableOpacity>
                                </>
                              ) : resetSuccess ? (
                                <View className="bg-[#DCFCE7] rounded-4 p-4 mb-4 border-[1px] border-[#86EFAC]">
                                  <Text className="text-[#16A34A] mt-2.5 font-semibold">
                                    ✅ Password reset successful!
                                  </Text>
                                  <Text className="text-[#475569] mb-1.5">
                                    You can now login with your new password.
                                  </Text>
                                </View>
                              ) : (
                                <>
                                  {!isResetCodeVerified ? (
                                    <>
                                      <View className="mb-3.5">
                                        <Text className="text-[#475569] text-xs mb-1.5 font-medium">
                                          {requiredLabel("Verification Code")}
                                        </Text>
                                        <TextInput
                                          className="bg-[#F8FAFC] border-[#CBD5E1] border-[1px] rounded-3 py-3 px-3.5 text-[#1E293B]"
                                          placeholder="Enter 6-digit code"
                                          placeholderTextColor="#94A3B8"
                                          value={resetCode}
                                          onChangeText={setResetCode}
                                          keyboardType="number-pad"
                                          maxLength={6}
                                        />
                                        <Text className="text-[#64748B] text-xs mt-1.5">
                                          Check your email for the 6-digit code
                                        </Text>
                                      </View>
                                      <TouchableOpacity
                                        className={`${"bg-[#2563EB] rounded-3 py-3.5 items-center mt-1.5 shadow-md"} ${(resetCode.trim().length !== 6 ||
                                            isVerifyingResetCode) ? "opacity-[0.5]" : ""}`}
                                        onPress={handleVerifyResetCodeUser}
                                        disabled={
                                          resetCode.trim().length !== 6 ||
                                          isVerifyingResetCode
                                        }
                                      >
                                        <Text className="text-[#F8FAFC] font-semibold letter-spacing-[0.3]">
                                          {isVerifyingResetCode
                                            ? "Verifying code..."
                                            : "Verify Code"}
                                        </Text>
                                      </TouchableOpacity>
                                      <TouchableOpacity
                                        className={`${"mt-3 items-center"} ${(resetResendCountdown > 0 ||
                                            isSendingResetCode) ? "opacity-[0.5]" : ""}`}
                                        onPress={handleResendResetCodeUser}
                                        disabled={
                                          resetResendCountdown > 0 ||
                                          isSendingResetCode
                                        }
                                      >
                                        <Text className="text-[#2563EB] font-semibold">
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
                                      <Text className="text-[#94A3B8] mb-4 line-height-[20]">
                                        Code verified! Now set your new password
                                      </Text>
                                      <View className="mb-3.5">
                                        <Text className="text-[#475569] text-xs mb-1.5 font-medium">
                                          {requiredLabel("New Password")}
                                        </Text>
                                        <View className="flex-row items-center">
                                          <TextInput
                                            className="bg-[#F8FAFC] border-[#CBD5E1] border-[1px] rounded-3 py-3 px-3.5 text-[#1E293B] flex-[1]"
                                            placeholder="Enter new password"
                                            placeholderTextColor="#94A3B8"
                                            value={newPassword}
                                            onChangeText={setNewPassword}
                                            secureTextEntry={!showNewPassword}
                                          />
                                          <TouchableOpacity
                                            className="ml-2.5 p-2 rounded-2.5 border-[1px] border-[#CBD5E1] bg-[#F8FAFC]"
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
                                      <View className="mb-3.5">
                                        <Text className="text-[#475569] text-xs mb-1.5 font-medium">
                                          {requiredLabel("Confirm New Password")}
                                        </Text>
                                        <View className="flex-row items-center">
                                          <TextInput
                                            className="bg-[#F8FAFC] border-[#CBD5E1] border-[1px] rounded-3 py-3 px-3.5 text-[#1E293B] flex-[1]"
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
                                            className="ml-2.5 p-2 rounded-2.5 border-[1px] border-[#CBD5E1] bg-[#F8FAFC]"
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
                                          className={`mt-2 text-xs font-semibold ${isResetPasswordMatch ? "text-[#10B981]" : "text-[#F59E0B]"}`}
                                        >
                                          {isResetPasswordMatch
                                            ? "✓ Passwords match"
                                            : "○ Passwords do not match"}
                                        </Text>
                                      )}
                                      <TouchableOpacity
                                        className={`${"bg-[#2563EB] rounded-3 py-3.5 items-center mt-1.5 shadow-md"} ${(!isNewPasswordStrong ||
                                            !isResetPasswordMatch ||
                                            confirmNewPassword.trim().length <
                                            PASSWORD_MIN_LENGTH) ? "opacity-[0.5]" : ""}`}
                                        onPress={handleResetPasswordUser}
                                        disabled={
                                          !isNewPasswordStrong ||
                                          !isResetPasswordMatch ||
                                          confirmNewPassword.trim().length <
                                          PASSWORD_MIN_LENGTH
                                        }
                                      >
                                        <Text className="text-[#F8FAFC] font-semibold letter-spacing-[0.3]">
                                          Reset Password
                                        </Text>
                                      </TouchableOpacity>
                                      <TouchableOpacity
                                        className={`${"mt-3 items-center"}`}
                                        onPress={() => {
                                          setIsResetCodeVerified(false);
                                          setResetCode("");
                                          setNewPassword("");
                                          setConfirmNewPassword("");
                                          setError("");
                                        }}
                                      >
                                        <Text className="text-[#2563EB] font-semibold">
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
                          <View className="bg-[#F8FAFC] rounded-4 p-4 mb-4 border-[1px] border-[#E2E8F0]">
                            <Text className="text-[#1E293B] font-semibold mb-2.5">
                              {isRegister
                                ? "Email verification"
                                : isPostLoginOtpStep
                                  ? "Login verification"
                                  : "OTP sign-in"}
                            </Text>
                            <Text className="text-[#94A3B8] mb-4 line-height-[20]">
                              {isRegister
                                ? "We'll send a verification code to your email address"
                                : isPostLoginOtpStep
                                  ? "A one-time code was sent to your email. Verify to complete login."
                                  : "We'll send a one-time code to your email"}
                            </Text>
                            {!isOtpSent ? (
                              <TouchableOpacity
                                className={`${"bg-[#2563EB] rounded-3 py-3.5 items-center mt-1.5 shadow-md"} ${(otpEmail.trim().length < 5 ||
                                    isSendingOtp) ? "opacity-[0.5]" : ""}`}
                                onPress={handleSendOtp}
                                disabled={
                                  otpEmail.trim().length < 5 || isSendingOtp
                                }
                                activeOpacity={0.9}
                              >
                                <Text className="text-[#F8FAFC] font-semibold letter-spacing-[0.3]">
                                  {isSendingOtp
                                    ? "Sending verification code..."
                                    : "Send verification code"}
                                </Text>
                              </TouchableOpacity>
                            ) : (
                              <>
                                <View className="mb-3.5">
                                  <Text className="text-[#475569] text-xs mb-1.5 font-medium">
                                    {requiredLabel("Verification code")}
                                  </Text>
                                  <TextInput
                                    className={`bg-[#F8FAFC] border-[#CBD5E1] border-[1px] rounded-3 py-3 px-3.5 text-[#1E293B] ${isVerified ? "bg-[#E2E8F0] text-[#94A3B8]" : ""}`}
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
                                  className={`${"border-[1px] border-[#38BDF8] rounded-3 py-3 items-center"} ${!canVerify ? "opacity-[0.5]" : ""}`}
                                  onPress={handleVerify}
                                  disabled={!canVerify}
                                >
                                  <Text className="text-[#38BDF8] font-semibold">
                                    {isVerified
                                      ? "Verified ✅"
                                      : "Verify email"}
                                  </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  className={`${"mt-3 items-center"} ${otpResendCountdown > 0 ? "opacity-[0.5]" : ""}`}
                                  onPress={handleSendOtp}
                                  activeOpacity={0.85}
                                  disabled={otpResendCountdown > 0}
                                >
                                  {!isVerified && (
                                    <Text className="text-[#2563EB] font-semibold">
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
                            <View className="bg-[#F8FAFC] rounded-4 p-4 mb-4 border-[1px] border-[#E2E8F0]">
                              <Text className="text-[#1E293B] font-semibold mb-2.5">
                                Passenger travel details
                              </Text>
                              <View className="mb-3.5">
                                <Text className="text-[#475569] text-xs mb-1.5 font-medium">{requiredLabel("Travel mode")}</Text>
                                <View className="flex-row flex-wrap mx-[-4px]">
                                  {["Bus", "Train"].map((item) => (
                                    <TouchableOpacity
                                      key={item}
                                      className={`${"border-[1px] border-[#CBD5E1] bg-[#F8FAFC] py-1.5 px-2.5 rounded-[999px] m-1"} ${travelType === item ? "bg-[#2563EB] border-[#2563EB]" : ""}`}
                                      onPress={() => setTravelType(item)}
                                    >
                                      <Text
                                        className={`${"text-[#475569] text-xs"} ${travelType === item ? "text-[#F8FAFC] font-semibold" : ""}`}
                                      >
                                        {item}
                                      </Text>
                                    </TouchableOpacity>
                                  ))}
                                </View>
                              </View>
                              <View className="mb-3.5">
                                <Text className="text-[#475569] text-xs mb-1.5 font-medium">
                                  {requiredLabel(
                                    `${travelType === "Bus" ? "Bus" : "Train"} number`,
                                  )}
                                </Text>
                                <TextInput
                                  className="bg-[#F8FAFC] border-[#CBD5E1] border-[1px] rounded-3 py-3 px-3.5 text-[#1E293B]"
                                  placeholder="TN-01-AB-1234"
                                  placeholderTextColor="#94A3B8"
                                  value={travelNumber}
                                  onChangeText={setTravelNumber}
                                />
                              </View>
                              <View className="mb-3.5">
                                <Text className="text-[#475569] text-xs mb-1.5 font-medium">
                                  {travelType === "Bus"
                                    ? "Bus name (optional)"
                                    : requiredLabel("Train name")}
                                </Text>
                                <TextInput
                                  className="bg-[#F8FAFC] border-[#CBD5E1] border-[1px] rounded-3 py-3 px-3.5 text-[#1E293B]"
                                  placeholder="MTC 27B / MS-EXP-204"
                                  placeholderTextColor="#94A3B8"
                                  value={travelName}
                                  onChangeText={setTravelName}
                                />
                              </View>
                              {travelType === "Bus" ? (
                                <>
                                  <View className="mb-3.5">
                                    <Text className="text-[#475569] text-xs mb-1.5 font-medium">
                                      {requiredLabel("Departure stop")}
                                    </Text>
                                    <TextInput
                                      className="bg-[#F8FAFC] border-[#CBD5E1] border-[1px] rounded-3 py-3 px-3.5 text-[#1E293B]"
                                      placeholder="Velachery"
                                      placeholderTextColor="#94A3B8"
                                      value={busDeparture}
                                      onChangeText={setBusDeparture}
                                    />
                                  </View>
                                  <View className="mb-3.5">
                                    <Text className="text-[#475569] text-xs mb-1.5 font-medium">
                                      {requiredLabel("Arrival stop")}
                                    </Text>
                                    <TextInput
                                      className="bg-[#F8FAFC] border-[#CBD5E1] border-[1px] rounded-3 py-3 px-3.5 text-[#1E293B]"
                                      placeholder="CMBT"
                                      placeholderTextColor="#94A3B8"
                                      value={busArrival}
                                      onChangeText={setBusArrival}
                                    />
                                  </View>
                                  <View className="mb-3.5">
                                    <Text className="text-[#475569] text-xs mb-1.5 font-medium">
                                      {requiredLabel("Bus start timing")}
                                    </Text>
                                    <View className="gap-2.5">
                                      <TextInput
                                        className="bg-[#F8FAFC] border-[#CBD5E1] border-[1px] rounded-3 py-3 px-3.5 text-[#1E293B] w-[100%]"
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
                                  <View className="mb-3.5">
                                    <Text className="text-[#475569] text-xs mb-1.5 font-medium">{requiredLabel("Route")}</Text>
                                    <TextInput
                                      className="bg-[#F8FAFC] border-[#CBD5E1] border-[1px] rounded-3 py-3 px-3.5 text-[#1E293B]"
                                      placeholder="Velachery → CMBT"
                                      placeholderTextColor="#94A3B8"
                                      value={travelRoute}
                                      onChangeText={setTravelRoute}
                                    />
                                  </View>
                                  <View className="mb-3.5">
                                    <Text className="text-[#475569] text-xs mb-1.5 font-medium">{requiredLabel("Timing")}</Text>
                                    <TextInput
                                      className="bg-[#F8FAFC] border-[#CBD5E1] border-[1px] rounded-3 py-3 px-3.5 text-[#1E293B]"
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
                                  <View className="mb-3.5">
                                    <Text className="text-[#475569] text-xs mb-1.5 font-medium">
                                      Driver name (optional)
                                    </Text>
                                    <TextInput
                                      className="bg-[#F8FAFC] border-[#CBD5E1] border-[1px] rounded-3 py-3 px-3.5 text-[#1E293B]"
                                      placeholder="Driver name"
                                      placeholderTextColor="#94A3B8"
                                      value={driverName}
                                      onChangeText={setDriverName}
                                    />
                                  </View>
                                  <View className="mb-3.5">
                                    <Text className="text-[#475569] text-xs mb-1.5 font-medium">
                                      Conductor name (optional)
                                    </Text>
                                    <TextInput
                                      className="bg-[#F8FAFC] border-[#CBD5E1] border-[1px] rounded-3 py-3 px-3.5 text-[#1E293B]"
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
                            <View className="bg-[#F8FAFC] rounded-4 p-4 mb-4 border-[1px] border-[#E2E8F0]">
                              <Text className="text-[#1E293B] font-semibold mb-2.5">
                                Daily duty roster
                              </Text>
                              <View className="mb-3.5">
                                <Text className="text-[#475569] text-xs mb-1.5 font-medium">{requiredLabel("Vehicle number")}</Text>
                                <TextInput
                                  className="bg-[#F8FAFC] border-[#CBD5E1] border-[1px] rounded-3 py-3 px-3.5 text-[#1E293B]"
                                  placeholder="TN-01-AB-1234"
                                  placeholderTextColor="#94A3B8"
                                  value={vehicleNumber}
                                  onChangeText={setVehicleNumber}
                                />
                              </View>
                              <View className="mb-3.5">
                                <Text className="text-[#475569] text-xs mb-1.5 font-medium">{requiredLabel("Shift timing")}</Text>
                                <TextInput
                                  className="bg-[#F8FAFC] border-[#CBD5E1] border-[1px] rounded-3 py-3 px-3.5 text-[#1E293B]"
                                  placeholder="6AM - 2PM"
                                  placeholderTextColor="#94A3B8"
                                  value={shiftTiming}
                                  onChangeText={setShiftTiming}
                                />
                              </View>
                              <View className="mb-3.5">
                                <Text className="text-[#475569] text-xs mb-1.5 font-medium">{requiredLabel("From stop")}</Text>
                                <TextInput
                                  className="bg-[#F8FAFC] border-[#CBD5E1] border-[1px] rounded-3 py-3 px-3.5 text-[#1E293B]"
                                  placeholder="Velachery"
                                  placeholderTextColor="#94A3B8"
                                  value={fromStop}
                                  onChangeText={setFromStop}
                                />
                              </View>
                              <View className="mb-3.5">
                                <Text className="text-[#475569] text-xs mb-1.5 font-medium">{requiredLabel("To stop")}</Text>
                                <TextInput
                                  className="bg-[#F8FAFC] border-[#CBD5E1] border-[1px] rounded-3 py-3 px-3.5 text-[#1E293B]"
                                  placeholder="CMBT"
                                  placeholderTextColor="#94A3B8"
                                  value={toStop}
                                  onChangeText={setToStop}
                                />
                              </View>
                            </View>
                          )}

                        {isRegister && isOfficialRole && (
                          <View className="bg-[#F8FAFC] rounded-4 p-4 mb-4 border-[1px] border-[#E2E8F0]">
                            <Text className="text-[#1E293B] font-semibold mb-2.5">
                              Official duty details
                            </Text>
                            <Text className="text-[#94A3B8] mb-4 line-height-[20]">
                              Admin approval required within 24 hours.
                            </Text>
                            <View className="mb-3.5">
                              <Text className="text-[#475569] text-xs mb-1.5 font-medium">{requiredLabel("Train PNR range")}</Text>
                              <TextInput
                                className="bg-[#F8FAFC] border-[#CBD5E1] border-[1px] rounded-3 py-3 px-3.5 text-[#1E293B]"
                                placeholder="4528193000-4528193999"
                                placeholderTextColor="#94A3B8"
                                value={pnrRange}
                                onChangeText={setPnrRange}
                              />
                            </View>
                            <View className="mb-3.5">
                              <Text className="text-[#475569] text-xs mb-1.5 font-medium">{requiredLabel("Jurisdiction")}</Text>
                              <TextInput
                                className="bg-[#F8FAFC] border-[#CBD5E1] border-[1px] rounded-3 py-3 px-3.5 text-[#1E293B]"
                                placeholder="Chennai Central Division"
                                placeholderTextColor="#94A3B8"
                                value={jurisdiction}
                                onChangeText={setJurisdiction}
                              />
                            </View>
                          </View>
                        )}

                        {error.length > 0 && (
                          <Text className="text-[#F87171] mb-3">{error}</Text>
                        )}

                        {!forgotPasswordMode && (
                          <View>
                            <TouchableOpacity
                              className={`${"bg-[#2563EB] rounded-3 py-3.5 items-center mt-1.5 shadow-md"} ${!canSubmit ? "opacity-[0.5]" : ""}`}
                              onPress={handleSubmit}
                              disabled={!canSubmit}
                            >
                              <Text className="text-[#F8FAFC] font-semibold letter-spacing-[0.3]">
                                {isRegister ? "Create account" : "Log in"}
                              </Text>
                            </TouchableOpacity>

                            <View className="flex-row justify-center items-center mt-3.5">
                              <Text className="text-[#64748B] mr-1.5">
                                {isRegister
                                  ? "Already have an account?"
                                  : "New here?"}
                              </Text>
                              <TouchableOpacity onPress={handleSwitchMode}>
                                <Text className="text-[#2563EB] font-semibold">
                                  {isRegister ? "Log in" : "Create one"}
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        )}
                      </Animated.View>
                    )}
                  </Animated.View>
              </ScrollView>
            </KeyboardAvoidingView>
          </>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
};



const App = () => (
  <SafeAreaProvider>
    <AppContent />
  </SafeAreaProvider>
);

export default App;
