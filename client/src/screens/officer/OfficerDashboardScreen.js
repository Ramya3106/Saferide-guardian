import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Alert, View, Text, TouchableOpacity, Platform, ToastAndroid, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import { getApiBase } from "../../../apiConfig";
import { socketService } from "../../services/socketService";
import DashboardTab from "./tabs/DashboardTab";
import ComplaintsTab from "./tabs/ComplaintsTab";
import DetailTab from "./tabs/DetailTab";
import DutyTab from "./tabs/DutyTab";

const API_BASE = getApiBase();

const parseRole = (pid, role) => {
  const r = String(role || "").trim();
  if (r) return r;
  const p = String(pid || "").toUpperCase();
  if (p.startsWith("TTR-")) return "TTR";
  if (p.startsWith("TTE-")) return "TTE";
  if (p.startsWith("RPF-")) return "RPF";
  if (p.startsWith("TNPOLICE-")) return "Police";
  return "TTR";
};

const normalizeAlert = (a) => ({
  id: a._id || a.complaintId || a.id || "",
  status: a.status || "Submitted",
  passengerName: a.passengerName || "Passenger",
  passengerPhone: a.passengerPhone || a.phoneNumber || a.contactNumber || "-",
  itemType: a.itemType || a.lostItemType || "Item",
  description: a.description || a.itemDescription || "",
  vehicleNumber: a.vehicleNumber || a.trainNumber || "-",
  trainName: a.trainName || a.vehicleName || a.busName || "",
  route: a.route || `${a.fromLocation || "Origin"} -> ${a.toLocation || "Destination"}`,
  fromLocation: a.fromLocation || a.boardingStation || a.fromStop || "-",
  toLocation: a.toLocation || a.destinationStation || a.toStop || "-",
  coach: a.coach || a.coachNumber || "-",
  seat: a.seat || a.berthNumber || "-",
  priority: a.priority || "Normal",
  reportedAt: a.reportedAt || a.reportedAtStation || a.currentTrainLocation || "-",
  platform: a.platform || a.platformNumber || "-",
  imageUrl: a.imageUrl || a.itemImage || a.photo || null,
  createdAt: a.createdAt || a.submittedAt || null,
  updatedAt: a.updatedAt || null,
  resolvedAt: a.resolvedAt || null,
  acceptedAt: a.acceptedAt || null,
});

const TABS = [
  { key: "dashboard", icon: "home", label: "Dashboard" },
  { key: "complaints", icon: "list", label: "Complaints" },
  { key: "messages", icon: "chatbubble", label: "Messages" },
  { key: "profile", icon: "person", label: "Profile" },
];

const showToast = (message) => {
  if (!message) return;
  if (Platform.OS === "android") {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  }
};

