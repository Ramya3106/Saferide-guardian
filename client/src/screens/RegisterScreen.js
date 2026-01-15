import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from "react-native";
import { useAuth } from "../context/AuthContext";

const ROLES = [
  { value: "passenger", label: "Passenger" },
  { value: "driver", label: "Driver" },
  { value: "conductor", label: "Conductor" },
  { value: "ttr", label: "TTR" },
  { value: "rpf", label: "RPF" },
  { value: "police", label: "Police" },
];

export default function RegisterScreen({ navigation }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("passenger");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();

  async function handleRegister() {
    if (!name || !phone || !password) {
      Alert.alert("Error", "Please fill required fields");
      return;
    }
    setLoading(true);
    try {
      await register({ name, phone, email, password, role });
    } catch (error) {
      Alert.alert(
        "Error",
        error.response?.data?.error || "Registration failed"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Create Account</Text>

      <TextInput
        style={styles.input}
        placeholder="Full Name *"
        placeholderTextColor="#666"
        value={name}
        onChangeText={setName}
      />
      <TextInput
        style={styles.input}
        placeholder="Phone Number *"
        placeholderTextColor="#666"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />
      <TextInput
        style={styles.input}
        placeholder="Email (optional)"
        placeholderTextColor="#666"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Password *"
        placeholderTextColor="#666"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <Text style={styles.label}>Select Role</Text>
      <View style={styles.roleContainer}>
        {ROLES.map((r) => (
          <TouchableOpacity
            key={r.value}
            style={[styles.roleButton, role === r.value && styles.roleSelected]}
            onPress={() => setRole(r.value)}
          >
            <Text
              style={[
                styles.roleText,
                role === r.value && styles.roleTextSelected,
              ]}
            >
              {r.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleRegister}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? "Creating..." : "Register"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.link}>Already have an account? Login</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a192f",
  },
  content: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#64ffda",
    marginBottom: 30,
    textAlign: "center",
  },
  input: {
    backgroundColor: "#112240",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#fff",
    borderWidth: 1,
    borderColor: "#233554",
    marginBottom: 15,
  },
  label: {
    color: "#ccd6f6",
    fontSize: 16,
    marginBottom: 10,
    marginTop: 5,
  },
  roleContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },
  roleButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#112240",
    borderWidth: 1,
    borderColor: "#233554",
  },
  roleSelected: {
    backgroundColor: "#64ffda",
    borderColor: "#64ffda",
  },
  roleText: {
    color: "#8892b0",
    fontSize: 14,
  },
  roleTextSelected: {
    color: "#0a192f",
  },
  button: {
    backgroundColor: "#64ffda",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#0a192f",
    fontSize: 18,
    fontWeight: "bold",
  },
  link: {
    color: "#64ffda",
    textAlign: "center",
    marginTop: 20,
    fontSize: 15,
  },
});
