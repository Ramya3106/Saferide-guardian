import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

const STATUS_OPTIONS = [
  "Seen",
  "Acknowledged",
  "Item Being Checked",
  "Item Found",
  "Passenger Contacted",
  "Ready for Handover",
  "Closed",
];

const ReplyStatusUpdateForm = ({ complaint, onSubmitReply, onSubmitStatus, sending }) => {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("Item Being Checked");

  const canReply = useMemo(() => message.trim().length > 2 && complaint, [message, complaint]);
  const canUpdate = useMemo(() => status.trim().length > 0 && complaint, [status, complaint]);

  if (!complaint) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Reply / Status Update Form</Text>
        <Text style={styles.helper}>Select a complaint first.</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Reply / Status Update Form</Text>
      <Text style={styles.helper}>Complaint: {complaint.id}</Text>

      <TextInput
        style={[styles.input, styles.textArea]}
        value={message}
        onChangeText={setMessage}
        placeholder="Write reply for passenger"
        placeholderTextColor="#64748B"
        multiline
      />

      <View style={styles.statusWrap}>
        {STATUS_OPTIONS.map((option) => {
          const selected = option === status;
          return (
            <Pressable
              key={option}
              onPress={() => setStatus(option)}
              style={[styles.chip, selected && styles.chipActive]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextActive]}>{option}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.row}>
        <Pressable
          style={[styles.action, styles.primary, (!canReply || sending) && styles.disabled]}
          onPress={() => {
            if (!canReply || sending) return;
            onSubmitReply(message.trim(), status);
            setMessage("");
          }}
        >
          <Text style={styles.actionText}>{sending ? "Sending..." : "Send Reply"}</Text>
        </Pressable>

        <Pressable
          style={[styles.action, styles.secondary, (!canUpdate || sending) && styles.disabled]}
          onPress={() => {
            if (!canUpdate || sending) return;
            onSubmitStatus(status);
          }}
        >
          <Text style={styles.actionText}>{sending ? "Updating..." : "Update Status"}</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 0,
    borderColor: "#E2E8F0",
    padding: 16,
    gap: 12,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  helper: {
    fontSize: 12,
    color: "#64748B",
  },
  input: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: "#F8FAFC",
    color: "#0F172A",
    fontSize: 14,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  statusWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#F8FAFC",
  },
  chipActive: {
    borderColor: "#3B82F6",
    backgroundColor: "#EFF6FF",
  },
  chipText: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
  },
  chipTextActive: {
    color: "#3B82F6",
    fontWeight: "800",
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  action: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  primary: {
    backgroundColor: "#3B82F6",
  },
  secondary: {
    backgroundColor: "#10B981",
  },
  disabled: {
    backgroundColor: "#CBD5E1",
  },
  actionText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 12,
  },
});

export default ReplyStatusUpdateForm;
