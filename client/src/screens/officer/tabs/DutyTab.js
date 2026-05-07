import React from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const fmt = (d) => d ? new Date(d).toLocaleString() : "–";
const fmtTime = (d) => d ? new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "–";

const ROLE_LABELS = { TTR: "Traveling Ticket Examiner", TTE: "Train Ticket Examiner", RPF: "Railway Protection Force", Police: "Police Officer" };

export default function DutyTab({ onDuty, dutyAttendance, dutyUnit, officerName, officerEmail, professionalId, syncing, onToggleDuty, onLogout }) {
  const roleLabel = ROLE_LABELS[dutyUnit] || dutyUnit || "Railway Authority";
  const location = dutyAttendance?.assignedStation || dutyAttendance?.assignedRoute || "–";
  const dutyId = dutyAttendance?.dutyId || dutyAttendance?._id?.slice(-8)?.toUpperCase() || "–";
  const checkIn = dutyAttendance?.checkInTime;
  const checkOut = dutyAttendance?.checkOutTime;

  const timeline = [
    { label: "Checked In", time: checkIn ? fmtTime(checkIn) : "–", done: !!checkIn },
    { label: "Active on Duty", time: checkIn ? `${fmtTime(checkIn)} – Till Now` : "–", done: !!checkIn && onDuty },
    { label: "Checked Out", time: checkOut ? fmtTime(checkOut) : "–", done: !!checkOut },
  ];

  return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
      {/* Status Card */}
      <View style={[s.card, onDuty ? s.cardOn : s.cardOff]}>
        <View style={s.statusRow}>
          <View style={[s.dot, { backgroundColor: onDuty ? "#22C55E" : "#94A3B8" }]} />
          <Text style={s.statusText}>{onDuty ? "On Duty" : "Off Duty"}</Text>
        </View>
        <View style={s.infoGrid}>
          <InfoRow icon="time-outline" label="Duty Started At" value={fmt(checkIn)} />
          <InfoRow icon="card-outline" label="Duty ID" value={dutyId} />
          <InfoRow icon="location-outline" label="Location" value={location} />
          <InfoRow icon="shield-outline" label="Role" value={roleLabel} />
        </View>
      </View>

      {/* Timeline */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Today's Timeline</Text>
        {timeline.map((item, i) => (
          <View key={item.label} style={s.timelineRow}>
            <View style={s.timelineLeft}>
              <View style={[s.tlDot, item.done ? s.tlDotActive : s.tlDotInactive]} />
              {i < timeline.length - 1 && <View style={s.tlLine} />}
            </View>
            <View style={s.timelineRight}>
              <Text style={[s.tlLabel, !item.done && s.tlLabelDim]}>{item.label}</Text>
              <Text style={s.tlTime}>{item.time}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Officer Info */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Officer Information</Text>
        <InfoRow icon="person-outline" label="Name" value={officerName || "–"} />
        <InfoRow icon="mail-outline" label="Email" value={officerEmail || "–"} />
        <InfoRow icon="id-card-outline" label="Professional ID" value={professionalId || "–"} />
        <InfoRow icon="shield-checkmark-outline" label="Unit" value={dutyUnit || "–"} />
      </View>

      {/* Checkout */}
      <TouchableOpacity style={[s.checkoutBtn, { backgroundColor: onDuty ? "#EF4444" : "#1D4ED8" }]} onPress={onToggleDuty} disabled={syncing}>
        {syncing ? <ActivityIndicator color="#fff" /> : <Text style={s.checkoutText}>{onDuty ? "Checkout Duty" : "Check In for Duty"}</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={s.logoutBtn} onPress={onLogout}>
        <Ionicons name="log-out-outline" size={18} color="#EF4444" />
        <Text style={s.logoutText}>Logout</Text>
      </TouchableOpacity>
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <View style={s.infoRow}>
      <View style={s.infoLeft}>
        <Ionicons name={icon} size={16} color="#64748B" />
        <Text style={s.infoLabel}>{label}</Text>
      </View>
      <Text style={s.infoVal}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC", padding: 16 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 12, elevation: 2 },
  cardOn: { borderLeftWidth: 4, borderLeftColor: "#22C55E" },
  cardOff: { borderLeftWidth: 4, borderLeftColor: "#94A3B8" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  statusText: { fontSize: 18, fontWeight: "800", color: "#0F172A" },
  infoGrid: { gap: 4 },
  cardTitle: { fontSize: 14, fontWeight: "700", color: "#0F172A", marginBottom: 12 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderColor: "#F1F5F9" },
  infoLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  infoLabel: { fontSize: 13, color: "#64748B" },
  infoVal: { fontSize: 13, fontWeight: "600", color: "#0F172A", maxWidth: "55%", textAlign: "right" },
  timelineRow: { flexDirection: "row", marginBottom: 4 },
  timelineLeft: { alignItems: "center", width: 24, marginRight: 12 },
  tlDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  tlDotActive: { backgroundColor: "#22C55E" },
  tlDotInactive: { backgroundColor: "#E2E8F0", borderWidth: 1, borderColor: "#CBD5E1" },
  tlLine: { width: 2, flex: 1, backgroundColor: "#E2E8F0", marginVertical: 2 },
  timelineRight: { flex: 1, paddingBottom: 16 },
  tlLabel: { fontSize: 13, fontWeight: "600", color: "#0F172A" },
  tlLabelDim: { color: "#94A3B8" },
  tlTime: { fontSize: 12, color: "#64748B", marginTop: 2 },
  checkoutBtn: { borderRadius: 14, paddingVertical: 15, alignItems: "center", marginBottom: 12 },
  checkoutText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderWidth: 1, borderColor: "#FECACA", borderRadius: 14, backgroundColor: "#FFF5F5" },
  logoutText: { color: "#EF4444", fontWeight: "700", fontSize: 14 },
});
