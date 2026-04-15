import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

const ComplaintDetailView = ({ complaint, onOpenReply }) => {
  if (!complaint) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Complaint Detail View</Text>
        <Text style={styles.empty}>Select an alert to view complete details.</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Complaint Detail View</Text>
      <Text style={styles.row}><Text style={styles.label}>Complaint:</Text> {complaint.id}</Text>
      <Text style={styles.row}><Text style={styles.label}>Passenger:</Text> {complaint.passengerName}</Text>
      <Text style={styles.row}><Text style={styles.label}>Train:</Text> {complaint.vehicleNumber}</Text>
      <Text style={styles.row}><Text style={styles.label}>Route:</Text> {complaint.route}</Text>
      <Text style={styles.row}><Text style={styles.label}>Item:</Text> {complaint.itemType}</Text>
      <Text style={styles.row}><Text style={styles.label}>Priority:</Text> {complaint.priority}</Text>
      <Text style={styles.row}><Text style={styles.label}>Status:</Text> {complaint.status}</Text>
      <Text style={styles.row}><Text style={styles.label}>Description:</Text> {complaint.description}</Text>
      <Text style={styles.row}><Text style={styles.label}>Next Station:</Text> {complaint.nextStation}</Text>

      <Pressable style={styles.button} onPress={onOpenReply}>
        <Text style={styles.buttonText}>Reply / Status Update Form</Text>
      </Pressable>
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
    gap: 5,
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
  button: {
    marginTop: 8,
    backgroundColor: "#1D4ED8",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});

export default ComplaintDetailView;
