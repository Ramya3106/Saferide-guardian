import React from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
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
const STATUS_BG    = { New: "#FEE2E2", "In Progress": "#FEF3C7", Resolved: "#DCFCE7" };

const STAT_CONFIG = [
  { key: "New",         label: "New\nComplaints", icon: "alert-circle",    iconColor: "#EF4444", iconBg: "#FEE2E2" },
  { key: "In Progress", label: "In Progress",     icon: "time",            iconColor: "#F59E0B", iconBg: "#FEF3C7" },
  { key: "Resolved",    label: "Resolved",        icon: "checkmark-circle", iconColor: "#22C55E", iconBg: "#DCFCE7" },
  { key: "Total",       label: "Total\nComplaints",icon: "list",            iconColor: "#3B82F6", iconBg: "#EFF6FF" },
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
      className="flex-1 bg-slate-100"
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing || false} onRefresh={onRefresh} />}
    >
      {/* ── On Duty Card ── */}
      <View
        className={`m-4 mb-2 rounded-2xl p-4 border ${
          onDuty ? "bg-green-50 border-green-200" : "bg-slate-50 border-slate-200"
        }`}
      >
        <View className="flex-row justify-between items-center">
          <View className="flex-row items-center gap-2">
            <View
              className="w-[11px] h-[11px] rounded-full"
              style={{ backgroundColor: onDuty ? "#22C55E" : "#94A3B8" }}
            />
            <Text className="text-[17px] font-extrabold text-slate-900">
              {onDuty ? "On Duty" : "Off Duty"}
            </Text>
          </View>
          <TouchableOpacity
            className="border-[1.5px] rounded-full px-4 py-[7px]"
            style={{ borderColor: onDuty ? "#EF4444" : "#1D4ED8" }}
            onPress={onToggleDuty}
            disabled={syncing}
          >
            {syncing
              ? <ActivityIndicator size="small" color={onDuty ? "#EF4444" : "#1D4ED8"} />
              : <Text
                  className="text-[13px] font-bold"
                  style={{ color: onDuty ? "#EF4444" : "#1D4ED8" }}
                >
                  {onDuty ? "Checkout Duty" : "Check In"}
                </Text>
            }
          </TouchableOpacity>
        </View>
        {onDuty && dutyAttendance && (
          <View className="mt-2.5 gap-0.5">
            <Text className="text-[13px] text-slate-500">Since {fmtTime(dutyAttendance.checkInTime)}</Text>
            <Text className="text-[13px] text-slate-500">Duty ID: {dutyId}</Text>
          </View>
        )}
        {!onDuty && (
          <Text className="text-[13px] text-slate-500 mt-2">Tap Check In to start your duty</Text>
        )}
      </View>

      {/* ── Today's Overview ── */}
      <View className="flex-row justify-between items-center px-4 mt-4 mb-2.5">
        <Text className="text-base font-bold text-slate-900">Today's Overview</Text>
        <TouchableOpacity onPress={onViewAll}>
          <Text className="text-[13px] text-blue-700 font-semibold">View All</Text>
        </TouchableOpacity>
      </View>
      <View className="flex-row px-3 gap-2">
        {STAT_CONFIG.map(({ key, label, icon, iconColor, iconBg }) => (
          <View key={key} className="flex-1 bg-white rounded-2xl p-2.5 items-center gap-1">
            <View
              className="w-[38px] h-[38px] rounded-[10px] justify-center items-center mb-0.5"
              style={{ backgroundColor: iconBg }}
            >
              <Ionicons name={icon} size={20} color={iconColor} />
            </View>
            <Text className="text-[22px] font-black" style={{ color: iconColor }}>
              {String(counts[key] ?? 0).padStart(2, "0")}
            </Text>
            <Text className="text-[10px] text-slate-500 text-center">{label}</Text>
          </View>
        ))}
      </View>

      {/* ── Priority Alerts ── */}
      <View className="flex-row justify-between items-center px-4 mt-4 mb-2.5">
        <Text className="text-base font-bold text-slate-900">Priority Alerts</Text>
        <TouchableOpacity onPress={onViewAll}>
          <Text className="text-[13px] text-blue-700 font-semibold">View All</Text>
        </TouchableOpacity>
      </View>

      {loading && !priorityAlert && (
        <ActivityIndicator color="#1D4ED8" style={{ marginVertical: 20 }} />
      )}
      {!loading && !priorityAlert && (
        <View className="mx-4 bg-green-50 rounded-2xl p-6 items-center gap-2">
          <Ionicons name="shield-checkmark-outline" size={32} color="#A7F3D0" />
          <Text className="text-green-700 text-sm font-semibold">No active alerts right now</Text>
        </View>
      )}
      {priorityAlert && (
        <View className="mx-4 bg-white rounded-2xl p-4 border-l-4 border-red-500">
          <View className="flex-row justify-between items-center mb-2.5">
            <View className="bg-red-100 px-2.5 py-1 rounded-lg">
              <Text className="text-red-500 text-[11px] font-extrabold">NEW COMPLAINT</Text>
            </View>
            <Text className="text-xs text-slate-400">{timeAgo(priorityAlert.createdAt)}</Text>
          </View>
          <Text className="text-[15px] font-extrabold text-slate-900 mb-1.5">
            ID: {priorityAlert.id?.slice(-10)?.toUpperCase() || "–"}
          </Text>
          <Text className="text-[13px] text-slate-700 mb-0.5">
            Train: {[priorityAlert.vehicleNumber, priorityAlert.trainName].filter(Boolean).join(" – ") || "–"}
          </Text>
          <Text className="text-[13px] text-slate-700 mb-0.5">
            From: {priorityAlert.fromLocation || "–"}{"  →  "}{priorityAlert.toLocation || "–"}
          </Text>
          <Text className="text-[13px] text-slate-700 mb-0.5">Item:  {priorityAlert.itemType}</Text>
          <Text className="text-[13px] text-slate-700 mb-0.5">
            Reported by: {priorityAlert.passengerName}
          </Text>
          <TouchableOpacity
            className="bg-slate-800 rounded-xl py-3.5 items-center mt-3.5"
            onPress={() => onViewComplaint(priorityAlert)}
          >
            <Text className="text-white font-bold text-sm">View &amp; Respond</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Recent Complaints ── */}
      <View className="flex-row justify-between items-center px-4 mt-4 mb-2.5">
        <Text className="text-base font-bold text-slate-900">Recent Complaints</Text>
        <TouchableOpacity onPress={onViewAll}>
          <Text className="text-[13px] text-blue-700 font-semibold">View All</Text>
        </TouchableOpacity>
      </View>

      {recent.length === 0 && !loading && (
        <Text className="text-center text-slate-400 mt-2.5 text-[13px]">No recent complaints</Text>
      )}
      {recent.map(c => {
        const ns = normalizeStatus(c.status);
        return (
          <TouchableOpacity
            key={c.id}
            className="mx-4 mb-2 bg-white rounded-2xl p-3.5 flex-row justify-between items-center"
            onPress={() => onViewComplaint(c)}
            activeOpacity={0.8}
          >
            <View className="flex-row items-center flex-1">
              <View className="w-10 h-10 rounded-[10px] bg-slate-100 justify-center items-center mr-3">
                <Ionicons name="bag-handle-outline" size={20} color="#64748B" />
              </View>
              <View className="flex-1">
                <Text className="text-[13px] font-bold text-slate-900">
                  {c.id?.slice(-10)?.toUpperCase() || "–"}
                </Text>
                <Text className="text-xs text-slate-500 mt-0.5">{c.itemType}</Text>
              </View>
            </View>
            <View className="items-end gap-1">
              <View
                className="px-2 py-0.5 rounded-lg"
                style={{ backgroundColor: STATUS_BG[ns] }}
              >
                <Text
                  className="text-[10px] font-extrabold"
                  style={{ color: STATUS_COLOR[ns] }}
                >
                  {ns.toUpperCase()}
                </Text>
              </View>
              <Text className="text-[11px] text-slate-400">{fmtTime(c.createdAt)}</Text>
            </View>
          </TouchableOpacity>
        );
      })}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}
