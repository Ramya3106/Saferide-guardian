
import React, { useState, useEffect, useRef } from "react";
import {
  BackHandler,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
  TextInput,
  Image,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Modal,

  ActivityIndicator,

  Animated,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import { getApiBase } from "./apiConfig";
import * as Location from "expo-location";

const API_BASE = getApiBase();

const AnimatedIonicon = Animated.createAnimatedComponent(Ionicons);

const CarAutoDashboard = ({ onLogout }) => {
  const iconShakeValue = useRef(new Animated.Value(0)).current;
  const iconShakeLoopRef = useRef(null);
  const screenFadeAnim = useRef(new Animated.Value(0)).current;
  const screenSlideAnim = useRef(new Animated.Value(18)).current;
  const stepFadeAnim = useRef(new Animated.Value(1)).current;
  const onlinePulseAnim = useRef(new Animated.Value(0)).current;

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
        duration: 360,
        useNativeDriver: true,
      }),
      Animated.timing(screenSlideAnim, {
        toValue: 0,
        duration: 360,
        useNativeDriver: true,
      }),
    ]).start();
  }, [screenFadeAnim, screenSlideAnim]);

  const iconShakeStyle = {
    transform: [{ translateX: iconShakeValue }],
  };

  const ShakyIcon = ({ style, ...props }) => (
    <Pressable onHoverIn={startIconShake} onHoverOut={stopIconShake}>
      <AnimatedIonicon {...props} style={[iconShakeStyle, style]} />
    </Pressable>
  );

  // Main states
  const [currentStep, setCurrentStep] = useState("vehicleSelection"); // vehicleSelection, dutySetup, dashboard
  const [vehicleType, setVehicleType] = useState(null); // "cab" or "auto"
  const [isOnline, setIsOnline] = useState(false);

  // Duty setup states
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [startingLocation, setStartingLocation] = useState("");
  const [endingArea, setEndingArea] = useState("");
  const [shiftStartTime, setShiftStartTime] = useState("");
  const [shiftEndTime, setShiftEndTime] = useState("");

  // Dashboard states
  const [complaints, setComplaints] = useState([]);

  const [acceptedComplaint, setAcceptedComplaint] = useState(null);
  const [itemConfirmation, setItemConfirmation] = useState(null);
  const [itemFound, setItemFound] = useState(null);
  const [meetingPoint, setMeetingPoint] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [showQRModal, setShowQRModal] = useState(false);
  const [isShareingLocation, setIsShareingLocation] = useState(false);
  const [recoveryStats, setRecoveryStats] = useState({
    totalToday: 12,
    recovered: 8,
    pending: 3,
    successRate: 67,
  });

  // Handle vehicle type selection
  const handleVehicleSelection = (type) => {
    setVehicleType(type);
  };

  const normalizeComplaint = (complaint) => {
    const createdAt = complaint?.createdAt || complaint?.timestamp || new Date();
    return {
      id: complaint?._id || complaint?.id,
      passengerName: complaint?.passengerName || "Passenger",
      location:
        complaint?.lastSeenLocation || complaint?.fromLocation || "Unknown location",
      item: complaint?.itemType || complaint?.description || "Lost item",
      time: new Date(createdAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      status: complaint?.status || "pending",
    };
  };

  const fetchLiveComplaints = async () => {
    if (!vehicleType || !isOnline || currentStep !== "dashboard") {
      return;
    }

    try {
      const staffRole = vehicleType === "cab" ? "cab" : "auto";
      const response = await axios.get(`${API_BASE}/passenger/live-alerts`, {
        params: { staffRole },
        headers: {
          "X-User-Role": "Cab/Auto",
        },
      });
      const alerts = response?.data?.alerts || [];
      setComplaints(alerts.map(normalizeComplaint));
    } catch (error) {
      console.log("Error fetching car/auto live complaints:", error.message);
    }
  };

  useEffect(() => {
    fetchLiveComplaints();
    if (!vehicleType || !isOnline || currentStep !== "dashboard") {
      return;
    }

    const interval = setInterval(fetchLiveComplaints, 10000);
    return () => clearInterval(interval);
  }, [vehicleType, isOnline, currentStep]);

  useEffect(() => {
    const onBackPress = () => {
      if (showQRModal) {
        setShowQRModal(false);
        return true;
      }

      if (acceptedComplaint) {
        setAcceptedComplaint(null);
        setItemConfirmation(null);
        setItemFound(null);
        setMeetingPoint("");
        setPickupTime("");
        return true;
      }

      if (currentStep === "dashboard") {
        setCurrentStep("dutySetup");
        setIsOnline(false);
        return true;
      }

      if (currentStep === "dutySetup") {
        setCurrentStep("vehicleSelection");
        return true;
      }

      return false;
    };

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      onBackPress,
    );

    return () => subscription.remove();
  }, [acceptedComplaint, currentStep, showQRModal]);

  useEffect(() => {
    stepFadeAnim.setValue(0);
    Animated.timing(stepFadeAnim, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [currentStep, stepFadeAnim]);

  useEffect(() => {
    const onlinePulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(onlinePulseAnim, {
          toValue: 1,
          duration: 1300,
          useNativeDriver: true,
        }),
        Animated.timing(onlinePulseAnim, {
          toValue: 0,
          duration: 1300,
          useNativeDriver: true,
        }),
      ]),
    );

    onlinePulseLoop.start();

    return () => {
      onlinePulseLoop.stop();
    };
  }, [onlinePulseAnim]);

  // Handle continue from vehicle selection
  const handleContinueVehicleSelection = () => {
    if (vehicleType) {
      setCurrentStep("dutySetup");
    } else {
      Alert.alert("Error", "Please select a vehicle type");
    }
  };

  // Handle start duty
  const handleStartDuty = () => {
    if (
      !vehicleNumber.trim() ||
      !startingLocation.trim() ||
      !shiftStartTime.trim() ||
      !shiftEndTime.trim()
    ) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }
    setCurrentStep("dashboard");
    setIsOnline(true);
  };

  // Handle accept complaint
  const handleAcceptComplaint = (complaint) => {
    setAcceptedComplaint(complaint);
    setItemConfirmation("itemPhoto");
  };

  // Handle item confirmation
  const handleItemConfirmed = (found) => {
    setItemFound(found);
    if (found) {
      setItemConfirmation("meetingDetails");
    } else {
      setItemConfirmation("notFound");
    }
  };

  // Handle ignore complaint
  const handleIgnoreComplaint = (complaintId) => {
    setComplaints(complaints.filter((c) => c.id !== complaintId));
  };

  // Handle complete handover
  const handleCompleteHandover = () => {
    if (acceptedComplaint) {
      setRecoveryStats({
        ...recoveryStats,
        recovered: recoveryStats.recovered + 1,
        pending: recoveryStats.pending - 1,
        successRate: Math.round(
          ((recoveryStats.recovered + 1) / recoveryStats.totalToday) * 100
        ),
      });
      setComplaints(
        complaints.filter((c) => c.id !== acceptedComplaint.id)
      );
    }
    setAcceptedComplaint(null);
    setItemConfirmation(null);
    setItemFound(null);
    setMeetingPoint("");
    setPickupTime("");
    setShowQRModal(false);
  };

  // Handle share live location
  const handleShareLiveLocation = async () => {
    setIsShareingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Location permission is required to share your live location."
        );
        setIsShareingLocation(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = location.coords;

      // Send location to backend
      if (acceptedComplaint) {
        await axios.post(
          `${API_BASE}/passenger/share-location/${acceptedComplaint.id}`,
          {
            latitude,
            longitude,
            timestamp: new Date(),
          }
        );

        Alert.alert(
          "Location Shared ✅",
          `Shared your live location:\nLat: ${latitude.toFixed(4)}\nLng: ${longitude.toFixed(4)}`
        );
      }
    } catch (error) {
      console.log("Error sharing location:", error?.message);
      Alert.alert("Error", "Failed to share location. Please try again.");
    } finally {
      setIsShareingLocation(false);
    }
  };

  // Render Vehicle Selection Screen
  const renderVehicleSelection = () => (
    <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 16, paddingBottom: 24 }}>
      <View className="mb-6">
        <Text className="text-3xl font-bold text-slate-800 mb-2">SafeRide Guardian</Text>
        <Text className="text-lg font-semibold text-slate-600">Select Your Vehicle Type</Text>
      </View>

      <View className="mb-6">
        <TouchableOpacity
          className={`rounded-2xl p-6 mb-3 border-2 items-center relative ${vehicleType === "cab" ? "bg-blue-50 border-blue-600" : "bg-slate-50 border-slate-200"}`}
          onPress={() => handleVehicleSelection("cab")}
        >
          <Text className="text-5xl mb-3">🚕</Text>
          <Text className="text-lg font-bold text-slate-800 mb-1">Cab Driver</Text>
          <Text className="text-sm text-slate-500 text-center">
            For Ola / Uber / Private Taxi
          </Text>
          {vehicleType === "cab" && (
            <View className="absolute top-3 right-3">
              <ShakyIcon name="checkmark-circle" size={24} color="#2563EB" />
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          className={`rounded-2xl p-6 mb-3 border-2 items-center relative ${vehicleType === "auto" ? "bg-blue-50 border-blue-600" : "bg-slate-50 border-slate-200"}`}
          onPress={() => handleVehicleSelection("auto")}
        >
          <Text className="text-5xl mb-3">🛺</Text>
          <Text className="text-lg font-bold text-slate-800 mb-1">Auto Driver</Text>
          <Text className="text-sm text-slate-500 text-center">
            For Share Auto / Meter Auto
          </Text>
          {vehicleType === "auto" && (
            <View className="absolute top-3 right-3">
              <ShakyIcon name="checkmark-circle" size={24} color="#2563EB" />
            </View>
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        className={`bg-blue-600 rounded-xl py-3.5 items-center mb-4 ${!vehicleType ? "opacity-50" : ""}`}
        onPress={handleContinueVehicleSelection}
        disabled={!vehicleType}
      >
        <Text className="text-white font-semibold text-base">Continue</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  // Render Duty Setup Screen
  const renderDutySetup = () => (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1"
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 16, paddingBottom: 24 }}>
        <View className="mb-6">
          <TouchableOpacity
            className="flex-row items-center mb-4"
            onPress={() => setCurrentStep("vehicleSelection")}
          >
            <ShakyIcon name="arrow-back" size={24} color="#2563EB" />
          </TouchableOpacity>
          <Text className="text-3xl font-bold text-slate-800 mb-2">Start Today's Duty</Text>
        </View>

        <View className="mb-5">
          <View className="mb-4">
            <Text className="text-sm font-semibold text-slate-600 mb-2">🚘 Vehicle Number *</Text>
            <TextInput
              className="bg-slate-50 border border-slate-300 rounded-xl py-3 px-3.5 text-sm text-slate-800"
              placeholder="TN-01-AB-1234"
              placeholderTextColor="#CBD5E1"
              value={vehicleNumber}
              onChangeText={setVehicleNumber}
            />
          </View>

          <View className="mb-4">
            <Text className="text-sm font-semibold text-slate-600 mb-2">📍 Starting Location *</Text>
            <TextInput
              className="bg-slate-50 border border-slate-300 rounded-xl py-3 px-3.5 text-sm text-slate-800"
              placeholder="Enter your starting point"
              placeholderTextColor="#CBD5E1"
              value={startingLocation}
              onChangeText={setStartingLocation}
            />
          </View>

          <View className="mb-4">
            <Text className="text-sm font-semibold text-slate-600 mb-2">📍 Ending Area (Optional)</Text>
            <TextInput
              className="bg-slate-50 border border-slate-300 rounded-xl py-3 px-3.5 text-sm text-slate-800"
              placeholder="Where will you finish"
              placeholderTextColor="#CBD5E1"
              value={endingArea}
              onChangeText={setEndingArea}
            />
          </View>

          <View className="flex-row gap-3 mb-4">
            <View className="mb-4 flex-1">
              <Text className="text-sm font-semibold text-slate-600 mb-2">⏰ Shift Start Time *</Text>
              <TextInput
                className="bg-slate-50 border border-slate-300 rounded-xl py-3 px-3.5 text-sm text-slate-800"
                placeholder="06:00 AM"
                placeholderTextColor="#CBD5E1"
                value={shiftStartTime}
                onChangeText={setShiftStartTime}
              />
            </View>
            <View className="mb-4 flex-1">
              <Text className="text-sm font-semibold text-slate-600 mb-2">⏰ Shift End Time *</Text>
              <TextInput
                className="bg-slate-50 border border-slate-300 rounded-xl py-3 px-3.5 text-sm text-slate-800"
                placeholder="02:00 PM"
                placeholderTextColor="#CBD5E1"
                value={shiftEndTime}
                onChangeText={setShiftEndTime}
              />
            </View>
          </View>

          <View className="mb-4">
            <Text className="text-sm font-semibold text-slate-600 mb-2">📷 Upload ID (Optional)</Text>
            <TouchableOpacity className="bg-slate-50 border-2 border-blue-600 border-dashed rounded-xl py-6 items-center justify-center">
              <ShakyIcon name="cloud-upload" size={24} color="#2563EB" />
              <Text className="text-blue-600 font-semibold mt-2">
                Tap to upload ID for verification
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          className="bg-blue-600 rounded-xl py-3.5 items-center mb-4"
          onPress={handleStartDuty}
        >
          <Text className="text-white font-semibold text-base">🔵 Start Duty</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  // Render Main Dashboard
  const renderDashboard = () => (
    <>
      {!acceptedComplaint ? (
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 16, paddingBottom: 24 }}>
          {/* Header Section */}
          <View className="flex-row justify-between items-center mb-5">
            <View className="flex-row items-center flex-1">
              <View className="w-[50px] h-[50px] rounded-full bg-blue-600 items-center justify-center mr-3">
                <Text className="text-white text-2xl font-bold">D</Text>
              </View>
              <View className="flex-1">
                <Text className="text-base font-bold text-slate-800">Driver Name</Text>
                <Text className="text-sm text-slate-500">
                  {vehicleType === "cab" ? "🚕 Cab Driver" : "🛺 Auto Driver"}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              className="relative p-2"
              onPress={() => { }}
            >
              <ShakyIcon name="notifications" size={24} color="#2563EB" />
              {complaints.length > 0 && (
                <View className="absolute top-0 right-0 bg-red-500 rounded-full w-5 h-5 items-center justify-center">
                  <Text className="text-white text-xs font-bold">{complaints.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Online/Offline Toggle */}
          <View className="bg-slate-50 rounded-xl p-4 flex-row justify-between items-center mb-5 border border-slate-200">
            <View className="flex-row items-center">
              <Animated.View
                className={`w-3 h-3 rounded-full mr-2.5 ${isOnline ? "bg-green-500" : "bg-red-500"}`}
                style={[
                  {
                    opacity: onlinePulseAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.75, 1],
                    }),
                    transform: [
                      {
                        scale: isOnline
                          ? onlinePulseAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [1, 1.28],
                          })
                          : 1,
                      },
                    ],
                  },
                ]}
              />
              <Text className="text-base font-semibold text-slate-800">
                {isOnline ? "Online" : "Offline"}
              </Text>
            </View>
            <Switch
              value={isOnline}
              onValueChange={setIsOnline}
              trackColor={{ false: "#CBD5E1", true: "#86EFAC" }}
              thumbColor={isOnline ? "#22C55E" : "#64748B"}
            />
          </View>

          {/* Active Duty Card */}
          <View className="bg-slate-50 rounded-xl p-4 mb-5 border border-slate-200">
            <Text className="text-base font-bold text-slate-800 mb-3">🚘 Active Duty</Text>
            <View className="gap-2">
              <View className="flex-row justify-between py-2 border-b border-slate-200">
                <Text className="text-sm text-slate-500 font-medium">Vehicle:</Text>
                <Text className="text-sm font-semibold text-slate-800">{vehicleNumber}</Text>
              </View>
              <View className="flex-row justify-between py-2 border-b border-slate-200">
                <Text className="text-sm text-slate-500 font-medium">Location:</Text>
                <Text className="text-sm font-semibold text-slate-800">{startingLocation}</Text>
              </View>
              <View className="flex-row justify-between py-2 border-b border-slate-200">
                <Text className="text-sm text-slate-500 font-medium">Shift:</Text>
                <Text className="text-sm font-semibold text-slate-800">
                  {shiftStartTime} - {shiftEndTime}
                </Text>
              </View>
              <View className="flex-row justify-between py-2 border-b border-slate-200">
                <Text className="text-sm text-slate-500 font-medium">Status:</Text>
                <Text className="text-sm font-semibold text-green-500">
                  ✅ Active
                </Text>
              </View>
            </View>
          </View>

          {/* Live Complaint Alerts */}
          <View className="mb-5">
            <Text className="text-base font-bold text-slate-800 mb-3">
              🚨 Live Complaint Alerts ({complaints.length})
            </Text>
            {complaints.length > 0 ? (
              <FlatList
                data={complaints}
                keyExtractor={(item) => item.id.toString()}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <View className="bg-orange-50 rounded-xl p-3.5 mb-3 border border-orange-300">
                    <View className="flex-row justify-between items-center mb-2">
                      <Text className="text-sm font-bold text-orange-900">⚠ Lost Item Alert</Text>
                      <Text className="text-xs text-orange-800 font-medium">{item.time}</Text>
                    </View>
                    <Text className="text-[13px] text-orange-800 mb-1">
                      👤 Passenger: <Text className="font-bold">{item.passengerName}</Text>
                    </Text>
                    <Text className="text-[13px] text-orange-800 mb-1">
                      📍 Location: <Text className="font-bold">{item.location}</Text>
                    </Text>
                    <Text className="text-[13px] text-orange-800 mb-1">
                      📦 Item: <Text className="font-bold">{item.item}</Text>
                    </Text>
                    <View className="flex-row gap-2.5 mt-3">
                      <TouchableOpacity
                        className="flex-1 bg-green-100 rounded-lg py-2.5 items-center border border-green-300"
                        onPress={() => handleAcceptComplaint(item)}
                      >
                        <Text className="text-green-700 font-bold text-xs">✅ ACCEPT</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        className="flex-1 bg-red-100 rounded-lg py-2.5 items-center border border-red-200"
                        onPress={() => handleIgnoreComplaint(item.id)}
                      >
                        <Text className="text-red-600 font-bold text-xs">❌ IGNORE</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              />
            ) : (
              <View className="bg-slate-50 rounded-xl p-6 items-center">
                <Text className="text-sm text-slate-500">
                  No complaints at the moment
                </Text>
              </View>
            )}
          </View>

          {/* Daily Summary Panel */}
          <View className="bg-slate-50 rounded-xl p-4 mb-5 border border-slate-200">
            <Text className="text-base font-bold text-slate-800 mb-3">📊 Daily Summary</Text>
            <View className="flex-row flex-wrap gap-2.5">
              <View className="flex-1 bg-white rounded-lg p-3 items-center border border-slate-200">
                <Text className="text-xl font-bold text-blue-600 mb-1">{recoveryStats.totalToday}</Text>
                <Text className="text-xs text-slate-500">Today</Text>
              </View>
              <View className="flex-1 bg-white rounded-lg p-3 items-center border border-slate-200">
                <Text className="text-xl font-bold text-blue-600 mb-1">{recoveryStats.recovered}</Text>
                <Text className="text-xs text-slate-500">Recovered</Text>
              </View>
              <View className="flex-1 bg-white rounded-lg p-3 items-center border border-slate-200">
                <Text className="text-xl font-bold text-blue-600 mb-1">{recoveryStats.pending}</Text>
                <Text className="text-xs text-slate-500">Pending</Text>
              </View>
              <View className="flex-1 bg-white rounded-lg p-3 items-center border border-slate-200">
                <Text className="text-xl font-bold text-blue-600 mb-1">{recoveryStats.successRate}%</Text>
                <Text className="text-xs text-slate-500">Success</Text>
              </View>
            </View>
          </View>

          {/* Logout Button */}
          <TouchableOpacity
            className="bg-red-100 rounded-xl py-3.5 items-center border border-red-200"
            onPress={() => {
              setCurrentStep("vehicleSelection");
              setIsOnline(false);
              onLogout?.();
            }}
          >
            <Text className="text-red-600 font-semibold text-base">🚪 End Duty</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        renderAcceptedComplaintFlow()
      )}
    </>
  );

  // Render Accepted Complaint Flow
  const renderAcceptedComplaintFlow = () => (
    <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 16, paddingBottom: 24 }}>
      <View className="mb-5">
        <TouchableOpacity
          className="flex-row items-center mb-4"
          onPress={() => setAcceptedComplaint(null)}
        >
          <ShakyIcon name="arrow-back" size={24} color="#2563EB" />
          <Text className="text-blue-600 ml-2 font-semibold">Back to Dashboard</Text>
        </TouchableOpacity>
      </View>

      {itemConfirmation === "itemPhoto" && (
        <View>
          <Text className="text-2xl font-bold text-slate-800 mb-4">📸 Item Confirmation</Text>
          <View className="mb-5">
            <View className="bg-blue-50 rounded-xl p-3.5 mb-4 border border-blue-200">
              <Text className="text-sm font-bold text-blue-800 mb-2">Complaint Details</Text>
              <Text className="text-[13px] text-blue-800 mb-1">
                📦 Item: {acceptedComplaint.item}
              </Text>
              <Text className="text-[13px] text-blue-800 mb-1">
                👤 Passenger: {acceptedComplaint.passengerName}
              </Text>
              <Text className="text-[13px] text-blue-800 mb-1">
                📍 Location: {acceptedComplaint.location}
              </Text>
            </View>

            <TouchableOpacity className="bg-slate-50 border-2 border-blue-600 border-dashed rounded-xl py-10 items-center justify-center mb-4">
              <ShakyIcon name="camera" size={40} color="#2563EB" />
              <Text className="text-blue-600 font-semibold mt-3">Tap to Upload Photo</Text>
            </TouchableOpacity>

            <View className="flex-row gap-3 mt-4">
              <TouchableOpacity
                className="flex-1 bg-green-100 rounded-xl py-3.5 items-center border border-green-300"
                onPress={() => handleItemConfirmed(true)}
              >
                <Text className="text-green-700 font-bold">✅ Item Found</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-red-100 rounded-xl py-3.5 items-center border border-red-200"
                onPress={() => handleItemConfirmed(false)}
              >
                <Text className="text-red-600 font-bold">❌ Item Not Found</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {itemConfirmation === "meetingDetails" && itemFound && (
        <View>
          <Text className="text-2xl font-bold text-slate-800 mb-4">📍 Meeting Details</Text>
          <View className="mb-5">
            <View className="mb-4">
              <Text className="text-sm font-semibold text-slate-600 mb-2">Meeting Point</Text>
              <TextInput
                className="bg-slate-50 border border-slate-300 rounded-xl py-3 px-3.5 text-sm text-slate-800"
                placeholder="Enter meeting location"
                placeholderTextColor="#CBD5E1"
                value={meetingPoint}
                onChangeText={setMeetingPoint}
              />
            </View>

            <View className="mb-4">
              <Text className="text-sm font-semibold text-slate-600 mb-2">Pickup Time</Text>
              <TextInput
                className="bg-slate-50 border border-slate-300 rounded-xl py-3 px-3.5 text-sm text-slate-800"
                placeholder="Enter pickup time"
                placeholderTextColor="#CBD5E1"
                value={pickupTime}
                onChangeText={setPickupTime}
              />
            </View>


            <TouchableOpacity
              className={`bg-blue-600 rounded-xl py-3.5 flex-row items-center justify-center mb-4 ${isShareingLocation ? "opacity-50" : ""}`}
              onPress={handleShareLiveLocation}
              disabled={isShareingLocation}
            >
              {isShareingLocation ? (
                <>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text className="text-white font-semibold ml-2">Sharing...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="location" size={24} color="#FFFFFF" />
                  <Text className="text-white font-semibold ml-2">Share Live Location</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity className="bg-blue-600 rounded-xl py-3.5 flex-row items-center justify-center mb-4">
              <ShakyIcon name="location" size={24} color="#FFFFFF" />
              <Text className="text-white font-semibold ml-2">Share Live Location</Text>

            </TouchableOpacity>

            <TouchableOpacity
              className="bg-blue-600 rounded-xl py-3.5 items-center mb-4"
              onPress={() => setShowQRModal(true)}
            >
              <Text className="text-white font-semibold text-base">📍 Next: QR Handover</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {itemConfirmation === "notFound" && !itemFound && (
        <View>
          <Text className="text-2xl font-bold text-slate-800 mb-4">❌ Item Not Found</Text>
          <View className="mb-5">
            <View className="bg-red-100 rounded-xl p-4 mb-4 border border-red-200">
              <Text className="text-base font-bold text-red-600 mb-2">
                Item Not Found Confirmation
              </Text>
              <Text className="text-sm text-red-600 leading-5">
                You have confirmed that the item is not in your vehicle. This
                information will be recorded in the system.
              </Text>
            </View>

            <TouchableOpacity
              className="bg-blue-600 rounded-xl py-3.5 items-center mb-4"
              onPress={() => {
                setComplaints(
                  complaints.filter((c) => c.id !== acceptedComplaint.id)
                );
                setAcceptedComplaint(null);
              }}
            >
              <Text className="text-white font-semibold text-base">
                Return to Dashboard
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* QR Handover Modal */}
      <Modal
        visible={showQRModal}
        transparent={true}
        animationType="slide"
      >
        <SafeAreaView className="flex-1 bg-white">
          <View className="flex-row justify-between items-center px-4 py-3 border-b border-slate-200">
            <TouchableOpacity
              onPress={() => setShowQRModal(false)}
            >
              <ShakyIcon name="close" size={28} color="#2563EB" />
            </TouchableOpacity>
            <Text className="text-lg font-bold text-slate-800">QR Handover</Text>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 16 }}>
            <View className="items-center mb-6">
              <Text className="text-base font-bold text-slate-800 mb-4">📲 Scan Passenger's QR</Text>
              <View className="w-[200px] h-[200px] bg-slate-50 rounded-xl border-2 border-slate-300 items-center justify-center mb-4">
                <ShakyIcon
                  name="qr-code"
                  size={80}
                  color="#CBD5E1"
                />
              </View>
              <TouchableOpacity className="bg-blue-600 rounded-xl flex-row py-3.5 px-6 items-center justify-center">
                <ShakyIcon name="camera" size={24} color="#FFFFFF" />
                <Text className="text-white font-semibold ml-2">Scan QR Code</Text>
              </TouchableOpacity>
            </View>

            <View className="h-px bg-slate-200 my-6" />

            <View className="items-center mb-6">
              <Text className="text-base font-bold text-slate-800 mb-4">🎫 Or Show Your QR</Text>
              <View className="w-[200px] h-[200px] bg-slate-50 rounded-xl border-2 border-slate-300 items-center justify-center mb-4">
                <ShakyIcon
                  name="qr-code"
                  size={80}
                  color="#CBD5E1"
                />
              </View>
              <Text className="text-[13px] text-slate-500 mt-3">
                Driver QR - Let passenger scan this
              </Text>
            </View>

            <TouchableOpacity
              className="bg-green-500 rounded-xl py-3.5 items-center mt-4"
              onPress={handleCompleteHandover}
            >
              <Text className="text-white font-semibold text-base">
                ✅ Complete Handover
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </ScrollView>
  );

  return (
    <Animated.View
      className="flex-1" style={[
        {
          opacity: screenFadeAnim,
          transform: [{ translateY: screenSlideAnim }],
        },
      ]}
    >
      <SafeAreaView className="flex-1 bg-white">
        <Animated.View
          className="flex-1" style={[
            {
              opacity: stepFadeAnim,
              transform: [
                {
                  translateX: stepFadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [22, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {currentStep === "vehicleSelection" && renderVehicleSelection()}
          {currentStep === "dutySetup" && renderDutySetup()}
          {currentStep === "dashboard" && renderDashboard()}
        </Animated.View>
      </SafeAreaView>
    </Animated.View>
  );
};

const styles = create({
  animatedScreen: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  flex1: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 24,
  },
  dashboardContent: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 24,
  },

  // Vehicle Selection Styles
  header: {
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#475569",
  },
  selectionContainer: {
    marginBottom: 24,
  },
  vehicleCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 24,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "#E2E8F0",
    alignItems: "center",
    position: "relative",
  },
  vehicleCardSelected: {
    backgroundColor: "#EFF6FF",
    borderColor: "#2563EB",
  },
  vehicleIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  vehicleTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 4,
  },
  vehicleDescription: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
  },
  checkmark: {
    position: "absolute",
    top: 12,
    right: 12,
  },

  // Form Styles
  formContainer: {
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: "#1E293B",
  },
  timeRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  uploadButton: {
    backgroundColor: "#F8FAFC",
    borderWidth: 2,
    borderColor: "#2563EB",
    borderStyle: "dashed",
    borderRadius: 12,
    paddingVertical: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadButtonText: {
    color: "#2563EB",
    fontWeight: "600",
    marginTop: 8,
  },

  // Button Styles
  primaryButton: {
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 16,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  backButtonText: {
    color: "#2563EB",
    marginLeft: 8,
    fontWeight: "600",
  },
  backButtonContainer: {
    marginBottom: 20,
  },

  // Dashboard Styles
  dashboardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  driverInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "700",
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
  },
  driverVehicle: {
    fontSize: 14,
    color: "#64748B",
  },
  notificationBell: {
    position: "relative",
    padding: 8,
  },
  badge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "#EF4444",
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },

  // Status Card
  statusCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  statusLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#EF4444",
    marginRight: 10,
  },
  statusOnline: {
    backgroundColor: "#22C55E",
  },
  statusText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1E293B",
  },

  // Duty Card
  dutyCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 12,
  },
  dutyInfo: {
    gap: 10,
  },
  dutyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  dutyLabel: {
    fontSize: 14,
    color: "#64748B",
    fontWeight: "500",
  },
  dutyValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B",
  },
  statusActive: {
    color: "#22C55E",
  },

  // Complaints Section
  complaintsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 12,
  },
  complaintCard: {
    backgroundColor: "#FFF7ED",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#FDBA74",
  },
  complaintHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  complaintTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#9A3412",
  },
  complaintTime: {
    fontSize: 12,
    color: "#9A3412",
    fontWeight: "500",
  },
  complaintDetail: {
    fontSize: 13,
    color: "#9A3412",
    marginBottom: 6,
  },
  bold: {
    fontWeight: "700",
  },
  complaintActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: "#DCFCE7",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#86EFAC",
  },
  acceptButtonText: {
    color: "#16A34A",
    fontWeight: "700",
    fontSize: 12,
  },
  ignoreButton: {
    flex: 1,
    backgroundColor: "#FEE2E2",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  ignoreButtonText: {
    color: "#DC2626",
    fontWeight: "700",
    fontSize: 12,
  },
  emptyState: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
  },
  emptyStateText: {
    fontSize: 14,
    color: "#64748B",
  },

  // Summary Panel
  summaryPanel: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    minWidth: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  summaryNumber: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2563EB",
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: "#64748B",
  },

  // Logout Button
  logoutButton: {
    backgroundColor: "#FEE2E2",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  logoutButtonText: {
    color: "#DC2626",
    fontWeight: "600",
    fontSize: 16,
  },

  // Complaint Flow Styles
  formTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 16,
  },
  complaintSummary: {
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E40AF",
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 13,
    color: "#1E40AF",
    marginBottom: 6,
  },
  uploadPhotoButton: {
    backgroundColor: "#F8FAFC",
    borderWidth: 2,
    borderColor: "#2563EB",
    borderStyle: "dashed",
    borderRadius: 12,
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  uploadPhotoText: {
    color: "#2563EB",
    fontWeight: "600",
    marginTop: 12,
  },
  confirmationButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: "#DCFCE7",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#86EFAC",
  },
  confirmButtonText: {
    color: "#16A34A",
    fontWeight: "700",
  },
  denyButton: {
    flex: 1,
    backgroundColor: "#FEE2E2",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  denyButtonText: {
    color: "#DC2626",
    fontWeight: "700",
  },
  locationButton: {
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  locationButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    marginLeft: 8,
  },
  notFoundCard: {
    backgroundColor: "#FEE2E2",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  notFoundTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#DC2626",
    marginBottom: 8,
  },
  notFoundText: {
    fontSize: 14,
    color: "#DC2626",
    lineHeight: 20,
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E293B",
  },
  modalContent: {
    flexGrow: 1,
    padding: 16,
  },
  qrSection: {
    alignItems: "center",
    marginBottom: 24,
  },
  qrTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 16,
  },
  qrPlaceholder: {
    width: 200,
    height: 200,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  scanButton: {
    backgroundColor: "#2563EB",
    borderRadius: 12,
    flexDirection: "row",
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  scanButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    marginLeft: 8,
  },
  driverQRText: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 12,
  },
  divider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 24,
  },
  completeButton: {
    backgroundColor: "#22C55E",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 16,
  },
  completeButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
});

export default CarAutoDashboard;
