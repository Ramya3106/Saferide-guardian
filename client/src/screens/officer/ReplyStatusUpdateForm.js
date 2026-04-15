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
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    padding: 12,
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
  },
  helper: {
    fontSize: 12,
    color: "#475569",
  },
  input: {
    borderWidth: 1,
    borderColor: "#94A3B8",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#FFFFFF",
    color: "#0F172A",
  },
  textArea: {
    minHeight: 88,
    textAlignVertical: "top",
  },
  statusWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    borderWidth: 1,
    borderColor: "#94A3B8",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#FFFFFF",
  },
  chipActive: {
    borderColor: "#1D4ED8",
    backgroundColor: "#DBEAFE",
  },
  chipText: {
    fontSize: 12,
    color: "#334155",
  },
  chipTextActive: {
    color: "#1E3A8A",
    fontWeight: "700",
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  action: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  primary: {
    backgroundColor: "#1D4ED8",
  },
  secondary: {
    backgroundColor: "#0F766E",
  },
  disabled: {
    backgroundColor: "#94A3B8",
  },
  actionText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 12,
  },
});

export default ReplyStatusUpdateForm;
