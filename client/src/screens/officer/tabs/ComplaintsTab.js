import React, { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const FILTERS = ["All", "New", "In Progress", "Resolved"];

const STATUS_META = {
  New:          { color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", cardBg: "#FFF5F5" },
  "In Progress":{ color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", cardBg: "#FFFDF0" },
  Resolved:     { color: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0", cardBg: "#F6FFF8" },
};

const normalizeStatus = (s) => {
  const v = String(s || "").trim();
  if (["Item Found", "Closed", "Resolved", "Recovered", "Secured"].includes(v)) return "Resolved";
  if (["Submitted", "Reported", "Staff Notified", "Seen"].includes(v)) return "New";
  return "In Progress";
};

const timeAgo = (d) => {
  if (!d) return "";
  const sec = Math.floor((Date.now() - new Date(d)) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ago`;
};

export default function ComplaintsTab({ complaints, loading, onViewComplaint, onRefresh, refreshing }) {
  const [filter, setFilter] = useState("All");

  const counts = { All: complaints.length };
  complaints.forEach((c) => {
    const ns = normalizeStatus(c.status);
    counts[ns] = (counts[ns] || 0) + 1;
  });

  const filtered = filter === "All"
    ? complaints
    : complaints.filter((c) => normalizeStatus(c.status) === filter);

  return (
    <View className="flex-1 bg-slate-100">
      {/* ── Filter Tabs ── */}
      <View className="bg-white border-b border-slate-200">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ flexDirection: "row", paddingHorizontal: 16, paddingTop: 12, gap: 4 }}
        >
          {FILTERS.map((f) => {
            const active = filter === f;
            return (
              <TouchableOpacity
                key={f}
                className="px-3.5 pb-3 items-center relative"
                onPress={() => setFilter(f)}
                activeOpacity={0.7}
              >
                <Text className={`text-sm font-semibold ${active ? "text-blue-700" : "text-slate-400"}`}>
                  {f} ({counts[f] ?? 0})
                </Text>
                {active && (
                  <View className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-700 rounded-sm" />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── List ── */}
      <ScrollView
        className="flex-1 pt-3 px-3.5"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing || false} onRefresh={onRefresh} />
        }
      >
        {loading && filtered.length === 0 && (
          <ActivityIndicator color="#1D4ED8" style={{ marginTop: 40 }} size="large" />
        )}

        {!loading && filtered.length === 0 && (
          <View className="items-center mt-16 gap-3">
            <Ionicons name="document-text-outline" size={48} color="#CBD5E1" />
            <Text className="text-slate-400 text-[15px]">No {filter === "All" ? "" : filter + " "}complaints</Text>
          </View>
        )}

        {filtered.map((c) => {
          const ns = normalizeStatus(c.status);
          const meta = STATUS_META[ns];
          const trainLabel = [c.vehicleNumber, c.trainName].filter(Boolean).join(" – ") || "–";
          const fromTo = (c.fromLocation && c.toLocation)
            ? `${c.fromLocation} → ${c.toLocation}`
            : c.route || null;
          const coachSeat = [
            c.coach && c.coach !== "–" ? `Coach: ${c.coach}` : null,
            c.seat && c.seat !== "–" ? `Seat: ${c.seat}` : null,
          ].filter(Boolean).join(", ");

          return (
            <TouchableOpacity
              key={c.id}
              style={{ backgroundColor: meta.cardBg, borderLeftColor: meta.color }}
              className="rounded-2xl border-l-4 p-3.5 mb-2.5"
              onPress={() => onViewComplaint(c)}
              activeOpacity={0.85}
            >
              {/* Top row: badge + time */}
              <View className="flex-row justify-between items-center mb-2">
                <View
                  style={{ backgroundColor: meta.bg, borderColor: meta.border }}
                  className="px-2.5 py-0.5 rounded-lg border"
                >
                  <Text style={{ color: meta.color }} className="text-[11px] font-extrabold">
                    {ns.toUpperCase()}
                  </Text>
                </View>
                <Text className="text-xs text-slate-400">{timeAgo(c.createdAt)}</Text>
              </View>

              {/* ID */}
              <Text className="text-[15px] font-extrabold text-slate-900 mb-1">
                ID: {c.id?.slice(-10)?.toUpperCase() || "–"}
              </Text>

              {/* Train */}
              <Text className="text-[13px] text-slate-700 mb-0.5">Train: {trainLabel}</Text>

              {/* From → To */}
              {!!fromTo && (
                <Text className="text-[13px] text-slate-700 mb-0.5">From: {fromTo}</Text>
              )}

              {/* Item */}
              <Text className="text-[13px] text-slate-700 mb-0.5">
                Item:  {c.itemType}{c.description ? ` – ${c.description}` : ""}
              </Text>

              {/* Passenger */}
              <Text className="text-[13px] text-slate-700 mb-0.5">Passenger: {c.passengerName}</Text>

              {/* Coach / Seat */}
              {!!coachSeat && (
                <View className="flex-row items-center gap-1 mt-1.5">
                  <Ionicons name="location-outline" size={13} color="#94A3B8" />
                  <Text className="text-xs text-slate-400">{coachSeat}</Text>
                </View>
              )}

              {/* Chevron */}
              <View className="absolute right-3.5 top-1/2">
                <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
              </View>
            </TouchableOpacity>
          );
        })}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}
