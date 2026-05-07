import React from "react";
yyyyyyyyyyyyyyimport {
  View, Text, ScrollView, TouchableOpacity,
    StyleSheet, ActivityIndicator, RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const ROLE_LABELS = {
  TTR: "Traveling Ticket Examiner",
  TTE: "Train Ticket Examiner",
  RPF: "Railway Protection Force",
  Police: "Police Officer",
};

const fmtDateTime = (d) => {
  if (!d) return "–";
  return new Date(d).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

const fmtTime = (d) => {
  if (!d) return "–";
  return new Date(d).toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit",
  });
};

export default function DutyTab({
  onDuty, dutyAttendance, dutyUnit, officerName,
  officerEmail, professionalId, syncing, onToggleDuty, onLogout,
  refreshing, onRefresh,
}) {
  const roleLabel = ROLE_LABELS[dutyUnit] || dutyUnit || "Railway Authority";
  const location = dutyAttendance?.assignedStation || dutyAttendance?.assignedRoute || "–";
  const dutyId = dutyAttendance?.dutyId
    || (dutyAttendance?._id ? dutyAttendance._id.slice(-8).toUpperCase() : "–")
    || "–";
  const checkIn = dutyAttendance?.checkInTime;
  const checkOut = dutyAttendance?.checkOutTime;

  const infoRows = [
    { label: "Duty Started At", value: checkIn ? fmtDateTime(checkIn) : "Not started" },
    { label: "Duty ID", value: dutyId },
    { label: "Location", value: location },
    { label: "Role", value: roleLabel },
  ];

  const timeline = [
    {
      label: "Checked In",
      value: checkIn ? fmtTime(checkIn) : "–",
      done: !!checkIn,
      active: false,
      dotColor: "#22C55E",
      lineColor: "#22C55E",
    },
    {
      label: "Active on Duty",
      value: checkIn
        ? `${fmtTime(checkIn)} – ${onDuty ? "Till Now" : fmtTime(checkOut)}`
        : "–",
      done: !!checkIn && onDuty,
      active: true,
      dotColor: "#F59E0B",
      lineColor: "#E2E8F0",
    },
    {
      label: "Checked Out",
      value: checkOut ? fmtTime(checkOut) : "–",
      done: !!checkOut,
      active: false,
      dotColor: "#CBD5E1",
      lineColor: null,
    },
  ];

  return (
    <View style={s.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing || false} onRefresh={onRefresh} />
        }
      >
        {/* ── On Duty Status Card ── */}
        <View style={[s.card, onDuty ? s.cardOn : s.cardOff]}>
          {/* Status Row */}
          <View style={s.statusRow}>
            <View style={[s.statusDot, { backgroundColor: onDuty ? "#22C55E" : "#94A3B8" }]}>
              <View style={s.statusDotInner} />
            </View>
            <Text style={[s.statusText, { color: onDuty ? "#16A34A" : "#64748B" }]}>
              {onDuty ? "On Duty" : "Off Duty"}
            </Text>
          </View>

          <View style={s.divider} />

          {/* Info Rows */}
          {infoRows.map(({ label, value }) => (
            <View key={label} style={s.infoBlock}>
              <Text style={s.infoLabel}>{label}</Text>
              <Text style={s.infoValue}>{value}</Text>
            </View>
          ))}
        </View>

        {/* ── Today's Timeline ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Today's Timeline</Text>
          {timeline.map((item, i) => (
            <View key={item.label} style={s.timelineRow}>
              {/* Left column: dot + line */}
              <View style={s.timelineLeft}>
                <View style={[
                  s.tlDot,
                  item.done
                    ? { backgroundColor: item.dotColor, borderColor: item.dotColor }
                    : s.tlDotEmpty,
                ]} />
                {i < timeline.length - 1 && (
                  <View style={[
                    s.tlLine,
                    { backgroundColor: item.done ? item.lineColor : "#E2E8F0" },
                  ]} />
                )}
              </View>

              {/* Right: label + value */}
              <View style={s.timelineRight}>
                <Text style={[
                  s.tlLabel,
                  !item.done && s.tlLabelDim,
                ]}>
                  {item.label}
                </Text>
                <Text style={[
                  s.tlValue,
                  !item.done && s.tlValueDim,
                ]}>
                  {item.value}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Checkout / Check-in Button ── */}
        <TouchableOpacity
          style={[
            s.actionBtn,
            onDuty ? s.checkoutBtn : s.checkinBtn,
            syncing && s.btnDisabled,
          ]}
          onPress={onToggleDuty}
          disabled={syncing}
          activeOpacity={0.85}
        >
          {syncing ? (
            <ActivityIndicator color={onDuty ? "#EF4444" : "#fff"} />
          ) : (
            <Text style={[
              s.actionBtnText,
              { color: onDuty ? "#EF4444" : "#fff" },
            ]}>
              {onDuty ? "Checkout Duty" : "Check In for Duty"}
            </Text>
          )}
        </TouchableOpacity>

        {/* ── Officer Info ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Officer Information</Text>
          {[
            { icon: "person-outline", label: officerName || "–" },
            { icon: "mail-outline", label: officerEmail || "–" },
            { icon: "id-card-outline", label: professionalId || "–" },
            { icon: "shield-checkmark-outline", label: dutyUnit || "–" },
          ].map(({ icon, label }) => (
            <View key={icon} style={s.officerRow}>
              <Ionicons name={icon} size={17} color="#64748B" />
              <Text style={s.officerText}>{label}</Text>
            </View>
          ))}
        </View>

        {/* ── Logout ── */}
        <TouchableOpacity style={s.logoutBtn} onPress={onLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={18} color="#EF4444" />
          <Text style={s.logoutText}>Logout</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F1F5F9" },
  scroll: { padding: 16 },

  // Cards
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  cardOn: { borderWidth: 1, borderColor: "#BBF7D0", backgroundColor: "#F0FFF4" },
  cardOff: { borderWidth: 1, borderColor: "#E2E8F0" },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#0F172A", marginBottom: 16 },

  // Status row
  statusRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  statusDot: {
    width: 22, height: 22, borderRadius: 11,
    justifyContent: "center", alignItems: "center",
  },
  statusDotInner: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: "#fff",
  },
  statusText: { fontSize: 20, fontWeight: "800" },
  divider: { height: 1, backgroundColor: "#E2E8F0", marginBottom: 14 },

  // Info blocks (label above value)
  infoBlock: { marginBottom: 14 },
  infoLabel: { fontSize: 13, color: "#64748B", marginBottom: 2 },
  infoValue: { fontSize: 15, fontWeight: "700", color: "#0F172A" },

  // Timeline
  timelineRow: { flexDirection: "row", marginBottom: 2 },
  timelineLeft: { alignItems: "center", width: 26, marginRight: 14 },
  tlDot: {
    width: 14, height: 14, borderRadius: 7,
    borderWidth: 2, marginTop: 3,
  },
  tlDotEmpty: {
    backgroundColor: "#F1F5F9",
    borderColor: "#CBD5E1",
  },
  tlLine: { width: 2, flex: 1, minHeight: 28, marginVertical: 3 },
  timelineRight: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 20,
    alignItems: "flex-start",
  },
  tlLabel: { fontSize: 14, fontWeight: "600", color: "#0F172A" },
  tlLabelDim: { color: "#94A3B8" },
  tlValue: { fontSize: 13, color: "#475569" },
  tlValueDim: { color: "#CBD5E1" },

  // Checkout / Check-in button
  actionBtn: {
    borderRadius: 14, paddingVertical: 16,
    alignItems: "center", marginBottom: 14,
  },
  checkoutBtn: {
    backgroundColor: "#FFF5F5",
    borderWidth: 1.5,
    borderColor: "#FECACA",
  },
  checkinBtn: { backgroundColor: "#1D4ED8" },
  btnDisabled: { opacity: 0.6 },
  actionBtnText: { fontSize: 16, fontWeight: "700" },

  // Officer info rows
  officerRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderColor: "#F1F5F9" },
  officerText: { fontSize: 13, color: "#334155", flex: 1 },

  // Logout
  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 14, borderRadius: 14,
    backgroundColor: "#FFF5F5", borderWidth: 1, borderColor: "#FECACA",
    marginBottom: 8,
  },
  logoutText: { color: "#EF4444", fontWeight: "700", fontSize: 14 },
});
