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
            <Text style={styles.sectionTitle}>Officer Dashboard</Text>
            <Text style={styles.sectionMeta}>Active alerts: {alerts.length}</Text>
            <Text style={styles.sectionMeta}>Current unit: {dutyUnit}</Text>
            <Text style={styles.sectionMeta}>Duty mode: {onDuty ? "ON" : "OFF"}</Text>
            <Text style={styles.sectionMeta}>Selected complaint: {selectedComplaint?.id || "None"}</Text>
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
