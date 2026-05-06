import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  items: [],
  unreadCount: 0,
};

const notificationsSlice = createSlice({
  name: "notifications",
  initialState,
  reducers: {
    pushNotification: (state, action) => {
      const notification = {
        id: action.payload?.id || `${Date.now()}`,
        title: action.payload?.title || "Notification",
        message: action.payload?.message || "",
        type: action.payload?.type || "info",
        createdAt: action.payload?.createdAt || new Date().toISOString(),
        read: false,
      };
      state.items.unshift(notification);
      state.unreadCount += 1;
    },
    markNotificationRead: (state, action) => {
      const item = state.items.find((entry) => entry.id === action.payload);
      if (item && !item.read) {
        item.read = true;
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }
    },
    clearNotifications: (state) => {
      state.items = [];
      state.unreadCount = 0;
    },
  },
});

export const { pushNotification, markNotificationRead, clearNotifications } = notificationsSlice.actions;
export const selectNotifications = (state) => state.notifications;
export default notificationsSlice.reducer;
