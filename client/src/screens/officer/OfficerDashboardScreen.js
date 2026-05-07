import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
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
  passengerPhone: a.passengerPhone || a.phoneNumber || a.contactNumber || "–",
  itemType: a.itemType || a.lostItemType || "Item",
  description: a.description || a.itemDescription || "",
  vehicleNumber: a.vehicleNumber || a.trainNumber || "–",
  trainName: a.trainName || a.vehicleName || a.busName || "",
  route: a.route || `${a.fromLocation || "Origin"} → ${a.toLocation || "Destination"}`,
  fromLocation: a.fromLocation || a.boardingStation || a.fromStop || "–",
  toLocation: a.toLocation || a.destinationStation || a.toStop || "–",
  coach: a.coach || a.coachNumber || "–",
  seat: a.seat || a.berthNumber || "–",
  priority: a.priority || "Normal",
  reportedAt: a.reportedAt || a.reportedAtStation || a.currentTrainLocation || "–",
  platform: a.platform || a.platformNumber || "–",
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
      if (setOnDuty) setOnDuty(Boolean(data?.onDuty));
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
    setSyncing(true);
    try {
      const next = !onDuty;
      const ep = next ? "/auth/duty/check-in" : "/auth/duty/check-out";
      const res = await axios.post(`${API_BASE}${ep}`, {
        email: officerEmail || undefined, professionalId: professionalId || undefined, dutyUnit,
      }, { headers: headers() });
      if (setOnDuty) setOnDuty(next);
      setDutyAttendance(res.data?.attendance || null);
      if (next) loadComplaints();
    } catch { /* silent */ } finally { setSyncing(false); }
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

  const roleTitle = { TTR: "TTR Dashboard", TTE: "TTE Dashboard", RPF: "RPF Dashboard", Police: "Police Dashboard" }[dutyUnit] || "Officer Dashboard";
  const loc = dutyAttendance?.assignedStation || dutyAttendance?.assignedRoute || "Chennai Central (MAS)";

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
      case "complaints": return <ComplaintsTab complaints={complaints} loading={loading} onViewComplaint={fetchComplaintDetail} />;
      case "profile": return <DutyTab onDuty={onDuty} dutyAttendance={dutyAttendance} dutyUnit={dutyUnit} officerName={officerName} officerEmail={officerEmail} professionalId={professionalId} syncing={syncing} onToggleDuty={syncDuty} onLogout={onLogout} />;
      default: return (
        <View style={s.placeholder}>
          <Ionicons name="chatbubble-outline" size={48} color="#CBD5E1" />
          <Text style={s.placeholderText}>Messages coming soon</Text>
        </View>
      );
    }
  };

  return (
    <SafeAreaView style={s.root} edges={["top"]}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>{roleTitle}</Text>
          <View style={s.headerLoc}>
            <Ionicons name="location-outline" size={13} color="#93C5FD" />
            <Text style={s.headerLocText}>{loc}</Text>
          </View>
        </View>
        <TouchableOpacity style={s.notifBtn}>
          <Ionicons name="notifications-outline" size={22} color="#fff" />
          {complaints.filter(c => ["New", "Submitted", "Reported"].includes(c.status)).length > 0 && (
            <View style={s.notifBadge}>
              <Text style={s.notifBadgeText}>{complaints.filter(c => ["New", "Submitted", "Reported"].includes(c.status)).length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>{renderContent()}</View>

      {/* Bottom Nav */}
      {!selectedComplaint && (
        <View style={s.bottomNav}>
          {TABS.map(tab => {
            const active = activeTab === tab.key;
            return (
              <TouchableOpacity key={tab.key} style={s.navItem} onPress={() => setActiveTab(tab.key)}>
                <Ionicons name={active ? tab.icon : `${tab.icon}-outline`} size={22} color={active ? "#1D4ED8" : "#94A3B8"} />
                <Text style={[s.navLabel, active && s.navLabelActive]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#1D4ED8" },
  header: { backgroundColor: "#1D4ED8", paddingHorizontal: 20, paddingVertical: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  headerLoc: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  headerLocText: { color: "#93C5FD", fontSize: 12 },
  notifBtn: { position: "relative", padding: 4 },
  notifBadge: { position: "absolute", top: 0, right: 0, backgroundColor: "#EF4444", borderRadius: 8, minWidth: 16, height: 16, alignItems: "center", justifyContent: "center" },
  notifBadgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  bottomNav: { flexDirection: "row", backgroundColor: "#fff", borderTopWidth: 1, borderColor: "#E2E8F0", paddingBottom: 8, paddingTop: 8 },
  navItem: { flex: 1, alignItems: "center", gap: 3 },
  navLabel: { fontSize: 11, color: "#94A3B8", fontWeight: "500" },
  navLabelActive: { color: "#1D4ED8", fontWeight: "700" },
  placeholder: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, backgroundColor: "#F8FAFC" },
  placeholderText: { color: "#94A3B8", fontSize: 15 },
});
