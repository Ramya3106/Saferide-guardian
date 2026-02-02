import React, { useMemo, useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const App = () => {
  const [mode, setMode] = useState("login");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const isRegister = mode === "register";

  const canSubmit = useMemo(() => {
    if (isRegister) {
      return (
        name.trim().length >= 2 &&
        email.trim().length >= 5 &&
        password.trim().length >= 6 &&
        confirmPassword.trim().length >= 6
      );
    }
    return email.trim().length >= 5 && password.trim().length >= 6;
  }, [email, isRegister, name, password, confirmPassword]);

  const resetForm = () => {
    setName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setError("");
  };

  const handleSubmit = () => {
    if (!canSubmit) {
      setError("Please fill all fields correctly.");
      return;
    }

    if (isRegister && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError("");
    setIsAuthenticated(true);
  };

  const handleSwitchMode = () => {
    setMode((prev) => (prev === "login" ? "register" : "login"));
    resetForm();
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setMode("login");
    resetForm();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.backgroundGlow} />
      <View style={styles.card}>
        <View style={styles.brandRow}>
          <View>
            <Text style={styles.title}>SafeRide Guardian</Text>
            <Text style={styles.subtitle}>
              AI-Powered Lost Item Recovery for Public Transport
            </Text>
          </View>
          <View style={styles.statusPill}>
            <View style={styles.statusDot} />
            <Text style={styles.statusPillText}>Secure</Text>
          </View>
        </View>
        <View style={styles.divider} />

        {isAuthenticated ? (
          <View style={styles.home}>
            <Text style={styles.welcome}>Welcome back!</Text>
            <Text style={styles.homeText}>
              You are signed in and ready to track and recover lost items.
            </Text>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleLogout}
            >
              <Text style={styles.secondaryButtonText}>Log out</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            <Text style={styles.formTitle}>
              {isRegister ? "Create your account" : "Sign in to continue"}
            </Text>

            {isRegister && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Full name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your name"
                  placeholderTextColor="#94A3B8"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email address</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor="#94A3B8"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor="#94A3B8"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            {isRegister && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Confirm password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Re-enter your password"
                  placeholderTextColor="#94A3B8"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                />
              </View>
            )}

            {error.length > 0 && <Text style={styles.errorText}>{error}</Text>}

            <TouchableOpacity
              style={[
                styles.primaryButton,
                !canSubmit && styles.buttonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!canSubmit}
            >
              <Text style={styles.primaryButtonText}>
                {isRegister ? "Create account" : "Log in"}
              </Text>
            </TouchableOpacity>

            <View style={styles.switchRow}>
              <Text style={styles.switchText}>
                {isRegister ? "Already have an account?" : "New here?"}
              </Text>
              <TouchableOpacity onPress={handleSwitchMode}>
                <Text style={styles.switchLink}>
                  {isRegister ? "Log in" : "Create one"}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>
                By continuing, you agree to our privacy policy.
              </Text>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B1220",
  },
  backgroundGlow: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "#1E3A8A",
    opacity: 0.2,
    top: 40,
    right: -80,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  card: {
    width: "100%",
    backgroundColor: "#121B2E",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "#1E2A44",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  brandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#F8FAFC",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#CBD5F5",
    marginBottom: 20,
    lineHeight: 20,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0F172A",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#1D4ED8",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#22C55E",
    marginRight: 6,
  },
  statusPillText: {
    color: "#BFDBFE",
    fontSize: 12,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: "#1E2A44",
    marginBottom: 18,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#E2E8F0",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#F8FAFC",
    marginBottom: 6,
  },
  sectionSubtitle: {
    color: "#94A3B8",
    marginBottom: 16,
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    color: "#94A3B8",
    fontSize: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#0B1220",
    borderColor: "#1E2A44",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    color: "#F8FAFC",
  },
  roleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  roleChip: {
    borderWidth: 1,
    borderColor: "#1E2A44",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  roleChipActive: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },
  roleChipText: {
    color: "#CBD5F5",
    fontSize: 12,
  },
  roleChipTextActive: {
    color: "#F8FAFC",
    fontWeight: "600",
  },
  errorText: {
    color: "#F87171",
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 6,
    shadowColor: "#1D4ED8",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: "#F8FAFC",
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 14,
  },
  switchText: {
    color: "#94A3B8",
    marginRight: 6,
  },
  switchLink: {
    color: "#38BDF8",
    fontWeight: "600",
  },
  footerRow: {
    marginTop: 18,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#1E2A44",
  },
  footerText: {
    color: "#64748B",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 16,
  },
  home: {
    marginTop: 6,
  },
  welcome: {
    fontSize: 20,
    fontWeight: "600",
    color: "#F8FAFC",
    marginBottom: 6,
  },
  homeText: {
    color: "#CBD5F5",
    marginBottom: 16,
    lineHeight: 20,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#38BDF8",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#38BDF8",
    fontWeight: "600",
  },
});

export default App;
