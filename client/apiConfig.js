import { Platform } from "react-native";
import Constants from "expo-constants";

const extractHost = (value) => {
  if (!value || typeof value !== "string") {
    return null;
  }

  const withoutScheme = value.includes("://") ? value.split("://")[1] : value;
  const host = withoutScheme.split(":")[0];
  if (!host || host === "localhost" || host === "127.0.0.1") {
    return null;
  }

  return host;
};

const getDevHost = () => {
  const hostCandidates = [
    Constants.expoConfig?.hostUri,
    Constants.expoGoConfig?.debuggerHost,
    Constants.manifest?.debuggerHost,
    Constants.manifest2?.extra?.expoClient?.hostUri,
  ];

  for (const candidate of hostCandidates) {
    const host = extractHost(candidate);
    if (host) {
      return host;
    }
  }

  return null;
};

const getApiBase = () => {
  const configuredBase = process.env.EXPO_PUBLIC_API_BASE;
  const forceConfigured = process.env.EXPO_PUBLIC_API_BASE_FORCE === "true";

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
