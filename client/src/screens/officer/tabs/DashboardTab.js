import React, { useEffect, useRef } from "react";
import {
  Animated,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const fmtTime = (d) => {
  if (!d) return "-";
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
const STATUS_BG    = { New: "#FEE2E2", "In Progress": "#FEF3C7", Resolved: "#DCFCE7" };

const STAT_CONFIG = [
  { key: "New",         label: "New",        icon: "alert-circle",     iconColor: "#EF4444", iconBg: "#FEE2E2" },
  { key: "In Progress", label: "In Progress", icon: "time",             iconColor: "#F59E0B", iconBg: "#FEF3C7" },
  { key: "Resolved",    label: "Resolved",    icon: "checkmark-circle", iconColor: "#22C55E", iconBg: "#DCFCE7" },
  { key: "Total",       label: "Total",       icon: "list",             iconColor: "#3B82F6", iconBg: "#EFF6FF" },
];

/** Animated pulsing dot */
function StatusDot({ active }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!active) { pulse.setValue(1); opacity.setValue(0.5); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulse,   { toValue: 1.7, duration: 900, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0,   duration: 900, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(pulse,   { toValue: 1,   duration: 0,   useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1,   duration: 0,   useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active]);

  const color = active ? "#22C55E" : "#94A3B8";
  const size = 11;

  return (
    <View style={{ width: size + 10, height: size + 10, alignItems: "center", justifyContent: "center" }}>
      {active && (
        <Animated.View
          style={{
            position: "absolute",
            width: size + 10, height: size + 10,
            borderRadius: (size + 10) / 2,
            backgroundColor: "#22C55E",
            opacity,
            transform: [{ scale: pulse }],
          }}
        />
      )}
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </View>
  );
}

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
    || (dutyAttendance?._id ? String(dutyAttendance._id).slice(-8).toUpperCase() : null)
    || "-";

  // Animated card background
  const cardAnim = useRef(new Animated.Value(onDuty ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(cardAnim, { toValue: onDuty ? 1 : 0, duration: 450, useNativeDriver: false }).start();
  }, [onDuty]);

  const cardBg     = cardAnim.interpolate({ inputRange: [0, 1], outputRange: ["#F8FAFC", "#F0FDF4"] });
  const cardBorder = cardAnim.interpolate({ inputRange: [0, 1], outputRange: ["#E2E8F0", "#BBF7D0"] });

  // Button scale
  const btnScale = useRef(new Animated.Value(1)).current;
  const onPressIn  = () => Animated.spring(btnScale, { toValue: 0.95, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(btnScale, { toValue: 1,    useNativeDriver: true }).start();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#F1F5F9" }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing || false} onRefresh={onRefresh} tintColor="#1D4ED8" />}
    >
      {/* ── Duty Status Card ── */}
      <Animated.View
        style={{
          margin: 16,
          marginBottom: 8,
          borderRadius: 20,
          padding: 16,
          backgroundColor: cardBg,
          borderWidth: 1.5,
          borderColor: cardBorder,
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <StatusDot active={onDuty} />
            <Text style={{ fontSize: 17, fontWeight: "900", color: onDuty ? "#15803D" : "#475569" }}>
              {onDuty ? "On Duty" : "Off Duty"}
            </Text>
          </View>

          <Animated.View style={{ transform: [{ scale: btnScale }] }}>
            <TouchableOpacity
              style={{
                borderWidth: 1.5,
                borderRadius: 999,
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderColor: onDuty ? "#EF4444" : "#1D4ED8",
                backgroundColor: onDuty ? "#FEF2F2" : "#EFF6FF",
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
              onPress={onToggleDuty}
              onPressIn={onPressIn}
              onPressOut={onPressOut}
              disabled={syncing}
              activeOpacity={1}
            >
              {syncing ? (
                <ActivityIndicator size="small" color={onDuty ? "#EF4444" : "#1D4ED8"} />
              ) : (
                <>
                  <Ionicons
                    name={onDuty ? "log-out-outline" : "log-in-outline"}
                    size={14}
                    color={onDuty ? "#EF4444" : "#1D4ED8"}
                  />
                  <Text style={{ fontSize: 13, fontWeight: "800", color: onDuty ? "#EF4444" : "#1D4ED8" }}>
                    {onDuty ? "Check Out" : "Check In"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>

        {onDuty && dutyAttendance && (
          <View style={{ marginTop: 10, gap: 2 }}>
            <Text style={{ fontSize: 13, color: "#16A34A", fontWeight: "600" }}>
              Since {fmtTime(dutyAttendance.checkInTime)}
            </Text>
            <Text style={{ fontSize: 12, color: "#64748B" }}>Duty ID: {dutyId}</Text>
          </View>
        )}
        {!onDuty && (
          <Text style={{ fontSize: 13, color: "#94A3B8", marginTop: 8 }}>
            Tap Check In to start receiving complaints
          </Text>
        )}
      </Animated.View>

      {/* ── Today's Overview ── */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, marginTop: 16, marginBottom: 10 }}>
        <Text style={{ fontSize: 15, fontWeight: "800", color: "#1E293B" }}>Today's Overview</Text>
        <TouchableOpacity onPress={onViewAll}>
          <Text style={{ fontSize: 13, color: "#1D4ED8", fontWeight: "700" }}>View All</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: "row", paddingHorizontal: 12, gap: 8 }}>
        {STAT_CONFIG.map(({ key, label, icon, iconColor, iconBg }) => (
          <View key={key} style={{ flex: 1, backgroundColor: "#fff", borderRadius: 16, padding: 10, alignItems: "center", gap: 4 }}>
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: iconBg, alignItems: "center", justifyContent: "center", marginBottom: 2 }}>
              <Ionicons name={icon} size={18} color={iconColor} />
            </View>
            <Text style={{ fontSize: 20, fontWeight: "900", color: iconColor }}>
              {String(counts[key] ?? 0).padStart(2, "0")}
            </Text>
            <Text style={{ fontSize: 10, color: "#94A3B8", textAlign: "center" }}>{label}</Text>
          </View>
        ))}
      </View>

      {/* ── Priority Alert ── */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, marginTop: 20, marginBottom: 10 }}>
        <Text style={{ fontSize: 15, fontWeight: "800", color: "#1E293B" }}>Priority Alert</Text>
        <TouchableOpacity onPress={onViewAll}>
          <Text style={{ fontSize: 13, color: "#1D4ED8", fontWeight: "700" }}>View All</Text>
        </TouchableOpacity>
      </View>

      {loading && !priorityAlert && (
        <ActivityIndicator color="#1D4ED8" style={{ marginVertical: 20 }} />
      )}
      {!loading && !priorityAlert && (
        <View style={{ marginHorizontal: 16, backgroundColor: "#F0FDF4", borderRadius: 20, padding: 24, alignItems: "center", gap: 8 }}>
          <Ionicons name="shield-checkmark-outline" size={32} color="#A7F3D0" />
          <Text style={{ color: "#16A34A", fontSize: 13, fontWeight: "700" }}>No active alerts right now</Text>
        </View>
      )}
      {priorityAlert && (
        <View style={{ marginHorizontal: 16, backgroundColor: "#fff", borderRadius: 20, padding: 16, borderLeftWidth: 4, borderLeftColor: "#EF4444" }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <View style={{ backgroundColor: "#FEE2E2", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
              <Text style={{ color: "#EF4444", fontSize: 11, fontWeight: "900" }}>NEW COMPLAINT</Text>
            </View>
            <Text style={{ fontSize: 12, color: "#94A3B8" }}>{timeAgo(priorityAlert.createdAt)}</Text>
          </View>
          <Text style={{ fontSize: 15, fontWeight: "900", color: "#1E293B", marginBottom: 6 }}>
            ID: {priorityAlert.id?.slice(-10)?.toUpperCase() || "-"}
          </Text>
          {[
            ["Train",       [priorityAlert.vehicleNumber, priorityAlert.trainName].filter(Boolean).join(" – ") || "-"],
            ["Route",       `${priorityAlert.fromLocation || "-"}  →  ${priorityAlert.toLocation || "-"}`],
            ["Item",        priorityAlert.itemType || "-"],
            ["Reported by", priorityAlert.passengerName || "-"],
          ].map(([label, value]) => (
            <Text key={label} style={{ fontSize: 13, color: "#475569", marginBottom: 3 }}>
              <Text style={{ fontWeight: "700" }}>{label}: </Text>{value}
            </Text>
          ))}
          <TouchableOpacity
            style={{ backgroundColor: "#1E293B", borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 14 }}
            onPress={() => onViewComplaint(priorityAlert)}
          >
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>View &amp; Respond</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Recent Complaints ── */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, marginTop: 20, marginBottom: 10 }}>
        <Text style={{ fontSize: 15, fontWeight: "800", color: "#1E293B" }}>Recent Complaints</Text>
        <TouchableOpacity onPress={onViewAll}>
          <Text style={{ fontSize: 13, color: "#1D4ED8", fontWeight: "700" }}>View All</Text>
        </TouchableOpacity>
      </View>

      {recent.length === 0 && !loading && (
        <Text style={{ textAlign: "center", color: "#94A3B8", marginTop: 10, fontSize: 13 }}>No recent complaints</Text>
      )}
      {recent.map(c => {
        const ns = normalizeStatus(c.status);
        return (
          <TouchableOpacity
            key={c.id}
            style={{ marginHorizontal: 16, marginBottom: 8, backgroundColor: "#fff", borderRadius: 16, padding: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
            onPress={() => onViewComplaint(c)}
            activeOpacity={0.8}
          >
            <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                <Ionicons name="bag-handle-outline" size={20} color="#64748B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "800", color: "#1E293B" }}>
                  {c.id?.slice(-10)?.toUpperCase() || "-"}
                </Text>
                <Text style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>{c.itemType}</Text>
              </View>
            </View>
            <View style={{ alignItems: "flex-end", gap: 4 }}>
              <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: STATUS_BG[ns] }}>
                <Text style={{ fontSize: 10, fontWeight: "900", color: STATUS_COLOR[ns] }}>{ns.toUpperCase()}</Text>
              </View>
              <Text style={{ fontSize: 11, color: "#94A3B8" }}>{fmtTime(c.createdAt)}</Text>
            </View>
          </TouchableOpacity>
        );
      })}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}
