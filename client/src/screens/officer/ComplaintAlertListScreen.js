import React, { useEffect, useRef } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const PENDING_STATUSES = new Set(["Submitted", "Reported", "Staff Notified", "Seen"]);
const ACCEPTED_STATUSES = new Set(["Accepted", "Acknowledged"]);

const BlinkingAlertCard = ({ alert, selected, onPress, onAccept, onOpenReply }) => {
  const blinkAnim = useRef(new Animated.Value(0)).current;
  const shouldBlink = PENDING_STATUSES.has(alert.status);
  const isAccepted = ACCEPTED_STATUSES.has(alert.status) || Boolean(alert.acceptedAt || alert.acceptedBy);
  const acceptedBy = alert.acceptedBy || alert.assignedOfficerName || alert.staffName || alert.acceptedByName || "Assigned officer";

  useEffect(() => {
    if (!shouldBlink) {
      blinkAnim.stopAnimation();
      blinkAnim.setValue(0);
      return undefined;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(blinkAnim, {
          toValue: 0,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [blinkAnim, shouldBlink]);

  const cardOpacity = shouldBlink
    ? blinkAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.58, 1],
      })
    : 1;

  return (
    <Animated.View style={{ opacity: cardOpacity }}>
      <Pressable
        style={[styles.item, selected && styles.itemActive, shouldBlink && styles.itemBlinking]}
        onPress={() => onPress(alert)}
      >
        <View style={styles.topRow}>
          <Text style={styles.idText}>{alert.id}</Text>
          <Text style={styles.status}>{alert.status}</Text>
        </View>
        <Text style={styles.itemType}>{alert.itemType}</Text>
        <Text style={styles.meta}>{alert.vehicleNumber} | {alert.route}</Text>
        <Text style={styles.meta}>Passenger: {alert.passengerName}</Text>
        <Text style={styles.meta}>Priority: {alert.priority}</Text>

        {isAccepted ? (
          <View style={styles.acceptedBox}>
            <Text style={styles.acceptedText}>Accepted by {acceptedBy}</Text>
            <Text style={styles.acceptedSubtext}>Card locked to the assigned officer.</Text>
            <View style={styles.actionRow}>
              <Pressable style={styles.secondaryAction} onPress={() => onOpenReply?.(alert)}>
                <Text style={styles.secondaryActionText}>Reply / Status</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.actionRow}>
            <Pressable style={styles.acceptAction} onPress={() => onAccept?.(alert)}>
              <Text style={styles.acceptActionText}>Accept</Text>
            </Pressable>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
};

const ComplaintAlertListScreen = ({ alerts, selectedId, onSelect, onAccept, onOpenReply }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Complaint Alert List</Text>
      <ScrollView contentContainerStyle={styles.list}>
        {alerts.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>No Complaints Assigned</Text>
            <Text style={styles.emptyText}>
              You don't have any complaints assigned yet. Check back later or contact your supervisor for new assignments.
            </Text>
          </View>
        ) : (
          alerts.map((alert) => {
            const selected = selectedId === alert.id;
            return (
              <BlinkingAlertCard
                key={alert.id}
                alert={alert}
                selected={selected}
                onPress={onSelect}
                onAccept={onAccept}
                onOpenReply={onOpenReply}
              />
            );
          })
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
  },
  itemActive: {
    borderColor: "#2563EB",
    backgroundColor: "#EFF6FF",
  },
  itemBlinking: {
    borderColor: "#F59E0B",
    shadowColor: "#F59E0B",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 2,
  },
  actionRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  acceptAction: {
    backgroundColor: "#16A34A",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  acceptActionText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  acceptedBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#86EFAC",
    backgroundColor: "#F0FDF4",
    gap: 3,
  },
  acceptedText: {
    color: "#166534",
    fontSize: 12,
    fontWeight: "800",
  },
  acceptedSubtext: {
    color: "#15803D",
    fontSize: 11,
  },
  secondaryAction: {
    backgroundColor: "#1D4ED8",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  secondaryActionText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  idText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
  },
  status: {
    fontSize: 12,
    color: "#1D4ED8",
    fontWeight: "700",
  },
  itemType: {
    fontSize: 16,
    color: "#0F172A",
    fontWeight: "700",
    marginBottom: 2,
  },
  meta: {
    fontSize: 12,
    color: "#475569",
  },
  emptyBox: {
    padding: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 6,
  },
  emptyText: {
    color: "#475569",
    fontSize: 13,
    lineHeight: 18,
  },
});

export default ComplaintAlertListScreen;
