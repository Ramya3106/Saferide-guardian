import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PriorityBadgeList, PriorityHeader, PrioritySummary } from "../../components/PriorityBadge";
import { updateComplaintAction } from "../../services/complaintService";

const DetailPill = ({ icon, label, value, theme }) => (
  <View style={[styles.detailPill, { backgroundColor: theme.chip, borderColor: theme.chipBorder }]}>
    <View style={[styles.detailPillIcon, { backgroundColor: theme.accentSoft }]}>
      <Ionicons name={icon} size={12} color={theme.accent} />
    </View>
    <Text style={[styles.detailPillLabel, { color: theme.subtext }]}>{label}</Text>
    <Text style={[styles.detailPillValue, { color: theme.text }]} numberOfLines={2}>
      {value}
    </Text>
  </View>
);

const DetailLine = ({ label, value, theme, emphasize = false }) => (
  <View style={styles.detailLineRow}>
    <Text style={[styles.label, { color: theme.subtext }]}>{label}</Text>
    <Text style={[styles.detailLineValue, { color: theme.text, fontWeight: emphasize ? "800" : "600" }]}>
      {value}
    </Text>
  </View>
);

const ActionButton = ({ label, subtext, icon, color, onPress }) => (
  <Pressable style={[styles.actionButton, { backgroundColor: color }]} onPress={onPress}>
    <Ionicons name={icon} size={16} color="#FFFFFF" />
    <Text style={styles.actionButtonText}>{label}</Text>
    <Text style={styles.actionButtonSubtext}>{subtext}</Text>
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
      <View style={[styles.emptyShell, { backgroundColor: theme.screen }]}>
        <View style={[styles.emptyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name="train" size={28} color={theme.accent} />
          <Text style={[styles.title, { color: theme.text }]}>Complaint Detail View</Text>
          <Text style={[styles.empty, { color: theme.subtext }]}>Select an alert to view complete details.</Text>
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
    <ScrollView style={[styles.container, { backgroundColor: theme.screen }]} contentContainerStyle={styles.scrollContent}>
      <Animated.View
        style={[
          styles.card,
          { backgroundColor: theme.card, borderColor: theme.border, opacity: pulseOpacity },
        ]}
      >
        <View style={styles.heroRow}>
          <View style={[styles.heroIcon, { backgroundColor: theme.accentSoft }]}>
            <Ionicons name="train" size={20} color={theme.accent} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={[styles.overline, { color: theme.subtext }]}>Rail operations console</Text>
            <Text style={[styles.title, { color: theme.text }]}>Complaint Detail View</Text>
            <Text style={[styles.heroMeta, { color: theme.subtext }]} numberOfLines={2}>
              {`${complaint.complaintId || complaint._id} • ${trainName} • ${boardingStation} to ${destinationStation}`}
            </Text>
          </View>
        </View>

        <PriorityHeader complaint={complaint} />
        <PriorityBadgeList complaint={complaint} />

        <View style={[styles.infoGrid, { backgroundColor: theme.elevated, borderColor: theme.border }]}>
          <DetailPill icon="person" label="Passenger" value={complaint.passengerName || "Passenger record"} theme={theme} />
          <DetailPill icon="train" label="Train" value={trainName} theme={theme} />
          <DetailPill icon="layers" label="Coach / Seat" value={`${coachLabel} / ${seatLabel}`} theme={theme} />
          <DetailPill icon="map" label="Route" value={complaint.route || `${boardingStation} → ${destinationStation}`} theme={theme} />
          <DetailPill icon="locate" label="Boarding" value={boardingStation} theme={theme} />
          <DetailPill icon="flag" label="Destination" value={destinationStation} theme={theme} />
          <DetailPill icon="document-text" label="Item" value={complaint.itemType || "Unknown item"} theme={theme} />
          <DetailPill icon="shield-checkmark" label="Officer ID" value={officerId} theme={theme} />
        </View>

        <View style={styles.sectionBlock}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Operations snapshot</Text>
          <Text style={[styles.sectionBody, { color: theme.subtext }]}>
            Officer {officerName} is handling this case through the railway security workflow. The card layout keeps priority cues, station context, and duty identifiers visible for a polished final-year demo.
          </Text>
        </View>

        <View style={[styles.detailStack, { backgroundColor: theme.elevated, borderColor: theme.border }]}>
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

        <View style={[styles.mapCard, { backgroundColor: theme.isDark ? "#0B1220" : "#10233F" }]}>
          <View style={styles.mapHeaderRow}>
            <View style={styles.mapHeaderCopy}>
              <Text style={styles.mapTitle}>Live operations panel</Text>
              <Text style={styles.mapText}>
                {complaint.currentTrainLocation || complaint.nextStation || complaint.route || "Train route not resolved yet"}
              </Text>
            </View>
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.livePillText}>LIVE</Text>
            </View>
          </View>
          <Text style={styles.mapMeta}>
            Position: {typeof complaint.currentLat === "number" && typeof complaint.currentLng === "number"
              ? `${complaint.currentLat.toFixed(4)}, ${complaint.currentLng.toFixed(4)}`
              : "Mock checkpoint only"}
          </Text>
          <Text style={styles.mapMeta}>
            Route context: {boardingStation} -> {destinationStation}
          </Text>
          <View style={styles.routeTrack}>
            <View style={styles.routeDotActive} />
            <View style={styles.routeLine} />
            <View style={styles.routeDot} />
            <View style={styles.routeLine} />
            <View style={styles.routeDot} />
          </View>
          <Text style={styles.mapHint}>The live map will animate against the latest officer or passenger position snapshot.</Text>
        </View>
      </Animated.View>

      <View style={[styles.actionsContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.actionsTitle, { color: theme.text }]}>Officer Actions</Text>
        <View style={styles.actionGrid}>
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

      <View style={[styles.timelineContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.timelineTitle, { color: theme.text }]}>Activity Timeline</Text>
        {getTimelineEntries().length > 0 ? (
          getTimelineEntries().map((entry, index) => (
            <View key={index} style={styles.timelineEntry}>
              <View style={styles.timelineDot} />
              <View style={styles.timelineContent}>
                <Text style={[styles.timelineStaff, { color: theme.text }]}>{entry.staffName}</Text>
                <Text style={[styles.timelineText, { color: theme.subtext }]}>{entry.text}</Text>
                <Text style={styles.timelineTime}>{new Date(entry.timestamp).toLocaleString()}</Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={[styles.empty, { color: theme.subtext }]}>No activity yet</Text>
        )}
      </View>

      <Modal visible={showActionModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>{getActionLabel(selectedAction)}</Text>
            {selectedAction === "note" && (
              <TextInput
                style={[styles.input, { backgroundColor: theme.elevated, borderColor: theme.border, color: theme.text }]}
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
                style={[styles.input, { backgroundColor: theme.elevated, borderColor: theme.border, color: theme.text }]}
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
                style={[styles.input, { backgroundColor: theme.elevated, borderColor: theme.border, color: theme.text }]}
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
                style={[styles.input, { backgroundColor: theme.elevated, borderColor: theme.border, color: theme.text }]}
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
                style={[styles.input, { backgroundColor: theme.elevated, borderColor: theme.border, color: theme.text }]}
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
                style={[styles.input, { backgroundColor: theme.elevated, borderColor: theme.border, color: theme.text }]}
                placeholder="Closure reason..."
                placeholderTextColor={theme.subtext}
                value={actionNote}
                onChangeText={setActionNote}
                multiline
                numberOfLines={3}
              />
            )}
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowActionModal(false);
                  setActionNote("");
                }}
                disabled={isLoading}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalButton, styles.confirmButton]} onPress={handleSubmitAction} disabled={isLoading}>
                <Text style={styles.modalButtonText}>{isLoading ? "Processing..." : "Confirm"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  emptyShell: {
    flex: 1,
    padding: 12,
    justifyContent: "center",
  },
  emptyCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    alignItems: "center",
    gap: 8,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 12,
    margin: 12,
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  heroCopy: {
    flex: 1,
    gap: 2,
  },
  overline: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
  },
  heroMeta: {
    fontSize: 12,
    lineHeight: 17,
  },
  infoGrid: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  detailPill: {
    flexBasis: "48%",
    minWidth: "48%",
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    gap: 4,
  },
  detailPillIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  detailPillLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  detailPillValue: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 17,
  },
  sectionBlock: {
    gap: 6,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  sectionBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  detailStack: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 8,
  },
  detailLineRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
  },
  detailLineValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 13,
    lineHeight: 18,
  },
  row: {
    color: "#334155",
    fontSize: 13,
  },
  label: {
    fontWeight: "700",
    color: "#0F172A",
  },
  empty: {
    color: "#475569",
  },
  mapCard: {
    marginTop: 2,
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  mapHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  mapHeaderCopy: {
    flex: 1,
    gap: 3,
  },
  mapTitle: {
    color: "#F8FAFC",
    fontWeight: "800",
    fontSize: 14,
  },
  mapText: {
    color: "#DBEAFE",
    fontSize: 13,
    lineHeight: 18,
  },
  mapMeta: {
    color: "#CBD5E1",
    fontSize: 12,
    lineHeight: 17,
  },
  mapHint: {
    color: "#94A3B8",
    fontSize: 11,
    marginTop: 2,
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(239, 68, 68, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.35)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
  },
  livePillText: {
    color: "#FEE2E2",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  routeTrack: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
    marginBottom: 2,
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#334155",
  },
  routeDotActive: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#22C55E",
    shadowColor: "#22C55E",
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
  routeLine: {
    flex: 1,
    height: 2,
    backgroundColor: "#334155",
  },
  actionsContainer: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginHorizontal: 12,
    marginTop: 2,
    gap: 12,
  },
  actionsTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  actionButton: {
    flex: 1,
    minWidth: "31%",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 12,
  },
  actionButtonSubtext: {
    color: "rgba(255,255,255,0.86)",
    fontSize: 10,
    textAlign: "center",
  },
  timelineContainer: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginHorizontal: 12,
    marginTop: 12,
    gap: 12,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  timelineEntry: {
    flexDirection: "row",
    gap: 12,
    paddingLeft: 6,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#2563EB",
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
    gap: 2,
  },
  timelineStaff: {
    fontSize: 13,
    fontWeight: "800",
  },
  timelineText: {
    fontSize: 12,
    lineHeight: 17,
  },
  timelineTime: {
    fontSize: 10,
    color: "#94A3B8",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.65)",
    justifyContent: "center",
    padding: 18,
  },
  modalContent: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 100,
    textAlignVertical: "top",
  },
  modalButtons: {
    flexDirection: "row",
    gap: 10,
  },
  modalButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#334155",
  },
  confirmButton: {
    backgroundColor: "#2563EB",
  },
  modalButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
});

export default ComplaintDetailView;
