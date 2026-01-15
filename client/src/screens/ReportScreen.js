import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Image,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import api from "../services/api";

const ITEM_TYPES = [
  { value: "passport", label: "Passport", icon: "🛂" },
  { value: "wallet", label: "Wallet", icon: "👛" },
  { value: "phone", label: "Phone", icon: "📱" },
  { value: "laptop", label: "Laptop", icon: "💻" },
  { value: "bag", label: "Bag", icon: "🎒" },
  { value: "jewelry", label: "Jewelry", icon: "💍" },
  { value: "documents", label: "Documents", icon: "📄" },
  { value: "other", label: "Other", icon: "📦" },
];

const VEHICLE_TYPES = [
  { value: "train", label: "Train 🚂" },
  { value: "bus", label: "Bus 🚌" },
  { value: "metro", label: "Metro 🚇" },
];

export default function ReportScreen({ navigation }) {
  const [itemType, setItemType] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [lastSeenLocation, setLastSeenLocation] = useState("");
  const [photos, setPhotos] = useState([]);
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getLocation();
  }, []);

  async function getLocation() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === "granted") {
      const loc = await Location.getCurrentPositionAsync({});
      setLocation(loc.coords);
    }
  }

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsMultipleSelection: true,
    });
    if (!result.canceled) {
      setPhotos([...photos, ...result.assets.slice(0, 5 - photos.length)]);
    }
  }

  async function handleSubmit() {
    if (!itemType || !itemDescription || !vehicleType) {
      Alert.alert("Error", "Please fill required fields");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("itemType", itemType);
      formData.append("itemDescription", itemDescription);
      formData.append("vehicleType", vehicleType);
      formData.append("vehicleNumber", vehicleNumber);
      formData.append("lastSeenLocation", lastSeenLocation);
      formData.append("incidentTime", new Date().toISOString());

      if (location) {
        formData.append(
          "geoLocation",
          JSON.stringify({
            type: "Point",
            coordinates: [location.longitude, location.latitude],
          })
        );
      }

      photos.forEach((photo, i) => {
        formData.append("photos", {
          uri: photo.uri,
          type: "image/jpeg",
          name: `photo_${i}.jpg`,
        });
      });

      await api.post("/complaints", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      Alert.alert(
        "Success",
        "Complaint submitted! Alerts sent to relevant staff.",
        [{ text: "OK", onPress: () => navigation.navigate("MyComplaints") }]
      );
    } catch (error) {
      Alert.alert("Error", error.response?.data?.error || "Failed to submit");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Report Lost Item</Text>

      <Text style={styles.label}>Item Type *</Text>
      <View style={styles.typeGrid}>
        {ITEM_TYPES.map((type) => (
          <TouchableOpacity
            key={type.value}
            style={[
              styles.typeCard,
              itemType === type.value && styles.typeSelected,
            ]}
            onPress={() => setItemType(type.value)}
          >
            <Text style={styles.typeIcon}>{type.icon}</Text>
            <Text
              style={[
                styles.typeLabel,
                itemType === type.value && styles.typeLabelSelected,
              ]}
            >
              {type.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Description *</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Describe your item (color, brand, contents...)"
        placeholderTextColor="#666"
        value={itemDescription}
        onChangeText={setItemDescription}
        multiline
        numberOfLines={3}
      />

      <Text style={styles.label}>Vehicle Type *</Text>
      <View style={styles.vehicleRow}>
        {VEHICLE_TYPES.map((v) => (
          <TouchableOpacity
            key={v.value}
            style={[
              styles.vehicleBtn,
              vehicleType === v.value && styles.vehicleSelected,
            ]}
            onPress={() => setVehicleType(v.value)}
          >
            <Text style={styles.vehicleText}>{v.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TextInput
        style={styles.input}
        placeholder="Vehicle/Train Number"
        placeholderTextColor="#666"
        value={vehicleNumber}
        onChangeText={setVehicleNumber}
      />

      <TextInput
        style={styles.input}
        placeholder="Last seen location (station/stop name)"
        placeholderTextColor="#666"
        value={lastSeenLocation}
        onChangeText={setLastSeenLocation}
      />

      <Text style={styles.label}>Photos (optional)</Text>
      <TouchableOpacity style={styles.photoBtn} onPress={pickImage}>
        <Text style={styles.photoBtnText}>
          📷 Add Photos ({photos.length}/5)
        </Text>
      </TouchableOpacity>
      {photos.length > 0 && (
        <View style={styles.photoPreview}>
          {photos.map((photo, i) => (
            <Image
              key={i}
              source={{ uri: photo.uri }}
              style={styles.thumbnail}
            />
          ))}
        </View>
      )}

      {location && (
        <Text style={styles.locationText}>
          📍 Location captured: {location.latitude.toFixed(4)},{" "}
          {location.longitude.toFixed(4)}
        </Text>
      )}

      <TouchableOpacity
        style={[styles.submitBtn, loading && styles.submitDisabled]}
        onPress={handleSubmit}
        disabled={loading}
      >
        <Text style={styles.submitText}>
          {loading ? "Submitting..." : "Submit Report"}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f0f23",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#e94560",
    marginBottom: 20,
  },
  label: {
    color: "#fff",
    fontSize: 16,
    marginBottom: 10,
    marginTop: 15,
  },
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  typeCard: {
    width: "23%",
    aspectRatio: 1,
    backgroundColor: "#1a1a2e",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  typeSelected: {
    borderColor: "#e94560",
    backgroundColor: "#16213e",
  },
  typeIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  typeLabel: {
    fontSize: 11,
    color: "#8b8b8b",
  },
  typeLabelSelected: {
    color: "#e94560",
  },
  input: {
    backgroundColor: "#1a1a2e",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#fff",
    borderWidth: 1,
    borderColor: "#16213e",
    marginBottom: 10,
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  vehicleRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 15,
  },
  vehicleBtn: {
    flex: 1,
    padding: 15,
    backgroundColor: "#1a1a2e",
    borderRadius: 12,
    alignItems: "center",
  },
  vehicleSelected: {
    backgroundColor: "#e94560",
  },
  vehicleText: {
    color: "#fff",
    fontSize: 14,
  },
  photoBtn: {
    backgroundColor: "#16213e",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#e94560",
  },
  photoBtnText: {
    color: "#e94560",
    fontSize: 16,
  },
  photoPreview: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  locationText: {
    color: "#8b8b8b",
    fontSize: 13,
    marginTop: 15,
  },
  submitBtn: {
    backgroundColor: "#e94560",
    borderRadius: 12,
    padding: 18,
    alignItems: "center",
    marginTop: 25,
    marginBottom: 40,
  },
  submitDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
});
