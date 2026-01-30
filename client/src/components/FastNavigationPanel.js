import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";

/**
 * FastNavigationPanel - Quick access navigation component
 * Provides fast shortcuts to main app features
 */
export default function FastNavigationPanel({ userRole }) {
  const navigation = useNavigation();
  const navigationOptions = [
    {
      id: "home",
      label: "🏠 Home",
      description: "Go to dashboard",
      action: () => navigation.navigate("Home"),
      roles: ["user", "staff", "admin"],
    },
    {
      id: "report",
      label: "🚨 Report Lost Item",
      description: "File new complaint",
      action: () => navigation.navigate("Report"),
      roles: ["user"],
    },
    {
      id: "mycomplaints",
      label: "📋 My Complaints",
      description: "Track your items",
      action: () => navigation.navigate("MyComplaints"),
      roles: ["user"],
    },
    {
      id: "qr",
      label: "📷 Scan QR Code",
      description: "Quick scan feature",
      action: () => navigation.navigate("QRCodeScanner"),
      roles: ["user", "staff"],
    },
    {
      id: "alerts",
      label: "🔔 Alerts",
      description: "View all alerts",
      action: () => navigation.navigate("Alerts"),
      roles: ["staff", "admin"],
    },
    {
      id: "profile",
      label: "👤 Profile",
      description: "Your account settings",
      action: () => navigation.navigate("Profile"),
      roles: ["user", "staff", "admin"],
    },
  ];

  const filteredOptions = navigationOptions.filter((opt) =>
    opt.roles.includes(userRole || "user"),
  );

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scrollView}
      >
        {filteredOptions.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={styles.navItem}
            onPress={option.action}
            activeOpacity={0.7}
          >
            <View style={styles.navContent}>
              <Text style={styles.navLabel}>{option.label}</Text>
              <Text style={styles.navDesc}>{option.description}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#0f0f23",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a2e",
  },
  scrollView: {
    paddingHorizontal: 10,
  },
  navItem: {
    backgroundColor: "#1a1a2e",
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 5,
    minWidth: 140,
    borderLeftWidth: 3,
    borderLeftColor: "#e94560",
  },
  navContent: {
    alignItems: "center",
  },
  navLabel: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "bold",
    textAlign: "center",
  },
  navDesc: {
    color: "#8b8b8b",
    fontSize: 10,
    marginTop: 4,
    textAlign: "center",
  },
});
