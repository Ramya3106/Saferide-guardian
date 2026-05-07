import React from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
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
      dotColor: "#22C55E",
      lineColor: "#22C55E",
    },
    {
      label: "Active on Duty",
      value: checkIn
        ? `${fmtTime(checkIn)} – ${onDuty ? "Till Now" : fmtTime(checkOut)}`
        : "–",
      done: !!checkIn && onDuty,
      dotColor: "#F59E0B",
      lineColor: "#E2E8F0",
    },
    {
      label: "Checked Out",
      value: checkOut ? fmtTime(checkOut) : "–",
      done: !!checkOut,
      dotColor: "#CBD5E1",
      lineColor: null,
    },
  ];

  return (
    <View className="flex-1 bg-slate-100">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing || false} onRefresh={onRefresh} />
        }
      >
        {/* ── On Duty Status Card ── */}
        <View
          className={`bg-white rounded-2xl p-[18px] mb-3.5 border ${
            onDuty ? "border-green-200 bg-green-50" : "border-slate-200"
          }`}
        >
          {/* Status Row */}
          <View className="flex-row items-center gap-2.5 mb-3.5">
            <View
              className="w-[22px] h-[22px] rounded-full justify-center items-center"
              style={{ backgroundColor: onDuty ? "#22C55E" : "#94A3B8" }}
            >
              <View className="w-2.5 h-2.5 rounded-full bg-white" />
            </View>
            <Text
              className="text-xl font-extrabold"
              style={{ color: onDuty ? "#16A34A" : "#64748B" }}
            >
              {onDuty ? "On Duty" : "Off Duty"}
            </Text>
          </View>

          <View className="h-px bg-slate-200 mb-3.5" />

          {/* Info Rows */}
          {infoRows.map(({ label, value }) => (
            <View key={label} className="mb-3.5">
              <Text className="text-[13px] text-slate-500 mb-0.5">{label}</Text>
              <Text className="text-[15px] font-bold text-slate-900">{value}</Text>
            </View>
          ))}
        </View>

        {/* ── Today's Timeline ── */}
        <View className="bg-white rounded-2xl p-[18px] mb-3.5">
          <Text className="text-base font-bold text-slate-900 mb-4">Today's Timeline</Text>
          {timeline.map((item, i) => (
            <View key={item.label} className="flex-row mb-0.5">
              {/* Left column: dot + line */}
              <View className="items-center w-[26px] mr-3.5">
                <View
                  className="w-3.5 h-3.5 rounded-full border-2 mt-[3px]"
                  style={
                    item.done
                      ? { backgroundColor: item.dotColor, borderColor: item.dotColor }
                      : { backgroundColor: "#F1F5F9", borderColor: "#CBD5E1" }
                  }
                />
                {i < timeline.length - 1 && (
                  <View
                    className="w-0.5 flex-1 min-h-[28px] my-[3px]"
                    style={{ backgroundColor: item.done ? item.lineColor : "#E2E8F0" }}
                  />
                )}
              </View>

              {/* Right: label + value */}
              <View className="flex-1 flex-row justify-between pb-5 items-start">
                <Text className={`text-sm font-semibold ${item.done ? "text-slate-900" : "text-slate-400"}`}>
                  {item.label}
                </Text>
                <Text className={`text-[13px] ${item.done ? "text-slate-600" : "text-slate-300"}`}>
                  {item.value}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Checkout / Check-in Button ── */}
        <TouchableOpacity
          className={`rounded-2xl py-4 items-center mb-3.5 ${
            onDuty
              ? "bg-red-50 border-[1.5px] border-red-200"
              : "bg-blue-700"
          } ${syncing ? "opacity-60" : ""}`}
          onPress={onToggleDuty}
          disabled={syncing}
          activeOpacity={0.85}
        >
          {syncing ? (
            <ActivityIndicator color={onDuty ? "#EF4444" : "#fff"} />
          ) : (
            <Text
              className="text-base font-bold"
              style={{ color: onDuty ? "#EF4444" : "#fff" }}
            >
              {onDuty ? "Checkout Duty" : "Check In for Duty"}
            </Text>
          )}
        </TouchableOpacity>

        {/* ── Officer Info ── */}
        <View className="bg-white rounded-2xl p-[18px] mb-3.5">
          <Text className="text-base font-bold text-slate-900 mb-4">Officer Information</Text>
          {[
            { icon: "person-outline",           label: officerName || "–" },
            { icon: "mail-outline",             label: officerEmail || "–" },
            { icon: "id-card-outline",          label: professionalId || "–" },
            { icon: "shield-checkmark-outline", label: dutyUnit || "–" },
          ].map(({ icon, label }) => (
            <View key={icon} className="flex-row items-center gap-3 py-2 border-b border-slate-100">
              <Ionicons name={icon} size={17} color="#64748B" />
              <Text className="text-[13px] text-slate-700 flex-1">{label}</Text>
            </View>
          ))}
        </View>

        {/* ── Logout ── */}
        <TouchableOpacity
          className="flex-row items-center justify-center gap-2 py-3.5 rounded-2xl bg-red-50 border border-red-200 mb-2"
          onPress={onLogout}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={18} color="#EF4444" />
          <Text className="text-red-500 font-bold text-sm">Logout</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}
