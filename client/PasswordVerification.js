import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

const RULES = [
  { key: "length", label: "Exactly 6 chars" },
  { key: "uppercase", label: "Uppercase" },
  { key: "number", label: "Number" },
  { key: "special", label: "Special char" },
];

const PasswordVerification = ({ checks, metCount }) => {
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );

    pulseLoop.start();

    return () => {
      pulseLoop.stop();
    };
  }, [pulseAnim]);

  return (
    <>
      <View style={styles.barRow}>
        {[0, 1, 2, 3].map((segment) => {
          const isActive = segment < metCount;

          return (
            <Animated.View
              key={segment}
              style={[
                styles.bar,
                isActive && styles.barActive,
                isActive && {
                  transform: [
                    {
                      scaleY: pulseAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.18],
                      }),
                    },
                  ],
                },
              ]}
            />
          );
        })}
      </View>

      <Animated.View
        style={{
          opacity: pulseAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.92, 1],
          }),
        }}
      >
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
      </Animated.View>
    </>
  );
};

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
