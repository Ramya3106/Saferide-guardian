import React from "react";
import { StyleSheet, Text, View } from "react-native";

const RULES = [
  { key: "length", label: "Exactly 6 characters" },
];

const PasswordVerification = ({ checks, metCount }) => (
  <>
    <View style={styles.barRow}>
      {RULES.map((_, segment) => (
        <View
          key={segment}
          style={[styles.bar, segment < metCount && styles.barActive]}
        />
      ))}
    </View>

    <View style={styles.ruleRow}>
      {RULES.map((rule) => {
        const isMet = Boolean(checks?.[rule.key]);

        return (
          <Text
            key={rule.key}
            style={[styles.ruleText, isMet && styles.ruleTextActive]}
          >
            {isMet ? "\u2713" : "\u25CB"} {rule.label}
          </Text>
        );
      })}
    </View>
  </>
);

const styles = StyleSheet.create({
  barRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 6,
  },
  bar: {
    flex: 1,
    height: 4,
    borderRadius: 999,
    backgroundColor: "#334155",
    opacity: 0.4,
  },
  barActive: {
    backgroundColor: "#22C55E",
    opacity: 1,
  },
  ruleRow: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    rowGap: 6,
  },
  ruleText: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600",
  },
  ruleTextActive: {
    color: "#10B981",
  },
});

export default PasswordVerification;
