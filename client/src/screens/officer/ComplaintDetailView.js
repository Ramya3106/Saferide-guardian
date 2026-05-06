import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Modal, Pressable, ScrollView, Text, TextInput, useColorScheme, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PriorityBadgeList, PriorityHeader, PrioritySummary } from "../../components/PriorityBadge";
import { updateComplaintAction } from "../../services/complaintService";

const DetailPill = ({ icon, label, value, theme }) => (
  <View className="flex-1 min-w-[48%] border rounded-2xl p-2.5 gap-1" style={{ backgroundColor: theme.chip, borderColor: theme.chipBorder }}>
    <View className="w-5 h-5 rounded-full justify-center items-center" style={{ backgroundColor: theme.accentSoft }}>
      <Ionicons name={icon} size={12} color={theme.accent} />
    </View>
    <Text className="text-[11px] font-bold uppercase tracking-wider" style={{ color: theme.subtext }}>{label}</Text>
    <Text className="text-[13px] font-bold leading-snug" style={{ color: theme.text }} numberOfLines={2}>
      {value}
    </Text>
  </View>
);

const DetailLine = ({ label, value, theme, emphasize = false }) => (
  <View className="flex-row justify-between gap-4">
    <Text className="font-bold" style={{ color: theme.subtext }}>{label}</Text>
    <Text className={`flex-1 text-right text-[13px] leading-snug ${emphasize ? 'font-extrabold' : 'font-semibold'}`} style={{ color: theme.text }}>
      {value}
    </Text>
  </View>
);

const ActionButton = ({ label, subtext, icon, color, onPress }) => (
  <Pressable className="flex-1 min-w-[31%] rounded-xl py-2.5 px-2.5 items-center justify-center gap-1" style={{ backgroundColor: color }} onPress={onPress}>
    <Ionicons name={icon} size={16} color="#FFFFFF" />
    <Text className="text-white font-extrabold text-xs">{label}</Text>
    <Text className="text-white/90 text-[10px] text-center">{subtext}</Text>
  </Pressable>
);

