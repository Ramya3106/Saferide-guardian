import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Ionicons } from "@expo/vector-icons";
import {
  Animated,
  Easing,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const ROLES = ["Passenger", "Driver", "Conductor", "TTR/RPF", "Police"];
const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE ||
  (Platform.OS === "android"
    ? "http://10.0.2.2:5000/api"
    : "http://localhost:5000/api");

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
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [emailOtp, setEmailOtp] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [devOtpHint, setDevOtpHint] = useState("");

  const [travelNumber, setTravelNumber] = useState("");
  const [travelRoute, setTravelRoute] = useState("");
  const [travelTiming, setTravelTiming] = useState("");
  const [driverName, setDriverName] = useState("");
  const [conductorName, setConductorName] = useState("");

  const [vehicleNumber, setVehicleNumber] = useState("");
  const [dutyRoute, setDutyRoute] = useState("");
  const [shiftTiming, setShiftTiming] = useState("");
  const [fromStop, setFromStop] = useState("");
  const [toStop, setToStop] = useState("");

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

  const formAnim = useRef(new Animated.Value(0)).current;

  const isRegister = mode === "register";
  const isStaffRole = role !== "Passenger";

  const canVerify = useMemo(() => {
    return /^\d{6}$/.test(emailOtp.trim());
  }, [emailOtp]);

  const canSubmit = useMemo(() => {
    if (isRegister) {
      const baseReady =
        name.trim().length >= 2 &&
        phone.trim().length >= 8 &&
        email.trim().length >= 5 &&
        password.trim().length >= 6 &&
        confirmPassword.trim().length >= 6 &&
        isVerified;

      if (!baseReady) {
        return false;
      }

      if (role === "Passenger") {
        return (
          travelNumber.trim().length >= 5 &&
          travelRoute.trim().length >= 3 &&
          travelTiming.trim().length >= 4
        );
      }

      return (
        vehicleNumber.trim().length >= 5 &&
        dutyRoute.trim().length >= 3 &&
        shiftTiming.trim().length >= 3 &&
        fromStop.trim().length >= 2 &&
        toStop.trim().length >= 2
      );
    }

    return email.trim().length >= 5 && password.trim().length >= 6;
  }, [
    confirmPassword,
    dutyRoute,
    email,
    fromStop,
    isRegister,
    isVerified,
    name,
    password,
    phone,
    role,
    shiftTiming,
    toStop,
    travelNumber,
    travelRoute,
    travelTiming,
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

  const resetForm = () => {
    setName("");
    setPhone("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    setEmailOtp("");
    setIsVerified(false);
    setIsOtpSent(false);
    setIsSendingOtp(false);
    setDevOtpHint("");
    setTravelNumber("");
    setTravelRoute("");
    setTravelTiming("");
    setDriverName("");
    setConductorName("");
    setVehicleNumber("");
    setDutyRoute("");
    setShiftTiming("");
    setFromStop("");
    setToStop("");
    setStaffComplaintType("");
    setStaffComplaintTarget("");
    setStaffComplaintDetails("");
    setStaffComplaintSubmitted(false);
    setError("");
  };

  const handleSubmit = () => {
    if (!canSubmit) {
      setError("Please complete all required fields.");
      return;
    }

    if (isRegister && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError("");
    setIsAuthenticated(true);
  };

  const handleSwitchMode = () => {
    setMode((prev) => (prev === "login" ? "register" : "login"));
    resetForm();
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setMode("login");
    setComplaintSubmitted(false);
    setStaffConfirmed(false);
    setHandoffComplete(false);
    setStaffComplaintSubmitted(false);
    resetForm();
  };

  const handleSendOtp = async () => {
    if (email.trim().length < 5) {
      setError("Enter a valid email address.");
      return;
    }

    setError("");
    setIsVerified(false);
    setIsOtpSent(false);
    setEmailOtp("");
    setDevOtpHint("");
    setIsSendingOtp(true);

    try {
      const { data } = await sendCode(email.trim());
      const sent = Boolean(data?.sent || data?.devCode);
      setIsOtpSent(sent);
      if (!sent && data?.message) {
        setError(data.message);
      }
      if (data?.devCode) {
        setDevOtpHint(`Dev code: ${data.devCode}`);
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
      await verifyCode(email.trim(), emailOtp.trim());
      setIsVerified(true);
      setDevOtpHint("");
    } catch (err) {
      const message = err?.response?.data?.message || "Unable to verify code.";
      setIsVerified(false);
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
          onPress={() => setRole(item)}
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

  const renderStaffDashboard = () => (
    <View>
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

  const renderTtrDashboard = () => (
    <View>
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

  const renderPoliceDashboard = () => (
    <View>
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

  const renderDashboard = () => {
    if (role === "Passenger") {
      return renderPassengerDashboard();
    }
    if (role === "TTR/RPF") {
      return renderTtrDashboard();
    }
    if (role === "Police") {
      return renderPoliceDashboard();
    }
    return renderStaffDashboard();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.backgroundGlow} />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          !isAuthenticated && styles.scrollContentCentered,
        ]}
      >
        <View
          style={
            isAuthenticated
              ? styles.card
              : [
                  styles.card,
                  {
                    transform: [
                      {
                        scale: formAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.98, 1],
                        }),
                      },
                    ],
                  },
                ]
          }
        >
          <View style={styles.brandRow}>
            <View>
              <Text style={styles.title}>SafeRide Guardian</Text>
              <Text style={styles.subtitle}>
                AI-powered role-based recovery for buses, trains, cabs, autos.
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

          {isAuthenticated ? (
            <View style={styles.home}>
              {renderDashboard()}
              <TouchableOpacity
                style={[styles.secondaryButton, styles.logoutButton]}
                onPress={handleLogout}
              >
                <Text style={styles.secondaryButtonText}>Log out</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Animated.View
              style={{
                opacity: formAnim,
                transform: [
                  {
                    translateY: formAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [16, 0],
                    }),
                  },
                ],
              }}
            >
              <Text style={styles.formTitle}>
                {isRegister ? "Create your account" : "Sign in to continue"}
              </Text>

              {isRegister && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Select role</Text>
                  {renderRoleSelector()}
                </View>
              )}

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

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email address</Text>
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor="#94A3B8"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>

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
                      onPress={() => setShowConfirmPassword((prev) => !prev)}
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

              {isRegister && (
                <View style={styles.verifyCard}>
                  <Text style={styles.cardTitle}>Email verification</Text>
                  <Text style={styles.sectionSubtitle}>
                    We'll send a verification code to your email address
                  </Text>
                  {!isOtpSent ? (
                    <TouchableOpacity
                      style={[
                        styles.primaryButton,
                        (email.trim().length < 5 || isSendingOtp) &&
                          styles.buttonDisabled,
                      ]}
                      onPress={handleSendOtp}
                      disabled={email.trim().length < 5 || isSendingOtp}
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
                          style={styles.input}
                          placeholder="Enter 6-digit code"
                          placeholderTextColor="#94A3B8"
                          value={emailOtp}
                          onChangeText={setEmailOtp}
                          keyboardType="number-pad"
                          maxLength={6}
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
                        <Text style={styles.switchLink}>Resend code</Text>
                      </TouchableOpacity>
                      {devOtpHint.length > 0 && (
                        <Text style={styles.devHintText}>{devOtpHint}</Text>
                      )}
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
                      <Text style={styles.label}>Bus/Train number</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="TN-01-AB-1234"
                        placeholderTextColor="#94A3B8"
                        value={travelNumber}
                        onChangeText={setTravelNumber}
                      />
                    </View>
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
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Driver name (optional)</Text>
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
                  </View>
                )}

              {isRegister && isStaffRole && isOtpSent && isVerified && (
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

              {error.length > 0 && (
                <Text style={styles.errorText}>{error}</Text>
              )}

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
                  {isRegister ? "Already have an account?" : "New here?"}
                </Text>
                <TouchableOpacity onPress={handleSwitchMode}>
                  <Text style={styles.switchLink}>
                    {isRegister ? "Log in" : "Create one"}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.footerRow}>
                <Text style={styles.footerText}>
                  Multi-role recovery platform for public transport.
                </Text>
              </View>
            </Animated.View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
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
  input: {
    backgroundColor: "#F8FAFC",
    borderColor: "#CBD5E1",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    color: "#1E293B",
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
    gap: 8,
  },
  roleChip: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
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
    color: "#34D399",
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
  logoutButton: {
    marginTop: 8,
  },
});

export default App;
