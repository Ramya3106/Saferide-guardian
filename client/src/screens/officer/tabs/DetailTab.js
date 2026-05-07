import React, { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const STATUS_META = {
  New:          { color: "#DC2626", bg: "#FEE2E2" },
  "In Progress":{ color: "#D97706", bg: "#FEF3C7" },
  Resolved:     { color: "#16A34A", bg: "#DCFCE7" },
};

const normalizeStatus = (s) => {
  const v = String(s || "").trim();
  if (["Item Found","Closed","Resolved","Recovered","Secured"].includes(v)) return "Resolved";
  if (["Submitted","Reported","Staff Notified","Seen"].includes(v)) return "New";
  return "In Progress";
};

const fmtDate = (d) => {
  if (!d) return "–";
  return new Date(d).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

const STATUSES = ["Passenger Contacted", "Item Being Checked", "Ready for Handover", "Item Found", "Closed"];
const QUICK_REPLIES = ["Item Found", "Item Not Found", "Will Update Shortly", "Collect at Next Station"];

/* ─────────────────────────────────────────────
   Respond to Passenger — full screen view
───────────────────────────────────────────── */
function RespondPage({ complaint, sending, onBack, onSend }) {
  const [text, setText] = useState("");
  const trainLabel = [complaint.vehicleNumber, complaint.trainName].filter(Boolean).join(" – ") || "–";

  const handleSend = () => {
    if (!text.trim()) { Alert.alert("Empty", "Please type a reply."); return; }
    onSend(text.trim());
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
    >
      <View style={r.root}>
        {/* Header */}
        <View style={r.header}>
          <TouchableOpacity onPress={onBack} style={r.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={r.headerTitle}>Respond to Passenger</Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView style={r.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Complaint Summary Card */}
          <View style={r.summaryCard}>
            <View style={r.summaryIcon}>
              {complaint.imageUrl
                ? <Image source={{ uri: complaint.imageUrl }} style={r.summaryImg} resizeMode="cover" />
                : <Ionicons name="bag-handle-outline" size={28} color="#64748B" />
              }
            </View>
            <View style={r.summaryInfo}>
              <Text style={r.summaryId}>ID: {complaint.id?.slice(-10)?.toUpperCase() || "–"}</Text>
              <Text style={r.summaryItem}>{complaint.itemType}</Text>
              <Text style={r.summaryTrain}>{trainLabel}</Text>
            </View>
          </View>

          {/* Reply to Passenger */}
          <Text style={r.sectionTitle}>Reply to Passenger</Text>
          <View style={r.inputCard}>
            <TextInput
              style={r.input}
              value={text}
              onChangeText={setText}
              placeholder={`Dear ${complaint.passengerName?.split(" ")[0] || "Passenger"},\n\nType your reply here...`}
              placeholderTextColor="#CBD5E1"
              multiline
              numberOfLines={7}
              textAlignVertical="top"
            />
          </View>

          {/* Quick Replies */}
          <Text style={r.sectionTitle}>Quick Replies</Text>
          <View style={r.quickGrid}>
            {QUICK_REPLIES.map((q) => (
              <TouchableOpacity key={q} style={r.quickBtn} onPress={() => setText(q)} activeOpacity={0.75}>
                <Text style={r.quickText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Send Button */}
        <View style={r.footer}>
          <TouchableOpacity
            style={[r.sendBtn, (!text.trim() || sending) && r.sendDisabled]}
            onPress={handleSend}
            disabled={!text.trim() || sending}
            activeOpacity={0.85}
          >
            {sending
              ? <ActivityIndicator color="#fff" />
              : (
                <View style={r.sendRow}>
                  <Ionicons name="send" size={17} color="#fff" />
                  <Text style={r.sendText}>Send Reply</Text>
                </View>
              )
            }
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

/* ─────────────────────────────────────────────
   Complaint Detail — main detail view
───────────────────────────────────────────── */
export default function DetailTab({ complaint, sending, detailLoading, onBack, onReply, onUpdateStatus }) {
  const [showRespond, setShowRespond] = useState(false);

  if (!complaint) {
    return (
      <View style={s.emptyWrap}>
        <Ionicons name="document-text-outline" size={52} color="#CBD5E1" />
        <Text style={s.emptyText}>Select a complaint to view details</Text>
      </View>
    );
  }

  // Show the Respond to Passenger full page
  if (showRespond) {
    return (
      <RespondPage
        complaint={complaint}
        sending={sending}
        onBack={() => setShowRespond(false)}
        onSend={(msg) => {
          onReply(msg, complaint.status);
          setShowRespond(false);
        }}
      />
    );
  }

  const ns = normalizeStatus(complaint.status);
  const meta = STATUS_META[ns];
  const trainLabel = [complaint.vehicleNumber, complaint.trainName].filter(Boolean).join(" – ") || "–";
  const routeLabel = (complaint.fromLocation && complaint.toLocation)
    ? `${complaint.fromLocation} → ${complaint.toLocation}`
    : complaint.route || "–";

  const handleMarkSecured = () =>
    Alert.alert(
      "Mark as Secured",
      "Confirm this item has been secured/found?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Confirm", onPress: () => onUpdateStatus("Item Found") },
      ]
    );

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Complaint Details</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Loading banner */}
      {detailLoading && (
        <View style={s.loadingBanner}>
          <ActivityIndicator size="small" color="#1D4ED8" />
          <Text style={s.loadingBannerText}>Fetching latest details...</Text>
        </View>
      )}

      <ScrollView style={s.body} showsVerticalScrollIndicator={false}>
        {/* Status + ID */}
        <View style={s.card}>
          <View style={s.idRow}>
            <View style={[s.badge, { backgroundColor: meta.bg }]}>
              <Text style={[s.badgeText, { color: meta.color }]}>{ns.toUpperCase()}</Text>
            </View>
            <Text style={s.idText}>ID: {complaint.id?.slice(-10)?.toUpperCase() || "–"}</Text>
          </View>
          <Text style={s.reportedText}>Reported:  {fmtDate(complaint.createdAt)}</Text>
        </View>

        {/* Complaint Info */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Complaint Information</Text>
          {[
            ["train-outline",      "Train Name",       trainLabel],
            ["git-compare-outline","From → To",        routeLabel],
            ["grid-outline",       "Coach / Seat",     `${complaint.coach || "–"} / ${complaint.seat || "–"}`],
            ["bag-handle-outline", "Item Description", complaint.itemType + (complaint.description ? ` – ${complaint.description}` : "")],
            ["person-outline",     "Passenger Name",   complaint.passengerName],
            ["call-outline",       "Phone Number",     complaint.passengerPhone || "–"],
          ].map(([icon, label, value]) => (
            <View key={label} style={s.infoRow}>
              <View style={s.infoLeft}>
                <Ionicons name={icon} size={15} color="#64748B" />
                <Text style={s.infoLabel}>{label}</Text>
              </View>
              <Text style={s.infoVal} numberOfLines={2}>{value}</Text>
            </View>
          ))}
        </View>

        {/* Additional Info */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Additional Info</Text>
          {[
            ["location-outline", "Reported At", complaint.reportedAt || "–"],
            ["apps-outline",     "Platform",    String(complaint.platform || "–")],
          ].map(([icon, label, value]) => (
            <View key={label} style={s.infoRow}>
              <View style={s.infoLeft}>
                <Ionicons name={icon} size={15} color="#64748B" />
                <Text style={s.infoLabel}>{label}</Text>
              </View>
              <Text style={s.infoVal}>{value}</Text>
            </View>
          ))}
          <View style={s.infoRow}>
            <View style={s.infoLeft}>
              <Ionicons name="camera-outline" size={15} color="#64748B" />
              <Text style={s.infoLabel}>Image</Text>
            </View>
            {complaint.imageUrl
              ? <Image source={{ uri: complaint.imageUrl }} style={s.itemImg} resizeMode="cover" />
              : <View style={s.noImg}><Ionicons name="image-outline" size={20} color="#CBD5E1" /></View>
            }
          </View>
        </View>

        {/* Status Update */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Update Status</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
            {STATUSES.map((st) => (
              <TouchableOpacity key={st} style={s.statusChip} onPress={() => onUpdateStatus(st)} disabled={sending}>
                <Text style={s.statusChipText}>{st}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Actions */}
      <View style={s.actions}>
        <TouchableOpacity style={[s.actionBtn, s.secureBtn, sending && s.btnDisabled]} onPress={handleMarkSecured} disabled={sending}>
          {sending
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.actionBtnText}>Mark as Secured</Text>
          }
        </TouchableOpacity>
        <TouchableOpacity style={[s.actionBtn, s.replyBtn]} onPress={() => setShowRespond(true)}>
          <Text style={s.actionBtnText}>Send Reply</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ── Respond Page Styles ── */
const r = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F8FAFC" },
  header: { backgroundColor: "#1D4ED8", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14 },
  backBtn: { padding: 4 },
  headerTitle: { color: "#fff", fontSize: 17, fontWeight: "700" },
  body: { flex: 1, padding: 16 },
  summaryCard: { backgroundColor: "#fff", borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 20, elevation: 2 },
  summaryIcon: { width: 56, height: 56, borderRadius: 12, backgroundColor: "#F1F5F9", justifyContent: "center", alignItems: "center", overflow: "hidden" },
  summaryImg: { width: 56, height: 56 },
  summaryInfo: { flex: 1 },
  summaryId: { fontSize: 14, fontWeight: "800", color: "#0F172A" },
  summaryItem: { fontSize: 13, color: "#475569", marginTop: 2 },
  summaryTrain: { fontSize: 12, color: "#94A3B8", marginTop: 2 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#0F172A", marginBottom: 10 },
  inputCard: { backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 20, elevation: 1 },
  input: { padding: 14, fontSize: 14, color: "#0F172A", minHeight: 160, textAlignVertical: "top" },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  quickBtn: { flex: 1, minWidth: "44%", backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 10, paddingVertical: 12, alignItems: "center", elevation: 1 },
  quickText: { fontSize: 13, color: "#334155", fontWeight: "600" },
  footer: { padding: 16, backgroundColor: "#fff", borderTopWidth: 1, borderColor: "#E2E8F0" },
  sendBtn: { backgroundColor: "#1D4ED8", borderRadius: 14, paddingVertical: 15, alignItems: "center" },
  sendDisabled: { backgroundColor: "#93C5FD" },
  sendRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  sendText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});

/* ── Detail Page Styles ── */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F1F5F9" },
  emptyWrap: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  emptyText: { color: "#94A3B8", fontSize: 15 },
  header: { backgroundColor: "#1D4ED8", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14 },
  backBtn: { padding: 4 },
  headerTitle: { color: "#fff", fontSize: 17, fontWeight: "700" },
  loadingBanner: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#EFF6FF", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderColor: "#BFDBFE" },
  loadingBannerText: { fontSize: 13, color: "#1D4ED8", fontWeight: "600" },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 14 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 12, elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  idRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: "800" },
  idText: { fontSize: 16, fontWeight: "800", color: "#0F172A" },
  reportedText: { fontSize: 13, color: "#64748B" },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#0F172A", marginBottom: 12 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 9, borderBottomWidth: 1, borderColor: "#F1F5F9" },
  infoLeft: { flexDirection: "row", alignItems: "center", gap: 9, flex: 1 },
  infoLabel: { fontSize: 13, color: "#64748B" },
  infoVal: { fontSize: 13, fontWeight: "600", color: "#0F172A", maxWidth: "52%", textAlign: "right" },
  itemImg: { width: 80, height: 80, borderRadius: 10 },
  noImg: { width: 80, height: 80, borderRadius: 10, backgroundColor: "#F1F5F9", justifyContent: "center", alignItems: "center" },
  statusChip: { backgroundColor: "#EFF6FF", borderWidth: 1, borderColor: "#BFDBFE", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  statusChipText: { color: "#1D4ED8", fontSize: 12, fontWeight: "600" },
  actions: { flexDirection: "row", padding: 14, gap: 12, backgroundColor: "#fff", borderTopWidth: 1, borderColor: "#E2E8F0" },
  actionBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  secureBtn: { backgroundColor: "#22C55E" },
  replyBtn: { backgroundColor: "#1D4ED8" },
  actionBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  btnDisabled: { opacity: 0.5 },
});
