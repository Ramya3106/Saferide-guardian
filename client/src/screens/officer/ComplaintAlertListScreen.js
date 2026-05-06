import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PriorityBadgeList } from "../../components/PriorityBadge";

const PRIORITY_ORDER = {
  Critical: 0,
  High: 1,
  Normal: 2,
  Low: 3,
};

const BlinkingAlertCard = ({ alert, selected, onPress, onAccept, onOpenReply, theme }) => {
  const blinkAnim = useRef(new Animated.Value(0)).current;
  const shouldBlink = ["Submitted", "Reported", "Staff Notified", "Seen"].includes(alert.status) || ["High", "Critical"].includes(alert.priority);
  const isAccepted = ["Accepted", "Acknowledged"].includes(alert.status) || Boolean(alert.acceptedAt || alert.acceptedBy);
  const acceptedBy = alert.acceptedBy || alert.assignedOfficerName || alert.staffName || alert.acceptedByName || "Assigned officer";
  const trainName = alert.trainName || alert.vehicleNumber || "Bharat Express 12345";
  const coachLabel = alert.coach || "B2";
  const seatLabel = alert.seat || "18";
  const boardingStation = alert.boardingStation || "New Delhi (NDLS)";
  const destinationStation = alert.destinationStation || "Howrah (HWH)";

  useEffect(() => {
    if (!shouldBlink) {
      blinkAnim.stopAnimation();
      blinkAnim.setValue(0);
      return undefined;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(blinkAnim, { toValue: 0, duration: 750, useNativeDriver: true }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [blinkAnim, shouldBlink]);

  const cardOpacity = shouldBlink
    ? blinkAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.62, 1],
      })
    : 1;

  return (
    <Animated.View style={{ opacity: cardOpacity }}>
      <Pressable
        style={[
          styles.item,
          { backgroundColor: theme.card, borderColor: theme.border },
          selected && { borderColor: theme.accent, backgroundColor: theme.selected },
          shouldBlink && { shadowColor: theme.urgent, shadowOpacity: 0.22, shadowRadius: 12, elevation: 3 },
        ]}
        onPress={() => onPress(alert)}
      >
        <View style={styles.itemHeader}>
          <View style={styles.itemHeaderLeft}>
            <View style={[styles.roleIcon, { backgroundColor: theme.accentSoft }]}>
              <Ionicons name="shield-checkmark" size={14} color={theme.accent} />
            </View>
            <View>
              <Text style={[styles.idText, { color: theme.text }]}>{alert.id || alert.complaintId || alert._id}</Text>
              <Text style={[styles.meta, { color: theme.subtext }]} numberOfLines={1}>
                {alert.passengerName || "Passenger"} • {alert.assignedOfficerName || "Officer"}
              </Text>
            </View>
          </View>
          <View style={[styles.statusPill, { backgroundColor: theme.statusPill, borderColor: theme.border }] }>
            <Text style={[styles.status, { color: theme.accent }]}>{alert.status || "Submitted"}</Text>
          </View>
        </View>

        <Text style={[styles.itemType, { color: theme.text }]}>{alert.itemType || "Rail complaint"}</Text>
        <Text style={[styles.meta, { color: theme.subtext }]}>
          {trainName} • {coachLabel} / {seatLabel}
        </Text>
        <Text style={[styles.meta, { color: theme.subtext }]}>
          {boardingStation} → {destinationStation}
        </Text>

        <PriorityBadgeList complaint={alert} />

        <View style={[styles.detailRow, { borderColor: theme.border }]}>
          <View style={styles.detailChip}>
            <Ionicons name="train" size={12} color={theme.accent} />
            <Text style={[styles.detailChipText, { color: theme.text }]}>{trainName}</Text>
          </View>
          <View style={styles.detailChip}>
            <Ionicons name="layers" size={12} color={theme.accent} />
            <Text style={[styles.detailChipText, { color: theme.text }]}>{coachLabel} / {seatLabel}</Text>
          </View>
        </View>

        {alert.priorityReason ? (
          <Text style={[styles.reasonText, { color: theme.subtext }]} numberOfLines={2}>
            {alert.priorityReason}
          </Text>
        ) : null}

        {isAccepted ? (
          <View style={[styles.acceptedBox, { backgroundColor: theme.successSoft, borderColor: theme.successBorder }]}>
            <Text style={[styles.acceptedText, { color: theme.successText }]}>Accepted by {acceptedBy}</Text>
            <Text style={[styles.acceptedSubtext, { color: theme.successSubtext }]}>Card locked to the assigned officer.</Text>
            <View style={styles.actionRow}>
              <Pressable style={[styles.secondaryAction, { backgroundColor: theme.accent }]} onPress={() => onOpenReply?.(alert)}>
                <Text style={styles.secondaryActionText}>Reply / Status</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.actionRow}>
            <Pressable style={[styles.acceptAction, { backgroundColor: theme.success }]} onPress={() => onAccept?.(alert)}>
              <Text style={styles.acceptActionText}>Accept</Text>
            </Pressable>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
};

const ComplaintAlertListScreen = ({ alerts, selectedId, onSelect, onAccept, onOpenReply }) => {
  const colorScheme = useColorScheme();

  const theme = useMemo(() => {
    const isDark = colorScheme === "dark";
    return {
      isDark,
      screen: isDark ? "#07111F" : "#EAF1F7",
      card: isDark ? "#0D1726" : "#FFFFFF",
      border: isDark ? "#22314A" : "#D7E1EC",
      text: isDark ? "#EAF2FF" : "#0F172A",
      subtext: isDark ? "#9FB2CC" : "#52637A",
      accent: "#2563EB",
      accentSoft: isDark ? "#112A4A" : "#DBEAFE",
      selected: isDark ? "#111C2D" : "#EFF6FF",
      urgent: "#EF4444",
      statusPill: isDark ? "#122033" : "#F8FBFF",
      success: "#16A34A",
      successSoft: isDark ? "#0E2518" : "#F0FDF4",
      successBorder: isDark ? "#14532D" : "#86EFAC",
      successText: isDark ? "#86EFAC" : "#166534",
      successSubtext: isDark ? "#4ADE80" : "#15803D",
    };
  }, [colorScheme]);

  const sortedAlerts = useMemo(() => {
    return [...alerts].sort((left, right) => {
      const priorityDiff = (PRIORITY_ORDER[left.priority] ?? 2) - (PRIORITY_ORDER[right.priority] ?? 2);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      return new Date(right.createdAt || right.updatedAt || 0) - new Date(left.createdAt || left.updatedAt || 0);
    });
  }, [alerts]);

  return (
    <View style={[styles.container, { backgroundColor: theme.screen }]}>
      <View style={[styles.header, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View>
          <Text style={[styles.title, { color: theme.text }]}>Complaint Alert List</Text>
          <Text style={[styles.subtitle, { color: theme.subtext }]}>Rail security operations board</Text>
        </View>
        <View style={[styles.headerPill, { backgroundColor: theme.statusPill, borderColor: theme.border }]}>
          <Ionicons name="warning" size={12} color={theme.urgent} />
          <Text style={[styles.headerPillText, { color: theme.text }]}>{sortedAlerts.length} active</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {sortedAlerts.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Ionicons name="file-tray-outline" size={30} color={theme.accent} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No Complaints Assigned</Text>
            <Text style={[styles.emptyText, { color: theme.subtext }]}>You do not have any complaints assigned yet. Check back later or contact your supervisor for new assignments.</Text>
          </View>
        ) : (
          sortedAlerts.map((alert) => {
            const selected = selectedId === alert.id;
            return (
              <BlinkingAlertCard
                key={alert.id}
                alert={alert}
                selected={selected}
                onPress={onSelect}
                onAccept={onAccept}
                onOpenReply={onOpenReply}
                theme={theme}
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
    flex: 1,
    gap: 10,
  },
  header: {
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  headerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  headerPillText: {
    fontSize: 11,
    fontWeight: "800",
  },
  list: {
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 18,
  },
  item: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1,
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  itemHeaderLeft: {
    flex: 1,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  roleIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  idText: {
    fontSize: 13,
    fontWeight: "800",
  },
  statusPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  status: {
    fontSize: 11,
    fontWeight: "800",
  },
  itemType: {
    fontSize: 16,
    fontWeight: "800",
  },
  meta: {
    fontSize: 12,
    lineHeight: 17,
  },
  detailRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingTop: 6,
    borderTopWidth: 1,
  },
  detailChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.28)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  detailChipText: {
    fontSize: 11,
    fontWeight: "700",
  },
  reasonText: {
    fontSize: 11,
    lineHeight: 16,
  },
  actionRow: {
    marginTop: 2,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  acceptAction: {
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
    marginTop: 4,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    gap: 3,
  },
  acceptedText: {
    fontSize: 12,
    fontWeight: "800",
  },
  acceptedSubtext: {
    fontSize: 11,
  },
  secondaryAction: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  secondaryActionText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  emptyBox: {
    padding: 16,
    borderWidth: 1,
    borderRadius: 18,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
});

export default ComplaintAlertListScreen;
