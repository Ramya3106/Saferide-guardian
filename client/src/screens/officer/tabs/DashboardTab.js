import React from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const fmtTime = (d) => {
  if (!d) return "–";
  return new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
};

const timeAgo = (d) => {
  if (!d) return "";
  const sec = Math.floor((Date.now() - new Date(d)) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ago`;
};

const normalizeStatus = (s) => {
  const v = String(s || "").trim();
  if (["Item Found", "Closed", "Resolved", "Recovered", "Secured"].includes(v)) return "Resolved";
  if (["Submitted", "Reported", "Staff Notified", "Seen"].includes(v)) return "New";
  return "In Progress";
};

const STATUS_COLOR = { New: "#EF4444", "In Progress": "#F59E0B", Resolved: "#22C55E" };
const STATUS_BG = { New: "#FEE2E2", "In Progress": "#FEF3C7", Resolved: "#DCFCE7" };

const STAT_CONFIG = [
  { key: "New",         label: "New\nComplaints", icon: "alert-circle",   iconColor: "#EF4444", iconBg: "#FEE2E2" },
  { key: "In Progress", label: "In Progress",     icon: "time",           iconColor: "#F59E0B", iconBg: "#FEF3C7" },
  { key: "Resolved",    label: "Resolved",        icon: "checkmark-circle",iconColor: "#22C55E",iconBg: "#DCFCE7" },
  { key: "Total",       label: "Total\nComplaints",icon: "list",          iconColor: "#3B82F6", iconBg: "#EFF6FF" },
];

export default function DashboardTab({
  complaints, dutyAttendance, onDuty, syncing,
  onToggleDuty, onViewComplaint, onViewAll, loading, refreshing, onRefresh,
}) {
  const newC     = complaints.filter(c => normalizeStatus(c.status) === "New").length;
  const inProg   = complaints.filter(c => normalizeStatus(c.status) === "In Progress").length;
  const resolved = complaints.filter(c => normalizeStatus(c.status) === "Resolved").length;
  const total    = complaints.length;
  const counts   = { New: newC, "In Progress": inProg, Resolved: resolved, Total: total };

  const priorityAlert = complaints.find(c => normalizeStatus(c.status) === "New")
    || complaints.find(c => normalizeStatus(c.status) === "In Progress");

  const recent = complaints.slice(0, 5);

  const dutyId = dutyAttendance?.dutyId
    || (dutyAttendance?._id ? dutyAttendance._id.slice(-8).toUpperCase() : null)
    || "–";

  return (
    <ScrollView
      style={s.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing || false} onRefresh={onRefresh} />}
    >
      {/* ── On Duty Card ── */}
      <View style={[s.dutyCard, onDuty ? s.dutyCardOn : s.dutyCardOff]}>
        <View style={s.dutyTop}>
          <View style={s.dutyStatusRow}>
            <View style={[s.dutyDot, { backgroundColor: onDuty ? "#22C55E" : "#94A3B8" }]} />
            <Text style={s.dutyStatusText}>{onDuty ? "On Duty" : "Off Duty"}</Text>
          </View>
          <TouchableOpacity
            style={[s.dutyToggleBtn, { borderColor: onDuty ? "#EF4444" : "#1D4ED8" }]}
            onPress={onToggleDuty}
            disabled={syncing}
          >
            {syncing
              ? <ActivityIndicator size="small" color={onDuty ? "#EF4444" : "#1D4ED8"} />
              : <Text style={[s.dutyToggleTxt, { color: onDuty ? "#EF4444" : "#1D4ED8" }]}>
                  {onDuty ? "Checkout Duty" : "Check In"}
                </Text>
            }
          </TouchableOpacity>
        </View>
        {onDuty && dutyAttendance && (
          <View style={s.dutyMeta}>
            <Text style={s.dutyMetaText}>Since {fmtTime(dutyAttendance.checkInTime)}</Text>
            <Text style={s.dutyMetaText}>Duty ID: {dutyId}</Text>
          </View>
        )}
        {!onDuty && (
          <Text style={s.dutyMetaText}>Tap Check In to start your duty</Text>
        )}
      </View>

      {/* ── Today's Overview ── */}
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>Today's Overview</Text>
        <TouchableOpacity onPress={onViewAll}><Text style={s.viewAll}>View All</Text></TouchableOpacity>
      </View>
      <View style={s.statsRow}>
        {STAT_CONFIG.map(({ key, label, icon, iconColor, iconBg }) => (
          <View key={key} style={s.statCard}>
            <View style={[s.statIconWrap, { backgroundColor: iconBg }]}>
              <Ionicons name={icon} size={20} color={iconColor} />
            </View>
            <Text style={[s.statVal, { color: iconColor }]}>
              {String(counts[key] ?? 0).padStart(2, "0")}
            </Text>
            <Text style={s.statLabel}>{label}</Text>
          </View>
        ))}
      </View>

      {/* ── Priority Alerts ── */}
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>Priority Alerts</Text>
        <TouchableOpacity onPress={onViewAll}><Text style={s.viewAll}>View All</Text></TouchableOpacity>
      </View>

      {loading && !priorityAlert && (
        <ActivityIndicator color="#1D4ED8" style={{ marginVertical: 20 }} />
      )}
      {!loading && !priorityAlert && (
        <View style={s.emptyCard}>
          <Ionicons name="shield-checkmark-outline" size={32} color="#A7F3D0" />
          <Text style={s.emptyTxt}>No active alerts right now</Text>
        </View>
      )}
      {priorityAlert && (
        <View style={s.alertCard}>
          <View style={s.alertTop}>
            <View style={s.alertBadge}>
              <Text style={s.alertBadgeText}>NEW COMPLAINT</Text>
            </View>
            <Text style={s.alertAgo}>{timeAgo(priorityAlert.createdAt)}</Text>
          </View>
          <Text style={s.alertId}>ID: {priorityAlert.id?.slice(-10)?.toUpperCase() || "–"}</Text>
          <Text style={s.alertLine}>Train: {[priorityAlert.vehicleNumber, priorityAlert.trainName].filter(Boolean).join(" – ") || "–"}</Text>
          <Text style={s.alertLine}>
            From: {priorityAlert.fromLocation || "–"}{"  →  "}{priorityAlert.toLocation || "–"}
          </Text>
          <Text style={s.alertLine}>Item:  {priorityAlert.itemType}</Text>
          <Text style={s.alertLine}>Reported by: {priorityAlert.passengerName}</Text>
          <TouchableOpacity style={s.respondBtn} onPress={() => onViewComplaint(priorityAlert)}>
            <Text style={s.respondBtnText}>View & Respond</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Recent Complaints ── */}
      <View style={[s.sectionHeader, { marginTop: 8 }]}>
        <Text style={s.sectionTitle}>Recent Complaints</Text>
        <TouchableOpacity onPress={onViewAll}><Text style={s.viewAll}>View All</Text></TouchableOpacity>
      </View>

      {recent.length === 0 && !loading && (
        <Text style={s.noRecentTxt}>No recent complaints</Text>
      )}
      {recent.map(c => {
        const ns = normalizeStatus(c.status);
        return (
          <TouchableOpacity key={c.id} style={s.recentCard} onPress={() => onViewComplaint(c)} activeOpacity={0.8}>
            <View style={s.recentLeft}>
              <View style={s.recentIcon}>
                <Ionicons name="bag-handle-outline" size={20} color="#64748B" />
              </View>
              <View style={s.recentInfo}>
                <Text style={s.recentId}>{c.id?.slice(-10)?.toUpperCase() || "–"}</Text>
                <Text style={s.recentItem}>{c.itemType}</Text>
              </View>
            </View>
            <View style={s.recentRight}>
              <View style={[s.statusBadge, { backgroundColor: STATUS_BG[ns] }]}>
                <Text style={[s.statusBadgeText, { color: STATUS_COLOR[ns] }]}>{ns.toUpperCase()}</Text>
              </View>
              <Text style={s.recentTime}>{fmtTime(c.createdAt)}</Text>
            </View>
          </TouchableOpacity>
        );
      })}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },

  // Duty card
  dutyCard: { margin: 16, marginBottom: 8, borderRadius: 16, padding: 16, borderWidth: 1 },
  dutyCardOn: { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" },
  dutyCardOff: { backgroundColor: "#F8FAFC", borderColor: "#E2E8F0" },
  dutyTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dutyStatusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dutyDot: { width: 11, height: 11, borderRadius: 6 },
  dutyStatusText: { fontSize: 17, fontWeight: "800", color: "#0F172A" },
  dutyToggleBtn: { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 7 },
  dutyToggleTxt: { fontSize: 13, fontWeight: "700" },
  dutyMeta: { marginTop: 10, gap: 3 },
  dutyMetaText: { fontSize: 13, color: "#64748B" },

  // Section headers
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, marginTop: 16, marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#0F172A" },
  viewAll: { fontSize: 13, color: "#1D4ED8", fontWeight: "600" },

  // Stats
  statsRow: { flexDirection: "row", paddingHorizontal: 12, gap: 8 },
  statCard: { flex: 1, backgroundColor: "#fff", borderRadius: 14, padding: 10, alignItems: "center", gap: 4, elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  statIconWrap: { width: 38, height: 38, borderRadius: 10, justifyContent: "center", alignItems: "center", marginBottom: 2 },
  statVal: { fontSize: 22, fontWeight: "900" },
  statLabel: { fontSize: 10, color: "#64748B", textAlign: "center" },

  // Alert card
  alertCard: { marginHorizontal: 16, backgroundColor: "#fff", borderRadius: 16, padding: 16, elevation: 3, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, borderLeftWidth: 4, borderLeftColor: "#EF4444" },
  alertTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  alertBadge: { backgroundColor: "#FEE2E2", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  alertBadgeText: { color: "#EF4444", fontSize: 11, fontWeight: "800" },
  alertAgo: { fontSize: 12, color: "#94A3B8" },
  alertId: { fontSize: 15, fontWeight: "800", color: "#0F172A", marginBottom: 6 },
  alertLine: { fontSize: 13, color: "#334155", marginBottom: 3 },
  respondBtn: { backgroundColor: "#1E293B", borderRadius: 12, paddingVertical: 13, alignItems: "center", marginTop: 14 },
  respondBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  // Empty / no alert
  emptyCard: { marginHorizontal: 16, backgroundColor: "#F0FDF4", borderRadius: 14, padding: 24, alignItems: "center", gap: 8 },
  emptyTxt: { color: "#16A34A", fontSize: 14, fontWeight: "600" },
  noRecentTxt: { textAlign: "center", color: "#94A3B8", marginTop: 10, fontSize: 13 },

  // Recent
  recentCard: { marginHorizontal: 16, marginBottom: 8, backgroundColor: "#fff", borderRadius: 14, padding: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center", elevation: 1 },
  recentLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  recentIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: "#F1F5F9", justifyContent: "center", alignItems: "center", marginRight: 12 },
  recentInfo: { flex: 1 },
  recentId: { fontSize: 13, fontWeight: "700", color: "#0F172A" },
  recentItem: { fontSize: 12, color: "#64748B", marginTop: 2 },
  recentRight: { alignItems: "flex-end", gap: 5 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusBadgeText: { fontSize: 10, fontWeight: "800" },
  recentTime: { fontSize: 11, color: "#94A3B8" },
});
