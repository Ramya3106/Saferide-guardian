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

const getApiBase = () =>
  process.env.EXPO_PUBLIC_API_BASE ||
  (Platform.OS === "android"
    ? "http://10.0.2.2:5000/api"
    : (() => {
        const host = getDevHost();
        return host ? `http://${host}:5000/api` : "http://localhost:5000/api";
      })());

export { getApiBase };
