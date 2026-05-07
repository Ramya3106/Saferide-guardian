import React, { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform,
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
  if (!d) return "-";
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
  const trainLabel = [complaint.vehicleNumber, complaint.trainName].filter(Boolean).join(" - ") || "-";

  const handleSend = () => {
    if (!text.trim()) { Alert.alert("Empty", "Please type a reply."); return; }
    onSend(text.trim());
  };

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
    >
      <View className="flex-1 bg-slate-50">
        {/* Header */}
        <View className="bg-blue-700 flex-row items-center justify-between px-4 py-3.5">
          <TouchableOpacity onPress={onBack} className="p-1">
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text className="text-white text-[17px] font-bold">Respond to Passenger</Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Complaint Summary Card */}
          <View className="bg-white rounded-2xl p-3.5 flex-row items-center gap-3.5 mb-5">
            <View className="w-14 h-14 rounded-xl bg-slate-100 justify-center items-center overflow-hidden">
              {complaint.imageUrl
                ? <Image source={{ uri: complaint.imageUrl }} className="w-14 h-14" resizeMode="cover" />
                : <Ionicons name="bag-handle-outline" size={28} color="#64748B" />
              }
            </View>
            <View className="flex-1">
              <Text className="text-sm font-extrabold text-slate-900">
                ID: {complaint.id?.slice(-10)?.toUpperCase() || "-"}
              </Text>
              <Text className="text-[13px] text-slate-600 mt-0.5">{complaint.itemType}</Text>
              <Text className="text-xs text-slate-400 mt-0.5">{trainLabel}</Text>
            </View>
          </View>

          {/* Reply to Passenger */}
          <Text className="text-[15px] font-bold text-slate-900 mb-2.5">Reply to Passenger</Text>
          <View className="bg-white rounded-2xl border border-slate-200 mb-5">
            <TextInput
              className="p-3.5 text-sm text-slate-900 min-h-[160px]"
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
          <Text className="text-[15px] font-bold text-slate-900 mb-2.5">Quick Replies</Text>
          <View className="flex-row flex-wrap gap-2.5 mb-4">
            {QUICK_REPLIES.map((q) => (
              <TouchableOpacity
                key={q}
                className="flex-1 min-w-[44%] bg-white border border-slate-200 rounded-[10px] py-3 items-center"
                onPress={() => setText(q)}
                activeOpacity={0.75}
              >
                <Text className="text-[13px] text-slate-700 font-semibold">{q}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Send Button */}
        <View className="p-4 bg-white border-t border-slate-200">
          <TouchableOpacity
            className={`rounded-2xl py-[15px] items-center ${(!text.trim() || sending) ? "bg-blue-300" : "bg-blue-700"}`}
            onPress={handleSend}
            disabled={!text.trim() || sending}
            activeOpacity={0.85}
          >
            {sending
              ? <ActivityIndicator color="#fff" />
              : (
                <View className="flex-row items-center gap-2.5">
                  <Ionicons name="send" size={17} color="#fff" />
                  <Text className="text-white font-bold text-[15px]">Send Reply</Text>
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
      <View className="flex-1 justify-center items-center gap-3">
        <Ionicons name="document-text-outline" size={52} color="#CBD5E1" />
        <Text className="text-slate-400 text-[15px]">Select a complaint to view details</Text>
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
  const trainLabel = [complaint.vehicleNumber, complaint.trainName].filter(Boolean).join(" - ") || "-";
  const routeLabel = (complaint.fromLocation && complaint.toLocation)
    ? `${complaint.fromLocation} -> ${complaint.toLocation}`
    : complaint.route || "-";

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
    <View className="flex-1 bg-slate-100">
      {/* Header */}
      <View className="bg-blue-700 flex-row items-center justify-between px-4 py-3.5">
        <TouchableOpacity onPress={onBack} className="p-1">
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text className="text-white text-[17px] font-bold">Complaint Details</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Loading banner */}
      {detailLoading && (
        <View className="flex-row items-center gap-2.5 bg-blue-50 px-4 py-2.5 border-b border-blue-200">
          <ActivityIndicator size="small" color="#1D4ED8" />
          <Text className="text-[13px] text-blue-700 font-semibold">Fetching latest details...</Text>
        </View>
      )}

      <ScrollView className="flex-1 px-4 pt-3.5" showsVerticalScrollIndicator={false}>
        {/* Status + ID */}
        <View className="bg-white rounded-2xl p-4 mb-3">
          <View className="flex-row items-center gap-2.5 mb-1.5">
            <View
              className="px-2.5 py-1 rounded-lg"
              style={{ backgroundColor: meta.bg }}
            >
              <Text className="text-[11px] font-extrabold" style={{ color: meta.color }}>
                {ns.toUpperCase()}
              </Text>
            </View>
            <Text className="text-base font-extrabold text-slate-900">
              ID: {complaint.id?.slice(-10)?.toUpperCase() || "-"}
            </Text>
          </View>
          <Text className="text-[13px] text-slate-500">Reported:  {fmtDate(complaint.createdAt)}</Text>
        </View>

        {/* Complaint Info */}
        <View className="bg-white rounded-2xl p-4 mb-3">
          <Text className="text-[15px] font-bold text-slate-900 mb-3">Complaint Information</Text>
          {[
            ["train-outline",       "Train Name",       trainLabel],
            ["git-compare-outline", "From -> To",        routeLabel],
            ["grid-outline",        "Coach / Seat",     `${complaint.coach || "-"} / ${complaint.seat || "-"}`],
            ["bag-handle-outline",  "Item Description", complaint.itemType + (complaint.description ? ` - ${complaint.description}` : "")],
            ["person-outline",      "Passenger Name",   complaint.passengerName],
            ["call-outline",        "Phone Number",     complaint.passengerPhone || "-"],
          ].map(([icon, label, value]) => (
            <View key={label} className="flex-row justify-between items-center py-[9px] border-b border-slate-100">
              <View className="flex-row items-center gap-[9px] flex-1">
                <Ionicons name={icon} size={15} color="#64748B" />
                <Text className="text-[13px] text-slate-500">{label}</Text>
              </View>
              <Text className="text-[13px] font-semibold text-slate-900 max-w-[52%] text-right" numberOfLines={2}>
                {value}
              </Text>
            </View>
          ))}
        </View>

        {/* Additional Info */}
        <View className="bg-white rounded-2xl p-4 mb-3">
          <Text className="text-[15px] font-bold text-slate-900 mb-3">Additional Info</Text>
          {[
            ["location-outline", "Reported At", complaint.reportedAt || "-"],
            ["apps-outline",     "Platform",    String(complaint.platform || "-")],
          ].map(([icon, label, value]) => (
            <View key={label} className="flex-row justify-between items-center py-[9px] border-b border-slate-100">
              <View className="flex-row items-center gap-[9px] flex-1">
                <Ionicons name={icon} size={15} color="#64748B" />
                <Text className="text-[13px] text-slate-500">{label}</Text>
              </View>
              <Text className="text-[13px] font-semibold text-slate-900 text-right">{value}</Text>
            </View>
          ))}
          <View className="flex-row justify-between items-center py-[9px] border-b border-slate-100">
            <View className="flex-row items-center gap-[9px] flex-1">
              <Ionicons name="camera-outline" size={15} color="#64748B" />
              <Text className="text-[13px] text-slate-500">Image</Text>
            </View>
            {complaint.imageUrl
              ? <Image source={{ uri: complaint.imageUrl }} className="w-20 h-20 rounded-[10px]" resizeMode="cover" />
              : <View className="w-20 h-20 rounded-[10px] bg-slate-100 justify-center items-center">
                  <Ionicons name="image-outline" size={20} color="#CBD5E1" />
                </View>
            }
          </View>
        </View>

        {/* Status Update */}
        <View className="bg-white rounded-2xl p-4 mb-3">
          <Text className="text-[15px] font-bold text-slate-900 mb-3">Update Status</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
            {STATUSES.map((st) => (
              <TouchableOpacity
                key={st}
                className="bg-blue-50 border border-blue-200 rounded-full px-3.5 py-2"
                onPress={() => onUpdateStatus(st)}
                disabled={sending}
              >
                <Text className="text-blue-700 text-xs font-semibold">{st}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Actions */}
      <View className="flex-row p-3.5 gap-3 bg-white border-t border-slate-200">
        <TouchableOpacity
          className={`flex-1 py-3.5 rounded-2xl items-center bg-green-500 ${sending ? "opacity-50" : ""}`}
          onPress={handleMarkSecured}
          disabled={sending}
        >
          {sending
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text className="text-white font-bold text-sm">Mark as Secured</Text>
          }
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 py-3.5 rounded-2xl items-center bg-blue-700"
          onPress={() => setShowRespond(true)}
        >
          <Text className="text-white font-bold text-sm">Send Reply</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
