import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

const DutyStatusCard = ({
  onDuty,
  syncing,
  dutyTrain,
  dutyRoute,
  dutyStation,
  dutyShift,
  onChangeTrain,
  onChangeRoute,
  onChangeStation,
  onChangeShift,
  onCheckIn,
  onCheckOut,
  attendance,
}) => {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Duty Status</Text>
        <Text style={[styles.badge, onDuty ? styles.badgeOn : styles.badgeOff]}>
          {onDuty ? "ON DUTY" : "OFF DUTY"}
        </Text>
      </View>

      <View style={styles.grid}>
        <TextInput
          style={styles.input}
          placeholder="Assigned Train"
          placeholderTextColor="#64748B"
          value={dutyTrain}
          onChangeText={onChangeTrain}
        />
        <TextInput
          style={styles.input}
          placeholder="Assigned Route"
          placeholderTextColor="#64748B"
          value={dutyRoute}
          onChangeText={onChangeRoute}
        />
        <TextInput
          style={styles.input}
          placeholder="Assigned Station"
          placeholderTextColor="#64748B"
          value={dutyStation}
          onChangeText={onChangeStation}
        />
        <TextInput
          style={styles.input}
          placeholder="Duty Shift"
          placeholderTextColor="#64748B"
          value={dutyShift}
          onChangeText={onChangeShift}
        />
      </View>

      <View style={styles.row}>
        <Pressable style={[styles.action, styles.primary]} disabled={syncing || onDuty} onPress={onCheckIn}>
          <Text style={styles.actionText}>Check-In</Text>
        </Pressable>
        <Pressable style={[styles.action, styles.danger]} disabled={syncing || !onDuty} onPress={onCheckOut}>
          <Text style={styles.actionText}>Check-Out</Text>
        </Pressable>
      </View>

      <Text style={styles.info}>Session: {attendance?.status || (onDuty ? "ACTIVE" : "INACTIVE")}</Text>
      <Text style={styles.info}>
        In: {attendance?.checkInTime ? new Date(attendance.checkInTime).toLocaleString() : "--"}
      </Text>
      <Text style={styles.info}>
        Out: {attendance?.checkOutTime ? new Date(attendance.checkOutTime).toLocaleString() : "--"}
      </Text>
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
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0F172A",
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: "700",
  },
  badgeOn: {
    backgroundColor: "#DCFCE7",
    color: "#166534",
  },
  badgeOff: {
    backgroundColor: "#FEE2E2",
    color: "#991B1B",
  },
  grid: {
    gap: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#94A3B8",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: "#FFFFFF",
    color: "#0F172A",
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
    backgroundColor: "#2563EB",
  },
  danger: {
    backgroundColor: "#B91C1C",
  },
  actionText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  info: {
    fontSize: 12,
    color: "#334155",
  },
});

export default DutyStatusCard;
