import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Pressable, ScrollView, Text, useColorScheme, View } from "react-native";
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
        className={`rounded-2xl p-3.5 gap-2.5 shadow-sm ${selected ? 'border-[1.5px] bg-blue-50/50' : 'border-0 bg-white'}`}
        style={[
          { backgroundColor: theme.card },
          selected && { borderColor: theme.accent, backgroundColor: theme.selected },
          shouldBlink && { shadowColor: theme.urgent, shadowOpacity: 0.22, shadowRadius: 12, elevation: 3 },
        ]}
        onPress={() => onPress(alert)}
      >
        <View className="flex-row justify-between items-start gap-2.5">
          <View className="flex-1 flex-row gap-2.5 items-center">
            <View className="w-8 h-8 rounded-xl justify-center items-center" style={{ backgroundColor: theme.accentSoft }}>
              <Ionicons name="shield-checkmark" size={14} color={theme.accent} />
            </View>
            <View className="flex-1">
              <Text className="text-[13px] font-extrabold" style={{ color: theme.text }}>{alert.id || alert.complaintId || alert._id}</Text>
              <Text className="text-xs" style={{ color: theme.subtext }} numberOfLines={1}>
                {alert.passengerName || "Passenger"} • {alert.assignedOfficerName || "Officer"}
              </Text>
            </View>
          </View>
          <View className="rounded-full border px-2.5 py-1.5" style={{ backgroundColor: theme.statusPill, borderColor: theme.border }}>
            <Text className="text-[11px] font-extrabold" style={{ color: theme.accent }}>{alert.status || "Submitted"}</Text>
          </View>
        </View>

        <Text className="text-base font-extrabold" style={{ color: theme.text }}>{alert.itemType || "Rail complaint"}</Text>
        <Text className="text-xs" style={{ color: theme.subtext }}>
          {trainName} • {coachLabel} / {seatLabel}
        </Text>
        <Text className="text-xs" style={{ color: theme.subtext }}>
          {boardingStation} → {destinationStation}
        </Text>

        <PriorityBadgeList complaint={alert} />

        <View className="flex-row flex-wrap gap-2 pt-1.5 border-t" style={{ borderColor: theme.border }}>
          <View className="flex-row items-center gap-1.5 rounded-full border px-2.5 py-1.5 border-slate-300/30">
            <Ionicons name="train" size={12} color={theme.accent} />
            <Text className="text-[11px] font-bold" style={{ color: theme.text }}>{trainName}</Text>
          </View>
          <View className="flex-row items-center gap-1.5 rounded-full border px-2.5 py-1.5 border-slate-300/30">
            <Ionicons name="layers" size={12} color={theme.accent} />
            <Text className="text-[11px] font-bold" style={{ color: theme.text }}>{coachLabel} / {seatLabel}</Text>
          </View>
        </View>

        {alert.priorityReason ? (
          <Text className="text-[11px] leading-snug" style={{ color: theme.subtext }} numberOfLines={2}>
            {alert.priorityReason}
          </Text>
        ) : null}

        {isAccepted ? (
          <View className="mt-1 p-2.5 rounded-xl border gap-1" style={{ backgroundColor: theme.successSoft, borderColor: theme.successBorder }}>
            <Text className="text-xs font-extrabold" style={{ color: theme.successText }}>Accepted by {acceptedBy}</Text>
            <Text className="text-[11px]" style={{ color: theme.successSubtext }}>Card locked to the assigned officer.</Text>
            <View className="mt-0.5 flex-row justify-end">
              <Pressable className="rounded-full px-3.5 py-2" style={{ backgroundColor: theme.accent }} onPress={() => onOpenReply?.(alert)}>
                <Text className="text-white text-xs font-extrabold">Reply / Status</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View className="mt-0.5 flex-row justify-end">
            <Pressable className="rounded-full px-3.5 py-2" style={{ backgroundColor: theme.success }} onPress={() => onAccept?.(alert)}>
              <Text className="text-white text-xs font-extrabold">Accept</Text>
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
    <View className="flex-1 gap-2.5" style={{ backgroundColor: theme.screen }}>
      <View className="mx-3 mt-3 rounded-2xl px-4 py-3.5 flex-row justify-between items-center gap-3 shadow-sm" style={{ backgroundColor: theme.card }}>
        <View>
          <Text className="text-lg font-extrabold" style={{ color: theme.text }}>Complaint Alert List</Text>
          <Text className="text-xs mt-0.5" style={{ color: theme.subtext }}>Rail security operations board</Text>
        </View>
        <View className="flex-row items-center gap-1.5 rounded-full border px-2.5 py-1.5" style={{ backgroundColor: theme.statusPill, borderColor: theme.border }}>
          <Ionicons name="warning" size={12} color={theme.urgent} />
          <Text className="text-[11px] font-extrabold" style={{ color: theme.text }}>{sortedAlerts.length} active</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ gap: 10, paddingHorizontal: 12, paddingBottom: 18 }}>
        {sortedAlerts.length === 0 ? (
          <View className="p-4 border rounded-[18px] items-center gap-2" style={{ backgroundColor: theme.card, borderColor: theme.border }}>
            <Ionicons name="file-tray-outline" size={30} color={theme.accent} />
            <Text className="text-base font-extrabold text-center" style={{ color: theme.text }}>No Complaints Assigned</Text>
            <Text className="text-[13px] leading-snug text-center" style={{ color: theme.subtext }}>You do not have any complaints assigned yet. Check back later or contact your supervisor for new assignments.</Text>
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

export default ComplaintAlertListScreen;
