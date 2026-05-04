import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View, ScrollView, Modal, TextInput } from "react-native";

const ComplaintDetailView = ({ complaint, onOpenReply, onActionComplete }) => {
  const [showActionModal, setShowActionModal] = useState(false);
  const [selectedAction, setSelectedAction] = useState(null);
  const [actionNote, setActionNote] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  if (!complaint) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Complaint Detail View</Text>
        <Text style={styles.empty}>Select an alert to view complete details.</Text>
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
      const endpoint = getActionEndpoint(action);
      const payload = getActionPayload(action, additionalData);

      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": "officer@example.com",
          "x-user-name": "Officer Name",
          "x-user-role": "TTR/RPF/Police",
          "x-duty-unit": "TTR",
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        setShowActionModal(false);
        setActionNote("");
        if (onActionComplete) {
          onActionComplete(data);
        }
      } else {
        console.error("Action failed:", response.statusText);
      }
    } catch (error) {
      console.error("Error performing action:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getActionEndpoint = (action) => {
    const baseUrl = `http://localhost:5000/api/complaints/${complaint._id}/staff`;
    const endpoints = {
      accept: `${baseUrl}/accept`,
      investigate: `${baseUrl}/start-investigation`,
      note: `${baseUrl}/note`,
      escalateRpf: `${baseUrl}/escalate-rpf`,
      escalatePolice: `${baseUrl}/escalate-police`,
      reassign: `${baseUrl}/reassign`,
      resolve: `${baseUrl}/resolve`,
      close: `${baseUrl}/close`,
    };
    return endpoints[action] || `${baseUrl}/${action}`;
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
    if (["note", "reassign", "resolve", "close"].includes(selectedAction)) {
      if (!actionNote.trim()) {
        console.warn("Please enter details for this action");
        return;
      }
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
    return complaint.messages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Complaint Detail View</Text>
        <Text style={styles.row}>
          <Text style={styles.label}>Complaint:</Text> {complaint.complaintId || complaint._id}
        </Text>
        <Text style={styles.row}>
          <Text style={styles.label}>Passenger:</Text> {complaint.passengerName}
        </Text>
        <Text style={styles.row}>
          <Text style={styles.label}>Train:</Text> {complaint.trainName || complaint.vehicleNumber}
        </Text>
        <Text style={styles.row}>
          <Text style={styles.label}>Coach / Seat:</Text> {complaint.coach || "--"} / {complaint.seat || "--"}
        </Text>
        <Text style={styles.row}>
          <Text style={styles.label}>Route:</Text> {complaint.route}
        </Text>
        <Text style={styles.row}>
          <Text style={styles.label}>Boarding:</Text> {complaint.boardingStation || "--"}
        </Text>
        <Text style={styles.row}>
          <Text style={styles.label}>Destination:</Text> {complaint.destinationStation || "--"}
        </Text>
        <Text style={styles.row}>
          <Text style={styles.label}>Item:</Text> {complaint.itemType}
        </Text>
        <Text style={styles.row}>
          <Text style={styles.label}>Priority:</Text> {complaint.priority}
        </Text>
        <Text style={styles.row}>
          <Text style={styles.label}>Status:</Text> {complaint.status}
        </Text>
        <Text style={styles.row}>
          <Text style={styles.label}>Description:</Text> {complaint.description}
        </Text>
        <Text style={styles.row}>
          <Text style={styles.label}>Next Station:</Text> {complaint.nextStation || "--"}
        </Text>

        <View style={styles.mapCard}>
          <Text style={styles.mapTitle}>Live map placeholder</Text>
          <Text style={styles.mapText}>
            {complaint.currentTrainLocation || complaint.nextStation || complaint.route || "Train route not resolved yet"}
          </Text>
          <Text style={styles.mapMeta}>
            Position:{" "}
            {typeof complaint.currentLat === "number" && typeof complaint.currentLng === "number"
              ? `${complaint.currentLat.toFixed(4)}, ${complaint.currentLng.toFixed(4)}`
              : "Mock checkpoint only"}
          </Text>
          <Text style={styles.mapMeta}>
            Route context: {complaint.boardingStation || "--"} -> {complaint.destinationStation || "--"}
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
      </View>

      {/* Officer Actions Section */}
      <View style={styles.actionsContainer}>
        <Text style={styles.actionsTitle}>Officer Actions</Text>

        <View style={styles.actionGrid}>
          <Pressable style={styles.actionButton} onPress={() => handleAction("accept")}>
            <Text style={styles.actionButtonText}>Accept</Text>
            <Text style={styles.actionButtonSubtext}>Accept complaint</Text>
          </Pressable>

          <Pressable style={styles.actionButton} onPress={() => handleAction("investigate")}>
            <Text style={styles.actionButtonText}>Investigate</Text>
            <Text style={styles.actionButtonSubtext}>Start investigation</Text>
          </Pressable>

          <Pressable style={styles.actionButton} onPress={onOpenReply}>
            <Text style={styles.actionButtonText}>Reply</Text>
            <Text style={styles.actionButtonSubtext}>Reply to passenger</Text>
          </Pressable>

          <Pressable style={styles.actionButton} onPress={() => handleAction("note")}>
            <Text style={styles.actionButtonText}>Note</Text>
            <Text style={styles.actionButtonSubtext}>Add internal note</Text>
          </Pressable>

          <Pressable style={[styles.actionButton, styles.escalateButton]} onPress={() => handleAction("escalateRpf")}>
            <Text style={styles.actionButtonText}>Escalate</Text>
            <Text style={styles.actionButtonSubtext}>Escalate to RPF</Text>
          </Pressable>

          <Pressable style={[styles.actionButton, styles.escalateButton]} onPress={() => handleAction("escalatePolice")}>
            <Text style={styles.actionButtonText}>Police</Text>
            <Text style={styles.actionButtonSubtext}>Escalate to Police</Text>
          </Pressable>

          <Pressable style={styles.actionButton} onPress={() => handleAction("reassign")}>
            <Text style={styles.actionButtonText}>Reassign</Text>
            <Text style={styles.actionButtonSubtext}>Reassign complaint</Text>
          </Pressable>

          <Pressable style={[styles.actionButton, styles.resolveButton]} onPress={() => handleAction("resolve")}>
            <Text style={styles.actionButtonText}>Resolve</Text>
            <Text style={styles.actionButtonSubtext}>Mark as resolved</Text>
          </Pressable>

          <Pressable style={[styles.actionButton, styles.closeButton]} onPress={() => handleAction("close")}>
            <Text style={styles.actionButtonText}>Close</Text>
            <Text style={styles.actionButtonSubtext}>Close complaint</Text>
          </Pressable>
        </View>
      </View>

      {/* Timeline Section */}
      <View style={styles.timelineContainer}>
        <Text style={styles.timelineTitle}>Activity Timeline</Text>
        {getTimelineEntries().length > 0 ? (
          getTimelineEntries().map((entry, index) => (
            <View key={index} style={styles.timelineEntry}>
              <View style={styles.timelineDot} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineStaff}>{entry.staffName}</Text>
                <Text style={styles.timelineText}>{entry.text}</Text>
                <Text style={styles.timelineTime}>
                  {new Date(entry.timestamp).toLocaleString()}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.empty}>No activity yet</Text>
        )}
      </View>

      {/* Action Modal */}
      <Modal visible={showActionModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{getActionLabel(selectedAction)}</Text>

            {selectedAction === "note" && (
              <TextInput
                style={styles.input}
                placeholder="Enter internal note..."
                placeholderTextColor="#94A3B8"
                value={actionNote}
                onChangeText={setActionNote}
                multiline
                numberOfLines={4}
              />
            )}

            {selectedAction === "escalateRpf" && (
              <TextInput
                style={styles.input}
                placeholder="Reason for escalation to RPF..."
                placeholderTextColor="#94A3B8"
                value={actionNote}
                onChangeText={setActionNote}
                multiline
                numberOfLines={3}
              />
            )}

            {selectedAction === "escalatePolice" && (
              <TextInput
                style={styles.input}
                placeholder="Reason for escalation to Police..."
                placeholderTextColor="#94A3B8"
                value={actionNote}
                onChangeText={setActionNote}
                multiline
                numberOfLines={3}
              />
            )}

            {selectedAction === "reassign" && (
              <TextInput
                style={styles.input}
                placeholder="Reason for reassignment..."
                placeholderTextColor="#94A3B8"
                value={actionNote}
                onChangeText={setActionNote}
                multiline
                numberOfLines={3}
              />
            )}

            {selectedAction === "resolve" && (
              <TextInput
                style={styles.input}
                placeholder="Resolution details..."
                placeholderTextColor="#94A3B8"
                value={actionNote}
                onChangeText={setActionNote}
                multiline
                numberOfLines={3}
              />
            )}

            {selectedAction === "close" && (
              <TextInput
                style={styles.input}
                placeholder="Closure reason..."
                placeholderTextColor="#94A3B8"
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

              <Pressable
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleSubmitAction}
                disabled={isLoading}
              >
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
    backgroundColor: "#F0F4F8",
  },
  card: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    padding: 12,
    gap: 5,
    margin: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 2,
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
    marginTop: 8,
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#1E293B",
    gap: 4,
  },
  mapTitle: {
    color: "#F8FAFC",
    fontWeight: "700",
    fontSize: 14,
  },
  mapText: {
    color: "#DBEAFE",
    fontSize: 13,
  },
  mapMeta: {
    color: "#CBD5E1",
    fontSize: 12,
  },
  mapHint: {
    color: "#94A3B8",
    fontSize: 11,
    marginTop: 2,
  },
  routeTrack: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
    marginBottom: 4,
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
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    padding: 12,
    margin: 12,
  },
  actionsTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 12,
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  actionButton: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#1D4ED8",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
    gap: 2,
  },
  escalateButton: {
    backgroundColor: "#F59E0B",
  },
  resolveButton: {
    backgroundColor: "#10B981",
  },
  closeButton: {
    backgroundColor: "#EF4444",
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 12,
  },
  actionButtonSubtext: {
    color: "#E0F2FE",
    fontSize: 10,
  },
  timelineContainer: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    padding: 12,
    margin: 12,
    marginBottom: 24,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 12,
  },
  timelineEntry: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
    paddingLeft: 8,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#1D4ED8",
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
    gap: 2,
  },
  timelineStaff: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  timelineText: {
    fontSize: 12,
    color: "#334155",
  },
  timelineTime: {
    fontSize: 11,
    color: "#94A3B8",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 16,
    gap: 12,
    maxHeight: "80%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
  },
  input: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#FFFFFF",
    color: "#0F172A",
    minHeight: 80,
    textAlignVertical: "top",
  },
  modalButtons: {
    flexDirection: "row",
    gap: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#E2E8F0",
  },
  confirmButton: {
    backgroundColor: "#1D4ED8",
  },
  modalButtonText: {
    fontWeight: "700",
    fontSize: 14,
    color: "#FFFFFF",
  },
});

export default ComplaintDetailView;
