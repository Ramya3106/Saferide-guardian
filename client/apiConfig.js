import { Platform } from "react-native";
import Constants from "expo-constants";

const getDevHost = () => {
  const hostUri =
    Constants.expoConfig?.hostUri || Constants.manifest?.debuggerHost;

  if (!hostUri) {
    return null;
  }

  const withoutScheme = hostUri.includes("://")
    ? hostUri.split("://")[1]
    : hostUri;

  const host = withoutScheme.split(":")[0];
  return host || null;
};

const getApiBase = () => {
  const configuredBase = process.env.EXPO_PUBLIC_API_BASE;
  const forceConfigured =
    process.env.EXPO_PUBLIC_API_BASE_FORCE === "true";

  if (typeof __DEV__ !== "undefined" && __DEV__) {
    const host = getDevHost();
    if (host && !forceConfigured) {
      return `http://${host}:5000/api`;
    }
  }

  if (configuredBase) {
    return configuredBase;
  }

  return Platform.OS === "android"
    ? "http://10.0.2.2:5000/api"
    : "http://localhost:5000/api";
};

export { getApiBase };