const ComplaintDetailView = ({ complaint, onOpenReply, onActionComplete }) => {
  const [showActionModal, setShowActionModal] = useState(false);
  const [selectedAction, setSelectedAction] = useState(null);
  const [actionNote, setActionNote] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const colorScheme = useColorScheme();
  const pulseAnim = useRef(new Animated.Value(0)).current;

  const theme = useMemo(() => {
    const isDark = colorScheme === "dark";
    return {
      isDark,
      screen: isDark ? "#07111F" : "#EAF1F7",
      card: isDark ? "#0D1726" : "#FFFFFF",
      elevated: isDark ? "#111C2D" : "#F8FBFF",
      border: isDark ? "#22314A" : "#D7E1EC",
      text: isDark ? "#EAF2FF" : "#0F172A",
      subtext: isDark ? "#9FB2CC" : "#52637A",
      chip: isDark ? "#162337" : "#EDF4FB",
      chipBorder: isDark ? "#29415F" : "#D8E4EF",
      accent: "#2563EB",
      accentSoft: isDark ? "#112A4A" : "#DBEAFE",
    };
  }, [colorScheme]);

  const isUrgent = ["High", "Critical"].includes(complaint?.priority) && complaint?.status !== "Closed";

  useEffect(() => {
    if (!isUrgent) {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(0);
      return undefined;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [isUrgent, pulseAnim]);

  const pulseOpacity = isUrgent
    ? pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.66, 1] })
    : 1;

  const trainName = complaint?.trainName || complaint?.vehicleNumber || "Duronto Express 12259";
  const coachLabel = complaint?.coach || "S4";
  const seatLabel = complaint?.seat || "21";
  const boardingStation = complaint?.boardingStation || "New Delhi (NDLS)";
  const destinationStation = complaint?.destinationStation || "Mumbai CSMT";
  const officerId = complaint?.assignedOfficerId || complaint?.acceptedBy || "OFF-TTR-204";
  const officerName = complaint?.assignedOfficerName || complaint?.staffName || "Officer Rahul Kumar";

  if (!complaint) {
    return (
      <View className="flex-1 p-3 justify-center" style={{ backgroundColor: theme.screen }}>
        <View className="rounded-[18px] border p-[18px] items-center gap-2" style={{ backgroundColor: theme.card, borderColor: theme.border }}>
          <Ionicons name="train" size={28} color={theme.accent} />
          <Text className="text-xl font-extrabold" style={{ color: theme.text }}>Complaint Detail View</Text>
          <Text style={{ color: theme.subtext }}>Select an alert to view complete details.</Text>
        </View>
      </View>
    );
  }

  const handleAction = async (action) => {
    setSelectedAction(action);
    if (["note", "reassign", "resolve", "close"].includes(action)) {
      setShowActionModal(true);
    } else {
      await performAction(action);
    }
  };

  const performAction = async (action, additionalData = {}) => {
    setIsLoading(true);
    try {
      const payload = getActionPayload(action, additionalData);
      const headers = {
        "X-User-Email": "officer@example.com",
        "X-User-Name": "Officer Name",
        "X-User-Role": "TTR/RPF/Police",
        "X-Duty-Unit": "TTR",
      };

      const actionPathMap = {
        accept: "/accept",
        investigate: "/start-investigation",
        note: "/note",
        escalateRpf: "/escalate-rpf",
        escalatePolice: "/escalate-police",
        reassign: "/reassign",
        resolve: "/resolve",
        close: "/close",
      };
      const data = await updateComplaintAction(complaint._id, actionPathMap[action] || `/${action}`, payload, headers);
      if (data) {
        setShowActionModal(false);
        setActionNote("");
        if (onActionComplete) {
          onActionComplete(data);
        }
      }
    } catch (error) {
      console.error("Error performing action:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getActionPayload = (action, additionalData) => {
    const payloads = {
      accept: {},
      investigate: {},
      note: { note: actionNote },
      escalateRpf: { reason: actionNote },
      escalatePolice: { reason: actionNote },
      reassign: { assignToUnit: additionalData.unit || "RPF", reason: actionNote },
      resolve: { resolutionDetails: actionNote },
      close: { closureReason: actionNote },
    };
    return payloads[action] || {};
  };

  const handleSubmitAction = async () => {
    if (["note", "reassign", "resolve", "close"].includes(selectedAction) && !actionNote.trim()) {
      console.warn("Please enter details for this action");
      return;
    }
    await performAction(selectedAction, {});
  };

  const getActionLabel = (action) => {
    const labels = {
      accept: "Accept Complaint",
      investigate: "Start Investigation",
      note: "Add Internal Note",
      escalateRpf: "Escalate to RPF",
      escalatePolice: "Escalate to Police",
      reassign: "Reassign",
      resolve: "Resolve",
      close: "Close",
    };
    return labels[action] || action;
  };

  const getTimelineEntries = () => {
    if (!complaint.messages || complaint.messages.length === 0) {
      return [];
    }
    return [...complaint.messages].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  };

  return (
    <ScrollView className="flex-1" style={{ backgroundColor: theme.screen }} contentContainerStyle={{ paddingBottom: 24 }}>
      <Animated.View
        className="rounded-[18px] border p-3.5 gap-3 m-3 shadow-md elevation-2"
        style={[
          { backgroundColor: theme.card, borderColor: theme.border, opacity: pulseOpacity },
        ]}
      >
        <View className="flex-row items-center gap-3">
          <View className="w-11 h-11 rounded-[14px] justify-center items-center" style={{ backgroundColor: theme.accentSoft }}>
            <Ionicons name="train" size={20} color={theme.accent} />
          </View>
          <View className="flex-1 gap-0.5">
            <Text className="text-[11px] font-extrabold tracking-widest uppercase" style={{ color: theme.subtext }}>Rail operations console</Text>
            <Text className="text-xl font-extrabold" style={{ color: theme.text }}>Complaint Detail View</Text>
            <Text className="text-xs leading-snug" style={{ color: theme.subtext }} numberOfLines={2}>
              {`${complaint.complaintId || complaint._id} • ${trainName} • ${boardingStation} to ${destinationStation}`}
            </Text>
          </View>
        </View>

        <PriorityHeader complaint={complaint} />
        <PriorityBadgeList complaint={complaint} />

        <View className="border rounded-2xl p-2.5 flex-row flex-wrap gap-2" style={{ backgroundColor: theme.elevated, borderColor: theme.border }}>
          <DetailPill icon="person" label="Passenger" value={complaint.passengerName || "Passenger record"} theme={theme} />
          <DetailPill icon="train" label="Train" value={trainName} theme={theme} />
          <DetailPill icon="layers" label="Coach / Seat" value={`${coachLabel} / ${seatLabel}`} theme={theme} />
          <DetailPill icon="map" label="Route" value={complaint.route || `${boardingStation} → ${destinationStation}`} theme={theme} />
          <DetailPill icon="locate" label="Boarding" value={boardingStation} theme={theme} />
          <DetailPill icon="flag" label="Destination" value={destinationStation} theme={theme} />
          <DetailPill icon="document-text" label="Item" value={complaint.itemType || "Unknown item"} theme={theme} />
          <DetailPill icon="shield-checkmark" label="Officer ID" value={officerId} theme={theme} />
        </View>

        <View className="gap-1.5">
          <Text className="text-[15px] font-extrabold" style={{ color: theme.text }}>Operations snapshot</Text>
          <Text className="text-[13px] leading-relaxed" style={{ color: theme.subtext }}>
            Officer {officerName} is handling this case through the railway security workflow. The card layout keeps priority cues, station context, and duty identifiers visible for a polished final-year demo.
          </Text>
        </View>

        <View className="border rounded-2xl p-3 gap-2" style={{ backgroundColor: theme.elevated, borderColor: theme.border }}>
          <DetailLine label="Complaint" value={complaint.complaintId || complaint._id} theme={theme} />
          <DetailLine label="Passenger" value={complaint.passengerName || "--"} theme={theme} />
          <DetailLine label="Train" value={trainName} theme={theme} />
          <DetailLine label="Coach / Seat" value={`${coachLabel} / ${seatLabel}`} theme={theme} />
          <DetailLine label="Route" value={complaint.route || `${boardingStation} → ${destinationStation}`} theme={theme} />
          <DetailLine label="Boarding" value={boardingStation} theme={theme} />
          <DetailLine label="Destination" value={destinationStation} theme={theme} />
          <DetailLine label="Item" value={complaint.itemType || "--"} theme={theme} />
          <DetailLine label="Priority" value={complaint.priority || "Normal"} theme={theme} emphasize />
          <DetailLine label="Status" value={complaint.status || "Submitted"} theme={theme} emphasize />
          <DetailLine label="Description" value={complaint.description || "--"} theme={theme} />
          <DetailLine label="Next Station" value={complaint.nextStation || "Kanpur Central (CNB)"} theme={theme} />
        </View>

        <PrioritySummary complaint={complaint} />

        <View className="mt-0.5 rounded-2xl p-3.5 gap-1.5" style={{ backgroundColor: theme.isDark ? "#0B1220" : "#10233F" }}>
          <View className="flex-row justify-between items-start gap-3">
            <View className="flex-1 gap-1">
              <Text className="text-[#F8FAFC] font-extrabold text-sm">Live operations panel</Text>
              <Text className="text-[#DBEAFE] text-[13px] leading-snug">
                {complaint.currentTrainLocation || complaint.nextStation || complaint.route || "Train route not resolved yet"}
              </Text>
            </View>
            <View className="flex-row items-center gap-1.5 bg-red-500/15 border border-red-500/35 px-2.5 py-1.5 rounded-full">
              <View className="w-2 h-2 rounded-full bg-red-500" />
              <Text className="text-red-100 text-[11px] font-extrabold tracking-wider">LIVE</Text>
            </View>
          </View>
          <Text className="text-slate-300 text-xs leading-snug">
            Position: {typeof complaint.currentLat === "number" && typeof complaint.currentLng === "number"
              ? `${complaint.currentLat.toFixed(4)}, ${complaint.currentLng.toFixed(4)}`
              : "Mock checkpoint only"}
          </Text>
          <Text className="text-slate-300 text-xs leading-snug">
            Route context: {boardingStation} -> {destinationStation}
          </Text>
          <View className="flex-row items-center gap-1.5 mt-1.5 mb-0.5">
            <View className="w-3 h-3 rounded-full bg-green-500 shadow-sm shadow-green-500" />
            <View className="flex-1 h-0.5 bg-slate-700" />
            <View className="w-2.5 h-2.5 rounded-full bg-slate-700" />
            <View className="flex-1 h-0.5 bg-slate-700" />
            <View className="w-2.5 h-2.5 rounded-full bg-slate-700" />
          </View>
          <Text className="text-slate-400 text-[11px] mt-0.5">The live map will animate against the latest officer or passenger position snapshot.</Text>
        </View>
      </Animated.View>

      <View className="rounded-[18px] border p-3.5 mx-3 mt-0.5 gap-3" style={{ backgroundColor: theme.card, borderColor: theme.border }}>
        <Text className="text-base font-extrabold" style={{ color: theme.text }}>Officer Actions</Text>
        <View className="flex-row flex-wrap gap-2">
          <ActionButton label="Accept" subtext="Accept complaint" icon="checkmark-circle" color="#2563EB" onPress={() => handleAction("accept")} />
          <ActionButton label="Investigate" subtext="Start investigation" icon="search" color="#0F766E" onPress={() => handleAction("investigate")} />
          <ActionButton label="Reply" subtext="Reply to passenger" icon="chatbubble-ellipses" color="#334155" onPress={onOpenReply} />
          <ActionButton label="Note" subtext="Add internal note" icon="document-text" color="#475569" onPress={() => handleAction("note")} />
          <ActionButton label="Escalate" subtext="Escalate to RPF" icon="trail-sign" color="#F59E0B" onPress={() => handleAction("escalateRpf")} />
          <ActionButton label="Police" subtext="Escalate to Police" icon="shield-half" color="#B45309" onPress={() => handleAction("escalatePolice")} />
          <ActionButton label="Reassign" subtext="Reassign complaint" icon="swap-horizontal" color="#7C3AED" onPress={() => handleAction("reassign")} />
          <ActionButton label="Resolve" subtext="Mark as resolved" icon="checkmark-done-circle" color="#10B981" onPress={() => handleAction("resolve")} />
          <ActionButton label="Close" subtext="Close complaint" icon="lock-closed" color="#EF4444" onPress={() => handleAction("close")} />
        </View>
      </View>

      <View className="rounded-[18px] border p-3.5 mx-3 mt-3 gap-3" style={{ backgroundColor: theme.card, borderColor: theme.border }}>
        <Text className="text-base font-extrabold" style={{ color: theme.text }}>Activity Timeline</Text>
        {getTimelineEntries().length > 0 ? (
          getTimelineEntries().map((entry, index) => (
            <View key={index} className="flex-row gap-3 pl-1.5">
              <View className="w-3 h-3 rounded-full bg-blue-600 mt-1" />
              <View className="flex-1 gap-0.5">
                <Text className="text-[13px] font-extrabold" style={{ color: theme.text }}>{entry.staffName}</Text>
                <Text className="text-xs leading-snug" style={{ color: theme.subtext }}>{entry.text}</Text>
                <Text className="text-[10px] text-slate-400">{new Date(entry.timestamp).toLocaleString()}</Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={{ color: theme.subtext }}>No activity yet</Text>
        )}
      </View>

      <Modal visible={showActionModal} transparent animationType="slide">
        <View className="flex-1 justify-center p-4.5 bg-slate-900/65">
          <View className="rounded-[18px] border p-4 gap-3" style={{ backgroundColor: theme.card, borderColor: theme.border }}>
            <Text className="text-lg font-extrabold" style={{ color: theme.text }}>{getActionLabel(selectedAction)}</Text>
            {selectedAction === "note" && (
              <TextInput
                className="rounded-2xl border px-3 py-2.5 min-h-[100px]"
                style={{ backgroundColor: theme.elevated, borderColor: theme.border, color: theme.text, textAlignVertical: "top" }}
                placeholder="Enter internal note..."
                placeholderTextColor={theme.subtext}
                value={actionNote}
                onChangeText={setActionNote}
                multiline
                numberOfLines={4}
              />
            )}
            {selectedAction === "escalateRpf" && (
              <TextInput
                className="rounded-2xl border px-3 py-2.5 min-h-[100px]"
                style={{ backgroundColor: theme.elevated, borderColor: theme.border, color: theme.text, textAlignVertical: "top" }}
                placeholder="Reason for escalation to RPF..."
                placeholderTextColor={theme.subtext}
                value={actionNote}
                onChangeText={setActionNote}
                multiline
                numberOfLines={3}
              />
            )}
            {selectedAction === "escalatePolice" && (
              <TextInput
                className="rounded-2xl border px-3 py-2.5 min-h-[100px]"
                style={{ backgroundColor: theme.elevated, borderColor: theme.border, color: theme.text, textAlignVertical: "top" }}
                placeholder="Reason for escalation to Police..."
                placeholderTextColor={theme.subtext}
                value={actionNote}
                onChangeText={setActionNote}
                multiline
                numberOfLines={3}
              />
            )}
            {selectedAction === "reassign" && (
              <TextInput
                className="rounded-2xl border px-3 py-2.5 min-h-[100px]"
                style={{ backgroundColor: theme.elevated, borderColor: theme.border, color: theme.text, textAlignVertical: "top" }}
                placeholder="Reason for reassignment..."
                placeholderTextColor={theme.subtext}
                value={actionNote}
                onChangeText={setActionNote}
                multiline
                numberOfLines={3}
              />
            )}
            {selectedAction === "resolve" && (
              <TextInput
                className="rounded-2xl border px-3 py-2.5 min-h-[100px]"
                style={{ backgroundColor: theme.elevated, borderColor: theme.border, color: theme.text, textAlignVertical: "top" }}
                placeholder="Resolution details..."
                placeholderTextColor={theme.subtext}
                value={actionNote}
                onChangeText={setActionNote}
                multiline
                numberOfLines={3}
              />
            )}
            {selectedAction === "close" && (
              <TextInput
                className="rounded-2xl border px-3 py-2.5 min-h-[100px]"
                style={{ backgroundColor: theme.elevated, borderColor: theme.border, color: theme.text, textAlignVertical: "top" }}
                placeholder="Closure reason..."
                placeholderTextColor={theme.subtext}
                value={actionNote}
                onChangeText={setActionNote}
                multiline
                numberOfLines={3}
              />
            )}
            <View className="flex-row gap-2.5">
              <Pressable
                className="flex-1 rounded-xl py-3 items-center bg-slate-700"
                onPress={() => {
                  setShowActionModal(false);
                  setActionNote("");
                }}
                disabled={isLoading}
              >
                <Text className="text-white font-extrabold">Cancel</Text>
              </Pressable>
              <Pressable className="flex-1 rounded-xl py-3 items-center bg-blue-600" onPress={handleSubmitAction} disabled={isLoading}>
                <Text className="text-white font-extrabold">{isLoading ? "Processing..." : "Confirm"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

export default ComplaintDetailView;
