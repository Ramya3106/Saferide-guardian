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
          placeholder="Enter assigned train number"
          placeholderTextColor="#64748B"
          value={dutyTrain}
          onChangeText={onChangeTrain}
        />
        <TextInput
          style={styles.input}
          placeholder="Enter assigned route"
          placeholderTextColor="#64748B"
          value={dutyRoute}
          onChangeText={onChangeRoute}
        />
        <TextInput
          style={styles.input}
          placeholder="Enter assigned station"
          placeholderTextColor="#64748B"
          value={dutyStation}
          onChangeText={onChangeStation}
        />
        <TextInput
          style={styles.input}
          placeholder="Enter duty shift time"
          placeholderTextColor="#64748B"
          value={dutyShift}
          onChangeText={onChangeShift}
        />
      </View>

      <View style={styles.row}>
        {(() => {
          const checkInDisabled = Boolean(syncing) || Boolean(onDuty);
          const checkOutDisabled = Boolean(syncing) || !Boolean(onDuty);
          return (
            <>
              <Pressable
                style={[styles.action, styles.primary, checkInDisabled && styles.actionDisabled]}
                disabled={checkInDisabled}
                accessibilityState={{ disabled: checkInDisabled }}
                onPress={onCheckIn}
              >
                <Text style={styles.actionText}>Check-In</Text>
              </Pressable>

              <Pressable
                style={[styles.action, styles.danger, checkOutDisabled && styles.actionDisabled]}
                disabled={checkOutDisabled}
                accessibilityState={{ disabled: checkOutDisabled }}
                onPress={onCheckOut}
              >
                <Text style={styles.actionText}>Check-Out</Text>
              </Pressable>
            </>
          );
        })()}
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
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
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
    elevation: 1,
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
    elevation: 2,
  },
  primary: {
    backgroundColor: "#2563EB",
  },
  danger: {
    backgroundColor: "#B91C1C",
  },
  actionDisabled: {
    opacity: 0.5,
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
