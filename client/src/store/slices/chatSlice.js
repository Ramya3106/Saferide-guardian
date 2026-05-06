import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { sendPassengerMessage } from "../../services/complaintService";

export const sendComplaintMessage = createAsyncThunk(
  "chat/sendMessage",
  async ({ complaintId, text, headers } = {}) => sendPassengerMessage(complaintId, text, headers),
);

const initialState = {
  threads: {},
  sending: false,
  error: null,
};

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    seedThread: (state, action) => {
      const { complaintId, messages = [] } = action.payload || {};
      if (!complaintId) return;
      state.threads[complaintId] = {
        complaintId,
        messages,
        lastUpdatedAt: new Date().toISOString(),
      };
    },
    appendMessage: (state, action) => {
      const { complaintId, message } = action.payload || {};
      if (!complaintId || !message) return;
      const thread = state.threads[complaintId] || { complaintId, messages: [] };
      thread.messages = [...thread.messages, message];
      thread.lastUpdatedAt = new Date().toISOString();
      state.threads[complaintId] = thread;
    },
    clearThread: (state, action) => {
      const complaintId = action.payload;
      if (complaintId && state.threads[complaintId]) {
        delete state.threads[complaintId];
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(sendComplaintMessage.pending, (state) => {
        state.sending = true;
        state.error = null;
      })
      .addCase(sendComplaintMessage.fulfilled, (state, action) => {
        state.sending = false;
        const complaintId = action.meta?.arg?.complaintId;
        const thread = state.threads[complaintId] || { complaintId, messages: [] };
        thread.messages = [...thread.messages, action.payload?.message || action.payload || {}];
        thread.lastUpdatedAt = new Date().toISOString();
        state.threads[complaintId] = thread;
      })
      .addCase(sendComplaintMessage.rejected, (state, action) => {
        state.sending = false;
        state.error = action.error?.message || "Unable to send message";
      });
  },
});

export const { seedThread, appendMessage, clearThread } = chatSlice.actions;
export const selectChat = (state) => state.chat;
export default chatSlice.reducer;
