import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getApiBase } from "../../../apiConfig";
import DutyStatusCard from "./DutyStatusCard";
import ComplaintAlertListScreen from "./ComplaintAlertListScreen";
import ComplaintDetailView from "./ComplaintDetailView";
import ReplyStatusUpdateForm from "./ReplyStatusUpdateForm";
import DutyHistoryScreen from "./DutyHistoryScreen";

const API_BASE = getApiBase();

const parseRoleFromId = (professionalId, specificRole) => {
  const explicit = String(specificRole || "").trim();
  if (explicit) return explicit;

  const normalized = String(professionalId || "").toUpperCase();
  if (normalized.startsWith("TTR-")) return "TTR";
  if (normalized.startsWith("TTE-")) return "TTE";
  if (normalized.startsWith("RPF-")) return "RPF";
  if (normalized.startsWith("TNPOLICE-")) return "Police";
  return "TTR";
};

const NAV_ITEMS = [
  { key: "dashboard", label: "Officer Dashboard" },
  { key: "alerts", label: "Complaint Alert List" },
  { key: "detail", label: "Complaint Detail View" },
  { key: "reply", label: "Reply / Status Update Form" },
  { key: "history", label: "Duty History" },
];

const OfficerDashboardScreen = ({
  roleLabel,
  officerEmail,
  professionalId,
  specificRole,
  staffName,
  authToken,
  authUserId,
  onLogout,
  onDuty,
  setOnDuty,
}) => {
  const dutyUnit = useMemo(() => parseRoleFromId(professionalId, specificRole), [professionalId, specificRole]);
  const officerName = staffName || officerEmail || professionalId || "Duty Officer";

  const [activeView, setActiveView] = useState("dashboard");
  const [alerts, setAlerts] = useState([]);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [dutyAttendance, setDutyAttendance] = useState(null);
  const [dutyHistory, setDutyHistory] = useState([]);
  const [dutyTrain, setDutyTrain] = useState("");
  const [dutyRoute, setDutyRoute] = useState("");
  const [dutyStation, setDutyStation] = useState("");
  const [dutyShift, setDutyShift] = useState("");
  const [dutySyncing, setDutySyncing] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [error, setError] = useState("");

  const buildHeaders = (extra = {}) => ({
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    "X-User-Role": "TTR/RPF/Police",
    ...extra,
  });

  const loadDutyStatus = async () => {
    try {
      const response = await axios.get(`${API_BASE}/auth/duty/status`, {
        params: {
          email: officerEmail || undefined,
          professionalId: professionalId || undefined,
        },
        headers: buildHeaders({
          "X-User-Email": officerEmail || "",
          "X-Professional-Id": professionalId || "",
        }),
      });

      const payload = response.data?.data || response.data || {};
      const attendance = payload?.attendance || null;
      setDutyAttendance(attendance);
      if (setOnDuty) {
        setOnDuty(Boolean(payload?.onDuty));
      }

      if (attendance) {
        setDutyTrain(attendance.assignedTrain || "");
        setDutyRoute(attendance.assignedRoute || "");
        setDutyStation(attendance.assignedStation || "");
        setDutyShift(attendance.assignedShift || "");
      }
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError.message || "Unable to load duty status");
    }
  };

  const loadAlerts = async () => {
    if (!onDuty) {
      setAlerts([]);
      setSelectedComplaint(null);
      return;
    }

    try {
      const response = await axios.get(`${API_BASE}/passenger/live-alerts`, {
        params: { staffRole: dutyUnit },
        headers: buildHeaders({
          "X-User-Email": officerEmail || "",
          "X-Professional-Id": professionalId || "",
          "X-User-Name": officerName,
          "X-Duty-Unit": dutyUnit,
          "X-On-Duty": String(onDuty),
        }),
      });

      const payload = response.data?.data || response.data || {};
      const list = Array.isArray(payload?.alerts)
        ? response.data.alerts.map((alert) => ({
            id: alert._id || alert.complaintId || alert.id,
            status: alert.status || "Submitted",
            passengerName: alert.passengerName || "Passenger",
            itemType: alert.itemType || alert.lostItemType || "Item",
            description: alert.description || "Lost-item complaint",
            vehicleNumber: alert.vehicleNumber || alert.trainNumber || "Train",
            route: alert.route || `${alert.fromLocation || "Origin"} -> ${alert.toLocation || "Destination"}`,
            nextStation: alert.recoveryStation || alert.meetingPoint || alert.toLocation || "Next station",
            priority: alert.priority || alert.urgencyLevel || "Normal",
          }))
        : [];

      setAlerts(list);
      setSelectedComplaint((current) => list.find((entry) => entry.id === current?.id) || list[0] || null);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError.message || "Unable to load complaints");
    }
  };

  const loadDutyHistory = async () => {
    if (!authUserId) {
      setDutyHistory([]);
      return;
    }

    try {
      const response = await axios.get(`${API_BASE}/duty/history/${authUserId}`, {
        headers: buildHeaders({
          "X-User-Email": officerEmail || "",
          "X-Professional-Id": professionalId || "",
        }),
      });

      const payload = response.data?.data || response.data || {};
      setDutyHistory(Array.isArray(payload?.history) ? payload.history : []);
    } catch {
      setDutyHistory([]);
    }
  };

  useEffect(() => {
    loadDutyStatus();
  }, [officerEmail, professionalId, dutyUnit]);

  useEffect(() => {
    loadAlerts();
  }, [onDuty, dutyUnit, officerEmail, professionalId]);

  useEffect(() => {
    loadDutyHistory();
  }, [authUserId, dutyAttendance?._id]);

  const syncDuty = async (nextOnDuty) => {
    setDutySyncing(true);
    setError("");

    try {
      const endpoint = nextOnDuty ? "/auth/duty/check-in" : "/auth/duty/check-out";
      const response = await axios.post(
        `${API_BASE}${endpoint}`,
        {
          email: officerEmail || undefined,
          professionalId: professionalId || undefined,
          dutyUnit,
          assignedTrain: dutyTrain || null,
          assignedRoute: dutyRoute || null,
          assignedStation: dutyStation || null,
          assignedShift: dutyShift || null,
        },
        {
          headers: buildHeaders({
            "X-User-Email": officerEmail || "",
            "X-Professional-Id": professionalId || "",
            "X-User-Name": officerName,
            "X-Duty-Unit": dutyUnit,
          }),
        },
      );

      if (setOnDuty) {
        setOnDuty(nextOnDuty);
      }

      setDutyAttendance(response.data?.attendance || null);
      await loadAlerts();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError.message || "Unable to update duty status");
    } finally {
      setDutySyncing(false);
    }
  };

  const handleSubmitReply = async (message, status) => {
    if (!selectedComplaint) {
      return;
    }

    setSendingReply(true);
    setError("");

    try {
      await axios.post(
        `${API_BASE}/passenger/complaints/${selectedComplaint.id}/staff/respond`,
        {
          text: message,
          markPassengerContacted: status === "Passenger Contacted",
        },
        {
          headers: buildHeaders({
            "X-User-Email": officerEmail || "",
            "X-Professional-Id": professionalId || "",
            "X-User-Name": officerName,
            "X-Duty-Unit": dutyUnit,
            "X-On-Duty": String(onDuty),
          }),
        },
      );
      await loadAlerts();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError.message || "Unable to send reply");
    } finally {
      setSendingReply(false);
    }
  };

  const handleSubmitStatus = async (status) => {
    if (!selectedComplaint) {
      return;
    }

    setSendingReply(true);
    setError("");

    try {
      await axios.patch(
        `${API_BASE}/passenger/complaints/${selectedComplaint.id}/staff/status`,
        {
          status,
          itemFound: status === "Item Found",
          meetingScheduled: status === "Ready for Handover",
          staffResponseStatus: `Status updated to ${status}`,
        },
        {
          headers: buildHeaders({
            "X-User-Email": officerEmail || "",
            "X-Professional-Id": professionalId || "",
            "X-User-Name": officerName,
            "X-Duty-Unit": dutyUnit,
            "X-On-Duty": String(onDuty),
          }),
        },
      );
      await loadAlerts();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError.message || "Unable to update status");
    } finally {
      setSendingReply(false);
    }
  };

  return (
    <SafeAreaView style={styles.shell}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topCard}>
          <Text style={styles.kicker}>Officer Side</Text>
          <Text style={styles.title}>{roleLabel || `${dutyUnit} Dashboard`}</Text>
          <Text style={styles.subtitle}>{officerName}</Text>
        </View>

        <View style={styles.navWrap}>
          {NAV_ITEMS.map((item) => {
            const selected = activeView === item.key;
            return (
              <Pressable
                key={item.key}
                style={[styles.navChip, selected && styles.navChipActive]}
                onPress={() => setActiveView(item.key)}
              >
                <Text style={[styles.navChipText, selected && styles.navChipTextActive]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <DutyStatusCard
          onDuty={onDuty}
          syncing={dutySyncing}
          dutyTrain={dutyTrain}
          dutyRoute={dutyRoute}
          dutyStation={dutyStation}
          dutyShift={dutyShift}
          onChangeTrain={setDutyTrain}
          onChangeRoute={setDutyRoute}
          onChangeStation={setDutyStation}
          onChangeShift={setDutyShift}
          onCheckIn={() => syncDuty(true)}
          onCheckOut={() => syncDuty(false)}
          attendance={dutyAttendance}
        />

        {activeView === "dashboard" ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Your Profile</Text>
            <View style={styles.profileSection}>
              <Text style={styles.profileLabel}>Officer Name:</Text>
              <Text style={styles.profileValue}>{officerName}</Text>
              
              <Text style={styles.profileLabel}>Email:</Text>
              <Text style={styles.profileValue}>{officerEmail || "Not provided"}</Text>
              
              <Text style={styles.profileLabel}>Professional ID:</Text>
              <Text style={styles.profileValue}>{professionalId || "Not provided"}</Text>
              
              <Text style={styles.profileLabel}>Role:</Text>
              <Text style={styles.profileValue}>{dutyUnit}</Text>
              
              <Text style={styles.profileLabel}>Duty Status:</Text>
              <Text style={[styles.profileValue, onDuty ? styles.onDutyText : styles.offDutyText]}>
                {onDuty ? "ON DUTY" : "OFF DUTY"}
              </Text>
            </View>

            {alerts.length === 0 ? (
              <View style={styles.emptyStateSection}>
                <Text style={styles.emptyStateTitle}>No Complaints Assigned</Text>
                <Text style={styles.emptyStateMessage}>
                  You don't have any complaints assigned yet. Check back later or contact your supervisor for new assignments.
                </Text>
              </View>
            ) : (
              <View style={styles.complaintsSummarySection}>
                <Text style={styles.complaintsSummaryTitle}>Your Assignments</Text>
                <Text style={styles.complaintsSummaryCount}>Active Complaints: {alerts.length}</Text>
                <Text style={styles.complaintsSummaryHint}>Go to "Complaint Alert List" to view details</Text>
              </View>
            )}
          </View>
        ) : null}

        {activeView === "alerts" ? (
          <ComplaintAlertListScreen
            alerts={alerts}
            selectedId={selectedComplaint?.id || ""}
            onSelect={(item) => {
              setSelectedComplaint(item);
              setActiveView("detail");
            }}
          />
        ) : null}

        {activeView === "detail" ? (
          <ComplaintDetailView complaint={selectedComplaint} onOpenReply={() => setActiveView("reply")} />
        ) : null}

        {activeView === "reply" ? (
          <ReplyStatusUpdateForm
            complaint={selectedComplaint}
            sending={sendingReply}
            onSubmitReply={handleSubmitReply}
            onSubmitStatus={handleSubmitStatus}
          />
        ) : null}

        {activeView === "history" ? <DutyHistoryScreen history={dutyHistory} /> : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={styles.logoutButton} onPress={onLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: "#E2E8F0",
  },
  content: {
    padding: 14,
    gap: 12,
  },
  topCard: {
    backgroundColor: "#0F172A",
    borderRadius: 14,
    padding: 14,
  },
  kicker: {
    color: "#93C5FD",
    fontSize: 12,
    fontWeight: "700",
  },
  title: {
    color: "#F8FAFC",
    fontSize: 22,
    fontWeight: "800",
    marginTop: 2,
  },
  subtitle: {
    color: "#CBD5E1",
    marginTop: 4,
  },
  navWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  navChip: {
    borderWidth: 1,
    borderColor: "#94A3B8",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#FFFFFF",
  },
  navChipActive: {
    borderColor: "#1D4ED8",
    backgroundColor: "#DBEAFE",
  },
  navChipText: {
    color: "#334155",
    fontSize: 12,
  },
  navChipTextActive: {
    color: "#1E3A8A",
    fontWeight: "700",
  },
  sectionCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    padding: 12,
    gap: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
  },
  sectionMeta: {
    fontSize: 13,
    color: "#334155",
  },
  profileSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    gap: 10,
  },
  profileLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  profileValue: {
    fontSize: 14,
    color: "#0F172A",
    fontWeight: "500",
    marginBottom: 8,
  },
  onDutyText: {
    color: "#16A34A",
    fontWeight: "700",
  },
  offDutyText: {
    color: "#DC2626",
    fontWeight: "700",
  },
  emptyStateSection: {
    marginTop: 16,
    paddingVertical: 20,
    paddingHorizontal: 12,
    backgroundColor: "#F0F9FF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E0F2FE",
    alignItems: "center",
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0369A1",
    marginBottom: 8,
  },
  emptyStateMessage: {
    fontSize: 12,
    color: "#0C4A6E",
    textAlign: "center",
    lineHeight: 18,
  },
  complaintsSummarySection: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "#F0FDF4",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#DCFCE7",
  },
  complaintsSummaryTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#15803D",
    marginBottom: 6,
  },
  complaintsSummaryCount: {
    fontSize: 13,
    color: "#166534",
    fontWeight: "600",
  },
  complaintsSummaryHint: {
    fontSize: 12,
    color: "#4B5563",
    marginTop: 6,
    fontStyle: "italic",
  },
  error: {
    color: "#B91C1C",
    fontSize: 12,
  },
  logoutButton: {
    marginTop: 4,
    borderRadius: 10,
    paddingVertical: 12,
    backgroundColor: "#1E293B",
    alignItems: "center",
  },
  logoutText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});

export default OfficerDashboardScreen;
