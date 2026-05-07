import React, { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
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
    <View style={s.root}>
      {/* ── Filter Tabs ── */}
      <View style={s.filterBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filterContent}
        >
          {FILTERS.map((f) => {
            const active = filter === f;
            return (
              <TouchableOpacity
                key={f}
                style={[s.filterTab, active && s.filterTabActive]}
                onPress={() => setFilter(f)}
                activeOpacity={0.7}
              >
                <Text style={[s.filterText, active && s.filterTextActive]}>
                  {f} ({counts[f] ?? 0})
                </Text>
                {active && <View style={s.filterUnderline} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── List ── */}
      <ScrollView
        style={s.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing || false} onRefresh={onRefresh} />
        }
      >
        {loading && filtered.length === 0 && (
          <ActivityIndicator color="#1D4ED8" style={{ marginTop: 40 }} size="large" />
        )}

        {!loading && filtered.length === 0 && (
          <View style={s.emptyWrap}>
            <Ionicons name="document-text-outline" size={48} color="#CBD5E1" />
            <Text style={s.emptyText}>No {filter === "All" ? "" : filter + " "}complaints</Text>
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
              style={[s.card, { backgroundColor: meta.cardBg, borderLeftColor: meta.color }]}
              onPress={() => onViewComplaint(c)}
              activeOpacity={0.85}
            >
              {/* Top row: badge + time */}
              <View style={s.cardTop}>
                <View style={[s.badge, { backgroundColor: meta.bg, borderColor: meta.border }]}>
                  <Text style={[s.badgeText, { color: meta.color }]}>{ns.toUpperCase()}</Text>
                </View>
                <Text style={s.timeAgo}>{timeAgo(c.createdAt)}</Text>
              </View>

              {/* ID */}
              <Text style={s.cardId}>ID: {c.id?.slice(-10)?.toUpperCase() || "–"}</Text>

              {/* Train */}
              <Text style={s.cardLine}>Train: {trainLabel}</Text>

              {/* From → To (if available) */}
              {!!fromTo && (
                <Text style={s.cardLine}>From: {fromTo}</Text>
              )}

              {/* Item */}
              <Text style={s.cardLine}>Item:  {c.itemType}{c.description ? ` – ${c.description}` : ""}</Text>

              {/* Passenger */}
              <Text style={s.cardLine}>Passenger: {c.passengerName}</Text>

              {/* Coach / Seat with pin icon */}
              {!!coachSeat && (
                <View style={s.locationRow}>
                  <Ionicons name="location-outline" size={13} color="#94A3B8" />
                  <Text style={s.locationText}>{coachSeat}</Text>
                </View>
              )}

              {/* Chevron */}
              <View style={s.chevron}>
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

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F1F5F9" },

  // Filter bar
  filterBar: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderColor: "#E2E8F0",
  },
  filterContent: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 4,
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    alignItems: "center",
    position: "relative",
  },
  filterTabActive: {},
  filterText: { fontSize: 14, fontWeight: "600", color: "#94A3B8" },
  filterTextActive: { color: "#1D4ED8" },
  filterUnderline: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "#1D4ED8",
    borderRadius: 2,
  },

  // List
  list: { flex: 1, paddingTop: 12, paddingHorizontal: 14 },

  // Card
  card: {
    borderRadius: 14,
    borderLeftWidth: 4,
    padding: 14,
    marginBottom: 10,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeText: { fontSize: 11, fontWeight: "800" },
  timeAgo: { fontSize: 12, color: "#94A3B8" },
  cardId: { fontSize: 15, fontWeight: "800", color: "#0F172A", marginBottom: 5 },
  cardLine: { fontSize: 13, color: "#334155", marginBottom: 3 },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  locationText: { fontSize: 12, color: "#94A3B8" },
  chevron: {
    position: "absolute",
    right: 14,
    top: "50%",
  },

  // Empty
  emptyWrap: { alignItems: "center", marginTop: 60, gap: 12 },
  emptyText: { color: "#94A3B8", fontSize: 15 },
});
