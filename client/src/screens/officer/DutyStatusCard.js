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
                style={({ pressed }) => [
                  styles.action,
                  styles.primary,
                  checkInDisabled ? styles.actionDisabled : pressed && styles.actionPressed,
                ]}
                disabled={checkInDisabled}
                accessibilityState={{ disabled: checkInDisabled }}
                onPress={onCheckIn}
              >
                <Text style={[styles.actionText, checkInDisabled && styles.actionTextDisabled]}>
                  Check-In
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.action,
                  styles.danger,
                  checkOutDisabled ? styles.actionDisabled : pressed && styles.actionPressed,
                ]}
                disabled={checkOutDisabled}
                accessibilityState={{ disabled: checkOutDisabled }}
                onPress={onCheckOut}
              >
                <Text style={[styles.actionText, checkOutDisabled && styles.actionTextDisabled]}>
                  Check-Out
                </Text>
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
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 0,
    borderColor: "#CBD5E1",
    padding: 16,
    gap: 12,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  badgeOn: {
    backgroundColor: "#D1FAE5",
    color: "#065F46",
  },
  badgeOff: {
    backgroundColor: "#FEE2E2",
    color: "#7F1D1D",
  },
  grid: {
    gap: 10,
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
    fontWeight: "500",
    elevation: 1,
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
    backgroundColor: "#10B981",
  },
  danger: {
    backgroundColor: "#EF4444",
  },
  actionDisabled: {
    backgroundColor: "#CBD5E1",
    opacity: 1,
    elevation: 0,
  },
  actionPressed: {
    elevation: 4,
    shadowOpacity: 0.15,
  },
  actionText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 13,
    letterSpacing: 0.3,
  },
  actionTextDisabled: {
    color: "#94A3B8",
  },
  info: {
    fontSize: 12,
    color: "#64748B",
    lineHeight: 18,
  },
});

export default DutyStatusCard;
