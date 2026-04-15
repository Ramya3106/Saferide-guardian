import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

const OfficerLoginScreen = ({ onLogin, loading, error }) => {
  const [email, setEmail] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [password, setPassword] = useState("");

  const canSubmit = useMemo(() => {
    return (email.trim().length > 4 || professionalId.trim().length > 4) && password.trim().length >= 6;
  }, [email, professionalId, password]);

  const handleSubmit = () => {
    if (!canSubmit || !onLogin) {
      return;
    }

    onLogin({
      email: email.trim().toLowerCase(),
      professionalId: professionalId.trim().toUpperCase(),
      password: password.trim(),
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Officer Login</Text>
      <Text style={styles.subtitle}>Sign in with official email or professional ID.</Text>

      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="Official email"
        placeholderTextColor="#64748B"
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextInput
        style={styles.input}
        value={professionalId}
        onChangeText={setProfessionalId}
        placeholder="Professional ID (TTR-XX-1234)"
        placeholderTextColor="#64748B"
        autoCapitalize="characters"
      />

      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        placeholderTextColor="#64748B"
        secureTextEntry
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={[styles.button, (!canSubmit || loading) && styles.buttonDisabled]}
        disabled={!canSubmit || loading}
        onPress={handleSubmit}
      >
        <Text style={styles.buttonText}>{loading ? "Signing in..." : "Login"}</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#E2E8F0",
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0F172A",
  },
  subtitle: {
    fontSize: 13,
    color: "#334155",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#94A3B8",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#0F172A",
    backgroundColor: "#FFFFFF",
  },
  button: {
    backgroundColor: "#1D4ED8",
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
  },
  buttonDisabled: {
    backgroundColor: "#94A3B8",
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  error: {
    color: "#B91C1C",
    fontSize: 12,
  },
});

export default OfficerLoginScreen;
