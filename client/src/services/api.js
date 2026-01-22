import axios from "axios";
import { Platform } from "react-native";
import Constants from "expo-constants";

// Get the API base URL based on platform and Expo host so QR-scan on a phone works.
const getBaseURL = () => {
  // Expo public env override (set EXPO_PUBLIC_API_BASE_URL)
  if (process.env.EXPO_PUBLIC_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_API_BASE_URL;
  }

  // Derive LAN host from Expo dev server (works for QR scan on physical device)
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.expoConfig?.extra?.expoGo?.hostUri ||
    Constants.manifest2?.extra?.expoGo?.hostUri ||
    Constants.manifest?.hostUri;

  if (hostUri) {
    const host = hostUri.split(":")[0];
    return `http://${host}:5000/api`;
  }

  if (__DEV__) {
    // Android emulator to local machine
    if (Platform.OS === "android") {
      return "http://10.0.2.2:5000/api";
    }
    // iOS simulator to local machine
    if (Platform.OS === "ios") {
      return "http://localhost:5000/api";
    }
  }

  // Fallback: replace with your machine's LAN IP if needed
  return "http://192.168.1.100:5000/api";
};

const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 15000, // Increased timeout for better reliability
  headers: {
    "Content-Type": "application/json",
  },
});

// Add request interceptor for debugging
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error("API Request Error:", error);
    return Promise.reject(error);
  },
);

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.code === "ECONNREFUSED" ||
      error.message.includes("Network Error")
    ) {
      console.error(
        "Cannot connect to server. Make sure the server is running on port 5000",
      );
      error.message = "Cannot connect to server. Please check your connection.";
    }
    return Promise.reject(error);
  },
);

export default api;
