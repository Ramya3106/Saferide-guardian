import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  useColorScheme,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PriorityBadgeList } from "../components/PriorityBadge";
import { sendPassengerMessage } from "../services/complaintService";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const PassengerMessageThread = ({ complaint, userEmail, onMessageSent = () => {} }) => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const scrollViewRef = useRef(null);
  const colorScheme = useColorScheme();

  const theme = useMemo(() => {
    const isDark = colorScheme === "dark";
    return {
      isDark,
      screen: isDark ? "#08111E" : "#EAF1F7",
      card: isDark ? "#0D1726" : "#FFFFFF",
      border: isDark ? "#22314A" : "#D7E1EC",
      text: isDark ? "#EAF2FF" : "#0F172A",
      subtext: isDark ? "#9FB2CC" : "#52637A",
      accent: "#2563EB",
      accentSoft: isDark ? "#112A4A" : "#DBEAFE",
      passengerBubble: isDark ? "#1C3A6B" : "#2563EB",
      officerBubble: isDark ? "#10223C" : "#EFF6FF",
      officerBorder: isDark ? "#27415E" : "#BFDBFE",
      input: isDark ? "#0F1B2D" : "#F8FAFC",
      inputBorder: isDark ? "#243248" : "#D7E1EC",
      success: "#10B981",
      danger: "#EF4444",
      warning: "#F59E0B",
      chip: isDark ? "#122034" : "#EDF4FB",
      chipBorder: isDark ? "#28405D" : "#D8E4EF",
    };
  }, [colorScheme]);

  const visibleMessages = useMemo(() => {
    const allMessages = [];

    if (complaint?.messages && Array.isArray(complaint.messages)) {
      complaint.messages.forEach((entry) => {
        if (entry.isInternalNote) {
          return;
        }
        allMessages.push({
          id: `timeline-${entry.timestamp}`,
          type: "timeline",
          sender: entry.staffName || "Officer",
          senderRole: entry.staffRole || "Rail security officer",
          text: entry.text,
          timestamp: entry.timestamp,
          isOfficer: true,
        });
      });
    }

    return allMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }, [complaint]);

  useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMessages(visibleMessages);
    setIsLoading(false);
  }, [visibleMessages]);

  useEffect(() => {
    const timer = setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 80);
    return () => clearTimeout(timer);
  }, [messages]);

  const formatTime = (timestamp) => {
    if (!timestamp) return "Just now";
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    return date.toLocaleString();
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) {
      return;
    }

    const messageText = inputText.trim();
    setInputText("");
    setIsSending(true);

    const optimisticId = `passenger-${Date.now()}`;
    const optimisticMessage = {
      id: optimisticId,
      type: "passenger",
      sender: "You",
      senderRole: "Passenger",
      text: messageText,
      timestamp: new Date(),
      isOfficer: false,
    };

    try {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setMessages((prev) => [...prev, optimisticMessage]);

      const result = await sendPassengerMessage(complaint._id, messageText, {
        "X-User-Email": userEmail,
        "X-User-Role": "Passenger",
      });

      if (result) {
        onMessageSent();
      } else {
        console.error("Failed to send message");
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setMessages((prev) => prev.filter((message) => message.id !== optimisticId));
      }
    } catch (error) {
      console.error("Error sending message:", error);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setMessages((prev) => prev.filter((message) => message.id !== optimisticId));
    } finally {
      setIsSending(false);
    }
  };

  const trainName = complaint?.trainName || complaint?.vehicleNumber || "Rajdhani Express 12301";
  const coachLabel = complaint?.coach || "B2";
  const seatLabel = complaint?.seat || "18";
  const routeText = complaint?.route || `${complaint?.boardingStation || "NDLS"} → ${complaint?.destinationStation || "CSMT"}`;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.screen }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={80}
    >
      <View style={[styles.header, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.headerTopRow}>
          <View style={[styles.headerIcon, { backgroundColor: theme.accentSoft }]}>
            <Ionicons name="chatbubbles" size={18} color={theme.accent} />
          </View>
          <View style={styles.headerCopy}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Chat with Support</Text>
            <Text style={[styles.headerSubtitle, { color: theme.subtext }]}>
              {complaint?.staffName ? `Officer: ${complaint.staffName}` : "Waiting for officer assignment..."}
            </Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: theme.chip, borderColor: theme.chipBorder }]}>
            <Ionicons name="shield-checkmark" size={12} color={theme.accent} />
            <Text style={[styles.statusPillText, { color: theme.text }]}>Rail desk</Text>
          </View>
        </View>

        <View style={[styles.routePanel, { backgroundColor: theme.isDark ? "#0B1220" : "#10233F" }]}>
          <View style={styles.routePanelTop}>
            <Text style={styles.routePanelTitle}>{trainName}</Text>
            <Text style={styles.routePanelMeta}>Coach {coachLabel} / Seat {seatLabel}</Text>
          </View>
          <Text style={styles.routePanelRoute}>{routeText}</Text>
          <PriorityBadgeList complaint={complaint} />
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={messages.length === 0 ? styles.messagesEmptyContent : styles.messagesContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: false })}
      >
        {isLoading ? (
          <ActivityIndicator size="large" color={theme.accent} style={styles.loader} />
        ) : messages.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Ionicons name="chatbubbles-outline" size={48} color={theme.subtext} />
            <Text style={[styles.emptyText, { color: theme.text }]}>No messages yet</Text>
            <Text style={[styles.emptySubtext, { color: theme.subtext }]}>Officer will respond to your complaint shortly</Text>
          </View>
        ) : (
          messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.messageWrapper,
                message.isOfficer ? styles.officerMessageWrapper : styles.passengerMessageWrapper,
              ]}
            >
              {message.isOfficer ? (
                <View style={[styles.officerAvatar, { backgroundColor: theme.accent }]}>
                  <Ionicons name="shield-checkmark" size={18} color="#FFFFFF" />
                </View>
              ) : null}

              <View
                style={[
                  styles.messageBubble,
                  {
                    backgroundColor: message.isOfficer ? theme.officerBubble : theme.passengerBubble,
                    borderColor: message.isOfficer ? theme.officerBorder : theme.passengerBubble,
                  },
                  message.isOfficer ? styles.officerBubbleAlign : styles.passengerBubbleAlign,
                ]}
              >
                <Text style={[styles.senderName, message.isOfficer ? styles.officerName : styles.passengerName]}>
                  {message.sender}
                </Text>

                {message.senderRole && message.isOfficer ? (
                  <Text style={styles.senderRole}>{message.senderRole}</Text>
                ) : null}

                <Text style={[styles.messageText, message.isOfficer ? styles.officerText : styles.passengerText]}>
                  {message.text}
                </Text>

                <Text style={[styles.timestamp, message.isOfficer ? styles.officerTimestamp : styles.passengerTimestamp]}>
                  {formatTime(message.timestamp)}
                </Text>
              </View>

              {!message.isOfficer ? (
                <View style={[styles.passengerAvatar, { backgroundColor: theme.subtext }]}>
                  <Ionicons name="person" size={18} color="#FFFFFF" />
                </View>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>

      {complaint?.status !== "Closed" ? (
        <View style={[styles.inputContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <TextInput
            style={[styles.input, { backgroundColor: theme.input, borderColor: theme.inputBorder, color: theme.text }]}
            placeholder="Type your message..."
            placeholderTextColor={theme.subtext}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
            editable={!isSending}
          />

          <Pressable
            style={[styles.sendButton, { backgroundColor: theme.accent }, isSending && styles.sendButtonDisabled]}
            onPress={handleSendMessage}
            disabled={isSending || !inputText.trim()}
          >
            {isSending ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="send" size={18} color="#FFFFFF" />}
          </Pressable>
        </View>
      ) : (
        <View style={styles.closedNotice}>
          <Ionicons name="lock-closed" size={16} color={theme.danger} />
          <Text style={[styles.closedText, { color: theme.danger }]}>This complaint has been closed</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  headerSubtitle: {
    fontSize: 12,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "800",
  },
  routePanel: {
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  routePanelTop: {
    gap: 2,
  },
  routePanelTitle: {
    color: "#F8FAFC",
    fontSize: 15,
    fontWeight: "800",
  },
  routePanelMeta: {
    color: "#DBEAFE",
    fontSize: 12,
  },
  routePanelRoute: {
    color: "#CBD5E1",
    fontSize: 12,
    lineHeight: 17,
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  messagesContent: {
    paddingBottom: 12,
  },
  messagesEmptyContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingBottom: 18,
  },
  loader: {
    marginTop: 32,
  },
  emptyState: {
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 34,
    paddingHorizontal: 18,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "800",
  },
  emptySubtext: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 260,
  },
  messageWrapper: {
    flexDirection: "row",
    marginVertical: 8,
    alignItems: "flex-end",
    gap: 8,
  },
  officerMessageWrapper: {
    justifyContent: "flex-start",
  },
  passengerMessageWrapper: {
    justifyContent: "flex-end",
  },
  officerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  passengerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  messageBubble: {
    maxWidth: "78%",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    gap: 2,
  },
  officerBubbleAlign: {
    borderTopLeftRadius: 4,
  },
  passengerBubbleAlign: {
    borderTopRightRadius: 4,
  },
  senderName: {
    fontSize: 12,
    fontWeight: "800",
  },
  officerName: {
    color: "#1D4ED8",
  },
  passengerName: {
    color: "#FFFFFF",
  },
  senderRole: {
    fontSize: 10,
    color: "#64748B",
    fontWeight: "600",
  },
  messageText: {
    fontSize: 13,
    lineHeight: 18,
  },
  officerText: {
    color: "#0F172A",
  },
  passengerText: {
    color: "#FFFFFF",
  },
  timestamp: {
    fontSize: 10,
    marginTop: 4,
  },
  officerTimestamp: {
    color: "#94A3B8",
  },
  passengerTimestamp: {
    color: "#E0F2FE",
  },
  inputContainer: {
    flexDirection: "row",
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    alignItems: "flex-end",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    maxHeight: 110,
    fontSize: 13,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    opacity: 0.55,
  },
  closedNotice: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#FECACA",
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEE2E2",
  },
  closedText: {
    fontSize: 12,
    fontWeight: "700",
  },
});

export default PassengerMessageThread;
