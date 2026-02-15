import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Ionicons } from "@expo/vector-icons";
import { getApiBase } from "./apiConfig";
import {
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  useSafeAreaInsets,
} from "react-native";
import PassengerDashboard from "./PassengerDashboard";
import CarAutoDashboard from "./CarAutoDashboard";
import DriverConductorDashboard from "./DriverConductorDashboard";

const ROLES = ["Passenger", "Driver/Conductor", "Cab/Auto", "TTR/RPF/Police"];
const OFFICIAL_DOMAINS = {
  "TTR/RPF/Police": ["railnet.gov.in", "tnpolice.gov.in"],
};
const API_BASE = getApiBase();

const sendCode = (emailAddress) =>
  axios.post(`${API_BASE}/auth/send-verify-code`, {
    email: emailAddress,
  });

const verifyCode = (emailAddress, code) =>
  axios.post(`${API_BASE}/auth/verify-code`, {
    email: emailAddress,
    code,
  });

const App = () => {
  const [mode, setMode] = useState("login");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState("Passenger");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [officialEmail, setOfficialEmail] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [emailOtp, setEmailOtp] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [loginWithOtp, setLoginWithOtp] = useState(false);
  const [pendingApproval, setPendingApproval] = useState(false);

  const [travelType, setTravelType] = useState("");
  const [travelNumber, setTravelNumber] = useState("");
  const [travelName, setTravelName] = useState("");
  const [busDeparture, setBusDeparture] = useState("");
  const [busArrival, setBusArrival] = useState("");
  const [busStartTime, setBusStartTime] = useState("");
  const [travelRoute, setTravelRoute] = useState("");
  const [travelTiming, setTravelTiming] = useState("");
  const [driverName, setDriverName] = useState("");
  const [conductorName, setConductorName] = useState("");

  const [vehicleNumber, setVehicleNumber] = useState("");
  const [dutyRoute, setDutyRoute] = useState("");
  const [shiftTiming, setShiftTiming] = useState("");
  const [fromStop, setFromStop] = useState("");
  const [toStop, setToStop] = useState("");
  const [pnrRange, setPnrRange] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");

  const [selectedTransport, setSelectedTransport] = useState("");
  const [complaintItem, setComplaintItem] = useState("");
  const [complaintDesc, setComplaintDesc] = useState("");
  const [complaintLocation, setComplaintLocation] = useState("");
  const [complaintTime, setComplaintTime] = useState("");
  const [complaintSubmitted, setComplaintSubmitted] = useState(false);
  const [staffConfirmed, setStaffConfirmed] = useState(false);
  const [handoffComplete, setHandoffComplete] = useState(false);

  const [staffComplaintType, setStaffComplaintType] = useState("");
  const [staffComplaintTarget, setStaffComplaintTarget] = useState("");
  const [staffComplaintDetails, setStaffComplaintDetails] = useState("");
  const [staffComplaintSubmitted, setStaffComplaintSubmitted] = useState(false);

  const [error, setError] = useState("");
  const [apiStatus, setApiStatus] = useState("checking");
  const [apiError, setApiError] = useState("");
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Forgot password states
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [isResetCodeSent, setIsResetCodeSent] = useState(false);
  const [isSendingResetCode, setIsSendingResetCode] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Specific role selection for TTR/RPF/Police
  const [showRoleSelection, setShowRoleSelection] = useState(false);
  const [specificRole, setSpecificRole] = useState("");

  const formAnim = useRef(new Animated.Value(0)).current;

  const isRegister = mode === "register";
  const isOfficialRole = role === "TTR/RPF/Police";
  const isOperationalStaff = role === "Driver/Conductor" || role === "Cab/Auto";
  const otpEmail = (isOfficialRole ? officialEmail : email).trim();
  const isOtpContext = isRegister || (!isRegister && loginWithOtp);

  const getOfficialDomain = (selectedRole) => {
    const domains = OFFICIAL_DOMAINS[selectedRole];
    if (Array.isArray(domains)) {
      return domains.join(" or ");
    }
    return domains || "railnet.gov.in";
  };

  const isProfessionalIdValid = (selectedRole, idValue) => {
    const normalized = idValue.trim().toUpperCase();
    if (selectedRole === "TTR/RPF/Police") {
      return (
        /^TNPOLICE-\d{4,6}$/.test(normalized) ||
        /^(TTR|RPF)-[A-Z]{2,3}-\d{4,6}$/.test(normalized)
      );
    }
    return normalized.length >= 6;
  };

  const inferSpecificRoleFromId = (idValue) => {
    const normalized = (idValue || "").trim().toUpperCase();
    if (normalized.startsWith("TNPOLICE-")) {
      return "Police";
    }
    if (normalized.startsWith("TTR-")) {
      return "TTR";
    }
    if (normalized.startsWith("RPF-")) {
      return "RPF";
    }
    return "";
  };

  const isOfficialEmailValid = (selectedRole, emailValue) => {
    const trimmed = emailValue.trim().toLowerCase();
    const domains = OFFICIAL_DOMAINS[selectedRole];
    if (!trimmed || !domains) {
      return false;
    }
    if (Array.isArray(domains)) {
      return domains.some((domain) => trimmed.endsWith(`@${domain}`));
    }
    return trimmed.endsWith(`@${domains}`);
  };

  const isValidEmail = (emailValue) => {
    const trimmed = (emailValue || "").trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  };

  const canVerify = useMemo(() => {
    return /^\d{6}$/.test(emailOtp.trim());
  }, [emailOtp]);

  const canSubmit = useMemo(() => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    const baseRegisterReady =
      name.trim().length >= 2 &&
      phone.trim().length >= 8 &&
      trimmedPassword.length >= 6 &&
      confirmPassword.trim().length >= 6;

    if (isRegister) {
      if (!baseRegisterReady) {
        return false;
      }

      if (isOfficialRole) {
        return (
          isProfessionalIdValid(role, professionalId) &&
          isValidEmail(officialEmail) &&
          isVerified &&
          pnrRange.trim().length >= 5 &&
          jurisdiction.trim().length >= 3
        );
      }

      const emailReady = trimmedEmail.length >= 5 && isVerified;
      if (!emailReady) {
        return false;
      }

      if (role === "Passenger") {
        if (travelType === "Bus") {
          return (
            travelNumber.trim().length >= 5 &&
            busDeparture.trim().length >= 2 &&
            busArrival.trim().length >= 2 &&
            busStartTime.trim().length >= 3
          );
        }

        return (
          travelType.trim().length > 0 &&
          travelNumber.trim().length >= 5 &&
          travelName.trim().length >= 2 &&
          travelRoute.trim().length >= 3 &&
          travelTiming.trim().length >= 4
        );
      }

      if (isOperationalStaff) {
        return (
          vehicleNumber.trim().length >= 5 &&
          dutyRoute.trim().length >= 3 &&
          shiftTiming.trim().length >= 3 &&
          fromStop.trim().length >= 2 &&
          toStop.trim().length >= 2
        );
      }

      return false;
    }

    if (isOfficialRole) {
      return (
        isProfessionalIdValid(role, professionalId) &&
        trimmedPassword.length >= 6
      );
    }

    if (loginWithOtp) {
      return otpEmail.length >= 5 && isVerified;
    }

    return trimmedEmail.length >= 5 && trimmedPassword.length >= 6;
  }, [
    confirmPassword,
    busArrival,
    busDeparture,
    busStartTime,
    dutyRoute,
    email,
    fromStop,
    isOfficialRole,
    isRegister,
    isVerified,
    jurisdiction,
    loginWithOtp,
    name,
    otpEmail,
    officialEmail,
    password,
    phone,
    pnrRange,
    professionalId,
    role,
    shiftTiming,
    toStop,
    travelNumber,
    travelName,
    travelRoute,
    travelTiming,
    travelType,
    vehicleNumber,
  ]);

  useEffect(() => {
    let isMounted = true;

    const checkHealth = async () => {
      try {
        const { data } = await axios.get(`${API_BASE}/health`);
        if (!isMounted) {
          return;
        }
        if (data?.status === "ok") {
          setApiStatus("online");
        } else {
          setApiStatus("degraded");
        }
      } catch (err) {
        if (!isMounted) {
          return;
        }
        setApiStatus("offline");
        setApiError(
          err?.response?.data?.message || "Backend health check failed.",
        );
      }
    };

    checkHealth();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      return;
    }

    formAnim.setValue(0);
    Animated.timing(formAnim, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [formAnim, isAuthenticated, mode]);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      "keyboardDidShow",
      () => {
        setKeyboardVisible(true);
      },
    );
    const keyboardDidHideListener = Keyboard.addListener(
      "keyboardDidHide",
      () => {
        setKeyboardVisible(false);
      },
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  const resetForm = () => {
    setName("");
    setPhone("");
    setEmail("");
    setOfficialEmail("");
    setProfessionalId("");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    setEmailOtp("");
    setIsVerified(false);
    setIsOtpSent(false);
    setIsSendingOtp(false);
    setLoginWithOtp(false);
    setTravelType("");
    setTravelNumber("");
    setTravelName("");
    setBusDeparture("");
    setBusArrival("");
    setBusStartTime("");
    setTravelRoute("");
    setTravelTiming("");
    setDriverName("");
    setConductorName("");
    setVehicleNumber("");
    setDutyRoute("");
    setShiftTiming("");
    setFromStop("");
    setToStop("");
    setPnrRange("");
    setJurisdiction("");
    setStaffComplaintType("");
    setStaffComplaintTarget("");
    setStaffComplaintDetails("");
    setStaffComplaintSubmitted(false);
    setForgotPasswordMode(false);
    setResetCode("");
    setNewPassword("");
    setConfirmNewPassword("");
    setShowNewPassword(false);
    setShowConfirmNewPassword(false);
    setIsResetCodeSent(false);
    setIsSendingResetCode(false);
    setResetSuccess(false);
    setShowRoleSelection(false);
    setSpecificRole("");
    setError("");
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      setError("Please complete all required fields.");
      return;
    }

    if (isRegister && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!isRegister && isOfficialRole && pendingApproval) {
      setError("Your account is pending admin approval. Please try later.");
      return;
    }

    if (isRegister && isOfficialRole && !isVerified) {
      setError("Verify your official email before registering.");
      return;
    }

    setError("");

    if (isRegister) {
      const isBusTravel = travelType === "Bus";
      const resolvedTravelRoute = isBusTravel
        ? `${busDeparture.trim()} -> ${busArrival.trim()}`
        : travelRoute.trim();
      const resolvedTravelTiming = isBusTravel
        ? busStartTime.trim()
        : travelTiming.trim();

      try {
        await axios.post(`${API_BASE}/auth/register`, {
          role,
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim().toLowerCase(),
          officialEmail: officialEmail.trim().toLowerCase(),
          professionalId: professionalId.trim(),
          password: password.trim(),
          isVerified,
          travelType: travelType.trim(),
          travelNumber: travelNumber.trim(),
          travelName: travelName.trim(),
          travelRoute: resolvedTravelRoute,
          travelTiming: resolvedTravelTiming,
          driverName: driverName.trim(),
          conductorName: conductorName.trim(),
          vehicleNumber: vehicleNumber.trim(),
          dutyRoute: dutyRoute.trim(),
          shiftTiming: shiftTiming.trim(),
          fromStop: fromStop.trim(),
          toStop: toStop.trim(),
          pnrRange: pnrRange.trim(),
          jurisdiction: jurisdiction.trim(),
        });

        if (isOfficialRole) {
          setPendingApproval(true);
          setMode("login");
          setPassword("");
          setConfirmPassword("");
          setEmailOtp("");
          setIsVerified(false);
          setIsOtpSent(false);
          setError(
            "Registration submitted. Admin approval takes up to 24 hours.",
          );
          return;
        }

        setIsAuthenticated(true);
        return;
      } catch (err) {
        const message =
          err?.response?.data?.message || "Unable to register account.";
        setError(message);
        return;
      }
    }

    if (!isRegister && isOfficialRole) {
      try {
        const { data } = await axios.post(`${API_BASE}/auth/login`, {
          role,
          professionalId: professionalId.trim(),
          password: password.trim(),
          method: "password",
        });

        const profile = data?.user;
        if (!profile) {
          setError("Unable to load profile for this account.");
          return;
        }

        setName(profile.name || "");
        setOfficialEmail(profile.officialEmail || profile.email || "");
        setProfessionalId(profile.professionalId || professionalId);
        setJurisdiction(profile.jurisdiction || "");
        setPnrRange(profile.pnrRange || "");

        const inferredRole = inferSpecificRoleFromId(
          profile.professionalId || professionalId,
        );

        if (inferredRole) {
          setSpecificRole(inferredRole);
          setShowRoleSelection(false);
          setIsAuthenticated(true);
        } else {
          setShowRoleSelection(true);
        }
      } catch (err) {
        const message = err?.response?.data?.message || "Unable to log in.";
        setPendingApproval(message.toLowerCase().includes("pending"));
        setError(message);
      }
      return;
    }

    setIsAuthenticated(true);
  };

  const handleSpecificRoleSelection = () => {
    if (!specificRole) {
      setError("Please select your specific role.");
      return;
    }
    setError("");
    setIsAuthenticated(true);
  };

  const handleSwitchMode = () => {
    setMode((prev) => (prev === "login" ? "register" : "login"));
    resetForm();
  };

  const handleRoleChange = (nextRole) => {
    setRole(nextRole);
    setEmailOtp("");
    setIsVerified(false);
    setIsOtpSent(false);
    setIsSendingOtp(false);
    setLoginWithOtp(false);
    setPendingApproval(false);
    setError("");
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setMode("login");
    setComplaintSubmitted(false);
    setStaffConfirmed(false);
    setHandoffComplete(false);
    setStaffComplaintSubmitted(false);
    setShowRoleSelection(false);
    setSpecificRole("");
    resetForm();
  };

  const handleSendOtp = async () => {
    if (!isValidEmail(otpEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    setError("");
    setIsVerified(false);
    setIsOtpSent(false);
    setEmailOtp("");
    setIsSendingOtp(true);

    try {
      const { data } = await sendCode(otpEmail);
      const sent = Boolean(data?.sent || data?.devCode);
      setIsOtpSent(sent);
      if (!sent && data?.message) {
        setError(data.message);
      }
    } catch (err) {
      const message =
        err?.response?.data?.message || "Unable to send verification code.";
      setError(message);
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerify = async () => {
    if (!canVerify) {
      setError("Enter valid OTP to verify.");
      return;
    }

    setError("");

    try {
      await verifyCode(otpEmail, emailOtp.trim());
      setIsVerified(true);
    } catch (err) {
      const message = err?.response?.data?.message || "Unable to verify code.";
      setIsVerified(false);
      setError(message);
    }
  };

  const handleSendResetCode = async () => {
    const trimmedEmail = officialEmail.trim().toLowerCase();

    // Basic email validation
    if (trimmedEmail.length < 5 || !trimmedEmail.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }

    // Check if it's an official domain (but don't block if not - let backend validate)
    if (!isOfficialEmailValid(role, officialEmail)) {
      setError(
        `Please use your official ${getOfficialDomain(role)} email address.`,
      );
      return;
    }

    setError("");
    setIsResetCodeSent(false);
    setResetCode("");
    setIsSendingResetCode(true);

    try {
      const { data } = await sendCode(trimmedEmail);
      const sent = Boolean(data?.sent || data?.devCode);
      setIsResetCodeSent(sent);
      if (!sent && data?.message) {
        setError(data.message);
      }
    } catch (err) {
      const message =
        err?.response?.data?.message || "Unable to send verification code.";
      setError(message);
    } finally {
      setIsSendingResetCode(false);
    }
  };

  const handleResetPassword = async () => {
    if (resetCode.trim().length !== 6) {
      setError("Enter valid 6-digit verification code.");
      return;
    }
    if (newPassword.trim().length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError("");

    try {
      // Use the new OTP-based password reset endpoint
      await axios.post(`${API_BASE}/auth/reset-password-otp`, {
        officialEmail: officialEmail.trim().toLowerCase(),
        otpCode: resetCode.trim(),
        newPassword: newPassword.trim(),
      });

      setResetSuccess(true);
      setError("");
      setTimeout(() => {
        setForgotPasswordMode(false);
        setResetSuccess(false);
        setResetCode("");
        setNewPassword("");
        setConfirmNewPassword("");
        setIsResetCodeSent(false);
        setOfficialEmail("");
      }, 2000);
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        "Unable to verify code or reset password.";
      setError(message);
    }
  };

  const handleSendResetCodeUser = async () => {
    const trimmedEmail = email.trim().toLowerCase();

    // Basic email validation
    if (trimmedEmail.length < 5 || !trimmedEmail.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }

    setError("");
    setIsResetCodeSent(false);
    setResetCode("");
    setIsSendingResetCode(true);

    try {
      const { data } = await sendCode(trimmedEmail);
      const sent = Boolean(data?.sent || data?.devCode);
      setIsResetCodeSent(sent);
      if (!sent && data?.message) {
        setError(data.message);
      }
    } catch (err) {
      const message =
        err?.response?.data?.message || "Unable to send verification code.";
      setError(message);
    } finally {
      setIsSendingResetCode(false);
    }
  };

  const handleResetPasswordUser = async () => {
    if (resetCode.trim().length !== 6) {
      setError("Enter valid 6-digit verification code.");
      return;
    }
    if (newPassword.trim().length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError("");

    try {
      await axios.post(`${API_BASE}/auth/reset-password-user`, {
        email: email.trim().toLowerCase(),
        otpCode: resetCode.trim(),
        newPassword: newPassword.trim(),
      });

      setResetSuccess(true);
      setError("");
      setTimeout(() => {
        setForgotPasswordMode(false);
        setResetSuccess(false);
        setResetCode("");
        setNewPassword("");
        setConfirmNewPassword("");
        setIsResetCodeSent(false);
        setEmail("");
      }, 2000);
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        "Unable to verify code or reset password.";
      setError(message);
    }
  };

  const handleSubmitComplaint = () => {
    if (
      complaintItem.trim().length < 2 ||
      complaintDesc.trim().length < 6 ||
      complaintLocation.trim().length < 2 ||
      complaintTime.trim().length < 3
    ) {
      setError("Add item, description, location, and time.");
      return;
    }
    setError("");
    setComplaintSubmitted(true);
    setStaffConfirmed(false);
    setHandoffComplete(false);
  };

  const handleStaffConfirm = () => {
    setStaffConfirmed(true);
  };

  const handleHandoffComplete = () => {
    setHandoffComplete(true);
  };

  const handleSubmitStaffComplaint = () => {
    if (
      staffComplaintType.trim().length < 2 ||
      staffComplaintTarget.trim().length < 2 ||
      staffComplaintDetails.trim().length < 6
    ) {
      setError("Please fill all complaint fields with valid information.");
      return;
    }
    setError("");
    setStaffComplaintSubmitted(true);
  };

  const renderRoleSelector = () => (
    <View style={styles.roleRow}>
      {ROLES.map((item) => (
        <TouchableOpacity
          key={item}
          style={[styles.roleChip, role === item && styles.roleChipActive]}
          onPress={() => handleRoleChange(item)}
        >
          <Text
            style={[
              styles.roleChipText,
              role === item && styles.roleChipTextActive,
            ]}
          >
            {item}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderPassengerDashboard = () => (
    <View>
      <Text style={styles.sectionTitle}>Passenger Command Center</Text>
      <Text style={styles.sectionSubtitle}>
        Live complaint matching + recovery tracking for your trip.
      </Text>

      <View style={styles.cardBlock}>
        <Text style={styles.cardTitle}>Report Lost Item</Text>
        <Text style={styles.label}>
          In which transport did you lose your item?
        </Text>
        <View style={styles.transportGrid}>
          <View style={styles.transportRow}>
            <TouchableOpacity
              style={[
                styles.transportButton,
                selectedTransport === "Train" && styles.transportButtonSelected,
              ]}
              onPress={() => setSelectedTransport("Train")}
              activeOpacity={0.7}
            >
              <Text style={styles.transportIcon}>🚆</Text>
              <Text
                style={[
                  styles.transportButtonText,
                  selectedTransport === "Train" &&
                    styles.transportButtonTextSelected,
                ]}
              >
                Train
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.transportButton,
                selectedTransport === "Car" && styles.transportButtonSelected,
              ]}
              onPress={() => setSelectedTransport("Car")}
              activeOpacity={0.7}
            >
              <Text style={styles.transportIcon}>🚗</Text>
              <Text
                style={[
                  styles.transportButtonText,
                  selectedTransport === "Car" &&
                    styles.transportButtonTextSelected,
                ]}
              >
                Car
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.transportRow}>
            <TouchableOpacity
              style={[
                styles.transportButton,
                selectedTransport === "Bus" && styles.transportButtonSelected,
              ]}
              onPress={() => setSelectedTransport("Bus")}
              activeOpacity={0.7}
            >
              <Text style={styles.transportIcon}>🚌</Text>
              <Text
                style={[
                  styles.transportButtonText,
                  selectedTransport === "Bus" &&
                    styles.transportButtonTextSelected,
                ]}
              >
                Bus
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.transportButton,
                selectedTransport === "Auto" && styles.transportButtonSelected,
              ]}
              onPress={() => setSelectedTransport("Auto")}
              activeOpacity={0.7}
            >
              <Text style={styles.transportIcon}>🛺</Text>
              <Text
                style={[
                  styles.transportButtonText,
                  selectedTransport === "Auto" &&
                    styles.transportButtonTextSelected,
                ]}
              >
                Auto
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {selectedTransport && (
        <View style={styles.cardBlock}>
          <Text style={styles.cardTitle}>Raise Geo-Tagged Complaint</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Lost item</Text>
            <TextInput
              style={styles.input}
              placeholder="Backpack / Phone / Documents"
              placeholderTextColor="#94A3B8"
              value={complaintItem}
              onChangeText={setComplaintItem}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={styles.input}
              placeholder="Color, brand, contents"
              placeholderTextColor="#94A3B8"
              value={complaintDesc}
              onChangeText={setComplaintDesc}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Last seen location</Text>
            <TextInput
              style={styles.input}
              placeholder="Medavakkam / Stop name"
              placeholderTextColor="#94A3B8"
              value={complaintLocation}
              onChangeText={setComplaintLocation}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Time</Text>
            <TextInput
              style={styles.input}
              placeholder="10:05AM"
              placeholderTextColor="#94A3B8"
              value={complaintTime}
              onChangeText={setComplaintTime}
            />
          </View>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleSubmitComplaint}
          >
            <Text style={styles.primaryButtonText}>Submit complaint</Text>
          </TouchableOpacity>
        </View>
      )}

      {complaintSubmitted && (
        <View style={styles.cardBlock}>
          <Text style={styles.cardTitle}>Matched Onboard Staff</Text>
          <Text style={styles.cardText}>Conductor Priya S • TN-01-AB-1234</Text>
          <Text style={styles.cardText}>Route: Velachery → CMBT</Text>
          <Text style={styles.cardText}>
            Current stop: Medavakkam • ETA 8 mins
          </Text>
          <View style={styles.statusRow}>
            <View style={styles.statusDotLarge} />
            <Text style={styles.statusText}>
              Alert delivered in 58 seconds via push + SMS + voice.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleStaffConfirm}
          >
            <Text style={styles.secondaryButtonText}>
              Simulate staff update
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {staffConfirmed && (
        <View style={styles.cardBlock}>
          <Text style={styles.cardTitle}>Live Recovery Tracking</Text>
          <Text style={styles.cardText}>Status: Item SAFE ✅</Text>
          <Text style={styles.cardText}>Collect at Guindy 10:15AM 📍</Text>
          <Text style={styles.cardText}>Live ETA: 11 mins</Text>
          <View style={styles.timelineRow}>
            <View style={styles.timelineDotActive} />
            <View>
              <Text style={styles.timelineTitle}>
                Complaint → Staff Confirmation
              </Text>
              <Text style={styles.timelineSubtitle}>
                Matched on vehicle + timing + geo-location
              </Text>
            </View>
          </View>
          <View style={styles.timelineRow}>
            <View style={styles.timelineDot} />
            <View>
              <Text style={styles.timelineTitle}>Rendezvous QR Pickup</Text>
              <Text style={styles.timelineSubtitle}>
                Scan QR to close custody log
              </Text>
            </View>
          </View>
        </View>
      )}

      <View style={styles.cardBlock}>
        <Text style={styles.cardTitle}>Complaint About TTR/TTE Staff</Text>
        <Text style={styles.sectionSubtitle}>
          Report misconduct or issues with railway staff members
        </Text>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Complaint Type</Text>
          <TextInput
            style={styles.input}
            placeholder="Misbehavior / Negligence / Corruption / Other"
            placeholderTextColor="#94A3B8"
            value={staffComplaintType}
            onChangeText={setStaffComplaintType}
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Staff Member (TTR/TTE)</Text>
          <TextInput
            style={styles.input}
            placeholder="Name / Badge Number / Physical description"
            placeholderTextColor="#94A3B8"
            value={staffComplaintTarget}
            onChangeText={setStaffComplaintTarget}
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Details of Incident</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe the incident in detail..."
            placeholderTextColor="#94A3B8"
            value={staffComplaintDetails}
            onChangeText={setStaffComplaintDetails}
            multiline
            numberOfLines={4}
          />
        </View>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleSubmitStaffComplaint}
        >
          <Text style={styles.primaryButtonText}>Submit Staff Complaint</Text>
        </TouchableOpacity>
      </View>

      {staffComplaintSubmitted && (
        <View style={styles.cardBlock}>
          <Text style={styles.cardTitle}>Complaint Status</Text>
          <Text style={styles.successText}>
            ✅ Complaint submitted successfully
          </Text>
          <Text style={styles.cardText}>
            Complaint ID: SC-{Math.floor(Math.random() * 100000)}
          </Text>
          <Text style={styles.cardText}>Status: Under Review</Text>
          <Text style={styles.cardText}>
            Assigned to: Railway Grievance Cell
          </Text>
          <View style={styles.statusRow}>
            <View style={styles.statusDotLarge} />
            <Text style={styles.statusText}>
              Your complaint has been forwarded to senior railway authorities.
              You will receive updates via SMS and email.
            </Text>
          </View>
          <Text style={styles.cardText}>
            Expected resolution: 7-10 working days
          </Text>
        </View>
      )}
    </View>
  );

  const renderStaffDashboard = () => {
    const displayName = name.trim() || "Staff Member";
    const displayEmail = email.trim() || "Not set";
    const displayPhone = phone.trim() || "Not set";
    const displayVehicleNumber = vehicleNumber.trim() || "Not set";
    const displayRoute = dutyRoute.trim() || "Not set";
    const displayShift = shiftTiming.trim() || "Not set";
    const displayFromStop = fromStop.trim() || "Not set";
    const displayToStop = toStop.trim() || "Not set";

    return (
      <View>
        {/* Staff Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{displayName}</Text>
              <Text style={styles.profileRole}>{role}</Text>
            </View>
          </View>

          <View style={styles.profileDetails}>
            <View style={styles.profileDetailRow}>
              <Text style={styles.profileDetailLabel}>Email:</Text>
              <Text style={styles.profileDetailValue}>{displayEmail}</Text>
            </View>
            <View style={styles.profileDetailRow}>
              <Text style={styles.profileDetailLabel}>Phone:</Text>
              <Text style={styles.profileDetailValue}>{displayPhone}</Text>
            </View>
            <View style={styles.profileDetailRow}>
              <Text style={styles.profileDetailLabel}>Vehicle:</Text>
              <Text style={styles.profileDetailValue}>
                {displayVehicleNumber}
              </Text>
            </View>
            <View style={styles.profileDetailRow}>
              <Text style={styles.profileDetailLabel}>Route:</Text>
              <Text style={styles.profileDetailValue}>{displayRoute}</Text>
            </View>
            <View style={styles.profileDetailRow}>
              <Text style={styles.profileDetailLabel}>Shift:</Text>
              <Text style={styles.profileDetailValue}>{displayShift}</Text>
            </View>
            <View style={styles.profileDetailRow}>
              <Text style={styles.profileDetailLabel}>Stops:</Text>
              <Text style={styles.profileDetailValue}>
                {displayFromStop} → {displayToStop}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>{role} Duty Dashboard</Text>
        <Text style={styles.sectionSubtitle}>
          Live queue, QR handoffs, and custody logs for your duty roster.
        </Text>

        <View style={styles.cardBlock}>
          <Text style={styles.cardTitle}>Active Complaint Queue</Text>
          <View style={styles.queueItem}>
            <View>
              <Text style={styles.queueTitle}>Black backpack</Text>
              <Text style={styles.queueMeta}>
                TN-01-AB-1234 • Stop: Medavakkam
              </Text>
            </View>
            <Text style={styles.queueStatus}>NEW</Text>
          </View>
          <View style={styles.queueItem}>
            <View>
              <Text style={styles.queueTitle}>Passport pouch</Text>
              <Text style={styles.queueMeta}>Route: Velachery → CMBT</Text>
            </View>
            <Text style={styles.queueStatusAmber}>HIGH</Text>
          </View>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleStaffConfirm}
          >
            <Text style={styles.primaryButtonText}>Mark item SAFE</Text>
          </TouchableOpacity>
        </View>

        {staffConfirmed && (
          <View style={styles.cardBlock}>
            <Text style={styles.cardTitle}>Custody & Handoff</Text>
            <Text style={styles.cardText}>Item tagged: QR-8721</Text>
            <Text style={styles.cardText}>Pickup window: 10:15AM @ Guindy</Text>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleHandoffComplete}
            >
              <Text style={styles.secondaryButtonText}>Scan QR handoff</Text>
            </TouchableOpacity>
            {handoffComplete && (
              <Text style={styles.successText}>
                Handoff complete. Custody log updated.
              </Text>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderTtrDashboard = () => {
    const displayName = name.trim() || "Officer";
    const displayEmail = officialEmail.trim() || "Not set";
    const displayProfessionalId = professionalId.trim() || "Not set";
    const displayRole = specificRole || "TTR/RPF";
    const displayJurisdiction = jurisdiction.trim() || "Not set";
    const displayPnrRange = pnrRange.trim() || "Not set";

    return (
      <View>
        {/* Professional Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{displayName}</Text>
              <Text style={styles.profileRole}>{displayRole} Officer</Text>
            </View>
          </View>

          <View style={styles.profileDetails}>
            <View style={styles.profileDetailRow}>
              <Text style={styles.profileDetailLabel}>Professional ID:</Text>
              <Text style={styles.profileDetailValue}>
                {displayProfessionalId}
              </Text>
            </View>
            <View style={styles.profileDetailRow}>
              <Text style={styles.profileDetailLabel}>Official Email:</Text>
              <Text style={styles.profileDetailValue}>{displayEmail}</Text>
            </View>
            <View style={styles.profileDetailRow}>
              <Text style={styles.profileDetailLabel}>Jurisdiction:</Text>
              <Text style={styles.profileDetailValue}>
                {displayJurisdiction}
              </Text>
            </View>
            <View style={styles.profileDetailRow}>
              <Text style={styles.profileDetailLabel}>PNR Range:</Text>
              <Text style={styles.profileDetailValue}>{displayPnrRange}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>TTR/RPF Escalations</Text>
        <Text style={styles.sectionSubtitle}>
          High-value items with PNR verification and chain-of-custody logs.
        </Text>
        <View style={styles.cardBlock}>
          <Text style={styles.cardTitle}>Priority Alerts</Text>
          <Text style={styles.cardText}>PNR: 4528193021 • Passport + Visa</Text>
          <Text style={styles.cardText}>Train: MS-EXP-204 • Coach B2</Text>
          <Text style={styles.cardText}>Next stop: Guindy • ETA 9 mins</Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleStaffConfirm}
          >
            <Text style={styles.primaryButtonText}>Verify PNR & confirm</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderPoliceDashboard = () => {
    const displayName = name.trim() || "Officer";
    const displayEmail = officialEmail.trim() || "Not set";
    const displayProfessionalId = professionalId.trim() || "Not set";
    const displayRole = specificRole || "Police";
    const displayJurisdiction = jurisdiction.trim() || "Not set";
    const displayPnrRange = pnrRange.trim() || "Not set";

    return (
      <View>
        {/* Professional Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{displayName}</Text>
              <Text style={styles.profileRole}>{displayRole} Officer</Text>
            </View>
          </View>

          <View style={styles.profileDetails}>
            <View style={styles.profileDetailRow}>
              <Text style={styles.profileDetailLabel}>Professional ID:</Text>
              <Text style={styles.profileDetailValue}>
                {displayProfessionalId}
              </Text>
            </View>
            <View style={styles.profileDetailRow}>
              <Text style={styles.profileDetailLabel}>Official Email:</Text>
              <Text style={styles.profileDetailValue}>{displayEmail}</Text>
            </View>
            <View style={styles.profileDetailRow}>
              <Text style={styles.profileDetailLabel}>Jurisdiction:</Text>
              <Text style={styles.profileDetailValue}>
                {displayJurisdiction}
              </Text>
            </View>
            <View style={styles.profileDetailRow}>
              <Text style={styles.profileDetailLabel}>PNR Range:</Text>
              <Text style={styles.profileDetailValue}>{displayPnrRange}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Police Command Console</Text>
        <Text style={styles.sectionSubtitle}>
          Cross-jurisdiction recovery for medical, passport, and legal items.
        </Text>
        <View style={styles.cardBlock}>
          <Text style={styles.cardTitle}>Jurisdiction Escalations</Text>
          <Text style={styles.cardText}>
            Medical dossier flagged • Case ID 98-204
          </Text>
          <Text style={styles.cardText}>
            Location: CMBT • Linked staff: RPF-114
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleStaffConfirm}
          >
            <Text style={styles.primaryButtonText}>Dispatch unit</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderDashboard = () => {
    if (role === "Passenger") {
      const trimmedEmail = email.trim();
      const displayName =
        name.trim() ||
        (trimmedEmail ? trimmedEmail.split("@")[0] : "Passenger");
      const displayPhone = phone.trim() || "Not set";

      return (
        <PassengerDashboard
          userEmail={trimmedEmail}
          userName={displayName}
          userPhone={displayPhone}
          onLogout={handleLogout}
        />
      );
    }

    // Handle Cab/Auto Driver
    if (role === "Cab/Auto") {
      return <CarAutoDashboard onLogout={handleLogout} />;
    }

    // Handle Driver/Conductor
    if (role === "Driver/Conductor") {
      return <DriverConductorDashboard onLogout={handleLogout} />;
    }

    // Handle TTR/RPF/Police based on specific role selection
    if (role === "TTR/RPF/Police") {
      if (specificRole === "TTR" || specificRole === "RPF") {
        return renderTtrDashboard();
      }
      if (specificRole === "Police") {
        return renderPoliceDashboard();
      }
      // Default to TTR dashboard if no specific role selected yet
      return renderTtrDashboard();
    }

    return renderStaffDashboard();
  };

  const usesInternalScroll =
    role === "Passenger" || role === "Cab/Auto" || role === "Driver/Conductor";
  const showStandaloneLogout = !usesInternalScroll && role !== "Passenger";

  const renderAuthenticatedContent = () => {
    if (usesInternalScroll) {
      return <View style={styles.authenticatedContent}>{renderDashboard()}</View>;
    }

    return (
      <ScrollView contentContainerStyle={styles.authenticatedScrollContent}>
        {renderDashboard()}
        {showStandaloneLogout && (
          <TouchableOpacity
            style={[styles.secondaryButton, styles.logoutButtonFull]}
            onPress={handleLogout}
          >
            <Text style={styles.secondaryButtonText}>Log out</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    );
  };

  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      {isAuthenticated ? (
        <View style={styles.authenticatedContainer}>
          {renderAuthenticatedContent()}
        </View>
      ) : (
        <>
          <View style={styles.backgroundGlow} />
          <KeyboardAvoidingView
            style={styles.keyboardAvoidingView}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <ScrollView
                contentContainerStyle={[
                  styles.scrollContent,
                  !keyboardVisible && styles.scrollContentCentered,
                ]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={true}
                bounces={true}
                nestedScrollEnabled={true}
              >
                <View style={styles.card}>
                  <View style={styles.brandRow}>
                    <View>
                      <Text style={styles.title}>SafeRide Guardian</Text>
                      <Text style={styles.subtitle}>
                        AI-powered role-based recovery for buses, trains, cabs,
                        autos.
                      </Text>
                      <View style={styles.statusBadgeRow}>
                        <View
                          style={[
                            styles.statusBadge,
                            apiStatus === "online"
                              ? styles.statusBadgeOnline
                              : apiStatus === "offline"
                                ? styles.statusBadgeOffline
                                : styles.statusBadgeChecking,
                          ]}
                        >
                          <Text style={styles.statusBadgeText}>
                            {apiStatus === "online"
                              ? "Backend online"
                              : apiStatus === "offline"
                                ? "Backend offline"
                                : "Checking backend..."}
                          </Text>
                        </View>
                      </View>
                      {apiStatus === "offline" && apiError.length > 0 && (
                        <Text style={styles.apiErrorText}>{apiError}</Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.divider} />

                {showRoleSelection ? (
                  <View>
                    <View style={styles.backButtonRow}>
                      <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => {
                          setShowRoleSelection(false);
                          setSpecificRole("");
                          setError("");
                        }}
                      >
                        <Ionicons name="arrow-back" size={24} color="#2563EB" />
                      </TouchableOpacity>
                      <Text style={styles.formTitle}>
                        Select Your Specific Role
                      </Text>
                      <View style={{ width: 24 }} />
                    </View>
                    <Text style={styles.sectionSubtitle}>
                      Please specify which department you belong to
                    </Text>

                    <View style={styles.cardBlock}>
                      <View style={styles.roleRow}>
                        {["TTR", "RPF", "Police"].map((item) => (
                          <TouchableOpacity
                            key={item}
                            style={[
                              styles.roleChipLarge,
                              specificRole === item && styles.roleChipActive,
                            ]}
                            onPress={() => setSpecificRole(item)}
                          >
                            <Text
                              style={[
                                styles.roleChipTextLarge,
                                specificRole === item &&
                                  styles.roleChipTextActive,
                              ]}
                            >
                              {item}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      <View style={styles.roleDescriptions}>
                        {specificRole === "TTR" && (
                          <View style={styles.roleDescCard}>
                            <Text style={styles.roleDescTitle}>
                              🚂 Travelling Ticket Examiner (TTR)
                            </Text>
                            <Text style={styles.roleDescText}>
                              Responsible for ticket checking, passenger
                              assistance, and onboard security in trains.
                            </Text>
                          </View>
                        )}
                        {specificRole === "RPF" && (
                          <View style={styles.roleDescCard}>
                            <Text style={styles.roleDescTitle}>
                              🛡️ Railway Protection Force (RPF)
                            </Text>
                            <Text style={styles.roleDescText}>
                              Railway security force responsible for protecting
                              railway property, passengers, and freight.
                            </Text>
                          </View>
                        )}
                        {specificRole === "Police" && (
                          <View style={styles.roleDescCard}>
                            <Text style={styles.roleDescTitle}>
                              👮 Police Department
                            </Text>
                            <Text style={styles.roleDescText}>
                              Law enforcement officers handling criminal cases,
                              investigations, and public safety.
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {error.length > 0 && (
                      <Text style={styles.errorText}>{error}</Text>
                    )}

                    <TouchableOpacity
                      style={[
                        styles.primaryButton,
                        !specificRole && styles.buttonDisabled,
                      ]}
                      onPress={handleSpecificRoleSelection}
                      disabled={!specificRole}
                    >
                      <Text style={styles.primaryButtonText}>Continue</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View>
                    <Text style={styles.formTitle}>
                      {isRegister ? "Create your account" : "Sign in to continue"}
                    </Text>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Select role</Text>
                    {renderRoleSelector()}
                  </View>

                  {isRegister && (
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Full name</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Enter your name"
                        placeholderTextColor="#94A3B8"
                        value={name}
                        onChangeText={setName}
                        autoCapitalize="words"
                      />
                    </View>
                  )}

                  {isRegister && (
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Mobile number</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="+91 98765 43210"
                        placeholderTextColor="#94A3B8"
                        value={phone}
                        onChangeText={setPhone}
                        keyboardType="phone-pad"
                      />
                    </View>
                  )}

                  {!isOfficialRole && (
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Email address</Text>
                      <TextInput
                        style={[
                          styles.input,
                          isRegister && isVerified && styles.inputDisabled,
                        ]}
                        placeholder="you@example.com"
                        placeholderTextColor="#94A3B8"
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        editable={!(isRegister && isVerified)}
                      />
                    </View>
                  )}

                  {isOfficialRole && !forgotPasswordMode && (
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Professional ID</Text>
                      <TextInput
                        style={styles.input}
                        placeholder={
                          role === "Police" ? "TNPolice-45678" : "TTR-SR-12345"
                        }
                        placeholderTextColor="#94A3B8"
                        value={professionalId}
                        onChangeText={setProfessionalId}
                        autoCapitalize="characters"
                      />
                    </View>
                  )}

                  {isRegister && isOfficialRole && (
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Official email</Text>
                      <TextInput
                        style={[
                          styles.input,
                          isVerified && styles.inputDisabled,
                        ]}
                        placeholder={`name@${getOfficialDomain(role)}`}
                        placeholderTextColor="#94A3B8"
                        value={officialEmail}
                        onChangeText={setOfficialEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        editable={!isVerified}
                      />
                      <Text style={styles.helperText}>
                        Use your {getOfficialDomain(role)} mailbox for approval.
                      </Text>
                    </View>
                  )}

                  {(!loginWithOtp || isRegister || isOfficialRole) &&
                    !forgotPasswordMode && (
                      <View style={styles.inputGroup}>
                        <Text style={styles.label}>Password</Text>
                        <View style={styles.passwordRow}>
                          <TextInput
                            style={[styles.input, styles.passwordInput]}
                            placeholder="Enter your password"
                            placeholderTextColor="#94A3B8"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={!showPassword}
                          />
                          <TouchableOpacity
                            style={styles.eyeButton}
                            onPress={() => setShowPassword((prev) => !prev)}
                            accessibilityLabel={
                              showPassword ? "Hide password" : "Show password"
                            }
                          >
                            <Ionicons
                              name={showPassword ? "eye-off" : "eye"}
                              size={20}
                              color="#64748B"
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}

                  {isRegister && (
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Confirm password</Text>
                      <View style={styles.passwordRow}>
                        <TextInput
                          style={[styles.input, styles.passwordInput]}
                          placeholder="Re-enter your password"
                          placeholderTextColor="#94A3B8"
                          value={confirmPassword}
                          onChangeText={setConfirmPassword}
                          secureTextEntry={!showConfirmPassword}
                        />
                        <TouchableOpacity
                          style={styles.eyeButton}
                          onPress={() =>
                            setShowConfirmPassword((prev) => !prev)
                          }
                          accessibilityLabel={
                            showConfirmPassword
                              ? "Hide confirm password"
                              : "Show confirm password"
                          }
                        >
                          <Ionicons
                            name={showConfirmPassword ? "eye-off" : "eye"}
                            size={20}
                            color="#64748B"
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {!isRegister && !isOfficialRole && (
                    <View style={styles.otpToggleRow}>
                      <Text style={styles.helperText}>
                        {loginWithOtp
                          ? "Signing in with OTP"
                          : "Forgot password?"}
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          if (loginWithOtp) {
                            setLoginWithOtp(false);
                            setEmailOtp("");
                            setIsVerified(false);
                            setIsOtpSent(false);
                          } else {
                            setForgotPasswordMode(true);
                            setIsResetCodeSent(false);
                            setResetCode("");
                            setError("");
                          }
                        }}
                      >
                        <Text style={styles.switchLink}>
                          {loginWithOtp ? "Use password" : "Reset password"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {!isRegister && isOfficialRole && !forgotPasswordMode && (
                    <View style={styles.otpToggleRow}>
                      <Text style={styles.helperText}>Forgot password?</Text>
                      <TouchableOpacity
                        onPress={() => {
                          setForgotPasswordMode(true);
                          setIsResetCodeSent(false);
                          setResetCode("");
                          setError("");
                        }}
                      >
                        <Text style={styles.switchLink}>Reset password</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {!isRegister && isOfficialRole && forgotPasswordMode && (
                    <View style={styles.verifyCard}>
                      <View style={styles.backButtonRow}>
                        <TouchableOpacity
                          style={styles.backButton}
                          onPress={() => {
                            setForgotPasswordMode(false);
                            setResetCode("");
                            setNewPassword("");
                            setConfirmNewPassword("");
                            setIsResetCodeSent(false);
                            setResetSuccess(false);
                            setOfficialEmail("");
                            setError("");
                          }}
                        >
                          <Ionicons
                            name="arrow-back"
                            size={24}
                            color="#2563EB"
                          />
                        </TouchableOpacity>
                        <Text style={styles.cardTitle}>Reset Password</Text>
                        <View style={{ width: 24 }} />
                      </View>
                      <Text style={styles.sectionSubtitle}>
                        We'll send a verification code to your registered
                        official email
                      </Text>

                      {!isResetCodeSent ? (
                        <>
                          <View style={styles.inputGroup}>
                            <Text style={styles.label}>Official Email</Text>
                            <TextInput
                              style={styles.input}
                              placeholder={`name@${getOfficialDomain(role)}`}
                              placeholderTextColor="#94A3B8"
                              value={officialEmail}
                              onChangeText={setOfficialEmail}
                              autoCapitalize="none"
                              keyboardType="email-address"
                            />
                            <Text style={styles.helperText}>
                              Enter your registered {getOfficialDomain(role)}{" "}
                              email
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={[
                              styles.primaryButton,
                              (officialEmail.trim().length < 5 ||
                                isSendingResetCode) &&
                                styles.buttonDisabled,
                            ]}
                            onPress={handleSendResetCode}
                            disabled={
                              officialEmail.trim().length < 5 ||
                              isSendingResetCode
                            }
                          >
                            <Text style={styles.primaryButtonText}>
                              {isSendingResetCode
                                ? "Sending verification code..."
                                : "Send verification code"}
                            </Text>
                          </TouchableOpacity>
                        </>
                      ) : resetSuccess ? (
                        <View style={styles.successCard}>
                          <Text style={styles.successText}>
                            ✅ Password reset successful!
                          </Text>
                          <Text style={styles.cardText}>
                            You can now login with your new password.
                          </Text>
                        </View>
                      ) : (
                        <>
                          <View style={styles.inputGroup}>
                            <Text style={styles.label}>Verification Code</Text>
                            <TextInput
                              style={styles.input}
                              placeholder="Enter 6-digit code"
                              placeholderTextColor="#94A3B8"
                              value={resetCode}
                              onChangeText={setResetCode}
                              keyboardType="number-pad"
                              maxLength={6}
                            />
                          </View>
                          <View style={styles.inputGroup}>
                            <Text style={styles.label}>New Password</Text>
                            <View style={styles.passwordRow}>
                              <TextInput
                                style={[styles.input, styles.passwordInput]}
                                placeholder="Enter new password"
                                placeholderTextColor="#94A3B8"
                                value={newPassword}
                                onChangeText={setNewPassword}
                                secureTextEntry={!showNewPassword}
                              />
                              <TouchableOpacity
                                style={styles.eyeButton}
                                onPress={() =>
                                  setShowNewPassword((prev) => !prev)
                                }
                              >
                                <Ionicons
                                  name={showNewPassword ? "eye-off" : "eye"}
                                  size={20}
                                  color="#64748B"
                                />
                              </TouchableOpacity>
                            </View>
                          </View>
                          <View style={styles.inputGroup}>
                            <Text style={styles.label}>
                              Confirm New Password
                            </Text>
                            <View style={styles.passwordRow}>
                              <TextInput
                                style={[styles.input, styles.passwordInput]}
                                placeholder="Re-enter new password"
                                placeholderTextColor="#94A3B8"
                                value={confirmNewPassword}
                                onChangeText={setConfirmNewPassword}
                                secureTextEntry={!showConfirmNewPassword}
                              />
                              <TouchableOpacity
                                style={styles.eyeButton}
                                onPress={() =>
                                  setShowConfirmNewPassword((prev) => !prev)
                                }
                              >
                                <Ionicons
                                  name={
                                    showConfirmNewPassword ? "eye-off" : "eye"
                                  }
                                  size={20}
                                  color="#64748B"
                                />
                              </TouchableOpacity>
                            </View>
                          </View>
                          <TouchableOpacity
                            style={[
                              styles.primaryButton,
                              (resetCode.trim().length !== 6 ||
                                newPassword.trim().length < 6 ||
                                confirmNewPassword.trim().length < 6) &&
                                styles.buttonDisabled,
                            ]}
                            onPress={handleResetPassword}
                            disabled={
                              resetCode.trim().length !== 6 ||
                              newPassword.trim().length < 6 ||
                              confirmNewPassword.trim().length < 6
                            }
                          >
                            <Text style={styles.primaryButtonText}>
                              Reset Password
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.textButton]}
                            onPress={handleSendResetCode}
                          >
                            <Text style={styles.switchLink}>Resend code</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  )}

                  {!isRegister && !isOfficialRole && forgotPasswordMode && (
                    <View style={styles.verifyCard}>
                      <View style={styles.backButtonRow}>
                        <TouchableOpacity
                          style={styles.backButton}
                          onPress={() => {
                            setForgotPasswordMode(false);
                            setResetCode("");
                            setNewPassword("");
                            setConfirmNewPassword("");
                            setIsResetCodeSent(false);
                            setResetSuccess(false);
                            setEmail("");
                            setError("");
                          }}
                        >
                          <Ionicons
                            name="arrow-back"
                            size={24}
                            color="#2563EB"
                          />
                        </TouchableOpacity>
                        <Text style={styles.cardTitle}>Reset Password</Text>
                        <View style={{ width: 24 }} />
                      </View>
                      <Text style={styles.sectionSubtitle}>
                        We'll send a verification code to your registered email
                      </Text>

                      {!isResetCodeSent ? (
                        <>
                          <View style={styles.inputGroup}>
                            <Text style={styles.label}>Email</Text>
                            <TextInput
                              style={styles.input}
                              placeholder="Enter your email"
                              placeholderTextColor="#94A3B8"
                              value={email}
                              onChangeText={setEmail}
                              autoCapitalize="none"
                              keyboardType="email-address"
                            />
                            <Text style={styles.helperText}>
                              Enter your registered email address
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={[
                              styles.primaryButton,
                              (email.trim().length < 5 || isSendingResetCode) &&
                                styles.buttonDisabled,
                            ]}
                            onPress={handleSendResetCodeUser}
                            disabled={
                              email.trim().length < 5 || isSendingResetCode
                            }
                          >
                            <Text style={styles.primaryButtonText}>
                              {isSendingResetCode
                                ? "Sending verification code..."
                                : "Send verification code"}
                            </Text>
                          </TouchableOpacity>
                        </>
                      ) : resetSuccess ? (
                        <View style={styles.successCard}>
                          <Text style={styles.successText}>
                            ✅ Password reset successful!
                          </Text>
                          <Text style={styles.cardText}>
                            You can now login with your new password.
                          </Text>
                        </View>
                      ) : (
                        <>
                          <View style={styles.inputGroup}>
                            <Text style={styles.label}>Verification Code</Text>
                            <TextInput
                              style={styles.input}
                              placeholder="Enter 6-digit code"
                              placeholderTextColor="#94A3B8"
                              value={resetCode}
                              onChangeText={setResetCode}
                              keyboardType="number-pad"
                              maxLength={6}
                            />
                          </View>
                          <View style={styles.inputGroup}>
                            <Text style={styles.label}>New Password</Text>
                            <View style={styles.passwordRow}>
                              <TextInput
                                style={[styles.input, styles.passwordInput]}
                                placeholder="Enter new password"
                                placeholderTextColor="#94A3B8"
                                value={newPassword}
                                onChangeText={setNewPassword}
                                secureTextEntry={!showNewPassword}
                              />
                              <TouchableOpacity
                                style={styles.eyeButton}
                                onPress={() =>
                                  setShowNewPassword((prev) => !prev)
                                }
                              >
                                <Ionicons
                                  name={showNewPassword ? "eye-off" : "eye"}
                                  size={20}
                                  color="#64748B"
                                />
                              </TouchableOpacity>
                            </View>
                          </View>
                          <View style={styles.inputGroup}>
                            <Text style={styles.label}>
                              Confirm New Password
                            </Text>
                            <View style={styles.passwordRow}>
                              <TextInput
                                style={[styles.input, styles.passwordInput]}
                                placeholder="Re-enter new password"
                                placeholderTextColor="#94A3B8"
                                value={confirmNewPassword}
                                onChangeText={setConfirmNewPassword}
                                secureTextEntry={!showConfirmNewPassword}
                              />
                              <TouchableOpacity
                                style={styles.eyeButton}
                                onPress={() =>
                                  setShowConfirmNewPassword((prev) => !prev)
                                }
                              >
                                <Ionicons
                                  name={
                                    showConfirmNewPassword ? "eye-off" : "eye"
                                  }
                                  size={20}
                                  color="#64748B"
                                />
                              </TouchableOpacity>
                            </View>
                          </View>
                          <TouchableOpacity
                            style={[
                              styles.primaryButton,
                              (resetCode.trim().length !== 6 ||
                                newPassword.trim().length < 6 ||
                                confirmNewPassword.trim().length < 6) &&
                                styles.buttonDisabled,
                            ]}
                            onPress={handleResetPasswordUser}
                            disabled={
                              resetCode.trim().length !== 6 ||
                              newPassword.trim().length < 6 ||
                              confirmNewPassword.trim().length < 6
                            }
                          >
                            <Text style={styles.primaryButtonText}>
                              Reset Password
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.textButton]}
                            onPress={handleSendResetCodeUser}
                          >
                            <Text style={styles.switchLink}>Resend code</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  )}

                  {isOtpContext && (
                    <View style={styles.verifyCard}>
                      <Text style={styles.cardTitle}>
                        {isRegister ? "Email verification" : "OTP sign-in"}
                      </Text>
                      <Text style={styles.sectionSubtitle}>
                        {isRegister
                          ? "We'll send a verification code to your email address"
                          : "We'll send a one-time code to your email"}
                      </Text>
                      {!isOtpSent ? (
                        <TouchableOpacity
                          style={[
                            styles.primaryButton,
                            (otpEmail.trim().length < 5 || isSendingOtp) &&
                              styles.buttonDisabled,
                          ]}
                          onPress={handleSendOtp}
                          disabled={otpEmail.trim().length < 5 || isSendingOtp}
                          activeOpacity={0.9}
                        >
                          <Text style={styles.primaryButtonText}>
                            {isSendingOtp
                              ? "Sending verification code..."
                              : "Send verification code"}
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <>
                          <View style={styles.inputGroup}>
                            <Text style={styles.label}>Verification code</Text>
                            <TextInput
                              style={[
                                styles.input,
                                isVerified && styles.inputDisabled,
                              ]}
                              placeholder="Enter 6-digit code"
                              placeholderTextColor="#94A3B8"
                              value={emailOtp}
                              onChangeText={setEmailOtp}
                              keyboardType="number-pad"
                              maxLength={6}
                              editable={!isVerified}
                            />
                          </View>
                          <TouchableOpacity
                            style={[
                              styles.secondaryButton,
                              !canVerify && styles.buttonDisabled,
                            ]}
                            onPress={handleVerify}
                            disabled={!canVerify}
                          >
                            <Text style={styles.secondaryButtonText}>
                              {isVerified ? "Verified ✅" : "Verify email"}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.textButton]}
                            onPress={handleSendOtp}
                            activeOpacity={0.85}
                          >
                            {!isVerified && (
                              <Text style={styles.switchLink}>Resend code</Text>
                            )}
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  )}

                  {isRegister &&
                    role === "Passenger" &&
                    isOtpSent &&
                    isVerified && (
                      <View style={styles.cardBlock}>
                        <Text style={styles.cardTitle}>
                          Passenger travel details
                        </Text>
                        <View style={styles.inputGroup}>
                          <Text style={styles.label}>Travel mode</Text>
                          <View style={styles.roleRow}>
                            {["Bus", "Train"].map((item) => (
                              <TouchableOpacity
                                key={item}
                                style={[
                                  styles.roleChip,
                                  travelType === item && styles.roleChipActive,
                                ]}
                                onPress={() => setTravelType(item)}
                              >
                                <Text
                                  style={[
                                    styles.roleChipText,
                                    travelType === item &&
                                      styles.roleChipTextActive,
                                  ]}
                                >
                                  {item}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                        <View style={styles.inputGroup}>
                          <Text style={styles.label}>
                            {travelType === "Bus" ? "Bus" : "Train"} number
                          </Text>
                          <TextInput
                            style={styles.input}
                            placeholder="TN-01-AB-1234"
                            placeholderTextColor="#94A3B8"
                            value={travelNumber}
                            onChangeText={setTravelNumber}
                          />
                        </View>
                        <View style={styles.inputGroup}>
                          <Text style={styles.label}>
                            {travelType === "Bus"
                              ? "Bus name (optional)"
                              : "Train name"}
                          </Text>
                          <TextInput
                            style={styles.input}
                            placeholder="MTC 27B / MS-EXP-204"
                            placeholderTextColor="#94A3B8"
                            value={travelName}
                            onChangeText={setTravelName}
                          />
                        </View>
                        {travelType === "Bus" ? (
                          <>
                            <View style={styles.inputGroup}>
                              <Text style={styles.label}>Departure stop</Text>
                              <TextInput
                                style={styles.input}
                                placeholder="Velachery"
                                placeholderTextColor="#94A3B8"
                                value={busDeparture}
                                onChangeText={setBusDeparture}
                              />
                            </View>
                            <View style={styles.inputGroup}>
                              <Text style={styles.label}>Arrival stop</Text>
                              <TextInput
                                style={styles.input}
                                placeholder="CMBT"
                                placeholderTextColor="#94A3B8"
                                value={busArrival}
                                onChangeText={setBusArrival}
                              />
                            </View>
                            <View style={styles.inputGroup}>
                              <Text style={styles.label}>Bus start timing</Text>
                              <TextInput
                                style={styles.input}
                                placeholder="09:30AM"
                                placeholderTextColor="#94A3B8"
                                value={busStartTime}
                                onChangeText={setBusStartTime}
                              />
                            </View>
                          </>
                        ) : (
                          <>
                            <View style={styles.inputGroup}>
                              <Text style={styles.label}>Route</Text>
                              <TextInput
                                style={styles.input}
                                placeholder="Velachery → CMBT"
                                placeholderTextColor="#94A3B8"
                                value={travelRoute}
                                onChangeText={setTravelRoute}
                              />
                            </View>
                            <View style={styles.inputGroup}>
                              <Text style={styles.label}>Timing</Text>
                              <TextInput
                                style={styles.input}
                                placeholder="09:30AM - 11:45AM"
                                placeholderTextColor="#94A3B8"
                                value={travelTiming}
                                onChangeText={setTravelTiming}
                              />
                            </View>
                          </>
                        )}
                        {travelType === "Bus" && (
                          <>
                            <View style={styles.inputGroup}>
                              <Text style={styles.label}>
                                Driver name (optional)
                              </Text>
                              <TextInput
                                style={styles.input}
                                placeholder="Driver name"
                                placeholderTextColor="#94A3B8"
                                value={driverName}
                                onChangeText={setDriverName}
                              />
                            </View>
                            <View style={styles.inputGroup}>
                              <Text style={styles.label}>
                                Conductor name (optional)
                              </Text>
                              <TextInput
                                style={styles.input}
                                placeholder="Conductor name"
                                placeholderTextColor="#94A3B8"
                                value={conductorName}
                                onChangeText={setConductorName}
                              />
                            </View>
                          </>
                        )}
                      </View>
                    )}

                  {isRegister &&
                    isOperationalStaff &&
                    isOtpSent &&
                    isVerified && (
                      <View style={styles.cardBlock}>
                        <Text style={styles.cardTitle}>Daily duty roster</Text>
                        <View style={styles.inputGroup}>
                          <Text style={styles.label}>Vehicle number</Text>
                          <TextInput
                            style={styles.input}
                            placeholder="TN-01-AB-1234"
                            placeholderTextColor="#94A3B8"
                            value={vehicleNumber}
                            onChangeText={setVehicleNumber}
                          />
                        </View>
                        <View style={styles.inputGroup}>
                          <Text style={styles.label}>Route</Text>
                          <TextInput
                            style={styles.input}
                            placeholder="Velachery → CMBT"
                            placeholderTextColor="#94A3B8"
                            value={dutyRoute}
                            onChangeText={setDutyRoute}
                          />
                        </View>
                        <View style={styles.inputGroup}>
                          <Text style={styles.label}>Shift timing</Text>
                          <TextInput
                            style={styles.input}
                            placeholder="6AM - 2PM"
                            placeholderTextColor="#94A3B8"
                            value={shiftTiming}
                            onChangeText={setShiftTiming}
                          />
                        </View>
                        <View style={styles.inputGroup}>
                          <Text style={styles.label}>From stop</Text>
                          <TextInput
                            style={styles.input}
                            placeholder="Velachery"
                            placeholderTextColor="#94A3B8"
                            value={fromStop}
                            onChangeText={setFromStop}
                          />
                        </View>
                        <View style={styles.inputGroup}>
                          <Text style={styles.label}>To stop</Text>
                          <TextInput
                            style={styles.input}
                            placeholder="CMBT"
                            placeholderTextColor="#94A3B8"
                            value={toStop}
                            onChangeText={setToStop}
                          />
                        </View>
                      </View>
                    )}

                  {isRegister && isOfficialRole && (
                    <View style={styles.cardBlock}>
                      <Text style={styles.cardTitle}>
                        Official duty details
                      </Text>
                      <Text style={styles.sectionSubtitle}>
                        Admin approval required within 24 hours.
                      </Text>
                      <View style={styles.inputGroup}>
                        <Text style={styles.label}>Train PNR range</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="4528193000-4528193999"
                          placeholderTextColor="#94A3B8"
                          value={pnrRange}
                          onChangeText={setPnrRange}
                        />
                      </View>
                      <View style={styles.inputGroup}>
                        <Text style={styles.label}>Jurisdiction</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="Chennai Central Division"
                          placeholderTextColor="#94A3B8"
                          value={jurisdiction}
                          onChangeText={setJurisdiction}
                        />
                      </View>
                    </View>
                  )}

                  {pendingApproval && !isRegister && isOfficialRole && (
                    <View style={styles.noticeCard}>
                      <Text style={styles.noticeTitle}>Approval pending</Text>
                      <Text style={styles.noticeText}>
                        Your registration is under admin review. Check your
                        official inbox for approval within 24 hours.
                      </Text>
                    </View>
                  )}

                  {error.length > 0 && (
                    <Text style={styles.errorText}>{error}</Text>
                  )}

                        {!forgotPasswordMode && (
                                  <>
                                    <TouchableOpacity
                                      style={[
                                        styles.primaryButton,
                                        !canSubmit && styles.buttonDisabled,
                                      ]}
                                      onPress={handleSubmit}
                                      disabled={!canSubmit}
                                    >
                                      <Text style={styles.primaryButtonText}>
                                        {isRegister ? "Create account" : "Log in"}
                                      </Text>
                                    </TouchableOpacity>
              
                                    <View style={styles.switchRow}>
                                      <Text style={styles.switchText}>
                                        {isRegister
                                          ? "Already have an account?"
                                          : "New here?"}
                                      </Text>
                                      <TouchableOpacity onPress={handleSwitchMode}>
                                        <Text style={styles.switchLink}>
                                          {isRegister ? "Log in" : "Create one"}
                                        </Text>
                                      </TouchableOpacity>
                                    </View>
                                  </>
                                )}
              
                                <View style={styles.footerRow}>
                                  <Text style={styles.footerText}>
                                    Multi-role recovery platform for public transport.
                                  </Text>
                                </View>
                              </View>
                            )}
                      </View>
                    </ScrollView>
                  </TouchableWithoutFeedback>
                </KeyboardAvoidingView>
              )}
            </View>
          </ScrollView>
                </TouchableWithoutFeedback>
              </KeyboardAvoidingView>
            </View>
        </>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  authenticatedContainer: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  authenticatedContent: {
    flex: 1,
  },
  authenticatedScrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  logoutButtonFull: {
    marginTop: 12,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  backgroundGlow: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "#E0E7FF",
    opacity: 0.3,
    top: 40,
    right: -80,
  },
  statusBadgeRow: {
    marginTop: 12,
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  statusBadgeChecking: {
    backgroundColor: "#E2E8F0",
  },
  statusBadgeOnline: {
    backgroundColor: "#DCFCE7",
  },
  statusBadgeOffline: {
    backgroundColor: "#FEE2E2",
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1F2937",
  },
  apiErrorText: {
    marginTop: 8,
    fontSize: 12,
    color: "#DC2626",
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingBottom: 40,
  },
  scrollContentCentered: {
    justifyContent: "center",
  },
  card: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  brandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#64748B",
    marginBottom: 20,
    lineHeight: 20,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0F172A",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#1D4ED8",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#22C55E",
    marginRight: 6,
  },
  statusPillText: {
    color: "#BFDBFE",
    fontSize: 12,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginBottom: 18,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1E293B",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 6,
  },
  sectionSubtitle: {
    color: "#94A3B8",
    marginBottom: 16,
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    color: "#475569",
    fontSize: 12,
    marginBottom: 6,
    fontWeight: "500",
  },
  helperText: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 6,
  },
  input: {
    backgroundColor: "#F8FAFC",
    borderColor: "#CBD5E1",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    color: "#1E293B",
  },
  inputDisabled: {
    backgroundColor: "#E2E8F0",
    color: "#94A3B8",
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  passwordInput: {
    flex: 1,
  },
  eyeButton: {
    marginLeft: 10,
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  roleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
  },
  roleChip: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    margin: 4,
  },
  roleChipActive: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },
  roleChipText: {
    color: "#475569",
    fontSize: 12,
  },
  roleChipTextActive: {
    color: "#F8FAFC",
    fontWeight: "600",
  },
  roleChipLarge: {
    borderWidth: 2,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderRadius: 16,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 80,
    margin: 4,
  },
  roleChipTextLarge: {
    color: "#475569",
    fontSize: 18,
    fontWeight: "600",
  },
  roleDescriptions: {
    marginTop: 20,
  },
  roleDescCard: {
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  roleDescTitle: {
    color: "#1E40AF",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  roleDescText: {
    color: "#1E40AF",
    fontSize: 14,
    lineHeight: 20,
  },
  errorText: {
    color: "#F87171",
    marginBottom: 12,
  },
  devHintText: {
    color: "#F59E0B",
    marginTop: 10,
    fontSize: 12,
    textAlign: "center",
  },
  primaryButton: {
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 6,
    shadowColor: "#1D4ED8",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: "#F8FAFC",
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 14,
  },
  otpToggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  switchText: {
    color: "#64748B",
    marginRight: 6,
  },
  switchLink: {
    color: "#2563EB",
    fontWeight: "600",
  },
  footerRow: {
    marginTop: 18,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  footerText: {
    color: "#64748B",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 16,
  },
  home: {
    marginTop: 6,
  },
  cardBlock: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cardBlockBlurred: {
    opacity: 0.5,
  },
  verifyCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  successCard: {
    backgroundColor: "#DCFCE7",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#86EFAC",
  },
  noticeCard: {
    backgroundColor: "#FFF7ED",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FDBA74",
  },
  noticeTitle: {
    color: "#9A3412",
    fontWeight: "600",
    marginBottom: 8,
  },
  noticeText: {
    color: "#9A3412",
    lineHeight: 18,
  },
  cardTitle: {
    color: "#1E293B",
    fontWeight: "600",
    marginBottom: 10,
  },
  cardText: {
    color: "#475569",
    marginBottom: 6,
  },
  lockedHintText: {
    color: "#F59E0B",
    fontSize: 12,
    marginBottom: 10,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 12,
  },
  statusDotLarge: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#22C55E",
    marginRight: 8,
  },
  statusText: {
    color: "#A7F3D0",
    flex: 1,
    lineHeight: 18,
  },
  timelineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 10,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#334155",
    marginRight: 10,
    marginTop: 4,
  },
  timelineDotActive: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#38BDF8",
    marginRight: 10,
    marginTop: 4,
  },
  timelineTitle: {
    color: "#E2E8F0",
    fontWeight: "600",
  },
  timelineSubtitle: {
    color: "#94A3B8",
    marginTop: 4,
  },
  queueItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1E2A44",
  },
  queueTitle: {
    color: "#F8FAFC",
    fontWeight: "600",
  },
  queueMeta: {
    color: "#94A3B8",
    marginTop: 4,
  },
  queueStatus: {
    color: "#22C55E",
    fontWeight: "700",
  },
  queueStatusAmber: {
    color: "#F59E0B",
    fontWeight: "700",
  },
  successText: {
    color: "#16A34A",
    marginTop: 10,
    fontWeight: "600",
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#38BDF8",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#38BDF8",
    fontWeight: "600",
  },
  textButton: {
    marginTop: 12,
    alignItems: "center",
  },
  backButtonRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  logoutButton: {
    marginTop: 8,
  },
  transportGrid: {
    marginTop: 12,
    gap: 12,
  },
  transportRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  transportButton: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#E2E8F0",
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 100,
  },
  transportButtonSelected: {
    backgroundColor: "#EFF6FF",
    borderColor: "#3B82F6",
  },
  transportIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  transportButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#64748B",
  },
  transportButtonTextSelected: {
    color: "#3B82F6",
  },
  profileCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  profileAvatarText: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "700",
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 4,
  },
  profileRole: {
    fontSize: 14,
    color: "#64748B",
    fontWeight: "500",
  },
  profileDetails: {
    marginTop: 0,
  },
  profileDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  profileDetailLabel: {
    fontSize: 14,
    color: "#64748B",
    fontWeight: "500",
    flex: 1,
  },
  profileDetailValue: {
    fontSize: 14,
    color: "#1E293B",
    fontWeight: "600",
    flex: 2,
    textAlign: "right",
  },
});

export default App;
