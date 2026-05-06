import React from "react";
import { View, Text } from "react-native";
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
      className={`flex-row items-center justify-center rounded-2xl ${isCritical ? 'border-[1.5px] border-red-500 shadow-sm shadow-red-500' : ''}`}
      style={[
        {
          backgroundColor: config.backgroundColor,
          paddingVertical: sizeConfig.padding,
          paddingHorizontal: sizeConfig.padding + 2,
        },
        style,
      ]}
    >
      <View className="flex-row items-center justify-center">
        <Ionicons
          name={config.icon}
          size={sizeConfig.iconSize}
          color={config.color}
          style={{ marginRight: 4 }}
        />
        {showLabel && (
          <Text
            className={`text-center ${isCritical ? 'font-bold' : 'font-semibold'}`}
            style={{
              color: config.color,
              fontSize: sizeConfig.fontSize,
            }}
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
    <View className="flex-row flex-wrap items-center gap-1.5" style={style}>
      <PriorityBadge priority={priority} size="medium" />
      {isAutoEscalated && (
        <View className="flex-row items-center gap-1 px-1.5 py-1 rounded-xl border border-red-500 bg-red-100">
          <Ionicons name="chevron-up" size={12} color="#EF4444" />
          <Text className="text-red-500 text-[10px] font-semibold">
            ESCALATED
          </Text>
        </View>
      )}
      {isHighPriority && !complaint.acceptedAt && (
        <View className="flex-row items-center gap-1 px-1.5 py-1 rounded-xl border border-red-500 bg-red-50">
          <Ionicons name="time" size={12} color="#EF4444" />
          <Text className="text-red-500 text-[10px] font-semibold">
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
    <View className="bg-slate-50 rounded-xl p-3 border-l-4 border-l-blue-500" style={style}>
      <Text className="text-xs font-bold text-slate-900 mb-2">Priority Factors:</Text>
      {factorsList.length > 0 ? (
        <View className="gap-1">
          {factorsList.map((factor, idx) => (
            <Text key={idx} className="text-xs text-slate-600 ml-1">
              {factor}
            </Text>
          ))}
        </View>
      ) : (
        <Text className="text-xs text-slate-400 italic">Standard assessment</Text>
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
    Low: "bg-emerald-50",
    Normal: "bg-blue-50",
    High: "bg-amber-50",
    Critical: "bg-red-50",
  };

  return (
    <View
      className={`border-l-4 rounded-lg p-4 mb-3 ${bgColorMap[priority]} ${(isCritical || isHigh) ? 'shadow-sm' : ''}`}
      style={[
        {
          borderLeftColor: colorMap[priority],
        },
        style,
      ]}
    >
      <View className="gap-2">
        <View className="flex-row items-center gap-2">
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
            className={`text-base flex-1 ${isCritical ? 'font-bold' : 'font-semibold'}`}
            style={{ color: colorMap[priority] }}
          >
            {isCritical ? "🚨 CRITICAL PRIORITY" : isHigh ? "⚠️ High Priority" : priority}
          </Text>
        </View>

        {complaint.alertPriorityReason && (
          <Text className="text-sm text-slate-600 ml-8">{complaint.alertPriorityReason}</Text>
        )}

        {complaint.autoEscalated && (
          <View className="flex-row items-center gap-2 bg-red-100 py-2 px-2.5 rounded-md ml-8">
            <Ionicons name="alert" size={14} color="#EF4444" />
            <Text className="text-xs text-red-500 font-medium flex-1">
              Auto-escalated due to no acceptance within timeout
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
