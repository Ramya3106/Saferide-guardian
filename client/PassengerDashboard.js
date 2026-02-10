import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import { getApiBase } from "./apiConfig";

const API_BASE = getApiBase();

const PassengerDashboard = ({ userEmail, userName, userPhone, onLogout }) => {
  // State management
  const [activeJourney, setActiveJourney] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [currentComplaint, setCurrentComplaint] = useState(null);
  const [gpsEnabled, setGpsEnabled] = useState(true);
  const [showComplaintModal, setShowComplaintModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // Transport selection
  const [transportType, setTransportType] = useState(null); // 'train', 'car', 'bus', 'auto'
  const [modalStep, setModalStep] = useState(1); // 1 = transport selection, 2 = form

  // Complaint form fields
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [itemType, setItemType] = useState("");
  const [description, setDescription] = useState("");
  const [fromLocation, setFromLocation] = useState("");
  const [toLocation, setToLocation] = useState("");
  const [departureTime, setDepartureTime] = useState("");
  const [arrivalTime, setArrivalTime] = useState("");
  const [photoUri, setPhotoUri] = useState(null);

  // Fetch active journey on load
  useEffect(() => {
    fetchActiveJourney();
  }, []);

  // Fetch active journey data
  const fetchActiveJourney = async () => {
    try {
      const response = await axios.get(`${API_BASE}/passenger/dashboard`, {
        headers: { "X-User-Email": userEmail },
      });
      setActiveJourney(response.data.journey || null);
    } catch (error) {
      console.log("Error fetching journey:", error.message);
    }
  };

  // Fetch complaint history
  const fetchComplaintHistory = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/passenger/complaints`, {
        headers: { "X-User-Email": userEmail },
      });
      setComplaints(response.data.complaints || []);
    } catch (error) {
      console.log("Error fetching complaints:", error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle transport selection
  const handleTransportSelect = (type) => {
    setTransportType(type);
    setModalStep(2);
  };

  // Reset modal state
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

  // Create complaint
  const handleCreateComplaint = async () => {
    if (!vehicleNumber.trim() || !itemType.trim() || !description.trim()) {
      alert("Please fill in all required fields");
      return;
    }

    if (!fromLocation.trim() || !toLocation.trim()) {
      alert("Please fill in from and to locations");
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
          journeyId: activeJourney?._id,
          route: `${fromLocation} → ${toLocation}`,
          submitAuthority,
        },
        {
          headers: {
            "X-User-Email": userEmail,
            "X-User-Name": userName,
          },
        },
      );

      setCurrentComplaint(response.data.complaint);
      resetComplaintModal();
      alert(`Request submitted successfully to ${submitAuthority}!`);
    } catch (error) {
      alert("Error creating complaint: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Get submit authority based on transport type
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

  // Get transport icon
  const getTransportIcon = (type) => {
    switch (type) {
      case "train":
        return "train";
      case "car":
        return "car";
      case "bus":
        return "bus";
      case "auto":
        return "bicycle"; // Using bicycle as closest to auto
      default:
        return "help";
    }
  };

  // Update GPS status
  const handleGpsToggle = async () => {
    setGpsEnabled(!gpsEnabled);
    try {
      await axios.post(
        `${API_BASE}/passenger/gps`,
        { enabled: !gpsEnabled },
        {
          headers: { "X-User-Email": userEmail },
        },
      );
    } catch (error) {
      console.log("Error updating GPS:", error.message);
    }
  };

  // ============ RENDER SECTIONS ============

  // Section 1: Header
  const renderHeader = () => (
    <View style={styles.headerSection}>
      <View style={styles.headerContent}>
        <View>
          <Text style={styles.passengerName}>{userName}</Text>
          <Text style={styles.mobileNumber}>📞 {userPhone}</Text>
        </View>
        <TouchableOpacity style={styles.gpsButton} onPress={handleGpsToggle}>
          <Ionicons
            name={gpsEnabled ? "location" : "location-outline"}
            size={20}
            color={gpsEnabled ? "#22C55E" : "#64748B"}
          />
          <Text style={styles.gpsText}>GPS {gpsEnabled ? "ON" : "OFF"}</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.notificationBell}>
        <Ionicons name="notifications-outline" size={24} color="#1E293B" />
        <View style={styles.notificationBadge}>
          <Text style={styles.badgeText}>3</Text>
        </View>
      </TouchableOpacity>
    </View>
  );

  // Section 2: Active Journey Card
  const renderActiveJourney = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>✈️ Active Journey</Text>
      {activeJourney ? (
        <View style={styles.journeyCard}>
          <View style={styles.journeyHeader}>
            <Text style={styles.vehicleNumber}>
              🚌 {activeJourney.vehicleNumber}
            </Text>
            <Text style={styles.badge}>ACTIVE</Text>
          </View>
          <Text style={styles.journeyRoute}>🛣️ {activeJourney.route}</Text>
          <Text style={styles.journeyTime}>
            ⏰ {activeJourney.estimatedDuration || "2h 15min"}
          </Text>
          {activeJourney.driverName && (
            <Text style={styles.journeyMeta}>
              👨‍✈️ Driver: {activeJourney.driverName}
            </Text>
          )}
          {activeJourney.conductorName && (
            <Text style={styles.journeyMeta}>
              👨‍✈️ Conductor: {activeJourney.conductorName}
            </Text>
          )}
          <Text style={styles.journeyMeta}>
            📍 Current: {activeJourney.currentStop}
          </Text>
        </View>
      ) : (
        <View style={styles.journeyCard}>
          <Text style={styles.emptyText}>No active journey</Text>
        </View>
      )}
    </View>
  );

  // Section 3: Primary Action Button
  const renderPrimaryAction = () => (
    <View style={styles.section}>
      <TouchableOpacity
        style={styles.primaryActionButton}
        onPress={() => setShowComplaintModal(true)}
      >
        <Ionicons name="alert-circle" size={32} color="#FFFFFF" />
        <Text style={styles.primaryActionText}>I LEFT SOMETHING</Text>
      </TouchableOpacity>
    </View>
  );

  // Section 4: Complaint Creation Panel
  const renderComplaintPanel = () => (
    <Modal
      visible={showComplaintModal}
      transparent
      animationType="slide"
      onRequestClose={resetComplaintModal}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {modalStep === 1
                ? "Report Lost Item"
                : `Lost Item - ${transportType?.toUpperCase()}`}
            </Text>
            <TouchableOpacity onPress={resetComplaintModal}>
              <Ionicons name="close" size={24} color="#1E293B" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {modalStep === 1 ? (
              // STEP 1: Transport Selection
              <View>
                <Text style={styles.questionText}>
                  In which transport did you lose your item?
                </Text>

                <View style={styles.transportGrid}>
                  <TouchableOpacity
                    style={styles.transportButton}
                    onPress={() => handleTransportSelect("train")}
                  >
                    <Ionicons name="train" size={40} color="#2563EB" />
                    <Text style={styles.transportButtonText}>🚆 Train</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.transportButton}
                    onPress={() => handleTransportSelect("car")}
                  >
                    <Ionicons name="car" size={40} color="#2563EB" />
                    <Text style={styles.transportButtonText}>🚗 Car</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.transportButton}
                    onPress={() => handleTransportSelect("bus")}
                  >
                    <Ionicons name="bus" size={40} color="#2563EB" />
                    <Text style={styles.transportButtonText}>🚌 Bus</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.transportButton}
                    onPress={() => handleTransportSelect("auto")}
                  >
                    <Ionicons name="bicycle" size={40} color="#2563EB" />
                    <Text style={styles.transportButtonText}>🛺 Auto</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              // STEP 2: Dynamic Form Based on Transport
              <View>
                {/* Back Button */}
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => setModalStep(1)}
                >
                  <Ionicons name="arrow-back" size={20} color="#2563EB" />
                  <Text style={styles.backButtonText}>Change Transport</Text>
                </TouchableOpacity>

                {/* Vehicle Number Field */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    {transportType === "train"
                      ? "🚆 Train Number"
                      : transportType === "car"
                        ? "🚗 Car Number"
                        : transportType === "bus"
                          ? "🚌 Bus Number"
                          : "🛺 Auto Number"}
                  </Text>
                  <TextInput
                    style={styles.input}
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

                {/* Item Type Dropdown */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>📦 Item Type</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Bag / Mobile / Wallet / Documents"
                    value={itemType}
                    onChangeText={setItemType}
                  />
                </View>

                {/* Item Description */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>📝 Item Description</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Color, brand, contents..."
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    numberOfLines={4}
                  />
                </View>

                {/* From Location */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    {transportType === "train"
                      ? "🚉 From Station"
                      : "📍 From Location"}
                  </Text>
                  <TextInput
                    style={styles.input}
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

                {/* To Location */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    {transportType === "train"
                      ? "🚉 To Station"
                      : "📍 To Location"}
                  </Text>
                  <TextInput
                    style={styles.input}
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

                {/* Departure Time */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>⏰ Departure Time</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., 10:30 AM"
                    value={departureTime}
                    onChangeText={setDepartureTime}
                  />
                </View>

                {/* Arrival Time */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>⏱️ Arrival Time</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., 12:45 PM"
                    value={arrivalTime}
                    onChangeText={setArrivalTime}
                  />
                </View>

                {/* Auto-captured Details */}
                <View style={styles.autoFillSection}>
                  <Text style={styles.autoFillLabel}>
                    Auto-captured details:
                  </Text>
                  <Text style={styles.autoFillText}>
                    📍 Current Location: {fromLocation || "Pending..."}
                  </Text>
                  <Text style={styles.autoFillText}>
                    🕒 Timestamp: {new Date().toLocaleTimeString()}
                  </Text>
                </View>

                {/* Upload Photo */}
                <TouchableOpacity
                  style={styles.uploadPhotoButton}
                  onPress={() => alert("Camera functionality coming soon!")}
                >
                  <Ionicons name="camera" size={20} color="#2563EB" />
                  <Text style={styles.uploadPhotoText}>
                    📸 Upload Item Photo (Optional)
                  </Text>
                </TouchableOpacity>
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

  // Section 5: Complaint Status Tracker
  const renderComplaintTracker = () => {
    if (!currentComplaint) return null;

    const statuses = [
      { key: "raised", label: "🟡 Complaint Raised", completed: true },
      {
        key: "notified",
        label: "🔵 Staff Notified",
        completed: currentComplaint.staffNotified,
      },
      {
        key: "found",
        label: "🟢 Item Found",
        completed: currentComplaint.itemFound,
      },
      {
        key: "scheduled",
        label: "📍 Meeting Scheduled",
        completed: currentComplaint.meetingScheduled,
      },
      {
        key: "collected",
        label: "✅ Item Collected",
        completed: currentComplaint.itemCollected,
      },
    ];

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📊 Complaint Status</Text>
        <View style={styles.trackerCard}>
          {statuses.map((status, index) => (
            <View key={status.key}>
              <View style={styles.statusStep}>
                <View
                  style={[
                    styles.statusCircle,
                    status.completed && styles.statusCircleActive,
                  ]}
                >
                  <Text style={styles.statusStepText}>{status.label}</Text>
                </View>
              </View>
              {index < statuses.length - 1 && (
                <View
                  style={[
                    styles.statusLine,
                    status.completed && styles.statusLineActive,
                  ]}
                />
              )}
            </View>
          ))}
        </View>
      </View>
    );
  };

  // Section 6: Live Tracking Map
  const renderLiveTracking = () => {
    if (!currentComplaint) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🗺️ Live Tracking</Text>
        <View style={styles.mapPlaceholder}>
          <Ionicons name="map" size={48} color="#CBD5E1" />
          <Text style={styles.mapText}>Live map view</Text>
          <Text style={styles.mapSubtext}>
            Staff location & ETA: {currentComplaint.staffEta || "Pending..."}
          </Text>
        </View>
      </View>
    );
  };

  // Section 7: Staff Message Panel
  const renderStaffMessages = () => {
    if (!currentComplaint) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>💬 Staff Messages</Text>
        <View style={styles.messagesCard}>
          {currentComplaint.messages && currentComplaint.messages.length > 0 ? (
            currentComplaint.messages.map((msg, idx) => (
              <View key={idx} style={styles.messageItem}>
                <Text style={styles.messageStaff}>
                  👤 {msg.staffName || "Staff"}
                </Text>
                <Text style={styles.messageText}>{msg.text}</Text>
                <Text style={styles.messageTime}>{msg.timestamp}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.noMessagesText}>
              Waiting for staff update...
            </Text>
          )}
        </View>
      </View>
    );
  };

  // Section 8: QR Code Pickup
  const renderQRCodePickup = () => {
    if (!currentComplaint || !currentComplaint.itemFound) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📱 QR Code Pickup</Text>
        <View style={styles.qrCard}>
          <View style={styles.qrPlaceholder}>
            <Ionicons name="qr-code" size={80} color="#2563EB" />
            <Text style={styles.qrText}>Scan this QR to collect item</Text>
            <Text style={styles.qrId}>
              ID: {currentComplaint._id?.substring(0, 8)}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.scanButton}
            onPress={() => alert("Camera scan coming soon!")}
          >
            <Ionicons name="camera" size={20} color="#FFFFFF" />
            <Text style={styles.scanButtonText}>📷 Scan Item QR</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Section 9: Complaint History
  const renderComplaintHistory = () => (
    <View style={styles.section}>
      <View style={styles.historyHeader}>
        <Text style={styles.sectionTitle}>📋 Complaint History</Text>
        <TouchableOpacity
          style={styles.viewAllButton}
          onPress={() => {
            setShowHistoryModal(true);
            fetchComplaintHistory();
          }}
        >
          <Text style={styles.viewAllText}>View All</Text>
          <Ionicons name="chevron-forward" size={16} color="#2563EB" />
        </TouchableOpacity>
      </View>

      {complaints.length > 0 ? (
        <View>
          {complaints.slice(0, 3).map((complaint) => (
            <View key={complaint._id} style={styles.historyItem}>
              <View>
                <Text style={styles.historyItemTitle}>
                  {complaint.itemType}
                </Text>
                <Text style={styles.historyItemMeta}>
                  {complaint.vehicleNumber} • {complaint.route}
                </Text>
                <Text style={styles.historyItemDate}>
                  {new Date(complaint.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  complaint.status === "Recovered" && styles.statusBadgeSuccess,
                  complaint.status === "Closed" && styles.statusBadgeInfo,
                ]}
              >
                <Text style={styles.statusBadgeText}>{complaint.status}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.emptyText}>No complaints yet</Text>
      )}
    </View>
  );

  // Section 10: Emergency & Help
  const renderEmergencyHelp = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>🆘 Emergency & Help</Text>
      <View style={styles.emergencyGrid}>
        <TouchableOpacity
          style={styles.emergencyButton}
          onPress={() => alert("Calling emergency hotline...")}
        >
          <Ionicons name="call" size={28} color="#DC2626" />
          <Text style={styles.emergencyButtonText}>Emergency Call</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.emergencyButton}
          onPress={() => alert("📞 Helpline: +91-XXXX-XXXXX")}
        >
          <Ionicons name="information-circle" size={28} color="#2563EB" />
          <Text style={styles.emergencyButtonText}>Helpline</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.emergencyButton}
          onPress={() => alert("FAQ coming soon!")}
        >
          <Ionicons name="help-circle" size={28} color="#7C3AED" />
          <Text style={styles.emergencyButtonText}>FAQ & Help</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Complaint History Modal
  const renderHistoryModal = () => (
    <Modal
      visible={showHistoryModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowHistoryModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>📋 Complaint History</Text>
            <TouchableOpacity onPress={() => setShowHistoryModal(false)}>
              <Ionicons name="close" size={24} color="#1E293B" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {loading ? (
              <ActivityIndicator
                size="large"
                color="#2563EB"
                style={{ marginTop: 20 }}
              />
            ) : complaints.length > 0 ? (
              complaints.map((complaint) => (
                <View key={complaint._id} style={styles.historyFullItem}>
                  <View style={styles.historyFullHeader}>
                    <Text style={styles.historyFullTitle}>
                      {complaint.itemType}
                    </Text>
                    <View
                      style={[
                        styles.statusBadge,
                        complaint.status === "Recovered" &&
                          styles.statusBadgeSuccess,
                      ]}
                    >
                      <Text style={styles.statusBadgeText}>
                        {complaint.status}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.historyFullMeta}>
                    🚌 {complaint.vehicleNumber}
                  </Text>
                  <Text style={styles.historyFullMeta}>
                    🛣️ {complaint.route}
                  </Text>
                  <Text style={styles.historyFullMeta}>
                    📝 {complaint.description}
                  </Text>
                  <Text style={styles.historyFullDate}>
                    {new Date(complaint.createdAt).toLocaleString()}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No complaints found</Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  return (
    <ScrollView style={styles.container}>
      {renderHeader()}

      <View style={styles.content}>
        {renderActiveJourney()}
        {renderPrimaryAction()}
        {renderComplaintPanel()}
        {renderComplaintTracker()}
        {renderLiveTracking()}
        {renderStaffMessages()}
        {renderQRCodePickup()}
        {renderComplaintHistory()}
        {renderHistoryModal()}
        {renderEmergencyHelp()}

        <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
          <Ionicons name="log-out" size={20} color="#FFFFFF" />
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
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
      gap: 12,
      marginBottom: 20,
    },
    transportButton: {
      width: "48%",
      backgroundColor: "#F0F9FF",
      borderWidth: 2,
      borderColor: "#BFDBFE",
      borderRadius: 12,
      padding: 20,
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
    color: "#1E40AF",
    marginTop: 12,
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
  },
});

export default PassengerDashboard;
