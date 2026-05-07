import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  UIManager,
  useColorScheme,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { PriorityBadgeList } from "../components/PriorityBadge";
import { Audio } from "expo-av";
import axios from "axios";
import { getApiBase } from "../../apiConfig";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const PassengerMessageThread = ({ complaint, userEmail, onMessageSent = () => {} }) => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [locationData, setLocationData] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const scrollViewRef = useRef(null);
  const recordingRef = useRef(null);
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
          attachmentUrl: entry.attachmentUrl || null,
          messageType: entry.messageType || "text",
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

  const loadLocationData = useCallback(async () => {
    if (!complaint?._id) {
      setLocationData(null);
      return;
    }

    setLocationLoading(true);
    try {
      const API_BASE = getApiBase();
      const response = await axios.get(`${API_BASE}/complaints/${complaint._id}/location`, {
        headers: {
          "x-user-email": userEmail,
          "x-user-role": "Passenger",
        },
      });
      setLocationData(response.data?.data || response.data || null);
    } catch {
      setLocationData(null);
    } finally {
      setLocationLoading(false);
    }
  }, [complaint?._id, userEmail]);

  useEffect(() => {
    loadLocationData();
    const timer = setInterval(loadLocationData, 20000);
    return () => clearInterval(timer);
  }, [loadLocationData]);

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
    if (!inputText.trim() && !attachment) {
      return;
    }

    const messageText = inputText.trim();
    const localAttachment = attachment;
    setInputText("");
    setIsSending(true);

    const optimisticId = `passenger-${Date.now()}`;
    const optimisticMessage = {
      id: optimisticId,
      type: "passenger",
      sender: "You",
      senderRole: "Passenger",
      text: messageText,
      attachmentUrl: localAttachment?.uri || null,
      messageType: localAttachment?.type || "text",
      timestamp: new Date(),
      isOfficer: false,
    };

    try {
      let attachmentUrl = null;
      let messageType = localAttachment?.type || "text";

      if (localAttachment?.uri) {
        const API_BASE = getApiBase();
        const formData = new FormData();
        formData.append("file", {
          uri: localAttachment.uri,
          name: localAttachment.name || (localAttachment.type === "voice" ? "voice-note.m4a" : "complaint-attachment.jpg"),
          type: localAttachment.mimeType || (localAttachment.type === "voice" ? "audio/m4a" : "image/jpeg"),
        });

        const uploadResponse = await axios.post(`${API_BASE}/uploads`, formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          timeout: 30000,
        });

        attachmentUrl = uploadResponse.data?.url || uploadResponse.data?.data?.url || null;
        if (!attachmentUrl) {
          throw new Error("Attachment upload failed");
        }
      }

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setMessages((prev) => [...prev, optimisticMessage]);

      const API_BASE = getApiBase();
      const response = await axios.post(
        `${API_BASE}/passenger/messages/${complaint._id}`,
        {
          text: messageText,
          attachmentUrl,
          messageType,
          senderName: userEmail,
        },
        {
          headers: {
            "x-user-email": userEmail,
            "x-user-role": "Passenger",
          },
        }
      );
      const result = response.data;

      if (result) {
        setAttachment(null);
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

  const pickImage = async (source) => {
    try {
      const permission = source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert("Permission needed", "Allow photo access to attach an image.");
        return;
      }

      const pickerResult = source === "camera"
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.8 });

      if (!pickerResult.canceled && pickerResult.assets?.[0]?.uri) {
        const asset = pickerResult.assets[0];
        setAttachment({
          uri: asset.uri,
          type: "image",
          name: asset.fileName || `attachment-${Date.now()}.jpg`,
          mimeType: asset.mimeType || "image/jpeg",
        });
      }
    } catch (error) {
      Alert.alert("Attachment failed", "Unable to select image right now.");
    }
  };

  const startVoiceRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission needed", "Allow microphone access to send a voice note.");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        staysActiveInBackground: false,
      });

      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setIsRecording(true);
    } catch (error) {
      Alert.alert("Recording failed", "Unable to start voice recording.");
    }
  };

  const stopVoiceRecording = async () => {
    try {
      const recording = recordingRef.current;
      if (!recording) {
        return;
      }

      setIsRecording(false);
      recordingRef.current = null;
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      const uri = recording.getURI();
      if (uri) {
        setAttachment({
          uri,
          type: "voice",
          name: `voice-note-${Date.now()}.m4a`,
          mimeType: "audio/m4a",
        });
      }
    } catch (error) {
      setIsRecording(false);
      recordingRef.current = null;
      Alert.alert("Recording failed", "Unable to stop recording.");
    }
  };

  const clearAttachment = () => {
    setAttachment(null);
  };

  const trainName = complaint?.trainName || complaint?.vehicleNumber || "Rajdhani Express 12301";
  const coachLabel = complaint?.coach || "B2";
  const seatLabel = complaint?.seat || "18";
  const routeText = complaint?.route || `${complaint?.boardingStation || "NDLS"} -> ${complaint?.destinationStation || "CSMT"}`;
  const bestEstimate = Array.isArray(locationData?.estimates) ? locationData.estimates.find((item) => item?.etaMin != null) : null;
  const officerLocations = Array.isArray(locationData?.officerLocations) ? locationData.officerLocations : [];

  return (
    <KeyboardAvoidingView
      className="flex-1"
      style={{ backgroundColor: theme.screen }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={80}
    >
      <View className="mx-3 mt-3 rounded-[18px] border p-3.5 gap-3" style={{ backgroundColor: theme.card, borderColor: theme.border }}>
        <View className="flex-row items-center gap-2.5">
          <View className="w-10 h-10 rounded-2xl justify-center items-center" style={{ backgroundColor: theme.accentSoft }}>
            <Ionicons name="chatbubbles" size={18} color={theme.accent} />
          </View>
          <View className="flex-1 gap-0.5">
            <Text className="text-[17px] font-extrabold" style={{ color: theme.text }}>Chat with Support</Text>
            <Text className="text-xs" style={{ color: theme.subtext }}>
              {complaint?.staffName ? `Officer: ${complaint.staffName}` : "Waiting for officer assignment..."}
            </Text>
          </View>
          <View className="flex-row items-center gap-1.5 rounded-full border px-2.5 py-1.5" style={{ backgroundColor: theme.chip, borderColor: theme.chipBorder }}>
            <Ionicons name="shield-checkmark" size={12} color={theme.accent} />
            <Text className="text-[11px] font-extrabold" style={{ color: theme.text }}>Rail desk</Text>
          </View>
        </View>

        <View className="rounded-2xl p-3.5 gap-2" style={{ backgroundColor: theme.isDark ? "#0B1220" : "#10233F" }}>
          <View className="gap-0.5">
            <Text className="text-[#F8FAFC] text-[15px] font-extrabold">{trainName}</Text>
            <Text className="text-[#DBEAFE] text-xs">Coach {coachLabel} / Seat {seatLabel}</Text>
          </View>
          <Text className="text-[#CBD5E1] text-xs leading-snug">{routeText}</Text>
          <PriorityBadgeList complaint={complaint} />
        </View>

        {attachment ? (
          <View className="rounded-2xl border px-3 py-2.5 gap-2" style={{ backgroundColor: theme.input, borderColor: theme.border }}>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Ionicons name={attachment.type === "voice" ? "mic" : "image"} size={16} color={theme.accent} />
                <Text className="text-[13px] font-bold" style={{ color: theme.text }}>
                  {attachment.type === "voice" ? "Voice note ready" : "Image attached"}
                </Text>
              </View>
              <Pressable onPress={clearAttachment}>
                <Text className="text-[12px] font-semibold" style={{ color: theme.danger }}>Remove</Text>
              </Pressable>
            </View>

            {attachment.type === "image" ? (
              <Image source={{ uri: attachment.uri }} style={{ width: "100%", height: 180, borderRadius: 14 }} resizeMode="cover" />
            ) : (
              <View className="flex-row items-center gap-3 rounded-2xl px-3 py-3" style={{ backgroundColor: theme.card }}>
                <View className="w-11 h-11 rounded-2xl items-center justify-center" style={{ backgroundColor: theme.accentSoft }}>
                  <Ionicons name="mic" size={22} color={theme.accent} />
                </View>
                <View className="flex-1">
                  <Text className="text-[13px] font-bold" style={{ color: theme.text }}>Voice note captured</Text>
                  <Text className="text-[11px]" style={{ color: theme.subtext }}>It will be uploaded when you send the message.</Text>
                </View>
              </View>
            )}
          </View>
        ) : null}

        <View className="mx-3 mt-2 rounded-[18px] border p-3.5 gap-2" style={{ backgroundColor: theme.card, borderColor: theme.border }}>
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Ionicons name="locate" size={16} color={theme.accent} />
              <Text className="text-[15px] font-extrabold" style={{ color: theme.text }}>Live Officer Location</Text>
            </View>
            <Text className="text-[11px] font-semibold" style={{ color: theme.subtext }}>
              {locationLoading ? "Updating..." : "Auto refresh"}
            </Text>
          </View>

          {bestEstimate ? (
            <View className="rounded-2xl px-3 py-2.5" style={{ backgroundColor: theme.accentSoft }}>
              <Text className="text-[12px] font-bold" style={{ color: theme.text }}>
                Nearest officer ETA: {bestEstimate.etaMin != null ? `${bestEstimate.etaMin} min` : "Pending"}
              </Text>
              <Text className="text-[11px] mt-0.5" style={{ color: theme.subtext }}>
                Distance: {bestEstimate.distanceKm != null ? `${bestEstimate.distanceKm.toFixed(1)} km` : "Unknown"}
              </Text>
            </View>
          ) : (
            <Text className="text-[12px]" style={{ color: theme.subtext }}>
              No live officer location yet. Once an on-duty railway authority accepts the complaint, tracking will appear here.
            </Text>
          )}

          {officerLocations.length > 0 ? (
            <View className="gap-2 pt-1">
              {officerLocations.slice(0, 3).map((item, index) => (
                <View key={`${item.officerKey || index}-${item.recordedAt || index}`} className="flex-row items-center justify-between rounded-2xl px-3 py-2" style={{ backgroundColor: theme.input }}>
                  <View>
                    <Text className="text-[12px] font-bold" style={{ color: theme.text }}>
                      Officer {index + 1}
                    </Text>
                    <Text className="text-[11px]" style={{ color: theme.subtext }}>
                      {item.latitude?.toFixed ? item.latitude.toFixed(4) : item.latitude}, {item.longitude?.toFixed ? item.longitude.toFixed(4) : item.longitude}
                    </Text>
                  </View>
                  <Text className="text-[11px] font-semibold" style={{ color: theme.accent }}>
                    {item.etaMin != null ? `${item.etaMin} min` : "Tracking"}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        className="flex-1 px-3 pt-3"
        contentContainerStyle={messages.length === 0 ? { flexGrow: 1, justifyContent: "center", paddingBottom: 18 } : { paddingBottom: 12 }}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: false })}
      >
        {isLoading ? (
          <ActivityIndicator size="large" color={theme.accent} className="mt-8" />
        ) : messages.length === 0 ? (
          <View className="rounded-[18px] border py-8 px-4.5 justify-center items-center gap-2.5" style={{ backgroundColor: theme.card, borderColor: theme.border }}>
            <Ionicons name="chatbubbles-outline" size={48} color={theme.subtext} />
            <Text className="text-base font-extrabold" style={{ color: theme.text }}>No messages yet</Text>
            <Text className="text-xs text-center leading-relaxed max-w-[260px]" style={{ color: theme.subtext }}>Officer will respond to your complaint shortly</Text>
          </View>
        ) : (
          messages.map((message) => (
            <View
              key={message.id}
              className={`flex-row my-2 items-end gap-2 ${message.isOfficer ? 'justify-start' : 'justify-end'}`}
            >
              {message.isOfficer ? (
                <View className="w-8 h-8 rounded-2xl justify-center items-center" style={{ backgroundColor: theme.accent }}>
                  <Ionicons name="shield-checkmark" size={18} color="#FFFFFF" />
                </View>
              ) : null}

              <View
                className={`max-w-[78%] px-3 py-2.5 rounded-2xl border gap-0.5 ${message.isOfficer ? 'rounded-tl-sm' : 'rounded-tr-sm'}`}
                style={{
                  backgroundColor: message.isOfficer ? theme.officerBubble : theme.passengerBubble,
                  borderColor: message.isOfficer ? theme.officerBorder : theme.passengerBubble,
                }}
              >
                <Text className={`text-xs font-extrabold ${message.isOfficer ? 'text-blue-700' : 'text-white'}`}>
                  {message.sender}
                </Text>

                {message.senderRole && message.isOfficer ? (
                  <Text className="text-[10px] text-slate-500 font-semibold">{message.senderRole}</Text>
                ) : null}

                <Text className={`text-[13px] leading-snug ${message.isOfficer ? 'text-slate-900' : 'text-white'}`}>
                  {message.text}
                </Text>

                {message.attachmentUrl ? (
                  message.messageType === "image" ? (
                    <Image
                      source={{ uri: message.attachmentUrl }}
                      className="w-full h-40 rounded-xl mt-2"
                      resizeMode="cover"
                    />
                  ) : (
                    <View className="flex-row items-center gap-2 rounded-xl px-3 py-2 mt-2" style={{ backgroundColor: message.isOfficer ? theme.chip : "rgba(255,255,255,0.12)" }}>
                      <Ionicons name="mic" size={14} color={message.isOfficer ? theme.text : "#FFFFFF"} />
                      <Text className={`text-[11px] font-semibold ${message.isOfficer ? "text-slate-700" : "text-white"}`}>
                        Voice note attached
                      </Text>
                    </View>
                  )
                ) : null}

                <Text className={`text-[10px] mt-1 ${message.isOfficer ? 'text-slate-400' : 'text-blue-100'}`}>
                  {formatTime(message.timestamp)}
                </Text>
              </View>

              {!message.isOfficer ? (
                <View className="w-8 h-8 rounded-2xl justify-center items-center" style={{ backgroundColor: theme.subtext }}>
                  <Ionicons name="person" size={18} color="#FFFFFF" />
                </View>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>

      {complaint?.status !== "Closed" ? (
        <View className="border-t px-3 py-2.5 gap-2" style={{ backgroundColor: theme.card, borderColor: theme.border }}>
          <View className="flex-row gap-2 items-end">
            <TextInput
              className="flex-1 border rounded-[14px] px-3 py-2.5 max-h-[110px] text-[13px]"
              style={{ backgroundColor: theme.input, borderColor: theme.inputBorder, color: theme.text }}
              placeholder="Type your message..."
              placeholderTextColor={theme.subtext}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
              editable={!isSending}
            />

            <Pressable
              className={`w-[42px] h-[42px] rounded-[14px] justify-center items-center ${isSending ? 'opacity-55' : ''}`}
              style={{ backgroundColor: theme.accent }}
              onPress={handleSendMessage}
              disabled={isSending || (!inputText.trim() && !attachment)}
            >
              {isSending ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="send" size={18} color="#FFFFFF" />}
            </Pressable>
          </View>

          <View className="flex-row flex-wrap items-center gap-2">
            <Pressable className="flex-row items-center gap-1.5 rounded-full px-3 py-2" style={{ backgroundColor: theme.accentSoft }} onPress={() => pickImage("gallery")}>
              <Ionicons name="image" size={14} color={theme.accent} />
              <Text className="text-[11px] font-semibold" style={{ color: theme.accent }}>Gallery</Text>
            </Pressable>

            <Pressable className="flex-row items-center gap-1.5 rounded-full px-3 py-2" style={{ backgroundColor: theme.accentSoft }} onPress={() => pickImage("camera")}>
              <Ionicons name="camera" size={14} color={theme.accent} />
              <Text className="text-[11px] font-semibold" style={{ color: theme.accent }}>Camera</Text>
            </Pressable>

            <Pressable
              className="flex-row items-center gap-1.5 rounded-full px-3 py-2"
              style={{ backgroundColor: isRecording ? theme.danger : theme.accentSoft }}
              onPress={isRecording ? stopVoiceRecording : startVoiceRecording}
            >
              <Ionicons name={isRecording ? "stop" : "mic"} size={14} color={isRecording ? "#FFFFFF" : theme.accent} />
              <Text className="text-[11px] font-semibold" style={{ color: isRecording ? "#FFFFFF" : theme.accent }}>
                {isRecording ? "Stop" : "Voice"}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View className="flex-row border-t px-4 py-3 justify-center items-center gap-2 bg-red-100 border-red-200">
          <Ionicons name="lock-closed" size={16} color={theme.danger} />
          <Text className="text-xs font-bold" style={{ color: theme.danger }}>This complaint has been closed</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

export default PassengerMessageThread;
