import React, { useEffect, useRef, useState } from "react";
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

const ROLE_LABELS = {
  TTR: "Traveling Ticket Examiner",
  TTE: "Train Ticket Examiner",
  RPF: "Railway Protection Force",
  Police: "Police Officer",
};

const ROLE_COLORS = {
  TTR: "#F59E0B",
  TTE: "#22C55E",
  RPF: "#3B82F6",
  Police: "#E11D48",
};

const fmtDateTime = (d) => {
  if (!d) return "-";
  return new Date(d).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

const fmtTime = (d) => {
  if (!d) return "-";
  return new Date(d).toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit",
  });
};

/** Live HH:MM:SS counter from a start time */
function useLiveDuration(startTime, running) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!running || !startTime) { setElapsed(0); return; }
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - new Date(startTime)) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startTime, running]);

  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Pulsing green dot for on-duty state */
function PulseDot({ active }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!active) { pulse.setValue(1); opacity.setValue(0.4); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulse,   { toValue: 1.55, duration: 800, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0,    duration: 800, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(pulse,   { toValue: 1,    duration: 0,   useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1,    duration: 0,   useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active]);

  const color = active ? "#22C55E" : "#94A3B8";
  const size = 14;

  return (
    <View style={{ width: size + 12, height: size + 12, alignItems: "center", justifyContent: "center" }}>
      {active && (
        <Animated.View
          style={{
            position: "absolute",
            width: size + 12,
            height: size + 12,
            borderRadius: (size + 12) / 2,
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

export default function DutyTab({
  onDuty, dutyAttendance, dutyUnit, officerName,
  officerEmail, professionalId, syncing, onToggleDuty, onLogout,
  refreshing, onRefresh,
}) {
  const roleLabel  = ROLE_LABELS[dutyUnit]  || dutyUnit  || "Railway Authority";
  const roleColor  = ROLE_COLORS[dutyUnit]  || "#3B82F6";
  const location   = dutyAttendance?.assignedStation || dutyAttendance?.assignedRoute || "-";
  const checkIn    = dutyAttendance?.checkInTime;
  const checkOut   = dutyAttendance?.checkOutTime;
  const dutyId     = dutyAttendance?.dutyId
    || (dutyAttendance?._id ? String(dutyAttendance._id).slice(-8).toUpperCase() : null)
    || "-";

  // Animated card background transition
  const cardAnim = useRef(new Animated.Value(onDuty ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(cardAnim, {
      toValue: onDuty ? 1 : 0,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [onDuty]);

  const cardBg = cardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["#F8FAFC", "#F0FDF4"],
  });
  const cardBorder = cardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["#E2E8F0", "#BBF7D0"],
  });

  // Button scale press animation
  const btnScale = useRef(new Animated.Value(1)).current;
  const onPressIn  = () => Animated.spring(btnScale, { toValue: 0.96, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(btnScale, { toValue: 1,    useNativeDriver: true }).start();

  const liveDuration = useLiveDuration(checkIn, onDuty);

  const timeline = [
    {
      label: "Checked In",
      value: checkIn ? fmtTime(checkIn) : "—",
      done: !!checkIn,
      dotColor: "#22C55E",
    },
    {
      label: "Active on Duty",
      value: onDuty ? liveDuration : (checkIn && checkOut ? `${fmtTime(checkIn)} – ${fmtTime(checkOut)}` : "—"),
      done: !!checkIn && onDuty,
      dotColor: "#F59E0B",
      isLive: onDuty,
    },
    {
      label: "Checked Out",
      value: checkOut ? fmtTime(checkOut) : "—",
      done: !!checkOut,
      dotColor: "#94A3B8",
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: "#F1F5F9" }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing || false} onRefresh={onRefresh} tintColor="#1D4ED8" />
        }
      >
        {/* ── Status Card ── */}
        <Animated.View
          style={{
            backgroundColor: cardBg,
            borderColor: cardBorder,
            borderWidth: 1.5,
            borderRadius: 20,
            padding: 20,
            marginBottom: 14,
          }}
        >
          {/* Status row */}
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
            <PulseDot active={onDuty} />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={{ fontSize: 22, fontWeight: "900", color: onDuty ? "#15803D" : "#64748B" }}>
                {onDuty ? "On Duty" : "Off Duty"}
              </Text>
              <Text style={{ fontSize: 12, color: onDuty ? "#16A34A" : "#94A3B8", marginTop: 1 }}>
                {onDuty
                  ? `Active since ${fmtTime(checkIn)}`
                  : checkOut
                    ? `Last checked out ${fmtTime(checkOut)}`
                    : "Not checked in today"}
              </Text>
            </View>
            {/* Role badge */}
            <View style={{ backgroundColor: roleColor + "20", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ color: roleColor, fontSize: 11, fontWeight: "800" }}>{dutyUnit}</Text>
            </View>
          </View>

          <View style={{ height: 1, backgroundColor: "#E2E8F0", marginBottom: 16 }} />

          {/* Info grid */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {[
              { label: "Duty ID",      value: dutyId,                icon: "barcode-outline" },
              { label: "Location",     value: location,              icon: "location-outline" },
              { label: "Role",         value: roleLabel,             icon: "shield-checkmark-outline" },
              { label: "Check-In",     value: checkIn ? fmtDateTime(checkIn) : "—", icon: "log-in-outline" },
            ].map(({ label, value, icon }) => (
              <View key={label} style={{ width: "47%", backgroundColor: "#fff", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#E2E8F0" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <Ionicons name={icon} size={13} color="#94A3B8" />
                  <Text style={{ fontSize: 10, color: "#94A3B8", fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#1E293B" }} numberOfLines={2}>{value}</Text>
              </View>
            ))}
          </View>

          {/* Live duration badge when on duty */}
          {onDuty && (
            <View style={{ marginTop: 14, backgroundColor: "#DCFCE7", borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="timer-outline" size={18} color="#16A34A" />
              <Text style={{ color: "#15803D", fontWeight: "800", fontSize: 15, fontVariant: ["tabular-nums"] }}>
                {liveDuration}
              </Text>
              <Text style={{ color: "#16A34A", fontSize: 12, marginLeft: 2 }}>on duty</Text>
            </View>
          )}
        </Animated.View>

        {/* ── Timeline ── */}
        <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 20, marginBottom: 14 }}>
          <Text style={{ fontSize: 15, fontWeight: "800", color: "#1E293B", marginBottom: 16 }}>Today's Timeline</Text>
          {timeline.map((item, i) => (
            <View key={item.label} style={{ flexDirection: "row", marginBottom: 2 }}>
              {/* Dot + line */}
              <View style={{ alignItems: "center", width: 24, marginRight: 14 }}>
                <View
                  style={{
                    width: 14, height: 14, borderRadius: 7, marginTop: 3,
                    backgroundColor: item.done ? item.dotColor : "#F1F5F9",
                    borderWidth: 2,
                    borderColor: item.done ? item.dotColor : "#CBD5E1",
                  }}
                />
                {i < timeline.length - 1 && (
                  <View style={{ width: 2, flex: 1, minHeight: 28, marginVertical: 3, backgroundColor: item.done ? item.dotColor + "60" : "#E2E8F0" }} />
                )}
              </View>
              {/* Label + value */}
              <View style={{ flex: 1, flexDirection: "row", justifyContent: "space-between", paddingBottom: 20, alignItems: "flex-start" }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: item.done ? "#1E293B" : "#94A3B8" }}>
                  {item.label}
                </Text>
                <Text style={{
                  fontSize: 13,
                  color: item.isLive ? "#16A34A" : (item.done ? "#475569" : "#CBD5E1"),
                  fontWeight: item.isLive ? "800" : "500",
                  fontVariant: item.isLive ? ["tabular-nums"] : undefined,
                }}>
                  {item.value}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Check-In / Check-Out Button ── */}
        <Animated.View style={{ transform: [{ scale: btnScale }], marginBottom: 14 }}>
          <TouchableOpacity
            style={{
              borderRadius: 18,
              paddingVertical: 18,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 10,
              backgroundColor: onDuty ? "#FEF2F2" : "#1D4ED8",
              borderWidth: onDuty ? 1.5 : 0,
              borderColor: onDuty ? "#FECACA" : "transparent",
              opacity: syncing ? 0.65 : 1,
            }}
            onPress={onToggleDuty}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            disabled={syncing}
            activeOpacity={1}
          >
            {syncing ? (
              <ActivityIndicator color={onDuty ? "#EF4444" : "#fff"} />
            ) : (
              <>
                <Ionicons
                  name={onDuty ? "log-out-outline" : "log-in-outline"}
                  size={20}
                  color={onDuty ? "#EF4444" : "#fff"}
                />
                <Text style={{ fontSize: 16, fontWeight: "800", color: onDuty ? "#EF4444" : "#fff" }}>
                  {onDuty ? "Check Out" : "Check In for Duty"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* ── Officer Info ── */}
        <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 20, marginBottom: 14 }}>
          <Text style={{ fontSize: 15, fontWeight: "800", color: "#1E293B", marginBottom: 14 }}>Officer Information</Text>
          {[
            { icon: "person-outline",           label: "Name",            value: officerName    || "-" },
            { icon: "mail-outline",             label: "Email",           value: officerEmail   || "-" },
            { icon: "id-card-outline",          label: "Professional ID", value: professionalId || "-" },
            { icon: "shield-checkmark-outline", label: "Unit",            value: dutyUnit       || "-" },
          ].map(({ icon, label, value }) => (
            <View key={label} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" }}>
              <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: "#F8FAFC", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name={icon} size={17} color="#64748B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, color: "#94A3B8", fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</Text>
                <Text style={{ fontSize: 13, color: "#1E293B", fontWeight: "600", marginTop: 1 }}>{value}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Logout ── */}
        <TouchableOpacity
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 18, backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA" }}
          onPress={onLogout}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={18} color="#EF4444" />
          <Text style={{ color: "#EF4444", fontWeight: "800", fontSize: 14 }}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
