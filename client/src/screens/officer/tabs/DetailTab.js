import React, { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Alert, Image, Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const STATUS_COLOR = { New: "#EF4444", "In Progress": "#F59E0B", Resolved: "#22C55E" };
const STATUS_BG   = { New: "#FEE2E2", "In Progress": "#FEF3C7", Resolved: "#DCFCE7" };

const normalizeStatus = (s) => {
  const v = String(s || "").trim();
  if (["Item Found", "Closed", "Resolved", "Recovered", "Secured"].includes(v)) return "Resolved";
  if (["Submitted", "Reported", "Staff Notified", "Seen"].includes(v)) return "New";
  return "In Progress";
};

const fmtDate = (d) => {
  if (!d) return "–";
  const dt = new Date(d);
  return dt.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

export default function DetailTab({ complaint, sending, detailLoading, onBack, onReply, onUpdateStatus }) {
  const [replyText, setReplyText] = useState("");
  const [showReplyModal, setShowReplyModal] = useState(false);

  if (!complaint) {
    return (
      <View style={s.emptyWrap}>
        <Ionicons name="document-text-outline" size={52} color="#CBD5E1" />
        <Text style={s.emptyText}>Select a complaint to view details</Text>
      </View>
    );
  }

  const ns = normalizeStatus(complaint.status);
  const trainLabel = [complaint.vehicleNumber, complaint.trainName].filter(Boolean).join(" – ") || "–";
  const routeLabel = complaint.fromLocation && complaint.toLocation
    ? `${complaint.fromLocation} → ${complaint.toLocation}`
    : complaint.route || "–";

  const handleMarkSecured = () => {
    Alert.alert(
      "Mark as Secured",
      "Confirm that this item has been secured/found?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Confirm", style: "default", onPress: () => onUpdateStatus("Item Found") },
      ]
    );
  };

  const handleSendReply = () => {
    if (!replyText.trim()) {
      Alert.alert("Empty", "Please type a reply message.");
      return;
    }
    onReply(replyText.trim(), complaint.status);
    setReplyText("");
    setShowReplyModal(false);
  };

  return (
    <View style={s.root}>
      {/* Blue Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Complaint Details</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Loading Banner */}
      {detailLoading && (
        <View style={s.loadingBanner}>
          <ActivityIndicator size="small" color="#1D4ED8" />
          <Text style={s.loadingBannerText}>Fetching latest details...</Text>
        </View>
      )}
      <ScrollView style={s.body} showsVerticalScrollIndicator={false}>
        {/* Status + ID Card */}
        <View style={s.card}>
          <View style={s.idRow}>
            <View style={[s.badge, { backgroundColor: STATUS_BG[ns] }]}>
              <Text style={[s.badgeText, { color: STATUS_COLOR[ns] }]}>{ns.toUpperCase()}</Text>
            </View>
            <Text style={s.idText}>ID: {complaint.id?.slice(-10)?.toUpperCase() || "–"}</Text>
          </View>
          <Text style={s.reportedText}>Reported:  {fmtDate(complaint.createdAt)}</Text>
        </View>

        {/* Complaint Information */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Complaint Information</Text>
          {[
            { icon: "train-outline",     label: "Train Name",        value: trainLabel },
            { icon: "git-compare-outline", label: "From → To",       value: routeLabel },
            { icon: "grid-outline",      label: "Coach / Seat",      value: `${complaint.coach} / ${complaint.seat}` },
            { icon: "bag-handle-outline",label: "Item Description",  value: complaint.itemType + (complaint.description ? ` – ${complaint.description}` : "") },
            { icon: "person-outline",    label: "Passenger Name",    value: complaint.passengerName },
            { icon: "call-outline",      label: "Phone Number",      value: complaint.passengerPhone || "–" },
          ].map(({ icon, label, value }) => (
            <View key={label} style={s.infoRow}>
              <View style={s.infoLeft}>
                <Ionicons name={icon} size={16} color="#64748B" />
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
            { icon: "location-outline", label: "Reported At", value: complaint.reportedAt || "–" },
            { icon: "apps-outline",     label: "Platform",    value: String(complaint.platform || "–") },
          ].map(({ icon, label, value }) => (
            <View key={label} style={s.infoRow}>
              <View style={s.infoLeft}>
                <Ionicons name={icon} size={16} color="#64748B" />
                <Text style={s.infoLabel}>{label}</Text>
              </View>
              <Text style={s.infoVal}>{value}</Text>
            </View>
          ))}

          {/* Image */}
          <View style={s.infoRow}>
            <View style={s.infoLeft}>
              <Ionicons name="camera-outline" size={16} color="#64748B" />
              <Text style={s.infoLabel}>Image</Text>
            </View>
            {complaint.imageUrl ? (
              <Image source={{ uri: complaint.imageUrl }} style={s.itemImage} resizeMode="cover" />
            ) : (
              <View style={s.noImage}>
                <Ionicons name="image-outline" size={22} color="#CBD5E1" />
                <Text style={s.noImageText}>No image</Text>
              </View>
            )}
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Actions */}
      <View style={s.actions}>
        <TouchableOpacity
          style={[s.actionBtn, s.secureBtn, sending && s.btnDisabled]}
          onPress={handleMarkSecured}
          disabled={sending}
        >
          {sending ? <ActivityIndicator color="#fff" size="small" /> : (
            <Text style={s.actionBtnText}>Mark as Secured</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.actionBtn, s.replyBtn]}
          onPress={() => setShowReplyModal(true)}
        >
          <Text style={s.actionBtnText}>Send Reply</Text>
        </TouchableOpacity>
      </View>

      {/* Reply Modal */}
      <Modal visible={showReplyModal} transparent animationType="slide" onRequestClose={() => setShowReplyModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Reply to Passenger</Text>
              <TouchableOpacity onPress={() => setShowReplyModal(false)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>
            <Text style={s.modalSub}>ID: {complaint.id?.slice(-10)?.toUpperCase()}  •  {complaint.itemType}</Text>

            {/* Quick Replies */}
            <Text style={s.quickLabel}>Quick Replies</Text>
            <View style={s.quickGrid}>
              {["Item Found", "Item Not Found", "Will Update Shortly", "Collect at Next Station"].map(q => (
                <TouchableOpacity key={q} style={s.quickBtn} onPress={() => setReplyText(q)}>
                  <Text style={s.quickText}>{q}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={s.replyInput}
              value={replyText}
              onChangeText={setReplyText}
              placeholder="Type your message to the passenger..."
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[s.sendBtn, (!replyText.trim() || sending) && s.btnDisabled]}
              onPress={handleSendReply}
              disabled={!replyText.trim() || sending}
            >
              {sending ? <ActivityIndicator color="#fff" size="small" /> : (
                <View style={s.sendRow}>
                  <Ionicons name="send" size={16} color="#fff" />
                  <Text style={s.sendBtnText}>Send Reply</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F8FAFC" },
  emptyWrap: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  emptyText: { color: "#94A3B8", fontSize: 15 },
  loadingBanner: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#EFF6FF", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderColor: "#BFDBFE" },
  loadingBannerText: { fontSize: 13, color: "#1D4ED8", fontWeight: "600" },

  header: { backgroundColor: "#1D4ED8", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14 },
  backBtn: { padding: 4 },
  headerTitle: { color: "#fff", fontSize: 17, fontWeight: "700" },

  body: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 14, elevation: 2, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },

  idRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: "800" },
  idText: { fontSize: 16, fontWeight: "800", color: "#0F172A" },
  reportedText: { fontSize: 13, color: "#64748B" },

  cardTitle: { fontSize: 15, fontWeight: "700", color: "#0F172A", marginBottom: 12 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 9, borderBottomWidth: 1, borderColor: "#F1F5F9" },
  infoLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  infoLabel: { fontSize: 13, color: "#64748B" },
  infoVal: { fontSize: 13, fontWeight: "600", color: "#0F172A", maxWidth: "52%", textAlign: "right" },

  itemImage: { width: 80, height: 80, borderRadius: 10 },
  noImage: { width: 80, height: 80, borderRadius: 10, backgroundColor: "#F1F5F9", justifyContent: "center", alignItems: "center" },
  noImageText: { fontSize: 10, color: "#CBD5E1", marginTop: 4 },

  actions: { flexDirection: "row", padding: 16, gap: 12, backgroundColor: "#fff", borderTopWidth: 1, borderColor: "#E2E8F0" },
  actionBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  secureBtn: { backgroundColor: "#22C55E" },
  replyBtn: { backgroundColor: "#1D4ED8" },
  actionBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  btnDisabled: { opacity: 0.5 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  modalTitle: { fontSize: 16, fontWeight: "700", color: "#0F172A" },
  modalSub: { fontSize: 12, color: "#64748B", marginBottom: 14 },
  quickLabel: { fontSize: 12, fontWeight: "600", color: "#64748B", marginBottom: 8 },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  quickBtn: { backgroundColor: "#F1F5F9", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  quickText: { fontSize: 12, color: "#475569", fontWeight: "600" },
  replyInput: { backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, padding: 12, fontSize: 13, color: "#0F172A", minHeight: 100, marginBottom: 14 },
  sendBtn: { backgroundColor: "#1D4ED8", borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  sendRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sendBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
