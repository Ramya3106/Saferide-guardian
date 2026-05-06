import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

/**
 * PriorityBadge Component
 * Displays complaint priority with color-coded visual indicator
 * Used in complaint lists and detail views
 */
export default function PriorityBadge({
  priority = "Normal",
  size = "medium",
  showLabel = true,
  style = {},
}) {
  // Priority configuration
  const priorityConfig = {
    Low: {
      color: "#10B981",
      backgroundColor: "#D1FAE5",
      icon: "checkmark-circle",
      label: "Low",
    },
    Normal: {
      color: "#3B82F6",
      backgroundColor: "#DBEAFE",
      icon: "radio-button-on",
      label: "Normal",
    },
    High: {
      color: "#F59E0B",
      backgroundColor: "#FEF3C7",
      icon: "warning",
      label: "High",
    },
    Critical: {
      color: "#EF4444",
      backgroundColor: "#FEE2E2",
      icon: "alert-circle",
      label: "CRITICAL",
    },
  };

  const config = priorityConfig[priority] || priorityConfig.Normal;

  // Size mappings
  const sizeMap = {
    small: { iconSize: 14, fontSize: 11, padding: 4 },
    medium: { iconSize: 16, fontSize: 12, padding: 6 },
    large: { iconSize: 20, fontSize: 14, padding: 8 },
  };

  const sizeConfig = sizeMap[size] || sizeMap.medium;

  // For Critical priority, add pulsing animation indicator
  const isCritical = priority === "Critical";

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: config.backgroundColor,
          paddingVertical: sizeConfig.padding,
          paddingHorizontal: sizeConfig.padding + 2,
        },
        isCritical && styles.criticalBadge,
        style,
      ]}
    >
      <View style={styles.badgeContent}>
        <Ionicons
          name={config.icon}
          size={sizeConfig.iconSize}
          color={config.color}
          style={{ marginRight: 4 }}
        />
        {showLabel && (
          <Text
            style={[
              styles.badgeText,
              {
                color: config.color,
                fontSize: sizeConfig.fontSize,
                fontWeight: isCritical ? "700" : "600",
              },
            ]}
          >
            {config.label}
          </Text>
        )}
      </View>
    </View>
  );
}

/**
 * PriorityBadgeList Component
 * Shows all badges in complaint list items
 */
export function PriorityBadgeList({ complaint, style = {} }) {
  if (!complaint) return null;

  const priority = complaint.priority || "Normal";
  const isAutoEscalated = complaint.autoEscalated;
  const isHighPriority = priority === "Critical" || priority === "High";

  return (
    <View style={[styles.badgeListContainer, style]}>
      <PriorityBadge priority={priority} size="medium" />
      {isAutoEscalated && (
        <View
          style={[
            styles.escalatedBadge,
            { backgroundColor: "#FEE2E2", borderColor: "#EF4444" },
          ]}
        >
          <Ionicons name="chevron-up" size={12} color="#EF4444" />
          <Text style={{ color: "#EF4444", fontSize: 10, fontWeight: "600" }}>
            ESCALATED
          </Text>
        </View>
      )}
      {isHighPriority && !complaint.acceptedAt && (
        <View
          style={[
            styles.urgentBadge,
            { backgroundColor: "#FFE5E5", borderColor: "#EF4444" },
          ]}
        >
          <Ionicons name="time" size={12} color="#EF4444" />
          <Text style={{ color: "#EF4444", fontSize: 10, fontWeight: "600" }}>
            PENDING
          </Text>
        </View>
      )}
    </View>
  );
}

/**
 * PrioritySummary Component
 * Shows priority breakdown with factors
 */
