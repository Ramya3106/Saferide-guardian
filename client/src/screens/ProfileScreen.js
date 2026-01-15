import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { useAuth } from "../context/AuthContext";

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: logout },
    ]);
  };

  const getRoleIcon = (role) => {
    const icons = {
      passenger: "🧑‍💼",
      driver: "🚗",
      conductor: "🎫",
      ttr: "🎟️",
      rpf: "👮",
      police: "🚔",
      admin: "⚙️",
    };
    return icons[role] || "👤";
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.avatar}>{getRoleIcon(user?.role)}</Text>
        <Text style={styles.name}>{user?.name}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>
            {user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1)}
          </Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>📱 Phone</Text>
          <Text style={styles.infoValue}>{user?.phone}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>🆔 User ID</Text>
          <Text style={styles.infoValue}>{user?.id?.slice(-8)}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About SafeRide Guardian</Text>
        <Text style={styles.aboutText}>
          Automated lost item recovery system for Indian public transport. Using
          AI-powered alerts and real-time tracking to achieve 85% recovery rate.
        </Text>
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>92%</Text>
            <Text style={styles.statLabel}>Prediction Accuracy</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>12 min</Text>
            <Text style={styles.statLabel}>Avg Response</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>🚪 Logout</Text>
      </TouchableOpacity>

      <Text style={styles.version}>Version 1.0.0</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f0f23",
    padding: 20,
  },
  header: {
    alignItems: "center",
    marginBottom: 30,
    marginTop: 20,
  },
  avatar: {
    fontSize: 72,
    marginBottom: 15,
  },
  name: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
  },
  roleBadge: {
    backgroundColor: "#e94560",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  roleText: {
    color: "#fff",
    fontWeight: "600",
  },
  infoCard: {
    backgroundColor: "#1a1a2e",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  infoLabel: {
    color: "#8b8b8b",
    fontSize: 15,
  },
  infoValue: {
    color: "#fff",
    fontSize: 15,
  },
  divider: {
    height: 1,
    backgroundColor: "#16213e",
    marginVertical: 8,
  },
  section: {
    backgroundColor: "#1a1a2e",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    color: "#e94560",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
  },
  aboutText: {
    color: "#8b8b8b",
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 15,
  },
  stats: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  stat: {
    alignItems: "center",
  },
  statValue: {
    color: "#e94560",
    fontSize: 24,
    fontWeight: "bold",
  },
  statLabel: {
    color: "#666",
    fontSize: 12,
    marginTop: 4,
  },
  logoutBtn: {
    backgroundColor: "#16213e",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e94560",
  },
  logoutText: {
    color: "#e94560",
    fontSize: 16,
    fontWeight: "600",
  },
  version: {
    color: "#666",
    textAlign: "center",
    marginTop: 20,
    fontSize: 12,
  },
});
