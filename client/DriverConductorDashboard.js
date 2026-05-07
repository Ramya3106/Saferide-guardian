import React, { useState, useEffect, useRef } from "react";
import {
  BackHandler,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
  TextInput,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Modal,
  Image,
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

const DriverConductorDashboard = ({
  onLogout,
  staffRole = "driver-conductor",
  presetPosition = null,
  skipSetup = false,
}) => {
  const iconShakeValue = useRef(new Animated.Value(0)).current;
  const iconShakeLoopRef = useRef(null);
  const screenFadeAnim = useRef(new Animated.Value(0)).current;
  const screenSlideAnim = useRef(new Animated.Value(18)).current;
  const stepFadeAnim = useRef(new Animated.Value(1)).current;
  const patrolSweepAnim = useRef(new Animated.Value(0)).current;

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
  const [currentStep, setCurrentStep] = useState(
    skipSetup ? "dashboard" : "positionSelection"
  ); // positionSelection, dutySetup, dashboard
  const [position, setPosition] = useState(presetPosition); // "driver" or "conductor"
  const [dutyStarted, setDutyStarted] = useState(false);
  const [isOnline, setIsOnline] = useState(skipSetup);

  // Duty setup states
  const [busNumber, setBusNumber] = useState("");
  const [route, setRoute] = useState("");
  const [shiftTime, setShiftTime] = useState("");
  const [depot, setDepot] = useState("");
  const [ticketMachineId, setTicketMachineId] = useState("");
  const [passengersOnboard, setPassengersOnboard] = useState("");

  // Complaints data
  const [complaints, setComplaints] = useState([]);

  const [acceptedComplaint, setAcceptedComplaint] = useState(null);
  const [itemConfirmation, setItemConfirmation] = useState(null); // null, itemPhoto, meetingDetails, notFound
  const [itemFound, setItemFound] = useState(null);
  const [pickupStop, setPickupStop] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [showQRModal, setShowQRModal] = useState(false);

  const [performanceStats, setPerformanceStats] = useState({
    totalToday: 15,
    recovered: 10,
    escalated: 2,
    pending: 3,
    successRate: 67,
    avgResponseTime: "4.2 mins",
  });

  // Driver-specific states
  const [forwardedComplaints, setForwardedComplaints] = useState([]);
  const [busChecked, setBusChecked] = useState(false);
  const [isShareingLocation, setIsShareingLocation] = useState(false);

  const normalizeComplaint = (complaint) => {
    const createdAt = complaint?.createdAt || complaint?.timestamp || new Date();
    return {
      id: complaint?._id || complaint?.id,
      passengerName: complaint?.passengerName || "Passenger",
      item: complaint?.itemType || complaint?.description || "Lost item",
      seat: complaint?.vehicleNumber || complaint?.route || "N/A",
      reportedTime: new Date(createdAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      status: complaint?.status || "pending",
    };
  };

  const fetchLiveComplaints = async () => {
    if (!isOnline || currentStep !== "dashboard") {
      return;
    }

    try {
      const response = await axios.get(`${API_BASE}/passenger/live-alerts`, {
        params: { staffRole },
        headers: {
          "X-User-Role": "Driver/Conductor",
        },
      });
      const alerts = response?.data?.alerts || [];
      setComplaints(alerts.map(normalizeComplaint));
    } catch (error) {
      console.log("Error fetching driver/conductor live complaints:", error.message);
    }
  };

  useEffect(() => {
    fetchLiveComplaints();
    if (!isOnline || currentStep !== "dashboard") {
      return;
    }

    const interval = setInterval(fetchLiveComplaints, 10000);
    return () => clearInterval(interval);
  }, [isOnline, currentStep, staffRole]);

  useEffect(() => {
    if (!skipSetup) {
      return;
    }

    if (!position) {
      setPosition(presetPosition || "conductor");
    }

    if (currentStep !== "dashboard") {
      setCurrentStep("dashboard");
    }

    if (!isOnline) {
      setIsOnline(true);
    }
  }, [currentStep, isOnline, position, presetPosition, skipSetup]);

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
        setPickupStop("");
        setPickupTime("");
        return true;
      }

      if (skipSetup && currentStep === "dashboard") {
        return false;
      }

      if (currentStep === "dashboard") {
        setCurrentStep("dutySetup");
        setIsOnline(false);
        return true;
      }

      if (currentStep === "dutySetup") {
        setCurrentStep("positionSelection");
        return true;
      }

      return false;
    };

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      onBackPress,
    );

    return () => subscription.remove();
  }, [currentStep, acceptedComplaint, showQRModal, skipSetup, itemConfirmation]);

  useEffect(() => {
    stepFadeAnim.setValue(0);
    Animated.timing(stepFadeAnim, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [currentStep, position, stepFadeAnim]);

  useEffect(() => {
    const patrolSweepLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(patrolSweepAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(patrolSweepAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ]),
    );

    patrolSweepLoop.start();

    return () => {
      patrolSweepLoop.stop();
    };
  }, [patrolSweepAnim]);

  // Handle position selection
  const handlePositionSelection = (pos) => {
    setPosition(pos);
  };

  // Handle continue from position selection
  const handleContinuePositionSelection = () => {
    if (position) {
      setCurrentStep("dutySetup");
    } else {
      Alert.alert("Error", "Please select a position");
    }
  };

  // Handle start duty
  const handleStartDuty = () => {
    if (!busNumber.trim() || !route.trim() || !shiftTime.trim()) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }
    setDutyStarted(true);
    setCurrentStep("dashboard");
    setIsOnline(true);
  };

  // DRIVER FUNCTIONS
  const handleCheckBus = () => {
    setBusChecked(true);
    Alert.alert("Bus Checked", "Bus inspection completed");
  };

  const handleForwardToConductor = (complaint) => {
    setForwardedComplaints([...forwardedComplaints, complaint.id]);
    Alert.alert("Forwarded", "Complaint forwarded to conductor");
  };

  // CONDUCTOR FUNCTIONS
  const handleAcceptComplaint = (complaint) => {
    setAcceptedComplaint(complaint);
    setItemConfirmation("itemPhoto");
  };

  const handleItemConfirmed = (found) => {
    setItemFound(found);
    if (found) {
      setItemConfirmation("meetingDetails");
    } else {
      setItemConfirmation("notFound");
    }
  };

  const handleCompleteHandover = () => {
    if (acceptedComplaint) {
      setPerformanceStats({
        ...performanceStats,
        recovered: performanceStats.recovered + 1,
        pending: performanceStats.pending - 1,
        successRate: Math.round(
          ((performanceStats.recovered + 1) / performanceStats.totalToday) * 100
        ),
      });
      setComplaints(complaints.filter((c) => c.id !== acceptedComplaint.id));
    }
    setAcceptedComplaint(null);
    setItemConfirmation(null);
    setItemFound(null);
    setPickupStop("");
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

  // Render Position Selection Screen
  const renderPositionSelection = () => (
    <ScrollView contentContainerStyle={{flexGrow:1,padding:16,paddingBottom:24}}>
      <View className="mb-6">
        <Text className="text-3xl font-bold text-slate-800 mb-2">SafeRide Guardian</Text>
        <Text className="text-lg font-semibold text-slate-600">Select Your Position</Text>
      </View>

      <Text className="text-base font-semibold text-slate-600 mb-4">Choose Your Role</Text>

      <View className="mb-6">
        <TouchableOpacity
          className={`rounded-2xl p-6 mb-3 border-2 items-center relative ${position===posType?"bg-blue-50 border-blue-600":"bg-slate-50 border-slate-200"}`}
          onPress={() => handlePositionSelection("driver")}
        >
          <Text className="text-5xl mb-3">🚌</Text>
          <Text className="text-lg font-bold text-slate-800 mb-1">Bus Driver</Text>
          <Text className="text-sm text-slate-500 text-center">
            Responsible for vehicle movement
          </Text>
          {position === "driver" && (
            <View className="absolute top-3 right-3">
              <ShakyIcon name="checkmark-circle" size={24} color="#2563EB" />
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          className={`rounded-2xl p-6 mb-3 border-2 items-center relative ${position===posType?"bg-blue-50 border-blue-600":"bg-slate-50 border-slate-200"}`}
          onPress={() => handlePositionSelection("conductor")}
        >
          <Text className="text-5xl mb-3">🎫</Text>
          <Text className="text-lg font-bold text-slate-800 mb-1">Conductor</Text>
          <Text className="text-sm text-slate-500 text-center">
            Responsible for passenger & item custody
          </Text>
          {position === "conductor" && (
            <View className="absolute top-3 right-3">
              <ShakyIcon name="checkmark-circle" size={24} color="#2563EB" />
            </View>
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        className="bg-blue-600 rounded-xl py-3.5 items-center mb-4 opacity-100"
        onPress={handleContinuePositionSelection}
        disabled={!position}
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
      <ScrollView contentContainerStyle={{flexGrow:1,padding:16,paddingBottom:24}}>
        <View className="mb-6">
          <TouchableOpacity
            className="flex-row items-center mb-4"
            onPress={() => setCurrentStep("positionSelection")}
          >
            <ShakyIcon name="arrow-back" size={24} color="#2563EB" />
          </TouchableOpacity>
          <Text className="text-3xl font-bold text-slate-800 mb-2">Start Today's Duty</Text>
        </View>

        <View className="mb-5">
          <View className="mb-4">
            <Text className="text-sm font-semibold text-slate-600 mb-2">🚌 Bus Number *</Text>
            <TextInput
              className="bg-slate-50 border border-slate-300 rounded-xl py-3 px-3.5 text-sm text-slate-800"
              placeholder="TN-01-AB-1234"
              placeholderTextColor="#CBD5E1"
              value={busNumber}
              onChangeText={setBusNumber}
            />
          </View>

          <View className="mb-4">
            <Text className="text-sm font-semibold text-slate-600 mb-2">📍 Route (From → To) *</Text>
            <TextInput
              className="bg-slate-50 border border-slate-300 rounded-xl py-3 px-3.5 text-sm text-slate-800"
              placeholder="Velachery → CMBT"
              placeholderTextColor="#CBD5E1"
              value={route}
              onChangeText={setRoute}
            />
          </View>

          <View className="mb-4">
            <Text className="text-sm font-semibold text-slate-600 mb-2">⏰ Shift Time *</Text>
            <TextInput
              className="bg-slate-50 border border-slate-300 rounded-xl py-3 px-3.5 text-sm text-slate-800"
              placeholder="6:00 AM – 2:00 PM"
              placeholderTextColor="#CBD5E1"
              value={shiftTime}
              onChangeText={setShiftTime}
            />
          </View>

          <View className="mb-4">
            <Text className="text-sm font-semibold text-slate-600 mb-2">🏢 Current Depot</Text>
            <TextInput
              className="bg-slate-50 border border-slate-300 rounded-xl py-3 px-3.5 text-sm text-slate-800"
              placeholder="Depot name"
              placeholderTextColor="#CBD5E1"
              value={depot}
              onChangeText={setDepot}
            />
          </View>

          {position === "conductor" && (
            <>
              <View className="mb-4">
                <Text className="text-sm font-semibold text-slate-600 mb-2">🎫 Ticket Machine ID</Text>
                <TextInput
                  className="bg-slate-50 border border-slate-300 rounded-xl py-3 px-3.5 text-sm text-slate-800"
                  placeholder="TM-12345"
                  placeholderTextColor="#CBD5E1"
                  value={ticketMachineId}
                  onChangeText={setTicketMachineId}
                />
              </View>

              <View className="mb-4">
                <Text className="text-sm font-semibold text-slate-600 mb-2">👥 Passengers Onboard</Text>
                <TextInput
                  className="bg-slate-50 border border-slate-300 rounded-xl py-3 px-3.5 text-sm text-slate-800"
                  placeholder="0"
                  placeholderTextColor="#CBD5E1"
                  value={passengersOnboard}
                  onChangeText={setPassengersOnboard}
                  keyboardType="numeric"
                />
              </View>
            </>
          )}
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

  // Render Driver Dashboard
  const renderDriverDashboard = () => (
    <ScrollView contentContainerStyle={{flexGrow:1,padding:16,paddingBottom:24}}>
      {/* Header */}
      <View className="flex-row justify-between items-center mb-5">
        <View className="flex-row items-center flex-1">
          <View className="w-[50px] h-[50px] rounded-full bg-blue-600 items-center justify-center mr-3">
            <Text className="text-white text-2xl font-bold">D</Text>
          </View>
          <View className="flex-1">
            <Text className="text-base font-bold text-slate-800">Driver Name</Text>
            <Text className="text-sm text-slate-500">🚌 {busNumber}</Text>
          </View>
        </View>
        <Animated.View
          style={{
            transform: [
              {
                rotate: patrolSweepAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["-6deg", "6deg"],
                }),
              },
            ],
          }}
        >
          <TouchableOpacity className="relative p-2">
            <ShakyIcon name="notifications" size={24} color="#2563EB" />
            {complaints.length > 0 && (
              <View className="absolute top-0 right-0 bg-red-500 rounded-full w-5 h-5 items-center justify-center">
                <Text className="text-white text-xs font-bold">{complaints.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Duty Status Toggle */}
      <View className="bg-slate-50 rounded-xl p-4 flex-row justify-between items-center mb-5 border border-slate-200">
        <View className="flex-row items-center">
          <View
            className={`w-3 h-3 rounded-full mr-2.5 ${isOnline?"bg-green-500":"bg-red-500"}`}
          />
          <Text className="text-base font-semibold text-slate-800">{isOnline ? "On Duty" : "Off Duty"}</Text>
        </View>
        <Switch
          value={isOnline}
          onValueChange={setIsOnline}
          trackColor={{ false: "#CBD5E1", true: "#86EFAC" }}
          thumbColor={isOnline ? "#22C55E" : "#64748B"}
        />
      </View>

      {/* Active Route Card */}
      <View className="bg-slate-50 rounded-xl p-4 mb-5 border border-slate-200">
        <Text className="text-base font-bold text-slate-800 mb-3">📍 Active Route</Text>
        <View className="gap-2">
          <View className="flex-row justify-between py-2 border-b border-slate-200">
            <Text className="text-sm text-slate-500 font-medium">Bus:</Text>
            <Text className="text-sm font-semibold text-slate-800">{busNumber}</Text>
          </View>
          <View className="flex-row justify-between py-2 border-b border-slate-200">
            <Text className="text-sm text-slate-500 font-medium">Route:</Text>
            <Text className="text-sm font-semibold text-slate-800">{route}</Text>
          </View>
          <View className="flex-row justify-between py-2 border-b border-slate-200">
            <Text className="text-sm text-slate-500 font-medium">Current Stop:</Text>
            <Text className="text-sm font-semibold text-slate-800">Medavakkam</Text>
          </View>
          <View className="flex-row justify-between py-2 border-b border-slate-200">
            <Text className="text-sm text-slate-500 font-medium">Next Stop:</Text>
            <Text className="text-sm font-semibold text-slate-800">Guindy</Text>
          </View>
          <View className="flex-row justify-between py-2 border-b border-slate-200">
            <Text className="text-sm text-slate-500 font-medium">Shift:</Text>
            <Text className="text-sm font-semibold text-slate-800">{shiftTime}</Text>
          </View>
          <View className="flex-row justify-between py-2 border-b border-slate-200">
            <Text className="text-sm text-slate-500 font-medium">GPS:</Text>
            <Text className="text-sm font-semibold text-green-500">🟢 Active</Text>
          </View>
        </View>
      </View>

      {/* Lost Item Alerts */}
      <View className="mb-5">
        <Text className="text-base font-bold text-slate-800 mb-3">🚨 Lost Item Alerts ({complaints.length})</Text>
        {complaints.length > 0 ? (
          <FlatList
            data={complaints}
            keyExtractor={(item) => item.id.toString()}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <View className="bg-orange-50 rounded-xl p-3.5 mb-3 border border-orange-300">
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-sm font-bold text-orange-900">⚠ LOST ITEM ALERT</Text>
                  <Text className="text-xs text-orange-800 font-medium">{item.reportedTime}</Text>
                </View>
                <Text className="text-[13px] text-orange-800 mb-1">
                  👤 Passenger: <Text className="font-bold">{item.passengerName}</Text>
                </Text>
                <Text className="text-[13px] text-orange-800 mb-1">
                  📦 Item: <Text className="font-bold">{item.item}</Text>
                </Text>
                {item.seat && (
                  <Text className="text-[13px] text-orange-800 mb-1">
                    💺 Seat: <Text className="font-bold">{item.seat}</Text>
                  </Text>
                )}
                <View className="flex-row gap-2.5 mt-3">
                  <TouchableOpacity
                    className="flex-1 bg-blue-100 rounded-lg py-2.5 items-center border border-blue-300"
                    onPress={() => Alert.alert("Item Details", `${item.item} from seat ${item.seat}`)}
                  >
                    <Text className="text-blue-700 font-bold text-xs">📋 VIEW DETAILS</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="flex-1 bg-green-100 rounded-lg py-2.5 items-center border border-green-300"
                    onPress={() => handleForwardToConductor(item)}
                  >
                    <Text className="text-green-700 font-bold text-xs">➡️ FORWARD</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        ) : (
          <View className="bg-slate-50 rounded-xl p-6 items-center">
            <Text className="text-sm text-slate-500">No alerts at the moment</Text>
          </View>
        )}

        {!busChecked && (
          <TouchableOpacity
            className="bg-blue-100 rounded-xl py-3 items-center mt-3 border border-blue-300"
            onPress={handleCheckBus}
          >
            <Text className="text-blue-700 font-bold">🔍 Mark Bus Checked</Text>
          </TouchableOpacity>
        )}
        {busChecked && (
          <View className="bg-green-100 rounded-xl py-3 items-center mt-3 border border-green-300">
            <Text className="text-green-700 font-bold">✅ Bus Checked</Text>
          </View>
        )}
      </View>

      {/* Driver Summary */}
      <View className="bg-slate-50 rounded-xl p-4 mb-5 border border-slate-200">
        <Text className="text-base font-bold text-slate-800 mb-3">📊 Driver Summary</Text>
        <View className="flex-row flex-wrap gap-2.5">
          <View className="flex-1 bg-white rounded-lg p-3 items-center border border-slate-200">
            <Text className="text-xl font-bold text-blue-600 mb-1">{performanceStats.totalToday}</Text>
            <Text className="text-xs text-slate-500">Alerts Today</Text>
          </View>
          <View className="flex-1 bg-white rounded-lg p-3 items-center border border-slate-200">
            <Text className="text-xl font-bold text-blue-600 mb-1">{forwardedComplaints.length}</Text>
            <Text className="text-xs text-slate-500">Forwarded</Text>
          </View>
          <View className="flex-1 bg-white rounded-lg p-3 items-center border border-slate-200">
            <Text className="text-xl font-bold text-blue-600 mb-1">{performanceStats.recovered}</Text>
            <Text className="text-xs text-slate-500">Resolved</Text>
          </View>
          <View className="flex-1 bg-white rounded-lg p-3 items-center border border-slate-200">
            <Text className="text-xl font-bold text-blue-600 mb-1">{performanceStats.pending}</Text>
            <Text className="text-xs text-slate-500">Pending</Text>
          </View>
        </View>
      </View>

      {/* End Duty Button */}
      <TouchableOpacity
        className="bg-red-100 rounded-xl py-3.5 items-center border border-red-200"
        onPress={() => {
          setCurrentStep("positionSelection");
          setDutyStarted(false);
          setIsOnline(false);
          onLogout?.();
        }}
      >
        <Text className="text-red-600 font-semibold text-base">🚪 End Duty</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  // Render Conductor Dashboard
  const renderConductorDashboard = () => (
    <>
      {!acceptedComplaint ? (
        <ScrollView contentContainerStyle={{flexGrow:1,padding:16,paddingBottom:24}}>
          {/* Header */}
          <View className="flex-row justify-between items-center mb-5">
            <View className="flex-row items-center flex-1">
              <View className="w-[50px] h-[50px] rounded-full bg-blue-600 items-center justify-center mr-3">
                <Text className="text-white text-2xl font-bold">C</Text>
              </View>
              <View className="flex-1">
                <Text className="text-base font-bold text-slate-800">Conductor Name</Text>
                <Text className="text-sm text-slate-500">🚌 {busNumber}</Text>
              </View>
            </View>
            <Animated.View
              style={{
                transform: [
                  {
                    rotate: patrolSweepAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["-6deg", "6deg"],
                    }),
                  },
                ],
              }}
            >
              <TouchableOpacity className="relative p-2">
                <ShakyIcon name="notifications" size={24} color="#2563EB" />
                {complaints.length > 0 && (
                  <View className="absolute top-0 right-0 bg-red-500 rounded-full w-5 h-5 items-center justify-center">
                    <Text className="text-white text-xs font-bold">{complaints.length}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* Duty Status Toggle */}
          <View className="bg-slate-50 rounded-xl p-4 flex-row justify-between items-center mb-5 border border-slate-200">
            <View className="flex-row items-center">
              <View
                className={`w-3 h-3 rounded-full mr-2.5 ${isOnline?"bg-green-500":"bg-red-500"}`}
              />
              <Text className="text-base font-semibold text-slate-800">
                {isOnline ? "On Duty" : "Off Duty"}
              </Text>
            </View>
            <Switch
              value={isOnline}
              onValueChange={setIsOnline}
              trackColor={{ false: "#CBD5E1", true: "#86EFAC" }}
              thumbColor={isOnline ? "#22C55E" : "#64748B"}
            />
          </View>

          {/* Duty Information */}
          <View className="bg-slate-50 rounded-xl p-4 mb-5 border border-slate-200">
            <Text className="text-base font-bold text-slate-800 mb-3">🚍 Duty Information</Text>
            <View className="flex-row justify-between py-2.5 border-b border-slate-200">
              <Text className="text-sm text-slate-500 font-medium">Bus:</Text>
              <Text className="text-sm font-semibold text-slate-800">{busNumber}</Text>
            </View>
            <View className="flex-row justify-between py-2.5 border-b border-slate-200">
              <Text className="text-sm text-slate-500 font-medium">Route:</Text>
              <Text className="text-sm font-semibold text-slate-800">{route}</Text>
            </View>
            <View className="flex-row justify-between py-2.5 border-b border-slate-200">
              <Text className="text-sm text-slate-500 font-medium">Shift:</Text>
              <Text className="text-sm font-semibold text-slate-800">{shiftTime}</Text>
            </View>
            <View className="flex-row justify-between py-2.5 border-b border-slate-200">
              <Text className="text-sm text-slate-500 font-medium">Passengers:</Text>
              <Text className="text-sm font-semibold text-slate-800">{passengersOnboard || "—"}</Text>
            </View>
          </View>

          {/* Complaint Queue */}
          <View className="mb-5">
            <Text className="text-base font-bold text-slate-800 mb-3">🚨 Live Complaint Queue ({complaints.length})</Text>
            {complaints.length > 0 ? (
              <FlatList
                data={complaints}
                keyExtractor={(item) => item.id.toString()}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <View className="bg-blue-50 rounded-xl p-3.5 mb-3 border border-blue-200">
                    <View className="flex-row justify-between items-center mb-2">
                      <Text className="text-sm font-bold text-blue-800">Complaint #{item.id}</Text>
                      <Text className="text-xs text-blue-700">{item.reportedTime}</Text>
                    </View>
                    <View className="mb-2">
                      <Text className="text-[13px] text-blue-700 mb-1">
                        👤 <Text className="font-bold">{item.passengerName}</Text>
                      </Text>
                      <Text className="text-[13px] text-blue-700 mb-1">
                        📦 <Text className="font-bold">{item.item}</Text>
                      </Text>
                      <Text className="text-[13px] text-blue-700 mb-1">
                        💺 Seat: <Text className="font-bold">{item.seat}</Text>
                      </Text>
                    </View>
                    <View className="flex-row gap-2">
                      <TouchableOpacity
                        className="flex-1 bg-blue-100 rounded-lg py-2.5 items-center border border-blue-300"
                        onPress={() => handleCheckBus()}
                      >
                        <Text className="text-blue-700 font-bold text-xs">🔍 CHECK BUS</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        className="flex-1 bg-green-100 rounded-lg py-2.5 items-center border border-green-300"
                        onPress={() => handleAcceptComplaint(item)}
                      >
                        <Text className="text-green-700 font-bold text-xs">✅ ACCEPT</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              />
            ) : (
              <View className="bg-slate-50 rounded-xl p-6 items-center">
                <Text className="text-sm text-slate-500">No complaints</Text>
              </View>
            )}
          </View>

          {/* Performance Dashboard */}
          <View className="bg-slate-50 rounded-xl p-4 mb-5 border border-slate-200">
            <Text className="text-base font-bold text-slate-800 mb-3">📊 Performance Dashboard</Text>
            <View className="flex-row flex-wrap gap-2.5">
              <View className="flex-1 bg-white rounded-lg p-2.5 items-center border border-slate-200">
                <Text className="text-lg font-bold text-blue-600 mb-1">{performanceStats.totalToday}</Text>
                <Text className="text-[11px] text-slate-500 text-center">Total Today</Text>
              </View>
              <View className="flex-1 bg-white rounded-lg p-2.5 items-center border border-slate-200">
                <Text className="text-lg font-bold text-blue-600 mb-1">{performanceStats.recovered}</Text>
                <Text className="text-[11px] text-slate-500 text-center">Recovered</Text>
              </View>
              <View className="flex-1 bg-white rounded-lg p-2.5 items-center border border-slate-200">
                <Text className="text-lg font-bold text-blue-600 mb-1">{performanceStats.escalated}</Text>
                <Text className="text-[11px] text-slate-500 text-center">Escalated</Text>
              </View>
              <View className="flex-1 bg-white rounded-lg p-2.5 items-center border border-slate-200">
                <Text className="text-lg font-bold text-blue-600 mb-1">{performanceStats.successRate}%</Text>
                <Text className="text-[11px] text-slate-500 text-center">Success</Text>
              </View>
              <View className="flex-1 bg-white rounded-lg p-2.5 items-center border border-slate-200">
                <Text className="text-lg font-bold text-blue-600 mb-1">{performanceStats.avgResponseTime}</Text>
                <Text className="text-[11px] text-slate-500 text-center">Avg Response</Text>
              </View>
              <View className="flex-1 bg-white rounded-lg p-2.5 items-center border border-slate-200">
                <Text className="text-lg font-bold text-blue-600 mb-1">{performanceStats.pending}</Text>
                <Text className="text-[11px] text-slate-500 text-center">Pending</Text>
              </View>
            </View>
          </View>

          {/* End Duty Button */}
          <TouchableOpacity
            className="bg-red-100 rounded-xl py-3.5 items-center border border-red-200"
            onPress={() => {
              setCurrentStep("positionSelection");
              setDutyStarted(false);
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

      {/* QR Modal */}
      <Modal visible={showQRModal} transparent={true} animationType="slide">
        <SafeAreaView className="flex-1 bg-white">
          <View className="flex-row justify-between items-center px-4 py-3 border-b border-slate-200">
            <TouchableOpacity onPress={() => setShowQRModal(false)}>
              <ShakyIcon name="close" size={28} color="#2563EB" />
            </TouchableOpacity>
            <Text className="text-lg font-bold text-slate-800">QR Code Handover</Text>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView contentContainerStyle={{flexGrow:1,padding:16}}>
            <View className="items-center mb-6">
              <Text className="text-base font-bold text-slate-800 mb-4">📲 Scan Passenger's QR</Text>
              <View className="w-[200px] h-[200px] bg-slate-50 rounded-xl border-2 border-slate-300 items-center justify-center mb-4">
                <ShakyIcon name="qr-code" size={80} color="#CBD5E1" />
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
                <ShakyIcon name="qr-code" size={80} color="#CBD5E1" />
              </View>
              <Text className="text-[13px] text-slate-500 mt-3">
                Conductor QR - Let passenger scan this
              </Text>
            </View>

            <TouchableOpacity
              className="bg-green-500 rounded-xl py-3.5 items-center mt-4"
              onPress={handleCompleteHandover}
            >
              <Text className="text-white font-semibold text-base">✅ Complete Handover</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );

  // Render Accepted Complaint Flow
  const renderAcceptedComplaintFlow = () => (
    <ScrollView contentContainerStyle={{flexGrow:1,padding:16,paddingBottom:24}}>
      <View className="mb-5">
        <TouchableOpacity
          className="flex-row items-center mb-4"
          onPress={() => setAcceptedComplaint(null)}
        >
          <ShakyIcon name="arrow-back" size={24} color="#2563EB" />
          <Text className="text-blue-600 ml-2 font-semibold">Back to Dashboard</Text>
        </TouchableOpacity>
      </View>

      {/* Item Photo Step */}
      {itemConfirmation === "itemPhoto" && (
        <View>
          <Text className="text-2xl font-bold text-slate-800 mb-4">📸 Item Verification</Text>
          <View className="mb-5">
            <View className="bg-blue-50 rounded-xl p-3.5 mb-4 border border-blue-200">
              <Text className="text-sm font-bold text-blue-800 mb-2">Complaint Details</Text>
              <Text className="text-[13px] text-blue-700 mb-1">
                📦 Item: {acceptedComplaint.item}
              </Text>
              <Text className="text-[13px] text-blue-700 mb-1">
                👤 Passenger: {acceptedComplaint.passengerName}
              </Text>
              <Text className="text-[13px] text-blue-700 mb-1">
                💺 Seat: {acceptedComplaint.seat}
              </Text>
            </View>

            <TouchableOpacity className="bg-slate-50 border-2 border-blue-600 border-dashed rounded-xl py-10 items-center justify-center mb-4">
              <ShakyIcon name="camera" size={40} color="#2563EB" />
              <Text className="text-blue-600 font-semibold mt-3">Tap to Take Photo</Text>
              <Text className="text-xs text-slate-500 mt-1.5">
                Photo will be timestamped and GPS tagged
              </Text>
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
                <Text className="text-red-600 font-bold">❌ Not Found</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Meeting Details Step */}
      {itemConfirmation === "meetingDetails" && itemFound && (
        <View>
          <Text className="text-2xl font-bold text-slate-800 mb-4">� Meeting Details</Text>
          <View className="mb-5">
            <View className="mb-4">
              <Text className="text-sm font-semibold text-slate-600 mb-2">Meeting Point</Text>
              <TextInput
                className="bg-slate-50 border border-slate-300 rounded-xl py-3 px-3.5 text-sm text-slate-800"
                placeholder="Enter meeting location"
                placeholderTextColor="#CBD5E1"
                value={pickupStop}
                onChangeText={setPickupStop}
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
              className={`bg-blue-600 rounded-xl py-3.5 flex-row items-center justify-center mb-3 ${isShareingLocation?"opacity-50":""}`}
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
              <Text className="text-base font-bold text-red-600 mb-2">Item Not Found</Text>
              <Text className="text-sm text-red-600 leading-5">
                Item was not found in the bus. This incident has been recorded
                and will be flagged for further investigation.
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
              <Text className="text-white font-semibold text-base">Return to Queue</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
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
                  translateY: stepFadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [18, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {currentStep === "positionSelection" && renderPositionSelection()}
          {currentStep === "dutySetup" && renderDutySetup()}
          {currentStep === "dashboard" && position === "driver" && renderDriverDashboard()}
          {currentStep === "dashboard" && position === "conductor" && renderConductorDashboard()}
        </Animated.View>
      </SafeAreaView>
    </Animated.View>
  );
};

