import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const FILTERS = ["All", "New", "In Progress", "Resolved"];
const STATUS_COLOR = { New: "#EF4444", "In Progress": "#F59E0B", Resolved: "#22C55E" };
const STATUS_BG = { New: "#FEE2E2", "In Progress": "#FEF3C7", Resolved: "#DCFCE7" };

const normalizeStatus = (s) => {
  const v = String(s || "").trim();
  if (["Item Found", "Closed", "Resolved", "Recovered"].includes(v)) return "Resolved";
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

export default function ComplaintsTab({ complaints, loading, onViewComplaint }) {
  const [filter, setFilter] = useState("All");
  const counts = { All: complaints.length, New: 0, "In Progress": 0, Resolved: 0 };
  complaints.forEach(c => { counts[normalizeStatus(c.status)] = (counts[normalizeStatus(c.status)] || 0) + 1; });
  const filtered = filter === "All" ? complaints : complaints.filter(c => normalizeStatus(c.status) === filter);

  return (
    <View style={s.container}>
      {/* Filter Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar} contentContainerStyle={s.filterContent}>
        {FILTERS.map(f => (
          <TouchableOpacity key={f} style={[s.filterTab, filter === f && s.filterTabActive]} onPress={() => setFilter(f)}>
            <Text style={[s.filterText, filter === f && s.filterTextActive]}>{f} ({counts[f] || 0})</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {/* List */}
      <ScrollView showsVerticalScrollIndicator={false} style={s.list}>
        {loading && <ActivityIndicator color="#1D4ED8" style={{ marginTop: 30 }} />}
        {!loading && filtered.length === 0 && <Text style={s.empty}>No complaints found</Text>}
        {filtered.map(c => {
          const ns = normalizeStatus(c.status);
          return (
            <TouchableOpacity key={c.id} style={s.card} onPress={() => onViewComplaint(c)}>
              <View style={s.cardTop}>
                <View style={[s.badge, { backgroundColor: STATUS_BG[ns] }]}>
                  <Text style={[s.badgeText, { color: STATUS_COLOR[ns] }]}>{ns.toUpperCase()}</Text>
                </View>
                <Text style={s.ago}>{timeAgo(c.createdAt)}</Text>
              </View>
              <Text style={s.cId}>ID: {c.id?.slice(-10)?.toUpperCase() || "–"}</Text>
              <Text style={s.cLine}>Train: {c.vehicleNumber || "–"}</Text>
              <Text style={s.cLine}>Item: {c.itemType}</Text>
              <Text style={s.cLine}>Passenger: {c.passengerName}</Text>
              {c.coach && c.coach !== "--" && (
                <View style={s.locationRow}>
                  <Ionicons name="location-outline" size={13} color="#94A3B8" />
                  <Text style={s.locationText}>Coach {c.coach}{c.seat && c.seat !== "--" ? `, Seat ${c.seat}` : ""}</Text>
                </View>
              )}
              <View style={s.cardArrow}><Ionicons name="chevron-forward" size={16} color="#CBD5E1" /></View>
            </TouchableOpacity>
          );
        })}
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  filterBar: { maxHeight: 52, backgroundColor: "#fff", borderBottomWidth: 1, borderColor: "#E2E8F0" },
  filterContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexDirection: "row" },
  filterTab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: "#F1F5F9" },
  filterTabActive: { backgroundColor: "#1D4ED8" },
  filterText: { fontSize: 13, fontWeight: "600", color: "#64748B" },
  filterTextActive: { color: "#fff" },
  list: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 10, elevation: 2 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: "800" },
  ago: { fontSize: 11, color: "#94A3B8" },
  cId: { fontSize: 14, fontWeight: "700", color: "#0F172A", marginBottom: 4 },
  cLine: { fontSize: 13, color: "#475569", marginBottom: 2 },
  locationRow: { flexDirection: "row", alignItems: "center", marginTop: 6, gap: 4 },
  locationText: { fontSize: 12, color: "#94A3B8" },
  cardArrow: { position: "absolute", right: 14, top: "50%" },
  empty: { textAlign: "center", color: "#94A3B8", marginTop: 40, fontSize: 14 },
});
