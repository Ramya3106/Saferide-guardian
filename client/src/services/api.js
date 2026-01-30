import axios from "axios";
import { Platform } from "react-native";
import Constants from "expo-constants";

// Store the base URL in a variable that can be updated
let cachedBaseURL = null;

// Get the API base URL based on platform and Expo host so QR-scan on a phone works.
const getBaseURL = () => {
  // Return cached URL if available (avoids recalculation)
  if (cachedBaseURL) {
    return cachedBaseURL;
  }

  // Expo public env override (set EXPO_PUBLIC_API_BASE_URL)
  if (process.env.EXPO_PUBLIC_API_BASE_URL) {
    cachedBaseURL = process.env.EXPO_PUBLIC_API_BASE_URL;
    return cachedBaseURL;
  }

  let baseURL;

  // Derive LAN host from Expo dev server (works for QR scan on physical device)
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.expoConfig?.extra?.expoGo?.hostUri ||
    Constants.manifest2?.extra?.expoGo?.hostUri ||
    Constants.manifest?.hostUri;

  if (hostUri) {
    const host = hostUri.split(":")[0];
    baseURL = `http://${host}:5000/api`;
  } else if (__DEV__) {
    // Android emulator to local machine
    if (Platform.OS === "android") {
      baseURL = "http://10.0.2.2:5000/api";
    }
    // iOS simulator to local machine
    else if (Platform.OS === "ios") {
      baseURL = "http://localhost:5000/api";
    }
  }

  // Fallback to localhost for development
  if (!baseURL) {
    baseURL = `http://${Platform.OS === "android" ? "10.0.2.2" : "localhost"}:5000/api`;
  }

  cachedBaseURL = baseURL;
  return baseURL;
};

const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 30000, // Increased timeout for reliability
  headers: {
    "Content-Type": "application/json",
  },
});

// Add request interceptor for debugging and retry logic
let retryCount = 0;
const MAX_RETRIES = 3;

api.interceptors.request.use(
  (config) => {
    console.log(
      `[API] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`,
    );
    // Add retry metadata
    config.metadata = { startTime: Date.now() };
    return config;
  },
  (error) => {
    console.error("[API Request Error]", error.message);
    return Promise.reject(error);
  },
);

// Add response interceptor for error handling with retry
api.interceptors.response.use(
  (response) => {
    retryCount = 0; // Reset on success
    return response;
  },
  async (error) => {
    const config = error.config;

    // Log detailed error information
    console.error("[API Response Error]", {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      url: config?.url,
      baseURL: config?.baseURL,
      retryCount,
    });

    // Determine if error is retryable
    const isNetworkError =
      !error.response ||
      error.code === "ECONNREFUSED" ||
      error.code === "ECONNABORTED" ||
      error.code === "ENOTFOUND" ||
      error.code === "ETIMEDOUT" ||
      error.message?.includes("Network Error") ||
      error.message?.includes("timeout");

    const isServerError = error.response?.status >= 500;
    const isRetryable = isNetworkError || isServerError;

    // Retry logic
    if (isRetryable && retryCount < MAX_RETRIES && config) {
      retryCount++;
      console.warn(
        `[API Retry] Attempt ${retryCount}/${MAX_RETRIES} for ${config.url}`,
      );

      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, retryCount - 1) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Retry the request
      return api(config);
    }

    // Build user-friendly error message
    let userMessage = "Network error occurred";

    if (error.response?.status === 401) {
      userMessage = "Unauthorized. Please login again.";
    } else if (error.response?.status === 404) {
      userMessage = "Resource not found.";
    } else if (error.response?.status >= 500) {
      userMessage = "Server error. Please try again later.";
    } else if (isNetworkError) {
      userMessage =
        "Cannot connect to server. Check your internet connection and server status.";
    } else if (error.response?.data?.error) {
      userMessage = error.response.data.error;
    }

    error.userMessage = userMessage;
    return Promise.reject(error);
  },
);

// Export utility function to check and set custom base URL
export const setCustomBaseURL = (url) => {
  cachedBaseURL = url;
  api.defaults.baseURL = url;
  console.log("[API] Custom base URL set to:", url);
};

// Export utility function to get current base URL
export const getCurrentBaseURL = () => cachedBaseURL || getBaseURL();

export default api;
