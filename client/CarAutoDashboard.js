import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const CarAutoDashboard = ({ onLogout }) => {
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
  const [complaints, setComplaints] = useState([
    {
      id: 1,
      passengerName: "Ramya V",
      location: "Near Guindy",
      item: "Black Handbag",
      time: "10:15 AM",
      status: "pending",
    },
    {
      id: 2,
      passengerName: "Suresh K",
      location: "Velachery Station",
      item: "Blue Backpack",
      time: "11:30 AM",
      status: "pending",
    },
  ]);

  const [acceptedComplaint, setAcceptedComplaint] = useState(null);
  const [itemConfirmation, setItemConfirmation] = useState(null);
  const [itemFound, setItemFound] = useState(null);
  const [meetingPoint, setMeetingPoint] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [showQRModal, setShowQRModal] = useState(false);
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

  // Render Vehicle Selection Screen
  const renderVehicleSelection = () => (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>SafeRide Guardian</Text>
        <Text style={styles.headerSubtitle}>Select Your Vehicle Type</Text>
      </View>

      <View style={styles.selectionContainer}>
        <TouchableOpacity
          style={[
            styles.vehicleCard,
            vehicleType === "cab" && styles.vehicleCardSelected,
          ]}
          onPress={() => handleVehicleSelection("cab")}
        >
          <Text style={styles.vehicleIcon}>🚕</Text>
          <Text style={styles.vehicleTitle}>Cab Driver</Text>
          <Text style={styles.vehicleDescription}>
            For Ola / Uber / Private Taxi
          </Text>
          {vehicleType === "cab" && (
            <View style={styles.checkmark}>
              <Ionicons name="checkmark-circle" size={24} color="#2563EB" />
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.vehicleCard,
            vehicleType === "auto" && styles.vehicleCardSelected,
          ]}
          onPress={() => handleVehicleSelection("auto")}
        >
          <Text style={styles.vehicleIcon}>🛺</Text>
          <Text style={styles.vehicleTitle}>Auto Driver</Text>
          <Text style={styles.vehicleDescription}>
            For Share Auto / Meter Auto
          </Text>
          {vehicleType === "auto" && (
            <View style={styles.checkmark}>
              <Ionicons name="checkmark-circle" size={24} color="#2563EB" />
            </View>
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[
          styles.primaryButton,
          !vehicleType && styles.buttonDisabled,
        ]}
        onPress={handleContinueVehicleSelection}
        disabled={!vehicleType}
      >
        <Text style={styles.primaryButtonText}>Continue</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  // Render Duty Setup Screen
  const renderDutySetup = () => (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.flex1}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setCurrentStep("vehicleSelection")}
          >
            <Ionicons name="arrow-back" size={24} color="#2563EB" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Start Today's Duty</Text>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>🚘 Vehicle Number *</Text>
            <TextInput
              style={styles.input}
              placeholder="TN-01-AB-1234"
              placeholderTextColor="#CBD5E1"
              value={vehicleNumber}
              onChangeText={setVehicleNumber}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>📍 Starting Location *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your starting point"
              placeholderTextColor="#CBD5E1"
              value={startingLocation}
              onChangeText={setStartingLocation}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>📍 Ending Area (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Where will you finish"
              placeholderTextColor="#CBD5E1"
              value={endingArea}
              onChangeText={setEndingArea}
            />
          </View>

          <View style={styles.timeRow}>
            <View style={[styles.inputGroup, styles.flex1]}>
              <Text style={styles.label}>⏰ Shift Start Time *</Text>
              <TextInput
                style={styles.input}
                placeholder="06:00 AM"
                placeholderTextColor="#CBD5E1"
                value={shiftStartTime}
                onChangeText={setShiftStartTime}
              />
            </View>
            <View style={[styles.inputGroup, styles.flex1]}>
              <Text style={styles.label}>⏰ Shift End Time *</Text>
              <TextInput
                style={styles.input}
                placeholder="02:00 PM"
                placeholderTextColor="#CBD5E1"
                value={shiftEndTime}
                onChangeText={setShiftEndTime}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>📷 Upload ID (Optional)</Text>
            <TouchableOpacity style={styles.uploadButton}>
              <Ionicons name="cloud-upload" size={24} color="#2563EB" />
              <Text style={styles.uploadButtonText}>
                Tap to upload ID for verification
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleStartDuty}
        >
          <Text style={styles.primaryButtonText}>🔵 Start Duty</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  // Render Main Dashboard
  const renderDashboard = () => (
    <>
      {!acceptedComplaint ? (
        <ScrollView contentContainerStyle={styles.dashboardContent}>
          {/* Header Section */}
          <View style={styles.dashboardHeader}>
            <View style={styles.driverInfo}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>D</Text>
              </View>
              <View style={styles.driverDetails}>
                <Text style={styles.driverName}>Driver Name</Text>
                <Text style={styles.driverVehicle}>
                  {vehicleType === "cab" ? "🚕 Cab Driver" : "🛺 Auto Driver"}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.notificationBell}
              onPress={() => {}}
            >
              <Ionicons name="notifications" size={24} color="#2563EB" />
              {complaints.length > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{complaints.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Online/Offline Toggle */}
          <View style={styles.statusCard}>
            <View style={styles.statusLeft}>
              <View
                style={[
                  styles.statusIndicator,
                  isOnline && styles.statusOnline,
                ]}
              />
              <Text style={styles.statusText}>
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
          <View style={styles.dutyCard}>
            <Text style={styles.cardTitle}>🚘 Active Duty</Text>
            <View style={styles.dutyInfo}>
              <View style={styles.dutyRow}>
                <Text style={styles.dutyLabel}>Vehicle:</Text>
                <Text style={styles.dutyValue}>{vehicleNumber}</Text>
              </View>
              <View style={styles.dutyRow}>
                <Text style={styles.dutyLabel}>Location:</Text>
                <Text style={styles.dutyValue}>{startingLocation}</Text>
              </View>
              <View style={styles.dutyRow}>
                <Text style={styles.dutyLabel}>Shift:</Text>
                <Text style={styles.dutyValue}>
                  {shiftStartTime} - {shiftEndTime}
                </Text>
              </View>
              <View style={styles.dutyRow}>
                <Text style={styles.dutyLabel}>Status:</Text>
                <Text style={[styles.dutyValue, styles.statusActive]}>
                  ✅ Active
                </Text>
              </View>
            </View>
          </View>

          {/* Live Complaint Alerts */}
          <View style={styles.complaintsSection}>
            <Text style={styles.sectionTitle}>
              🚨 Live Complaint Alerts ({complaints.length})
            </Text>
            {complaints.length > 0 ? (
              <FlatList
                data={complaints}
                keyExtractor={(item) => item.id.toString()}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <View style={styles.complaintCard}>
                    <View style={styles.complaintHeader}>
                      <Text style={styles.complaintTitle}>⚠ Lost Item Alert</Text>
                      <Text style={styles.complaintTime}>{item.time}</Text>
                    </View>
                    <Text style={styles.complaintDetail}>
                      👤 Passenger: <Text style={styles.bold}>{item.passengerName}</Text>
                    </Text>
                    <Text style={styles.complaintDetail}>
                      📍 Location: <Text style={styles.bold}>{item.location}</Text>
                    </Text>
                    <Text style={styles.complaintDetail}>
                      📦 Item: <Text style={styles.bold}>{item.item}</Text>
                    </Text>
                    <View style={styles.complaintActions}>
                      <TouchableOpacity
                        style={styles.acceptButton}
                        onPress={() => handleAcceptComplaint(item)}
                      >
                        <Text style={styles.acceptButtonText}>✅ ACCEPT</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.ignoreButton}
                        onPress={() => handleIgnoreComplaint(item.id)}
                      >
                        <Text style={styles.ignoreButtonText}>❌ IGNORE</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              />
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>
                  No complaints at the moment
                </Text>
              </View>
            )}
          </View>

          {/* Daily Summary Panel */}
          <View style={styles.summaryPanel}>
            <Text style={styles.sectionTitle}>📊 Daily Summary</Text>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryNumber}>{recoveryStats.totalToday}</Text>
                <Text style={styles.summaryLabel}>Today</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryNumber}>{recoveryStats.recovered}</Text>
                <Text style={styles.summaryLabel}>Recovered</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryNumber}>{recoveryStats.pending}</Text>
                <Text style={styles.summaryLabel}>Pending</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryNumber}>{recoveryStats.successRate}%</Text>
                <Text style={styles.summaryLabel}>Success</Text>
              </View>
            </View>
          </View>

          {/* Logout Button */}
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={() => {
              setCurrentStep("vehicleSelection");
              setIsOnline(false);
              onLogout?.();
            }}
          >
            <Text style={styles.logoutButtonText}>🚪 End Duty</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        renderAcceptedComplaintFlow()
      )}
    </>
  );

  // Render Accepted Complaint Flow
  const renderAcceptedComplaintFlow = () => (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.backButtonContainer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setAcceptedComplaint(null)}
        >
          <Ionicons name="arrow-back" size={24} color="#2563EB" />
          <Text style={styles.backButtonText}>Back to Dashboard</Text>
        </TouchableOpacity>
      </View>

      {itemConfirmation === "itemPhoto" && (
        <View>
          <Text style={styles.formTitle}>📸 Item Confirmation</Text>
          <View style={styles.formContainer}>
            <View style={styles.complaintSummary}>
              <Text style={styles.summaryTitle}>Complaint Details</Text>
              <Text style={styles.summaryText}>
                📦 Item: {acceptedComplaint.item}
              </Text>
              <Text style={styles.summaryText}>
                👤 Passenger: {acceptedComplaint.passengerName}
              </Text>
              <Text style={styles.summaryText}>
                📍 Location: {acceptedComplaint.location}
              </Text>
            </View>

            <TouchableOpacity style={styles.uploadPhotoButton}>
              <Ionicons name="camera" size={40} color="#2563EB" />
              <Text style={styles.uploadPhotoText}>Tap to Upload Photo</Text>
            </TouchableOpacity>

            <View style={styles.confirmationButtons}>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={() => handleItemConfirmed(true)}
              >
                <Text style={styles.confirmButtonText}>✅ Item Found</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.denyButton}
                onPress={() => handleItemConfirmed(false)}
              >
                <Text style={styles.denyButtonText}>❌ Item Not Found</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {itemConfirmation === "meetingDetails" && itemFound && (
        <View>
          <Text style={styles.formTitle}>📍 Meeting Details</Text>
          <View style={styles.formContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Meeting Point</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter meeting location"
                placeholderTextColor="#CBD5E1"
                value={meetingPoint}
                onChangeText={setMeetingPoint}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Pickup Time</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter pickup time"
                placeholderTextColor="#CBD5E1"
                value={pickupTime}
                onChangeText={setPickupTime}
              />
            </View>

            <TouchableOpacity style={styles.locationButton}>
              <Ionicons name="location" size={24} color="#FFFFFF" />
              <Text style={styles.locationButtonText}>Share Live Location</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => setShowQRModal(true)}
            >
              <Text style={styles.primaryButtonText}>📍 Next: QR Handover</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {itemConfirmation === "notFound" && !itemFound && (
        <View>
          <Text style={styles.formTitle}>❌ Item Not Found</Text>
          <View style={styles.formContainer}>
            <View style={styles.notFoundCard}>
              <Text style={styles.notFoundTitle}>
                Item Not Found Confirmation
              </Text>
              <Text style={styles.notFoundText}>
                You have confirmed that the item is not in your vehicle. This
                information will be recorded in the system.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => {
                setComplaints(
                  complaints.filter((c) => c.id !== acceptedComplaint.id)
                );
                setAcceptedComplaint(null);
              }}
            >
              <Text style={styles.primaryButtonText}>
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
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setShowQRModal(false)}
            >
              <Ionicons name="close" size={28} color="#2563EB" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>QR Handover</Text>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.qrSection}>
              <Text style={styles.qrTitle}>📲 Scan Passenger's QR</Text>
              <View style={styles.qrPlaceholder}>
                <Ionicons
                  name="qr-code"
                  size={80}
                  color="#CBD5E1"
                />
              </View>
              <TouchableOpacity style={styles.scanButton}>
                <Ionicons name="camera" size={24} color="#FFFFFF" />
                <Text style={styles.scanButtonText}>Scan QR Code</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            <View style={styles.qrSection}>
              <Text style={styles.qrTitle}>🎫 Or Show Your QR</Text>
              <View style={styles.qrPlaceholder}>
                <Ionicons
                  name="qr-code"
                  size={80}
                  color="#CBD5E1"
                />
              </View>
              <Text style={styles.driverQRText}>
                Driver QR - Let passenger scan this
              </Text>
            </View>

            <TouchableOpacity
              style={styles.completeButton}
              onPress={handleCompleteHandover}
            >
              <Text style={styles.completeButtonText}>
                ✅ Complete Handover
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      {currentStep === "vehicleSelection" && renderVehicleSelection()}
      {currentStep === "dutySetup" && renderDutySetup()}
      {currentStep === "dashboard" && renderDashboard()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
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