export function PrioritySummary({ complaint, style = {} }) {
  if (!complaint || !complaint.priorityFactors) return null;

  const factors = complaint.priorityFactors;
  const factorsList = [];

  if (factors.securitySuspicion) {
    factorsList.push("🔐 Security Suspicion");
  }
  if (factors.theftIndication) {
    factorsList.push("🚨 Theft Indication");
  }
  if (factors.itemValue && factors.itemValueAmount) {
    if (factors.itemValueAmount > 10000) {
      factorsList.push(`💰 Very High Value (₹${factors.itemValueAmount})`);
    } else if (factors.itemValueAmount > 2000) {
      factorsList.push(`💰 High Value (₹${factors.itemValueAmount})`);
    }
  }
  if (factors.passengerVulnerability && factors.passengerVulnerability !== "Adult") {
    factorsList.push(`👤 ${factors.passengerVulnerability} Passenger`);
  }
  if (factors.nightTravel) {
    factorsList.push("🌙 Night Travel");
  }
  if (factors.itemRisk === "High") {
    factorsList.push("⚠️ High-Risk Item");
  }

  return (
    <View style={[styles.summaryContainer, style]}>
      <Text style={styles.summaryTitle}>Priority Factors:</Text>
      {factorsList.length > 0 ? (
        <View style={styles.factorsList}>
          {factorsList.map((factor, idx) => (
            <Text key={idx} style={styles.factorItem}>
              {factor}
            </Text>
          ))}
        </View>
      ) : (
        <Text style={styles.noFactorsText}>Standard assessment</Text>
      )}
    </View>
  );
}

/**
 * PriorityHeader Component
 * Large header display for complaint detail view
 */
export function PriorityHeader({ complaint, style = {} }) {
  if (!complaint) return null;

  const priority = complaint.priority || "Normal";
  const isCritical = priority === "Critical";
  const isHigh = priority === "High";

  const colorMap = {
    Low: "#10B981",
    Normal: "#3B82F6",
    High: "#F59E0B",
    Critical: "#EF4444",
  };

  const bgColorMap = {
    Low: "#ECFDF5",
    Normal: "#EFF6FF",
    High: "#FFFBEB",
    Critical: "#FEF2F2",
  };

  return (
    <View
      style={[
        styles.headerContainer,
        {
          backgroundColor: bgColorMap[priority],
          borderLeftColor: colorMap[priority],
        },
        (isCritical || isHigh) && styles.headerHighPriority,
        style,
      ]}
    >
      <View style={styles.headerContent}>
        <View style={styles.headerTitleRow}>
          <Ionicons
            name={
              isCritical
                ? "alert-circle"
                : isHigh
                ? "warning"
                : "information-circle"
            }
            size={24}
            color={colorMap[priority]}
          />
          <Text
            style={[
              styles.headerTitle,
              {
                color: colorMap[priority],
                fontWeight: isCritical ? "700" : "600",
              },
            ]}
          >
            {isCritical ? "🚨 CRITICAL PRIORITY" : isHigh ? "⚠️ High Priority" : priority}
          </Text>
        </View>

        {complaint.alertPriorityReason && (
          <Text style={styles.headerReason}>{complaint.alertPriorityReason}</Text>
        )}

        {complaint.autoEscalated && (
          <View style={styles.escalationNotice}>
            <Ionicons name="alert" size={14} color="#EF4444" />
            <Text style={styles.escalationText}>
              Auto-escalated due to no acceptance within timeout
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
  },
  criticalBadge: {
    borderWidth: 1.5,
    borderColor: "#EF4444",
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  badgeContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontWeight: "600",
    textAlign: "center",
  },
  badgeListContainer: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
    alignItems: "center",
  },
  escalatedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  urgentBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  summaryContainer: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#3B82F6",
  },
  summaryTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  factorsList: {
    gap: 4,
  },
  factorItem: {
    fontSize: 12,
    color: "#4B5563",
    marginLeft: 4,
  },
  noFactorsText: {
    fontSize: 12,
    color: "#9CA3AF",
    fontStyle: "italic",
  },
  headerContainer: {
    borderLeftWidth: 4,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  headerHighPriority: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  headerContent: {
    gap: 8,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  headerReason: {
    fontSize: 13,
    color: "#4B5563",
    marginLeft: 32,
  },
  escalationNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEE2E2",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginLeft: 32,
  },
  escalationText: {
    fontSize: 12,
    color: "#EF4444",
    fontWeight: "500",
    flex: 1,
  },
});
