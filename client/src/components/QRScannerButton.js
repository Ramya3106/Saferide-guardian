import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

/**
 * QRScannerButton Component
 * A reusable button component to trigger QR code scanning
 * @param {Function} onPress - Callback when button is pressed
 * @param {boolean} loading - Whether the button is in loading state
 * @param {string} variant - Button style variant: 'primary', 'secondary', 'icon'
 * @param {string} size - Button size: 'small', 'medium', 'large'
 */
const QRScannerButton = ({
  onPress,
  loading = false,
  variant = "primary",
  size = "medium",
  label = "Scan QR Code",
}) => {
  const getButtonStyle = () => {
    const baseStyle = [styles.button, styles[`variant_${variant}`]];
    baseStyle.push(styles[`size_${size}`]);
    return baseStyle;
  };

  const getTextStyle = () => {
    const baseStyle = [styles.buttonText, styles[`textSize_${size}`]];
    if (variant === "icon") {
      baseStyle.push(styles.iconButtonText);
    }
    return baseStyle;
  };

  const getIconSize = () => {
    switch (size) {
      case "small":
        return 16;
      case "large":
        return 24;
      default:
        return 20;
    }
  };

  if (variant === "icon") {
    return (
      <TouchableOpacity
        style={styles.iconButton}
        onPress={onPress}
        disabled={loading}
        activeOpacity={0.7}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#3B82F6" />
        ) : (
          <Ionicons name="qr-code" size={28} color="#3B82F6" />
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={getButtonStyle()}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.7}
    >
      <View style={styles.buttonContent}>
        {loading ? (
          <ActivityIndicator
            size="small"
            color={variant === "primary" ? "white" : "#3B82F6"}
          />
        ) : (
          <Ionicons
            name="qr-code"
            size={getIconSize()}
            color={variant === "primary" ? "white" : "#3B82F6"}
          />
        )}
        <Text style={getTextStyle()}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
  },
  buttonText: {
    fontWeight: "600",
  },
  variant_primary: {
    backgroundColor: "#3B82F6",
  },
  variant_primaryText: {
    color: "white",
  },
  variant_secondary: {
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: "#3B82F6",
  },
  variant_secondaryText: {
    color: "#3B82F6",
  },
  variant_icon: {
    backgroundColor: "transparent",
  },
  size_small: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  size_medium: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  size_large: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  textSize_small: {
    fontSize: 12,
  },
  textSize_medium: {
    fontSize: 14,
  },
  textSize_large: {
    fontSize: 16,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  iconButtonText: {
    color: "#3B82F6",
  },
});

export default QRScannerButton;
