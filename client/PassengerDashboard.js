import React, { useState, useEffect, useRef } from "react";
import {
  BackHandler,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Animated,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import axios from "axios";
import { getApiBase } from "./apiConfig";
import PassengerMessageThread from "./src/screens/PassengerMessageThread";
import { socketService } from "./src/services/socketService";

const API_BASE = getApiBase();
const SOCKET_BASE = API_BASE.replace(/\/api\/?$/, "");
const AnimatedIonicon = Animated.createAnimatedComponent(Ionicons);

const PassengerDashboard = ({
  userEmail,
  userName,
  userPhone,
  authToken,
  authUserRole,
  onLogout,
}) => {
  const iconShakeValue = useRef(new Animated.Value(0)).current;
  const iconShakeLoopRef = useRef(null);
  const screenFadeAnim = useRef(new Animated.Value(0)).current;
  const screenSlideAnim = useRef(new Animated.Value(18)).current;
  const notificationPulseAnim = useRef(new Animated.Value(0)).current;
  const actionBeaconAnim = useRef(new Animated.Value(0)).current;

  const [activeJourney, setActiveJourney] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [currentComplaint, setCurrentComplaint] = useState(null);
  const [gpsEnabled, setGpsEnabled] = useState(true);
  const [showComplaintModal, setShowComplaintModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [selectedTrackingComplaint, setSelectedTrackingComplaint] = useState(null);
  const [trackingData, setTrackingData] = useState(null);
  const [transportType, setTransportType] = useState(null);
  const [modalStep, setModalStep] = useState(1);
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [itemType, setItemType] = useState("");
  const [description, setDescription] = useState("");
  const [fromLocation, setFromLocation] = useState("");
  const [toLocation, setToLocation] = useState("");
  const [departureTime, setDepartureTime] = useState("");
  const [arrivalTime, setArrivalTime] = useState("");
  const [photoUri, setPhotoUri] = useState(null);
  const socketRef = useRef(null);

  const requestHeaders = (extra = {}) => ({
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    "X-User-Role": authUserRole || "Passenger",
    ...extra,
  });

  const getSubmitAuthority = (type) => {
    switch (type) {
      case "train":
        return "TTR / RPF";
      case "car":
        return "Car Driver";
      case "bus":
        return "Driver / Conductor";
      case "auto":
        return "Auto Driver";
      default:
        return "Staff";
    }
  };

  const getTransportIcon = (type) => {
    switch (type) {
      case "train":
        return "train";
      case "car":
        return "car";
      case "bus":
        return "bus";
      case "auto":
        return "bicycle";
      default:
        return "help";
    }
  };

  const buildIconShakeAnimation = () =>
    Animated.loop(
      Animated.sequence([
        Animated.timing(iconShakeValue, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(iconShakeValue, {
          toValue: -1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(iconShakeValue, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        }),
      ]),
    );

  const startIconShake = () => {
    if (iconShakeLoopRef.current) {
      return;
    }
    iconShakeLoopRef.current = buildIconShakeAnimation();
    iconShakeLoopRef.current.start();
  };

  const stopIconShake = () => {
    if (iconShakeLoopRef.current) {
      iconShakeLoopRef.current.stop();
      iconShakeLoopRef.current = null;
    }
    iconShakeValue.setValue(0);
  };

  useEffect(() => () => stopIconShake(), []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(screenFadeAnim, {
        toValue: 1,
        duration: 380,
        useNativeDriver: true,
      }),
      Animated.timing(screenSlideAnim, {
        toValue: 0,
        duration: 380,
        useNativeDriver: true,
      }),
    ]).start();
  }, [screenFadeAnim, screenSlideAnim]);

  useEffect(() => {
    const notificationPulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(notificationPulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(notificationPulseAnim, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    );

    const actionBeaconLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(actionBeaconAnim, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(actionBeaconAnim, {
          toValue: 0,
          duration: 1800,
          useNativeDriver: true,
        }),
      ]),
    );

    notificationPulseLoop.start();
    actionBeaconLoop.start();

    return () => {
      notificationPulseLoop.stop();
      actionBeaconLoop.stop();
    };
  }, [actionBeaconAnim, notificationPulseAnim]);

  useEffect(() => {
    fetchActiveJourney();
    fetchComplaintHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!userEmail) {
      return undefined;
    }

    const socket = socketService.connect(SOCKET_BASE, {
      transports: ["websocket"],
      reconnection: true,
      withCredentials: true,
    });

    socketRef.current = socket;

    const mergeComplaintRecord = (payload) => {
      const incomingComplaint = payload?.complaint || payload || {};
      const complaintId =
        incomingComplaint?._id ||
        incomingComplaint?.id ||
        payload?.complaintId ||
        payload?.reply?.complaintId;

      if (!complaintId) {
        return;
      }

      const normalizedPassenger = String(userEmail || "").trim().toLowerCase();
      const candidatePassenger = String(
        incomingComplaint?.passengerEmail ||
          incomingComplaint?.passengerId ||
          payload?.passengerId ||
          "",
      ).trim().toLowerCase();

      if (
        candidatePassenger &&
        normalizedPassenger &&
        candidatePassenger !== normalizedPassenger
      ) {
        return;
      }

      const mergedComplaint = {
        ...incomingComplaint,
        _id: incomingComplaint?._id || complaintId,
        complaintId: incomingComplaint?.complaintId || complaintId,
        messages: Array.isArray(incomingComplaint?.messages)
          ? incomingComplaint.messages
          : [],
      };

      setComplaints((current) => {
        const index = current.findIndex(
          (item) => String(item?._id || item?.id) === String(complaintId),
        );

        if (index === -1) {
          return [mergedComplaint, ...current];
        }

        const next = [...current];
        next[index] = {
          ...next[index],
          ...mergedComplaint,
        };
        return next;
      });

      setCurrentComplaint((current) =>
        current && String(current?._id || current?.id) === String(complaintId)
          ? { ...current, ...mergedComplaint }
          : current,
      );

      setSelectedTrackingComplaint((current) =>
        current && String(current?._id || current?.id) === String(complaintId)
          ? { ...current, ...mergedComplaint }
          : current,
      );

      setTrackingData((current) =>
        current && String(current?.complaintId || current?._id) === String(complaintId)
          ? {
              ...current,
              ...mergedComplaint,
              status: mergedComplaint.status || current.status,
            }
          : current,
      );
    };

    socket.on("complaint:new", mergeComplaintRecord);
    socket.on("complaint:accepted", mergeComplaintRecord);
    socket.on("complaint:reply", mergeComplaintRecord);
    socket.on("complaint:status-change", mergeComplaintRecord);
    socket.on("complaint:location-update", mergeComplaintRecord);
    socket.on("complaint:escalation", mergeComplaintRecord);

    socket.on("passenger:message", (payload) => {
      if (payload?.complaintId) {
        mergeComplaintRecord(payload);
      }
    });

    socket.on("connect", () => {
      socket.emit("join:passenger", userEmail);
    });

    return () => {
      socket.off("complaint:new", mergeComplaintRecord);
      socket.off("complaint:accepted", mergeComplaintRecord);
      socket.off("complaint:reply", mergeComplaintRecord);
      socket.off("complaint:status-change", mergeComplaintRecord);
      socket.off("complaint:location-update", mergeComplaintRecord);
      socket.off("complaint:escalation", mergeComplaintRecord);
      socket.off("passenger:message");
      socket.disconnect();
      socketRef.current = null;
    };
  }, [userEmail]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchComplaintHistory();
    }, 8000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail]);

  useEffect(() => {
    const onBackPress = () => {
      if (showTrackingModal) {
        setShowTrackingModal(false);
        setTrackingData(null);
        setSelectedTrackingComplaint(null);
        return true;
      }

      if (showNotificationModal) {
        setShowNotificationModal(false);
        return true;
      }

      if (showHistoryModal) {
        setShowHistoryModal(false);
        return true;
      }

      if (showComplaintModal) {
        resetComplaintModal();
        return true;
      }

      return false;
    };

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      onBackPress,
    );

    return () => subscription.remove();
  }, [showComplaintModal, showHistoryModal, showNotificationModal, showTrackingModal]);

  useEffect(() => {
    if (!showTrackingModal || !selectedTrackingComplaint?._id) {
      return undefined;
    }

    const interval = setInterval(() => {
      fetchTrackingData(selectedTrackingComplaint._id);
    }, 5000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTrackingModal, selectedTrackingComplaint?._id]);

  const fetchActiveJourney = async () => {
    try {
      const response = await axios.get(`${API_BASE}/passenger/dashboard`, {
        headers: requestHeaders({ "X-User-Email": userEmail }),
      });
      const payload = response.data?.data || response.data || {};
      setActiveJourney(payload.journey || null);
    } catch (error) {
      console.log("Error fetching journey:", error.message);
    }
  };

  const fetchComplaintHistory = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/passenger/complaints`, {
        headers: requestHeaders({ "X-User-Email": userEmail }),
      });
      const payload = response.data?.data || response.data || {};
      setComplaints(payload.complaints || []);
    } catch (error) {
      console.log("Error fetching complaints:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchTrackingData = async (complaintId) => {
    if (!complaintId) {
      return null;
    }

    setTrackingLoading(true);
    try {
      const response = await axios.get(
        `${API_BASE}/passenger/tracking/${complaintId}`,
        {
          headers: requestHeaders({ "X-User-Email": userEmail }),
        },
      );
      const payload = response.data?.data || response.data || {};
      const nextTracking = payload.tracking || null;
      setTrackingData(nextTracking);
      return nextTracking;
    } catch (error) {
      console.log("Error fetching tracking:", error.message);
      setTrackingData(null);
      return null;
    } finally {
      setTrackingLoading(false);
    }
  };

  const openDriverLiveMap = async (tracking) => {
    const lat = tracking?.staffLocation?.latitude;
    const lng = tracking?.staffLocation?.longitude;

    if (typeof lat !== "number" || typeof lng !== "number") {
      Alert.alert(
        "Live Location Pending",
        "Driver has not shared location yet. Please try again in a few seconds.",
      );
      return;
    }

    const mapUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

    try {
      const supported = await Linking.canOpenURL(mapUrl);
      if (!supported) {
        Alert.alert("Unable to Open Map", "No map app is available.");
        return;
      }

      await Linking.openURL(mapUrl);
    } catch (error) {
      Alert.alert("Unable to Open Map", "Please try again.");
    }
  };

  const handleOpenNotifications = async () => {
    await fetchComplaintHistory();
    setShowNotificationModal(true);
  };

  const handleOpenLiveTracking = async (complaint) => {
    setSelectedTrackingComplaint(complaint);
    await fetchTrackingData(complaint?._id);
    setShowTrackingModal(true);
  };

  const handleTransportSelect = (type) => {
    setTransportType(type);
    setModalStep(2);
  };

  const resetComplaintModal = () => {
    setShowComplaintModal(false);
    setModalStep(1);
    setTransportType(null);
    setVehicleNumber("");
    setItemType("");
    setDescription("");
    setFromLocation("");
    setToLocation("");
    setDepartureTime("");
    setArrivalTime("");
    setPhotoUri(null);
  };

  const pickPhoto = async (source) => {
    try {
      if (source === "camera") {
        const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
        if (!cameraPermission.granted) {
          Alert.alert(
            "Camera Permission Needed",
            "Allow camera access to capture an item photo.",
          );
          return;
        }

        const cameraResult = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.8,
        });

        if (!cameraResult.canceled && cameraResult.assets?.[0]?.uri) {
          setPhotoUri(cameraResult.assets[0].uri);
        }
        return;
      }

      const mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!mediaPermission.granted) {
        Alert.alert(
          "Gallery Permission Needed",
          "Allow photo library access to select an item photo.",
        );
        return;
      }

      const libraryResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!libraryResult.canceled && libraryResult.assets?.[0]?.uri) {
        setPhotoUri(libraryResult.assets[0].uri);
      }
    } catch (error) {
      Alert.alert("Upload Failed", "Unable to select image. Please try again.");
    }
  };

  const handleUploadItemPhoto = () => {
    Alert.alert("Upload Item Photo", "Choose image source", [
      { text: "Open Camera", onPress: () => pickPhoto("camera") },
      { text: "Choose from Gallery", onPress: () => pickPhoto("gallery") },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleCreateComplaint = async () => {
    if (!vehicleNumber.trim() || !itemType.trim() || !description.trim()) {
      Alert.alert("Validation", "Please fill in all required fields");
      return;
    }

    if (!fromLocation.trim() || !toLocation.trim()) {
      Alert.alert("Validation", "Please fill in from and to locations");
      return;
    }

    setLoading(true);
    try {
      const submitAuthority = getSubmitAuthority(transportType);
      const response = await axios.post(
        `${API_BASE}/passenger/complaints`,
        {
          transportType,
          vehicleNumber,
          itemType,
          description,
          fromLocation,
          toLocation,
          departureTime,
          arrivalTime,
          lastSeenLocation: fromLocation,
          timestamp: new Date().toISOString(),
          route: `${fromLocation} → ${toLocation}`,
          submitAuthority,
          photoUri,
        },
        {
          headers: requestHeaders({
            "X-User-Email": userEmail,
            "X-User-Name": userName,
          }),
        },
      );

      const payload = response.data?.data || response.data || {};
      const createdComplaint = payload.complaint;
      setCurrentComplaint(createdComplaint);
      setComplaints((prev) => [createdComplaint, ...prev]);
      setSelectedTrackingComplaint(createdComplaint);
      setTrackingData(null);
      setShowTrackingModal(true);
      resetComplaintModal();
      Alert.alert("Submitted", `Request submitted successfully to ${submitAuthority}!`);
    } catch (error) {
      const backendMessage = error?.response?.data?.message || error.message || "Unknown error";
      Alert.alert("Error", `Error creating complaint: ${backendMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGpsToggle = async () => {
    const nextEnabled = !gpsEnabled;
    setGpsEnabled(nextEnabled);
    try {
      await axios.post(
        `${API_BASE}/passenger/gps`,
        { enabled: nextEnabled },
        {
          headers: requestHeaders({ "X-User-Email": userEmail }),
        },
      );
    } catch (error) {
      console.log("Error updating GPS:", error.message);
    }
  };

  const acceptedComplaints = complaints.filter(
    (complaint) =>
      complaint.status === "Accepted" ||
      (typeof complaint?.sharedLocation?.latitude === "number" &&
        typeof complaint?.sharedLocation?.longitude === "number"),
  );
  const notificationCount = acceptedComplaints.length;

  const ShakyIcon = ({ style, ...props }) => (
    <Pressable onHoverIn={startIconShake} onHoverOut={stopIconShake}>
      <AnimatedIonicon
        {...props}
        style={[{ transform: [{ translateX: iconShakeValue }] }, style]}
      />
    </Pressable>
  );

  const renderHeader = () => (
    <View className="bg-white pt-3 pb-4 px-4 border-b border-slate-200 flex-row justify-between items-center">
      <View className="flex-1 flex-row justify-between items-center">
        <View>
          <Text className="text-lg font-bold text-slate-800">{userName}</Text>
          <Text className="text-xs text-slate-500 mt-1">📞 {userPhone}</Text>
        </View>
        <TouchableOpacity
          className="flex-row items-center bg-slate-100 px-2.5 py-1.5 rounded-lg gap-1"
          onPress={handleGpsToggle}
        >
          <ShakyIcon
            name={gpsEnabled ? "location" : "location-outline"}
            size={20}
            color={gpsEnabled ? "#22C55E" : "#64748B"}
          />
          <Text className="text-[11px] font-semibold text-slate-600">
            GPS {gpsEnabled ? "ON" : "OFF"}
          </Text>
        </TouchableOpacity>
      </View>

      <Animated.View
        style={{
          transform: [
            {
              scale: notificationPulseAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.06],
              }),
            },
          ],
        }}
      >
        <TouchableOpacity className="relative p-2" onPress={handleOpenNotifications}>
          <Ionicons name="notifications-outline" size={24} color="#1E293B" />
          {notificationCount > 0 && (
            <View className="absolute top-0 right-0 bg-red-500 rounded-full min-w-[20px] h-5 justify-center items-center">
              <Text className="text-white text-[10px] font-bold">{notificationCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );

  const renderActiveJourney = () => (
    <View className="mb-5">
      <Text className="text-lg font-bold text-slate-800 mb-2.5">✈️ Active Journey</Text>
      {activeJourney ? (
        <View className="bg-white rounded-xl p-3.5 border border-slate-200">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-base font-bold text-slate-800">🚌 {activeJourney.vehicleNumber}</Text>
            <Text className="bg-green-500 text-white px-2.5 py-1 rounded-xl text-[10px] font-bold">ACTIVE</Text>
          </View>
          <Text className="text-sm text-slate-600 mb-1.5">🛣️ {activeJourney.route}</Text>
          <Text className="text-[13px] text-slate-500 mb-1.5">⏰ {activeJourney.estimatedDuration || "2h 15min"}</Text>
          {activeJourney.driverName && <Text className="text-xs text-slate-400 mb-1">👨‍✈️ Driver: {activeJourney.driverName}</Text>}
          {activeJourney.conductorName && <Text className="text-xs text-slate-400 mb-1">👨‍✈️ Conductor: {activeJourney.conductorName}</Text>}
          <Text className="text-xs text-slate-400 mb-1">📍 Current: {activeJourney.currentStop}</Text>
        </View>
      ) : (
        <View className="bg-white rounded-xl p-3.5 border border-slate-200">
          <Text className="text-sm text-slate-400 text-center py-5">No active journey</Text>
        </View>
      )}
    </View>
  );

  const renderPrimaryAction = () => (
    <View className="mb-5">
      <Animated.View
        style={{
          transform: [
            {
              scale: actionBeaconAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.02],
              }),
            },
          ],
        }}
      >
        <TouchableOpacity
          className="bg-red-500 rounded-xl py-5 px-4 flex-row items-center justify-center gap-3"
          onPress={() => setShowComplaintModal(true)}
        >
          <ShakyIcon name="alert-circle" size={32} color="#FFFFFF" />
          <Text className="text-lg font-bold text-white tracking-wide">I LEFT SOMETHING</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );

  const renderComplaintPanel = () => (
    <Modal visible={showComplaintModal} transparent animationType="slide" onRequestClose={resetComplaintModal}>
      <View className="flex-1 bg-black/50 justify-end">
        <View className="bg-white rounded-t-2xl p-4 max-h-[90%]">
          <View className="flex-row justify-between items-center mb-4 pb-3 border-b border-slate-200">
            <Text className="text-lg font-bold text-slate-800">
              {modalStep === 1 ? "Report Lost Item" : `Lost Item - ${transportType?.toUpperCase()}`}
            </Text>
            <TouchableOpacity onPress={resetComplaintModal}>
              <ShakyIcon name="close" size={24} color="#1E293B" />
            </TouchableOpacity>
          </View>

          <ScrollView className="max-h-[400px]">
            {modalStep === 1 ? (
              <View>
                <Text className="text-lg font-bold text-slate-800 text-center mb-6 mt-2">
                  In which transport did you lose your item?
                </Text>
                <View className="flex-row flex-wrap justify-between gap-3 mb-5">
                  {[
                    ["train", "🚆 Train", "train"],
                    ["car", "🚗 Car", "car"],
                    ["bus", "🚌 Bus", "bus"],
                    ["auto", "🛺 Auto", "bicycle"],
                  ].map(([type, label, icon]) => (
                    <TouchableOpacity
                      key={type}
                      className="w-[48%] bg-blue-50 border-2 border-blue-200 rounded-xl py-4 px-2.5 items-center justify-center min-h-[120px]"
                      onPress={() => handleTransportSelect(type)}
                    >
                      <ShakyIcon name={icon} size={40} color="#2563EB" />
                      <Text className="mt-2.5 text-sm font-semibold text-slate-800 text-center">{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : (
              <View>
                <TouchableOpacity className="flex-row items-center gap-1.5 mb-4 py-2" onPress={() => setModalStep(1)}>
                  <ShakyIcon name="arrow-back" size={20} color="#2563EB" />
                  <Text className="text-blue-600 text-sm font-semibold">Change Transport</Text>
                </TouchableOpacity>

                <View className="mb-4">
                  <Text className="text-xs font-semibold text-slate-600 mb-1.5">
                    {transportType === "train"
                      ? "🚆 Train Number"
                      : transportType === "car"
                        ? "🚗 Car Number"
                        : transportType === "bus"
                          ? "🚌 Bus Number"
                          : "🛺 Auto Number"}
                  </Text>
                  <TextInput
                    className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-2.5 text-slate-800 text-sm"
                    placeholder={
                      transportType === "train"
                        ? "e.g., 12345 Chennai Express"
                        : transportType === "car"
                          ? "e.g., TN-01-AB-1234"
                          : transportType === "bus"
                            ? "e.g., TN-01-N-1234"
                            : "e.g., TN-01-A-1234"
                    }
                    value={vehicleNumber}
                    onChangeText={setVehicleNumber}
                  />
                </View>

                <View className="mb-4">
                  <Text className="text-xs font-semibold text-slate-600 mb-1.5">📦 Item Type</Text>
                  <TextInput
                    className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-2.5 text-slate-800 text-sm"
                    placeholder="Bag / Mobile / Wallet / Documents"
                    value={itemType}
                    onChangeText={setItemType}
                  />
                </View>

                <View className="mb-4">
                  <Text className="text-xs font-semibold text-slate-600 mb-1.5">📝 Item Description</Text>
                  <TextInput
                    className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-2.5 text-slate-800 text-sm min-h-[100px]"
                    placeholder="Color, brand, contents..."
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    numberOfLines={4}
                  />
                </View>

                <View className="mb-4">
                  <Text className="text-xs font-semibold text-slate-600 mb-1.5">
                    {transportType === "train" ? "🚉 From Station" : "📍 From Location"}
                  </Text>
                  <TextInput
                    className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-2.5 text-slate-800 text-sm"
                    placeholder={
                      transportType === "train"
                        ? "e.g., Chennai Central"
                        : transportType === "bus"
                          ? "e.g., Velachery Stop"
                          : "e.g., T Nagar"
                    }
                    value={fromLocation}
                    onChangeText={setFromLocation}
                  />
                </View>

                <View className="mb-4">
                  <Text className="text-xs font-semibold text-slate-600 mb-1.5">
                    {transportType === "train" ? "🚉 To Station" : "📍 To Location"}
                  </Text>
                  <TextInput
                    className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-2.5 text-slate-800 text-sm"
                    placeholder={
                      transportType === "train"
                        ? "e.g., Coimbatore Junction"
                        : transportType === "bus"
                          ? "e.g., CMBT Stop"
                          : "e.g., Anna Nagar"
                    }
                    value={toLocation}
                    onChangeText={setToLocation}
                  />
                </View>

                <View className="mb-4">
                  <Text className="text-xs font-semibold text-slate-600 mb-1.5">⏰ Departure Time</Text>
                  <TextInput
                    className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-2.5 text-slate-800 text-sm"
                    placeholder="e.g., 10:30 AM"
                    value={departureTime}
                    onChangeText={setDepartureTime}
                  />
                </View>

                <View className="mb-4">
                  <Text className="text-xs font-semibold text-slate-600 mb-1.5">⏱️ Arrival Time</Text>
                  <TextInput
                    className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-2.5 text-slate-800 text-sm"
                    placeholder="e.g., 12:45 PM"
                    value={arrivalTime}
                    onChangeText={setArrivalTime}
                  />
                </View>

                <View className="bg-blue-50 border-l-4 border-blue-400 rounded-lg p-3 mb-4">
                  <Text className="text-xs font-semibold text-blue-800 mb-2">Auto-captured details:</Text>
                  <Text className="text-xs text-blue-700 mb-1">📍 Current Location: {fromLocation || "Pending..."}</Text>
                  <Text className="text-xs text-blue-700 mb-1">🕒 Timestamp: {new Date().toLocaleTimeString()}</Text>
                </View>

                <TouchableOpacity className="flex-row items-center justify-center gap-2 border border-blue-600 rounded-lg py-3 mb-4" onPress={handleUploadItemPhoto}>
                  <ShakyIcon name="camera" size={20} color="#2563EB" />
                  <Text className="text-blue-600 font-semibold">📸 Upload Item Photo (Optional)</Text>
                </TouchableOpacity>

                {photoUri && (
                  <View className="border border-blue-200 bg-blue-50 rounded-lg p-2.5 mb-4">
                    <Image source={{ uri: photoUri }} className="w-full h-40 rounded-lg bg-slate-200" />
                    <View className="mt-2 flex-row justify-between items-center">
                      <Text className="text-blue-700 font-semibold text-xs">Photo selected</Text>
                      <TouchableOpacity onPress={() => setPhotoUri(null)}>
                        <Text className="text-red-600 font-semibold text-xs">Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}
          </ScrollView>

          {modalStep === 2 && (
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleCreateComplaint}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>
                  ➡️ Submit to {getSubmitAuthority(transportType)}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );

  const renderComplaintTracker = () => {
    if (!currentComplaint) return null;

    const statuses = [
      { key: "submitted", label: "🟡 Complaint Submitted", completed: true },
      { key: "notified", label: "🔵 Staff Notified", completed: currentComplaint.staffNotified },
      { key: "found", label: "🟢 Item Found", completed: currentComplaint.itemFound },
      { key: "scheduled", label: "📍 Meeting Scheduled", completed: currentComplaint.meetingScheduled },
      { key: "collected", label: "✅ Item Collected", completed: currentComplaint.itemCollected },
    ];

    return (
      <View className="mb-5">
        <Text className="text-lg font-bold text-slate-800 mb-2.5">📊 Complaint Status</Text>
        <View className="bg-white rounded-xl p-4 border border-slate-200">
          {statuses.map((status, index) => (
            <View key={status.key}>
              <View className="flex-row items-center mb-2">
                <View className={`w-3 h-3 rounded-full mr-3 ${status.completed ? "bg-blue-600" : "bg-slate-300"}`} />
                <Text className="text-[13px] text-slate-600 flex-1">{status.label}</Text>
              </View>
              {index < statuses.length - 1 && (
                <View className={`w-0.5 h-[30px] ml-[5px] mb-1 ${status.completed ? "bg-blue-600" : "bg-slate-300"}`} />
              )}
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderLiveTracking = () => {
    if (!currentComplaint) return null;

    return (
      <View className="mb-5">
        <Text className="text-lg font-bold text-slate-800 mb-2.5">🗺️ Live Tracking</Text>
        <View className="bg-slate-50 rounded-xl p-10 items-center border border-slate-200">
          <ShakyIcon name="map" size={48} color="#CBD5E1" />
          <Text className="text-sm font-semibold text-slate-600 mt-3">Live map view</Text>
          <Text className="text-xs text-slate-400 mt-1">Staff location & ETA: {currentComplaint.staffEta || "Pending..."}</Text>
        </View>
      </View>
    );
  };

  const renderStaffMessages = () => {
    if (!currentComplaint) return null;

    const handleMessageSent = async (messageText) => {
      try {
        const response = await axios.post(
          `${API_BASE}/passenger/messages/${currentComplaint._id}`,
          { text: messageText },
          {
            headers: {
              "x-user-email": userEmail,
              "x-user-name": userName,
              "x-user-phone": userPhone,
              Authorization: `Bearer ${authToken}`,
            },
          },
        );

        if (response.data?.complaint) {
          setCurrentComplaint({
            ...currentComplaint,
            ...response.data.complaint,
          });
        }
      } catch (error) {
        console.error("Error sending message:", error);
        Alert.alert("Error", "Failed to send message. Please try again.");
      }
    };

    return (
      <View className="mb-5">
        <Text className="text-lg font-bold text-slate-800 mb-2.5">💬 Staff Messages</Text>
        <PassengerMessageThread
          complaint={currentComplaint}
          userEmail={userEmail}
          userName={userName}
          onMessageSent={handleMessageSent}
          apiBase={API_BASE}
          authToken={authToken}
        />
      </View>
    );
  };

  const renderQRCodePickup = () => {
    if (!currentComplaint || !currentComplaint.itemFound) return null;

    return (
      <View className="mb-5">
        <Text className="text-lg font-bold text-slate-800 mb-2.5">📱 QR Code Pickup</Text>
        <View className="bg-white rounded-xl p-4 border border-slate-200">
          <View className="items-center py-6 border-2 border-blue-200 rounded-xl bg-blue-50 mb-3">
            <ShakyIcon name="qr-code" size={80} color="#2563EB" />
            <Text className="text-sm font-semibold text-blue-800 mt-3 text-center">Scan this QR to collect item</Text>
            <Text className="text-[11px] text-slate-400 mt-1">ID: {currentComplaint._id?.substring(0, 8)}</Text>
          </View>
          <TouchableOpacity className="bg-blue-600 rounded-lg py-3 flex-row items-center justify-center gap-2" onPress={() => Alert.alert("Scan", "Camera scan coming soon!") }>
            <ShakyIcon name="camera" size={20} color="#FFFFFF" />
            <Text className="text-white font-bold">📷 Scan Item QR</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderComplaintHistory = () => (
    <View className="mb-5">
      <View className="flex-row justify-between items-center">
        <Text className="text-lg font-bold text-slate-800 mb-2.5">📋 Complaint History</Text>
        <TouchableOpacity className="flex-row items-center gap-1" onPress={() => { setShowHistoryModal(true); fetchComplaintHistory(); }}>
          <Text className="text-blue-600 font-semibold text-[13px]">View All</Text>
          <ShakyIcon name="chevron-forward" size={16} color="#2563EB" />
        </TouchableOpacity>
      </View>

      {complaints.length > 0 ? (
        <View>
          {complaints.slice(0, 3).map((complaint) => (
            <View key={complaint._id} className="bg-white rounded-lg p-3 mb-2.5 flex-row justify-between items-center border border-slate-200">
              <View>
                <Text className="text-sm font-semibold text-slate-800">{complaint.itemType}</Text>
                <Text className="text-xs text-slate-500 mt-0.5">{complaint.vehicleNumber} • {complaint.route}</Text>
                <Text className="text-[11px] text-slate-400 mt-0.5">{new Date(complaint.createdAt).toLocaleDateString()}</Text>
              </View>
              <View className={`px-2.5 py-1.5 rounded-lg ${complaint.status === "Recovered" ? "bg-green-100" : complaint.status === "Closed" ? "bg-indigo-100" : "bg-slate-100"}`}>
                <Text className="text-[11px] font-semibold text-slate-800">{complaint.status}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <Text className="text-sm text-slate-400 text-center py-5">No complaints yet</Text>
      )}
    </View>
  );

  const renderEmergencyHelp = () => (
    <View className="mb-5">
      <Text className="text-lg font-bold text-slate-800 mb-2.5">🆘 Emergency & Help</Text>
      <View className="flex-row justify-around gap-3">
        <TouchableOpacity className="flex-1 bg-white rounded-lg p-4 items-center border border-slate-200" onPress={() => Alert.alert("Emergency", "Calling emergency hotline...") }>
          <ShakyIcon name="call" size={28} color="#DC2626" />
          <Text className="text-[11px] font-semibold text-slate-800 mt-2 text-center">Emergency Call</Text>
        </TouchableOpacity>

        <TouchableOpacity className="flex-1 bg-white rounded-lg p-4 items-center border border-slate-200" onPress={() => Alert.alert("Helpline", "📞 Helpline: +91-XXXX-XXXXX") }>
          <ShakyIcon name="information-circle" size={28} color="#2563EB" />
          <Text className="text-[11px] font-semibold text-slate-800 mt-2 text-center">Helpline</Text>
        </TouchableOpacity>

        <TouchableOpacity className="flex-1 bg-white rounded-lg p-4 items-center border border-slate-200" onPress={() => Alert.alert("FAQ", "FAQ coming soon!") }>
          <ShakyIcon name="help-circle" size={28} color="#7C3AED" />
          <Text className="text-[11px] font-semibold text-slate-800 mt-2 text-center">FAQ & Help</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderHistoryModal = () => (
    <Modal visible={showHistoryModal} transparent animationType="slide" onRequestClose={() => setShowHistoryModal(false)}>
      <View className="flex-1 bg-black/50 justify-end">
        <View className="bg-white rounded-t-2xl p-4 max-h-[90%]">
          <View className="flex-row justify-between items-center mb-4 pb-3 border-b border-slate-200">
            <Text className="text-lg font-bold text-slate-800">📋 Complaint History</Text>
            <TouchableOpacity onPress={() => setShowHistoryModal(false)}>
              <ShakyIcon name="close" size={24} color="#1E293B" />
            </TouchableOpacity>
          </View>

          <ScrollView className="max-h-[400px]">
            {loading ? (
              <ActivityIndicator size="large" color="#2563EB" style={{ marginTop: 20 }} />
            ) : complaints.length > 0 ? (
              complaints.map((complaint) => (
                <View key={complaint._id} className="bg-slate-50 rounded-lg p-3.5 mb-3 border border-slate-200">
                  <View className="flex-row justify-between items-center mb-2">
                    <Text className="text-sm font-bold text-slate-800">{complaint.itemType}</Text>
                    <View className={`px-2.5 py-1.5 rounded-lg ${complaint.status === "Recovered" ? "bg-green-100" : "bg-slate-100"}`}>
                      <Text className="text-[11px] font-semibold text-slate-800">{complaint.status}</Text>
                    </View>
                  </View>
                  <Text className="text-xs text-slate-600 mb-1">🚌 {complaint.vehicleNumber}</Text>
                  <Text className="text-xs text-slate-600 mb-1">🛣️ {complaint.route}</Text>
                  <Text className="text-xs text-slate-600 mb-1">📝 {complaint.description}</Text>
                  <Text className="text-[11px] text-slate-400 mt-1.5">{new Date(complaint.createdAt).toLocaleString()}</Text>
                </View>
              ))
            ) : (
              <Text className="text-sm text-slate-400 text-center py-5">No complaints found</Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const renderNotificationModal = () => (
    <Modal visible={showNotificationModal} transparent animationType="slide" onRequestClose={() => setShowNotificationModal(false)}>
      <View className="flex-1 bg-black/50 justify-end">
        <View className="bg-white rounded-t-2xl p-4 max-h-[90%]">
          <View className="flex-row justify-between items-center mb-4 pb-3 border-b border-slate-200">
            <Text className="text-lg font-bold text-slate-800">Notifications</Text>
            <TouchableOpacity onPress={() => setShowNotificationModal(false)}>
              <Ionicons name="close" size={24} color="#1E293B" />
            </TouchableOpacity>
          </View>

          <ScrollView className="max-h-[400px]">
            {acceptedComplaints.length === 0 ? (
              <Text className="text-sm text-slate-400 text-center py-5">No new notifications</Text>
            ) : (
              acceptedComplaints.map((complaint) => (
                <View key={complaint._id} className="bg-slate-50 rounded-lg p-3 mb-3 border border-slate-200">
                  <Text className="text-sm font-bold text-slate-900 mb-1">Your complaint has been accepted.</Text>
                  <Text className="text-xs text-slate-600 mb-2.5">Item: {complaint.itemType} • {complaint.vehicleNumber}</Text>
                  <TouchableOpacity className="bg-blue-600 rounded-lg py-2 px-2.5 flex-row items-center justify-center gap-1.5" onPress={() => handleOpenLiveTracking(complaint)}>
                    <Ionicons name="navigate" size={16} color="#FFFFFF" />
                    <Text className="text-white text-xs font-bold">Live Tracking</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const renderTrackingModal = () => (
    <Modal visible={showTrackingModal} transparent animationType="slide" onRequestClose={() => setShowTrackingModal(false)}>
      <View className="flex-1 bg-black/50 justify-end">
        <View className="bg-white rounded-t-2xl p-4 max-h-[90%]">
          <View className="flex-row justify-between items-center mb-4 pb-3 border-b border-slate-200">
            <Text className="text-lg font-bold text-slate-800">Complaint Tracking</Text>
            <TouchableOpacity onPress={() => { setShowTrackingModal(false); setTrackingData(null); setSelectedTrackingComplaint(null); }}>
              <Ionicons name="close" size={24} color="#1E293B" />
            </TouchableOpacity>
          </View>

          <View className="max-h-[400px]">
            {trackingLoading ? (
              <ActivityIndicator size="large" color="#2563EB" style={{ marginTop: 20 }} />
            ) : selectedTrackingComplaint ? (
              <View className="bg-slate-50 border border-slate-200 rounded-lg p-3.5">
                <Text className="text-[15px] font-bold text-slate-800 mb-2">Complaint submitted successfully</Text>
                <Text className="text-[13px] text-slate-600 mb-1.5">Complaint ID: {selectedTrackingComplaint.complaintId || selectedTrackingComplaint._id?.substring(0, 10)}</Text>
                <Text className="text-[13px] text-slate-600 mb-1.5">Status: {trackingData?.status || selectedTrackingComplaint.status || "Submitted"}</Text>
                <Text className="text-[13px] text-slate-600 mb-1.5">Item: {selectedTrackingComplaint.itemType} • {selectedTrackingComplaint.vehicleNumber}</Text>
                <Text className="text-[13px] text-slate-600 mb-1.5">Route: {selectedTrackingComplaint.route}</Text>
                <Text className="text-[13px] text-slate-600 mb-1.5">Routed to: {selectedTrackingComplaint.submitAuthority || "On-duty officers"}</Text>
                <Text className="text-[13px] text-slate-600 mb-1.5">Priority: {trackingData?.priority || selectedTrackingComplaint.priority || "Normal"}</Text>
                {trackingData?.staffResponseStatus ? <Text className="text-[13px] text-slate-600 mb-1.5">Officer update: {trackingData.staffResponseStatus}</Text> : null}
                {trackingData?.seenAt ? <Text className="text-[13px] text-slate-600 mb-1.5">Seen at: {new Date(trackingData.seenAt).toLocaleString()}</Text> : null}
                {trackingData?.acknowledgedAt ? <Text className="text-[13px] text-slate-600 mb-1.5">Acknowledged at: {new Date(trackingData.acknowledgedAt).toLocaleString()}</Text> : null}
                {trackingData?.officerNotes ? <Text className="text-[13px] text-slate-600 mb-1.5">Officer notes: {trackingData.officerNotes}</Text> : null}
                {trackingData?.coachRemark ? <Text className="text-[13px] text-slate-600 mb-1.5">Coach remark: {trackingData.coachRemark}</Text> : null}
                {trackingData?.stationRemark ? <Text className="text-[13px] text-slate-600 mb-1.5">Station remark: {trackingData.stationRemark}</Text> : null}
                {trackingData?.meetingPoint ? <Text className="text-[13px] text-slate-600 mb-1.5">Meeting point: {trackingData.meetingPoint}</Text> : null}
                {trackingData?.meetingTime ? <Text className="text-[13px] text-slate-600 mb-1.5">Meeting time: {trackingData.meetingTime}</Text> : null}
                {trackingData?.liveLocationAvailable && trackingData?.staffLocation ? (
                  <View>
                    <Text className="text-[13px] text-slate-600 font-bold mt-1.5 mb-1">Live officer location</Text>
                    <Text className="text-[13px] text-slate-600 mb-1.5">Latitude: {trackingData.staffLocation.latitude}</Text>
                    <Text className="text-[13px] text-slate-600 mb-1.5">Longitude: {trackingData.staffLocation.longitude}</Text>
                    <Text className="text-[13px] text-slate-600 mb-1.5">Updated: {trackingData.staffLocation.lastUpdated ? new Date(trackingData.staffLocation.lastUpdated).toLocaleTimeString() : "--"}</Text>
                    <TouchableOpacity className="bg-blue-600 rounded-lg py-2 px-2.5 flex-row items-center justify-center gap-1.5 mt-2" onPress={() => openDriverLiveMap(trackingData)}>
                      <Ionicons name="navigate" size={16} color="#FFFFFF" />
                      <Text className="text-white text-xs font-bold">Open live map</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
                {Array.isArray(trackingData?.updates) && trackingData.updates.length > 0 ? (
                  <View>
                    <Text className="text-[13px] text-slate-600 font-bold mt-1.5 mb-1">Latest timeline</Text>
                    {trackingData.updates.slice(0, 5).map((entry, index) => (
                      <Text key={`${entry.timestamp || "update"}-${index}`} className="text-[13px] text-slate-600 mb-1.5">- {entry.text || "Status updated"}{entry.staffName ? ` (${entry.staffName})` : ""}{entry.timestamp ? ` at ${new Date(entry.timestamp).toLocaleTimeString()}` : ""}</Text>
                    ))}
                  </View>
                ) : null}
                <Text className="text-[13px] text-slate-600 mb-1.5">Next step: Officers on duty will review, reply, and coordinate recovery.</Text>
              </View>
            ) : (
              <View className="bg-slate-50 border border-slate-200 rounded-lg p-3.5">
                <Text className="text-[15px] font-bold text-slate-800 mb-2">Tracking in progress</Text>
                <Text className="text-[13px] text-slate-600 mb-1.5">Waiting for duty officer acknowledgement and live updates.</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <Animated.View
      className="flex-1"
      style={{
        opacity: screenFadeAnim,
        transform: [{ translateY: screenSlideAnim }],
      }}
    >
      <ScrollView className="flex-1 bg-slate-50">
        {renderHeader()}

        <View className="p-4">
          {renderActiveJourney()}
          {renderPrimaryAction()}
          {renderComplaintPanel()}
          {renderComplaintTracker()}
          {renderLiveTracking()}
          {renderStaffMessages()}
          {renderQRCodePickup()}
          {renderComplaintHistory()}
          {renderHistoryModal()}
          {renderNotificationModal()}
          {renderTrackingModal()}
          {renderEmergencyHelp()}

          <TouchableOpacity className="bg-slate-500 rounded-lg py-3 flex-row items-center justify-center gap-2 mt-5 mb-5" onPress={onLogout}>
            <ShakyIcon name="log-out" size={20} color="#FFFFFF" />
            <Text className="text-white font-bold p-2.5">Log Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  animatedScreen: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  headerSection: {
    backgroundColor: "#FFFFFF",
    paddingTop: 12,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerContent: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  passengerName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E293B",
  },
  mobileNumber: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 4,
  },
  gpsButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  gpsText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#475569",
  },
  notificationBell: {
    position: "relative",
    padding: 8,
  },
  notificationBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "#EF4444",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 10,
  },
  journeyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  journeyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  vehicleNumber: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
  },
  badge: {
    backgroundColor: "#22C55E",
    color: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 10,
    fontWeight: "700",
  },
  journeyRoute: {
    fontSize: 14,
    color: "#475569",
    marginBottom: 6,
  },
  journeyTime: {
    fontSize: 13,
    color: "#64748B",
    marginBottom: 6,
  },
  journeyMeta: {
    fontSize: 12,
    color: "#94A3B8",
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 14,
    color: "#94A3B8",
    textAlign: "center",
    paddingVertical: 20,
  },
  primaryActionButton: {
    backgroundColor: "#EF4444",
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  primaryActionText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E293B",
  },
  modalBody: {
    maxHeight: 400,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#1E293B",
    fontSize: 14,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  autoFillSection: {
    backgroundColor: "#EFF6FF",
    borderLeftWidth: 4,
    borderLeftColor: "#3B82F6",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  autoFillLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1E40AF",
    marginBottom: 8,
  },
  autoFillText: {
    fontSize: 12,
    color: "#1E40AF",
    marginBottom: 4,
  },
  uploadPhotoButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#2563EB",
    borderRadius: 8,
    paddingVertical: 12,
    marginBottom: 16,
  },
  uploadPhotoText: {
    color: "#2563EB",
    fontWeight: "600",
  },
  photoPreviewWrapper: {
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  photoPreview: {
    width: "100%",
    height: 160,
    borderRadius: 8,
    backgroundColor: "#E2E8F0",
  },
  photoPreviewMetaRow: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  photoUploadedText: {
    color: "#1E40AF",
    fontWeight: "600",
    fontSize: 12,
  },
  removePhotoText: {
    color: "#DC2626",
    fontWeight: "600",
    fontSize: 12,
  },
  submitButton: {
    backgroundColor: "#2563EB",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
  trackerCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  statusStep: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  statusCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#CBD5E1",
    marginRight: 12,
  },
  statusCircleActive: {
    backgroundColor: "#2563EB",
  },
  statusStepText: {
    fontSize: 13,
    color: "#475569",
    flex: 1,
  },
  statusLine: {
    width: 2,
    height: 30,
    backgroundColor: "#CBD5E1",
    marginLeft: 5,
    marginBottom: 4,
  },
  statusLineActive: {
    backgroundColor: "#2563EB",
  },
  mapPlaceholder: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 40,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  mapText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#475569",
    marginTop: 12,
  },
  mapSubtext: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 4,
  },
  messagesCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  messageItem: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  messageStaff: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1E293B",
  },
  messageText: {
    fontSize: 13,
    color: "#475569",
    marginTop: 4,
  },
  messageTime: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 4,
  },
  noMessagesText: {
    fontSize: 13,
    color: "#94A3B8",
    textAlign: "center",
    paddingVertical: 16,
  },
  qrCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  qrPlaceholder: {
    alignItems: "center",
    paddingVertical: 24,
    borderWidth: 2,
    borderColor: "#DBEAFE",
    borderRadius: 12,
    backgroundColor: "#F0F9FF",
    marginBottom: 12,
  },
  qrText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E40AF",
    marginTop: 12,
    textAlign: "center",
  },
  questionText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E293B",
    textAlign: "center",
    marginBottom: 24,
    marginTop: 10,
  },
  transportGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
    columnGap: 12,
    marginBottom: 20,
  },
  transportButton: {
    width: "48%",
    backgroundColor: "#F0F9FF",
    borderWidth: 2,
    borderColor: "#BFDBFE",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 120,
  },
  transportButtonText: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B",
    textAlign: "center",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
    paddingVertical: 8,
  },
  backButtonText: {
    color: "#2563EB",
    fontSize: 14,
    fontWeight: "600",
  },
  qrId: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 4,
  },
  scanButton: {
    backgroundColor: "#2563EB",
    borderRadius: 8,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  scanButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  viewAllText: {
    color: "#2563EB",
    fontWeight: "600",
    fontSize: 13,
  },
  historyItem: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  historyItemTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B",
  },
  historyItemMeta: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  historyItemDate: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 2,
  },
  statusBadge: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusBadgeSuccess: {
    backgroundColor: "#DCFCE7",
  },
  statusBadgeInfo: {
    backgroundColor: "#E0E7FF",
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#1E293B",
  },
  notificationItem: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 4,
  },
  notificationMeta: {
    fontSize: 12,
    color: "#475569",
    marginBottom: 10,
  },
  liveTrackingButton: {
    backgroundColor: "#2563EB",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  liveTrackingButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  trackingCard: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    padding: 14,
  },
  trackingTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 8,
  },
  trackingMeta: {
    fontSize: 13,
    color: "#475569",
    marginBottom: 6,
  },
  historyFullItem: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  historyFullHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  historyFullTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E293B",
  },
  historyFullMeta: {
    fontSize: 12,
    color: "#475569",
    marginBottom: 4,
  },
  historyFullDate: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 6,
  },
  emergencyGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
    gap: 12,
  },
  emergencyButton: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  emergencyButtonText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#1E293B",
    marginTop: 8,
    textAlign: "center",
  },
  logoutButton: {
    backgroundColor: "#64748B",
    borderRadius: 8,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 20,
    marginBottom: 20,
  },
  logoutButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    padding: 10
  },
});

export default PassengerDashboard;