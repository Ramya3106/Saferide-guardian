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
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
  },
  list: {
    gap: 8,
    paddingBottom: 8,
  },
  item: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    padding: 12,
    gap: 2,
  },
  row: {
    color: "#334155",
    fontSize: 12,
  },
  emptyBox: {
    padding: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
  },
  emptyText: {
    color: "#475569",
  },
});

export default DutyHistoryScreen;
