import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiBase } from "../../apiConfig";

const apiClient = axios.create({
  baseURL: getApiBase(),
  timeout: 20000,
});

apiClient.interceptors.request.use(async (config) => {
  const nextConfig = { ...config };
  const token = await AsyncStorage.getItem("authToken");
  const role = await AsyncStorage.getItem("authUserRole");
  const email = await AsyncStorage.getItem("authUserEmail");
  const professionalId = await AsyncStorage.getItem("authProfessionalId");
  const userName = await AsyncStorage.getItem("authUserName");
  const dutyUnit = await AsyncStorage.getItem("authDutyUnit");

  nextConfig.headers = {
    ...(nextConfig.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(role ? { "X-User-Role": role } : {}),
    ...(email ? { "X-User-Email": email } : {}),
    ...(professionalId ? { "X-Professional-Id": professionalId } : {}),
    ...(userName ? { "X-User-Name": userName } : {}),
    ...(dutyUnit ? { "X-Duty-Unit": dutyUnit } : {}),
  };

  return nextConfig;
});

export const setAuthContext = async ({ token, role, email, professionalId, userName, dutyUnit } = {}) => {
  const entries = [
    ["authToken", token],
    ["authUserRole", role],
    ["authUserEmail", email],
    ["authProfessionalId", professionalId],
    ["authUserName", userName],
    ["authDutyUnit", dutyUnit],
  ].filter(([, value]) => value !== undefined && value !== null && String(value).length > 0);

  await AsyncStorage.multiSet(entries.map(([key, value]) => [key, String(value)]));
};

export const clearAuthContext = async () => {
  await AsyncStorage.multiRemove([
    "authToken",
    "authUserRole",
    "authUserEmail",
    "authProfessionalId",
    "authUserName",
    "authDutyUnit",
  ]);
};

export default apiClient;
