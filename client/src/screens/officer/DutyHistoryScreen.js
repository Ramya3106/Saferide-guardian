import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

const DutyHistoryScreen = ({ history }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Duty History Screen</Text>
      <ScrollView contentContainerStyle={styles.list}>
        {history.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No duty attendance history available.</Text>
          </View>
        ) : (
          history.map((entry, index) => (
            <View key={entry._id || `${entry.checkInTime}-${index}`} style={styles.item}>
              <Text style={styles.row}>Status: {entry.dutyStatus || entry.status || "INACTIVE"}</Text>
              <Text style={styles.row}>Train: {entry.assignedTrain || "--"}</Text>
              <Text style={styles.row}>Route: {entry.assignedRoute || "--"}</Text>
              <Text style={styles.row}>Station: {entry.assignedStation || "--"}</Text>
              <Text style={styles.row}>Check-In: {entry.checkInTime ? new Date(entry.checkInTime).toLocaleString() : "--"}</Text>
              <Text style={styles.row}>Check-Out: {entry.checkOutTime ? new Date(entry.checkOutTime).toLocaleString() : "--"}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  list: {
    gap: 10,
    paddingBottom: 12,
  },
  item: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 0,
    borderColor: "#E2E8F0",
    padding: 14,
    gap: 6,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  row: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "500",
  },
  emptyBox: {
    padding: 16,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
  },
  emptyText: {
    color: "#64748B",
    fontSize: 14,
  },
});

export default DutyHistoryScreen;
