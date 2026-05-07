import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, Platform, ToastAndroid, ScrollView } from "react-native";
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
  const socketRef = useRef(null);

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
      const onNew = (data) => {
        const a = normalizeAlert(data?.complaint || data);
        setComplaints(prev => [a, ...prev.filter(c => c.id !== a.id)]);
      };
      socket.on("complaint:new", onNew);
      socket.on("complaint:status-change", onNew);
      return () => { socket.off("complaint:new", onNew); socket.off("complaint:status-change", onNew); socket.disconnect(); };
    } catch { return undefined; }
  }, [officerEmail, professionalId, dutyUnit]);

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
        } else {
          socketService.leaveOfficer(officerRoomId);
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
      alert(`Failed to ${onDuty ? "check out" : "check in"}: ${serverMessage || error.message}`);
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
        <View>
          <Text className="text-white text-lg font-extrabold">{headerTitle}</Text>
          <View className="flex-row items-center gap-1 mt-0.5">
            <Ionicons name="location-outline" size={13} color="#93C5FD" />
            <Text className="text-blue-300 text-xs">{loc}</Text>
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
