import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import QRScannerButton from "../components/QRScannerButton";
import { useQRScanner } from "../hooks/useQRScanner";

/**
 * Example QR Scanner Integration Screen
 * Demonstrates how to use the QR Scanner components and hooks
 */
const QRScannerExampleScreen = ({ navigation }) => {
  const { scanHistory, lastScannedData, clearHistory, removeFromHistory } =
    useQRScanner();
  const [selectedData, setSelectedData] = useState(null);

  const handleOpenScanner = () => {
    navigation.navigate("QRScanner", {
      onScanComplete: (data) => {
        Alert.alert("Success", `Scanned: ${data}`);
      },
    });
  };

  const handleDeleteItem = (index) => {
    Alert.alert("Delete", "Remove this scan from history?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        onPress: () => removeFromHistory(index),
        style: "destructive",
      },
    ]);
  };

  const handleCopyToClipboard = async (data) => {
    // Import clipboard from expo if needed
    Alert.alert("Success", `Copied: ${data}`);
  };

  const renderHistoryItem = ({ item, index }) => (
    <View style={styles.historyItem}>
      <View style={styles.historyContent}>
        <Ionicons name="qr-code" size={24} color="#3B82F6" />
        <View style={styles.historyText}>
          <Text style={styles.historyData} numberOfLines={1}>
            {item.data}
          </Text>
          <Text style={styles.historyTime}>
            {new Date(item.timestamp).toLocaleTimeString()}
          </Text>
        </View>
      </View>
      <View style={styles.historyActions}>
        <TouchableOpacity
          onPress={() => handleCopyToClipboard(item.data)}
          style={styles.actionButton}
        >
          <Ionicons name="copy" size={18} color="#3B82F6" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleDeleteItem(index)}
          style={styles.actionButton}
        >
          <Ionicons name="trash" size={18} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>QR Code Scanner</Text>
        <Text style={styles.subtitle}>Scan and manage QR codes</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Scanner Buttons Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Open Scanner</Text>
          <View style={styles.buttonGrid}>
            <QRScannerButton
              onPress={handleOpenScanner}
              variant="primary"
              size="large"
              label="Start Scanning"
            />
          </View>

          <View style={styles.buttonGrid}>
            <QRScannerButton
              onPress={handleOpenScanner}
              variant="secondary"
              size="medium"
              label="Scan Again"
            />
            <QRScannerButton
              onPress={handleOpenScanner}
              variant="icon"
              size="medium"
            />
          </View>
        </View>

        {/* Last Scanned Section */}
        {lastScannedData && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Last Scanned</Text>
            <View style={styles.lastScannedCard}>
              <View style={styles.lastScannedHeader}>
                <Ionicons name="checkmark-circle" size={32} color="#22C55E" />
                <Text style={styles.lastScannedText}>Successfully Scanned</Text>
              </View>
              <View style={styles.lastScannedData}>
                <Text style={styles.dataLabel}>Data:</Text>
                <Text style={styles.dataValue} selectable={true}>
                  {lastScannedData}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Scan History Section */}
        <View style={styles.section}>
          <View style={styles.historyHeader}>
            <Text style={styles.sectionTitle}>Scan History</Text>
            {scanHistory.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  Alert.alert("Clear History", "Delete all scan records?", [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Clear",
                      onPress: clearHistory,
                      style: "destructive",
                    },
                  ]);
                }}
              >
                <Text style={styles.clearButton}>Clear All</Text>
              </TouchableOpacity>
            )}
          </View>

          {scanHistory.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="qr-code" size={64} color="#9CA3AF" />
              <Text style={styles.emptyStateText}>No scans yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Start scanning QR codes to see them here
              </Text>
            </View>
          ) : (
            <FlatList
              data={scanHistory}
              renderItem={renderHistoryItem}
              keyExtractor={(_, index) => index.toString()}
              scrollEnabled={false}
              ItemSeparatorComponent={() => (
                <View style={styles.separator} />
              )}
            />
          )}
        </View>

        {/* Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Features</Text>
          <View style={styles.featureList}>
            <View style={styles.featureItem}>
              <View style={styles.featureBadge}>
                <Ionicons name="camera" size={20} color="#3B82F6" />
              </View>
              <View style={styles.featureText}>
                <Text style={styles.featureName}>Camera Access</Text>
                <Text style={styles.featureDesc}>
                  Requires camera permission
                </Text>
              </View>
            </View>

            <View style={styles.featureItem}>
              <View style={styles.featureBadge}>
                <Ionicons name="analytics" size={20} color="#22C55E" />
              </View>
              <View style={styles.featureText}>
                <Text style={styles.featureName}>Auto Detection</Text>
                <Text style={styles.featureDesc}>Automatically detects QR</Text>
              </View>
            </View>

            <View style={styles.featureItem}>
              <View style={styles.featureBadge}>
                <Ionicons name="history" size={20} color="#F59E0B" />
              </View>
              <View style={styles.featureText}>
                <Text style={styles.featureName}>History Tracking</Text>
                <Text style={styles.featureDesc}>
                  Keep track of scanned codes
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111827",
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 4,
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 8,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 12,
  },
  buttonGrid: {
    gap: 12,
  },
  lastScannedCard: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#DCFCE7",
    borderRadius: 12,
    padding: 16,
  },
  lastScannedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  lastScannedText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#22C55E",
  },
  lastScannedData: {
    backgroundColor: "white",
    borderRadius: 8,
    padding: 12,
  },
  dataLabel: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
    marginBottom: 4,
  },
  dataValue: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "600",
    fontFamily: "monospace",
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  clearButton: {
    color: "#EF4444",
    fontSize: 14,
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6B7280",
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: "#9CA3AF",
    marginTop: 4,
  },
  historyItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  historyContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  historyText: {
    flex: 1,
  },
  historyData: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111827",
  },
  historyTime: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
  },
  historyActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: "#F3F4F6",
  },
  separator: {
    height: 1,
    backgroundColor: "#E5E7EB",
  },
  featureList: {
    gap: 12,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  featureBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  featureText: {
    flex: 1,
  },
  featureName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  featureDesc: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
});

export default QRScannerExampleScreen;
