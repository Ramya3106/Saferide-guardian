import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../services/api";

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  async function loadStoredAuth() {
    try {
      const storedToken = await AsyncStorage.getItem("@saferide:token");
      const storedUser = await AsyncStorage.getItem("@saferide:user");
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        api.defaults.headers.Authorization = `Bearer ${storedToken}`;
      }
    } catch (e) {
      console.error("Failed to load auth:", e);
    } finally {
      setLoading(false);
    }
  }

  async function login(phone, password) {
    const response = await api.post("/auth/login", { phone, password });
    const { token: newToken, user: newUser } = response.data;
    await AsyncStorage.setItem("@saferide:token", newToken);
    await AsyncStorage.setItem("@saferide:user", JSON.stringify(newUser));
    api.defaults.headers.Authorization = `Bearer ${newToken}`;
    setToken(newToken);
    setUser(newUser);
  }

  async function register(data) {
    try {
      const response = await api.post("/auth/register", data);
      const { token: newToken, user: newUser } = response.data;
      await AsyncStorage.setItem("@saferide:token", newToken);
      await AsyncStorage.setItem("@saferide:user", JSON.stringify(newUser));
      api.defaults.headers.Authorization = `Bearer ${newToken}`;
      setToken(newToken);
      setUser(newUser);
      return { success: true };
    } catch (error) {
      // Re-throw error so RegisterScreen can handle it
      throw error;
    }
  }

  async function logout() {
    await AsyncStorage.removeItem("@saferide:token");
    await AsyncStorage.removeItem("@saferide:user");
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

