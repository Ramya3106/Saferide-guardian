import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const DriverConductorDashboard = ({ onLogout }) => {
  // Main states
  const [currentStep, setCurrentStep] = useState("positionSelection"); // positionSelection, dutySetup, dashboard
  const [position, setPosition] = useState(null); // "driver" or "conductor"
  const [dutyStarted, setDutyStarted] = useState(false);
  const [isOnline, setIsOnline] = useState(false);

  // Duty setup states
  const [busNumber, setBusNumber] = useState("");
  const [route, setRoute] = useState("");
  const [shiftTime, setShiftTime] = useState("");
  const [depot, setDepot] = useState("");
  const [ticketMachineId, setTicketMachineId] = useState("");
  const [passengersOnboard, setPassengersOnboard] = useState("");

  // Complaints data
  const [complaints, setComplaints] = useState([
    {
      id: 1025,
      passengerName: "Ramya V",
      item: "Wallet",
      seat: 21,
      reportedTime: "9:45 AM",
      status: "pending",
    },
    {
      id: 1026,
      passengerName: "Suresh K",
      item: "Phone Charger",
      seat: 15,
      reportedTime: "10:12 AM",
      status: "pending",
    },
    {
      id: 1027,
      passengerName: "Priya M",
      item: "Black Laptop Bag",
      seat: 18,
      reportedTime: "10:30 AM",
      status: "pending",
    },
  ]);

  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [verificationStep, setVerificationStep] = useState(null); // null, photo, found, notFound, chat, pickup, qr
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
    setSelectedComplaint(complaint);
    setVerificationStep("photo");
  };

  const handleItemConfirmed = (found) => {
    setItemFound(found);
    if (found) {
      setVerificationStep("chat");
    } else {
      setVerificationStep("notFound");
    }
  };

  const handleGoToChat = () => {
    setVerificationStep("chat");
  };

  const handleGoToPickup = () => {
    setVerificationStep("pickup");
  };

  const handleOpenQR = () => {
    setShowQRModal(true);
  };

  const handleCompleteHandover = () => {
    if (selectedComplaint) {
      setPerformanceStats({
        ...performanceStats,
        recovered: performanceStats.recovered + 1,
        pending: performanceStats.pending - 1,
        successRate: Math.round(
          ((performanceStats.recovered + 1) / performanceStats.totalToday) * 100
        ),
      });
      setComplaints(complaints.filter((c) => c.id !== selectedComplaint.id));
    }
    setSelectedComplaint(null);
    setVerificationStep(null);
    setItemFound(null);
    setPickupStop("");
    setPickupTime("");
    setShowQRModal(false);
  };

  // Render Position Selection Screen
  const renderPositionSelection = () => (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>SafeRide Guardian</Text>
        <Text style={styles.headerSubtitle}>Select Your Position</Text>
      </View>

      <Text style={styles.chooseTitle}>Choose Your Role</Text>

      <View style={styles.selectionContainer}>
        <TouchableOpacity
          style={[
            styles.positionCard,
            position === "driver" && styles.positionCardSelected,
          ]}
          onPress={() => handlePositionSelection("driver")}
        >
          <Text style={styles.positionIcon}>🚌</Text>
          <Text style={styles.positionTitle}>Bus Driver</Text>
          <Text style={styles.positionDescription}>
            Responsible for vehicle movement
          </Text>
          {position === "driver" && (
            <View style={styles.checkmark}>
              <Ionicons name="checkmark-circle" size={24} color="#2563EB" />
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.positionCard,
            position === "conductor" && styles.positionCardSelected,
          ]}
          onPress={() => handlePositionSelection("conductor")}
        >
          <Text style={styles.positionIcon}>🎫</Text>
          <Text style={styles.positionTitle}>Conductor</Text>
          <Text style={styles.positionDescription}>
            Responsible for passenger & item custody
          </Text>
          {position === "conductor" && (
            <View style={styles.checkmark}>
              <Ionicons name="checkmark-circle" size={24} color="#2563EB" />
            </View>
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[
          styles.primaryButton,
          !position && styles.buttonDisabled,
        ]}
        onPress={handleContinuePositionSelection}
        disabled={!position}
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
            onPress={() => setCurrentStep("positionSelection")}
          >
            <Ionicons name="arrow-back" size={24} color="#2563EB" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Start Today's Duty</Text>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>🚌 Bus Number *</Text>
            <TextInput
              style={styles.input}
              placeholder="TN-01-AB-1234"
              placeholderTextColor="#CBD5E1"
              value={busNumber}
              onChangeText={setBusNumber}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>📍 Route (From → To) *</Text>
            <TextInput
              style={styles.input}
              placeholder="Velachery → CMBT"
              placeholderTextColor="#CBD5E1"
              value={route}
              onChangeText={setRoute}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>⏰ Shift Time *</Text>
            <TextInput
              style={styles.input}
              placeholder="6:00 AM – 2:00 PM"
              placeholderTextColor="#CBD5E1"
              value={shiftTime}
              onChangeText={setShiftTime}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>🏢 Current Depot</Text>
            <TextInput
              style={styles.input}
              placeholder="Depot name"
              placeholderTextColor="#CBD5E1"
              value={depot}
              onChangeText={setDepot}
            />
          </View>

          {position === "conductor" && (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>🎫 Ticket Machine ID</Text>
                <TextInput
                  style={styles.input}
                  placeholder="TM-12345"
                  placeholderTextColor="#CBD5E1"
                  value={ticketMachineId}
                  onChangeText={setTicketMachineId}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>👥 Passengers Onboard</Text>
                <TextInput
                  style={styles.input}
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
          style={styles.primaryButton}
          onPress={handleStartDuty}
        >
          <Text style={styles.primaryButtonText}>🔵 Start Duty</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  // Render Driver Dashboard
  const renderDriverDashboard = () => (
    <ScrollView contentContainerStyle={styles.dashboardContent}>
      {/* Header */}
      <View style={styles.dashboardHeader}>
        <View style={styles.driverInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>D</Text>
          </View>
          <View style={styles.driverDetails}>
            <Text style={styles.driverName}>Driver Name</Text>
            <Text style={styles.busNumberText}>🚌 {busNumber}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.notificationBell}>
          <Ionicons name="notifications" size={24} color="#2563EB" />
          {complaints.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{complaints.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Duty Status Toggle */}
      <View style={styles.statusCard}>
        <View style={styles.statusLeft}>
          <View
            style={[styles.statusIndicator, isOnline && styles.statusOnline]}
          />
          <Text style={styles.statusText}>{isOnline ? "On Duty" : "Off Duty"}</Text>
        </View>
        <Switch
          value={isOnline}
          onValueChange={setIsOnline}
          trackColor={{ false: "#CBD5E1", true: "#86EFAC" }}
          thumbColor={isOnline ? "#22C55E" : "#64748B"}
        />
      </View>

      {/* Active Route Card */}
      <View style={styles.routeCard}>
        <Text style={styles.cardTitle}>📍 Active Route</Text>
        <View style={styles.routeInfo}>
          <View style={styles.routeRow}>
            <Text style={styles.routeLabel}>Bus:</Text>
            <Text style={styles.routeValue}>{busNumber}</Text>
          </View>
          <View style={styles.routeRow}>
            <Text style={styles.routeLabel}>Route:</Text>
            <Text style={styles.routeValue}>{route}</Text>
          </View>
          <View style={styles.routeRow}>
            <Text style={styles.routeLabel}>Current Stop:</Text>
            <Text style={styles.routeValue}>Medavakkam</Text>
          </View>
          <View style={styles.routeRow}>
            <Text style={styles.routeLabel}>Next Stop:</Text>
            <Text style={styles.routeValue}>Guindy</Text>
          </View>
          <View style={styles.routeRow}>
            <Text style={styles.routeLabel}>Shift:</Text>
            <Text style={styles.routeValue}>{shiftTime}</Text>
          </View>
          <View style={styles.routeRow}>
            <Text style={styles.routeLabel}>GPS:</Text>
            <Text style={[styles.routeValue, styles.gpsActive]}>🟢 Active</Text>
          </View>
        </View>
      </View>

      {/* Lost Item Alerts */}
      <View style={styles.alertsSection}>
        <Text style={styles.sectionTitle}>🚨 Lost Item Alerts ({complaints.length})</Text>
        {complaints.length > 0 ? (
          <FlatList
            data={complaints}
            keyExtractor={(item) => item.id.toString()}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <View style={styles.driverAlertCard}>
                <View style={styles.alertHeader}>
                  <Text style={styles.alertTitle}>⚠ LOST ITEM ALERT</Text>
                  <Text style={styles.alertTime}>{item.reportedTime}</Text>
                </View>
                <Text style={styles.alertDetail}>
                  👤 Passenger: <Text style={styles.bold}>{item.passengerName}</Text>
                </Text>
                <Text style={styles.alertDetail}>
                  📦 Item: <Text style={styles.bold}>{item.item}</Text>
                </Text>
                {item.seat && (
                  <Text style={styles.alertDetail}>
                    💺 Seat: <Text style={styles.bold}>{item.seat}</Text>
                  </Text>
                )}
                <View style={styles.driverActions}>
                  <TouchableOpacity
                    style={styles.viewButton}
                    onPress={() => Alert.alert("Item Details", `${item.item} from seat ${item.seat}`)}
                  >
                    <Text style={styles.viewButtonText}>📋 VIEW DETAILS</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.forwardButton}
                    onPress={() => handleForwardToConductor(item)}
                  >
                    <Text style={styles.forwardButtonText}>➡️ FORWARD</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No alerts at the moment</Text>
          </View>
        )}

        {!busChecked && (
          <TouchableOpacity
            style={styles.checkBusButton}
            onPress={handleCheckBus}
          >
            <Text style={styles.checkBusButtonText}>🔍 Mark Bus Checked</Text>
          </TouchableOpacity>
        )}
        {busChecked && (
          <View style={styles.checkedBadge}>
            <Text style={styles.checkedBadgeText}>✅ Bus Checked</Text>
          </View>
        )}
      </View>

      {/* Driver Summary */}
      <View style={styles.summaryPanel}>
        <Text style={styles.sectionTitle}>📊 Driver Summary</Text>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>{performanceStats.totalToday}</Text>
            <Text style={styles.summaryLabel}>Alerts Today</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>{forwardedComplaints.length}</Text>
            <Text style={styles.summaryLabel}>Forwarded</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>{performanceStats.recovered}</Text>
            <Text style={styles.summaryLabel}>Resolved</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>{performanceStats.pending}</Text>
            <Text style={styles.summaryLabel}>Pending</Text>
          </View>
        </View>
      </View>

      {/* End Duty Button */}
      <TouchableOpacity
        style={styles.logoutButton}
        onPress={() => {
          setCurrentStep("positionSelection");
          setDutyStarted(false);
          setIsOnline(false);
          onLogout?.();
        }}
      >
        <Text style={styles.logoutButtonText}>🚪 End Duty</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  // Render Conductor Dashboard
  const renderConductorDashboard = () => (
    <>
      {!selectedComplaint ? (
        <ScrollView contentContainerStyle={styles.dashboardContent}>
          {/* Header */}
          <View style={styles.dashboardHeader}>
            <View style={styles.driverInfo}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>C</Text>
              </View>
              <View style={styles.driverDetails}>
                <Text style={styles.driverName}>Conductor Name</Text>
                <Text style={styles.busNumberText}>🚌 {busNumber}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.notificationBell}>
              <Ionicons name="notifications" size={24} color="#2563EB" />
              {complaints.length > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{complaints.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Duty Status Toggle */}
          <View style={styles.statusCard}>
            <View style={styles.statusLeft}>
              <View
                style={[styles.statusIndicator, isOnline && styles.statusOnline]}
              />
              <Text style={styles.statusText}>
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
          <View style={styles.dutyInfoCard}>
            <Text style={styles.cardTitle}>🚍 Duty Information</Text>
            <View style={styles.dutyInfoRow}>
              <Text style={styles.dutyLabel}>Bus:</Text>
              <Text style={styles.dutyValue}>{busNumber}</Text>
            </View>
            <View style={styles.dutyInfoRow}>
              <Text style={styles.dutyLabel}>Route:</Text>
              <Text style={styles.dutyValue}>{route}</Text>
            </View>
            <View style={styles.dutyInfoRow}>
              <Text style={styles.dutyLabel}>Shift:</Text>
              <Text style={styles.dutyValue}>{shiftTime}</Text>
            </View>
            <View style={styles.dutyInfoRow}>
              <Text style={styles.dutyLabel}>Passengers:</Text>
              <Text style={styles.dutyValue}>{passengersOnboard || "—"}</Text>
            </View>
          </View>

          {/* Complaint Queue */}
          <View style={styles.complaintQueueSection}>
            <Text style={styles.sectionTitle}>🚨 Live Complaint Queue ({complaints.length})</Text>
            {complaints.length > 0 ? (
              <FlatList
                data={complaints}
                keyExtractor={(item) => item.id.toString()}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <View style={styles.queueCard}>
                    <View style={styles.queueHeader}>
                      <Text style={styles.queueId}>Complaint #{item.id}</Text>
                      <Text style={styles.queueTime}>{item.reportedTime}</Text>
                    </View>
                    <View style={styles.queueContent}>
                      <Text style={styles.queueDetail}>
                        👤 <Text style={styles.bold}>{item.passengerName}</Text>
                      </Text>
                      <Text style={styles.queueDetail}>
                        📦 <Text style={styles.bold}>{item.item}</Text>
                      </Text>
                      <Text style={styles.queueDetail}>
                        💺 Seat: <Text style={styles.bold}>{item.seat}</Text>
                      </Text>
                    </View>
                    <View style={styles.queueActions}>
                      <TouchableOpacity
                        style={styles.checkButton}
                        onPress={() => handleCheckBus()}
                      >
                        <Text style={styles.checkButtonText}>🔍 CHECK BUS</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.acceptCheckButton}
                        onPress={() => handleAcceptComplaint(item)}
                      >
                        <Text style={styles.acceptCheckButtonText}>✅ ACCEPT</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              />
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No complaints</Text>
              </View>
            )}
          </View>

          {/* Performance Dashboard */}
          <View style={styles.performancePanel}>
            <Text style={styles.sectionTitle}>📊 Performance Dashboard</Text>
            <View style={styles.performanceGrid}>
              <View style={styles.perfCard}>
                <Text style={styles.perfNumber}>{performanceStats.totalToday}</Text>
                <Text style={styles.perfLabel}>Total Today</Text>
              </View>
              <View style={styles.perfCard}>
                <Text style={styles.perfNumber}>{performanceStats.recovered}</Text>
                <Text style={styles.perfLabel}>Recovered</Text>
              </View>
              <View style={styles.perfCard}>
                <Text style={styles.perfNumber}>{performanceStats.escalated}</Text>
                <Text style={styles.perfLabel}>Escalated</Text>
              </View>
              <View style={styles.perfCard}>
                <Text style={styles.perfNumber}>{performanceStats.successRate}%</Text>
                <Text style={styles.perfLabel}>Success</Text>
              </View>
              <View style={styles.perfCard}>
                <Text style={styles.perfNumber}>{performanceStats.avgResponseTime}</Text>
                <Text style={styles.perfLabel}>Avg Response</Text>
              </View>
              <View style={styles.perfCard}>
                <Text style={styles.perfNumber}>{performanceStats.pending}</Text>
                <Text style={styles.perfLabel}>Pending</Text>
              </View>
            </View>
          </View>

          {/* End Duty Button */}
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={() => {
              setCurrentStep("positionSelection");
              setDutyStarted(false);
              setIsOnline(false);
              onLogout?.();
            }}
          >
            <Text style={styles.logoutButtonText}>🚪 End Duty</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        renderConductorComplaintFlow()
      )}

      {/* QR Modal */}
      <Modal visible={showQRModal} transparent={true} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowQRModal(false)}>
              <Ionicons name="close" size={28} color="#2563EB" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>QR Code Handover</Text>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.qrSection}>
              <Text style={styles.qrTitle}>📲 Scan Passenger's QR</Text>
              <View style={styles.qrPlaceholder}>
                <Ionicons name="qr-code" size={80} color="#CBD5E1" />
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
                <Ionicons name="qr-code" size={80} color="#CBD5E1" />
              </View>
              <Text style={styles.driverQRText}>
                Conductor QR - Let passenger scan this
              </Text>
            </View>

            <TouchableOpacity
              style={styles.completeButton}
              onPress={handleCompleteHandover}
            >
              <Text style={styles.completeButtonText}>✅ Complete Handover</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );

  // Render Conductor Complaint Flow
  const renderConductorComplaintFlow = () => (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.backButtonContainer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setSelectedComplaint(null)}
        >
          <Ionicons name="arrow-back" size={24} color="#2563EB" />
          <Text style={styles.backButtonText}>Back to Queue</Text>
        </TouchableOpacity>
      </View>

      {/* Item Photo Step */}
      {verificationStep === "photo" && (
        <View>
          <Text style={styles.formTitle}>📸 Item Verification</Text>
          <View style={styles.formContainer}>
            <View style={styles.complaintSummary}>
              <Text style={styles.summaryTitle}>Complaint Details</Text>
              <Text style={styles.summaryText}>
                Complaint ID: #{selectedComplaint.id}
              </Text>
              <Text style={styles.summaryText}>
                📦 Item: {selectedComplaint.item}
              </Text>
              <Text style={styles.summaryText}>
                👤 Passenger: {selectedComplaint.passengerName}
              </Text>
              <Text style={styles.summaryText}>
                💺 Seat: {selectedComplaint.seat}
              </Text>
            </View>

            <TouchableOpacity style={styles.uploadPhotoButton}>
              <Ionicons name="camera" size={40} color="#2563EB" />
              <Text style={styles.uploadPhotoText}>Tap to Take Photo</Text>
              <Text style={styles.photoHint}>
                Photo will be timestamped and GPS tagged
              </Text>
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
                <Text style={styles.denyButtonText}>❌ Not Found</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Chat Step */}
      {verificationStep === "chat" && (
        <View>
          <Text style={styles.formTitle}>💬 Passenger Communication</Text>
          <View style={styles.formContainer}>
            <View style={styles.itemSecuredCard}>
              <Text style={styles.itemSecuredTitle}>🟢 ITEM SECURED</Text>
              <Text style={styles.itemSecuredText}>
                Item safely stored with conductor
              </Text>
            </View>

            <View style={styles.chatBox}>
              <View style={styles.chatMessage}>
                <Text style={styles.chatText}>"Item is safe"</Text>
              </View>
              <View style={styles.chatMessage}>
                <Text style={styles.chatText}>
                  "Collect at Guindy 10:30 AM"
                </Text>
              </View>
              <View style={styles.chatMessage}>
                <Text style={styles.chatText}>
                  "Please bring ID proof"
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleGoToPickup}
            >
              <Text style={styles.primaryButtonText}>
                📍 Next: Pickup Scheduling
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Pickup Scheduling Step */}
      {verificationStep === "pickup" && (
        <View>
          <Text style={styles.formTitle}>📍 Pickup Scheduling</Text>
          <View style={styles.formContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Select Stop</Text>
              <TextInput
                style={styles.input}
                placeholder="Guindy / CMBT / Velachery"
                placeholderTextColor="#CBD5E1"
                value={pickupStop}
                onChangeText={setPickupStop}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Select Time</Text>
              <TextInput
                style={styles.input}
                placeholder="10:30 AM"
                placeholderTextColor="#CBD5E1"
                value={pickupTime}
                onChangeText={setPickupTime}
              />
            </View>

            <TouchableOpacity style={styles.locationButton}>
              <Ionicons name="location" size={24} color="#FFFFFF" />
              <Text style={styles.locationButtonText}>Share Live Location</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.notifyButton}>
              <Ionicons name="send" size={24} color="#FFFFFF" />
              <Text style={styles.notifyButtonText}>Notify Passenger</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleOpenQR}
            >
              <Text style={styles.primaryButtonText}>🔐 Proceed to QR Handover</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Not Found Step */}
      {verificationStep === "notFound" && (
        <View>
          <Text style={styles.formTitle}>❌ Item Not Found</Text>
          <View style={styles.formContainer}>
            <View style={styles.notFoundCard}>
              <Text style={styles.notFoundTitle}>Item Not Found</Text>
              <Text style={styles.notFoundText}>
                Item was not found in the bus. This incident has been recorded
                and will be flagged for further investigation.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => {
                setComplaints(
                  complaints.filter((c) => c.id !== selectedComplaint.id)
                );
                setSelectedComplaint(null);
              }}
            >
              <Text style={styles.primaryButtonText}>Return to Queue</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      {currentStep === "positionSelection" && renderPositionSelection()}
      {currentStep === "dutySetup" && renderDutySetup()}
      {currentStep === "dashboard" && position === "driver" && renderDriverDashboard()}
      {currentStep === "dashboard" && position === "conductor" && renderConductorDashboard()}
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

  // Header Styles
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
  chooseTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 16,
  },

  // Position Selection Styles
  selectionContainer: {
    marginBottom: 24,
  },
  positionCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 24,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "#E2E8F0",
    alignItems: "center",
    position: "relative",
  },
  positionCardSelected: {
    backgroundColor: "#EFF6FF",
    borderColor: "#2563EB",
  },
  positionIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  positionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 4,
  },
  positionDescription: {
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

  // Dashboard Header Styles
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
  busNumberText: {
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

  // Route Card (Driver)
  routeCard: {
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
  routeInfo: {
    gap: 10,
  },
  routeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  routeLabel: {
    fontSize: 14,
    color: "#64748B",
    fontWeight: "500",
  },
  routeValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B",
  },
  gpsActive: {
    color: "#22C55E",
  },

  // Driver Alert Card
  alertsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 12,
  },
  driverAlertCard: {
    backgroundColor: "#FFF7ED",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#FDBA74",
  },
  alertHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#9A3412",
  },
  alertTime: {
    fontSize: 12,
    color: "#9A3412",
    fontWeight: "500",
  },
  alertDetail: {
    fontSize: 13,
    color: "#9A3412",
    marginBottom: 6,
  },
  bold: {
    fontWeight: "700",
  },
  driverActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  viewButton: {
    flex: 1,
    backgroundColor: "#DBEAFE",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#93C5FD",
  },
  viewButtonText: {
    color: "#1D4ED8",
    fontWeight: "700",
    fontSize: 12,
  },
  forwardButton: {
    flex: 1,
    backgroundColor: "#DCFCE7",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#86EFAC",
  },
  forwardButtonText: {
    color: "#16A34A",
    fontWeight: "700",
    fontSize: 12,
  },

  // Conductor Styles
  dutyInfoCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  dutyInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
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

  // Complaint Queue
  complaintQueueSection: {
    marginBottom: 20,
  },
  queueCard: {
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  queueHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  queueId: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E40AF",
  },
  queueTime: {
    fontSize: 12,
    color: "#1E40AF",
  },
  queueContent: {
    marginBottom: 10,
  },
  queueDetail: {
    fontSize: 13,
    color: "#1E40AF",
    marginBottom: 6,
  },
  queueActions: {
    flexDirection: "row",
    gap: 10,
  },
  checkButton: {
    flex: 1,
    backgroundColor: "#DBEAFE",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#93C5FD",
  },
  checkButtonText: {
    color: "#1D4ED8",
    fontWeight: "700",
    fontSize: 11,
  },
  acceptCheckButton: {
    flex: 1,
    backgroundColor: "#DCFCE7",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#86EFAC",
  },
  acceptCheckButtonText: {
    color: "#16A34A",
    fontWeight: "700",
    fontSize: 11,
  },

  // Performance Panel
  performancePanel: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  performanceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  perfCard: {
    flex: 1,
    minWidth: "31%",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  perfNumber: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2563EB",
    marginBottom: 4,
  },
  perfLabel: {
    fontSize: 11,
    color: "#64748B",
    textAlign: "center",
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

  // Check Bus Button
  checkBusButton: {
    backgroundColor: "#DBEAFE",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#93C5FD",
  },
  checkBusButtonText: {
    color: "#1D4ED8",
    fontWeight: "700",
  },
  checkedBadge: {
    backgroundColor: "#DCFCE7",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#86EFAC",
  },
  checkedBadgeText: {
    color: "#16A34A",
    fontWeight: "700",
  },

  // Empty State
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
  photoHint: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 6,
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

  // Item Secured Card
  itemSecuredCard: {
    backgroundColor: "#DCFCE7",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#86EFAC",
    alignItems: "center",
  },
  itemSecuredTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#16A34A",
    marginBottom: 8,
  },
  itemSecuredText: {
    fontSize: 14,
    color: "#16A34A",
  },

  // Chat Box
  chatBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  chatMessage: {
    backgroundColor: "#2563EB",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
    alignSelf: "flex-start",
    marginRight: 20,
  },
  chatText: {
    color: "#FFFFFF",
    fontSize: 13,
  },

  // Buttons
  locationButton: {
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  locationButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    marginLeft: 8,
  },
  notifyButton: {
    backgroundColor: "#059669",
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  notifyButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    marginLeft: 8,
  },

  // Not Found Card
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

export default DriverConductorDashboard;
