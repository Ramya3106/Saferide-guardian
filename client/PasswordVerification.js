import React, { useEffect, useRef } from "react";
import { Animated, Text, View } from "react-native";

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
      <View className="mt-2.5 flex-row gap-1.5">
        {[0, 1, 2, 3].map((segment) => {
          const isActive = segment < metCount;

          return (
            <Animated.View
              key={segment}
              className={`flex-1 h-1 rounded-full ${isActive ? "bg-green-500 opacity-100" : "bg-slate-700 opacity-40"}`}
              style={
                isActive
                  ? {
                      transform: [
                        {
                          scaleY: pulseAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [1, 1.18],
                          }),
                        },
                      ],
                    }
                  : undefined
              }
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
        <View className="mt-2 flex-row flex-wrap gap-3">
          {RULES.map((rule) => {
            const isMet = Boolean(checks?.[rule.key]);

            return (
              <Text
                key={rule.key}
                className={`text-xs font-semibold ${isMet ? "text-emerald-500" : "text-slate-400"}`}
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

export default PasswordVerification;