const fmtNotificationTime = (value) => {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const resolveOnDutyState = (payload = {}) => {
  const explicitOnDuty =
    typeof payload?.onDuty === "boolean" ? payload.onDuty : null;
  const officerOnDuty =
    typeof payload?.officer?.onDutyStatus === "boolean"
      ? payload.officer.onDutyStatus
      : null;
  const attendance = payload?.attendance || null;
  const attendanceStatus = String(
    attendance?.status || attendance?.dutyStatus || "",
  ).toUpperCase();
  const attendanceSuggestsOnDuty = Boolean(
    attendance &&
      !attendance?.checkOutTime &&
      attendanceStatus !== "INACTIVE",
  );

  if (explicitOnDuty !== null) return explicitOnDuty;
  if (officerOnDuty !== null) return officerOnDuty;
  return attendanceSuggestsOnDuty;
};

export default function OfficerDashboardScreen({ roleLabel, officerEmail, professionalId, specificRole, staffName, authToken, authUserId, onLogout, onDuty, setOnDuty }) {
  const dutyUnit = parseRole(professionalId, specificRole);
  const officerName = staffName || officerEmail || professionalId || "Officer";
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [dutyAttendance, setDutyAttendance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  // Track which notification IDs have been seen (badge clears when messages tab is opened)
  const [seenIds, setSeenIds] = useState(new Set());
  // Real-time new complaint alert state (Rapido/Uber-style instant push)
  const [newAlertCount, setNewAlertCount] = useState(0);
  const newAlertAnim = useRef(new Animated.Value(0)).current;
  // Animated duty status indicator in header
  const dutyIndicatorAnim = useRef(new Animated.Value(onDuty ? 1 : 0)).current;
  const socketRef = useRef(null);

  // Animate the header duty indicator whenever onDuty changes
  useEffect(() => {
    Animated.timing(dutyIndicatorAnim, {
      toValue: onDuty ? 1 : 0,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [onDuty]);

  const headers = useCallback(() => ({
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    "X-User-Role": "TTR/RPF/Police",
    "X-User-Email": officerEmail || "",
    "X-Professional-Id": professionalId || "",
    "X-User-Name": officerName,
    "X-Duty-Unit": dutyUnit,
  }), [authToken, officerEmail, officerName, professionalId, dutyUnit]);

  const loadDutyStatus = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/auth/duty/status`, {
        params: { email: officerEmail || undefined, professionalId: professionalId || undefined },
        headers: headers(),
      });
      const data = res.data?.data || res.data || {};
      setDutyAttendance(data?.attendance || null);
      if (setOnDuty) {
        setOnDuty(resolveOnDutyState(data));
      }
    } catch { /* silent */ }
  }, [officerEmail, professionalId, headers, setOnDuty]);

  const loadComplaints = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/passenger/live-alerts`, {
        params: { staffRole: dutyUnit },
        headers: headers(),
      });
      const data = res.data?.data || res.data || {};
      const list = Array.isArray(data?.alerts) ? data.alerts.map(normalizeAlert) : [];
      setComplaints(list);
      if (selectedComplaint) {
        setSelectedComplaint(prev => list.find(c => c.id === prev?.id) || prev);
      }
    } catch { /* silent */ }
  }, [dutyUnit, headers, selectedComplaint]);

  // Fetch full complaint detail from DB when user taps a complaint
  const fetchComplaintDetail = useCallback(async (complaint) => {
    setDetailLoading(true);
    setSelectedComplaint(complaint); // show immediately with list data
    try {
      const res = await axios.get(
        `${API_BASE}/passenger/complaints/${complaint.id}`,
        { headers: headers() }
      );
      const raw = res.data?.data || res.data?.complaint || res.data || {};
      const full = normalizeAlert({ ...complaint, ...raw });
      setSelectedComplaint(full);
    } catch {
      // keep stale list data if detail fetch fails
    } finally {
      setDetailLoading(false);
    }
  }, [headers]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadDutyStatus(), loadComplaints()]);
    setRefreshing(false);
  }, [loadDutyStatus, loadComplaints]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadDutyStatus(), loadComplaints()]).finally(() => setLoading(false));
  }, [officerEmail, professionalId]);

  useEffect(() => {
    if (!onDuty) return;
    loadComplaints();
  }, [onDuty]);

  useEffect(() => {
    const SOCKET_BASE = API_BASE.replace(/\/api\/?$/, "");
    try {
      const socket = socketService.connect(SOCKET_BASE, { role: "TTR/RPF/Police", email: officerEmail, professionalId, dutyUnit });
      socketRef.current = socket;

      // Join duty-unit room on connect (and on reconnect) so this officer
      // receives all train complaints broadcast to their unit — like a Rapido
      // driver joining the city pool to receive ride requests in real time.
      const joinRooms = () => {
        socket.emit("join:duty", dutyUnit);
        const officerRoomId = professionalId || officerEmail;
        if (officerRoomId) socket.emit("join:officer", officerRoomId);
      };
      socket.on("connect", joinRooms);
      if (socket.connected) joinRooms();

      // Pulse animation: slide-in banner when a new complaint arrives
      const triggerNewAlertPulse = () => {
        newAlertAnim.setValue(0);
        Animated.sequence([
          Animated.timing(newAlertAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.delay(2500),
          Animated.timing(newAlertAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]).start();
      };

      const onNew = (data) => {
        // Only on-duty officers receive live complaint pushes
        if (!onDuty) return;
        const raw = data?.complaint || data;
        // Only process train complaints for the railway dashboard
        if (raw?.transportType && raw.transportType !== "train") return;
        const a = normalizeAlert(raw);
        if (!a.id) return;
        setComplaints(prev => {
          const exists = prev.some(c => c.id === a.id);
          if (exists) {
            return prev.map(c => c.id === a.id ? { ...c, ...a } : c);
          }
          // Brand-new complaint — prepend and trigger alert UI
          setNewAlertCount(n => n + 1);
          triggerNewAlertPulse();
          showToast(`New complaint: ${a.itemType || "Item"} on ${a.vehicleNumber || "train"}`);
          return [a, ...prev];
        });
      };

      const onStatusChange = (data) => {
        const raw = data?.complaint || data;
        const a = normalizeAlert(raw);
        if (!a.id) return;
        setComplaints(prev => prev.map(c => c.id === a.id ? { ...c, ...a } : c));
        setSelectedComplaint(prev => prev && prev.id === a.id ? { ...prev, ...a } : prev);
      };

      const onEscalation = (data) => {
        if (!onDuty) return;
        const raw = data?.complaint || data;
        if (raw?.transportType && raw.transportType !== "train") return;
        const a = normalizeAlert(raw);
        if (!a.id) return;
        setComplaints(prev => prev.map(c => c.id === a.id ? { ...c, ...a } : c));
        showToast(`Escalated: ${a.itemType || "Complaint"} — ${data?.escalationLevel || "Priority raised"}`);
      };

      // Real-time duty status change broadcast from server
      const onDutyStatusChange = (data) => {
        const myEmail = (officerEmail || "").toLowerCase();
        const myPid   = (professionalId || "").toUpperCase();
        const evtEmail = (data?.officerEmail || "").toLowerCase();
        const evtPid   = (data?.professionalId || "").toUpperCase();
        const isMe = (myEmail && evtEmail && myEmail === evtEmail) ||
                     (myPid   && evtPid   && myPid   === evtPid);
        if (!isMe) return;
        if (setOnDuty) setOnDuty(Boolean(data?.onDuty));
        if (data?.attendance) setDutyAttendance(data.attendance);
        if (!data?.onDuty) {
          setComplaints([]);
          setNewAlertCount(0);
        }
      };

      socket.on("complaint:new", onNew);
      socket.on("complaint:status-change", onStatusChange);
      socket.on("complaint:escalation", onEscalation);
      socket.on("duty:status-change", onDutyStatusChange);

      return () => {
        socket.off("connect", joinRooms);
        socket.off("complaint:new", onNew);
        socket.off("complaint:status-change", onStatusChange);
        socket.off("complaint:escalation", onEscalation);
        socket.off("duty:status-change", onDutyStatusChange);
        socket.disconnect();
      };
    } catch { return undefined; }
  }, [officerEmail, professionalId, dutyUnit, onDuty]);

  const syncDuty = async () => {
    const previousOnDuty = Boolean(onDuty);
    const previousAttendance = dutyAttendance;
    setSyncing(true);
    try {
      const next = !onDuty;
      const ep = next ? "/auth/duty/check-in" : "/auth/duty/check-out";
      const fallbackLocation =
        dutyAttendance?.assignedStation ||
        dutyAttendance?.assignedRoute ||
        `${dutyUnit} duty desk`;
      const nowIso = new Date().toISOString();
      const payload = {
        email: officerEmail || undefined,
        professionalId: professionalId || undefined,
        dutyUnit,
        assignedTrain: dutyAttendance?.assignedTrain || null,
        assignedRoute: dutyAttendance?.assignedRoute || null,
        assignedStation: fallbackLocation,
        assignedShift: dutyAttendance?.assignedShift || null,
        dutyStation: fallbackLocation,
        dutyDesk: "Duty desk",
        dutyNote: next
          ? "Checked in from SafeRide Guardian"
          : "Checked out from SafeRide Guardian",
      };
      showToast(next ? "Checking in..." : "Checking out...");
      if (setOnDuty) {
        setOnDuty(next);
      }
      setDutyAttendance((prev) => {
        if (!next) {
          if (!prev) return prev;
          return { ...prev, checkOutTime: nowIso };
        }
        return {
          ...(prev || {}),
          checkInTime: prev?.checkInTime || nowIso,
          assignedStation: prev?.assignedStation || fallbackLocation,
          assignedRoute: prev?.assignedRoute || fallbackLocation,
          dutyUnit: prev?.dutyUnit || dutyUnit,
        };
      });
      console.log(`[DUTY] Attempting ${next ? "check-in" : "check-out"} to ${API_BASE}${ep}`);
      console.log("[DUTY] Request headers:", headers());
      const res = await axios.post(`${API_BASE}${ep}`, payload, {
        headers: headers(),
        timeout: 20000,
      });
      console.log(`[DUTY] ${next ? "Check-in" : "Check-out"} success:`, res.data);
      const responseData = res.data?.data || res.data || {};
      if (setOnDuty) {
        setOnDuty(resolveOnDutyState(responseData));
      }
      setDutyAttendance(responseData?.attendance || null);
      showToast(next ? "Checked in successfully" : "Checked out successfully");
      // Auto-join/leave officer socket room for real-time updates
      try {
        const officerRoomId = professionalId || officerEmail || authUserId || (res.data?.attendance?.officerId) || (res.data?.attendance?.officerEmail);
        if (next) {
          socketService.joinOfficer(officerRoomId);
          socketService.joinDuty(dutyUnit); // join duty-unit pool for train complaint dispatch
        } else {
          socketService.leaveOfficer(officerRoomId);
          socketService.leaveDuty(dutyUnit); // leave duty pool when going off duty
        }
      } catch (e) { /* silent */ }
      if (next) {
        loadComplaints();
        setActiveTab("profile");
      } else {
        setActiveTab("dashboard");
      }
      return next;
    } catch (error) {
      if (setOnDuty) {
        setOnDuty(previousOnDuty);
      }
      setDutyAttendance(previousAttendance || null);
      console.error("[DUTY] Error:", error.message);
      if (error.response) {
        console.error("[DUTY] Response status:", error.response.status);
        console.error("[DUTY] Response data:", error.response.data);
      } else if (error.request) {
        console.error("[DUTY] No response received:", error.request);
      } else {
        console.error("[DUTY] Request setup error:", error);
      }
      const serverMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.response?.data?.data?.message;
      const normalizedMessage = String(serverMessage || "").toLowerCase();
      const alreadyOnDuty =
        error?.response?.status === 409 &&
        normalizedMessage.includes("already checked in");
      if (alreadyOnDuty) {
        await loadDutyStatus();
        if (setOnDuty) {
          setOnDuty(true);
        }
        showToast("Already checked in. Synced duty status.");
        setActiveTab("profile");
        return true;
      }
      showToast(serverMessage || "Duty update failed");
      Alert.alert(
        `Failed to ${next ? "check in" : "check out"}`,
        serverMessage || error.message || "Please check your connection and try again.",
        [{ text: "OK" }],
      );
      return null;
    } finally { setSyncing(false); }
  };

  const handleReply = async (message) => {
    if (!selectedComplaint) return;
    setSending(true);
    try {
      await axios.post(
        `${API_BASE}/passenger/complaints/${selectedComplaint.id}/staff/respond`,
        { text: message },
        { headers: headers() }
      );
      // Re-fetch full detail from DB to show updated state
      await fetchComplaintDetail(selectedComplaint);
      await loadComplaints();
    } catch { /* silent */ } finally { setSending(false); }
  };

  const handleStatus = async (status) => {
    if (!selectedComplaint) return;
    setSending(true);
    try {
      await axios.patch(
        `${API_BASE}/passenger/complaints/${selectedComplaint.id}/staff/status`,
        { status, itemFound: status === "Item Found", staffResponseStatus: `Status updated to ${status}` },
        { headers: headers() }
      );
      // Re-fetch full detail from DB to reflect new status immediately
      await fetchComplaintDetail(selectedComplaint);
      await loadComplaints();
    } catch { /* silent */ } finally { setSending(false); }
  };

  const TAB_TITLES = {
    dashboard: { TTR: "TTR Dashboard", TTE: "TTE Dashboard", RPF: "RPF Dashboard", Police: "Police Dashboard" }[dutyUnit] || "Officer Dashboard",
    complaints: "All Complaints",
    messages: "Notifications",
    profile: "Duty Status",
  };
  const headerTitle = selectedComplaint ? "Complaint Details" : (TAB_TITLES[activeTab] || "Officer Dashboard");
  const loc = dutyAttendance?.assignedStation || dutyAttendance?.assignedRoute || "Chennai Central (MAS)";
  const notificationItems = complaints
    .slice()
    .sort((left, right) => new Date(right.updatedAt || right.createdAt || 0).getTime() - new Date(left.updatedAt || left.createdAt || 0).getTime())
    .slice(0, 25);

  const renderContent = () => {
    if (selectedComplaint) {
      return <DetailTab complaint={selectedComplaint} sending={sending} detailLoading={detailLoading} onBack={() => setSelectedComplaint(null)} onReply={handleReply} onUpdateStatus={handleStatus} />;
    }
    switch (activeTab) {
      case "dashboard": return (
        <DashboardTab
          complaints={complaints}
          dutyAttendance={dutyAttendance}
          onDuty={onDuty}
          syncing={syncing}
          onToggleDuty={syncDuty}
          onViewComplaint={fetchComplaintDetail}
          onViewAll={() => setActiveTab("complaints")}
          loading={loading}
          refreshing={refreshing}
          onRefresh={refresh}
        />
      );
      case "complaints": return <ComplaintsTab complaints={complaints} loading={loading} onViewComplaint={fetchComplaintDetail} refreshing={refreshing} onRefresh={refresh} />;
      case "profile": return <DutyTab onDuty={onDuty} dutyAttendance={dutyAttendance} dutyUnit={dutyUnit} officerName={officerName} officerEmail={officerEmail} professionalId={professionalId} syncing={syncing} onToggleDuty={syncDuty} onLogout={onLogout} refreshing={refreshing} onRefresh={refresh} />;
      case "messages":
        return (
          <ScrollView className="flex-1 bg-slate-100" contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
            {notificationItems.length === 0 ? (
              <View className="bg-white rounded-2xl p-6 items-center gap-2">
                <Ionicons name="notifications-off-outline" size={34} color="#94A3B8" />
                <Text className="text-slate-500 text-[14px]">No notifications yet</Text>
              </View>
            ) : (
              <>
                {/* Mark all as seen button — only shown when there are unseen items */}
                {notificationItems.some(item => !seenIds.has(item.id)) && (
                  <TouchableOpacity
                    className="flex-row items-center justify-end gap-1.5 mb-3"
                    onPress={handleMarkAllSeen}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="checkmark-done-outline" size={16} color="#1D4ED8" />
                    <Text className="text-blue-700 text-[12px] font-semibold">Mark all as seen</Text>
                  </TouchableOpacity>
                )}
                {notificationItems.map((item) => {
                  const isUnseen = !seenIds.has(item.id) && ["New", "Submitted", "Reported"].includes(item.status);
                  return (
                    <TouchableOpacity
                      key={item.id}
                      className={`rounded-2xl p-4 mb-3 border ${isUnseen ? "bg-blue-50 border-blue-200" : "bg-white border-slate-200"}`}
                      onPress={() => {
                        setSeenIds(prev => { const n = new Set(prev); n.add(item.id); return n; });
                        fetchComplaintDetail(item);
                      }}
                      activeOpacity={0.85}
                    >
                      <View className="flex-row justify-between items-start gap-2">
                        <View className="flex-row items-center gap-2 flex-1">
                          {isUnseen && (
                            <View className="w-2 h-2 rounded-full bg-blue-600 mt-1" />
                          )}
                          <Text className="text-slate-900 font-bold flex-1">
                            {item.itemType || "Complaint"} - {item.status || "Submitted"}
                          </Text>
                        </View>
                        <Text className="text-slate-400 text-[11px]">
                          {fmtNotificationTime(item.updatedAt || item.createdAt)}
                        </Text>
                      </View>
                      <Text className="text-slate-600 mt-1.5 text-[13px]">
                        {item.passengerName || "Passenger"} reported on {item.vehicleNumber || "train"}.
                      </Text>
                      <Text className="text-blue-700 mt-2 text-[12px] font-semibold">
                        Tap to open complaint
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}
          </ScrollView>
        );
      default:
        return null;
    }
  };

  const urgentCount = complaints.filter(c =>
    ["New", "Submitted", "Reported"].includes(c.status) && !seenIds.has(c.id)
  ).length;

  // Mark all current notifications as seen when the messages tab is active
  const handleOpenMessages = () => {
    setActiveTab("messages");
    setNewAlertCount(0); // clear the "new complaint" counter when officer opens notifications
    setSeenIds(prev => {
      const next = new Set(prev);
      notificationItems.forEach(item => next.add(item.id));
      return next;
    });
  };

  const handleMarkAllSeen = () => {
    setSeenIds(prev => {
      const next = new Set(prev);
      notificationItems.forEach(item => next.add(item.id));
      return next;
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-blue-700" edges={["top"]}>
      {/* Header */}
      <View className="bg-blue-700 px-5 py-3.5 flex-row justify-between items-center">
        <View style={{ flex: 1 }}>
          <Text className="text-white text-lg font-extrabold">{headerTitle}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 }}>
            <Ionicons name="location-outline" size={13} color="#93C5FD" />
            <Text className="text-blue-300 text-xs">{loc}</Text>
            {/* Animated duty status pill */}
            <Animated.View
              style={{
                marginLeft: 6,
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 999,
                backgroundColor: dutyIndicatorAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["rgba(148,163,184,0.25)", "rgba(34,197,94,0.25)"],
                }),
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Animated.View
                style={{
                  width: 6, height: 6, borderRadius: 3,
                  backgroundColor: dutyIndicatorAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["#94A3B8", "#22C55E"],
                  }),
                }}
              />
              <Animated.Text
                style={{
                  fontSize: 10,
                  fontWeight: "800",
                  color: dutyIndicatorAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["#94A3B8", "#86EFAC"],
                  }),
                }}
              >
                {onDuty ? "ON DUTY" : "OFF DUTY"}
              </Animated.Text>
            </Animated.View>
          </View>
        </View>
        <TouchableOpacity className="relative p-1" onPress={handleOpenMessages}>
          <Ionicons name="notifications-outline" size={22} color="#fff" />
          {urgentCount > 0 && (
            <View className="absolute top-0 right-0 bg-red-500 rounded-lg min-w-[16px] h-4 items-center justify-center">
              <Text className="text-white text-[9px] font-extrabold">{urgentCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Real-time new complaint alert banner — slides in like a Rapido ride request */}
      <Animated.View
        style={{
          opacity: newAlertAnim,
          transform: [{ translateY: newAlertAnim.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] }) }],
          position: "absolute",
          top: 64,
          left: 0,
          right: 0,
          zIndex: 50,
        }}
        pointerEvents="none"
      >
        <View className="mx-4 bg-red-500 rounded-xl px-4 py-2.5 flex-row items-center gap-2 shadow-lg">
          <Ionicons name="alert-circle" size={18} color="#fff" />
          <Text className="text-white font-extrabold text-[13px] flex-1">
            🚨 New train complaint received!
          </Text>
          {newAlertCount > 1 && (
            <View className="bg-white rounded-full px-2 py-0.5">
              <Text className="text-red-600 text-[11px] font-extrabold">{newAlertCount}</Text>
            </View>
          )}
        </View>
      </Animated.View>

      {/* Content */}
      <View className="flex-1">{renderContent()}</View>

      {/* Bottom Nav */}
      {!selectedComplaint && (
        <View className="flex-row bg-white border-t border-slate-200 py-2">
          {TABS.map(tab => {
            const active = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                className="flex-1 items-center gap-0.5"
                onPress={() => tab.key === "messages" ? handleOpenMessages() : setActiveTab(tab.key)}
              >
                <Ionicons name={active ? tab.icon : `${tab.icon}-outline`} size={22} color={active ? "#1D4ED8" : "#94A3B8"} />
                <Text className={`text-[11px] font-medium ${active ? "text-blue-700 font-bold" : "text-slate-400"}`}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </SafeAreaView>
  );
}
