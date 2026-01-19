import axios from "axios";
import { Platform } from "react-native";

// Get the API base URL based on the platform
const getBaseURL = () => {
  // You can override this by setting API_BASE_URL environment variable
  // For Expo: use expo-constants or environment config
  
  if (__DEV__) {
    // For Android emulator, use special IP that maps to host's localhost
    if (Platform.OS === "android") {
      // 10.0.2.2 is the special IP that Android emulator uses to access host machine's localhost
      return "http://10.0.2.2:5000/api";
    }
    // For iOS simulator, localhost works
    if (Platform.OS === "ios") {
      return "http://localhost:5000/api";
    }
  }
  // For physical devices, use your actual local network IP
  // Change this to your computer's IP address when testing on physical device
  // Windows: ipconfig -> IPv4 Address
  // Mac/Linux: ifconfig or ip addr
  return "http://192.168.1.5:5000/api";
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
  }
);

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === "ECONNREFUSED" || error.message.includes("Network Error")) {
      console.error("Cannot connect to server. Make sure the server is running on port 5000");
      error.message = "Cannot connect to server. Please check your connection.";
    }
    return Promise.reject(error);
  }
);

export default api;

