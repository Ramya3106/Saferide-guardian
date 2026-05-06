import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  token: null,
  userRole: "Passenger",
  userEmail: "",
  userName: "",
  professionalId: "",
  dutyUnit: "",
  isAuthenticated: false,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      const payload = action.payload || {};
      state.token = payload.token || null;
      state.userRole = payload.userRole || state.userRole;
      state.userEmail = payload.userEmail || "";
      state.userName = payload.userName || "";
      state.professionalId = payload.professionalId || "";
      state.dutyUnit = payload.dutyUnit || "";
      state.isAuthenticated = Boolean(state.token || state.userEmail || state.professionalId);
    },
    updateDutyIdentity: (state, action) => {
      const payload = action.payload || {};
      if (payload.dutyUnit) state.dutyUnit = payload.dutyUnit;
      if (payload.professionalId) state.professionalId = payload.professionalId;
      if (payload.userRole) state.userRole = payload.userRole;
      if (payload.userName) state.userName = payload.userName;
      if (payload.userEmail) state.userEmail = payload.userEmail;
      state.isAuthenticated = Boolean(state.token || state.userEmail || state.professionalId);
    },
    logout: () => ({ ...initialState }),
  },
});

export const { setCredentials, updateDutyIdentity, logout } = authSlice.actions;
export const selectAuth = (state) => state.auth;
export default authSlice.reducer;
