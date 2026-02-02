import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useAuth } from "../context/AuthContext";

export default function HomeScreen({ navigation }) {
  const { user } = useAuth();

  const stats = [
    { label: "Recovery Rate", value: "85%", icon: "📈" },
    { label: "Avg Response", value: "12 min", icon: "⏱️" },
    { label: "Items Secured", value: "2,450+", icon: "🔒" },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Hello, {user?.name}! 👋</Text>
        <Text style={styles.subGreeting}>Keep your belongings safe</Text>
      </View>

      <View style={styles.statsContainer}>
        {stats.map((stat, i) => (
          <View key={i} style={styles.statCard}>
            <Text style={styles.statIcon}>{stat.icon}</Text>
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.quickActions}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate("Report")}
        >
          <Text style={styles.actionIcon}>🚨</Text>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Report Lost Item</Text>
            <Text style={styles.actionDesc}>
              File a complaint with geo-location and photos
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate("MyComplaints")}
        >
          <Text style={styles.actionIcon}>📋</Text>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Track My Items</Text>
            <Text style={styles.actionDesc}>
              View status of your reported items
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>How It Works</Text>
        <View style={styles.step}>
          <Text style={styles.stepNum}>1</Text>
          <Text style={styles.stepText}>
            Report lost item with details & photos
          </Text>
        </View>
        <View style={styles.step}>
          <Text style={styles.stepNum}>2</Text>
          <Text style={styles.stepText}>
            AI routes alerts to relevant staff
          </Text>
        </View>
        <View style={styles.step}>
          <Text style={styles.stepNum}>3</Text>
          <Text style={styles.stepText}>Track real-time status updates</Text>
        </View>
        <View style={styles.step}>
          <Text style={styles.stepNum}>4</Text>
          <Text style={styles.stepText}>
            Secure handoff with QR verification
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f0f23",
  },
  header: {
    padding: 20,
    paddingTop: 30,
  },
  greeting: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#fff",
  },
  subGreeting: {
    fontSize: 16,
    color: "#8b8b8b",
    marginTop: 5,
  },
  statsContainer: {
    flexDirection: "row",
    paddingHorizontal: 15,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#1a1a2e",
    borderRadius: 16,
    padding: 15,
    alignItems: "center",
  },
  statIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#e94560",
  },
  statLabel: {
    fontSize: 12,
    color: "#8b8b8b",
    marginTop: 4,
  },
  quickActions: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 15,
  },
  actionCard: {
    backgroundColor: "#1a1a2e",
    borderRadius: 16,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  actionIcon: {
    fontSize: 36,
    marginRight: 15,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
  actionDesc: {
    fontSize: 14,
    color: "#8b8b8b",
    marginTop: 4,
  },
  infoCard: {
    backgroundColor: "#16213e",
    margin: 20,
    borderRadius: 16,
    padding: 20,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#e94560",
    marginBottom: 15,
  },
  step: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#e94560",
    color: "#fff",
    textAlign: "center",
    lineHeight: 28,
    fontWeight: "bold",
    marginRight: 12,
  },
  stepText: {
    flex: 1,
    color: "#fff",
    fontSize: 14,
  },
});